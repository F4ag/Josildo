// ============================================================================
// Tipos de domínio do Lidera+.
// As tabelas do banco guardam os códigos (snake_case, minúsculo) definidos
// nos CHECK constraints de supabase/schema.sql. Este arquivo é a ÚNICA fonte
// de verdade para os rótulos em PT-BR exibidos na UI — nunca hardcode um
// rótulo de status/tipo direto num componente.
// ============================================================================

import type { Tables } from "./database.types"
import type { BadgeTone } from "@/components/ui/badge"

export type UserRole = "admin_geral" | "admin_equipe" | "lideranca"

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin_geral: "Admin Geral",
  admin_equipe: "Admin de Equipe",
  lideranca: "Liderança",
}

// ----------------------------------------------------------------------------
// Lideranças (Módulo 3)
// ----------------------------------------------------------------------------
export const LEADER_TYPES = [
  "comunitaria", "religiosa", "esportiva", "empresarial", "sindical",
  "estudantil", "saude", "educacao", "seguranca", "cultura", "juventude",
  "mulher", "idoso", "rural", "digital_influenciador", "outra",
] as const
export type LeaderType = (typeof LEADER_TYPES)[number]

export const LEADER_TYPE_LABELS: Record<LeaderType, string> = {
  comunitaria: "Comunitária",
  religiosa: "Religiosa",
  esportiva: "Esportiva",
  empresarial: "Empresarial",
  sindical: "Sindical",
  estudantil: "Estudantil",
  saude: "Saúde",
  educacao: "Educação",
  seguranca: "Segurança",
  cultura: "Cultura",
  juventude: "Juventude",
  mulher: "Mulher",
  idoso: "Idoso",
  rural: "Rural",
  digital_influenciador: "Digital/Influenciador",
  outra: "Outra",
}

export const INFLUENCE_LEVELS = ["baixo", "medio", "alto", "estrategico"] as const
export type InfluenceLevel = (typeof INFLUENCE_LEVELS)[number]
export const INFLUENCE_LEVEL_LABELS: Record<InfluenceLevel, string> = {
  baixo: "Baixo", medio: "Médio", alto: "Alto", estrategico: "Estratégico",
}

export const LEADER_STATUSES = ["ativa", "em_atencao", "inativa", "estrategica"] as const
export type LeaderStatus = (typeof LEADER_STATUSES)[number]
export const LEADER_STATUS_LABELS: Record<LeaderStatus, string> = {
  ativa: "Ativa", em_atencao: "Em atenção", inativa: "Inativa", estrategica: "Estratégica",
}
// Cor sugerida no mapa territorial (Módulo 8)
export const LEADER_STATUS_COLOR: Record<LeaderStatus, BadgeTone> = {
  ativa: "verde", em_atencao: "amarelo", inativa: "vermelho", estrategica: "azul",
}

// ----------------------------------------------------------------------------
// Apoiadores (Módulo 4)
// ----------------------------------------------------------------------------
export const SUPPORTER_ORIGINS = [
  "lideranca", "evento", "visita", "reuniao", "whatsapp", "formulario_online",
  "mutirao", "gabinete", "rua", "indicacao", "outro",
] as const
export type SupporterOrigin = (typeof SUPPORTER_ORIGINS)[number]
export const SUPPORTER_ORIGIN_LABELS: Record<SupporterOrigin, string> = {
  lideranca: "Liderança", evento: "Evento", visita: "Visita", reuniao: "Reunião",
  whatsapp: "WhatsApp", formulario_online: "Formulário online", mutirao: "Mutirão",
  gabinete: "Gabinete", rua: "Rua", indicacao: "Indicação", outro: "Outro",
}

// ----------------------------------------------------------------------------
// Demandas (Módulo 6)
// ----------------------------------------------------------------------------
export const DEMAND_TYPES = [
  "capinacao", "iluminacao_publica", "tapa_buraco", "limpeza_urbana", "saude",
  "educacao", "transporte", "seguranca", "assistencia_social", "esporte",
  "cultura", "regularizacao", "saneamento", "agua", "energia", "documento",
  "atendimento_individual", "outra",
] as const
export type DemandType = (typeof DEMAND_TYPES)[number]
export const DEMAND_TYPE_LABELS: Record<DemandType, string> = {
  capinacao: "Capinação", iluminacao_publica: "Iluminação pública", tapa_buraco: "Tapa-buraco",
  limpeza_urbana: "Limpeza urbana", saude: "Saúde", educacao: "Educação", transporte: "Transporte",
  seguranca: "Segurança", assistencia_social: "Assistência social", esporte: "Esporte",
  cultura: "Cultura", regularizacao: "Regularização", saneamento: "Saneamento", agua: "Água",
  energia: "Energia", documento: "Documento", atendimento_individual: "Atendimento individual",
  outra: "Outra",
}

export const DEMAND_STATUSES = [
  "nova", "em_analise", "encaminhada", "em_andamento", "aguardando_orgao_responsavel",
  "resolvida", "recusada", "cancelada", "atrasada",
] as const
export type DemandStatus = (typeof DEMAND_STATUSES)[number]
export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  nova: "Nova", em_analise: "Em análise", encaminhada: "Encaminhada",
  em_andamento: "Em andamento", aguardando_orgao_responsavel: "Aguardando órgão responsável",
  resolvida: "Resolvida", recusada: "Recusada", cancelada: "Cancelada", atrasada: "Atrasada",
}
// Cor sugerida no mapa territorial (Módulo 8)
export const DEMAND_STATUS_COLOR: Record<DemandStatus, BadgeTone> = {
  nova: "cinza", em_analise: "cinza", encaminhada: "cinza", em_andamento: "laranja",
  aguardando_orgao_responsavel: "laranja", resolvida: "verde", recusada: "vermelho",
  cancelada: "vermelho", atrasada: "vermelho",
}

export const PRIORITIES = ["baixa", "media", "alta", "urgente"] as const
export type Priority = (typeof PRIORITIES)[number]
export const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente",
}

// ----------------------------------------------------------------------------
// Atendimentos (Módulo 7)
// ----------------------------------------------------------------------------
export const ATTENDANCE_TYPES = [
  "consulta_medica", "pedido_exame", "documento", "encaminhamento_social",
  "reuniao", "orientacao", "transporte", "cesta_basica", "habitacao",
  "emprego", "atendimento_juridico", "outro",
] as const
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number]
export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  consulta_medica: "Consulta médica", pedido_exame: "Pedido de exame", documento: "Documento",
  encaminhamento_social: "Encaminhamento social", reuniao: "Reunião", orientacao: "Orientação",
  transporte: "Transporte", cesta_basica: "Cesta básica", habitacao: "Habitação",
  emprego: "Emprego", atendimento_juridico: "Atendimento jurídico/orientação", outro: "Outro",
}

export const ATTENDANCE_STATUSES = [
  "novo", "em_analise", "em_andamento", "aguardando_documento",
  "aguardando_orgao_publico", "atendido", "nao_atendido", "cancelado", "arquivado",
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  novo: "Novo", em_analise: "Em análise", em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento", aguardando_orgao_publico: "Aguardando órgão público",
  atendido: "Atendido", nao_atendido: "Não atendido", cancelado: "Cancelado", arquivado: "Arquivado",
}

// ----------------------------------------------------------------------------
// Interações (Módulo 14) / Notificações (Módulo 10) / Agenda (Módulo 13) /
// Modelos de mensagem (Módulo 12)
// ----------------------------------------------------------------------------
export const INTERACTION_TYPES = [
  "ligacao", "whatsapp", "email", "visita", "reuniao", "evento",
  "demanda", "atendimento", "aniversario", "outro",
] as const
export type InteractionType = (typeof INTERACTION_TYPES)[number]
export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  ligacao: "Ligação", whatsapp: "WhatsApp", email: "E-mail", visita: "Visita",
  reuniao: "Reunião", evento: "Evento", demanda: "Demanda", atendimento: "Atendimento",
  aniversario: "Aniversário", outro: "Outro",
}

export const AGENDA_STATUSES = ["agendado", "realizado", "cancelado", "remarcado", "pendente"] as const
export type AgendaStatus = (typeof AGENDA_STATUSES)[number]
export const AGENDA_STATUS_LABELS: Record<AgendaStatus, string> = {
  agendado: "Agendado", realizado: "Realizado", cancelado: "Cancelado",
  remarcado: "Remarcado", pendente: "Pendente",
}
export const AGENDA_STATUS_COLOR: Record<AgendaStatus, BadgeTone> = {
  agendado: "azul", realizado: "verde", cancelado: "vermelho",
  remarcado: "amarelo", pendente: "cinza",
}

export const MESSAGE_TEMPLATE_TYPES = [
  "aniversario", "retorno_demanda", "demanda_resolvida", "atendimento_concluido",
  "convite_reuniao", "agradecimento", "atualizacao_cadastral", "outro",
] as const
export type MessageTemplateType = (typeof MESSAGE_TEMPLATE_TYPES)[number]
export const MESSAGE_TEMPLATE_TYPE_LABELS: Record<MessageTemplateType, string> = {
  aniversario: "Aniversário", retorno_demanda: "Retorno de demanda",
  demanda_resolvida: "Demanda resolvida", atendimento_concluido: "Atendimento concluído",
  convite_reuniao: "Convite para reunião", agradecimento: "Agradecimento",
  atualizacao_cadastral: "Atualização cadastral", outro: "Outro",
}

export const NEIGHBORHOOD_CLASSIFICATIONS = ["forte", "medio", "fraco", "descoberto"] as const
export type NeighborhoodClassification = (typeof NEIGHBORHOOD_CLASSIFICATIONS)[number]
export const NEIGHBORHOOD_CLASSIFICATION_LABELS: Record<NeighborhoodClassification, string> = {
  forte: "Forte", medio: "Médio", fraco: "Fraco", descoberto: "Descoberto",
}

// ----------------------------------------------------------------------------
// Aliases de linha de tabela (nomes de domínio em vez do nome cru da tabela)
// ----------------------------------------------------------------------------
export type UserProfile = Tables<"users_profiles">
export type Leader = Tables<"leaders">
export type Supporter = Tables<"supporters">
export type Demand = Tables<"demands">
export type DemandUpdate = Tables<"demand_updates">
export type Attendance = Tables<"attendances">
export type Interaction = Tables<"interactions">
export type AgendaEvent = Tables<"agenda_events">
export type MessageTemplate = Tables<"message_templates">
export type Neighborhood = Tables<"neighborhoods">
export type Notification = Tables<"notifications">

/**
 * "Pessoa atendida" (Módulo 5) não é uma tabela própria — é um Supporter que
 * tem >=1 Demand ou Attendance. Esta view compõe o que a tela de detalhe
 * (`/pessoas-atendidas/[id]`) precisa, montada no service layer via joins.
 */
export type PessoaAtendida = Supporter & {
  demandas: Demand[]
  atendimentos: Attendance[]
  interacoes: Interaction[]
  liderancaVinculada: Leader | null
}
