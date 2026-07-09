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
// preencher as coordenadas manualmente. Todo caminho de falha grava um
// console.error com o motivo (visível em Vercel > Logs) porque, sem isso,
// "não achou o endereço" e "a chamada quebrou" ficam indistinguíveis.
export async function geocodeAddress(parts: {
  address?: string | null
  neighborhood?: string | null
  city?: string | null
  state?: string | null
}): Promise<{ latitude: number; longitude: number } | null> {
  const query = [parts.address, parts.neighborhood, parts.city, parts.state, "Brasil"]
    .filter(Boolean)
    .join(", ")

  // Sem rua/bairro não vale a pena tentar — "Brasil" sozinho devolveria o
  // centro do país, o que é pior do que não ter coordenada nenhuma.
  if (!parts.address && !parts.neighborhood) return null

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

    return { latitude, longitude }
  } catch (err) {
    // Timeout, rede fora do ar, resposta inesperada — trata como "não
    // encontrado" em vez de derrubar o cadastro inteiro, mas grava o motivo.
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error(`[geocodeAddress] Falha ao geocodificar query "${query}": ${message}`)
    return null
  }
}
