# Lidera+ — Arquitetura Técnica (v1)

**Sistema:** Lidera+ · **Slogan:** Mais liderança. Mais presença. Mais resultado.
**Tipo:** PWA de Gestão Política Territorial · **Banco:** Supabase (PostgreSQL)

## 1. Entendimento do projeto

O Lidera+ é um CRM territorial para campanhas e mandatos: cadastra lideranças, apoiadores e pessoas atendidas, rastreia demandas e atendimentos até a resolução, geolocaliza tudo por bairro, e mede o resultado real do trabalho político (quem foi atendido, quem resolveu, onde o território está forte ou fraco). Três perfis de acesso (admin_geral, admin_equipe, lideranca) com visibilidade de dados diferente por perfil, aplicada via Row Level Security no Postgres — não só na camada de aplicação. Este documento cobre arquitetura, estrutura de pastas e modelagem inicial do banco. O schema SQL completo está em `supabase/schema.sql` e as policies em `supabase/rls_policies.sql`; o plano de execução do MVP está em `docs/02-plano-mvp.md`.

## 2. Stack e por que essas escolhas

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | SSR/SSG para dashboards rápidos, rotas por pasta mapeiam 1:1 com as telas do prompt, suporte nativo a PWA via `next-pwa` |
| UI | Tailwind + shadcn/ui | Componentes acessíveis prontos (tabelas, modais, forms) sem framework pesado |
| Formulários | React Hook Form + Zod | Validação client+server com o mesmo schema (evita duplicar regra de negócio) |
| Gráficos | Recharts | Suficiente para os gráficos do dashboard (barras, linhas, pizza); sem custo de licença |
| Mapa | Leaflet + OpenStreetMap | Sem custo de API como o Mapbox/Google Maps teria em volume; suficiente para pins + heatmap. Migrar para Mapbox só se precisar de geocoding em massa mais preciso |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions + Realtime) | Um único serviço cobre autenticação, banco, arquivos (fotos, anexos) e RLS nativo — evita construir API própria para um MVP |
| Geolocalização | PostGIS (extensão do Postgres) | Necessário assim que o mapa de calor e "bairros descobertos" entrarem em produção; lat/lng simples resolve o MVP inicial |
| Relatórios PDF | `@react-pdf/renderer` | Gera PDF direto no client/edge function sem depender de serviço externo |
| WhatsApp/E-mail (MVP) | Link `wa.me` + `mailto:` | Zero custo de integração no MVP; migrar para WhatsApp Business API / Resend na v3 |

## 3. Arquitetura de alto nível

```
[Navegador / PWA] 
      │  (HTTPS)
      ▼
[Next.js — App Router]
   ├─ Server Components  → leitura de dados (dashboards, listagens, relatórios)
   ├─ Server Actions      → mutações (criar/editar/excluir, sempre validadas com Zod)
   ├─ Route Handlers      → geração de PDF, export CSV/XLSX, geocoding
   └─ Middleware          → checa sessão Supabase + perfil, protege rotas por role
      │
      ▼
[Supabase]
   ├─ Auth              → sessão, recuperação de senha
   ├─ Postgres + RLS     → fonte única de verdade; RLS decide o que cada perfil vê
   ├─ Storage            → fotos de lideranças, anexos de demandas/atendimentos
   ├─ Edge Functions     → jobs agendados (aniversariantes do dia, prazos vencendo, cálculo de ranking)
   └─ Realtime           → contador de notificações e status de demanda ao vivo
```

Regra de design: **nenhuma regra de visibilidade de dados vive só no frontend.** Toda restrição de perfil (liderança só vê sua rede, admin_equipe não exclui registro sensível) é replicada em RLS. O frontend esconde botões por UX, o banco garante segurança.

## 4. Módulos e limites de responsabilidade

Cada módulo do prompt master vira uma pasta de domínio em `src/app/` (rota) + `src/services/` (acesso a dados) + `src/types/` (contratos). Módulos que compartilham dado (ex.: demanda ⇄ liderança ⇄ pessoa atendida) não duplicam schema — usam foreign keys e o histórico é lido via join, nunca gravado em duas tabelas.

Vínculos obrigatórios (regras de negócio §15 do prompt):
- `attendances.supporter_id` é `not null` — todo atendimento tem pessoa.
- `demands.leader_id` e `demands.supporter_id` são opcionais mas indexados — usados para os rankings de "quem foi beneficiado".
- Toda tabela operacional tem `created_by`, `created_at`, `updated_at` (trigger automático, ver schema).

## 5. Estrutura de dashboard (aplicando padrão F4 Signal)

1. **Topo — visão executiva (5 cards):** Lideranças ativas, Apoiadores, Pessoas atendidas, Demandas resolvidas (mês), Atendimentos pendentes.
2. **Tendência, não só o número do dia:** cada card acima abre um sparkline de 30 dias — não mostrar número isolado sem comparação com período anterior.
3. **Comparação com meta/benchmark:** crescimento de 7/30/90 dias sempre lado a lado com o período anterior equivalente (não só "cresceu X", mas "X vs. Y no período anterior").
4. **Seção de alertas no topo, não no rodapé:** demandas atrasadas, atendimentos sem retorno, aniversariantes do dia — isso é o que exige ação hoje, então fica acima dos gráficos exploratórios.
5. **Gráficos exploratórios abaixo:** apoiadores por bairro, demandas por status/tipo, ranking de lideranças, mapa de calor resumido.

Isso muda ligeiramente a ordem do Módulo 2 do prompt original: alertas sobem para o topo, junto aos cards, em vez de ficarem em painel separado.

## 6. Estrutura de pastas

```
lidera-plus/
├── docs/                        # este documento, plano de MVP, decisões
├── supabase/
│   ├── schema.sql                # DDL completo (tabelas, índices, triggers)
│   └── rls_policies.sql          # políticas de Row Level Security
├── public/icons/                 # ícones do PWA (manifest)
├── src/
│   ├── app/                      # rotas (App Router) — 1 pasta por tela do §9 do prompt
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── liderancas/[id]/
│   │   ├── apoiadores/[id]/
│   │   ├── pessoas-atendidas/[id]/
│   │   ├── demandas/[id]/
│   │   ├── atendimentos/[id]/
│   │   ├── mapa/
│   │   ├── aniversariantes/
│   │   ├── agenda/
│   │   ├── relatorios/{liderancas,crescimento,demandas,atendimentos,pessoas-atendidas}/
│   │   ├── mensagens/
│   │   └── configuracoes/{usuarios,permissoes,modelos-mensagem}/
│   ├── components/
│   │   ├── ui/                   # shadcn primitives
│   │   ├── layout/                # sidebar, topbar, breadcrumbs
│   │   └── {liderancas,apoiadores,demandas,atendimentos,dashboard,mapa,relatorios,mensagens}/
│   ├── lib/
│   │   ├── supabase/              # client.ts (browser), server.ts (server actions), middleware.ts
│   │   ├── validations/           # schemas Zod por entidade
│   │   └── utils/                 # formatação, geocoding helper, cálculo de ranking
│   ├── types/                     # tipos gerados do Supabase + tipos de domínio
│   ├── hooks/                     # useAuth, usePermissions, useDebounce etc.
│   └── services/                  # camada de acesso a dados por entidade (1 arquivo por tabela)
```

O scaffold físico dessas pastas já foi criado junto com este documento.

## 7. Convenções de código

- Todo Server Action retorna `{ data, error }` tipado — nunca lança exceção não tratada para a UI.
- Todo formulário usa um schema Zod compartilhado entre client e server (`src/lib/validations/<entidade>.ts`).
- Toda tela de listagem tem estado de loading (skeleton), vazio (empty state) e erro — não usar apenas spinner genérico.
- Nomes de tabela e coluna em `snake_case` (Postgres), nomes de tipo/variável em `camelCase` (TypeScript); a camada `types/` faz a ponte.
- Toda exclusão passa por modal de confirmação; exclusões sensíveis (liderança, apoiador com histórico) exigem o role `admin_geral`.

## 8. Próximos módulos (ordem de entrega)

Ver `docs/02-plano-mvp.md` para o cronograma. Ordem que seguirei nas próximas respostas, conforme solicitado no prompt master: permissões/RLS detalhada → tipos TypeScript → layout base → autenticação → CRUDs → dashboard → relatórios → integrações → mapa → alertas → ajustes finais.
