"use client"

// Gráfico exploratório de "Expectativa de votos" no Dashboard — só aparece
// pro admin_geral (mesma restrição do relatório completo em
// /relatorios/votos, já que cruza admin_estimated_votes, campo admin-only
// em todo o resto do sistema). Mostra as duas séries lado a lado por
// cidade: o que a liderança informou x a avaliação do Admin Geral — o
// detalhamento por bairro fica só no relatório (link abaixo do gráfico).
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { VotesByGroupRow } from "@/services/reports"
import { CATEGORY_PALETTE } from "./supporters-by-neighborhood-chart"

type VotesByCityChartProps = {
  data: VotesByGroupRow[]
  emptyMessage: string
}

export function VotesByCityChart({ data, emptyMessage }: VotesByCityChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground/50">{emptyMessage}</p>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="expectedVotes" name="Informado (liderança)" fill={CATEGORY_PALETTE[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="adminEstimatedVotes" name="Avaliação (admin)" fill={CATEGORY_PALETTE[2]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
