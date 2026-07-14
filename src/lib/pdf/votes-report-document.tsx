import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { VotesSummary, VotesByGroupRow, VotesByPollingLocationRow } from "@/services/reports"

const cols = StyleSheet.create({
  local: { width: "32%" },
  cidade: { width: "22%" },
  liderancas: { width: "15%", textAlign: "center" },
  informado: { width: "16%", textAlign: "center" },
  avaliacao: { width: "15%", textAlign: "center" },
})

const colsLocal = StyleSheet.create({
  local: { width: "26%" },
  cidade: { width: "16%" },
  liderancas: { width: "11%", textAlign: "center" },
  informado: { width: "13%", textAlign: "center" },
  avaliacao: { width: "13%", textAlign: "center" },
  eleitorado: { width: "11%", textAlign: "center" },
  cobertura: { width: "10%", textAlign: "center" },
})

type VotesReportDocumentProps = {
  summary: VotesSummary
  byCity: VotesByGroupRow[]
  byNeighborhood: VotesByGroupRow[]
  byPollingLocation: VotesByPollingLocationRow[]
  leadersWithoutLocation: number
  generatedAt: Date
}

function sumRows(rows: VotesByGroupRow[]) {
  return rows.reduce(
    (acc, row) => ({
      leaderCount: acc.leaderCount + row.leaderCount,
      expectedVotes: acc.expectedVotes + row.expectedVotes,
      adminEstimatedVotes: acc.adminEstimatedVotes + row.adminEstimatedVotes,
    }),
    { leaderCount: 0, expectedVotes: 0, adminEstimatedVotes: 0 },
  )
}

export function VotesReportDocument({
  summary, byCity, byNeighborhood, byPollingLocation, leadersWithoutLocation, generatedAt,
}: VotesReportDocumentProps) {
  const totalByCity = sumRows(byCity)
  const totalByNeighborhood = sumRows(byNeighborhood)

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
          {byCity.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[cols.cidade, { fontWeight: 700 }]}>Total</Text>
              <Text style={[cols.liderancas, { fontWeight: 700 }]}>{totalByCity.leaderCount}</Text>
              <Text style={[cols.informado, { fontWeight: 700 }]}>{totalByCity.expectedVotes}</Text>
              <Text style={[cols.avaliacao, { fontWeight: 700 }]}>{totalByCity.adminEstimatedVotes}</Text>
            </View>
          )}
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
          {byNeighborhood.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[cols.local, { fontWeight: 700 }]}>Total</Text>
              <Text style={cols.cidade} />
              <Text style={[cols.liderancas, { fontWeight: 700 }]}>{totalByNeighborhood.leaderCount}</Text>
              <Text style={[cols.informado, { fontWeight: 700 }]}>{totalByNeighborhood.expectedVotes}</Text>
              <Text style={[cols.avaliacao, { fontWeight: 700 }]}>{totalByNeighborhood.adminEstimatedVotes}</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginTop: 20, marginBottom: 4 }}>
          Por local de votação
        </Text>
        <Text style={{ fontSize: 8, color: "#555", marginBottom: 6 }}>
          Eleitorado (TSE) é a referência de quantos eleitores existem registrados no local — não é resultado de
          urna (o sistema ainda não importa esse dado, que só existe depois da eleição).
          {leadersWithoutLocation > 0
            ? ` ${leadersWithoutLocation} liderança(s) sem local de votação cadastrado não entram nesta tabela.`
            : ""}
        </Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, colsLocal.local]}>Local</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.liderancas]}>Lideranças</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.informado]}>Informado</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.avaliacao]}>Avaliação</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.eleitorado]}>Eleitorado</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.cobertura]}>Cobertura</Text>
          </View>
          {byPollingLocation.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={colsLocal.local}>{row.label}</Text>
              <Text style={colsLocal.cidade}>{row.city ?? "—"}</Text>
              <Text style={colsLocal.liderancas}>{row.leaderCount}</Text>
              <Text style={colsLocal.informado}>{row.expectedVotes}</Text>
              <Text style={colsLocal.avaliacao}>{row.adminEstimatedVotes}</Text>
              <Text style={colsLocal.eleitorado}>{row.registeredVoters ?? "—"}</Text>
              <Text style={colsLocal.cobertura}>{row.coveragePct != null ? `${row.coveragePct}%` : "—"}</Text>
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
