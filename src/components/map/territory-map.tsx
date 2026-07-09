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
import { STATUS_COLOR_HEX } from "@/lib/map-colors"
import type { MapLeaderPin, MapDemandPin } from "@/services/map"

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

type TerritoryMapProps = {
  leaders: MapLeaderPin[]
  demands: MapDemandPin[]
}

export function TerritoryMap({ leaders, demands }: TerritoryMapProps) {
  const allPoints = useMemo<[number, number][]>(
    () => [
      ...leaders.map((l): [number, number] => [l.latitude, l.longitude]),
      ...demands.map((d): [number, number] => [d.latitude, d.longitude]),
    ],
    [leaders, demands],
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
    </MapContainer>
  )
}
