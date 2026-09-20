// Edge Function: import-election-results
//
// Importa o resultado REAL de votação por seção eleitoral, do Portal de
// Dados Abertos do TSE, e cruza com o candidato configurado em cada
// organização (organizations.election_year / election_cargo /
// election_candidate_number, ver /configuracoes/eleicao). Alimenta a tabela
// election_results_sections, usada pelo relatório "Comparativo de votos"
// (/relatorios/comparativo-votos) pra cruzar expectativa x resultado real.
//
// Fonte: https://dadosabertos.tse.jus.br/dataset/resultados-<ANO> — recurso
// "<UF> - Votação por seção eleitoral" (cobre Governador, Senador, Deputado
// Federal e Deputado Estadual; nos arquivos "BR" fica só a totalização de
// Presidente). Mesma lógica de streaming/descompactação em memória da
// import-electoral-data (ver comentário lá pro motivo).
//
// ATENÇÃO — a URL abaixo segue o padrão histórico do CDN do TSE
// (cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/...), mas o arquivo
// de uma eleição só existe depois da apuração. Confirme a URL exata na
// página do recurso em dadosabertos.tse.jus.br assim que estiver disponível
// e ajuste ELECTION_ZIP_URL_TEMPLATE abaixo se for diferente.
//
// Diferente da import-electoral-data, NÃO é idempotente-com-guarda: roda de
// novo a cada disparo do cron (ver scheduled_jobs.sql) e faz upsert — na
// noite da eleição os números mudam a cada nova rodada de totalização, então
// "já importei antes, pular" não serve aqui. Se nenhuma organização tiver
// election_year/election_cargo/election_candidate_number preenchidos, a
// function não baixa nada (sai cedo).
//
// Não guarda turno como configuração fixa por organização: o arquivo do TSE
// já traz NR_TURNO por linha, então gravamos o turno que vier no dado.
//
// verify_jwt=false — mesma justificativa da import-electoral-data (sem dado
// sensível de cliente na chamada em si, só dispara o processamento; o dado
// sensível nunca sai da function, que já roda com service_role).

import { createClient } from "npm:@supabase/supabase-js@2"

function zipUrlFor(uf: string, ano: number): string {
  return `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_${ano}_${uf}.zip`
}

const TARGET_UF = "PE"
const BATCH_SIZE = 1000

// Mapa do enum organizations.election_cargo (usado no formulário de
// /configuracoes/eleicao) pro texto exato como aparece em DS_CARGO no
// arquivo do TSE (sempre maiúsculo, sem acento no caso de "eleição").
const CARGO_TSE_LABEL: Record<string, string> = {
  prefeito: "PREFEITO",
  vice_prefeito: "VICE-PREFEITO",
  vereador: "VEREADOR",
  governador: "GOVERNADOR",
  vice_governador: "VICE-GOVERNADOR",
  senador: "SENADOR",
  deputado_federal: "DEPUTADO FEDERAL",
  deputado_estadual: "DEPUTADO ESTADUAL",
}

type OrgConfig = { id: string; election_year: number; election_cargo: string; election_candidate_number: string }
type ResultRow = { organization_id: string; municipio_codigo: string; zona_numero: number; secao_numero: number; turno: number; votos: number }

function toIntOrNull(s: string): number | null {
  const v = s.trim()
  if (v === "") return null
  const i = parseInt(v, 10)
  return Number.isFinite(i) ? i : null
}

// Parser de linha CSV com delimitador ";" e campos entre aspas duplas (aspas
// duplicadas "" viram uma aspas literal) — mesmo formato usado pela TSE em
// import-electoral-data.
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

// Localiza a entrada .csv dentro do zip (mesmo parser de headers locais da
// import-electoral-data — ver comentário lá para detalhes).
function findCsvEntry(buf: Uint8Array): { dataStart: number; dataLen: number; method: number; name: string } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let pos = 0
  while (pos + 30 <= buf.length) {
    const sig = dv.getUint32(pos, true)
    if (sig !== 0x04034b50) break
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

async function batchUpsert<T extends Record<string, unknown>>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: T[],
  onConflict: string,
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from(table).upsert(batch, { onConflict })
    if (error) throw new Error(`Erro gravando em ${table} (lote ${i}): ${error.message}`)
  }
}

async function runImport() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  async function checkpoint(step: string, detail?: string) {
    console.log(`[import-election-results] ${step} ${detail ?? ""}`)
    await supabase.from("import_debug_log").insert({ step: `election_results:${step}`, detail: detail ?? null })
  }

  await checkpoint("iniciando")
  try {
    // 1) organizações com candidato configurado.
    const { data: orgs, error: orgsError } = await supabase
      .from("organizations")
      .select("id, election_year, election_cargo, election_candidate_number")
      .not("election_year", "is", null)
      .not("election_cargo", "is", null)
      .not("election_candidate_number", "is", null)
    if (orgsError) throw orgsError
    const configuredOrgs = (orgs ?? []) as OrgConfig[]
    if (configuredOrgs.length === 0) {
      await checkpoint("sem_organizacoes_configuradas", "nenhuma organização tem election_year/cargo/candidato preenchidos")
      return
    }
    await checkpoint("organizacoes_configuradas", `${configuredOrgs.length}`)

    // Chave "cargo|numero" -> lista de organization_id (permite, em tese,
    // mais de um cliente com o mesmo par cargo+número, embora o normal seja 1).
    const orgByKey = new Map<string, string[]>()
    const years = new Set<number>()
    for (const org of configuredOrgs) {
      const cargoLabel = CARGO_TSE_LABEL[org.election_cargo]
      if (!cargoLabel) continue
      const key = `${cargoLabel}|${org.election_candidate_number.trim()}`
      orgByKey.set(key, [...(orgByKey.get(key) ?? []), org.id])
      years.add(org.election_year)
    }

    // 2) mapa de seções já importadas (electoral_sections) pra resolver
    // (municipio_codigo, zona, seção) -> section_id.
    const { data: sectionsData, error: sectionsError } = await supabase
      .from("electoral_sections")
      .select("id, municipio_codigo, zona_numero, secao_numero")
    if (sectionsError) throw sectionsError
    const sectionIdMap = new Map<string, string>()
    for (const s of sectionsData ?? []) {
      sectionIdMap.set(`${s.municipio_codigo}|${s.zona_numero}|${s.secao_numero}`, s.id as string)
    }
    await checkpoint("secoes_carregadas", `${sectionIdMap.size}`)

    // 3) um download por ano de eleição (normalmente só um ano em uso por vez).
    for (const ano of years) {
      const zipUrl = zipUrlFor(TARGET_UF, ano)
      await checkpoint("baixando_zip", zipUrl)
      const zipResp = await fetch(zipUrl)
      if (!zipResp.ok) {
        await checkpoint("zip_indisponivel", `HTTP ${zipResp.status} — resultado ainda não publicado para ${ano}?`)
        continue
      }
      const zipBuf = new Uint8Array(await zipResp.arrayBuffer())
      await checkpoint("zip_baixado", `${zipBuf.length} bytes`)

      const entry = findCsvEntry(zipBuf)
      const compressedSlice = zipBuf.subarray(entry.dataStart, entry.dataStart + entry.dataLen)

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

      // Soma votos por (org, municipio, zona, secao, turno) — o resultado
      // pode ter mais de uma linha pro mesmo candidato/seção em casos raros
      // (ex.: reprocessamento), por isso soma em vez de sobrescrever.
      const totals = new Map<string, ResultRow>()
      let header: string[] | null = null
      let idx: Record<string, number> = {}
      let totalLines = 0
      let matchedLines = 0
      let leftover = ""

      function processLine(rawLine: string) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine
        if (!line) return
        const f = parseCsvLine(line)
        if (!header) {
          header = f.map((h) => h.trim().toUpperCase())
          idx = Object.fromEntries(header.map((h, i) => [h, i]))
          return
        }
        totalLines++
        if (f[idx["SG_UF"]]?.trim() !== TARGET_UF) return

        const cargo = f[idx["DS_CARGO"]]?.trim().toUpperCase()
        const numero = f[idx["NR_VOTAVEL"]]?.trim()
        const key = `${cargo}|${numero}`
        const orgIds = orgByKey.get(key)
        if (!orgIds || orgIds.length === 0) return

        const cdMun = f[idx["CD_MUNICIPIO"]]?.trim()
        const zona = toIntOrNull(f[idx["NR_ZONA"]])
        const secao = toIntOrNull(f[idx["NR_SECAO"]])
        const turno = toIntOrNull(f[idx["NR_TURNO"]])
        const votos = toIntOrNull(f[idx["QT_VOTOS"]]) ?? 0
        if (zona == null || secao == null || turno == null) return

        matchedLines++
        for (const orgId of orgIds) {
          const rowKey = `${orgId}|${cdMun}|${zona}|${secao}|${turno}`
          const current = totals.get(rowKey) ?? {
            organization_id: orgId, municipio_codigo: cdMun, zona_numero: zona, secao_numero: secao, turno, votos: 0,
          }
          current.votos += votos
          totals.set(rowKey, current)
        }
      }

      let chunkCount = 0
      while (true) {
        const { value, done } = await reader.read()
        if (value) {
          chunkCount++
          if (leftover.length > 5_000_000) {
            throw new Error(`leftover cresceu demais (${leftover.length} chars) — provável corrupção no stream`)
          }
          const text = leftover + decoder.decode(value, { stream: true })
          const lines = text.split("\n")
          leftover = lines.pop() ?? ""
          for (const l of lines) processLine(l)
          if (chunkCount % 50 === 0) {
            await checkpoint("progresso", `ano=${ano} chunk=${chunkCount} linhas=${totalLines} casadas=${matchedLines}`)
          }
        }
        if (done) {
          if (leftover) processLine(leftover)
          break
        }
      }
      await checkpoint("parse_concluido", `ano=${ano} linhas=${totalLines} casadas=${matchedLines} grupos=${totals.size}`)

      // 4) resolve section_id e grava.
      const rowsToUpsert: Record<string, unknown>[] = []
      let semSecaoCorrespondente = 0
      for (const row of totals.values()) {
        const sectionId = sectionIdMap.get(`${row.municipio_codigo}|${row.zona_numero}|${row.secao_numero}`)
        if (!sectionId) { semSecaoCorrespondente++; continue }
        rowsToUpsert.push({
          organization_id: row.organization_id,
          section_id: sectionId,
          turno: row.turno,
          votos: row.votos,
          imported_at: new Date().toISOString(),
        })
      }
      if (semSecaoCorrespondente > 0) {
        await checkpoint("secoes_sem_correspondencia", `${semSecaoCorrespondente} — provável desatualização de electoral_sections, rode import-electoral-data de novo`)
      }

      await batchUpsert(supabase, "election_results_sections", rowsToUpsert, "organization_id,section_id,turno")
      await checkpoint("resultado_gravado", `ano=${ano} linhas_gravadas=${rowsToUpsert.length}`)
    }

    await checkpoint("concluido")
  } catch (err) {
    await checkpoint("erro", `${(err as Error).message}\n${(err as Error).stack}`)
  }
}

Deno.serve((_req) => {
  // @ts-ignore — EdgeRuntime é global no runtime do Supabase, não no typecheck local
  EdgeRuntime.waitUntil(runImport())
  return jsonResponse({ ok: true, started: true, note: "rodando em background — acompanhe via get_logs (service edge-function) ou tabela import_debug_log" })
})
