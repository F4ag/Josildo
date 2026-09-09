# Acesso de liderança por link (sem senha) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o convite por e-mail/senha das lideranças por um link de acesso permanente, entregue via WhatsApp, que autentica a liderança sem exigir e-mail nem senha — e remover a capacidade de `lideranca` cadastrar outra liderança.

**Architecture:** Cada liderança ganha um `access_token` aleatório em `leaders`. Uma rota pública (`/acesso-lideranca/[token]`) troca esse token permanente por um magic link do Supabase gerado on-the-fly pelo client admin (`generateLink`), e delega a troca por sessão de verdade à rota já existente `/auth/confirm` (`verifyOtp`). Revogar apaga o token e bane o login por trás; gerar de novo cria um token novo e remove o banimento. `admin_geral` continua cadastrando liderança e ganha o token automaticamente; `admin_equipe` continua cadastrando liderança mas sem token automático (gera depois, manualmente); `lideranca` deixa de poder cadastrar liderança, tanto na tela quanto na RLS.

**Tech Stack:** Next.js 14 (App Router, Server Actions), Supabase (Postgres + Auth, `@supabase/supabase-js` v2 `auth.admin`), TypeScript, Zod.

**Spec:** `docs/08-acesso-lideranca-sem-senha.md` (ler antes de começar — este plano assume o desenho lá aprovado).

## Global Constraints

- Projeto real em `C:\Sistemas\lidera-plus\Josildo` (não confundir com a cópia órfã em `C:\Sistemas\lidera-plus\`, que não é o repositório git).
- Node/npm só estão no PATH depois de `$env:PATH = "C:\Users\Josildo\AppData\Local\node-v24.19.0-win-x64;$env:PATH"` (PowerShell) — sem isso `npm`/`node` não são encontrados.
- **Sem framework de testes automatizados neste projeto** (`package.json` não tem jest/vitest, só `lint`/`typecheck`/`build`). Cada task usa `npm run typecheck` e `npm run build` como critério de "passou" — não invente um framework de teste novo só para este recurso; siga o padrão já usado no projeto.
- Nunca commitar sem checar `git status`/`git diff` antes — o repo tem outras mudanças não commitadas de um trabalho anterior (campos de cidade/estado do cliente e seletor de bairro); não misture commits.
- Toda mudança de banco (migração, RLS) é aplicada ao projeto Supabase real (`vqrnjiwansfobxaeswnu`, "lidera+") via as ferramentas MCP do Supabase — é o banco de produção dos clientes reais. Narre claramente antes de aplicar.
- Estilo de código do projeto: comentários só quando explicam o "porquê" (não o "o quê"), em português, no mesmo tom já usado nos arquivos existentes — copie o tom dos comentários vizinhos, não invente um estilo novo.

---

### Task 1: Migração de banco — `access_token` em `leaders` e remoção do insert de sub-liderança

**Files:**
- Migração aplicada via MCP do Supabase (projeto `vqrnjiwansfobxaeswnu`), nome `leader_access_link`.
- Modify: `supabase/schema.sql` (tabela `leaders`)
- Modify: `supabase/rls_policies.sql` (seção `leaders`)
- Modify: `src/types/database.types.ts` (tabela `leaders`, `Row`/`Insert`/`Update`)

**Interfaces:**
- Produces: coluna `leaders.access_token: string | null` (única, nullable) disponível em `Tables<"leaders">` (`Leader` em `src/types/domain.ts`) para todas as tasks seguintes.
- Produces: RLS de `leaders` sem nenhuma policy de `insert` para a role `lideranca` (só `ld_admin_geral_all` e `ld_admin_equipe_insert` continuam permitindo insert).

- [ ] **Step 1: Aplicar a migração no Supabase**

Use a ferramenta MCP `mcp__d8202e0f-7648-40ac-9db5-6b320cb8ad5c__apply_migration` com `project_id: "vqrnjiwansfobxaeswnu"`, `name: "leader_access_link"` e este SQL:

```sql
alter table leaders add column access_token text unique;

drop policy if exists ld_lideranca_insert_subordinate on leaders;
```

- [ ] **Step 2: Confirmar que aplicou certo**

Rode via `mcp__d8202e0f-7648-40ac-9db5-6b320cb8ad5c__execute_sql` (mesmo `project_id`):

```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'leaders' and column_name = 'access_token';

select policyname from pg_policies where tablename = 'leaders' order by policyname;
```

Esperado: a primeira query retorna uma linha (`access_token`, `YES`); a segunda **não** lista mais `ld_lideranca_insert_subordinate`, mas continua listando `ld_admin_geral_all`, `ld_admin_equipe_select`, `ld_admin_equipe_insert`, `ld_admin_equipe_update`, `ld_lideranca_select_self`, `ld_lideranca_update_self`, `ld_lideranca_select_subordinates`.

- [ ] **Step 3: Atualizar `supabase/schema.sql`**

Encontre a definição da tabela `leaders` (`create table leaders (...)`) e adicione a coluna nova, com um comentário explicando o propósito (siga o tom dos comentários já existentes no arquivo, ex.: o bloco de `organizations` sobre `election_city`/`election_state` adicionado anteriormente nesta mesma sessão):

```sql
  -- Token de acesso permanente (ver docs/08-acesso-lideranca-sem-senha.md):
  -- link único que autentica a liderança sem senha. null = sem link ativo
  -- (nunca gerado ou revogado). Único pra impedir colisão entre lideranças.
  access_token text unique,
```

Adicione essa linha dentro da lista de colunas de `leaders` (antes do fechamento `);` da tabela).

- [ ] **Step 4: Atualizar `supabase/rls_policies.sql`**

Na seção `-- leaders`, remova o bloco `create policy ld_lideranca_insert_subordinate on leaders (...)` inteiro (incluindo o comentário que o precede sobre hierarquia) e substitua por um comentário curto registrando a remoção:

```sql
-- ld_lideranca_insert_subordinate foi removida (migration leader_access_link):
-- liderança não cadastra mais outra liderança, só apoiador — ver
-- docs/08-acesso-lideranca-sem-senha.md §3. ld_lideranca_select_subordinates
-- continua abaixo, de propósito: lideranças já cadastradas antes dessa
-- mudança continuam visíveis pra quem as cadastrou.
```

Mantenha `ld_lideranca_select_subordinates` como está, logo abaixo.

- [ ] **Step 5: Atualizar `src/types/database.types.ts`**

Na tabela `leaders`, adicione `access_token: string | null` em `Row`, `access_token?: string | null` em `Insert` e `Update` — em ordem alfabética (entre `address` e `admin_estimated_votes`, já que "access_token" < "address" < "admin_estimated_votes" alfabeticamente — confira e ajuste a posição exata olhando o arquivo, o padrão já usado no arquivo é ordem alfabética estrita).

- [ ] **Step 6: Verificar**

```bash
cd "C:\Sistemas\lidera-plus\Josildo"
$env:PATH = "C:\Users\Josildo\AppData\Local\node-v24.19.0-win-x64;$env:PATH"
npm run typecheck
```

Esperado: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql supabase/rls_policies.sql src/types/database.types.ts
git commit -m "feat(db): adiciona access_token em leaders, remove insert de sub-lideranca"
```

---

### Task 2: Permissões — liderança não cadastra mais liderança

**Files:**
- Modify: `src/lib/permissions.ts:67-76` (bloco `LIDERANCA`)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `can("lideranca", "create", "leaders")` passa a retornar `false`. Todo código que já usa `can(role, "create", "leaders")` (`src/app/(app)/liderancas/page.tsx:54`, `src/app/(app)/liderancas/novo/page.tsx`) passa a esconder/bloquear automaticamente para `lideranca`, sem precisar tocar nesses arquivos por causa disso (mas eles são tocados na Task 5 por outro motivo).

- [ ] **Step 1: Editar a matriz de permissões**

Em `src/lib/permissions.ts`, troque:

```ts
const LIDERANCA: ResourceMatrix = {
  leaders: { create: true, read: true, update: true /* só o próprio cadastro */, delete: false },
```

por:

```ts
const LIDERANCA: ResourceMatrix = {
  // create: false desde a remoção da hierarquia de sub-lideranças (migration
  // leader_access_link) — liderança só cadastra apoiador agora. Ver
  // docs/08-acesso-lideranca-sem-senha.md §3.
  leaders: { create: false, read: true, update: true /* só o próprio cadastro */, delete: false },
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Esperado: 0 erros. Confira manualmente (leitura, sem rodar o app) que `src/app/(app)/liderancas/page.tsx` e `src/app/(app)/liderancas/novo/page.tsx` já usam `can(role, "create", "leaders")` para decidir se mostram o botão/permitem a rota — não precisa editar nada ainda, só confirmar que a leitura desses dois arquivos bate com o que está descrito aqui (serão editados na Task 5 por causa do checkbox removido, não por causa desta permissão).

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(permissions): lideranca nao cadastra mais lideranca"
```

---

### Task 3: `src/services/leader-access.ts` — geração/revogação de acesso

**Files:**
- Create: `src/services/leader-access.ts`

**Interfaces:**
- Consumes: `Database` de `@/types/database.types` (com `access_token` da Task 1).
- Produces (usado pelas Tasks 4, 6 e pela rota da Task 7):
  - `generateAccessToken(): string`
  - `type LeaderForAccess = { id: string; user_id: string | null; name: string; email: string | null; phone: string | null }`
  - `ensureLeaderLogin(admin: AdminDB, leader: LeaderForAccess, organizationId: string): Promise<{ userId: string; email: string }>`
  - `generateLeaderAccessToken(admin: AdminDB, leader: LeaderForAccess, organizationId: string): Promise<string>`
  - `revokeLeaderAccess(admin: AdminDB, leaderId: string, userId: string | null): Promise<void>`
  - `buildLeaderAccessLink(host: string, token: string): string`
  - `AdminDB` é `SupabaseClient<Database, "public", any>` (mesmo alias já usado em `src/services/leaders.ts:10`).

- [ ] **Step 1: Escrever o arquivo**

```ts
// src/services/leader-access.ts
//
// Backend do acesso de liderança por link (sem senha) — ver
// docs/08-acesso-lideranca-sem-senha.md. Recebe o client ADMIN (service
// role) por parâmetro, igual services/organizations.ts: criar/banir login de
// outra pessoa exige ignorar RLS de propósito.

import "server-only"
import { randomBytes } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

type AdminDB = SupabaseClient<Database, "public", any>

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lideramais.app.br"

/** 32 bytes aleatórios em base64url — só caracteres seguros pra URL, sem
 * padding. Espaço grande o bastante pra não ser adivinhável por força bruta
 * (ver docs/08-acesso-lideranca-sem-senha.md §8). */
export function generateAccessToken(): string {
  return randomBytes(32).toString("base64url")
}

/** E-mail interno, nunca exibido nem usado pra mandar e-mail de verdade —
 * só existe pra satisfazer a exigência do Supabase Auth de um identificador
 * único por login, quando a liderança não tem e-mail cadastrado. */
function buildSyntheticEmail(leaderId: string): string {
  return `lideranca-${leaderId}@interno.${ROOT_DOMAIN}`
}

export type LeaderForAccess = {
  id: string
  user_id: string | null
  name: string
  email: string | null
  phone: string | null
}

/**
 * Garante que exista um login (auth.users + users_profiles) por trás desta
 * liderança, criando um novo se `leader.user_id` ainda for null. Nunca envia
 * e-mail (usa createUser, não inviteUserByEmail/generateLink) — o acesso é
 * só pelo link, o login por trás é um detalhe interno.
 */
export async function ensureLeaderLogin(
  admin: AdminDB,
  leader: LeaderForAccess,
  organizationId: string,
): Promise<{ userId: string; email: string }> {
  if (leader.user_id) {
    const { data, error } = await admin.auth.admin.getUserById(leader.user_id)
    if (error || !data.user?.email) {
      throw new Error(`Falha ao buscar o login existente da liderança: ${error?.message ?? "e-mail ausente"}.`)
    }
    return { userId: leader.user_id, email: data.user.email }
  }

  const email = leader.email || buildSyntheticEmail(leader.id)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createError || !created.user) {
    throw new Error(`Falha ao criar o login da liderança: ${createError?.message ?? "erro desconhecido"}.`)
  }

  const { error: profileError } = await admin.from("users_profiles").insert({
    id: created.user.id,
    organization_id: organizationId,
    full_name: leader.name,
    email,
    phone: leader.phone,
    role: "lideranca",
    leader_id: leader.id,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(`Falha ao salvar o perfil da liderança: ${profileError.message}.`)
  }

  const { error: linkError } = await admin.from("leaders").update({ user_id: created.user.id }).eq("id", leader.id)
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(`Falha ao vincular o login à liderança: ${linkError.message}.`)
  }

  return { userId: created.user.id, email }
}

/**
 * Gera (ou substitui) o token de acesso da liderança, garantindo o login por
 * trás primeiro. Se o acesso tinha sido revogado (login banido), remove o
 * banimento — gerar um link novo sempre reabre o acesso.
 */
export async function generateLeaderAccessToken(
  admin: AdminDB,
  leader: LeaderForAccess,
  organizationId: string,
): Promise<string> {
  const { userId } = await ensureLeaderLogin(admin, leader, organizationId)

  const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" })
  if (unbanError) {
    throw new Error(`Falha ao reabilitar o login da liderança: ${unbanError.message}.`)
  }

  const token = generateAccessToken()
  const { error } = await admin.from("leaders").update({ access_token: token }).eq("id", leader.id)
  if (error) throw new Error(`Falha ao salvar o link de acesso: ${error.message}.`)

  return token
}

/**
 * Revoga o link de acesso: apaga o token (nenhum link antigo funciona mais)
 * e bane o login por trás. Banir não mata instantaneamente uma sessão já
 * aberta (o token de acesso em uso continua criptograficamente válido até
 * expirar sozinho), mas impede qualquer renovação futura — na prática a
 * sessão morre dentro do tempo de vida do token de acesso do Supabase (ver
 * docs/08-acesso-lideranca-sem-senha.md §8). "876000h" (~100 anos) é o valor
 * idiomático do Supabase pra "banido permanentemente".
 */
export async function revokeLeaderAccess(admin: AdminDB, leaderId: string, userId: string | null): Promise<void> {
  const { error } = await admin.from("leaders").update({ access_token: null }).eq("id", leaderId)
  if (error) throw new Error(`Falha ao revogar o link de acesso: ${error.message}.`)

  if (userId) {
    const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" })
    if (banError) throw new Error(`Falha ao bloquear o login da liderança: ${banError.message}.`)
  }
}

export function buildLeaderAccessLink(host: string, token: string): string {
  return `https://${host}/acesso-lideranca/${token}`
}
```

- [ ] **Step 2: Verificar**

```bash
npm run typecheck
```

Esperado: 0 erros. Se der erro de tipo em `admin.auth.admin.createUser`/`generateLink`/`updateUserById`, confira a versão instalada com `cat node_modules/@supabase/supabase-js/package.json | grep version` — este plano foi escrito contra `@supabase/supabase-js` `^2.45.4` (a mesma do `package.json` do projeto).

- [ ] **Step 3: Commit**

```bash
git add src/services/leader-access.ts
git commit -m "feat: adiciona services/leader-access.ts (token, login, revogacao)"
```

---

### Task 4: `liderancas/actions.ts` — gerar automático, revogar e gerar manual

**Files:**
- Modify: `src/app/(app)/liderancas/actions.ts`

**Interfaces:**
- Consumes: `generateLeaderAccessToken`, `revokeLeaderAccess`, `type LeaderForAccess` de `@/services/leader-access` (Task 3); `getLeaderById` de `@/services/leaders` (já existe, não precisa importar de novo se já estiver — confira o topo do arquivo, hoje ele importa `createLeader, updateLeader, deleteLeader` de `@/services/leaders`, precisa adicionar `getLeaderById` a essa lista).
- Produces: `generateLeaderAccessLinkAction(leaderId: string, _prevState: ActionState): Promise<ActionState>` e `revokeLeaderAccessAction(leaderId: string, _prevState: ActionState): Promise<ActionState>` — usados pela Task 6 (`liderancas/[id]/page.tsx`) via `.bind(null, id)` dentro do componente `DeleteButton` (`@/components/delete-button`, já existe).

- [ ] **Step 1: Atualizar o import de `@/services/leaders` e adicionar o de `@/services/leader-access`**

No topo do arquivo, troque:

```ts
import { createLeader, updateLeader, deleteLeader, type LeaderInput } from "@/services/leaders"
```

por:

```ts
import { createLeader, updateLeader, deleteLeader, getLeaderById, type LeaderInput } from "@/services/leaders"
import { generateLeaderAccessToken, revokeLeaderAccess } from "@/services/leader-access"
```

- [ ] **Step 2: Remover o bloco de convite por e-mail e o bloco de hierarquia em `createLeaderAction`**

Substitua o corpo inteiro de `createLeaderAction` (da linha `export async function createLeaderAction(` até o `}` que a fecha, hoje linhas 76-214) por:

```ts
export async function createLeaderAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSessionUser()
  const role = session.profile.role as UserRole

  if (!can(role, "create", "leaders")) {
    return { error: "Seu perfil não pode cadastrar lideranças." }
  }

  const parsed = parseLeaderForm(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const coords = await resolveCoords(parsed.data)

  const supabase = await createClient()
  const input: LeaderInput = {
    ...parsed.data,
    email: parsed.data.email || null,
    birth_date: parsed.data.birth_date || null,
    latitude: coords.latitude,
    longitude: coords.longitude,
    leader_type: parsed.data.leader_type || null,
    influence_level: parsed.data.influence_level || null,
    expected_votes: parseVotes(parsed.data.expected_votes),
    admin_estimated_votes: parseVotes(parsed.data.admin_estimated_votes),
    polling_location_id: parsed.data.polling_location_id || null,
    neighborhood_id: parsed.data.neighborhood_id || null,
  }

  const leader = await createLeader(supabase, input, session.id, session.profile.organization_id)

  // Só admin_geral ganha o link de acesso automaticamente ao cadastrar —
  // admin_equipe também cadastra liderança, mas o link fica pendente até um
  // admin_geral gerar na tela de detalhe (mesma trava que já existia pro
  // convite por e-mail antes desta mudança). Ver
  // docs/08-acesso-lideranca-sem-senha.md §5.
  if (role === "admin_geral") {
    const admin = createAdminClient()
    try {
      await generateLeaderAccessToken(admin, leader, session.profile.organization_id)
    } catch {
      // A liderança já foi criada com sucesso — não desfaz o cadastro por
      // uma falha ao gerar o link; ela só fica "sem acesso" até o
      // admin_geral tentar de novo na tela de detalhe (botão "Gerar link de
      // acesso").
      revalidatePath("/liderancas")
      revalidatePath("/mapa")
      redirect(`/liderancas/${leader.id}?erro_link=1`)
    }
  }

  revalidatePath("/liderancas")
  revalidatePath("/mapa")
  redirect(`/liderancas/${leader.id}`)
}
```

- [ ] **Step 3: Adicionar as duas novas actions, depois de `deleteLeaderAction`**

No fim do arquivo, depois do `}` que fecha `deleteLeaderAction`:

```ts

/** Restrição igual à de configuracoes/usuarios/actions.ts (assertAdminGeral):
 * gerenciar o acesso de outra pessoa usa o client de service_role, então só
 * admin_geral pode chegar até aqui. */
export async function generateLeaderAccessLinkAction(
  leaderId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    return { error: "Apenas o Admin Geral pode gerenciar o acesso de lideranças." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }

  const admin = createAdminClient()
  try {
    await generateLeaderAccessToken(admin, leader, session.profile.organization_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao gerar o link de acesso." }
  }

  revalidatePath(`/liderancas/${leaderId}`)
  return { error: null }
}

export async function revokeLeaderAccessAction(
  leaderId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    return { error: "Apenas o Admin Geral pode gerenciar o acesso de lideranças." }
  }

  const supabase = await createClient()
  const leader = await getLeaderById(supabase, leaderId)
  if (!leader) {
    return { error: "Liderança não encontrada." }
  }

  const admin = createAdminClient()
  try {
    await revokeLeaderAccess(admin, leaderId, leader.user_id)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao revogar o acesso." }
  }

  revalidatePath(`/liderancas/${leaderId}`)
  return { error: null }
}
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
```

Esperado: 0 erros. Se aparecer erro em `deleteLeader` "declared but never read" ou similar, não é esperado — `deleteLeader` continua usado em `deleteLeaderAction`, que não foi tocado.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/liderancas/actions.ts"
git commit -m "feat: liderancas/actions.ts gera link automatico e permite revogar/gerar manual"
```

---

### Task 5: Remover o checkbox de convite do formulário e simplificar a página "Nova liderança"

**Files:**
- Modify: `src/app/(app)/liderancas/leader-form.tsx`
- Modify: `src/app/(app)/liderancas/novo/page.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: `LeaderForm` não aceita mais as props `hideAdminFields` nem `showInviteLoginOption` — se alguma outra task futura tentar passá-las, é erro de tipo (de propósito, pra pegar uso órfão).

- [ ] **Step 1: `leader-form.tsx` — remover o bloco do checkbox de convite**

Remova o bloco JSX inteiro (hoje logo depois do campo "E-mail"):

```tsx
        {showInviteLoginOption && (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-md border border-black/10 bg-black/[0.02] p-3">
            <input id="create_login" name="create_login" type="checkbox" className="mt-0.5 h-4 w-4" />
            <label htmlFor="create_login" className="text-sm">
              <span className="font-medium text-foreground">Criar acesso de login agora e enviar convite por e-mail</span>
              <br />
              <span className="text-xs text-foreground/50">
                Assim que ela definir a senha, já pode entrar no sistema e cadastrar apoiadores na própria rede —
                sem precisar de um segundo passo em Configurações &gt; Usuários.
              </span>
            </label>
          </div>
        )}
```

Também remova, no campo "E-mail" logo acima, o parágrafo condicional que só faz sentido com o checkbox:

```tsx
          {showInviteLoginOption && (
            <p className="mt-1 text-xs text-foreground/50">
              Necessário se você marcar &quot;criar acesso de login&quot; abaixo — é pra esse e-mail que o convite vai.
            </p>
          )}
```

- [ ] **Step 2: `leader-form.tsx` — remover as props `hideAdminFields` e `showInviteLoginOption`**

No tipo `LeaderFormProps`, remova estes dois campos (com seus comentários JSDoc):

```tsx
  /** Liderança cadastrando uma NOVA liderança (sua "filha" na hierarquia):
   * mesma restrição visual de isOwnRecord — quem decide influência/status/
   * permissão de ver atendimentos é sempre Admin Geral/Equipe, nunca quem
   * recrutou. A Server Action zera esses campos de qualquer forma (ver
   * liderancas/actions.ts), isto aqui é só pra não mostrar campo que a
   * escrita vai ignorar. */
  hideAdminFields?: boolean
  /** Só no cadastro (não na edição) e só pra quem pode convidar login
   * (admin_geral — mesma restrição de configuracoes/usuarios/actions.ts) —
   * mostra a opção de já criar o acesso e disparar o convite por e-mail
   * junto com o cadastro, sem precisar do passo separado em Configurações >
   * Usuários depois. */
  showInviteLoginOption?: boolean
```

Na assinatura da função `LeaderForm`, remova `hideAdminFields = false,` e `showInviteLoginOption = false,` dos parâmetros desestruturados.

Troque a condição que hoje esconde os campos administrativos:

```tsx
        {!isOwnRecord && !hideAdminFields && (
```

por:

```tsx
        {!isOwnRecord && (
```

- [ ] **Step 3: `novo/page.tsx` — simplificar**

Substitua o arquivo inteiro por:

```tsx
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { listNeighborhoods } from "@/services/neighborhoods"
import { can } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"
import { LeaderForm } from "../leader-form"
import { createLeaderAction } from "../actions"

export const metadata: Metadata = { title: "Nova liderança · Lidera+" }

export default async function NovaLiderancaPage() {
  const session = await getSessionUser()
  const role = session?.profile.role as UserRole
  if (!session || !can(role, "create", "leaders")) {
    redirect("/liderancas")
  }

  const supabase = await createClient()
  const neighborhoods = await listNeighborhoods(supabase)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Nova liderança</h1>
      <LeaderForm
        action={createLeaderAction} cancelHref="/liderancas"
        neighborhoods={neighborhoods.map((n) => ({ id: n.id, name: n.name }))}
      />
    </div>
  )
}
```

(Isso remove a mensagem "Essa liderança entra na sua rede..." e a variável `isLideranca`, que só faziam sentido quando `lideranca` conseguia chegar nesta página — agora `can(role, "create", "leaders")` já barra e redireciona antes disso, pra qualquer role que não seja admin_geral/admin_equipe.)

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm run build
```

Esperado: 0 erros nos dois. O build também confirma que nenhum outro arquivo ainda referencia `hideAdminFields`/`showInviteLoginOption` (já confirmado por grep nas Tasks anteriores, mas o build é a prova final).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/liderancas/leader-form.tsx" "src/app/(app)/liderancas/novo/page.tsx"
git commit -m "feat: remove convite por e-mail do formulario de lideranca"
```

---

### Task 6: Bloco "Acesso ao sistema" na tela de detalhe da liderança

**Files:**
- Modify: `src/app/(app)/liderancas/[id]/page.tsx`

**Interfaces:**
- Consumes: `generateLeaderAccessLinkAction`, `revokeLeaderAccessAction` de `../actions` (Task 4); `buildLeaderAccessLink` de `@/services/leader-access` (Task 3); `DeleteButton` de `@/components/delete-button` (já existe, já importado nesta página); `headers` de `next/headers`.
- Produces: nada consumido por outras tasks — é a ponta final da UI de admin_geral.

- [ ] **Step 1: Import novo e leitura do host**

No topo do arquivo, adicione:

```tsx
import { headers } from "next/headers"
import { buildLeaderAccessLink } from "@/services/leader-access"
```

e adicione `generateLeaderAccessLinkAction, revokeLeaderAccessAction` ao import já existente de `../actions`:

```tsx
import { deleteLeaderAction, generateLeaderAccessLinkAction, revokeLeaderAccessAction } from "../actions"
```

- [ ] **Step 2: Aceitar `erro_link` nos `searchParams`**

Troque a assinatura da página:

```tsx
  searchParams: Promise<{ convite?: string; promovido?: string; apoiador_mantido?: string }>
```

por:

```tsx
  searchParams: Promise<{ convite?: string; promovido?: string; apoiador_mantido?: string; erro_link?: string }>
```

e a desestruturação:

```tsx
  const { convite, promovido, apoiador_mantido: apoiadorMantido } = await searchParams
```

por:

```tsx
  const { convite, promovido, apoiador_mantido: apoiadorMantido, erro_link: erroLink } = await searchParams
```

- [ ] **Step 3: Calcular o link de acesso e a mensagem, logo depois de `const hasLinkedRecords = ...`**

```tsx
  const host = (await headers()).get("host") ?? ""
  const accessLink = leader.access_token ? buildLeaderAccessLink(host, leader.access_token) : null
  const accessMessage = accessLink
    ? `Oi, ${leader.name}! Aqui está seu acesso ao Lidera+: ${accessLink}\nÉ só clicar para entrar — não precisa de senha.`
    : ""
```

- [ ] **Step 4: Banner de erro, junto dos outros banners (`convite`/`promovido`)**

Logo depois do bloco `{promovido === "1" && (...)}`, adicione:

```tsx
      {erroLink === "1" && (
        <div className="rounded-lg border border-status-atrasada/30 bg-status-atrasada/10 p-4 text-sm text-status-atrasada">
          {leader.name} foi cadastrada, mas não foi possível gerar o link de acesso automaticamente. Gere
          manualmente no bloco &quot;Acesso ao sistema&quot; abaixo.
        </div>
      )}
```

- [ ] **Step 5: O bloco "Acesso ao sistema", só pra admin_geral**

Adicione logo antes do `<WhatsAppButton phone={leader.phone} message={...} />` que já existe no fim da página:

```tsx
      {role === "admin_geral" && (
        <div className="rounded-lg border border-black/5 bg-white p-6">
          <p className="mb-1 text-sm font-medium text-foreground">Acesso ao sistema</p>
          {accessLink ? (
            <>
              <p className="mb-3 text-xs text-foreground/50">
                Link de acesso ativo — {leader.name} entra direto pelo link, sem senha.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <WhatsAppButton phone={leader.phone} message={accessMessage} label="Enviar link pelo WhatsApp" />
                <DeleteButton
                  action={revokeLeaderAccessAction.bind(null, id)}
                  label="Revogar acesso"
                  tone="danger"
                  confirmMessage={`Revogar o acesso de ${leader.name}? O link atual para de funcionar e qualquer sessão aberta é encerrada em seguida.`}
                />
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-foreground/50">
                {leader.name} ainda não tem link de acesso — gere um para que ela entre no sistema sem senha.
              </p>
              <DeleteButton
                action={generateLeaderAccessLinkAction.bind(null, id)}
                label="Gerar link de acesso"
                tone="primary"
                confirmMessage={`Gerar um link de acesso para ${leader.name}?`}
              />
            </>
          )}
        </div>
      )}
```

- [ ] **Step 6: Verificar**

```bash
npm run typecheck
npm run build
```

Esperado: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/liderancas/[id]/page.tsx"
git commit -m "feat: bloco de acesso ao sistema na tela de detalhe da lideranca"
```

---

### Task 7: Rota de resgate do link, path público e mensagem de erro no login

**Files:**
- Create: `src/app/acesso-lideranca/[token]/route.ts`
- Modify: `src/lib/supabase/middleware.ts:15`
- Modify: `src/app/login/login-form.tsx`

**Interfaces:**
- Consumes: `createAdminClient` de `@/lib/supabase/admin` (já existe); reaproveita a rota já existente `src/app/auth/confirm/route.ts` (não modificada, só redirecionada para ela).
- Produces: nada consumido por outras tasks — é o fim da cadeia (a liderança clicando no link chega até aqui).

- [ ] **Step 1: Adicionar `/acesso-lideranca` a `PUBLIC_PATHS`**

Em `src/lib/supabase/middleware.ts`, troque:

```ts
const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth/confirm"]
```

por:

```ts
const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/auth/confirm", "/acesso-lideranca"]
```

(Sem isso, o middleware redireciona qualquer visitante não-logado pro `/login` antes mesmo de a rota nova rodar — o link nunca funcionaria.)

- [ ] **Step 2: Criar a rota de resgate**

```ts
// src/app/acesso-lideranca/[token]/route.ts
//
// Troca o token de acesso permanente de uma liderança (leaders.access_token,
// ver src/services/leader-access.ts) por uma sessão de verdade: gera um
// magic link do Supabase na hora (admin.generateLink) e delega a
// verificação (verifyOtp) pra rota já existente /auth/confirm, que já faz
// exatamente isso pra outros fluxos de e-mail deste projeto — ver
// docs/08-acesso-lideranca-sem-senha.md §7.
import { redirect } from "next/navigation"
import { type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: leader } = await admin
    .from("leaders")
    .select("user_id")
    .eq("access_token", token)
    .maybeSingle()

  if (!leader?.user_id) {
    redirect("/login?erro=link_invalido")
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(leader.user_id)
  if (userError || !userData.user?.email) {
    redirect("/login?erro=link_invalido")
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  })
  if (linkError || !linkData.properties?.hashed_token) {
    redirect("/login?erro=link_invalido")
  }

  redirect(
    `/auth/confirm?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink&next=/dashboard`,
  )
}
```

- [ ] **Step 3: Mensagem de erro em `login-form.tsx`**

Em `src/app/login/login-form.tsx`, ao lado de:

```tsx
  const contaInativa = searchParams.get("erro") === "conta_inativa"
```

adicione:

```tsx
  const linkInvalido = searchParams.get("erro") === "link_invalido"
```

E, ao lado do bloco `{contaInativa && (...)}`, adicione:

```tsx
      {linkInvalido && (
        <p className="rounded-md bg-status-atrasada/10 px-3 py-2 text-sm text-status-atrasada">
          Esse link de acesso não é mais válido. Peça ao Admin Geral da sua campanha para gerar um novo.
        </p>
      )}
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck
npm run build
```

Esperado: 0 erros. O build também confirma que a nova rota `/acesso-lideranca/[token]` aparece no output de rotas (procure por `ƒ /acesso-lideranca/[token]` na lista impressa pelo `next build`).

- [ ] **Step 5: Commit**

```bash
git add src/app/acesso-lideranca src/lib/supabase/middleware.ts src/app/login/login-form.tsx
git commit -m "feat: rota de resgate do link de acesso da lideranca"
```

---

### Task 8: Checklist de verificação manual ponta a ponta

Sem suíte de testes automatizados, feche o trabalho confirmando manualmente contra o banco real (`vqrnjiwansfobxaeswnu`) — use uma organização de teste, nunca um cliente real. Este checklist não gera commit, é só validação.

- [ ] **Step 1: Cadastrar uma liderança como admin_geral e conferir que o token saiu sozinho**

Cadastre uma liderança de teste pela UI (`/liderancas/novo`), logado como admin_geral de uma organização de teste. Depois, via `mcp__d8202e0f-7648-40ac-9db5-6b320cb8ad5c__execute_sql`:

```sql
select id, name, access_token, user_id from leaders where name = '<nome usado no teste>';
```

Esperado: `access_token` preenchido, `user_id` preenchido.

- [ ] **Step 2: Conferir o botão "Enviar link pelo WhatsApp" na tela de detalhe**

Abra `/liderancas/<id>` como admin_geral. Esperado: bloco "Acesso ao sistema" mostrando "Link de acesso ativo", com os botões "Enviar link pelo WhatsApp" e "Revogar acesso". Clicar em "Enviar link pelo WhatsApp" deve abrir `wa.me` numa aba nova com o número da liderança e a mensagem/link pré-preenchidos.

- [ ] **Step 3: Testar o link de acesso de verdade**

Copie o link mostrado (ou monte manualmente `https://<host>/acesso-lideranca/<access_token>` a partir do valor lido no Step 1) e abra numa janela anônima/outro navegador (sem sessão ativa). Esperado: cai direto em `/dashboard`, já logado como a liderança (confira no topo da tela/menu que aparece o nome dela e não o do admin_geral).

- [ ] **Step 4: Testar revogação**

De volta como admin_geral em `/liderancas/<id>`, clique "Revogar acesso" e confirme. Depois:

```sql
select access_token from leaders where id = '<id>';
-- esperado: null
```

Tente abrir o mesmo link antigo de novo (mesma janela anônima ou uma nova). Esperado: redireciona para `/login` com a mensagem "Esse link de acesso não é mais válido...".

- [ ] **Step 5: Testar "Gerar link de acesso" depois de revogado**

Ainda em `/liderancas/<id>`, clique "Gerar link de acesso". Esperado: volta a mostrar "Link de acesso ativo" com um link novo (diferente do revogado no Step 4) — confirme com a mesma query do Step 1 que `access_token` mudou de valor.

- [ ] **Step 6: Confirmar que liderança não cadastra mais liderança**

Logado como uma liderança (via o próprio link de acesso), confirme que o menu/lista "Lideranças" não mostra mais um botão "Nova liderança", e que navegar direto para `/liderancas/novo` redireciona de volta para `/liderancas`.

- [ ] **Step 7: Limpeza**

Apague a liderança de teste (e o login associado, se o teste não fizer isso sozinho) da organização de teste usada nos steps acima, pra não deixar dado de teste misturado com dado real.
