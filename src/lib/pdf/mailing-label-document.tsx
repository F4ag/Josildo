import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { MailingLabel } from "@/lib/mailing-label"

// 15x5cm exatos, em pontos (1cm = 28.3464567pt) — cada etiqueta é uma
// página própria (padrão de impressora de etiqueta em rolo/contínua:
// DYMO, Zebra etc. imprimem uma "página" por etiqueta física). Também
// funciona numa impressora comum, só sai como várias páginas pequenas.
const LABEL_WIDTH = 425.2
const LABEL_HEIGHT = 141.7

const styles = StyleSheet.create({
  page: {
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    padding: 14,
    fontFamily: "Helvetica",
    color: "#2B2B2B",
    justifyContent: "center",
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
      {labels.map((label, i) => (
        <Page key={i} size={[LABEL_WIDTH, LABEL_HEIGHT]} style={styles.page}>
          <View>
            <Text style={styles.name}>{label.name}</Text>
            {label.addressLines.map((line, j) => (
              <Text key={j} style={styles.addressLine}>{line}</Text>
            ))}
          </View>
        </Page>
      ))}
    </Document>
  )
}
