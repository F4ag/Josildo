"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { logInteraction } from "@/services/interactions"

export async function markGreeted(supporterId: string, leaderId: string | null) {
  const session = await requireSessionUser()
  const supabase = await createClient()

  await logInteraction(supabase, {
    supporterId,
    leaderId,
    type: "aniversario",
    description: "Aniversariante cumprimentado.",
    createdBy: session.id,
  })

  revalidatePath("/aniversariantes")
}
