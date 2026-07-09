import Link from "next/link"
import type { Metadata } from "next"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  getDashboardSummary, listOverdueDemands, listBirthdaysToday, getSupportersByNeighborhood,
} from "@/services/dashboard"
import { StatCard } from "@/components/dashboard/stat-card"
import { SupportersByNeighborhoodChart } from "@/components/dashboard/supporters-by-neighborhood-chart"
import { WhatsAppButton } from "@/components/whatsapp-button"

export const metadata: Metadata = { title: "Dashboard · Lidera+" }

// Etapa 4 do plano de MVP. Ordem definida em docs/01-arquitetura-tecnica.md §5:
// 1) cards executivos, 2) alertas (o que exige ação hoje), 3) gráfico exploratório.
export default async function DashboardPage() {
  const session = await getSessionUser()
  const supabase = await createClient()

  const [summary, overdueDemands, birthdaysToday, supportersByNeighborhood] = await Promise.all([
    getDashboardSummary(supabase),
    listOverdueDemands(supabase),
    listBirthdaysToday(supabase),
    getSupportersByNeighborhood(supabase),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Olá, {session?.profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-foreground/60">Visão geral do território agora.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Lideranças ativas" value={summary.activeLeaders} href="/liderancas?status=ativa" />
        <StatCard label="Apoiadores" value={summary.totalSupporters} href="/apoiadores" />
        <StatCard label="Pessoas atendidas" value={summary.totalPessoasAtendidas} href="/pessoas-atendidas" />
        <StatCard label="Demandas resolvidas (mês)" value={summary.demandsResolvedThisMonth} href="/demandas?status=resolvida" />
        <StatCard label="Atendimentos pendentes" value={summary.attendancesPending} href="/atendimentos" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Demandas atrasadas</p>
          <ul className="space-y-2">
            {overdueDemands.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <Link href={`/demandas/${d.id}`} className="text-foreground hover:text-primary">
                  {d.title}
                </Link>
                <span className="text-xs text-status-atrasada">
                  venceu em {d.due_date ? new Date(`${d.due_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                </span>
              </li>
            ))}
            {overdueDemands.length === 0 && (
              <p className="text-sm text-foreground/50">Nenhuma demanda atrasada. 🎉</p>
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Aniversariantes de hoje</p>
          <ul className="space-y-2">
            {birthdaysToday.map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{b.name}</span>
                <WhatsAppButton
                  phone={b.phone}
                  message={`Olá, ${b.name}! Passando para desejar um feliz aniversário, com muita saúde, paz e realizações. Que seu novo ciclo seja abençoado. Um grande abraço!`}
                  label="Parabenizar"
                  consentWhatsapp={b.consentWhatsapp}
                />
              </li>
            ))}
            {birthdaysToday.length === 0 && (
              <p className="text-sm text-foreground/50">Ninguém faz aniversário hoje.</p>
            )}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-black/5 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Apoiadores por bairro</p>
        <SupportersByNeighborhoodChart data={supportersByNeighborhood} />
      </div>
    </div>
  )
}
