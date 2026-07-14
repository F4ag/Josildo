"use client"

// Segundo padrão visual dos 4 gráficos exploratórios do Dashboard (Opção C
// do redesign: cidade em barra, bairro em rosca, pra dar textura visual
// variada sem sair da paleta da marca). Mesma CategoryCount dos gráficos de
// barra, mesma paleta compartilhada (ver CATEGORY_PALETTE).
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { CategoryCount } from "@/services/dashboard"
import { CATEGORY_PALETTE } from "./supporters-by-neighborhood-chart"

type CategoryDonutChartProps = {
  data: CategoryCount[]
  unitLabel: string
  emptyMessage: string
}

// Limite de fatias visíveis antes de agrupar o resto em "Outros" — rosca
// com muitas fatias finas fica ilegível (o gráfico de barra já mostra o
// detalhe completo até 10 categorias; a rosca aqui é mais pra visão geral
// de proporção).
const MAX_SLICES = 5

export function CategoryDonutChart({ data, unitLabel, emptyMessage }: CategoryDonutChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground/50">{emptyMessage}</p>
  }

  const visible = data.slice(0, MAX_SLICES)
  const rest = data.slice(MAX_SLICES)
  const restTotal = rest.reduce((sum, item) => sum + item.count, 0)
  const chartData = restTotal > 0 ? [...visible, { label: "Outros", count: restTotal }] : visible

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="label"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          label={({ label, percent }) => `${label} (${Math.round(percent * 100)}%)`}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={entry.label === "Outros" ? "#94A3B8" : CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]}
            />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => [`${value} ${unitLabel}`, ""]} />
      </PieChart>
    </ResponsiveContainer>
  )
}
