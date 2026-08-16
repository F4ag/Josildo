-- ATENÇÃO: esta migration pertence ao projeto Supabase "Cadastro Mestre"
-- (Ecossistema, project ref pfjpixapzawcbrhgldks), não ao projeto Lidera+
-- deste repositório. Está aqui só como registro em controle de versão —
-- Cadastro Mestre não tem repositório próprio neste momento. Já aplicada
-- diretamente ao projeto via MCP; reaplicar aqui (ex.: `supabase db push`
-- neste repo) não tem efeito no projeto Lidera+ e não deve ser tentado
-- contra ele.
--
-- Contexto: corrige uma race condition real, observada em teste de ponta a
-- ponta ao vivo, onde uma única submissão do formulário /clientes/novo do
-- Lidera+ por vezes criava 2 linhas `cliente` no Cadastro Mestre (uma
-- órfã). Ver docs/superpowers/plans/2026-08-15-provisionamento-cross-sistema.md
-- e o ledger da Task 8 pra contexto completo da investigação.

create or replace function provisionar_cliente_lidera_mais(
  p_nome text,
  p_cidade text,
  p_organization_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_organization_id::text));

  select cliente_id into v_cliente_id
  from integracao_sistema
  where sistema = 'lidera_mais' and identificador_externo = p_organization_id::text;

  if v_cliente_id is not null then
    return v_cliente_id;
  end if;

  insert into cliente (nome, cidade) values (p_nome, p_cidade)
  returning id into v_cliente_id;

  insert into campanha (cliente_id, nome, status) values (v_cliente_id, 'Campanha', 'planejamento');

  insert into integracao_sistema (cliente_id, sistema, identificador_externo)
  values (v_cliente_id, 'lidera_mais', p_organization_id::text);

  return v_cliente_id;
end;
$$;

comment on function provisionar_cliente_lidera_mais is
  'Cria (ou retorna, se já existir) o cliente+campanha+integracao_sistema para um organizationId do Lidera+, de forma atômica — usa pg_advisory_xact_lock pra serializar chamadas concorrentes com o mesmo organizationId e evitar duplicar cliente. Chamada por provisionarCadastroMestre (src/services/provisioning/cadastro-mestre.ts, repositório lidera-mais).';

-- Postgres concede EXECUTE em funções novas pra PUBLIC por padrão. Como
-- esta função é SECURITY DEFINER, isso a tornaria chamável via
-- /rest/v1/rpc/provisionar_cliente_lidera_mais por qualquer requisição não
-- autenticada, pulando o assertPlatformAdmin() do Lidera+ por completo. Só
-- o service_role (usado pelo client de service role em
-- src/lib/supabase/external-projects.ts) deve poder chamar.
revoke execute on function provisionar_cliente_lidera_mais(text, text, uuid) from public;
grant execute on function provisionar_cliente_lidera_mais(text, text, uuid) to service_role;

-- Defesa em profundidade (recomendação da revisão final do branch): mesmo
-- que a causa raiz da duplicação nunca seja identificada com certeza (teste
-- ao vivo descartou bug de aplicação — ver ledger da Task 8), estas
-- constraints tornam uma segunda tentativa concorrente pra o mesmo
-- organizationId sempre falhar com erro de constraint, desfazendo a
-- transação inteira (incluindo o cliente que teria ficado órfão) — em vez
-- de deixar lixo silencioso, como aconteceu antes desta migration.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_integracao_sistema_externo'
  ) then
    alter table integracao_sistema
      add constraint uq_integracao_sistema_externo unique (sistema, identificador_externo);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_integracao_sistema_cliente'
  ) then
    alter table integracao_sistema
      add constraint uq_integracao_sistema_cliente unique (cliente_id, sistema);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_campanha_cliente'
  ) then
    alter table campanha
      add constraint uq_campanha_cliente unique (cliente_id);
  end if;
end $$;
