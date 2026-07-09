// Helpers de sessão para Server Components e Server Actions.
// Client Components devem usar o hook `useAuth` (src/hooks/useAuth.ts).

import { createClient } from "@/lib/supabase/server"
import type { UserProfile } from "@/types/domain"

export type SessionUser = {
  id: string
  email: string | null
  profile: UserProfile
}

/**
 * Retorna o usuário logado + seu perfil (role, status, leader_id).
 * Retorna `null` se não houver sessão — o middleware já garante que isso só
 * acontece em rotas públicas, mas cada Server Component sensível deve
 * checar mesmo assim antes de renderizar dado.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error } = await supabase
    .from("users_profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !profile) return null

  return { id: user.id, email: user.email ?? null, profile }
}

/** Lança se não houver sessão — use em Server Actions que exigem login. */
export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getSessionUser()
  if (!session) {
    throw new Error("Sessão não encontrada. Faça login novamente.")
  }
  return session
}
