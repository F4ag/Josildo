// Camada de acesso a dados de usuários do sistema (Módulo 1 / 17).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type DB = SupabaseClient<Database, "public", any>

export async function listUserProfiles(supabase: DB) {
  const { data, error } = await supabase
    .from("users_profiles")
    .select("*, leaders(name)")
    .order("created_at", { ascending: false })
  if (error) throw new Error(`Falha ao listar usuários: ${error.message}`)
  return data
}

export async function setUserStatus(supabase: DB, userId: string, status: "ativo" | "inativo") {
  const { error } = await supabase.from("users_profiles").update({ status }).eq("id", userId)
  if (error) throw new Error(`Falha ao atualizar status do usuário: ${erro