// @react-pdf/renderer usa Buffer/streams do Node — não roda em Edge Runtime.
export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listLeaders } from "@/services/leaders"
import { listSupporters } from "@/services/supporters"
import { buildMailingLabel } from "@/lib/mailing-label"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { MailingLabelDocument } from "@/lib/pdf/mailing-label-document"

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  // O middleware já bloqueia /relatorios para quem não é admin_geral/admin_equipe;
  // esta é a defesa em profundidade de sempre (mesmo padrão dos outros relatórios).
  if (!session || !can(session.profile.role as UserRole, "generate_reports")) {
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  const tipo = request.nextUrl.searchParams.get("tipo") === "apoiador" ? "apoiador" : "lideranca"
  const city = request.nextUrl.searchParams.get("cidade") ?? undefined
  const neighborhood = request.nextUrl.searchParams.get("bairro") ?? undefined

  const supabase = await createClient()
  const rows =
    tipo === "lideranca"
      ? await listLeaders(supabase, { city, neighborhood })
      : await listSupporters(supabase, { city, neighborhood })

  const labels = rows.map((r) => buildMailingLabel(r))
  const buffer = await renderToBuffer(<MailingLabelDocument labels={labels} />)

  // NextResponse espera BodyInit — o Buffer do Node não bate estruturalmente
  // com esse tipo no TypeScript (mesmo funcionando em runtime), por isso a
  // conversão explícita (mesmo padrão dos outros pdf/route.tsx).
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="etiquetas-${tipo === "lideranca" ? "liderancas" : "apoiadores"}.pdf"`,
    },
  })
}
