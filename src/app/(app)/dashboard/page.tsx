import Link from "next/link"
import type { Metadata } from "next"
import { Users, UserPlus, HeartHandshake, ClipboardCheck, Stethoscope, ArrowRight } from "lucide-react"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  getDashboardSummary, listOverdueDemands, listBirthdaysToday, getDashboardTrends,
  getLeadersByCity, getLeadersByNeighborhood, getSupportersByCity, getSupportersByNeighborhood,
} from "@/services/dashboard"
import { getVotesSummary, getVotesByCity } from "@/services/reports"
import { StatCard } from "@/components/dashboard/stat-card"
import { CategoryBarChart } from "@/components/dashboard/supporters-by-neighborhood-chart"
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart"
import { VotesByCityChart } from "@/components/dashboard/votes-by-city-chart"
import { WhatsAppButton } from "@/components/whatsapp-button"
import type { UserRole } from "@/types/domain"

export const metadata: Metadata = { title: "Dashboard · Lidera+" }

// Etapa 4 do plano de MVP. Ordem definida em docs/01-arquitetura-tecnica.md §5:
// 1) cards executivos, 2) alertas (o que exige ação hoje), 3) gráfico exploratório.
export default async function DashboardPage() {
  const session = await getSessionUser()
  const supabase = await createClient()
  const role = session?.profile.role as UserRole

  const [
    summary, overdueDemands, birthdaysToday, trends,
    leadersByCity, leadersByNeighborhood, supportersByCity, supportersByNeighborhood,
  ] = await Promise.all([
    getDashboardSummary(supabase),
    listOverdueDemands(supabase),
    listBirthdaysToday(supabase),
    getDashboardTrends(supabase),
    getLeadersByCity(supabase),
    getLeadersByNeighborhood(supabase),
    getSupportersByCity(supabase),
    getSupportersByNeighborhood(supabase),
  ])

  // Expectativa de votos: cruza admin_estimated_votes (campo admin-only),
  // então o gráfico só aparece pro admin_geral — mesma restrição do
  // relatório completo em /relatorios/votos.
  const [votesSummary, votesByCity] = role === "admin_geral"
    ? await Promise.all([getVotesSummary(supabase), getVotesByCity(supabase)])
    : [null, null]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Olá, {session?.profile.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-foreground/60">Visão geral do território agora.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Lideranças ativas" value={summary.activeLeaders} href="/liderancas?status=ativa"
          icon={Users} tone="primary" trend={trends.leaders}
        />
        <StatCard
          label="Apoiadores" value={summary.totalSupporters} href="/apoiadores"
          icon={UserPlus} tone="supporter" trend={trends.supporters}
        />
        <StatCard
          label="Pessoas atendidas" value={summary.totalPessoasAtendidas} href="/pessoas-atendidas"
          icon={HeartHandshake} tone="orange" trend={trends.attendanceActivity}
        />
        <StatCard
          label="Demandas resolvidas (mês)" value={summary.demandsResolvedThisMonth} href="/demandas?status=resolvida"
          icon={ClipboardCheck} tone="secondary" trend={trends.demandsResolved}
        />
        <StatCard
          label="Atendimentos pendentes" value={summary.attendancesPending} href="/atendimentos"
          icon={Stethoscope} tone="accent" trend={trends.attendancesPending}
        />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Lideranças por cidade</p>
          <CategoryBarChart
            data={leadersByCity} unitLabel="liderança(s)"
            emptyMessage="Sem lideranças com cidade cadastrada ainda."
          />
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Lideranças por bairro</p>
          <CategoryDonutChart
            data={leadersByNeighborhood} unitLabel="liderança(s)"
            emptyMessage="Sem lideranças com bairro cadastrado ainda."
          />
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Apoiadores por cidade</p>
          <CategoryBarChart
            data={supportersByCity} unitLabel="apoiador(es)"
            emptyMessage="Sem apoiadores com cidade cadastrada ainda."
          />
        </div>

        <div className="rounded-lg border border-black/5 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Apoiadores por bairro</p>
          <CategoryDonutChart
            data={supportersByNeighborhood} unitLabel="apoiador(es)"
            emptyMessage="Sem apoiadores com bairro cadastrado ainda."
          />
        </div>
      </div>

      {role === "admin_geral" && votesSummary && votesByCity && (
        <div className="rounded-lg border border-black/5 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Expectativa de votos por cidade</p>
              <p className="text-xs text-foreground/50">
                Informado pelas lideranças: {votesSummary.totalExpectedVotes} · Avaliação do Admin Geral: {votesSummary.totalAdminEstimatedVotes}
              </p>
            </div>
            <Link
              href="/relatorios/votos"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
            >
              Ver detalhado
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <VotesByCityChart
            data={votesByCity}
            emptyMessage="Sem expectativa de votos informada ainda."
          />
        </div>
      )}
    </div>
  )
}
