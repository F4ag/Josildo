"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { NeighborhoodCount } from "@/services/dashboard"

export function SupportersByNeighborhoodChart({ data }: { data: NeighborhoodCount[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground/50">Sem apoiadores com bairro cadastrado ainda.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="neighborhood"
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => [`${value} apoiador(es)`, ""]} labelFormatter={(label) => label} />
        <Bar dataKey="count" fill="#0B2545" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
