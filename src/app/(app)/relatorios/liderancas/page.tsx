import Link from "next/link"
import type { Metadata } from "next"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getLeadersByNeighborhoodReport } from "@/services/reports"
import { LEADER_STATUS_LABELS, type LeaderStatus } from "@/types/domain"
import { PrintButton } from "@/components/print-button"

export const metadata: Metadata = { title: "Lideranças por bairro · Lidera+" }

export default async function RelatorioLiderancasPage() {
  const supabase = await createClient()
  const rows = await getLeadersByNeighborhoodReport(supabase)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Lideranças por bairro</h1>
          <p className="text-sm text-foreground/60">{rows.length} lideranças.</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Link href="/relatorios/liderancas/pdf"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Download className="h-4 w-4" aria-hidden />
            Baixar PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/5 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/[0.02] text-xs uppercase text-foreground/50">
            <tr>
              <th className="px-4 py-3">Bairro</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Liderança</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3 text-center">Apoiadores</th>
              <th className="px-4 py-3 text-center">Demandas</th>
              <th className="px-4 py-3 text-center">Resolvidas</th>
              <th className="px-4 py-3 text-center">Atendimentos</th>
              <th className="px-4 py-3">Última interação</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-black/5">
                <td className="px-4 py-3 text-foreground/70">{row.neighborhood ?? "—"}</td>
                <td className="px-4 py-3 text-foreground/70">{row.city ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-foreground/70">{row.phone ?? "—"}</td>
                <td className="px-4 py-3 text-center">{row.supporterCount}</td>
                <td className="px-4 py-3 text-center">{row.demandCount}</td>
                <td className="px-4 py-3 text-center">{row.demandResolvedCount}</td>
                <td className="px-4 py-3 text-center">{row.attendanceCount}</td>
                <td className="px-4 py-3 text-foreground/70">
                  {row.lastInteractionAt ? new Date(row.lastInteractionAt).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {LEADER_STATUS_LABELS[row.status as LeaderStatus] ?? row.status}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-foreground/50">Nenhuma liderança cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
