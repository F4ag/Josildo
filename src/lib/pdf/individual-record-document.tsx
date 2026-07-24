import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { FichaData } from "@/lib/ficha-individual"

// Layout de "ficha" (formulário), diferente das tabelas dos outros
// relatórios — por isso estilos próprios aqui em vez de reaproveitar
// reportStyles.table/.row (que são pensados pra linhas de tabela).
const fichaStyles = StyleSheet.create({
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#FFFFFF",
    backgroundColor: "#0B2545",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  fieldsGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 8, marginBottom: 6 },
  fieldFull: { width: "100%", paddingRight: 8, marginBottom: 6 },
  fieldLabel: { fontSize: 7, textTransform: "uppercase", color: "#6B7280", marginBottom: 1 },
  fieldValue: { fontSize: 9.5, color: "#2B2B2B" },
})

type IndividualRecordDocumentProps = {
  ficha: FichaData
  generatedAt: Date
}

export function IndividualRecordDocument({ ficha, generatedAt }: IndividualRecordDocumentProps) {
  const kindLabel = ficha.kind === "lideranca" ? "Liderança" : "Apoiador"

  return (
    <Document title={`Lidera+ — Ficha individual — ${ficha.name}`}>
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Ficha individual — {kindLabel}</Text>
          <Text style={reportStyles.subtitle}>{ficha.name} · Gerado em {formatDate(generatedAt)}</Text>
        </View>

        {ficha.sections.map((section) => (
          <View key={section.title} style={fichaStyles.section} wrap={false}>
            <Text style={fichaStyles.sectionTitle}>{section.title}</Text>
            <View style={fichaStyles.fieldsGrid}>
              {section.fields.map((field) => (
                <View
                  key={field.label}
                  style={field.label === "Observações" ? fichaStyles.fieldFull : fichaStyles.field}
                >
                  <Text style={fichaStyles.fieldLabel}>{field.label}</Text>
                  <Text style={fichaStyles.fieldValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={reportStyles.footer} fixed>
          Lidera+ — Mais liderança. Mais presença. Mais resultado.
        </Text>
      </Page>
    </Document>
  )
}
