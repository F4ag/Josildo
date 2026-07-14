import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { VotesSummary, VotesByGroupRow } from "@/services/reports"

const cols = StyleSheet.create({
  local: { width: "32%" },
  cidade: { width: "22%" },
  liderancas: { width: "15%", textAlign: "center" },
  informado: { width: "16%", textAlign: "center" },
  avaliacao: { width: "15%", textAlign: "center" },
})

type VotesReportDocumentProps = {
  summary: VotesSummary
  byCity: VotesByGroupRow[]
  byNeighborhood: VotesByGroupRow[]
  generatedAt: Date
}

export function VotesReportDocument({ summary, byCity, byNeighborhood, generatedAt }: VotesReportDocumentProps) {
  return (
    <Document title="Lidera+ — Expectativa de votos">
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Expectativa de votos</Text>
          <Text style={reportStyles.subtitle}>Lidera+ · Gerado em {formatDate(generatedAt)}</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 10, marginBottom: 3 }}>
            Total informado pelas lideranças: {summary.totalExpectedVotes} votos
            ({summary.leadersWithExpectedVotes} de {summary.totalLeaders} lideranças informaram)
          </Text>
          <Text style={{ fontSize: 10 }}>
            Avaliação do Admin Geral: {summary.totalAdminEstimatedVotes} votos
            ({summary.leadersWithAdminEstimate} de {summary.totalLeaders} lideranças avaliadas)
          </Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginBottom: 6 }}>Por cidade</Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.liderancas]}>Lideranças</Text>
            <Text style={[reportStyles.cellHeader, cols.informado]}>Informado (liderança)</Text>
            <Text style={[reportStyles.cellHeader, cols.avaliacao]}>Avaliação (admin)</Text>
          </View>
          {byCity.map((row, i) => (
            <View key={row.label} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={cols.cidade}>{row.label}</Text>
              <Text style={cols.liderancas}>{row.leaderCount}</Text>
              <Text style={cols.informado}>{row.expectedVotes}</Text>
              <Text style={cols.avaliacao}>{row.adminEstimatedVotes}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginTop: 20, marginBottom: 6 }}>
          Por bairro
        </Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.local]}>Bairro</Text>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.liderancas]}>Lideranças</Text>
            <Text style={[reportStyles.cellHeader, cols.informado]}>Informado (liderança)</Text>
            <Text style={[reportStyles.cellHeader, cols.avaliacao]}>Avaliação (admin)</Text>
          </View>
          {byNeighborhood.map((row, i) => (
            <View
              key={`${row.city ?? "sem-cidade"}-${row.label}`}
              style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row}
              wrap={false}
            >
              <Text style={cols.local}>{row.label}</Text>
              <Text style={cols.cidade}>{row.city ?? "—"}</Text>
              <Text style={cols.liderancas}>{row.leaderCount}</Text>
              <Text style={cols.informado}>{row.expectedVotes}</Text>
              <Text style={cols.avaliacao}>{row.adminEstimatedVotes}</Text>
            </View>
          ))}
        </View>

        <Text style={reportStyles.footer} fixed>
          Lidera+ — Mais liderança. Mais presença. Mais resultado.
        </Text>
      </Page>
    </Document>
  )
}
