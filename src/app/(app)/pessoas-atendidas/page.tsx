import Link from "next/link"
import type { Metadata } from "next"
import { HeartHandshake, ClipboardList, Stethoscope } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { listPessoasAtendidas, getPessoasAtendidasStats } from "@/services/pessoas-atendidas"
import { StatCard } from "@/components/dashboard/stat-card"

export const metadata: Metadata = { title: "Pessoas Atendidas · Lidera+" }

// Módulo 5: lista todo apoiador que já tem >=1 demanda ou atendimento
// registrado. Não tem botão "Novo" — pessoa atendida nasce de uma demanda
// ou atendimento em /demandas/nova ou /atendimentos/novo, nunca é cadastrada
// direto aqui.
export default async function PessoasAtendidasPage() {
  const supabase = await createClient()
  const [pessoas, stats] = await Promise.all([
    listPessoasAtendidas(supabase),
    getPessoasAtendidasStats(supabase),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Pessoas Atendidas</h1>
        <p className="text-sm text-foreground/60">
          {pessoas.length} apoiador(es) com pelo menos uma demanda ou atendimento registrado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} icon={HeartHandshake} tone="primary" />
        <StatCard label="Com demanda" value={stats.comDemanda} icon={ClipboardList} tone="orange" />
        <StatCard label="Com atendimento" value={stats.comAtendimento} icon={Stethoscope} tone="secondary" />
      </div>

      <div className="overflow-hidden rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Liderança</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="px-4 py-3">
                  <Link href={`/pessoas-atendidas/${p.id}`} className="font-medium text-foreground hover:text-primary">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground/70">{p.neighborhood ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{p.leaders?.name ?? "—"}</td>
              </tr>
            ))}
            {pessoas.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-foreground/50">Ninguém com demanda ou atendimento registrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
