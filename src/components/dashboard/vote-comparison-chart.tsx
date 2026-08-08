"use client"

// Gráfico do relatório "Comparativo de votos" — mesmo padrão visual do
// VotesByCityChart (Dashboard), duas séries lado a lado, mas aqui é
// esperado (expected_votes) x resultado REAL (importado do TSE), não
// esperado x avaliação do admin.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { VoteComparisonByPollingLocationRow } from "@/services/reports"
import { CATEGORY_PALETTE } from "./supporters-by-neighborhood-chart"

export function VoteComparisonChart({
  data,
  emptyMessage,
}: {
  data: VoteComparisonByPollingLocationRow[]
  emptyMessage: string
}) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground/50">{emptyMessage}</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={60} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="expectedVotes" name="Esperado (liderança)" fill={CATEGORY_PALETTE[0]} radius={[4, 4, 0, 0]} />
        <Bar dataKey="realVotes" name="Resultado real (TSE)" fill={CATEGORY_PALETTE[1]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
