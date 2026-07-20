// @react-pdf/renderer usa Buffer/streams do Node — não roda em Edge Runtime.
export const runtime = "nodejs"

import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getLeaderById } from "@/services/leaders"
import { getSupporterById } from "@/services/supporters"
import { getPollingLocationById, formatPollingLocationLabel } from "@/services/polling-locations"
import { buildLeaderFicha, buildSupporterFicha } from "@/lib/ficha-individual"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { IndividualRecordDocument } from "@/lib/pdf/individual-record-document"

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (marcas de combinacao, apos NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser()
  // O middleware já bloqueia /relatorios para quem não é admin_geral/admin_equipe;
  // esta é a defesa em profundidade de sempre (mesmo padrão dos outros relatórios).
  if (!session || !can(session.profile.role as UserRole, "generate_reports")) {
    return NextResponse.json({ error: "Sem permissão para gerar relatórios." }, { status: 403 })
  }

  const tipo = request.nextUrl.searchParams.get("tipo") === "apoiador" ? "apoiador" : "lideranca"
  const id = request.nextUrl.searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Informe o id do cadastro." }, { status: 400 })
  }

  const role = session.profile.role as UserRole
  const supabase = await createClient()

  if (tipo === "lideranca") {
    const leader = await getLeaderById(supabase, id)
    if (!leader) return NextResponse.json({ error: "Liderança não encontrada." }, { status: 404 })

    const [pollingLocation, parentLeader] = await Promise.all([
      leader.polling_location_id ? getPollingLocationById(supabase, leader.polling_location_id) : Promise.resolve(null),
      leader.parent_leader_id ? getLeaderById(supabase, leader.parent_leader_id) : Promise.resolve(null),
    ])
    const ficha = buildLeaderFicha(leader, {
      pollingLocationLabel: pollingLocation ? formatPollingLocationLabel(pollingLocation) : null,
      parentLeaderName: parentLeader?.name ?? null,
      role,
    })
    const buffer = await renderToBuffer(<IndividualRecordDocument ficha={ficha} generatedAt={new Date()} />)

    // NextResponse espera BodyInit — o Buffer do Node não bate estruturalmente
    // com esse tipo no TypeScript (mesmo funcionando em runtime), por isso a
    // conversão explícita (mesmo padrão dos outros pdf/route.tsx).
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ficha-lideranca-${slugify(leader.name)}.pdf"`,
      },
    })
  }

  const supporter = await getSupporterById(supabase, id)
  if (!supporter) return NextResponse.json({ error: "Apoiador não encontrado." }, { status: 404 })

  const [pollingLocation, leader] = await Promise.all([
    supporter.polling_location_id ? getPollingLocationById(supabase, supporter.polling_location_id) : Promise.resolve(null),
    supporter.leader_id ? getLeaderById(supabase, supporter.leader_id) : Promise.resolve(null),
  ])
  const ficha = buildSupporterFicha(supporter, {
    pollingLocationLabel: pollingLocation ? formatPollingLocationLabel(pollingLocation) : null,
    leaderName: leader?.name ?? null,
  })
  const buffer = await renderToBuffer(<IndividualRecordDocument ficha={ficha} generatedAt={new Date()} />)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ficha-apoiador-${slugify(supporter.name)}.pdf"`,
    },
  })
}
