import type { Metadata } from "next"
import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar · Lidera+" }

// Tela de login (§10 do prompt master): "Bem-vindo ao Lidera+ / Mais
// liderança. Mais presença. Mais resultado." Sem Sidebar/Topbar — fica fora
// do grupo de rotas `(app)`.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático de public/, não precisa do otimizador do next/image */}
          <img src="/brand/logo-lockup.svg" alt="Lidera+" className="mx-auto h-14 w-auto" width={820} height={240} />
          <p className="mt-2 text-sm text-foreground/70">
            Mais liderança. Mais presença. Mais resultado.
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
