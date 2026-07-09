"use server"

import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications"

// Sem revalidatePath aqui de propósito: o sino aparece em toda rota
// autenticada (é renderizado pelo layout de `(app)`), então não existe "o"
// path certo para revalidar. Quem chama essas actions (Topbar) já dá um
// router.refresh() na sequência, que atualiza os Server Components da rota
// atual — inclusive o layout.
export async function markNotificationReadAction(id: string) {
  const session = await requireSessionUser()
  const supabase = await createClient()
  await markNotificationRead(supabase, id, session.id)
}

export async function markAllNotificationsReadAction() {
  const session = await requireSessionUser()
  const supabase = await createClient()
  await markAllNotificationsRead(supabase, session.id)
}
