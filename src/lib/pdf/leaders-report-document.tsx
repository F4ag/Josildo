import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate } from "./shared-styles"
import { LEADER_STATUS_LABELS, type LeaderStatus } from "@/types/domain"
import type { LeaderReportRow } from "@/services/reports"

// Larguras de coluna do relatório 11.1 (Bairro, Nome, WhatsApp, Apoiadores,
// Demandas solicitadas, Demandas resolvidas, Atendimentos, Última interação, Status)
const cols = StyleSheet.create({
  bairro: { width: "10%" },
  cidade: { width: "10%" },
  nome: { width: "17%" },
  whatsapp: { width: "12%" },
  apoiadores: { width: "8%", textAlign: "center" },
  demandas: { width: "10%", textAlign: "center" },
  resolvidas: { width: "10%", textAlign: "center" },
  atendimentos: { width: "9%", textAlign: "center" },
  interacao: { width: "9%" },
  status: { width: "5%" },
})

type LeadersReportDocumentProps = {
  rows: LeaderReportRow[]
  generatedAt: Date
  /** "bairro" (padrão, Módulo 11.1) ou "cidade" (mesma listagem, ordenada e
   * organizada por cidade) — só troca o título e a ordem das duas primeiras
   * colunas, os dados são os mesmos. */
  groupBy?: "bairro" | "cidade"
}

export function LeadersReportDocument({ rows, generatedAt, groupBy = "bairro" }: LeadersReportDocumentProps) {
  const title = groupBy === "cidade" ? "Lideranças por cidade" : "Lideranças por bairro"

  return (
    <Document title={`Lidera+ — ${title}`}>
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.title}>{title}</Text>
          <Text style={reportStyles.subtitle}>Lidera+ · Gerado em {formatDate(generatedAt)}</Text>
        </View>

        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            {groupBy === "cidade" ? (
              <>
                <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
                <Text style={[reportStyles.cellHeader, cols.bairro]}>Bairro</Text>
              </>
            ) : (
              <>
                <Text style={[reportStyles.cellHeader, cols.bairro]}>Bairro</Text>
                <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
              </>
            )}
            <Text style={[reportStyles.cellHeader, cols.nome]}>Liderança</Text>
            <Text style={[reportStyles.cellHeader, cols.whatsapp]}>WhatsApp</Text>
            <Text style={[reportStyles.cellHeader, cols.apoiadores]}>Apoiadores</Text>
            <Text style={[reportStyles.cellHeader, cols.demandas]}>Demandas</Text>
            <Text style={[reportStyles.cellHeader, cols.resolvidas]}>Resolvidas</Text>
            <Text style={[reportStyles.cellHeader, cols.atendimentos]}>Atendimentos</Text>
            <Text style={[reportStyles.cellHeader, cols.interacao]}>Última interação</Text>
            <Text style={[reportStyles.cellHeader, cols.status]}>Status</Text>
          </View>

          {rows.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              {groupBy === "cidade" ? (
                <>
                  <Text style={cols.cidade}>{row.city ?? "—"}</Text>
                  <Text style={cols.bairro}>{row.neighborhood ?? "—"}</Text>
                </>
              ) : (
                <>
                  <Text style={cols.bairro}>{row.neighborhood ?? "—"}</Text>
                  <Text style={cols.cidade}>{row.city ?? "—"}</Text>
                </>
              )}
              <Text style={cols.nome}>{row.name}</Text>
              <Text style={cols.whatsapp}>{row.phone ?? "—"}</Text>
              <Text style={cols.apoiadores}>{row.supporterCount}</Text>
              <Text style={cols.demandas}>{row.demandCount}</Text>
              <Text style={cols.resolvidas}>{row.demandResolvedCount}</Text>
              <Text style={cols.atendimentos}>{row.attendanceCount}</Text>
              <Text style={cols.interacao}>{row.lastInteractionAt ? formatDate(row.lastInteractionAt) : "—"}</Text>
              <Text style={cols.status}>{LEADER_STATUS_LABELS[row.status as LeaderStatus] ?? row.status}</Text>
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
