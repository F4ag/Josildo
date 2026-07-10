import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Lidera+",
  description: "Mais liderança. Mais presença. Mais resultado.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-mark.png", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS não lê o manifest.json pra "modo app" — precisa desses meta tags
  // à parte pra virar instalável/tela cheia via Safari > Compartilhar >
  // Adicionar à Tela de Início.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lidera+",
  },
}

export const viewport: Viewport = {
  themeColor: "#0B2545",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
