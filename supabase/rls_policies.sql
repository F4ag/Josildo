-- ============================================================================
-- LIDERA+ — Row Level Security
-- Pré-requisito: supabase/schema.sql já aplicado.
--
-- Princípio: RLS decide QUAIS LINHAS cada perfil vê/altera. Restrição de
-- CAMPO (ex.: admin_equipe não pode editar o campo influence_level de uma
-- liderança estratégica) fica a cargo dos Server Actions — Postgres RLS não
-- tem granularidade de coluna por padrão. Onde isso importa, deixei uma nota.
--
-- Este arquivo já reflete o estado real aplicado no projeto Supabase
-- "lidera+" (migrations 002 a 005), incluindo duas correções feitas depois
-- da primeira versão, a partir do `get_advisors`:
--   1) as funções helper SECURITY DEFINER moram no schema `private` (não
--      exposto pelo PostgREST), não em `public` — evita que fiquem
--      acessíveis como endpoint HTTP em /rest/v1/rpc/<nome>.
--   2) chamadas a auth.uid()/auth.role() dentro de USING/WITH CHECK são
--      envolvidas em `(select ...)` para o planner resolver uma vez por
--      statement em vez de uma vez por linha (aviso "auth_rls_initplan").
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Funções auxiliares
-- IMPORTANTE: authenticated/anon precisam de USAGE no schema "private" e
-- EXECUTE nessas funções — sem isso toda query nas tabelas com RLS falha
-- com "permission denied for schema private" (GRANTs no fim do arquivo).
-- ----------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.current_user_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from users_profiles where id = auth.uid();
$$;

create or replace function private.current_user_leader_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select leader_id from users_profiles where id = auth.uid() and role = 'lideranca';
$$;

create or replace function private.current_leader_can_view_attendances()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(can_view_attendances, false)
  from leaders
  where id = private.current_user_leader_id();
$$;

-- Visibilidade de um supporter para a liderança logada (dono direto).
-- Não é SECURITY DEFINER (não lê tabela sensível diretamente), então pode
-- ficar em "public" sem risco — search_path fixo fecha o aviso do linter
-- "function_search_path_mutable".
create or replace function is_own_supporter(p_leader_id uuid)
returns boolean
language sql stable
set search_path = public
as $$
  select p_leader_id is not null and p_leader_id = private.current_user_leader_id();
$$;

-- ============================================================================
-- users_profiles
-- ============================================================================
alter table users_profiles enable row level security;

create policy up_admin_geral_all on users_profiles
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy up_self_select on users_profiles
  for select using (id = (select auth.uid()));

create policy up_self_update on users_profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid())); -- app deve impedir troca do próprio "role" via Server Action

create policy up_admin_equipe_select_all on users_profiles
  for select using (private.current_user_role() = 'admin_equipe');

-- ============================================================================
-- neighborhoods — leitura liberada para todo usuário autenticado, escrita só admin_geral
-- ============================================================================
alter table neighborhoods enable row level security;

create policy nb_select_all on neighborhoods
  for select using ((select auth.role()) = 'authenticated');

create policy nb_admin_geral_write on neighborhoods
  for insert with check (private.current_user_role() = 'admin_geral');

create policy nb_admin_geral_update on neighborhoods
  for update using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy nb_admin_geral_delete on neighborhoods
  for delete using (private.current_user_role() = 'admin_geral');

-- ============================================================================
-- leaders
-- ============================================================================
alter table leaders enable row level security;

create policy ld_admin_geral_all on leaders
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy ld_admin_equipe_select on leaders
  for select using (private.current_user_role() = 'admin_equipe');

create policy ld_admin_equipe_insert on leaders
  for insert with check (private.current_user_role() = 'admin_equipe');

create policy ld_admin_equipe_update on leaders
  for update using (private.current_user_role() = 'admin_equipe')
  with check (private.current_user_role() = 'admin_equipe');
  -- Exclusão de liderança é ação sensível: reservada a admin_geral (só a policy _all cobre delete).

create policy ld_lideranca_select_self on leaders
  for select using (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id());

create policy ld_lideranca_update_self on leaders
  for update using (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id())
  with check (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id());
  -- App deve restringir quais campos a liderança pode alterar no próprio cadastro
  -- (ex.: não pode mudar influence_level ou status para "estrategica").

-- ============================================================================
-- supporters
-- ============================================================================
alter table supporters enable row level security;

create policy sp_admin_geral_all on supporters
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy sp_admin_equipe_select on supporters
  for select using (private.current_user_role() = 'admin_equipe');

create policy sp_admin_equipe_insert on supporters
  for insert with check (private.current_user_role() = 'admin_equipe');

create policy sp_admin_equipe_update on supporters
  for update using (private.current_user_role() = 'admin_equipe')
  with check (private.current_user_role() = 'admin_equipe');

create policy sp_lideranca_select_own_network on supporters
  for select using (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id));

create policy sp_lideranca_insert_own_network on supporters
  for insert with check (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id));

create policy sp_lideranca_update_own_network on supporters
  for update using (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id))
  with check (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id));

-- ============================================================================
-- demands
-- ============================================================================
alter table demands enable row level security;

create policy dm_admin_geral_all on demands
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy dm_admin_equipe_select on demands
  for select using (private.current_user_role() = 'admin_equipe');

create policy dm_admin_equipe_insert on demands
  for insert with check (private.current_user_role() = 'admin_equipe');

create policy dm_admin_equipe_update on demands
  for update using (private.current_user_role() = 'admin_equipe')
  with check (private.current_user_role() = 'admin_equipe');
  -- admin_equipe pode atualizar status (Módulo 4.2) mas não excluir — delete só admin_geral.

create policy dm_lideranca_select_own on demands
  for select using (
    private.current_user_role() = 'lideranca'
    and (
      is_own_supporter(leader_id)
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

create policy dm_lideranca_insert_own on demands
  for insert with check (
    private.current_user_role() = 'lideranca' and is_own_supporter(leader_id)
  );

-- ============================================================================
-- demand_updates — herda visibilidade da demanda relacionada
-- ============================================================================
alter table demand_updates enable row level security;

create policy du_admin_all on demand_updates
  for all using (private.current_user_role() in ('admin_geral','admin_equipe'))
  with check (private.current_user_role() in ('admin_geral','admin_equipe'));

create policy du_lideranca_select on demand_updates
  for select using (
    private.current_user_role() = 'lideranca'
    and demand_id in (select id from demands) -- já filtrado pela RLS de demands
  );

create policy du_lideranca_insert_comment on demand_updates
  for insert with check (
    private.current_user_role() = 'lideranca'
    and demand_id in (select id from demands)
  );

-- ============================================================================
-- attendances — Módulo 4.3: liderança só vê se autorizada (can_view_attendances)
-- ============================================================================
alter table attendances enable row level security;

create policy at_admin_geral_all on attendances
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy at_admin_equipe_select on attendances
  for select using (private.current_user_role() = 'admin_equipe');

create policy at_admin_equipe_insert on attendances
  for insert with check (private.current_user_role() = 'admin_equipe');

create policy at_admin_equipe_update on attendances
  for update using (private.current_user_role() = 'admin_equipe')
  with check (private.current_user_role() = 'admin_equipe');

create policy at_lideranca_select_authorized on attendances
  for select using (
    private.current_user_role() = 'lideranca'
    and private.current_leader_can_view_attendances()
    and supporter_id in (select id from supporters where is_own_supporter(leader_id))
  );

-- ============================================================================
-- interactions
-- ============================================================================
alter table interactions enable row level security;

create policy it_admin_all on interactions
  for all using (private.current_user_role() in ('admin_geral','admin_equipe'))
  with check (private.current_user_role() in ('admin_geral','admin_equipe'));

create policy it_lideranca_select_own on interactions
  for select using (
    private.current_user_role() = 'lideranca'
    and (
      leader_id = private.current_user_leader_id()
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

create policy it_lideranca_insert_own on interactions
  for insert with check (
    private.current_user_role() = 'lideranca'
    and (
      leader_id = private.current_user_leader_id()
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

-- ============================================================================
-- attachments — visibilidade herdada do registro relacionado
-- ============================================================================
alter table attachments enable row level security;

create or replace function private.can_access_related_record(p_related_table text, p_related_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
begin
  if private.current_user_role() in ('admin_geral','admin_equipe') then
    return true;
  end if;

  if p_related_table = 'leaders' then
    return exists (select 1 from leaders where id = p_related_id and id = private.current_user_leader_id());
  elsif p_related_table = 'supporters' then
    return exists (select 1 from supporters where id = p_related_id and is_own_supporter(leader_id));
  elsif p_related_table = 'demands' then
    return exists (
      select 1 from demands
      where id = p_related_id
        and (is_own_supporter(leader_id)
             or supporter_id in (select id from supporters where is_own_supporter(leader_id)))
    );
  elsif p_related_table = 'attendances' then
    return private.current_leader_can_view_attendances() and exists (
      select 1 from attendances a
      join supporters s on s.id = a.supporter_id
      where a.id = p_related_id and is_own_supporter(s.leader_id)
    );
  elsif p_related_table = 'agenda_events' then
    return exists (select 1 from agenda_events where id = p_related_id and leader_id = private.current_user_leader_id());
  end if;

  return false;
end;
$$;

create policy ac_select on attachments
  for select using (private.can_access_related_record(related_table, related_id));

create policy ac_admin_insert on attachments
  for insert with check (private.current_user_role() in ('admin_geral','admin_equipe'));

create policy ac_lideranca_insert on attachments
  for insert with check (
    private.current_user_role() = 'lideranca' and private.can_access_related_record(related_table, related_id)
  );

create policy ac_admin_delete on attachments
  for delete using (private.current_user_role() in ('admin_geral','admin_equipe'));

-- ============================================================================
-- notifications — cada usuário só vê as suas
-- ============================================================================
alter table notifications enable row level security;

create policy nt_select_own on notifications
  for select using (user_id = (select auth.uid()));

create policy nt_update_own on notifications
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())); -- ex.: marcar como lida

create policy nt_system_insert on notifications
  for insert with check (private.current_user_role() in ('admin_geral','admin_equipe'));
  -- Edge Functions usam a service_role key e ignoram RLS por padrão.

-- ============================================================================
-- agenda_events
-- ============================================================================
alter table agenda_events enable row level security;

create policy ag_admin_geral_all on agenda_events
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

create policy ag_admin_equipe_select on agenda_events
  for select using (private.current_user_role() = 'admin_equipe');

create policy ag_admin_equipe_insert on agenda_events
  for insert with check (private.current_user_role() = 'admin_equipe');

create policy ag_admin_equipe_update on agenda_events
  for update using (private.current_user_role() = 'admin_equipe')
  with check (private.current_user_role() = 'admin_equipe');

create policy ag_lideranca_select_own on agenda_events
  for select using (
    private.current_user_role() = 'lideranca'
    and (leader_id = private.current_user_leader_id() or responsible_user_id = (select auth.uid()))
  );

create policy ag_lideranca_insert_own on agenda_events
  for insert with check (
    private.current_user_role() = 'lideranca' and leader_id = private.current_user_leader_id()
  );

-- ============================================================================
-- message_templates — todos autenticados leem os ativos; só admin_geral gerencia
-- ============================================================================
alter table message_templates enable row level security;

create policy mt_select_active on message_templates
  for select using ((select auth.role()) = 'authenticated' and status = 'ativo');

create policy mt_admin_geral_write on message_templates
  for all using (private.current_user_role() = 'admin_geral')
  with check (private.current_user_role() = 'admin_geral');

-- ============================================================================
-- Grants do schema "private"
-- Sem isso, authenticated/anon recebem "permission denied for schema
-- private" ao rodar QUALQUER query numa tabela cuja policy chame uma
-- função private.* — o Postgres exige USAGE no schema além de EXECUTE
-- na função para o role que está efetivamente rodando a query (que é o
-- role da sessão, não o dono da função, mesmo em SECURITY DEFINER).
-- ============================================================================
grant usage on schema private to authenticated, anon;
grant execute on all functions in schema private to authenticated, anon;
alter default privileges in schema private grant execute on functions to authenticated, anon;

-- ============================================================================
-- Checklist de cobertura (Módulo 15 do prompt master)
-- ============================================================================
-- [x] #19 Lideranças não veem dados de outras lideranças  -> is_own_supporter() / current_user_leader_id()
-- [x] #20 Admin Geral vê tudo                              -> policy "_admin_geral_all" em cada tabela
-- [x] #18 Permissões por perfil respeitadas                -> current_user_role() em toda policy
-- [ ] Regras de campo (ex.: admin_equipe não exclui registro sensível "salvo permissão") ->
--     falta uma tabela de exceções/permissões pontuais (Módulo 17 "Configurações > Permissões")
--     para o caso "salvo autorização do Admin Geral". Sugestão: tabela
--     `permission_overrides (user_id, action, resource_table, resource_id)` a ser desenhada
--     junto com o módulo de Configurações — deixei o all-or-nothing dentro do MVP.
--
-- BUG REAL encontrado e corrigido na revisão ponta a ponta da Etapa 8
-- (docs/02-plano-mvp.md): o banco estava com uma versão DESATUALIZADA de
-- is_own_supporter() / current_leader_can_view_attendances() /
-- can_access_related_record() — as 3 chamavam current_user_role() e
-- current_user_leader_id() SEM qualificar o schema "private", então
-- resolviam pra "function does not exist" (42883) porque o search_path
-- dessas funções é só 'public'. Na prática, TODA query de um usuário com
-- role = 'lideranca' em leaders/supporters/demands/attendances/attachments
-- quebrava. Esse arquivo (a versão que você está lendo) já sempre teve o
-- código certo com "private." explícito — o problema era só uma migration
-- antiga aplicada no banco que tinha ficado pra trás. Reaplicado via
-- apply_migration "fix_private_schema_function_cross_calls" e confirmado
-- com um teste de verdade: 3 usuários de teste (um por perfil), 2
-- lideranças, 1 apoiador e 2 demandas, consultados simulando cada perfil
-- via `set local role authenticated` + `set_config('request.jwt.claims', ...)`
-- — liderança viu só a própria rede, admin_equipe não conseguiu deletar
-- liderança (0 linhas afetadas, sem erro), admin_geral viu tudo. Dados de
-- teste removidos depois (nenhum residual no banco). Isso é o motivo pelo
-- qual "rodar get_advisors" sozinho NÃO é suficiente pra validar RLS: o
-- advisor pega search_path mutável e exposição indevida, mas não pega
-- chamada cruzada quebrada entre funções — só um teste funcional de verdade
-- como sessão autenticada pega isso.
--
-- Rodado get_advisors (security + performance) após aplicar este arquivo no projeto real:
-- [x] security: 0 avisos.
-- [x] performance: "unindexed_foreign_keys" e "auth_rls_initplan" resolvidos (ver schema.sql
--     para os índices e as policies acima para os `(select auth.uid())`).
-- [ ] performance: "multiple_permissive_policies" permanece — cada tabela tem uma policy
--     separada por perfil (admin_geral/admin_equipe/lideranca) para legibilidade, o que faz o
--     Postgres avaliar todas via OR a cada query. Aceitável no volume de dados de uma campanha
--     municipal; se a base crescer muito, consolidar em uma única policy por comando (usando
--     CASE/OR interno) antes de escalar.
-- [ ] performance: "unused_index" é esperado — banco recém-criado, sem tráfego de leitura ainda.
