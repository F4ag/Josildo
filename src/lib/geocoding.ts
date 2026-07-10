// Geocodificação automática de endereço -> latitude/longitude, usada pelas
// actions de Lideranças e Demandas (Módulo 8, Mapa Territorial) sempre que
// quem preenche o formulário não digitou as coordenadas manualmente.
//
// Usa o Nominatim (serviço de busca do OpenStreetMap, gratuito, mesmo
// provedor dos tiles do mapa em components/map/territory-map.tsx) — não
// precisa de chave de API nem de cadastro. Em troca, a política de uso
// exige no máximo 1 requisição por segundo e um identificador do app no
// cabeçalho (nunca em "system-to-system" em massa sem cache); como aqui é
// só 1 chamada por cadastro/edição feito por uma pessoa, está dentro do uso
// aceitável: https://operations.osmfoundation.org/policies/nominatim/
//
// Falha na geocodificação NUNCA deve bloquear o cadastro — se o endereço
// não for encontrado (rua nova, digitação estranha, etc.), a liderança ou
// demanda é salva do mesmo jeito, só sem aparecer no mapa até alguém
// preencher as coordenadas manualmente.

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
    const found = await tryNominatim(query)
    if (found) return found
  }

  return null
}
