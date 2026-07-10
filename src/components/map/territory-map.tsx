"use client"

// Mapa territorial (Módulo 8). Componente "pesado" de verdade — só é
// importado via src/components/map/territory-map-loader.tsx com
// next/dynamic({ ssr: false }), porque o Leaflet manipula `window`/`document`
// direto e quebra em SSR. Nunca importar este arquivo direto de um Server
// Component.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet"
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

/** Ícone redondo com o número de apoiadores agrupados naquele ponto da tela
 * (ver useSupporterClusters abaixo). Cresce um pouco conforme o número fica
 * maior, pra não virar um "1" minúsculo dentro de um círculo grande quando
 * o grupo é de 30+ pessoas. */
function createClusterIcon(count: number) {
  const size = count < 10 ? 26 : count < 100 ? 32 : 38
  const fontSize = count < 100 ? 12 : 10
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${SUPPORTER_PIN_COLOR};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);color:white;font-weight:700;font-size:${fontSize}px;font-family:inherit;line-height:1;">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
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

type SupporterCluster = {
  key: string
  latitude: number
  longitude: number
  items: MapSupporterPin[]
}

// Raio de agrupamento em PIXELS da tela, não em graus/metros de coordenada.
// Tentativa anterior (fix27) espalhava pins em ~35m fixos — funciona quando
// o mapa está bem próximo, mas em qualquer zoom mais aberto (cidade/região)
// 35m vira menos de 1 pixel na tela e os pins voltam a ficar exatamente em
// cima um do outro (foi o que aconteceu: geocodificação por bairro faz
// várias pessoas caírem no mesmíssimo ponto — ver lib/geocoding.ts — e
// nesse caso nem existe "zoom suficiente" pra separar de verdade, porque as
// coordenadas são IDÊNTICAS, não só próximas).
//
// Por isso o agrupamento aqui é recalculado a cada zoom/arrasto do Leaflet
// (useMapEvents abaixo), convertendo cada apoiador pra posição em pixel na
// tela (map.latLngToContainerPoint) e juntando quem está a menos de
// CLUSTER_PIXEL_RADIUS px de distância num "balão" só, com o número de
// pessoas ali dentro. Clicar no balão mostra a lista com link pro cadastro
// de cada um — não tem "zoom pra separar" porque, sendo o mesmo ponto
// geográfico, não existe zoom que realmente os afaste.
const CLUSTER_PIXEL_RADIUS = 28

function useSupporterClusters(supporters: MapSupporterPin[]): SupporterCluster[] {
  const map = useMap()
  const [clusters, setClusters] = useState<SupporterCluster[]>([])

  const recompute = useCallback(() => {
    if (supporters.length === 0) {
      setClusters([])
      return
    }

    const projected = supporters.map((s) => ({
      supporter: s,
      point: map.latLngToContainerPoint([s.latitude, s.longitude]),
    }))

    const used = new Array(projected.length).fill(false)
    const result: SupporterCluster[] = []

    for (let i = 0; i < projected.length; i++) {
      if (used[i]) continue
      const group = [projected[i]!]
      used[i] = true

      for (let j = i + 1; j < projected.length; j++) {
        if (used[j]) continue
        const dx = projected[i]!.point.x - projected[j]!.point.x
        const dy = projected[i]!.point.y - projected[j]!.point.y
        if (Math.sqrt(dx * dx + dy * dy) <= CLUSTER_PIXEL_RADIUS) {
          group.push(projected[j]!)
          used[j] = true
        }
      }

      const avgLat = group.reduce((sum, g) => sum + g.supporter.latitude, 0) / group.length
      const avgLng = group.reduce((sum, g) => sum + g.supporter.longitude, 0) / group.length
      result.push({
        key: group.map((g) => g.supporter.id).join("-"),
        latitude: avgLat,
        longitude: avgLng,
        items: group.map((g) => g.supporter),
      })
    }

    setClusters(result)
  }, [map, supporters])

  useEffect(() => {
    recompute()
  }, [recompute])

  useMapEvents({
    zoomend: recompute,
    moveend: recompute,
  })

  return clusters
}

function SupporterMarkers({ supporters }: { supporters: MapSupporterPin[] }) {
  const clusters = useSupporterClusters(supporters)

  return (
    <>
      {clusters.map((cluster) =>
        cluster.items.length === 1 ? (
          <Marker
            key={cluster.key}
            position={[cluster.latitude, cluster.longitude]}
            icon={SUPPORTER_ICON}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{cluster.items[0]!.name}</p>
                <p className="text-foreground/60">
                  Apoiador{cluster.items[0]!.neighborhood ? ` · ${cluster.items[0]!.neighborhood}` : ""}
                </p>
                <Link href={`/apoiadores/${cluster.items[0]!.id}`} className="text-primary hover:underline">
                  Abrir cadastro
                </Link>
              </div>
            </Popup>
          </Marker>
        ) : (
          <Marker
            key={cluster.key}
            position={[cluster.latitude, cluster.longitude]}
            icon={createClusterIcon(cluster.items.length)}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{cluster.items.length} apoiadores nesta região</p>
                <ul className="space-y-1">
                  {cluster.items.map((s) => (
                    <li key={s.id}>
                      <Link href={`/apoiadores/${s.id}`} className="text-primary hover:underline">
                        {s.name}
                      </Link>
                      {s.neighborhood ? <span className="text-foreground/60"> · {s.neighborhood}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </Popup>
          </Marker>
        ),
      )}
    </>
  )
}

type TerritoryMapProps = {
  leaders: MapLeaderPin[]
  demands: MapDemandPin[]
  supporters: MapSupporterPin[]
}

export function TerritoryMap({ leaders, demands, supporters }: TerritoryMapProps) {
  const allPoints = useMemo<[number, number][]>(
    () => [
      ...leaders.map((l): [number, number] => [l.latitude, l.longitude]),
      ...demands.map((d): [number, number] => [d.latitude, d.longitude]),
      ...supporters.map((s): [number, number] => [s.latitude, s.longitude]),
    ],
    [leaders, demands, supporters],
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

      <SupporterMarkers supporters={supporters} />
    </MapContainer>
  )
}
