import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate } from "./shared-styles"
import type { AllRegistrationRow } from "@/services/reports"

// Relatório geral (lideranças + apoiadores juntos): Cidade, Bairro, Tipo,
// Nome, WhatsApp, Liderança vinculada (só preenchida pra linha de apoiador).
const cols = StyleSheet.create({
  cidade: { width: "13%" },
  bairro: { width: "14%" },
  tipo: { width: "10%" },
  nome: { width: "23%" },
  whatsapp: { width: "16%" },
  lideranca: { width: "24%" },
})

const KIND_LABELS: Record<AllRegistrationRow["kind"], string> = {
  lideranca: "Liderança",
  apoiador: "Apoiador",
}

type AllRegistrationsReportDocumentProps = {
  rows: AllRegistrationRow[]
  generatedAt: Date
}

export function AllRegistrationsReportDocument({ rows, generatedAt }: AllRegistrationsReportDocumentProps) {
  return (
    <Document title="Lidera+ — Todos os cadastros">
      <Page size="A4" orientation="landscape" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Text style={reportStyles.title}>Todos os cadastros</Text>
          <Text style={reportStyles.subtitle}>Lidera+ · Gerado em {formatDate(generatedAt)}</Text>
        </View>

        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, cols.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, cols.bairro]}>Bairro</Text>
            <Text style={[reportStyles.cellHeader, cols.tipo]}>Tipo</Text>
            <Text style={[reportStyles.cellHeader, cols.nome]}>Nome</Text>
            <Text style={[reportStyles.cellHeader, cols.whatsapp]}>WhatsApp</Text>
            <Text style={[reportStyles.cellHeader, cols.lideranca]}>Liderança vinculada</Text>
          </View>

          {rows.map((row, i) => (
            <View key={`${row.kind}-${row.id}`} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={cols.cidade}>{row.city ?? "—"}</Text>
              <Text style={cols.bairro}>{row.neighborhood ?? "—"}</Text>
              <Text style={cols.tipo}>{KIND_LABELS[row.kind]}</Text>
              <Text style={cols.nome}>{row.name}</Text>
              <Text style={cols.whatsapp}>{row.phone ?? "—"}</Text>
              <Text style={cols.lideranca}>{row.leaderName ?? "—"}</Text>
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
