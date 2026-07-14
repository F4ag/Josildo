"use client"

// Generalizado pra atender os 4 gráficos exploratórios do Dashboard
// (Lideranças × Apoiadores, Cidade × Bairro) em vez de repetir o mesmo
// componente 4 vezes só trocando o dataKey — só muda a cor e o rótulo da
// unidade no tooltip. Nome do arquivo ficou histórico (era só "apoiadores
// por bairro"), mas o export agora é o CategoryBarChart genérico.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { CategoryCount } from "@/services/dashboard"

type CategoryBarChartProps = {
  data: CategoryCount[]
  /** Cor sólida da barra — usar os tons da marca (ver tailwind.config.ts)
   * pra cada gráfico ficar visualmente distinto: primary (lideranças),
   * supporter (apoiadores) etc. */
  color: string
  /** Rótulo da unidade contada, usado no tooltip (ex.: "liderança(s)"). */
  unitLabel: string
  emptyMessage: string
}

export function CategoryBarChart({ data, color, unitLabel, emptyMessage }: CategoryBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-foreground/50">{emptyMessage}</p>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          angle={-30}
          textAnchor="end"
          height={60}
          interval={0}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => [`${value} ${unitLabel}`, ""]} labelFormatter={(label) => label} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
