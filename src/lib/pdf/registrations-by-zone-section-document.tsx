import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { RegistrationsByZoneSectionRow } from "@/services/reports"

const cols = StyleSheet.create({
  local: { width: "34%" },
  zona: { width: "14%" },
  secao: { width: "14%" },
  cidade: { width: "16%" },
  liderancas: { width: "8%", textAlign: "center" },
  apoiadores: { width: "8%", textAlign: "center" },
  total: { width: "6%", textAlign: "center" },
})

type RegistrationsByZoneSectionDocumentProps = {
  rows: RegistrationsByZoneSectionRow[]
  leadersWithoutInfo: number
  supportersWithoutInfo: number
  cityFilter?: string
  generatedAt: Date
}

export function RegistrationsByZoneSectionDocument({
  rows, leadersWithoutInfo, supportersWithoutInfo, cityFilter, generatedAt,
}: RegistrationsByZoneSectionDocumentProps) {
  const total = rows.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      supporterCount: acc.supporterCount + row.supporterCount,
      totalCount: acc.totalCount + row.totalCount,
    }),
    { leaderCount: 0, supporterCount: 0, totalCount: 0 },
  )

  return (
    <Document title="Lidera+ — Cadastros por local, zona e seção eleitoral">
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Cadastros por local, zona e seção eleitoral</Text>
          <Text style={reportStyles.subtitle}>
            Lidera+ · Gerado em {formatDate(generatedAt)}{cityFilter ? ` · Cidade: ${cityFilter}` : ""}
          </Text>
        </View>

        <Text style={{ fontSize: 8, color: "#555", marginBottom: 10 }}>
          Quantas lideranças e apoiadores estão em cada combinação de Local de votação, Zona eleitoral e Seção
          eleitoral — base já cadastrada, não é dado do TSE.
          {leadersWithoutInfo > 0 || supportersWithoutInfo > 0
            ? ` ${leadersWithoutInfo} liderança(s) e ${supportersWithoutInfo} apoiador(es) ainda não têm nenhuma dessas 3 informações cadastradas e não entram nesta tabela.`
            : ""}
        </Text>

        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.local]}>Local de votação</Text>
            <Text style={[reportStyles.cellHeader, cols.zona]}>Zona</Text>
            <Text style={[reportStyles.cellHeader, cols.secao]}>Seção</Text>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.liderancas]}>Lid.</Text>
            <Text style={[reportStyles.cellHeader, cols.apoiadores]}>Apoi.</Text>
            <Text style={[reportStyles.cellHeader, cols.total]}>Total</Text>
          </View>
          {rows.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={cols.local}>{row.pollingLocationLabel ?? "—"}</Text>
              <Text style={cols.zona}>{row.zone ?? "—"}</Text>
              <Text style={cols.secao}>{row.section ?? "—"}</Text>
              <Text style={cols.cidade}>{row.city ?? "—"}</Text>
              <Text style={cols.liderancas}>{row.leaderCount}</Text>
              <Text style={cols.apoiadores}>{row.supporterCount}</Text>
              <Text style={cols.total}>{row.totalCount}</Text>
            </View>
          ))}
          {rows.length === 0 && (
            <View style={{ paddingVertical: 16, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 9, color: "#777" }}>Nenhum cadastro com local, zona ou seção informado ainda.</Text>
            </View>
          )}
          {rows.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[cols.local, { fontWeight: 700 }]}>Total</Text>
              <Text style={cols.zona} />
              <Text style={cols.secao} />
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
