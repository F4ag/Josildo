// Geocodificação automática de endereço -> latitude/longitude, usada pelas
// actions de Lideranças e Demandas (Módulo 8, Mapa Territorial) sempre que
// quem preenche o formulário não digitou as coordenadas manualmente.
//
// Dois provedores, nessa ordem de preferência por consulta:
//
// 1) Google Geocoding API — só entra em jogo se a variável de ambiente
//    GOOGLE_GEOCODING_API_KEY estiver configurada (Vercel > Settings >
//    Environment Variables). Pago (a partir de ~10 mil consultas grátis por
//    mês, depois cobrado por consulta — ver console.cloud.google.com), mas
//    bem mais preciso em endereço com número no Brasil.
// 2) Nominatim (OpenStreetMap) — gratuito, sem chave, usado como fallback
//    automático sempre que o Google não está configurado OU não encontra o
//    endereço. Mesmo provedor dos tiles do mapa em
//    components/map/territory-map.tsx. Política de uso exige no máximo 1
//    requisição por segundo e um identificador do app no cabeçalho (nunca
//    em "system-to-system" em massa sem cache); como aqui é só 1 chamada
//    por cadastro/edição feito por uma pessoa, está dentro do uso aceitável:
//    https://operations.osmfoundation.org/policies/nominatim/
//
// Isso significa que o sistema funciona igual (via Nominatim) para
// qualquer cliente que não configurar a chave do Google — configurar é
// opcional, por cliente, não uma migração obrigatória.
//
// Falha na geocodificação NUNCA deve bloquear o cadastro — se o endereço
// não for encontrado em nenhum dos dois provedores (rua nova, digitação
// estranha, etc.), a liderança ou demanda é salva do mesmo jeito, só sem
// aparecer no mapa até alguém preencher as coordenadas manualmente.

async function tryGoogleGeocoding(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY
  if (!apiKey) return null

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.searchParams.set("address", query)
    url.searchParams.set("region", "br")
    url.searchParams.set("key", apiKey)

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(
        `[geocodeAddress] Google Geocoding respondeu HTTP ${response.status} para query "${query}". Corpo: ${body.slice(0, 300)}`,
      )
      return null
    }

    const data = (await response.json()) as {
      status: string
      error_message?: string
      results: { geometry: { location: { lat: number; lng: number } } }[]
    }

    // Status "ZERO_RESULTS" é esperado (endereço não encontrado) — não é
    // erro. "REQUEST_DENIED"/"OVER_QUERY_LIMIT" indicam chave inválida ou
    // faturamento não ativado no Google Cloud; nesses casos caímos pro
    // Nominatim do mesmo jeito, mas logamos pra facilitar diagnóstico.
    if (data.status !== "OK" || !data.results[0]) {
      console.error(
        `[geocodeAddress] Google Geocoding sem resultado (status "${data.status}"${data.error_message ? `: ${data.error_message}` : ""}) para query "${query}".`,
      )
      return null
    }

    const { lat, lng } = data.results[0].geometry.location
    console.log(`[geocodeAddress] Google encontrou para query "${query}": ${lat}, ${lng}`)
    return { latitude: lat, longitude: lng }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(`[geocodeAddress] Falha ao geocodificar (Google) query "${query}": ${message}`)
    return null
  }
}

async function tryNominatim(query: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("q", query)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")
    url.searchParams.set("countrycodes", "br")

    const response = await fetch(url, {
      headers: {
        // Nominatim exige um identificador de app no User-Agent — sem isso
        // as requisições podem ser bloqueadas.
        "User-Agent": "LideraPlus/1.0 (gestao territorial; contato: af4contato@gmail.com)",
        "Accept-Language": "pt-BR",
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(
        `[geocodeAddress] Nominatim respondeu ${response.status} para query "${query}". Corpo: ${body.slice(0, 300)}`,
      )
      return null
    }

    const results = (await response.json()) as { lat: string; lon: string }[]
    const first = results[0]
    if (!first) {
      console.error(`[geocodeAddress] Nenhum resultado do Nominatim para query "${query}".`)
      return null
    }

    const latitude = Number(first.lat)
    const longitude = Number(first.lon)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      console.error(`[geocodeAddress] Resultado com lat/lon inválidos para query "${query}": ${JSON.stringify(first)}`)
      return null
    }

    console.log(`[geocodeAddress] Encontrado para query "${query}": ${latitude}, ${longitude}`)
    return { latitude, longitude }
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(`[geocodeAddress] Falha ao geocodificar query "${query}": ${message}`)
    return null
  }
}

/** Tira número/complemento de "Rua Tal, 207" -> "Rua Tal". Endereço
 * completo com número exato costuma não estar mapeado no OpenStreetMap em
 * cidades menores — o nome da rua sozinho, combinado com bairro/cidade,
 * geralmente é encontrado. */
function stripHouseNumber(address: string): string {
  return address.split(",")[0]?.trim() ?? address
}

export async function geocodeAddress(parts: {
  address?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}): Promise<{ latitude: number; longitude: number } | null> {
  const address = parts.address?.trim() || undefined
  const neighborhood = parts.neighborhood?.trim() || undefined
  const city = parts.city?.trim() || undefined
  const state = parts.state?.trim() || undefined
  const zipCode = parts.zipCode?.trim() || undefined

  if (!address && !neighborhood && !city && !zipCode) return null

  // Escada de tentativas, da mais específica pra mais genérica — para na
  // primeira que o Nominatim reconhecer:
  // 1) endereço completo com número; 2) CEP sozinho (costuma achar até
  // quando a rua/número não estão mapeados); 3) rua sem número + bairro +
  // cidade; 4) bairro + cidade; 5) só cidade.
  const streetOnly = address ? stripHouseNumber(address) : undefined
  const candidates = [
    [address, neighborhood, city, state, "Brasil"],
    zipCode ? [zipCode, "Brasil"] : null,
    streetOnly && streetOnly !== address ? [streetOnly, neighborhood, city, state, "Brasil"] : null,
    [neighborhood, city, state, "Brasil"],
    [city, state, "Brasil"],
  ]
    .filter((c): c is (string | undefined)[] => c !== null)
    .map((c) => c.filter(Boolean).join(", "))
    // Remove candidatos repetidos e o candidato "Brasil" sozinho (impreciso demais).
    .filter((q, i, arr) => q.length > "Brasil".length && arr.indexOf(q) === i)

  for (const query of candidates) {
    const found = (await tryGoogleGeocoding(query)) ?? (await tryNominatim(query))
    if (found) return found
  }

  return null
}
