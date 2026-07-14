// Edge Function: import-electoral-data
//
// Importa dados públicos do TSE (Portal de Dados Abertos, licença CC-BY) pra
// dentro do Lidera+: zonas eleitorais, locais de votação e seções de
// Pernambuco. Referência: docs sobre "expectativa x realidade" de votos por
// local de votação (comparação com a expectativa informada por liderança).
//
// Por que baixar aqui dentro (e não gerar os INSERTs manualmente): o arquivo
// oficial da TSE é nacional (todos os estados), ~45MB compactado / ~200MB
// descompactado — processar isso fora do banco e gerar SQL seria inviável.
// Esta função baixa o zip, descompacta em streaming (nunca materializa os
// 200MB como uma string só) e filtra só SG_UF="PE" linha a linha, mantendo
// em memória só os mapas já deduplicados de zona/local/seção (poucos MB).
//
// Fonte: https://dadosabertos.tse.jus.br/dataset/eleitorado-atual
// Arquivo: "Eleitorado por local de votação" (todas as UFs, sem versão só-PE
// disponível — por isso baixamos o nacional e filtramos aqui).
//
// Idempotente: se as tabelas já têm dados, não faz nada (a menos que
// ?force=true seja passado na URL) — evita reprocessar o arquivo de 45MB à
// toa se a function for chamada de novo por engano.
//
// verify_jwt=false: função de manutenção pontual, sem dado sensível de
// cliente (só referência geográfica pública), protegida pelo guard de
// idempotência acima. Considerar remover/desabilitar esta function depois
// da primeira importação bem-sucedida.

import { createClient } from "npm:@supabase/supabase-js@2"

const ZIP_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitorado/eleitorado_local_votacao_ATUAL.zip"
const TARGET_UF = ';"PE";'
const BATCH_SIZE = 1000

type ZoneRow = { municipio_codigo: string; municipio_nome: string; zona_numero: number }
type LocationRow = {
  municipio_codigo: string; municipio_nome: string; zona_numero: number; local_numero: number
  nome: string; endereco: string | null; bairro: string | null; cep: string | null
  latitude: number | null; longitude: number | null; situacao: string | null; eleitores_total: number
}
type SectionRow = {
  municipio_codigo: string; zona_numero: number; local_numero: number; secao_numero: number
  eleitores: number | null; situacao: string | null
}

function esc(s: string): string | null {
  const v = s.trim()
  if (v === "" || v === "#NULO" || v === "-1") return null
  return v
}
function toNum(s: string): number | null {
  const v = s.trim()
  if (v === "") return null
  const f = parseFloat(v.replace(",", "."))
  return Number.isFinite(f) ? f : null
}
function toIntOrNull(s: string): number | null {
  const v = s.trim()
  if (v === "") return null
  const i = parseInt(v, 10)
  return Number.isFinite(i) ? i : null
}

// Parser de linha CSV com delimitador ";" e campos entre aspas duplas (aspas
// duplicadas "" viram uma aspas literal) — formato usado pela TSE.
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  const n = line.length
  while (i < n) {
    if (line[i] === '"') {
      let j = i + 1
      let val = ""
      while (j < n) {
        if (line[j] === '"') {
          if (line[j + 1] === '"') { val += '"'; j += 2; continue }
          break
        }
        val += line[j]
        j++
      }
      out.push(val)
      i = j + 1
      if (line[i] === ";") i++
    } else {
      let j = line.indexOf(";", i)
      if (j === -1) j = n
      out.push(line.slice(i, j))
      i = j + 1
    }
  }
  return out
}

// Localiza a entrada .csv dentro do zip lendo os local file headers
// sequencialmente (não depende de qual entrada vem primeiro no arquivo).
function findCsvEntry(buf: Uint8Array): { dataStart: number; dataLen: number; method: number; name: string } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let pos = 0
  while (pos + 30 <= buf.length) {
    const sig = dv.getUint32(pos, true)
    if (sig !== 0x04034b50) break // fim das entradas locais (chegou no central directory)
    const flags = dv.getUint16(pos + 6, true)
    const method = dv.getUint16(pos + 8, true)
    const compSize = dv.getUint32(pos + 18, true)
    const nameLen = dv.getUint16(pos + 26, true)
    const extraLen = dv.getUint16(pos + 28, true)
    const nameStart = pos + 30
    const name = new TextDecoder("utf-8").decode(buf.subarray(nameStart, nameStart + nameLen))
    const dataStart = nameStart + nameLen + extraLen
    if (name.toLowerCase().endsWith(".csv")) {
      if (flags & 0x8) {
        throw new Error(`Entrada "${name}" usa data descriptor (tamanho não vem no header) — parser não cobre esse caso`)
      }
      return { dataStart, dataLen: compSize, method, name }
    }
    pos = dataStart + compSize
  }
  throw new Error("Nenhum arquivo .csv encontrado dentro do zip")
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } })
}

async function batchInsertReturning<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: T[],
  returning: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { data, error } = await supabase.from(table).insert(batch).select(returning)
    if (error) throw new Error(`Erro inserindo em ${table} (lote ${i}): ${error.message}`)
    out.push(...(data ?? []))
  }
  return out
}

// O download (~45MB) + parse (~500 mil linhas) + import passam bem do tempo
// de resposta HTTP que o invocador (nosso próprio fetch de disparo) consegue
// esperar. Por isso o trabalho pesado roda em background via
// EdgeRuntime.waitUntil — a function responde "started" na hora, e quem
// disparou confere o resultado depois via get_logs / contagem nas tabelas.
async function runImport(force: boolean) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  async function checkpoint(step: string, detail?: string) {
    console.log(`[import-electoral-data] ${step} ${detail ?? ""}`)
    await supabase.from("import_debug_log").insert({ step, detail: detail ?? null })
  }

  await checkpoint("iniciando", `force=${force}`)
  try {
    if (!force) {
      const { count, error } = await supabase.from("electoral_zones").select("id", { count: "exact", head: true })
      if (error) throw error
      if ((count ?? 0) > 0) {
        await checkpoint("pulado", `electoral_zones já tem ${count} linhas`)
        return
      }
    }

    await checkpoint("baixando_zip")
    const zipResp = await fetch(ZIP_URL)
    if (!zipResp.ok) throw new Error(`Falha ao baixar zip: HTTP ${zipResp.status}`)
    const zipBuf = new Uint8Array(await zipResp.arrayBuffer())
    await checkpoint("zip_baixado", `${zipBuf.length} bytes`)

    const entry = findCsvEntry(zipBuf)
    await checkpoint("entrada_csv_localizada", `${entry.name} comp=${entry.dataLen} method=${entry.method}`)
    // subarray (view, sem copiar) em vez de slice — evita duplicar 45MB em memória.
    const compressedSlice = zipBuf.subarray(entry.dataStart, entry.dataStart + entry.dataLen)

    // Alimenta o DecompressionStream em pedaços pequenos (256KB) em vez do
    // buffer de 45MB inteiro de uma vez — isso evita que o decompressor
    // tente materializar os ~200MB de saída de uma só vez (o que provocou
    // um travamento por pressão de memória na primeira tentativa).
    const INPUT_CHUNK = 256 * 1024
    const rawStream = new ReadableStream<Uint8Array>({
      start(controller) {
        let offset = 0
        while (offset < compressedSlice.length) {
          const end = Math.min(offset + INPUT_CHUNK, compressedSlice.length)
          controller.enqueue(compressedSlice.subarray(offset, end))
          offset = end
        }
        controller.close()
      },
    })
    const stream = entry.method === 0 ? rawStream : rawStream.pipeThrough(new DecompressionStream("deflate-raw"))
    const reader = stream.getReader()
    const decoder = new TextDecoder("iso-8859-1")
    await checkpoint("stream_pronto")

    const zones = new Map<string, ZoneRow>()
    const locations = new Map<string, LocationRow>()
    const sections = new Map<string, SectionRow>()
    let headerSkipped = false
    let totalLines = 0
    let peLines = 0
    let leftover = ""

    function processLine(rawLine: string) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
      if (!headerSkipped) { headerSkipped = true; return }
      if (!line) return
      totalLines++
      if (!line.includes(TARGET_UF)) return
      peLines++

      const f = parseCsvLine(line)
      const cdMun = f[7].trim()
      const nmMun = f[8].trim()
      const zona = parseInt(f[9], 10)
      const secao = parseInt(f[10], 10)
      const local = parseInt(f[14], 10)
      const nmLocal = f[15].trim()
      const endereco = f[18]
      const bairro = f[19]
      const cep = f[20]
      const lat = f[22]
      const lon = f[23]
      const situLocal = f[25]
      const situSecao = f[29]
      const qtEleitor = f[34]

      const zkey = `${cdMun}|${zona}`
      if (!zones.has(zkey)) zones.set(zkey, { municipio_codigo: cdMun, municipio_nome: nmMun, zona_numero: zona })

      const lkey = `${cdMun}|${zona}|${local}`
      if (!locations.has(lkey)) {
        locations.set(lkey, {
          municipio_codigo: cdMun, municipio_nome: nmMun, zona_numero: zona, local_numero: local,
          nome: nmLocal, endereco: esc(endereco), bairro: esc(bairro), cep: esc(cep),
          latitude: toNum(lat), longitude: toNum(lon), situacao: esc(situLocal), eleitores_total: 0,
        })
      }
      locations.get(lkey)!.eleitores_total += toIntOrNull(qtEleitor) ?? 0

      const skey = `${cdMun}|${zona}|${secao}`
      sections.set(skey, {
        municipio_codigo: cdMun, zona_numero: zona, local_numero: local, secao_numero: secao,
        eleitores: toIntOrNull(qtEleitor), situacao: esc(situSecao),
      })
    }

    let chunkCount = 0
    let bytesDecoded = 0
    while (true) {
      const { value, done } = await reader.read()
      if (value) {
        chunkCount++
        bytesDecoded += value.length
        if (leftover.length > 5_000_000) {
          throw new Error(`leftover cresceu demais (${leftover.length} chars) — provável corrupção no stream de descompressão`)
        }
        const text = leftover + decoder.decode(value, { stream: true })
        const lines = text.split("\n")
        leftover = lines.pop() ?? ""
        for (const l of lines) processLine(l)
        if (chunkCount % 50 === 0) {
          await checkpoint("progresso", `chunk=${chunkCount} bytesDecoded=${bytesDecoded} linhasBrasil=${totalLines} linhasPE=${peLines} leftoverLen=${leftover.length}`)
        }
      }
      if (done) {
        if (leftover) processLine(leftover)
        break
      }
    }
    await checkpoint("parse_concluido", `chunks=${chunkCount} bytesDecoded=${bytesDecoded} ${totalLines} linhas Brasil, ${peLines} linhas PE, ${zones.size} zonas, ${locations.size} locais, ${sections.size} seções`)

    // 1) zonas
    const zoneRows = Array.from(zones.values())
    const insertedZones = await batchInsertReturning(supabase, "electoral_zones", zoneRows, "id, municipio_codigo, zona_numero")
    const zoneIdMap = new Map<string, string>()
    for (const z of insertedZones) zoneIdMap.set(`${z.municipio_codigo}|${z.zona_numero}`, z.id as string)
    await checkpoint("zonas_inseridas", `${insertedZones.length}`)

    // 2) locais (referenciando zone_id)
    const locationRows = Array.from(locations.values()).map((l) => ({
      ...l,
      zone_id: zoneIdMap.get(`${l.municipio_codigo}|${l.zona_numero}`) ?? null,
    }))
    const insertedLocations = await batchInsertReturning(
      supabase, "polling_locations", locationRows, "id, municipio_codigo, zona_numero, local_numero",
    )
    const locationIdMap = new Map<string, string>()
    for (const l of insertedLocations) locationIdMap.set(`${l.municipio_codigo}|${l.zona_numero}|${l.local_numero}`, l.id as string)
    await checkpoint("locais_inseridos", `${insertedLocations.length}`)

    // 3) seções (referenciando location_id)
    const sectionRows = Array.from(sections.values()).map((s) => ({
      ...s,
      location_id: locationIdMap.get(`${s.municipio_codigo}|${s.zona_numero}|${s.local_numero}`) ?? null,
    }))
    await batchInsertReturning(supabase, "electoral_sections", sectionRows, "id")
    await checkpoint("secoes_inseridas", `${sectionRows.length}`)

    await checkpoint("concluido", JSON.stringify({
      arquivo: entry.name, linhas_totais_brasil: totalLines, linhas_pe: peLines,
      zonas_importadas: zoneRows.length, locais_importados: locationRows.length, secoes_importadas: sectionRows.length,
    }))
  } catch (err) {
    await checkpoint("erro", `${(err as Error).message}\n${(err as Error).stack}`)
  }
}

Deno.serve((req) => {
  const url = new URL(req.url)
  const force = url.searchParams.get("force") === "true"
  // @ts-ignore — EdgeRuntime é global no runtime do Supabase, não no typecheck local
  EdgeRuntime.waitUntil(runImport(force))
  return jsonResponse({ ok: true, started: true, note: "rodando em background — acompanhe via get_logs (service edge-function)" })
})
