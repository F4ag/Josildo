export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getPessoasAtendidasReport } from "@/services/reports"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { PessoasAtendidasReportDocument } from "@/lib/pdf/pessoas-atendidas-report-document"

export async function GET() {
  const session = await getSessionUser()
  if (!session || !can(session.profile.role as UserRole, "generate_reports")) {
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  const supabase = await createClient()
  const rows = await getPessoasAtendidasReport(supabase)
  const buffer = await renderToBuffer(<PessoasAtendidasReportDocument rows={rows} generatedAt={new Date()} />)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="pessoas-atendidas.pdf"',
    },
  })
}
