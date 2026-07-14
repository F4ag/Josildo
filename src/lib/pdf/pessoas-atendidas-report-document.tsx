import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { PessoaAtendidaReportRow } from "@/services/reports"

const cols = StyleSheet.create({
  nome: { width: "22%" },
  bairro: { width: "13%" },
  cidade: { width: "13%" },
  lideranca: { width: "18%" },
  demandas: { width: "8%", textAlign: "center" },
  demandasResolvidas: { width: "8%", textAlign: "center" },
  atendimentos: { width: "9%", textAlign: "center" },
  atendimentosConcluidos: { width: "9%", textAlign: "center" },
})

export function PessoasAtendidasReportDocument({
  rows, generatedAt,
}: {
  rows: PessoaAtendidaReportRow[]
  generatedAt: Date
}) {
  return (
    <Document title="Lidera+ — Pessoas atendidas">
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Pessoas atendidas</Text>
          <Text style={reportStyles.subtitle}>Lidera+ · Gerado em {formatDate(generatedAt)}</Text>
        </View>

        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.nome]}>Nome</Text>
            <Text style={[reportStyles.cellHeader, cols.bairro]}>Bairro</Text>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.lideranca]}>Liderança</Text>
            <Text style={[reportStyles.cellHeader, cols.demandas]}>Demandas</Text>
            <Text style={[reportStyles.cellHeader, cols.demandasResolvidas]}>Resolvidas</Text>
            <Text style={[reportStyles.cellHeader, cols.atendimentos]}>Atendimentos</Text>
            <Text style={[reportStyles.cellHeader, cols.atendimentosConcluidos]}>Concluídos</Text>
          </View>

          {rows.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={cols.nome}>{row.name}</Text>
              <Text style={cols.bairro}>{row.neighborhood ?? "—"}</Text>
              <Text style={cols.cidade}>{row.city ?? "—"}</Text>
              <Text style={cols.lideranca}>{row.leaderName ?? "—"}</Text>
              <Text style={cols.demandas}>{row.demandCount}</Text>
              <Text style={cols.demandasResolvidas}>{row.demandResolvedCount}</Text>
              <Text style={cols.atendimentos}>{row.attendanceCount}</Text>
              <Text style={cols.atendimentosConcluidos}>{row.attendanceConcludedCount}</Text>
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
