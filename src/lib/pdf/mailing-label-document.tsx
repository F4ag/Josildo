import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { MailingLabel } from "@/lib/mailing-label"

// 15x5cm exatos, em pontos (1cm = 28.3464567pt). Numa folha A4 (21x29,7cm)
// só cabe 1 coluna de largura (2 x 15cm = 30cm > 21cm), mas cabem várias
// linhas — por isso etiquetas são empilhadas numa coluna única, quantas
// couberem por página. O @react-pdf/renderer pagina sozinho quando o
// conteúdo de um <Page> não cabe todo (mesmo mecanismo já usado nos
// outros relatórios em tabela, ver leaders-report-document.tsx) — não
// precisa calcular manualmente quantas entram por folha.
const LABEL_WIDTH = 425.2
const LABEL_HEIGHT = 141.7

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Helvetica",
    color: "#2B2B2B",
    alignItems: "center",
  },
  label: {
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
  },
  name: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0B2545",
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 11,
    color: "#2B2B2B",
    marginBottom: 1,
  },
})

type MailingLabelDocumentProps = {
  labels: MailingLabel[]
}

export function MailingLabelDocument({ labels }: MailingLabelDocumentProps) {
  return (
    <Document title="Lidera+ — Etiquetas de correspondência">
      <Page size="A4" style={styles.page} wrap>
        {labels.map((label, i) => (
          <View key={i} style={styles.label} wrap={false}>
            <Text style={styles.name}>{label.name}</Text>
            {label.addressLines.map((line, j) => (
              <Text key={j} style={styles.addressLine}>{line}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
