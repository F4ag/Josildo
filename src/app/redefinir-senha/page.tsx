import type { Metadata } from "next"
import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = { title: "Redefinir senha · Lidera+" }

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-primary">Redefinir senha</h1>
          <p className="mt-1 text-sm text-foreground/70">Escolha uma nova senha de acesso.</p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  )
}
