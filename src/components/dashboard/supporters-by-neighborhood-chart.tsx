"use client"

// Generalizado pra atender os 4 gráficos exploratórios do Dashboard
// (Lideranças × Apoiadores, Cidade × Bairro) em vez de repetir o mesmo
// componente 4 vezes só trocando o dataKey — só muda o rótulo da unidade no
// tooltip. Nome do arquivo ficou histórico (era só "apoiadores por bairro"),
// mas o export agora é o CategoryBarChart genérico.
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { CategoryCount } from "@/services/dashboard"

// Paleta categórica — cada barra (cidade/bairro) recebe uma cor diferente
// dentro do mesmo gráfico, em vez de todas saírem na mesma cor sólida
// (pedido explícito: "cada cidade uma cor diferente"). Mistura os tons da
// marca (navy, verde, dourado, roxo) com mais alguns complementares pra
// cobrir até o limite de 10 categorias por gráfico (ver limit=10 em
// services/dashboard.ts); acima disso repete o ciclo.
// Exportada (não só local) pra category-donut-chart.tsx usar a mesma
// paleta — os 4 gráficos exploratórios do Dashboard (2 em barra, 2 em
// rosca) precisam ter cores consistentes entre si.
export const CATEGORY_PALETTE = [
  "#0B2545", // navy (primary)
  "#1E7A46", // verde (secondary)
  "#D4A017", // dourado (accent)
  "#7C3AED", // roxo (supporter)
  "#C0392B", // vermelho
  "#0EA5E9", // azul-céu
  "#E08E0B", // laranja
  "#0D9488", // verde-azulado
  "#DB2777", // rosa
  "#64748B", // cinza-azulado
]
const PALETTE = CATEGORY_PALETTE

type CategoryBarChartProps = {
  data: CategoryCount[]
  /** Rótulo da unidade contada, usado no tooltip (ex.: "liderança(s)"). */
  unitLabel: string
  emptyMessage: string
}

export function CategoryBarChart({ data, unitLabel, emptyMessage }: CategoryBarChartProps) {
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
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.label} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
