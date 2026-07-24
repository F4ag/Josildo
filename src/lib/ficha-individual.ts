// Monta os dados da "Ficha individual" (liderança ou apoiador) — usado tanto
// pela página em tela (relatorios/ficha-individual/page.tsx) quanto pela
// geração de PDF (relatorios/ficha-individual/pdf/route.tsx), a partir da
// MESMA função, pra não duplicar a lista de campos em dois lugares. Cobre
// todos os campos já cadastrados (inclusive os mais novos: Complemento,
// CPF, Nome da mãe, Zona/Seção eleitoral) — pedido explícito da Agência F4
// de ter uma ficha completa por pessoa, pra imprimir ou baixar em PDF.

import type { Leader, Supporter, LeaderType, LeaderStatus, InfluenceLevel, SupporterOrigin, UserRole } from "@/types/domain"
import {
  LEADER_TYPE_LABELS, LEADER_STATUS_LABELS, INFLUENCE_LEVEL_LABELS, SUPPORTER_ORIGIN_LABELS,
} from "@/types/domain"

export type FichaField = { label: string; value: string }
export type FichaSection = { title: string; fields: FichaField[] }
export type FichaData = {
  kind: "lideranca" | "apoiador"
  name: string
  sections: FichaSection[]
}

const EMPTY = "—"

/** "2026-07-20" -> "20/07/2026", sem passar por Date — birth_date vem sem
 * horário/fuso do banco, e new Date() nesse caso pode voltar um dia por
 * causa do fuso local (mesmo problema que os cadastros já evitam mostrando
 * o valor cru; aqui só formatamos com segurança). */
function formatDateOnly(value: string | null | undefined): string {
  if (!value) return EMPTY
  const [y, m, d] = value.split("-")
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

/** Para colunas com data+hora (created_at, consent_date) — aqui o fuso não
 * é um problema, o valor já vem com timezone. */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY
  return new Date(value).toLocaleDateString("pt-BR")
}

function yn(value: boolean | null | undefined): string {
  return value ? "Sim" : "Não"
}

function v(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return EMPTY
  return String(value)
}

export function buildLeaderFicha(
  leader: Leader,
  opts: { pollingLocationLabel: string | null; parentLeaderName: string | null; role: UserRole },
): FichaData {
  const sections: FichaSection[] = [
    {
      title: "Dados pessoais",
      fields: [
        { label: "Nome completo", value: v(leader.name) },
        { label: "Apelido / nome popular", value: v(leader.nickname) },
        { label: "WhatsApp", value: v(leader.phone) },
        { label: "E-mail", value: v(leader.email) },
        { label: "Data de nascimento", value: formatDateOnly(leader.birth_date) },
        { label: "CPF", value: v(leader.cpf) },
        { label: "Nome da mãe", value: v(leader.mother_name) },
      ],
    },
    {
      title: "Endereço",
      fields: [
        { label: "Endereço", value: v(leader.address) },
        { label: "Complemento", value: v(leader.complement) },
        { label: "Bairro", value: v(leader.neighborhood) },
        { label: "Cidade", value: v(leader.city) },
        { label: "Estado", value: v(leader.state) },
        { label: "CEP", value: v(leader.zip_code) },
      ],
    },
    {
      title: "Local de votação",
      fields: [
        { label: "Local de votação", value: v(opts.pollingLocationLabel) },
        { label: "Zona eleitoral", value: v(leader.electoral_zone) },
        { label: "Seção eleitoral", value: v(leader.electoral_section) },
      ],
    },
    {
      title: "Perfil de liderança",
      fields: [
        { label: "Tipo de liderança", value: leader.leader_type ? LEADER_TYPE_LABELS[leader.leader_type as LeaderType] : EMPTY },
        { label: "Nível de influência", value: leader.influence_level ? INFLUENCE_LEVEL_LABELS[leader.influence_level as InfluenceLevel] : EMPTY },
        { label: "Status", value: LEADER_STATUS_LABELS[leader.status as LeaderStatus] ?? leader.status },
        { label: "Expectativa de votos", value: v(leader.expected_votes) },
        // Avaliação do admin: campo admin-only em todo o resto do sistema
        // (ver leaders/[id]/page.tsx) — mesma regra aqui, só admin_geral vê.
        ...(opts.role === "admin_geral"
          ? [{ label: "Expectativa de votos (avaliação do admin)", value: v(leader.admin_estimated_votes) }]
          : []),
        { label: "Pode ver atendimentos da rede?", value: yn(leader.can_view_attendances) },
        { label: "Cadastrada por", value: v(opts.parentLeaderName) },
      ],
    },
  ]

  if (leader.notes) {
    sections.push({ title: "Observações", fields: [{ label: "Observações", value: leader.notes }] })
  }

  sections.push({
    title: "Cadastro",
    fields: [{ label: "Cadastrado em", value: formatDateTime(leader.created_at) }],
  })

  return { kind: "lideranca", name: leader.name, sections }
}

export function buildSupporterFicha(
  supporter: Supporter,
  opts: { pollingLocationLabel: string | null; leaderName: string | null },
): FichaData {
  const sections: FichaSection[] = [
    {
      title: "Dados pessoais",
      fields: [
        { label: "Nome completo", value: v(supporter.name) },
        { label: "WhatsApp", value: v(supporter.phone) },
        { label: "E-mail", value: v(supporter.email) },
        { label: "Data de nascimento", value: formatDateOnly(supporter.birth_date) },
        { label: "CPF", value: v(supporter.cpf) },
        { label: "Nome da mãe", value: v(supporter.mother_name) },
        { label: "Gênero", value: v(supporter.gender) },
        { label: "Profissão", value: v(supporter.profession) },
      ],
    },
    {
      title: "Endereço",
      fields: [
        { label: "Endereço", value: v(supporter.address) },
        { label: "Complemento", value: v(supporter.complement) },
        { label: "Bairro", value: v(supporter.neighborhood) },
        { label: "Cidade", value: v(supporter.city) },
        { label: "Estado", value: v(supporter.state) },
        { label: "CEP", value: v(supporter.zip_code) },
      ],
    },
    {
      title: "Local de votação",
      fields: [
        { label: "Local de votação", value: v(opts.pollingLocationLabel) },
        { label: "Zona eleitoral", value: v(supporter.electoral_zone) },
        { label: "Seção eleitoral", value: v(supporter.electoral_section) },
      ],
    },
    {
      title: "Vínculo",
      fields: [
        { label: "Liderança responsável", value: v(opts.leaderName) },
        { label: "Origem do cadastro", value: supporter.origin ? SUPPORTER_ORIGIN_LABELS[supporter.origin as SupporterOrigin] : EMPTY },
      ],
    },
    {
      title: "Consentimentos (LGPD)",
      fields: [
        { label: "Consentimento WhatsApp", value: yn(supporter.consent_whatsapp) },
        { label: "Consentimento e-mail", value: yn(supporter.consent_email) },
        { label: "Consentimento de cadastro", value: yn(supporter.consent_registration) },
        { label: "Data do consentimento", value: formatDateTime(supporter.consent_date) },
      ],
    },
  ]

  if (supporter.notes) {
    sections.push({ title: "Observações", fields: [{ label: "Observações", value: supporter.notes }] })
  }

  sections.push({
    title: "Cadastro",
    fields: [{ label: "Cadastrado em", value: formatDateTime(supporter.created_at) }],
  })

  return { kind: "apoiador", name: supporter.name, sections }
}
