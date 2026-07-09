// LEADER_STATUS_COLOR / DEMAND_STATUS_COLOR (src/types/domain.ts) guardam só
// o NOME da cor sugerida pelo prompt master (§8 — "verde", "amarelo" etc.),
// em PT-BR, porque são pensados como rótulo de negócio, não CSS. Este mapa
// traduz esse nome para um hex de verdade, usado nos pins do Leaflet em
// src/components/map/territory-map.tsx. Se a paleta de marca mudar
// (tailwind.config.ts), ajustar aqui também — são valores próximos, mas não
// os mesmos tokens (aqui precisa de mais contraste em cima do mapa-múndi
// claro do OpenStreetMap do que o usado no resto da UI).
//
// Tipado com BadgeTone (não "string" genérico) de propósito: com
// noUncheckedIndexedAccess ligado no tsconfig, indexar um Record<string, X>
// com uma chave string qualquer devolve "X | undefined" (porque a chave
// pode não existir) — e isso já quebrou o build (createDotIcon espera
// "string", não "string | undefined"). Como BadgeTone é a união fechada de
// exatamente as chaves abaixo, indexar com um BadgeTone garante "string".
import type { BadgeTone } from "@/components/ui/badge"

export const STATUS_COLOR_HEX: Record<BadgeTone, string> = {
  verde: "#1E7A46",
  amarelo: "#D4A017",
  vermelho: "#C0392B",
  azul: "#0B2545",
  laranja: "#E07A1F",
  cinza: "#8A8F98",
}
