# Migração para arquitetura multi-tenant — Lidera+

**Status:** plano proposto, aguardando aprovação antes de qualquer implementação.
**Modelo escolhido:** um único banco Supabase + um único deploy Vercel atendendo
vários clientes, isolados por `organization_id` (RLS) e identificados por
subdomínio (`cliente.lideramais.app.br`).

---

## 1. Por que isso e não uma instância por cliente

Hoje, vender o Lidera+ para outra liderança exigiria replicar tudo: novo
projeto Supabase, novo projeto Vercel, novo domínio, nova verificação de
e-mail. Funciona, mas cada cliente novo é trabalho manual repetido, e a
manutenção (corrigir um bug, lançar um módulo novo) tem que ser feita N vezes.

Na arquitetura multi-tenant, o código e o banco são compartilhados; o que
muda por cliente é só uma linha na tabela `organizations` e o subdomínio.
Corrigir um bug ou lançar uma funcionalidade nova beneficia todos os clientes
de uma vez.

O custo é a complexidade adicional: todo dado sensível precisa carregar a
que organização pertence, e toda regra de segurança (RLS) precisa checar
isso — não é opcional, é o que impede um cliente de ver o dado do outro.

---

## 2. Visão geral do funcionamento

- Uma nova tabela `organizations` guarda cada cliente (nome, `slug` do
  subdomínio, status, data de criação).
- Toda tabela que hoje guarda dado de um cliente (lideranças, apoiadores,
  demandas, atendimentos, agenda, mensagens, etc.) ganha uma coluna
  `organization_id`.
- `users_profiles` também ganha `organization_id` — cada usuário pertence a
  exatamente uma organização.
- As políticas de RLS (que já isolam por perfil: admin_geral / admin_equipe
  / liderança) passam a isolar **também** por organização. Isso é a
  segurança real — um usuário nunca consegue ler ou escrever uma linha de
  outra organização, mesmo que tente adulterar a URL ou a query.
- O middleware do Next.js identifica o cliente pelo subdomínio do
  cabeçalho `Host` (ex.: `camara-joao.lideramais.app.br` → organização
  "Câmara João") e usa isso para navegação/branding — não é a barreira de
  segurança (essa é a RLS), é conveniência e prevenção de erro de UX.

---

## 3. Mudanças no banco de dados

### 3.1 Nova tabela

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique, -- ex.: "camara-joao" -> camara-joao.lideramais.app.br
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  plan text not null default 'padrao',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();
```

### 3.2 Coluna `organization_id` nas tabelas existentes

Todas as tabelas abaixo ganham `organization_id uuid not null references
organizations(id)`, com índice:

`users_profiles`, `leaders`, `supporters`, `demands`, `demand_updates`,
`attendances`, `interactions`, `attachments`, `notifications`,
`agenda_events`, `message_templates`, `neighborhoods`.

(`demand_updates`, `attachments`, `interactions` e `notifications` herdam a
organização da tabela pai — mas por simplicidade e performance de RLS, é
melhor duplicar a coluna neles também em vez de fazer join a cada policy.)

`neighborhoods` também passa a ser por organização — hoje é uma tabela
territorial compartilhada, mas dois clientes podem atuar na mesma cidade com
bairros/classificações diferentes.

---

## 4. Mudanças em RLS

Nova função auxiliar, ao lado das que já existem em `private`:

```sql
create or replace function private.current_user_org_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select organization_id from users_profiles where id = auth.uid();
$$;
```

Toda policy existente (`up_admin_geral_all`, `ln_admin_equipe_select`, etc.)
ganha uma cláusula `and organization_id = private.current_user_org_id()`
tanto no `using` quanto no `with check`. Isso é uma revisão mecânica de
`supabase/rls_policies.sql` inteiro — nenhuma policy fica de fora, senão ela
vira um vazamento de dado entre clientes.

---

## 5. Resolução do tenant por subdomínio

Em `src/lib/supabase/middleware.ts`, antes da lógica de autenticação atual:

1. Ler o header `Host` da request (ex.: `camara-joao.lideramais.app.br`).
2. Extrair o subdomínio (tudo antes de `.lideramais.app.br`).
3. Buscar a organização por `slug`. Se não existir → página "organização não
   encontrada" (evita adivinhação de subdomínios válidos).
4. Se o usuário estiver logado e `organization_id` do perfil dele for
   diferente da organização do subdomínio atual → redirecionar para o
   subdomínio correto (ele está tentando acessar pela URL errada; a RLS já
   impediria qualquer vazamento de dado, isso é só para não confundir com a
   marca/tela errada).

O domínio raiz `lideramais.app.br` (sem subdomínio) continua sendo a home
institucional/marketing — não aponta para nenhum tenant específico.

---

## 6. Infraestrutura (Vercel / DNS)

- Adicionar `*.lideramais.app.br` como domínio curinga (wildcard) no projeto
  Vercel — um único deploy responde por todos os subdomínios.
- No Registro.br, criar um registro `CNAME` com nome `*` apontando para o
  destino que a Vercel indicar (o mesmo mecanismo do "Auto configure" que já
  usamos para o Resend, mas manual aqui pois é um wildcard).
- Cookies de sessão: não precisa mudar nada — por padrão, um cookie definido
  sem o atributo `Domain` explícito (que é o caso hoje em
  `lib/supabase/client.ts` e `server.ts`) já fica isolado por subdomínio.
  Ou seja, logar em `camara-joao.lideramais.app.br` não abre sessão em
  `outro-cliente.lideramais.app.br`.

---

## 7. Provisionar um cliente novo (depois de pronto)

Fase 1 (manual, via SQL/dashboard, do jeito que hoje já gerenciamos usuários
pelo Supabase MCP):

1. `insert into organizations (name, slug) values ('Câmara João', 'camara-joao');`
2. Convidar o primeiro usuário admin_geral desse cliente (mesmo fluxo de
   convite que já existe), associando `organization_id` ao criar o perfil.
3. Confirmar que `camara-joao.lideramais.app.br` carrega a tela de login.

Fase 2 (futura, opcional): painel dentro do próprio Lidera+ para a Agência
F4 criar organizações sem precisar mexer no banco diretamente. Não é
necessário para vender ao primeiro cliente novo — vale a pena construir
quando houver volume (a partir de uns 4-5 clientes).

---

## 8. Migração dos dados que já existem em produção

Antes de ativar RLS por organização, é preciso:

1. Criar a organização do cliente atual, ex.:
   `insert into organizations (name, slug) values ('Lidera+', 'app');`
   (subdomínio `app.lideramais.app.br`, ou manter o domínio raiz apontando
   pra essa organização como caso especial — a decidir).
2. Rodar um `update` preenchendo `organization_id` com o id dessa
   organização em todas as tabelas listadas na seção 3.2, para as linhas já
   existentes.
3. Só depois disso trocar as colunas para `not null` e ativar as policies
   revisadas — nessa ordem, para não quebrar o sistema em produção no meio
   do processo.

---

## 9. Impacto em outras partes do sistema

- **Edge Function de alertas diários** (aniversários, demandas atrasadas
  etc.): hoje roda uma vez para todo o banco. Passa a iterar organização por
  organização (ou usar uma query que já agrupa por `organization_id`), para
  as notificações de um cliente não vazarem pra outro.
- **E-mail / Resend**: nenhuma mudança — o domínio verificado é
  `lideramais.app.br`, e um subdomínio dele herda a mesma verificação
  (SPF/DKIM), então `camara-joao.lideramais.app.br` também consegue enviar
  e-mail sem configuração extra.
- **PWA / manifest**: por enquanto o app continua com a marca "Lidera+"
  igual para todos os clientes. Personalizar nome/ícone/cores por cliente
  (white-label completo) é uma etapa futura, não faz parte deste plano.
- **Relatórios em PDF**: já são gerados por query — só precisam herdar o
  filtro de organização como qualquer outra tela.

---

## 10. O que NÃO muda

- Não precisa de novo projeto Supabase por cliente.
- Não precisa de novo projeto Vercel por cliente.
- Não precisa de nova verificação de domínio no Resend por cliente.
- A matriz de permissões por perfil (`admin_geral` / `admin_equipe` /
  `liderança`) continua exatamente igual — ela é ortogonal à organização
  (cada organização tem seus próprios admin_geral, admin_equipe e
  lideranças).

---

## 11. Riscos e como mitigar

| Risco | Mitigação |
|---|---|
| Esquecer `organization_id` em alguma policy nova no futuro | Checklist fixo: toda tabela nova = coluna `organization_id` + policy com o filtro, sem exceção. Revisar com `get_advisors` do Supabase depois de aplicar. |
| Erro na migração dos dados existentes (linha sem organização) | Rodar em transação, `not null` só depois de confirmar 100% das linhas preenchidas (`select count(*) from x where organization_id is null` = 0 antes de travar a coluna). |
| Cliente acessar subdomínio errado por engano | Middleware redireciona para o subdomínio da própria organização do usuário — RLS garante que, mesmo assim, ele só vê o dado dele. |
| Tempo de indisponibilidade durante a migração | Fazer em janela de baixo uso, com backup do banco antes (Supabase permite snapshot manual antes de mudanças estruturais grandes). |

---

## 12. Ordem de execução recomendada

1. Criar `organizations` + colunas `organization_id` (nullable, sem RLS
   nova ainda) — não quebra nada em produção.
2. Popular a organização do cliente atual e preencher `organization_id` em
   todas as linhas existentes.
3. Tornar as colunas `not null`.
4. Reescrever as policies de RLS com o filtro de organização, tabela por
   tabela, testando cada uma antes de seguir pra próxima.
5. Ajustar o middleware para resolver o subdomínio.
6. Configurar o domínio wildcard na Vercel + DNS no Registro.br.
7. Testar de ponta a ponta com dois subdomínios: o do cliente atual e um de
   teste (`teste.lideramais.app.br`) com dados fictícios, confirmando que um
   não enxerga o dado do outro.
8. Ajustar a Edge Function de alertas para iterar por organização.
9. Só então: provisionar o primeiro cliente novo de verdade.

Cada etapa fica em commits separados, para poder reverter isoladamente se
algo quebrar — mesma disciplina que já vimos usando neste projeto (fix17,
fix18... cada correção isolada e testada antes da próxima).

---

## 13. Estimativa de esforço

Migração completa (etapas 1 a 8): algumas sessões de trabalho, não um único
dia — envolve reescrever toda a camada de RLS e revisar todo serviço que
faz query direto (`services/*.ts`) para garantir que nada dependa de
suposição de "banco de um cliente só". Recomendo dividir em pelo menos 3
entregas: (a) schema + migração de dados, (b) RLS + middleware, (c) DNS +
teste ponta a ponta + primeiro provisionamento.
