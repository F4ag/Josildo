"use client"

// Wrapper fino só para poder usar next/dynamic com { ssr: false } — isso não
// é permitido dentro de um Server Component (src/app/(app)/mapa/page.tsx),
// então isolamos o dynamic() aqui. O componente pesado de verdade
// (react-leaflet) fica em territory-map.tsx.

import dynamic from "next/dynamic"
import type { MapLeaderPin, MapDemandPin, MapSupporterPin } from "@/services/map"

const TerritoryMap = dynamic(
  () => import("./territory-map").then((mod) => mod.TerritoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-14rem)] min-h-[420px] w-full items-center justify-center rounded-lg border border-black/5 bg-white text-sm text-foreground/50">
        Carregando mapa...
      </div>
    ),
  },
)

export function TerritoryMapLoader({
  leaders, demands, supporters,
}: {
  leaders: MapLeaderPin[]; demands: MapDemandPin[]; supporters: MapSupporterPin[]
}) {
  return <TerritoryMap leaders={leaders} demands={demands} supporters={supporters} />
}
