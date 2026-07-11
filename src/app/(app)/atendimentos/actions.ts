"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  createAttendance, getAttendanceById, updateAttendanceStatus, type AttendanceInput,
} from "@/services/attendances"
import { attendanceSchema, attendanceStatusUpdateSchema } from "@/lib/validations/attendance"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import type { ActionState } from "@/app/login/actions"

export async function createAttendanceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "attendances")) {
    return { error: "Seu perfil não pode registrar atendimentos." }
  }

  const parsed = attendanceSchema.safeParse({
    supporter_id: formData.get("supporter_id"),
    leader_id: formData.get("leader_id") || "",
    attendance_type: formData.get("attendance_type"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority") || "media",
    due_date: formData.get("due_date") || "",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const input: AttendanceInput = {
    ...parsed.data,
    leader_id: parsed.data.leader_id || null,
    due_date: parsed.data.due_date || null,
    responsible_user_id: session.id,
  }

  const attendance = await createAttendance(supabase, input, session.id, session.profile.organization_id)
  revalidatePath("/atendimentos")
  redirect(`/atendimentos/${attendance.id}`)
}

export async function updateAttendanceStatusAction(
  attendanceId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "update_status", "attendances")) {
    return { error: "Seu perfil não pode atualizar o status de atendimentos." }
  }

  const parsed = attendanceStatusUpdateSchema.safeParse({
    status: formData.get("status"),
    result_description: formData.get("result_description") || undefined,
    return_sent: formData.get("return_sent") === "on",
    return_channel: formData.get("return_channel") || "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const attendance = await getAttendanceById(supabase, attendanceId)
  if (!attendance) return { error: "Atendimento não encontrado." }

  await updateAttendanceStatus(
    supabase,
    { id: attendance.id, leader_id: attendance.leader_id, supporter_id: attendance.supporter_id, title: attendance.title },
    {
      status: parsed.data.status,
      resultDescription: parsed.data.result_description,
      returnSent: parsed.data.return_sent,
      returnChannel: parsed.data.return_channel || undefined,
    },
    session.id,
    session.profile.organization_id,
  )

  revalidatePath(`/atendimentos/${attendanceId}`)
  revalidatePath("/atendimentos")
  return { error: null, success: true }
}
