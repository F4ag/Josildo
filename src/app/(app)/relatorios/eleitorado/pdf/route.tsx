// @react-pdf/renderer usa Buffer/streams do Node — não roda em Edge Runtime.
export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  getElectorateByCity,
  getElectorateByNeighborhood,
  getElectorateByPollingLocation,
} from "@/services/electorate"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { ElectorateReportDocument } from "@/lib/pdf/electorate-report-document"

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  // O middleware já bloqueia /relatorios para quem não é admin_geral/admin_equipe;
  // esta é a defesa em profundidade de sempre.
  if (!session || !can(session.profile.role as UserRole, "generate_reports")) {
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  const city = request.nextUrl.searchParams.get("cidade") ?? undefined
  const neighborhood = request.nextUrl.searchParams.get("bairro") ?? undefined

  const supabase = await createClient()
  const [byCity, byNeighborhood, byPollingLocation] = await Promise.all([
    getElectorateByCity(supabase, { city }),
    getElectorateByNeighborhood(supabase, { city, bairro: neighborhood }),
    getElectorateByPollingLocation(supabase, { city, bairro: neighborhood }),
  ])
  const buffer = await renderToBuffer(
    <ElectorateReportDocument
      byCity={byCity}
      byNeighborhood={byNeighborhood}
      byPollingLocation={byPollingLocation}
      cityFilter={city}
      neighborhoodFilter={neighborhood}
      generatedAt={new Date()}
    />,
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="eleitorado-tse.pdf"',
    },
  })
}
