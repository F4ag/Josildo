"use client"

// Segundo padrão visual dos 4 gráficos exploratórios do Dashboard (Opção C
// do redesign: cidade em barra, bairro em rosca, pra dar textura visual
// variada sem sair da paleta da marca). Mesma CategoryCount dos gráficos de
// barra, mesma paleta compartilhada (ver CATEGORY_PALETTE).
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
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
  const total = chartData.reduce((sum, item) => sum + item.count, 0)

  // Antes as fatias tinham rótulo "Cidade (20%)" flutuando pra fora do
  // círculo (label/labelLine do Pie) — em telas estreitas (celular) esse
  // texto passava da largura do card e ficava cortado ("rtur Lundgren I
  // (20%)"). Trocado por uma legenda abaixo do gráfico, que quebra linha
  // normalmente dentro da largura do card em vez de vazar pra fora.
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Pie data={chartData} dataKey="count" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {chartData.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={entry.label === "Outros" ? "#94A3B8" : CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]}
            />
          ))}
        </Pie>
        <Legend
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: 12, lineHeight: 1.6, paddingTop: 8 }}
          formatter={(value, entry) => {
            const count = (entry?.payload as unknown as { count?: number } | undefined)?.count ?? 0
            const percent = total > 0 ? Math.round((count / total) * 100) : 0
            return `${value} (${percent}%)`
          }}
        />
        <Tooltip formatter={(value: number) => [`${value} ${unitLabel}`, ""]} />
      </PieChart>
    </ResponsiveContainer>
  )
}
