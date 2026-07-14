// Só aparece no papel/PDF gerado pelo Ctrl+P do navegador (.print-only, ver
// globals.css) — na tela a marca já aparece na Sidebar, que some ao
// imprimir. Sem isso o relatório impresso ficava sem nenhuma logomarca.
// Plain <img> (não next/image) — mesmo padrão já usado em Sidebar/MobileNav
// pra logo, e aqui também escapa da otimização de imagem do Next (não faz
// sentido pra um asset que só existe pra impressão).
export function PrintLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-lockup.png"
      alt="Lidera+"
      className="print-only mb-4 h-10 w-auto"
    />
  )
}
