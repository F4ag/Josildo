import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { RegistrationsByPollingLocationRow } from "@/services/reports"

const cols = StyleSheet.create({
  local: { width: "40%" },
  cidade: { width: "26%" },
  liderancas: { width: "12%", textAlign: "center" },
  apoiadores: { width: "12%", textAlign: "center" },
  total: { width: "10%", textAlign: "center" },
})

type RegistrationsByPollingLocationDocumentProps = {
  rows: RegistrationsByPollingLocationRow[]
  leadersWithoutLocation: number
  supportersWithoutLocation: number
  cityFilter?: string
  generatedAt: Date
}

export function RegistrationsByPollingLocationDocument({
  rows, leadersWithoutLocation, supportersWithoutLocation, cityFilter, generatedAt,
}: RegistrationsByPollingLocationDocumentProps) {
  const total = rows.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      supporterCount: acc.supporterCount + row.supporterCount,
      totalCount: acc.totalCount + row.totalCount,
    }),
    { leaderCount: 0, supporterCount: 0, totalCount: 0 },
  )

  return (
    <Document title="Lidera+ — Cadastros por local de votação">
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Cadastros por local de votação</Text>
          <Text style={reportStyles.subtitle}>
            Lidera+ · Gerado em {formatDate(generatedAt)}{cityFilter ? ` · Cidade: ${cityFilter}` : ""}
          </Text>
        </View>

        <Text style={{ fontSize: 8, color: "#555", marginBottom: 10 }}>
          Quantas lideranças e apoiadores estão vinculados a cada local de votação — não é expectativa de voto, é a
          base já cadastrada com esse campo preenchido.
          {leadersWithoutLocation > 0 || supportersWithoutLocation > 0
            ? ` ${leadersWithoutLocation} liderança(s) e ${supportersWithoutLocation} apoiador(es) ainda não têm local de votação cadastrado e não entram nesta tabela.`
            : ""}
        </Text>

        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.local]}>Local de votação</Text>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.liderancas]}>Lideranças</Text>
            <Text style={[reportStyles.cellHeader, cols.apoiadores]}>Apoiadores</Text>
            <Text style={[reportStyles.cellHeader, cols.total]}>Total</Text>
          </View>
          {rows.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={cols.local}>{row.label}</Text>
              <Text style={cols.cidade}>{row.city ?? "—"}</Text>
              <Text style={cols.liderancas}>{row.leaderCount}</Text>
              <Text style={cols.apoiadores}>{row.supporterCount}</Text>
              <Text style={cols.total}>{row.totalCount}</Text>
            </View>
          ))}
          {rows.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[cols.local, { fontWeight: 700 }]}>Total</Text>
              <Text style={cols.cidade} />
              <Text style={[cols.liderancas, { fontWeight: 700 }]}>{total.leaderCount}</Text>
              <Text style={[cols.apoiadores, { fontWeight: 700 }]}>{total.supporterCount}</Text>
              <Text style={[cols.total, { fontWeight: 700 }]}>{total.totalCount}</Text>
            </View>
          )}
        </View>

        <Text style={reportStyles.footer} fixed>
          Lidera+ — Mais liderança. Mais presença. Mais resultado.
        </Text>
      </Page>
    </Document>
  )
}
