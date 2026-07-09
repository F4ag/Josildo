import type { Metadata } from "next"
import { ForgotPasswordForm } from "./forgot-password-form"

export const metadata: Metadata = { title: "Recuperar senha · Lidera+" }

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-primary">Recuperar senha</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Informe o e-mail cadastrado no Lidera+.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
