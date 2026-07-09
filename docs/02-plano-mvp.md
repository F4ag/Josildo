# Lidera+ — Plano de Desenvolvimento do MVP

Este plano cobre só o escopo do §12 do prompt master (MVP). Versão 2 e 3 ficam para depois do MVP validado em campo. Cada etapa assume que a anterior está funcional — não é uma lista de tarefas paralelas.

## Etapa 0 — Infraestrutura (concluída nesta sessão)

- Projeto Supabase **lidera+** criado na organização Agencia F4, região `sa-east-1` (São Paulo).
- Schema completo aplicado (12 tabelas, índices, triggers de `updated_at`, 4 modelos de mensagem semeados).
- RLS aplicada e testada nos 3 perfis (`admin_geral`, `admin_equipe`, `lideranca`).
- Auditoria de segurança e performance rodada via `get_advisors`: 0 avisos de segurança; avisos de performance resolvidos exceto os aceitáveis para este estágio (ver nota no fim de `supabase/rls_policies.sql`).

## Etapa 1 — Autenticação e esqueleto do app

- Configurar projeto Next.js (App Router, TypeScript, Tailwind, shadcn/ui) na estrutura já escafoldada.
- Cliente Supabase (browser + server) e middleware de sessão.
- Tela `/login`, recuperação de senha, logout.
- Middleware de proteção de rota por `role` (redirecionamento: `lideranca` nunca cai em `/configuracoes`).
- Tela de cadastro de usuário pelo Admin Geral (`/configuracoes/usuarios`), já gravando `role` e, se `lideranca`, vinculando a um `leader_id` existente.
- **Critério de pronto:** os 3 perfis conseguem logar e cada um só enxerga o menu lateral compatível com seu papel.

## Etapa 2 — Lideranças e Apoiadores (CRUD base)

- CRUD completo de `leaders` com filtros (bairro, tipo, status, influência).
- CRUD completo de `supporters`, com os 4 campos obrigatórios (nome, endereço, WhatsApp, nascimento) validados via Zod.
- Detector de duplicidade básico (nome+nascimento, nome+endereço, telefone) no submit do formulário de apoiador.
- Botão WhatsApp (`wa.me`) no cadastro de ambos.
- **Critério de pronto:** uma liderança logada só vê/edita sua própria rede; admin_equipe cadastra em nome de qualquer liderança.

## Etapa 3 — Demandas e Atendimentos

- CRUD de `demands` com vínculo opcional a `leader_id`/`supporter_id`, histórico em `demand_updates` a cada mudança de status.
- CRUD de `attendances`, sempre vinculado a um `supporter_id` (regra de negócio §15.4).
- Tela de detalhe da "pessoa atendida" (`/pessoas-atendidas/[id]`) com abas: dados, demandas, atendimentos, interações — todas via `join`, sem tabela própria.
- **Critério de pronto:** resolver uma demanda ou concluir um atendimento aparece automaticamente no histórico da pessoa e da liderança vinculada, sem sincronização manual.

## Etapa 4 — Dashboard básico

- Cards executivos (§5 da arquitetura): lideranças, apoiadores, pessoas atendidas, demandas resolvidas, atendimentos pendentes.
- Alertas no topo: demandas atrasadas, aniversariantes do dia.
- Um gráfico por enquanto: apoiadores por bairro (Recharts).
- **Critério de pronto:** dashboard carrega em menos de 2s com dado real de teste (mesmo que poucos registros).

## Etapa 5 — Relatórios essenciais + exportação

- Relatório "Lideranças por bairro" e "Pessoas atendidas" (os dois citados no MVP do prompt master).
- Exportação PDF (`@react-pdf/renderer`) e impressão via CSS print.
- **Critério de pronto:** os dois relatórios batem com os números manuais de uma planilha de conferência.

## Etapa 6 — Aniversariantes e alertas

- Tela `/aniversariantes` com filtro hoje/semana/mês.
- Botão WhatsApp com o template de aniversário já semeado no banco (`message_templates`).
- Alertas de demanda/atendimento vencendo — via Edge Function agendada (cron diário) que popula `notifications`.
- **Critério de pronto:** rodar a Edge Function manualmente gera notificação correta para um caso de teste com prazo vencido.

## Etapa 7 — Mapa territorial simples

- Leaflet + OpenStreetMap, pins de lideranças e demandas coloridos por status.
- Filtro por bairro.
- **Critério de pronto:** clicar num pin abre o cadastro correspondente.

## Etapa 8 — Fechamento do MVP (concluída — ver `docs/06-fechamento-mvp.md`)

- Revisão de permissões ponta a ponta (repetir os testes da Etapa 1 com dados reais de todos os módulos). **Feito com teste funcional real** (3 usuários simulados via RLS, não só leitura de código) — encontrou e corrigiu 2 bugs reais (função RLS quebrada para o perfil `lideranca`; middleware bloqueando a logo na tela de login).
- Checklist de LGPD: consentimento obrigatório antes de qualquer envio de mensagem. **Feito** — encontrou e corrigiu 1 gap real (`consent_whatsapp` nunca era checado antes de mostrar o botão de WhatsApp para um apoiador). Detalhe em `docs/04-checklist-lgpd.md`.
- Deploy (Vercel + Supabase produção) e PWA instalável testado em Android/iOS. **Documentado em `docs/05-deploy.md`, não executado** — este ambiente não tem acesso à conta Vercel da agência; deploy e teste de instalação em aparelho físico são o próximo passo humano.
- Logo oficial do cliente aplicada (recriada em SVG — ver `docs/06-fechamento-mvp.md` §1) e PWA configurado (`next-pwa` + `manifest.json` + ícones).

## Fora do MVP (v2/v3)

Import de planilha com detecção de duplicidade avançada, ranking de lideranças, mapa de calor, agenda completa, WhatsApp Business API, push notification — ficam para depois que o MVP estiver em uso real por pelo menos um ciclo de campanha/mandato. Construir isso antes arrisca otimizar para um uso qu