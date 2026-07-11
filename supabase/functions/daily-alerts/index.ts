// Edge Function: daily-alerts (Módulo 10 do prompt master)
//
// Roda uma vez por dia (ver agendamento em docs/03-agendamento-edge-function.md)
// e faz 4 coisas, cada uma independente das outras:
//   1. Marca como "atrasada" toda demanda com due_date < hoje que ainda não
//      foi resolvida/cancelada/recusada — e notifica.
//   2. Notifica demandas e atendimentos vencendo HOJE (sem mudar status).
//   3. Notifica atendimentos atrasados (o enum de attendances não tem
//      "atrasado" como status, então aqui é só notificação).
//   4. Notifica aniversariantes de hoje (1 notificação agregada por
//      organização, não 1 por pessoa).
//
// Idempotente: rodar duas vezes no mesmo dia não duplica notificação (checa
// se já existe uma notificação do mesmo tipo/registro criada hoje antes de
// inserir). Isso é o que permite testar rodando manualmente sem medo de
// sujar a tabela.
//
// MULTI-TENANT (docs/07-migracao-multi-tenant.md): esta função usa a
// service_role key, então NÃO passa pela RLS — ela enxerga todas as
// organizações de uma vez, de propósito (precisa checar prazo vencido em
// TODOS os clientes numa única execução agendada). Por isso é essencial
// agrupar manualmente por organization_id em cada etapa: uma notificação
// sobre um atraso da organização A nunca pode ser inserida pro staff da
// organização B — senão um cliente veria dado de outro cliente na própria
// tela de notificações. Antes desta migração, "notifyStaff" mandava pra
// TODO admin_geral/admin_equipe do banco inteiro, sem filtro nenhum.

import { createClient } from "npm:@supabase/supabase-js@2"

const CLOSED_DEMAND_STATUSES = ["resolvida", "cancelada", "recusada", "atrasada"]
const OPEN_ATTENDANCE_STATUSES = ["novo", "em_analise", "em_andamento", "aguardando_documento", "aguardando_orgao_publico"]

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const today = new Date().toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00`

  const { data: staffUsers, error: staffError } = await supabase
    .from("users_profiles")
    .select("id, organization_id")
    .in("role", ["admin_geral", "admin_equipe"])
    .eq("status", "ativo")
  if (staffError) throw staffError

  const staffByOrg = new Map<string, string[]>()
  for (const u of staffUsers) {
    const list = staffByOrg.get(u.organization_id) ?? []
    list.push(u.id)
    staffByOrg.set(u.organization_id, list)
  }

  const summary = {
    staff_users_found: staffUsers.length,
    organizations_with_staff: staffByOrg.size,
    demands_marked_overdue: 0,
    demand_due_today_notifications: 0,
    demand_overdue_notifications: 0,
    attendance_due_today_notifications: 0,
    attendance_overdue_notifications: 0,
    birthday_notifications_created: 0,
  }

  async function alreadyNotifiedToday(organizationId: string, notificationType: string, relatedId: string | null) {
    let query = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("notification_type", notificationType)
      .gte("created_at", todayStart)
    query = relatedId ? query.eq("related_id", relatedId) : query.is("related_id", null)
    const { count } = await query
    return (count ?? 0) > 0
  }

  // Retorna true só quando realmente inseriu notificação — importante para o
  // "summary" não mentir dizendo que notificou quando não existe nenhum
  // admin_geral/admin_equipe ativo NAQUELA organização pra receber.
  async function notifyStaff(
    organizationId: string,
    title: string, message: string, notificationType: string, relatedTable: string, relatedId: string | null,
  ): Promise<boolean> {
    const staffIds = staffByOrg.get(organizationId) ?? []
    if (staffIds.length === 0) return false
    const rows = staffIds.map((userId) => ({
      user_id: userId, organization_id: organizationId, title, message,
      notification_type: notificationType, related_table: relatedTable, related_id: relatedId,
    }))
    const { error } = await supabase.from("notifications").insert(rows)
    if (error) throw error
    return true
  }

  // 1) Demandas atrasadas — muda status e notifica (todas as organizações
  // de uma vez; cada linha carrega o próprio organization_id).
  const { data: overdueDemands, error: overdueDemandsError } = await supabase
    .from("demands")
    .select("id, title, due_date, organization_id")
    .lt("due_date", today)
    .not("status", "in", `(${CLOSED_DEMAND_STATUSES.join(",")})`)
  if (overdueDemandsError) throw overdueDemandsError

  for (const demand of overdueDemands) {
    await supabase.from("demands").update({ status: "atrasada" }).eq("id", demand.id)
    await supabase.from("demand_updates").insert({
      demand_id: demand.id, status: "atrasada", organization_id: demand.organization_id,
      comment: "Marcada automaticamente como atrasada (prazo vencido).",
    })
    summary.demands_marked_overdue++

    if (!(await alreadyNotifiedToday(demand.organization_id, "demanda_atrasada", demand.id))) {
      const notified = await notifyStaff(
        demand.organization_id,
        "Demanda atrasada",
        `"${demand.title}" venceu em ${demand.due_date} e ainda não foi resolvida.`,
        "demanda_atrasada", "demands", demand.id,
      )
      if (notified) summary.demand_overdue_notifications++
    }
  }

  // 2) Demandas vencendo hoje (ainda não fechadas, prazo == hoje)
  const { data: dueTodayDemands, error: dueTodayError } = await supabase
    .from("demands")
    .select("id, title, organization_id")
    .eq("due_date", today)
    .not("status", "in", `(${CLOSED_DEMAND_STATUSES.join(",")})`)
  if (dueTodayError) throw dueTodayError

  for (const demand of dueTodayDemands) {
    if (!(await alreadyNotifiedToday(demand.organization_id, "demanda_vencendo", demand.id))) {
      const notified = await notifyStaff(
        demand.organization_id, "Demanda vence hoje", `"${demand.title}" vence hoje.`, "demanda_vencendo", "demands", demand.id,
      )
      if (notified) summary.demand_due_today_notifications++
    }
  }

  // 3) Atendimentos atrasados / vencendo hoje (só notifica — schema não tem status "atrasado" pra attendance)
  const { data: openAttendances, error: attendancesError } = await supabase
    .from("attendances")
    .select("id, title, due_date, organization_id")
    .in("status", OPEN_ATTENDANCE_STATUSES)
    .not("due_date", "is", null)
  if (attendancesError) throw attendancesError

  for (const attendance of openAttendances) {
    if (!attendance.due_date) continue
    if (attendance.due_date < today) {
      if (!(await alreadyNotifiedToday(attendance.organization_id, "atendimento_atrasado", attendance.id))) {
        const notified = await notifyStaff(
          attendance.organization_id,
          "Atendimento atrasado",
          `"${attendance.title}" venceu em ${attendance.due_date} e segue em aberto.`,
          "atendimento_atrasado", "attendances", attendance.id,
        )
        if (notified) summary.attendance_overdue_notifications++
      }
    } else if (attendance.due_date === today) {
      if (!(await alreadyNotifiedToday(attendance.organization_id, "atendimento_vencendo", attendance.id))) {
        const notified = await notifyStaff(
          attendance.organization_id, "Atendimento vence hoje", `"${attendance.title}" vence hoje.`, "atendimento_vencendo", "attendances", attendance.id,
        )
        if (notified) summary.attendance_due_today_notifications++
      }
    }
  }

  // 4) Aniversariantes de hoje — 1 notificação agregada POR ORGANIZAÇÃO (evita spam e evita vazamento entre clientes)
  const { data: supporters, error: supportersError } = await supabase
    .from("supporters")
    .select("id, name, birth_date, organization_id")
  if (supportersError) throw supportersError

  const todayDate = new Date(`${today}T00:00:00`)
  const birthdaysByOrg = new Map<string, string[]>()
  for (const s of supporters) {
    const birth = new Date(`${s.birth_date}T00:00:00`)
    if (birth.getMonth() === todayDate.getMonth() && birth.getDate() === todayDate.getDate()) {
      const list = birthdaysByOrg.get(s.organization_id) ?? []
      list.push(s.name)
      birthdaysByOrg.set(s.organization_id, list)
    }
  }

  for (const [organizationId, names] of birthdaysByOrg) {
    if (!(await alreadyNotifiedToday(organizationId, "aniversario", null))) {
      const notified = await notifyStaff(
        organizationId,
        "Aniversariantes hoje",
        `${names.length} pessoa(s) fazem aniversário hoje: ${names.slice(0, 5).join(", ")}${names.length > 5 ? "..." : ""}.`,
        "aniversario", "supporters", null,
      )
      if (notified) summary.birthday_notifications_created++
    }
  }

  return new Response(JSON.stringify({ ok: true, date: today, summary }), {
    headers: { "Content-Type": "application/json" },
  })
})
