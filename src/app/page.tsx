import { redirect } from "next/navigation"

// A raiz do site ("/") não tem tela própria — só existe pra dar um destino
// pra quem abre o domínio direto (ex.: favoritos, digitar a URL sem path).
// O middleware.ts já cuida de mandar pra /login quem não está autenticado;
// aqui só definimos que o destino "de verdade" é o dashboard.
export default function RootPage() {
  redirect("/dashboard")
}
