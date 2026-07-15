import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { reportStyles, formatDate, LOGO_PATH } from "./shared-styles"
import type { ElectorateByGroupRow, ElectorateLocationRow } from "@/services/electorate"

const colsGroup = StyleSheet.create({
  label: { width: "50%" },
  cidade: { width: "25%" },
  locais: { width: "12%", textAlign: "center" },
  eleitores: { width: "13%", textAlign: "center" },
})

const colsLocal = StyleSheet.create({
  local: { width: "34%" },
  bairro: { width: "22%" },
  cidade: { width: "22%" },
  eleitores: { width: "22%", textAlign: "center" },
})

type ElectorateReportDocumentProps = {
  byCity: ElectorateByGroupRow[]
  byNeighborhood: ElectorateByGroupRow[]
  byPollingLocation: ElectorateLocationRow[]
  cityFilter?: string
  neighborhoodFilter?: string
  generatedAt: Date
}

function sumGroup(rows: ElectorateByGroupRow[]) {
  return rows.reduce(
    (acc, row) => ({ locationCount: acc.locationCount + row.locationCount, eleitores: acc.eleitores + row.eleitores }),
    { locationCount: 0, eleitores: 0 },
  )
}

export function ElectorateReportDocument({
  byCity, byNeighborhood, byPollingLocation, cityFilter, neighborhoodFilter, generatedAt,
}: ElectorateReportDocumentProps) {
  const totalByCity = sumGroup(byCity)
  const totalByNeighborhood = sumGroup(byNeighborhood)
  const totalByPollingLocation = byPollingLocation.reduce((acc, row) => acc + (row.eleitores ?? 0), 0)

  return (
    <Document title="Lidera+ — Eleitorado (TSE)">
      <Page size="A4" style={reportStyles.page}>
        <View style={reportStyles.header}>
          <Image style={reportStyles.logo} src={LOGO_PATH} />
          <Text style={reportStyles.title}>Eleitorado (TSE)</Text>
          <Text style={reportStyles.subtitle}>
            Lidera+ · Gerado em {formatDate(generatedAt)}
            {cityFilter ? ` · Cidade: ${cityFilter}` : ""}
            {neighborhoodFilter ? ` · Bairro: ${neighborhoodFilter}` : ""}
          </Text>
        </View>

        <Text style={{ fontSize: 8, color: "#555", marginBottom: 12 }}>
          Consulta ao eleitorado registrado por cidade, bairro e local de votação — dado aberto do TSE, sem cruzar
          com cadastros de lideranças ou apoiadores.
        </Text>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginBottom: 6 }}>Por cidade</Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, colsGroup.label]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, colsGroup.locais]}>Locais</Text>
            <Text style={[reportStyles.cellHeader, colsGroup.eleitores]}>Eleitorado</Text>
          </View>
          {byCity.map((row, i) => (
            <View key={row.label} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={colsGroup.label}>{row.label}</Text>
              <Text style={colsGroup.locais}>{row.locationCount}</Text>
              <Text style={colsGroup.eleitores}>{row.eleitores.toLocaleString("pt-BR")}</Text>
            </View>
          ))}
          {byCity.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[colsGroup.label, { fontWeight: 700 }]}>Total</Text>
              <Text style={[colsGroup.locais, { fontWeight: 700 }]}>{totalByCity.locationCount}</Text>
              <Text style={[colsGroup.eleitores, { fontWeight: 700 }]}>{totalByCity.eleitores.toLocaleString("pt-BR")}</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginTop: 20, marginBottom: 6 }}>
          Por bairro
        </Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, colsGroup.label]}>Bairro</Text>
            <Text style={[reportStyles.cellHeader, colsGroup.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, colsGroup.locais]}>Locais</Text>
            <Text style={[reportStyles.cellHeader, colsGroup.eleitores]}>Eleitorado</Text>
          </View>
          {byNeighborhood.map((row, i) => (
            <View
              key={`${row.city ?? "sem-cidade"}-${row.label}`}
              style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row}
              wrap={false}
            >
              <Text style={colsGroup.label}>{row.label}</Text>
              <Text style={colsGroup.cidade}>{row.city ?? "—"}</Text>
              <Text style={colsGroup.locais}>{row.locationCount}</Text>
              <Text style={colsGroup.eleitores}>{row.eleitores.toLocaleString("pt-BR")}</Text>
            </View>
          ))}
          {byNeighborhood.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[colsGroup.label, { fontWeight: 700 }]}>Total</Text>
              <Text style={colsGroup.cidade} />
              <Text style={[colsGroup.locais, { fontWeight: 700 }]}>{totalByNeighborhood.locationCount}</Text>
              <Text style={[colsGroup.eleitores, { fontWeight: 700 }]}>{totalByNeighborhood.eleitores.toLocaleString("pt-BR")}</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 12, fontWeight: 700, color: "#0B2545", marginTop: 20, marginBottom: 6 }}>
          Por local de votação
        </Text>
        <View style={reportStyles.table}>
          <View style={reportStyles.rowHeader} fixed>
            <Text style={[reportStyles.cellHeader, colsLocal.local]}>Local de votação</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.bairro]}>Bairro</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.cidade]}>Cidade</Text>
            <Text style={[reportStyles.cellHeader, colsLocal.eleitores]}>Eleitorado</Text>
          </View>
          {byPollingLocation.map((row, i) => (
            <View key={row.id} style={i % 2 === 1 ? [reportStyles.row, reportStyles.rowAlt] : reportStyles.row} wrap={false}>
              <Text style={colsLocal.local}>{row.nome}</Text>
              <Text style={colsLocal.bairro}>{row.bairro ?? "—"}</Text>
              <Text style={colsLocal.cidade}>{row.city}</Text>
              <Text style={colsLocal.eleitores}>{(row.eleitores ?? 0).toLocaleString("pt-BR")}</Text>
            </View>
          ))}
          {byPollingLocation.length > 0 && (
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#0B2545", paddingVertical: 6, paddingHorizontal: 4 }}>
              <Text style={[colsLocal.local, { fontWeight: 700 }]}>Total</Text>
              <Text style={colsLocal.bairro} />
              <Text style={colsLocal.cidade} />
              <Text style={[colsLocal.eleitores, { fontWeight: 700 }]}>{totalByPollingLocation.toLocaleString("pt-BR")}</Text>
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
