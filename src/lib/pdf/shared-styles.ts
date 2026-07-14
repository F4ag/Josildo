import path from "path"
import { StyleSheet } from "@react-pdf/renderer"

// Caminho absoluto do lockup (logo + "Lidera+") já usado em public/brand —
// mesmo arquivo do topo do login (src/app/login/page.tsx) e da Sidebar
// (versão ícone). @react-pdf/renderer roda em runtime Node (ver
// "export const runtime = 'nodejs'" nas rotas de PDF), então dá pra passar
// um caminho de arquivo direto pro componente <Image>, sem precisar de URL.
export const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-lockup.png")

// Estilo compartilhado dos PDFs de relatório — cores da identidade visual
// do Lidera+ (§10 do prompt master: azul escuro / cinza claro / grafite).
export const reportStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica", color: "#2B2B2B" },
  header: { marginBottom: 16 },
  // Proporção original do lockup é ~1030x906 (quase quadrado, tem "Lidera+"
  // embaixo do símbolo) — largura fixa pequena o bastante pra não brigar
  // com o título ao lado, altura calculada na mesma proporção.
  logo: { width: 70, height: 62, marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 700, color: "#0B2545" },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  table: { display: "flex", width: "100%" },
  rowHeader: {
    flexDirection: "row",
    backgroundColor: "#0B2545",
    color: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  rowAlt: { backgroundColor: "#F5F6F8" },
  cellHeader: { fontSize: 8, fontWeight: 700 },
  footer: {
    position: "absolute", bottom: 16, left: 24, right: 24,
    fontSize: 7, color: "#9CA3AF", textAlign: "center",
  },
})

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("pt-BR")
}
