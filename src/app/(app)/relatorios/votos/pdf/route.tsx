// @react-pdf/renderer usa Buffer/streams do Node — não roda em Edge Runtime.
export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getVotesSummary, getVotesByCity, getVotesByNeighborhood, getVotesByPollingLocation } from "@/services/reports"
import type { UserRole } from "@/types/domain"
import { VotesReportDocument } from "@/lib/pdf/votes-report-document"

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  // Além do middleware (que já restringe /relatorios a admin_geral/
  // admin_equipe), este relatório é mais restrito ainda: só admin_geral,
  // porque cruza admin_estimated_votes — campo que nem admin_equipe deveria
  // ver (ver comentário em liderancas/actions.ts e services/reports.ts).
  if (!session || (session.profile.role as UserRole) !== "admin_geral") {
    return NextResponse.json({ error: "Sem permissão para gerar este relatório." }, { status: 403 })
  }

  const city = request.nextUrl.searchParams.get("cidade") ?? undefined
  const neighborhood = request.nextUrl.searchParams.get("bairro") ?? undefined

  const supabase = await createClient()
  const [summary, byCity, byNeighborhood, votesByPollingLocation] = await Promise.all([
    getVotesSummary(supabase),
    getVotesByCity(supabase, { city }),
    getVotesByNeighborhood(supabase, { city, neighborhood }),
    getVotesByPollingLocation(supabase, { city, neighborhood }),
  ])
  const buffer = await renderToBuffer(
    <VotesReportDocument
      summary={summary}
      byCity={byCity}
      byNeighborhood={byNeighborhood}
      byPollingLocation={votesByPollingLocation.rows}
      leadersWithoutLocation={votesByPollingLocation.leadersWithoutLocation}
      generatedAt={new Date()}
    />,
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="expectativa-de-votos.pdf"',
    },
  })
}
