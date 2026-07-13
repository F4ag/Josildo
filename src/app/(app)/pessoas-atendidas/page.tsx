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

      {pessoas.length === 0 ? (
        <div className="rounded-lg border border-black/5 bg-white px-4 py-8 text-center text-sm text-foreground/50">
          Ninguém com demanda ou atendimento registrado ainda.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:hidden">
            {pessoas.map((p) => (
              <Link key={p.id} href={`/pessoas-atendidas/${p.id}`} className="block rounded-lg border border-black/5 bg-white p-4 hover:border-primary/30">
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="mt-1 text-sm text-foreground/60">
                  {p.neighborhood ?? "Sem bairro"} · {p.leaders?.name ?? "—"}
                </p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-black/5 bg-white sm:block">
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
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
