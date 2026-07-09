// Camada de acesso a dados de usuários do sistema (Módulo 1 / 17).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"
import type { UserProfile } from "@/types/domain"

type DB = SupabaseClient<Database, "public", any>

// Ver nota equivalente em services/attendances.ts sobre o cast de relações
// embutidas (leaders) por causa do schema "any" do client.
export type UserProfileWithLeader = UserProfile & {
  leaders: { name: string } | null
}

export async function listUserProfiles(supabase: DB) {
  const { data, error } = await supabase
    .from("users_profiles")
    .select("*, leaders(name)")
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Falha ao listar usuários: ${error.message}`)
  return data as unknown as UserProfileWithLeader[]
}

export async function setUserStatus(supabase: DB, userId: string, status: "ativo" | "inativo") {
  const { error } = await supabase.from("users_profiles").update({ status }).eq("id", userId)
  if (error) throw new Error(`Falha ao atualizar status do usuário: ${error.message}`)
}
