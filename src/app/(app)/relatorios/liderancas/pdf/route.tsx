// @react-pdf/renderer usa Buffer/streams do Node — não roda em Edge Runtime.
export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLeadersByNeighborhoodReport } from "@/services/reports"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { LeadersReportDocument } from "@/lib/pdf/leaders-report-document"

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  // O middleware já bloqueia /relatorios para quem não é admin_geral/admin_equipe;
  // esta é a defesa em profundidade de sempre.
  if (!session || !can(session.profile.role as UserRole, "generate_reports")) {
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  const city = request.nextUrl.searchParams.get("cidade") ?? undefined

  const supabase = await createClient()
  const rows = await getLeadersByNeighborhoodReport(supabase, { city })
  const buffer = await renderToBuffer(<LeadersReportDocument rows={rows} generatedAt={new Date()} />)

  // NextResponse espera BodyInit (Uint8Array, Blob, string, etc.) — o Buffer
  // do Node não bate estruturalmente com esse tipo no TypeScript (mesmo
  // funcionando em runtime, por Buffer estender Uint8Array), então convertê-lo
  // explicitamente evita o erro de build "não pode ser atribuído a BodyInit".
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="liderancas-por-bairro.pdf"',
    },
  })
}
