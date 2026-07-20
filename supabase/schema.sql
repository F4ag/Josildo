-- ============================================================================
-- LIDERA+ — Schema inicial (Supabase / PostgreSQL)
-- Convenção: snake_case, uuid como PK, created_by/created_at/updated_at em
-- toda tabela operacional, check constraints reproduzindo o vocabulário
-- fechado do prompt master (evita strings livres inconsistentes na UI).
-- ============================================================================

create extension if not exists "pgcrypto";
-- Ativar apenas quando o mapa de calor / geocoding avançado (Módulo 8, v2)
-- entrar em produção. Não é necessário para o MVP com lat/lng simples.
-- create extension if not exists postgis;

-- ----------------------------------------------------------------------------
-- Trigger genérico de updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- ----------------------------------------------------------------------------
-- organizations — multi-tenant (docs/07-migracao-multi-tenant.md). Cada
-- cliente (liderança que contrata o Lidera+) é uma organização isolada por
-- RLS; identificada por subdomínio (slug.lideramais.app.br).
-- ----------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  plan text not null default 'padrao',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- users_profiles — espelha auth.users, guarda role e status
-- ----------------------------------------------------------------------------
create table users_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  full_name text not null,
  phone text,
  email text,
  role text not null check (role in ('admin_geral', 'admin_equipe', 'lideranca')),
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  leader_id uuid, -- preenchido quando role = 'lideranca' (FK adicionada após criar leaders)
  -- Acesso cross-tenant (provisionar organizações novas) — só contas da
  -- Agência F4, nunca clientes. Ver docs/07-migracao-multi-tenant.md.
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_users_profiles_org on users_profiles(organization_id);
create trigger trg_users_profiles_updated_at before update on users_profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- neighborhoods — unidade territorial de análise (Módulo 8/11.7)
-- ----------------------------------------------------------------------------
create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  city text,
  state text,
  population_estimate integer,
  classification text check (classification in ('forte', 'medio', 'fraco', 'descoberto')),
  notes text,
  created_at timestamptz not null default now(),
  unique (name, city)
);
create index idx_neighborhoods_org on neighborhoods(organization_id);

-- ----------------------------------------------------------------------------
-- leaders — Módulo 3
-- ----------------------------------------------------------------------------
create table leaders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users_profiles(id), -- se a liderança tem login
  -- Hierarquia: quem cadastrou/indicou esta liderança (uma liderança com
  -- login pode cadastrar outras "abaixo" dela). Null = topo da hierarquia
  -- (cadastrada por admin_geral/admin_equipe). on delete set null pra não
  -- apagar em cascata se a liderança-mãe for excluída — ver migration
  -- leaders_parent_hierarchy.
  parent_leader_id uuid references leaders(id) on delete set null,
  name text not null,
  nickname text,
  phone text,
  email text,
  birth_date date,
  cpf text, -- opcional, texto livre, sem validação de dígito verificador
  mother_name text,
  address text,
  complement text, -- casa, apartamento, bloco, etc.
  neighborhood text,
  neighborhood_id uuid references neighborhoods(id),
  city text,
  state text,
  zip_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  leader_type text check (leader_type in (
    'comunitaria','religiosa','esportiva','empresarial','sindical','estudantil',
    'saude','educacao','seguranca','cultura','juventude','mulher','idoso',
    'rural','digital_influenciador','outra'
  )),
  influence_level text check (influence_level in ('baixo','medio','alto','estrategico')),
  status text not null default 'ativa' check (status in ('ativa','em_atencao','inativa','estrategica')),
  -- Módulo 4.3: liderança só vê atendimentos da própria rede se autorizada pelo Admin Geral
  can_view_attendances boolean not null default false,
  photo_url text,
  -- Expectativa de votos informada pela própria liderança (ela mesma pode
  -- ver/editar). admin_estimated_votes é a avaliação real do administrador
  -- sobre quantos votos ela vai entregar de fato — campo admin-only: RLS no
  -- Postgres só filtra linha, não coluna, então a restrição de leitura/
  -- escrita pra role lideranca é feita na aplicação (ver liderancas/
  -- actions.ts e liderancas/leader-form.tsx, mesmo padrão de influence_level).
  expected_votes integer,
  admin_estimated_votes integer,
  -- Local de votação (dado aberto do TSE, tabela global polling_locations,
  -- criada mais abaixo — por isso a FK é adicionada só depois via alter
  -- table, mesmo recurso já usado para users_profiles.leader_id acima)
  -- informado no cadastro via autocomplete. Nullable e on delete set null:
  -- cadastro não obrigatório, e um reimport futuro de polling_locations não
  -- deve apagar o cadastro da liderança por causa disso. Alimenta o
  -- relatório de expectativa x eleitorado por local.
  polling_location_id uuid,
  -- Zona/seção eleitoral informadas manualmente — dado complementar ao
  -- polling_location_id (que vem do autocomplete sobre o dado do TSE já
  -- importado). Mantidas como texto livre porque nem toda liderança sabe/tem
  -- o local de votação exato cadastrado no autocomplete, mas pode saber zona
  -- e seção de cabeça ou pelo título de eleitor.
  electoral_zone text,
  electoral_section text,
  notes text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_leaders_updated_at before update on leaders
  for each row execute function set_updated_at();
create index idx_leaders_neighborhood on leaders(neighborhood);
create index idx_leaders_status on leaders(status);
create index idx_leaders_type on leaders(leader_type);
create index idx_leaders_influence on leaders(influence_level);
create index idx_leaders_user on leaders(user_id);
create index idx_leaders_neighborhood_id on leaders(neighborhood_id);
create index idx_leaders_polling_location_id on leaders(polling_location_id);
create index idx_leaders_created_by on leaders(created_by);
create index idx_leaders_org on leaders(organization_id);

alter table users_profiles
  add constraint fk_users_profiles_leader foreign key (leader_id) references leaders(id);
create index idx_users_profiles_leader on users_profiles(leader_id);

-- ----------------------------------------------------------------------------
-- supporters — Módulo 4 (apoiador / base de pessoas)
-- ----------------------------------------------------------------------------
create table supporters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  phone text not null,
  email text,
  birth_date date not null,
  cpf text, -- opcional, texto livre, sem validação de dígito verificador
  mother_name text,
  address text not null,
  complement text, -- casa, apartamento, bloco, etc.
  neighborhood text,
  neighborhood_id uuid references neighborhoods(id),
  city text,
  state text,
  zip_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  leader_id uuid references leaders(id),
  origin text check (origin in (
    'lideranca','evento','visita','reuniao','whatsapp','formulario_online',
    'mutirao','gabinete','rua','indicacao','outro'
  )),
  gender text,
  profession text,
  consent_whatsapp boolean not null default false,
  consent_email boolean not null default false,
  consent_registration boolean not null default false,
  consent_date timestamptz,
  consent_origin text,
  -- Local de votação — mesma nota de leaders.polling_location_id acima
  -- (FK adicionada mais abaixo via alter table, depois de polling_locations
  -- existir).
  polling_location_id uuid,
  -- Zona/seção eleitoral informadas manualmente — ver mesma nota em leaders acima.
  electoral_zone text,
  electoral_section text,
  notes text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_supporters_updated_at before update on supporters
  for each row execute function set_updated_at();
create index idx_supporters_neighborhood on supporters(neighborhood);
create index idx_supporters_leader on supporters(leader_id);
create index idx_supporters_phone on supporters(phone);
create index idx_supporters_birth_date on supporters(birth_date);
-- Suporte ao detector de duplicidade (Módulo 16): nome + nascimento, nome + endereço
create index idx_supporters_name_birth on supporters(name, birth_date);
create index idx_supporters_name_address on supporters(name, address);
create index idx_supporters_neighborhood_id on supporters(neighborhood_id);
create index idx_supporters_polling_location_id on supporters(polling_location_id);
create index idx_supporters_created_by on supporters(created_by);
create index idx_supporters_org on supporters(organization_id);

-- ----------------------------------------------------------------------------
-- demands — Módulo 6
-- ----------------------------------------------------------------------------
create table demands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  description text,
  demand_type text check (demand_type in (
    'capinacao','iluminacao_publica','tapa_buraco','limpeza_urbana','saude',
    'educacao','transporte','seguranca','assistencia_social','esporte',
    'cultura','regularizacao','saneamento','agua','energia','documento',
    'atendimento_individual','outra'
  )),
  leader_id uuid references leaders(id),
  supporter_id uuid references supporters(id),
  address text,
  neighborhood text,
  neighborhood_id uuid references neighborhoods(id),
  latitude numeric(9,6),
  longitude numeric(9,6),
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  status text not null default 'nova' check (status in (
    'nova','em_analise','encaminhada','em_andamento','aguardando_orgao_responsavel',
    'resolvida','recusada','cancelada','atrasada'
  )),
  responsible_user_id uuid references users_profiles(id),
  public_agency text,
  requested_at date not null default current_date,
  due_date date,
  completed_at timestamptz,
  result_description text,
  notes text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_demands_updated_at before update on demands
  for each row execute function set_updated_at();
create index idx_demands_neighborhood on demands(neighborhood);
create index idx_demands_leader on demands(leader_id);
create index idx_demands_supporter on demands(supporter_id);
create index idx_demands_status on demands(status);
create index idx_demands_priority on demands(priority);
create index idx_demands_due_date on demands(due_date);
create index idx_demands_responsible on demands(responsible_user_id);
create index idx_demands_neighborhood_id on demands(neighborhood_id);
create index idx_demands_created_by on demands(created_by);
create index idx_demands_org on demands(organization_id);

-- ----------------------------------------------------------------------------
-- demand_updates — histórico de status (exigido pelo Módulo 6)
-- ----------------------------------------------------------------------------
create table demand_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  demand_id uuid not null references demands(id) on delete cascade,
  status text not null,
  comment text,
  updated_by uuid references users_profiles(id),
  created_at timestamptz not null default now()
);
create index idx_demand_updates_demand on demand_updates(demand_id);
create index idx_demand_updates_updated_by on demand_updates(updated_by);
create index idx_demand_updates_org on demand_updates(organization_id);

-- ----------------------------------------------------------------------------
-- attendances — Módulo 7 (todo atendimento é vinculado a uma pessoa: not null)
-- ----------------------------------------------------------------------------
create table attendances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  supporter_id uuid not null references supporters(id),
  leader_id uuid references leaders(id),
  responsible_user_id uuid references users_profiles(id),
  attendance_type text not null check (attendance_type in (
    'consulta_medica','pedido_exame','documento','encaminhamento_social',
    'reuniao','orientacao','transporte','cesta_basica','habitacao',
    'emprego','atendimento_juridico','outro'
  )),
  title text not null,
  description text,
  status text not null default 'novo' check (status in (
    'novo','em_analise','em_andamento','aguardando_documento',
    'aguardando_orgao_publico','atendido','nao_atendido','cancelado','arquivado'
  )),
  priority text not null default 'media' check (priority in ('baixa','media','alta','urgente')),
  requested_at date not null default current_date,
  attended_at date,
  due_date date,
  result_description text,
  return_sent boolean not null default false,
  return_channel text check (return_channel in ('whatsapp','email','ligacao','presencial','outro')),
  notes text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_attendances_updated_at before update on attendances
  for each row execute function set_updated_at();
create index idx_attendances_supporter on attendances(supporter_id);
create index idx_attendances_leader on attendances(leader_id);
create index idx_attendances_status on attendances(status);
create index idx_attendances_due_date on attendances(due_date);
create index idx_attendances_responsible on attendances(responsible_user_id);
create index idx_attendances_created_by on attendances(created_by);
create index idx_attendances_org on attendances(organization_id);

-- ----------------------------------------------------------------------------
-- interactions — Módulo 14 (timeline de contato)
-- ----------------------------------------------------------------------------
create table interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  person_type text check (person_type in ('lideranca','apoiador')),
  leader_id uuid references leaders(id),
  supporter_id uuid references supporters(id),
  interaction_type text check (interaction_type in (
    'ligacao','whatsapp','email','visita','reuniao','evento',
    'demanda','atendimento','aniversario','outro'
  )),
  description text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  constraint chk_interaction_target check (leader_id is not null or supporter_id is not null)
);
create index idx_interactions_leader on interactions(leader_id);
create index idx_interactions_supporter on interactions(supporter_id);
create index idx_interactions_created_at on interactions(created_at);
create index idx_interactions_created_by on interactions(created_by);
create index idx_interactions_org on interactions(organization_id);

-- ----------------------------------------------------------------------------
-- attachments — anexos genéricos (fotos de demanda, documentos etc.)
-- ----------------------------------------------------------------------------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  related_table text not null check (related_table in (
    'leaders','supporters','demands','attendances','agenda_events'
  )),
  related_id uuid not null,
  file_url text not null,
  file_type text,
  uploaded_by uuid references users_profiles(id),
  created_at timestamptz not null default now()
);
create index idx_attachments_related on attachments(related_table, related_id);
create index idx_attachments_uploaded_by on attachments(uploaded_by);
create index idx_attachments_org on attachments(organization_id);

-- ----------------------------------------------------------------------------
-- notifications — Módulo 10 (alertas)
-- ----------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid references users_profiles(id),
  title text not null,
  message text,
  notification_type text check (notification_type in (
    'demanda_vencendo','demanda_atrasada','demanda_sem_responsavel',
    'atendimento_vencendo','atendimento_atrasado','aniversario',
    'lideranca_inativa','sem_interacao','outro'
  )),
  is_read boolean not null default false,
  related_table text,
  related_id uuid,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, is_read);
create index idx_notifications_org on notifications(organization_id);

-- ----------------------------------------------------------------------------
-- agenda_events — Módulo 13
-- ----------------------------------------------------------------------------
create table agenda_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  title text not null,
  description text,
  event_date date not null,
  event_time time,
  location text,
  neighborhood text,
  leader_id uuid references leaders(id),
  supporter_id uuid references supporters(id),
  demand_id uuid references demands(id),
  attendance_id uuid references attendances(id),
  responsible_user_id uuid references users_profiles(id),
  status text not null default 'agendado' check (status in (
    'agendado','realizado','cancelado','remarcado','pendente'
  )),
  notes text,
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_agenda_events_updated_at before update on agenda_events
  for each row execute function set_updated_at();
create index idx_agenda_events_date on agenda_events(event_date);
create index idx_agenda_events_leader on agenda_events(leader_id);
create index idx_agenda_events_supporter on agenda_events(supporter_id);
create index idx_agenda_events_demand on agenda_events(demand_id);
create index idx_agenda_events_attendance on agenda_events(attendance_id);
create index idx_agenda_events_responsible on agenda_events(responsible_user_id);
create index idx_agenda_events_created_by on agenda_events(created_by);
create index idx_agenda_events_org on agenda_events(organization_id);

-- ----------------------------------------------------------------------------
-- message_templates — Módulo 12
-- ----------------------------------------------------------------------------
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  type text not null check (type in (
    'aniversario','retorno_demanda','demanda_resolvida','atendimento_concluido',
    'convite_reuniao','agradecimento','atualizacao_cadastral','outro'
  )),
  subject text,
  body text not null,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  created_by uuid references users_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_message_templates_updated_at before update on message_templates
  for each row execute function set_updated_at();
create index idx_message_templates_created_by on message_templates(created_by);
create index idx_message_templates_org on message_templates(organization_id);

-- ----------------------------------------------------------------------------
-- electoral_zones / polling_locations / electoral_sections — dados públicos
-- do TSE (Portal de Dados Abertos, CC-BY, atualização mensal). NÃO é
-- multi-tenant: é a mesma referência geográfica pra qualquer organização
-- (por isso, diferente de todas as tabelas acima, não tem organization_id).
-- Hierarquia: município → zona eleitoral → local de votação → seção.
-- Populado pela Edge Function supabase/functions/import-electoral-data
-- (baixa e filtra o arquivo nacional "eleitorado por local de votação" pra
-- UF=PE — ver comentário no início do arquivo da function pra detalhes de
-- por que o processamento roda lá e não aqui).
-- ----------------------------------------------------------------------------
create table electoral_zones (
  id uuid primary key default gen_random_uuid(),
  uf text not null default 'PE',
  municipio_codigo text not null,
  municipio_nome text not null,
  zona_numero integer not null,
  created_at timestamptz not null default now(),
  unique (municipio_codigo, zona_numero)
);
create index idx_electoral_zones_municipio on electoral_zones(municipio_nome);

create table polling_locations (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references electoral_zones(id) on delete cascade,
  municipio_codigo text not null,
  municipio_nome text not null,
  zona_numero integer not null,
  local_numero integer not null,
  nome text not null,
  endereco text,
  bairro text,
  cep text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  situacao text,
  -- soma de QT_ELEITOR_SECAO de todas as seções deste local (última
  -- importação) — usado pra comparar "expectativa x realidade" de votos.
  eleitores_total integer,
  created_at timestamptz not null default now(),
  unique (municipio_codigo, zona_numero, local_numero)
);
create index idx_polling_locations_municipio on polling_locations(municipio_nome);
create index idx_polling_locations_nome on polling_locations(nome);
create index idx_polling_locations_bairro on polling_locations(bairro);
create index idx_polling_locations_zone on polling_locations(zone_id);

-- FKs de leaders/supporters.polling_location_id (colunas declaradas lá em
-- cima, sem "references" inline, porque esta tabela só existe a partir
-- daqui — mesmo recurso do fk_users_profiles_leader logo após leaders).
alter table leaders
  add constraint leaders_polling_location_id_fkey foreign key (polling_location_id)
  references polling_locations(id) on delete set null;
alter table supporters
  add constraint supporters_polling_location_id_fkey foreign key (polling_location_id)
  references polling_locations(id) on delete set null;

create table electoral_sections (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references polling_locations(id) on delete cascade,
  municipio_codigo text not null,
  zona_numero integer not null,
  local_numero integer not null,
  secao_numero integer not null,
  eleitores integer,
  situacao text,
  created_at timestamptz not null default now(),
  unique (municipio_codigo, zona_numero, secao_numero)
);
create index idx_electoral_sections_location on electoral_sections(location_id);

-- ============================================================================
-- Seeds mínimos (modelos de mensagem citados no prompt master, Módulos 9 e 12)
-- ============================================================================
insert into message_templates (name, type, body) values
  ('Aniversário — pessoal', 'aniversario',
   'Olá, {{nome}}! Passando para desejar um feliz aniversário, com muita saúde, paz e realizações. Que seu novo ciclo seja abençoado. Um grande abraço!'),
  ('Aniversário — institucional', 'aniversario',
   'Olá, {{nome}}! Hoje é um dia especial e quero deixar meu abraço pelo seu aniversário. Desejo muita saúde, felicidade e conquistas para você e sua família. Conte sempre conosco!'),
  ('Retorno de demanda — atualização de status', 'retorno_demanda',
   'Olá, {{nome}}! Passando para informar que a solicitação "{{demanda}}" foi atualizada para o status: {{status}}. Seguimos acompanhando e retornaremos quando houver novidade.'),
  ('Demanda resolvida', 'demanda_resolvida',
   'Olá, {{nome}}! Passando para informar que a solicitação "{{demanda}}" foi concluída. Agradecemos por trazer essa demanda da comunidade. Seguimos juntos trabalhando pelo bairro.');

-- ============================================================================
-- Observações de modelagem
-- ============================================================================
-- 1. "Pessoa atendida" (Módulo 5) não é uma tabela própria: é um supporter que
--    possui >=1 registro em demands ou attendances. Isso evita duplicar dado
--    de cadastro e mantém a regra "toda demanda/atendimento aparece no
--    histórico da pessoa" como uma consulta (join), não uma sincronização.
-- 2. A pontuação de ranking de lideranças (Módulo 11.6 / 17) é calculada, não
--    armazenada — deve ser uma view ou função SQL (`leader_score`) criada no
--    módulo de Relatórios, para não haver dessincronia entre pontos e eventos
--    que os geraram.
-- 3. `neighborhoods.classification` (forte/médio/fraco/descoberto) é
--    recalculado periodicamente por Edge Function, não editado manualmente.
