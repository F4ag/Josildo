import { redirect } from "next/navigation"

// "/configuracoes" não tem tela própria — a única sub-tela hoje é
// "/configuracoes/usuarios" (Módulo 1/17). Sem esse redirect, o item
// "Configurações" do menu lateral cai num 404.
export default function ConfiguracoesPage() {
  redirect("/configuracoes/usuarios")
}
