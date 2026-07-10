"use client"

// Mapa territorial (Módulo 8). Componente "pesado" de verdade — só é
// importado via src/components/map/territory-map-loader.tsx com
// next/dynamic({ ssr: false }), porque o Leaflet manipula `window`/`document`
// direto e quebra em SSR. Nunca importar este arquivo direto de um Server
// Component.

import { useEffect, useMemo } from "react"
import Link from "next/link"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { LEADER_STATUS_COLOR, LEADER_STATUS_LABELS, DEMAND_STATUS_COLOR, DEMAND_STATUS_LABELS } from "@/types/domain"
import { STATUS_COLOR_HEX, SUPPORTER_PIN_COLOR } from "@/lib/map-colors"
import type { MapLeaderPin, MapDemandPin, MapSupporterPin } from "@/services/map"

// Centro/zoom usados só quando não há nenhum pin para calcular bounds (ex.:
// projeto recém-criado, sem lat/lng cadastrado ainda). Cada campanha deve
// ajustar para o município dela via NEXT_PUBLIC_MAP_DEFAULT_LAT/LNG/ZOOM
// (ver .env.example) — o fallback abaixo é só um centro genérico do Brasil.
// Next.js expõe NEXT_PUBLIC_* como string mesmo quando a variável está
// declarada vazia no .env (não como `undefined`) — por isso o `!value` aqui,
// em vez de `??`, senão uma env var em branco viraria Number("") === 0 e
// jogaria o mapa em "Null Island" (0, 0) por engano.
function envNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const FALLBACK_CENTER: [number, number] = [
  envNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT, -15.7801),
  envNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG, -47.9292),
]
const FALLBACK_ZOOM = envNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, 12)

function createDotIcon(hexColor: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${hexColor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  })
}

// Apoiadores tendem a ser em bem maior número que lideranças/demandas — um
// pin menor evita que o mapa vire uma poça só da cor deles quando a rede
// crescer, mas ainda dá pra ver a concentração/tamanho do grupo por região.
const SUPPORTER_ICON = L.divIcon({
  className: "",
  html: `<span style="display:block;width:10px;height:10px;border-radius:9999px;background:${SUPPORTER_PIN_COLOR};border:1.5px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.4);opacity:0.85;"></span>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  popupAnchor: [0, -5],
})

/** Ajusta o zoom/centro do mapa para enquadrar todos os pins ao montar. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      // TypeScript não estreita points[0] pra "definido" só por causa do
      // if acima (limitação conhecida do checker com índice de array) — o
      // "!" é seguro aqui porque acabamos de confirmar length === 1.
      map.setView(points[0]!, 15)
      return
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] })
  }, [map, points])

  return null
}

// Quando a geocodificação não acha o endereço exato (ver lib/geocoding.ts),
// o fallback usa o CEP ou o centro do bairro — então é normal duas pessoas
// diferentes do mesmo bairro caírem exatamente na mesma coordenada. Sem
// tratar isso, o Leaflet desenha um pin exatamente em cima do outro e só o
// último renderizado fica clicável, escondendo os demais (foi o que
// aconteceu com dois apoiadores do mesmo bairro). Aqui a gente agrupa pins
// que caem na mesma coordenada (arredondada a ~1m de precisão) e espalha
// cada grupo num pequeno círculo ao redor do ponto original, só o
// suficiente pra cada um ficar visível e clicável — não muda a posição
// "oficial" salva no banco, é só um ajuste de exibição.
function spreadOverlappingPoints<T extends { id: string; latitude: number; longitude: number }>(
  items: T[],
): Map<string, [number, number]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  const result = new Map<string, [number, number]>()
  const RADIUS = 0.00035 // ~35m — separa visualmente sem afastar demais no zoom normal
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0]!
      result.set(only.id, [only.latitude, only.longitude])
      continue
    }
    group.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / group.length
      result.set(item.id, [
        item.latitude + RADIUS * Math.cos(angle),
        item.longitude + RADIUS * Math.sin(angle),
      ])
    })
  }
  return result
}

type TerritoryMapProps = {
  leaders: MapLeaderPin[]
  demands: MapDemandPin[]
  supporters: MapSupporterPin[]
}

export function TerritoryMap({ leaders, demands, supporters }: TerritoryMapProps) {
  // Só apoiadores costumam se acumular em massa no mesmo bairro/CEP — por
  // isso o espalhamento é aplicado neles. Lideranças e demandas tendem a ter
  // endereço próprio mais preciso e em volume bem menor.
  const supporterPositions = useMemo(() => spreadOverlappingPoints(supporters), [supporters])

  const allPoints = useMemo<[number, number][]>(
    () => [
      ...leaders.map((l): [number, number] => [l.latitude, l.longitude]),
      ...demands.map((d): [number, number] => [d.latitude, d.longitude]),
      ...supporters.map((s): [number, number] => supporterPositions.get(s.id) ?? [s.latitude, s.longitude]),
    ],
    [leaders, demands, supporters, supporterPositions],
  )

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={FALLBACK_ZOOM}
      scrollWheelZoom
      className="h-[calc(100vh-14rem)] min-h-[420px] w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={allPoints} />

      {leaders.map((leader) => (
        <Marker
          key={`leader-${leader.id}`}
          position={[leader.latitude, leader.longitude]}
          icon={createDotIcon(STATUS_COLOR_HEX[LEADER_STATUS_COLOR[leader.status]])}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{leader.name}</p>
              <p className="text-foreground/60">
                Liderança · {LEADER_STATUS_LABELS[leader.status]}
                {leader.neighborhood ? ` · ${leader.neighborhood}` : ""}
              </p>
              <Link href={`/liderancas/${leader.id}`} className="text-primary hover:underline">
                Abrir cadastro
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}

      {demands.map((demand) => (
        <Marker
          key={`demand-${demand.id}`}
          position={[demand.latitude, demand.longitude]}
          icon={createDotIcon(STATUS_COLOR_HEX[DEMAND_STATUS_COLOR[demand.status]])}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{demand.title}</p>
              <p className="text-foreground/60">
                Demanda · {DEMAND_STATUS_LABELS[demand.status]}
                {demand.neighborhood ? ` · ${demand.neighborhood}` : ""}
              </p>
              <Link href={`/demandas/${demand.id}`} className="text-primary hover:underline">
                Abrir cadastro
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}

      {supporters.map((supporter) => (
        <Marker
          key={`supporter-${supporter.id}`}
          position={supporterPositions.get(supporter.id) ?? [supporter.latitude, supporter.longitude]}
          icon={SUPPORTER_ICON}
        >
          <Popup>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{supporter.name}</p>
              <p className="text-foreground/60">
                Apoiador{supporter.neighborhood ? ` · ${supporter.neighborhood}` : ""}
              </p>
              <Link href={`/apoiadores/${supporter.id}`} className="text-primary hover:underline">
                Abrir cadastro
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
