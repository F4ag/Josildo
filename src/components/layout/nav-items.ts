// Itens do menu lateral (§10 do prompt master), na ordem especificada.
// `href` é checado contra canAccessRoute() no momento de renderizar — ver
// sidebar.tsx. Manter esta lista como única fonte de verdade evita que o
// menu e o middleware divirjam sobre quem pode ver o quê.

import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Users, UserPlus, HeartHandshake, ClipboardList,
  Stethoscope, Map, Cake, CalendarDays, FileBarChart, MessageCircle, Settings,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/liderancas", label: "Lideranças", icon: Users },
  { href: "/apoiadores", label: "Apoiadores", icon: UserPlus },
  { href: "/pessoas-atendidas", label: "Pessoas Atendidas", icon: HeartHandshake },
  { href: "/demandas", label: "Demandas", icon: ClipboardList },
  { href: "/atendimentos", label: "Atendimentos", icon: Stethoscope },
  { href: "/mapa", label: "Mapa Territorial", icon: Map },
  { href: "/aniversariantes", label: "Aniversariantes", icon: Cake },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]
