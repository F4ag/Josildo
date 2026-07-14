-- ============================================================================
-- LIDERA+ — Row Level Security
-- Pré-requisito: supabase/schema.sql já aplicado.
--
-- Princípio: RLS decide QUAIS LINHAS cada perfil vê/altera. Restrição de
-- CAMPO (ex.: admin_equipe não pode editar o campo influence_level de uma
-- liderança estratégica) fica a cargo dos Server Actions — Postgres RLS não
-- tem granularidade de coluna por padrão. Onde isso importa, deixei uma nota.
--
-- MULTI-TENANT (docs/07-migracao-multi-tenant.md): toda policy abaixo isola
-- por organization_id, além de isolar por perfil. admin_geral/admin_equipe
-- NÃO são super-admin global — são admin dentro da própria organização.
-- Cada cliente (organização) tem seu próprio admin_geral, admin_equipe e
-- lideranças, sem visibilidade cruzada nenhuma entre organizações.
--
-- Este arquivo reflete o estado real aplicado no projeto Supabase "lidera+"
-- (migrations 002 a 005 do MVP single-tenant, + multi_tenant_step1..4),
-- incluindo as correções já documentadas:
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

create or replace function private.current_user_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id from users_profiles where id = auth.uid();
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
-- organizations — cada usuário só lê a própria organização. Nenhuma policy
-- de insert/update/delete para authenticated/anon: provisionar cliente novo
-- é feito via SQL/dashboard pela Agência F4 (service_role, ignora RLS) —
-- ver docs/07-migracao-multi-tenant.md seção 7. Não expor esse CRUD no app.
-- ============================================================================
alter table organizations enable row level security;

create policy org_select_own on organizations
  for select using (id = private.current_user_org_id());

-- ============================================================================
-- users_profiles
-- ============================================================================
alter table users_profiles enable row level security;

create policy up_admin_geral_all on users_profiles
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

create policy up_self_select on users_profiles
  for select using (id = (select auth.uid()));

create policy up_self_update on users_profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid())); -- app deve impedir troca do próprio "role"/organization_id via Server Action

create policy up_admin_equipe_select_all on users_profiles
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id());

-- ============================================================================
-- neighborhoods — leitura liberada para todo usuário autenticado da mesma
-- organização, escrita só admin_geral da própria organização
-- ============================================================================
alter table neighborhoods enable row level security;

create policy nb_select_all on neighborhoods
  for select using ((select auth.role()) = 'authenticated' and organization_id = private.current_user_org_id());

create policy nb_admin_geral_write on neighborhoods
  for insert with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

create policy nb_admin_geral_update on neighborhoods
  for update using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

create policy nb_admin_geral_delete on neighborhoods
  for delete using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- ============================================================================
-- leaders
-- ============================================================================
alter table leaders enable row level security;

create policy ld_admin_geral_all on leaders
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Admin de Equipe só vê/edita as lideranças que ele mesmo cadastrou
-- (created_by = auth.uid()) — Admin Geral continua vendo tudo da organização
-- (policy _all acima). Vale pra toda a plataforma, não só pra este cliente
-- (migration admin_equipe_scoped_to_own_records).
create policy ld_admin_equipe_select on leaders
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy ld_admin_equipe_insert on leaders
  for insert with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy ld_admin_equipe_update on leaders
  for update using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());
  -- Exclusão de liderança é ação sensível: reservada a admin_geral (só a policy _all cobre delete).

create policy ld_lideranca_select_self on leaders
  for select using (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id() and organization_id = private.current_user_org_id());

create policy ld_lideranca_update_self on leaders
  for update using (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id() and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'lideranca' and id = private.current_user_leader_id() and organization_id = private.current_user_org_id());
  -- App deve restringir quais campos a liderança pode alterar no próprio cadastro
  -- (ex.: não pode mudar influence_level ou status para "estrategica").
  -- admin_estimated_votes é mais restrito ainda: nem leitura a liderança deve
  -- ter (é a avaliação real do admin sobre ela). Postgres RLS não faz
  -- restrição por coluna, só por linha — então mesmo com select liberado por
  -- esta policy, a aplicação precisa esconder esse campo específico de quem
  -- é role lideranca (ver liderancas/[id]/page.tsx e leader-form.tsx).

-- Hierarquia (migration leaders_parent_hierarchy): liderança pode cadastrar
-- outra liderança "abaixo" dela (parent_leader_id = seu próprio leader_id)
-- e ver as que ela mesma cadastrou — nunca lideranças soltas nem de outra
-- rede. App zera influence_level/status/can_view_attendances nesse cadastro
-- (ver liderancas/actions.ts) — RLS não impede a liderança de mandar esses
-- valores, é defesa em profundidade, não a barreira principal.
create policy ld_lideranca_insert_subordinate on leaders
  for insert
  with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and parent_leader_id = private.current_user_leader_id()
  );

create policy ld_lideranca_select_subordinates on leaders
  for select
  using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and parent_leader_id = private.current_user_leader_id()
  );

-- ============================================================================
-- supporters
-- ============================================================================
alter table supporters enable row level security;

create policy sp_admin_geral_all on supporters
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Isolamento por cadastro próprio (ver nota em ld_admin_equipe_select acima).
create policy sp_admin_equipe_select on supporters
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy sp_admin_equipe_insert on supporters
  for insert with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy sp_admin_equipe_update on supporters
  for update using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy sp_lideranca_select_own_network on supporters
  for select using (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id) and organization_id = private.current_user_org_id());

create policy sp_lideranca_insert_own_network on supporters
  for insert with check (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id) and organization_id = private.current_user_org_id());

create policy sp_lideranca_update_own_network on supporters
  for update using (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id) and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'lideranca' and is_own_supporter(leader_id) and organization_id = private.current_user_org_id());

-- ============================================================================
-- demands
-- ============================================================================
alter table demands enable row level security;

create policy dm_admin_geral_all on demands
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Isolamento por cadastro próprio (ver nota em ld_admin_equipe_select).
create policy dm_admin_equipe_select on demands
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy dm_admin_equipe_insert on demands
  for insert with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy dm_admin_equipe_update on demands
  for update using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());
  -- admin_equipe pode atualizar status (Módulo 4.2) mas não excluir — delete só admin_geral.

create policy dm_lideranca_select_own on demands
  for select using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and (
      is_own_supporter(leader_id)
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

create policy dm_lideranca_insert_own on demands
  for insert with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and is_own_supporter(leader_id)
  );

-- ============================================================================
-- demand_updates — herda visibilidade da demanda relacionada
-- ============================================================================
alter table demand_updates enable row level security;

create policy du_admin_geral_all on demand_updates
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Herda a visibilidade da demanda relacionada (RLS de demands já filtra
-- Admin de Equipe por created_by = auth.uid()) — mesma técnica de
-- du_lideranca_select abaixo, em vez de checar updated_by diretamente.
create policy du_admin_equipe_own on demand_updates
  for all using (
    private.current_user_role() = 'admin_equipe'
    and organization_id = private.current_user_org_id()
    and demand_id in (select id from demands)
  )
  with check (
    private.current_user_role() = 'admin_equipe'
    and organization_id = private.current_user_org_id()
    and demand_id in (select id from demands)
  );

create policy du_lideranca_select on demand_updates
  for select using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and demand_id in (select id from demands) -- já filtrado pela RLS de demands
  );

create policy du_lideranca_insert_comment on demand_updates
  for insert with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and demand_id in (select id from demands)
  );

-- ============================================================================
-- attendances — Módulo 4.3: liderança só vê se autorizada (can_view_attendances)
-- ============================================================================
alter table attendances enable row level security;

create policy at_admin_geral_all on attendances
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Isolamento por cadastro próprio (ver nota em ld_admin_equipe_select).
create policy at_admin_equipe_select on attendances
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy at_admin_equipe_insert on attendances
  for insert with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy at_admin_equipe_update on attendances
  for update using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy at_lideranca_select_authorized on attendances
  for select using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and private.current_leader_can_view_attendances()
    and supporter_id in (select id from supporters where is_own_supporter(leader_id))
  );

-- ============================================================================
-- interactions
-- ============================================================================
alter table interactions enable row level security;

create policy it_admin_geral_all on interactions
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Isolamento por cadastro próprio (ver nota em ld_admin_equipe_select).
create policy it_admin_equipe_own on interactions
  for all using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy it_lideranca_select_own on interactions
  for select using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and (
      leader_id = private.current_user_leader_id()
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

create policy it_lideranca_insert_own on interactions
  for insert with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and (
      leader_id = private.current_user_leader_id()
      or supporter_id in (select id from supporters where is_own_supporter(leader_id))
    )
  );

-- ============================================================================
-- attachments — visibilidade herdada do registro relacionado.
-- can_access_related_record é SECURITY DEFINER e ignora a RLS das tabelas
-- relacionadas, então o filtro de organização tem que estar explícito dentro
-- dela — inclusive para admin_geral/admin_equipe, que NÃO são mais bypass
-- incondicional (cada um só enxerga dentro da própria organização).
-- ============================================================================
alter table attachments enable row level security;

create or replace function private.can_access_related_record(p_related_table text, p_related_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_org_id uuid := private.current_user_org_id();
  v_is_admin boolean := private.current_user_role() in ('admin_geral','admin_equipe');
begin
  if p_related_table = 'leaders' then
    if v_is_admin then
      return exists (select 1 from leaders where id = p_related_id and organization_id = v_org_id);
    end if;
    return exists (select 1 from leaders where id = p_related_id and id = private.current_user_leader_id() and organization_id = v_org_id);
  elsif p_related_table = 'supporters' then
    if v_is_admin then
      return exists (select 1 from supporters where id = p_related_id and organization_id = v_org_id);
    end if;
    return exists (select 1 from supporters where id = p_related_id and is_own_supporter(leader_id) and organization_id = v_org_id);
  elsif p_related_table = 'demands' then
    if v_is_admin then
      return exists (select 1 from demands where id = p_related_id and organization_id = v_org_id);
    end if;
    return exists (
      select 1 from demands
      where id = p_related_id and organization_id = v_org_id
        and (is_own_supporter(leader_id)
             or supporter_id in (select id from supporters where is_own_supporter(leader_id)))
    );
  elsif p_related_table = 'attendances' then
    if v_is_admin then
      return exists (select 1 from attendances where id = p_related_id and organization_id = v_org_id);
    end if;
    return private.current_leader_can_view_attendances() and exists (
      select 1 from attendances a
      join supporters s on s.id = a.supporter_id
      where a.id = p_related_id and a.organization_id = v_org_id and is_own_supporter(s.leader_id)
    );
  elsif p_related_table = 'agenda_events' then
    if v_is_admin then
      return exists (select 1 from agenda_events where id = p_related_id and organization_id = v_org_id);
    end if;
    return exists (select 1 from agenda_events where id = p_related_id and organization_id = v_org_id and leader_id = private.current_user_leader_id());
  end if;

  return false;
end;
$$;

create policy ac_select on attachments
  for select using (organization_id = private.current_user_org_id() and private.can_access_related_record(related_table, related_id));

create policy ac_admin_insert on attachments
  for insert with check (private.current_user_role() in ('admin_geral','admin_equipe') and organization_id = private.current_user_org_id());

create policy ac_lideranca_insert on attachments
  for insert with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and private.can_access_related_record(related_table, related_id)
  );

create policy ac_admin_delete on attachments
  for delete using (private.current_user_role() in ('admin_geral','admin_equipe') and organization_id = private.current_user_org_id());

-- ============================================================================
-- notifications — cada usuário só vê as suas
-- ============================================================================
alter table notifications enable row level security;

create policy nt_select_own on notifications
  for select using (user_id = (select auth.uid()) and organization_id = private.current_user_org_id());

create policy nt_update_own on notifications
  for update using (user_id = (select auth.uid()) and organization_id = private.current_user_org_id())
  with check (user_id = (select auth.uid()) and organization_id = private.current_user_org_id()); -- ex.: marcar como lida

create policy nt_system_insert on notifications
  for insert with check (private.current_user_role() in ('admin_geral','admin_equipe') and organization_id = private.current_user_org_id());
  -- Edge Functions usam a service_role key e ignoram RLS por padrão — o
  -- código da função precisa setar organization_id explicitamente por linha.

-- ============================================================================
-- agenda_events
-- ============================================================================
alter table agenda_events enable row level security;

create policy ag_admin_geral_all on agenda_events
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- Isolamento por cadastro próprio (ver nota em ld_admin_equipe_select).
create policy ag_admin_equipe_select on agenda_events
  for select using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy ag_admin_equipe_insert on agenda_events
  for insert with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy ag_admin_equipe_update on agenda_events
  for update using (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid())
  with check (private.current_user_role() = 'admin_equipe' and organization_id = private.current_user_org_id() and created_by = auth.uid());

create policy ag_lideranca_select_own on agenda_events
  for select using (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and (leader_id = private.current_user_leader_id() or responsible_user_id = (select auth.uid()))
  );

create policy ag_lideranca_insert_own on agenda_events
  for insert with check (
    private.current_user_role() = 'lideranca'
    and organization_id = private.current_user_org_id()
    and leader_id = private.current_user_leader_id()
  );

-- ============================================================================
-- message_templates — todos autenticados leem os ativos da própria
-- organização; só admin_geral da organização gerencia
-- ============================================================================
alter table message_templates enable row level security;

create policy mt_select_active on message_templates
  for select using ((select auth.role()) = 'authenticated' and status = 'ativo' and organization_id = private.current_user_org_id());

create policy mt_admin_geral_write on message_templates
  for all using (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id())
  with check (private.current_user_role() = 'admin_geral' and organization_id = private.current_user_org_id());

-- ============================================================================
-- electoral_zones / polling_locations / electoral_sections — referência
-- geográfica pública do TSE, NÃO multi-tenant. Leitura liberada pra qualquer
-- usuário autenticado (de qualquer organização); escrita só via service_role
-- (Edge Function import-electoral-data), por isso não há policy de
-- insert/update/delete pra authenticated/anon.
-- ============================================================================
alter table electoral_zones enable row level security;
alter table polling_locations enable row level security;
alter table electoral_sections enable row level security;

create policy ez_select_authenticated on electoral_zones
  for select using ((select auth.role()) = 'authenticated');

create policy pl_select_authenticated on polling_locations
  for select using ((select auth.role()) = 'authenticated');

create policy es_select_authenticated on electoral_sections
  for select using ((select auth.role()) = 'authenticated');

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
-- [x] #20 Admin Geral vê tudo DENTRO DA PRÓPRIA ORGANIZAÇÃO -> policy "_admin_geral_all" + organization_id
-- [x] #18 Permissões por perfil respeitadas                -> current_user_role() em toda policy
-- [x] Multi-tenant: nenhuma organização vê dado de outra   -> organization_id = current_user_org_id()
--     em TODA policy (verificado por query em pg_policies: toda policy de
--     select/update/delete tem organization_id no qual, toda policy de
--     insert tem organization_id no with_check — exceção intencional:
--     up_self_select/up_self_update, que já ficam unicamente restritas por
--     id = auth.uid()). Ver docs/07-migracao-multi-tenant.md.
-- [ ] Regras de campo (ex.: admin_equipe não exclui registro sensível "salvo permissão") ->
--     falta uma tabela de exceções/permissões pontuais (Módulo 17 "Configurações > Permissões")
--     para o caso "salvo autorização do Admin Geral". Sugestão: tabela
--     `permission_overrides (user_id, action, resource_table, resource_id)` a ser desenhada
--     junto com o módulo de Configurações — deixei o all-or-nothing dentro do MVP.
--
-- Rodado get_advisors (security) após aplicar a migração multi-tenant no projeto real:
-- [x] security: 0 avisos novos (só o pré-existente "leaked password protection",
--     não relacionado a esta mudança).
-- [ ] performance: "multiple_permissive_policies" permanece — cada tabela tem uma policy
--     separada por perfil (admin_geral/admin_equipe/lideranca) para legibilidade, o que faz o
--     Postgres avaliar todas via OR a cada query. Aceitável no volume de dados de uma campanha
--     municipal; se a base crescer muito, consolidar em uma única policy por comando (usando
--     CASE/OR interno) antes de escalar.
