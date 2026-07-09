// ============================================================================
// Matriz de permissões do Lidera+ (Módulo 1 do prompt master).
//
// ATENÇÃO: isto é uma camada de UX (esconder botão, desabilitar campo,
// redirecionar rota) — NÃO é a barreira de segurança. A barreira real é a
// RLS em supabase/rls_policies.sql, que é reavaliada pelo Postgres a cada
// query independente do que o frontend decidiu mostrar. Se as duas
// divergirem, corrija aqui para bater com o banco, nunca o contrário.
// ============================================================================

import type { UserRole } from "@/types/domain"

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "update_status"
  | "generate_reports"
  | "send_messages"
  | "manage_users"
  | "system_settings"
  | "export_data"

export type PermissionResource =
  | "leaders"
  | "supporters"
  | "demands"
  | "attendances"
  | "agenda_events"
  | "message_templates"
  | "neighborhoods"
  | "users"

type ResourceMatrix = Record<PermissionResource, Partial<Record<PermissionAction, boolean>>>

const ADMIN_GERAL: ResourceMatrix = {
  leaders: { create: true, read: true, update: true, delete: true },
  supporters: { create: true, read: true, update: true, delete: true },
  demands: { create: true, read: true, update: true, delete: true, update_status: true },
  attendances: { create: true, read: true, update: true, delete: true, update_status: true },
  agenda_events: { create: true, read: true, update: true, delete: true },
  message_templates: { create: true, read: true, update: true, delete: true },
  neighborhoods: { create: true, read: true, update: true, delete: true },
  users: { create: true, read: true, update: true, delete: true, manage_users: true },
}

// admin_equipe: tudo que admin_geral faz, MENOS excluir registro sensível,
// gerenciar usuários e configurações avançadas (Módulo 4.2 do prompt master).
const ADMIN_EQUIPE: ResourceMatrix = {
  leaders: { create: true, read: true, update: true, delete: false },
  supporters: { create: true, read: true, update: true, delete: false },
  demands: { create: true, read: true, update: true, delete: false, update_status: true },
  attendances: { create: true, read: true, update: true, delete: false, update_status: true },
  agenda_events: { create: true, read: true, update: true, delete: false },
  message_templates: { create: false, read: true, update: false, delete: false },
  neighborhoods: { create: false, read: true, update: false, delete: false },
  users: { create: false, read: false, update: false, delete: false, manage_users: false },
}

// lideranca: só a própria rede (o "read: true" aqui é o teto — a RLS ainda
// filtra por leader_id; ver is_own_supporter() em rls_policies.sql).
const LIDERANCA: ResourceMatrix = {
  leaders: { create: false, read: true, update: true /* só o próprio cadastro */, delete: false },
  supporters: { create: true, read: true, update: true, delete: false },
  demands: { create: true, read: true, update: false, delete: false, update_status: false },
  attendances: { create: false, read: true /* só se can_view_attendances */, update: false, delete: false },
  agenda_events: { create: true, read: true, update: false, delete: false },
  message_templates: { create: false, read: true, update: false, delete: false },
  neighborhoods: { create: false, read: true, update: false, delete: false },
  users: { create: false, read: false, update: false, delete: false, manage_users: false },
}

const MATRIX: Record<UserRole, ResourceMatrix> = {
  admin_geral: ADMIN_GERAL,
  admin_equipe: ADMIN_EQUIPE,
  lideranca: LIDERANCA,
}

// Permissões que não são por-recurso (globais do perfil)
const GLOBAL_PERMISSIONS: Record<UserRole, Partial<Record<PermissionAction, boolean>>> = {
  admin_geral: {
    generate_reports: true, send_messages: true, manage_users: true,
    system_settings: true, export_data: true,
  },
  admin_equipe: {
    generate_reports: true, send_messages: true, manage_users: false,
    system_settings: false, export_data: true,
  },
  lideranca: {
    generate_reports: false, send_messages: false, manage_users: false,
    system_settings: false, export_data: false,
  },
}

export function can(
  role: UserRole,
  action: PermissionAction,
  resource?: PermissionResource,
): boolean {
  if (resource) {
    return Boolean(MATRIX[role][resource]?.[action])
  }
  return Boolean(GLOBAL_PERMISSIONS[role][action])
}

/** Rotas que só admin_geral e admin_equipe podem abrir. */
export const ADMIN_ONLY_ROUTE_PREFIXES = ["/configuracoes", "/relatorios", "/mensagens"] as const

/** Rotas fora do alcance de admin_equipe (só admin_geral). */
export const ADMIN_GERAL_ONLY_ROUTE_PREFIXES = [
  "/configuracoes/usuarios",
  "/configuracoes/permissoes",
] as const

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (ADMIN_GERAL_ONLY_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return role === "admin_geral"
  }
  if (ADMIN_ONLY_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return role === "admin_geral" || role === "admin_equipe"
  }
  return true
}
