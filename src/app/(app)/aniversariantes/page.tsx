import Link from "next/link"
import type { Metadata } from "next"
import { Cake, CalendarDays, CalendarRange } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { listBirthdays, type BirthdayRange } from "@/services/birthdays"
import { listDistinctSupporterNeighborhoods } from "@/services/supporters"
import { listLeaders } from "@/services/leaders"
import { renderTemplate } from "@/lib/whatsapp"
import { WhatsAppButton } from "@/components/whatsapp-button"
import { StatCard } from "@/components/dashboard/stat-card"
import { GreetButton } from "./greet-button"

export const metadata: Metadata = { title: "Aniversariantes · Lidera+" }

type SearchParams = { periodo?: BirthdayRange; bairro?: string; lideranca?: string }

const RANGE_LABELS: Record<BirthdayRange, string> = {
  hoje: "Hoje", amanha: "Amanhã", semana: "Esta semana", mes: "Este mês",
}

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const range = params.periodo ?? "hoje"
  const supabase = await createClient()
  const filters = { neighborhood: params.bairro, leaderId: params.lideranca }

  // Uma segunda chamada com range="mes" traz o superconjunto de aniversariantes
  // do mês, do qual derivamos os 3 cards (Hoje/Esta semana/Este mês) sem
  // precisar de 3 consultas separadas ao banco — só essa e a da tabela abaixo.
  const [birthdays, birthdaysMonth, neighborhoods, leaders, { data: template }] = await Promise.all([
    listBirthdays(supabase, range, filters),
    listBirthdays(supabase, "mes", filters),
    listDistinctSupporterNeighborhoods(supabase),
    listLeaders(supabase),
    supabase.from("message_templates").select("body").eq("type", "aniversario").eq("status", "ativo").limit(1).maybeSingle(),
  ])

  const statsHoje = birthdaysMonth.filter((b) => b.daysUntil === 0).length
  const statsSemana = birthdaysMonth.filter((b) => b.daysUntil <= 7).length
  const statsMes = birthdaysMonth.length

  const messageBody = template?.body ??
    "Olá, {{nome}}! Passando para desejar um feliz aniversário, com muita saúde, paz e realizações. Que seu novo ciclo seja abençoado. Um grande abraço!"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Aniversariantes</h1>
        <p className="text-sm text-foreground/60">{birthdays.length} nesse período.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Hoje" value={statsHoje} href="/aniversariantes?periodo=hoje" icon={Cake} tone="accent" />
        <StatCard label="Esta semana" value={statsSemana} href="/aniversariantes?periodo=semana" icon={CalendarDays} tone="orange" />
        <StatCard label="Este mês" value={statsMes} href="/aniversariantes?periodo=mes" icon={CalendarRange} tone="secondary" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(RANGE_LABELS) as BirthdayRange[]).map((r) => (
          <Link
            key={r}
            href={`/aniversariantes?periodo=${r}${params.bairro ? `&bairro=${params.bairro}` : ""}${params.lideranca ? `&lideranca=${params.lideranca}` : ""}`}
            className={
              r === range
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-foreground/70 hover:bg-black/5"
            }
          >
            {RANGE_LABELS[r]}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-3 rounded-lg border border-black/5 bg-white p-4">
        <input type="hidden" name="periodo" value={range} />
        <select name="bairro" defaultValue={params.bairro ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select name="lideranca" defaultValue={params.lideranca ?? ""} className="rounded-md border border-black/10 px-3 py-2 text-sm">
          <option value="">Todas as lideranças</option>
          {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <button type="submit" className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          Filtrar
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Liderança</th>
              <th className="px-4 py-3" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {birthdays.map((b) => (
              <tr key={b.id} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-foreground/70">
                  {new Date(`${b.birthDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  {b.daysUntil === 0 && <span className="ml-2 text-xs text-secondary">hoje</span>}
                </td>
                <td className="px-4 py-3 text-foreground/70">{b.neighborhood ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{b.leaderName ?? "—"}</td>
                <td className="px-4 py-3">
                  <WhatsAppButton
                    phone={b.phone}
                    message={renderTemplate(messageBody, { nome: b.name })}
                    label="Parabenizar"
                    consentWhatsapp={b.consentWhatsapp}
                  />
                </td>
                <td className="px-4 py-3">
                  <GreetButton supporterId={b.id} leaderId={b.leaderId} alreadyGreeted={b.alreadyGreetedToday} />
                </td>
              </tr>
            ))}
            {birthdays.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/50">Ninguém faz aniversário nesse período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
