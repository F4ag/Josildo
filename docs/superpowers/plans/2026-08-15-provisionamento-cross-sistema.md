# Provisionamento Cross-Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um cliente é criado no Lidera+ (`/clientes/novo`), provisionar automaticamente o mesmo cliente em Cadastro Mestre, Bússola, Origem e Dashboard — cada um com seu próprio login — e propagar atualizações de cargo/número/ano quando o cliente preencher "Configurações > Eleição".

**Architecture:** Duas Server Actions existentes (`createClientAction`, `updateElectionSettings`) passam a chamar um orquestrador novo que roda 4 passos independentes (um por sistema externo), cada um idempotente e com resultado próprio — sem transação distribuída de verdade (não é possível entre bancos separados), só verificação de "já existe" antes de criar. Reaproveita os clients de service role já existentes em `src/lib/supabase/external-projects.ts`.

**Tech Stack:** Next.js 14 (App Router, Server Actions), `@supabase/supabase-js`, Zod.

## Global Constraints

- Nenhum novo sistema pode usar `service_role` fora de Server Actions/Route Handlers — mesma regra já em vigor no projeto.
- Cada sistema mantém login independente — nenhuma tentativa de sincronizar senha entre eles (decisão da Seção 6 da spec).
- Toda etapa do provisionamento precisa ser idempotente — rodar de novo (retry de uma etapa que falhou) nunca duplica o que já deu certo em outra.
- Cidade nova sem estrutura no Dashboard NÃO tenta criar a estrutura sozinha — só fica pendente.
- Design aprovado em `docs/superpowers/specs/2026-08-15-provisionamento-cross-sistema-design.md`. Divergências da Seção 3 daquele documento em relação a este plano (ver Task 5, Origem) são intencionais e justificadas — o pedido original do usuário exigia mais do que a tabela-resumo da spec registrou.

---

### Task 1: Migration — `organizations.cidade` no Lidera+

**Files:**
- Create: `supabase/migrations/2026-08-15_add_cidade_organizations.sql` (ou aplicar via MCP `apply_migration`, nome `add_cidade_organizations`, no projeto `vqrnjiwansfobxaeswnu`)

**Interfaces:**
- Produces: coluna `organizations.cidade text` (nullable — organizações existentes, como a raiz `lidera-mais`, não têm cidade).

- [ ] **Step 1: Escrever e aplicar a migration**

```sql
alter table public.organizations add column if not exists cidade text;
comment on column public.organizations.cidade is
  'Cidade onde o cliente atua — usada para propagar ao Cadastro Mestre e, no Dashboard, decidir se reaproveita uma estrutura territorial já mapeada (ver Task 4 do plano de provisionamento).';
```

- [ ] **Step 2: Validar**

```sql
select column_name from information_schema.columns
where table_name = 'organizations' and column_name = 'cidade';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-08-15_add_cidade_organizations.sql
git commit -m "feat(db): adiciona organizations.cidade"
```

---

### Task 2: Formulário "novo cliente" — campo cidade

**Files:**
- Modify: `src/lib/validations/organization.ts`
- Modify: `src/app/(app)/clientes/novo/client-form.tsx`

**Interfaces:**
- Produces: `createOrganizationSchema` passa a incluir `cidade`; `client-form.tsx` envia o campo.

- [ ] **Step 1: Ampliar o schema Zod** (`src/lib/validations/organization.ts:10-19`)

Trocar:
```ts
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente/organização."),
  slug: z
    .string()
    .min(2, "Informe o subdomínio.")
    .max(63, "Subdomínio muito longo.")
    .regex(slugRegex, "Use só letras minúsculas, números e hífen (ex.: nome-do-cliente)."),
  admin_full_name: z.string().min(3, "Informe o nome do responsável (Admin Geral)."),
  admin_email: z.string().min(1, "Informe o e-mail do responsável.").email("E-mail inválido."),
})
```
Por:
```ts
export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente/organização."),
  slug: z
    .string()
    .min(2, "Informe o subdomínio.")
    .max(63, "Subdomínio muito longo.")
    .regex(slugRegex, "Use só letras minúsculas, números e hífen (ex.: nome-do-cliente)."),
  cidade: z.string().min(2, "Informe a cidade onde o cliente atua."),
  admin_full_name: z.string().min(3, "Informe o nome do responsável (Admin Geral)."),
  admin_email: z.string().min(1, "Informe o e-mail do responsável.").email("E-mail inválido."),
})
```

- [ ] **Step 2: Adicionar o campo no formulário** (`client-form.tsx`, logo após o bloco de "Subdomínio", antes do `<div className="border-t...">` de Responsável — depois da linha 90)

```tsx
      <div>
        <label htmlFor="cidade" className="mb-1 block text-sm font-medium">Cidade</label>
        <input
          id="cidade" name="cidade" required
          placeholder="Ex.: Olinda"
          className="w-full rounded-md border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-xs text-foreground/50">
          Cidade onde este cliente atua — usada para provisionar o cliente nos outros sistemas do ecossistema.
        </p>
      </div>
```

- [ ] **Step 3: Rodar localmente e confirmar que o campo aparece e valida (tentar submeter vazio deve mostrar o erro)**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations/organization.ts src/app/\(app\)/clientes/novo/client-form.tsx
git commit -m "feat: campo cidade no formulario de novo cliente"
```

---

### Task 3: Tipos e cliente Cadastro Mestre do provisionamento

**Files:**
- Create: `src/services/provisioning/types.ts`
- Create: `src/services/provisioning/cadastro-mestre.ts`

**Interfaces:**
- Produces: `ProvisioningStepResult = { status: 'ok' } | { status: 'erro'; mensagem: string }`; `provisionarCadastroMestre(input): Promise<ProvisioningStepResult & { clienteId?: string }>`.

- [ ] **Step 1: Tipos compartilhados**

```ts
// src/services/provisioning/types.ts
export type ProvisioningStepResult =
  | { status: "ok" }
  | { status: "erro"; mensagem: string }

export type ProvisioningInput = {
  organizationId: string // id da organization no Lidera+ — usado como identificador_externo
  nome: string
  cidade: string
  adminEmail: string
  adminNome: string
}
```

- [ ] **Step 2: Passo do Cadastro Mestre**

```ts
// src/services/provisioning/cadastro-mestre.ts
import "server-only"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

/**
 * Idempotente: identifica um cliente já provisionado por este mesmo
 * organizationId do Lidera+ via integracao_sistema (sistema='lidera_mais').
 * Se já existir, reaproveita — nunca cria um cliente duplicado ao reexecutar
 * uma etapa que falhou depois desta.
 */
export async function provisionarCadastroMestre(
  input: ProvisioningInput,
): Promise<ProvisioningStepResult & { clienteId?: string }> {
  const cm = createCadastroMestreClient()

  const { data: existente, error: buscaError } = await cm
    .from("integracao_sistema")
    .select("cliente_id")
    .eq("sistema", "lidera_mais")
    .eq("identificador_externo", input.organizationId)
    .maybeSingle()

  if (buscaError) {
    return { status: "erro", mensagem: `Falha ao checar cliente existente: ${buscaError.message}` }
  }
  if (existente) {
    return { status: "ok", clienteId: existente.cliente_id }
  }

  const { data: cliente, error: clienteError } = await cm
    .from("cliente")
    .insert({ nome: input.nome, cidade: input.cidade })
    .select("id")
    .single()

  if (clienteError) {
    return { status: "erro", mensagem: `Falha ao criar cliente: ${clienteError.message}` }
  }

  const { error: campanhaError } = await cm
    .from("campanha")
    .insert({ cliente_id: cliente.id, nome: "Campanha", status: "planejamento" })

  if (campanhaError) {
    return { status: "erro", mensagem: `Falha ao criar campanha: ${campanhaError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: cliente.id,
    sistema: "lidera_mais",
    identificador_externo: input.organizationId,
  })

  if (integracaoError) {
    return { status: "erro", mensagem: `Falha ao registrar integração: ${integracaoError.message}` }
  }

  return { status: "ok", clienteId: cliente.id }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/provisioning/types.ts src/services/provisioning/cadastro-mestre.ts
git commit -m "feat: passo de provisionamento do Cadastro Mestre"
```

---

### Task 4: Passos de Bússola, Origem e Dashboard

**Files:**
- Create: `src/services/provisioning/bussola.ts`
- Create: `src/services/provisioning/origem.ts`
- Create: `src/services/provisioning/dashboard.ts`

**Interfaces:**
- Consumes: `clienteId` retornado pelo Task 3 (usado para checar/gravar `integracao_sistema`).
- Produces: `provisionarBussola`, `provisionarOrigem`, `provisionarDashboard` — mesma assinatura `(input, clienteId) => Promise<ProvisioningStepResult>`.

- [ ] **Step 1: Bússola — organização + convite**

```ts
// src/services/provisioning/bussola.ts
import "server-only"
import { createBussolaClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export async function provisionarBussola(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "bussola")
    .maybeSingle()
  if (jaFeito) return { status: "ok" }

  const bussola = createBussolaClient()
  const { data: org, error: orgError } = await bussola
    .from("organizacoes")
    .insert({ nome: input.nome, slug: input.organizationId })
    .select("id")
    .single()
  if (orgError) return { status: "erro", mensagem: `Bússola (organização): ${orgError.message}` }

  const { data: invited, error: inviteError } = await bussola.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    await bussola.from("organizacoes").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Bússola (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  const { error: perfilError } = await bussola.from("perfis").insert({
    id: invited.user.id,
    nome: input.adminNome,
    email: input.adminEmail,
    papel: "admin",
    organization_id: org.id,
    ativo: true,
  })
  if (perfilError) {
    await bussola.auth.admin.deleteUser(invited.user.id)
    await bussola.from("organizacoes").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Bússola (perfil): ${perfilError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "bussola",
    identificador_externo: org.id,
  })
  if (integracaoError) return { status: "erro", mensagem: `Bússola (registrar integração): ${integracaoError.message}` }

  return { status: "ok" }
}
```

(`slug: input.organizationId` como valor único e estável pro `organizacoes.slug` — evita colisão de nome entre clientes; `organizacoes.slug` não é usado como subdomínio hoje, então não precisa ser "bonito".)

- [ ] **Step 2: Origem — organização + membro + `brand_project`**

> **Nota:** a Seção 3 da spec listava só `organizations` + `organization_members` para o
> Origem. Isso ficou incompleto — o pedido original ("o político já vai aparecer
> dentro da plataforma") exige um `brand_projects` também, não só a organização vazia.
> Corrigido aqui.

```ts
// src/services/provisioning/origem.ts
import "server-only"
import { createOrigemClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export async function provisionarOrigem(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "origem")
    .maybeSingle()
  if (jaFeito) return { status: "ok" }

  const origem = createOrigemClient()
  const { data: org, error: orgError } = await origem
    .from("organizations")
    .insert({ name: input.nome })
    .select("id")
    .single()
  if (orgError) return { status: "erro", mensagem: `Origem (organização): ${orgError.message}` }

  const { error: projectError } = await origem
    .from("brand_projects")
    .insert({ organization_id: org.id, name: input.nome, status: "draft" })
  if (projectError) {
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (projeto de marca): ${projectError.message}` }
  }

  const { data: invited, error: inviteError } = await origem.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  const { error: memberError } = await origem
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: invited.user.id, role: "owner" })
  if (memberError) {
    await origem.auth.admin.deleteUser(invited.user.id)
    await origem.from("organizations").delete().eq("id", org.id)
    return { status: "erro", mensagem: `Origem (membro): ${memberError.message}` }
  }

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "origem",
    identificador_externo: org.id,
  })
  if (integracaoError) return { status: "erro", mensagem: `Origem (registrar integração): ${integracaoError.message}` }

  return { status: "ok" }
}
```

- [ ] **Step 3: Dashboard — perfil + clonagem de território (se a cidade já tiver estrutura)**

```ts
// src/services/provisioning/dashboard.ts
import "server-only"
import { createDashboardClient, createCadastroMestreClient } from "@/lib/supabase/external-projects"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

async function clonarTerritorioDaCidade(
  dashboard: ReturnType<typeof createDashboardClient>,
  cidadeReferencia: string,
  clienteIdNovo: string,
): Promise<ProvisioningStepResult> {
  // Acha um cliente_id existente que já tenha RPAs na mesma cidade — usa
  // cliente.cidade do Cadastro Mestre pra decidir, mas a comparação de
  // "mesma estrutura" aqui é simplificada: qualquer cliente_id com RPAs é
  // candidato a template (hoje só existe uma cidade por cliente_id). Se um
  // dia houver múltiplos clientes na mesma cidade, o primeiro encontrado
  // vira o template — comportamento aceitável dado o volume atual (2
  // clientes).
  const cm = createCadastroMestreClient()
  const { data: clientesNaCidade } = await cm
    .from("cliente")
    .select("id")
    .eq("cidade", cidadeReferencia)
    .neq("id", clienteIdNovo)

  if (!clientesNaCidade || clientesNaCidade.length === 0) {
    return { status: "ok" } // cidade nova, sem estrutura — fica pendente de propósito
  }

  const { data: rpasTemplate } = await dashboard
    .from("rpas")
    .select("numero, nome, meta_ativa, observacoes")
    .eq("cliente_id", clientesNaCidade[0].id)

  if (!rpasTemplate || rpasTemplate.length === 0) {
    return { status: "ok" } // cliente daquela cidade existe mas ainda não tem território no Dashboard
  }

  for (const rpaTemplate of rpasTemplate) {
    const { data: novaRpa, error: rpaError } = await dashboard
      .from("rpas")
      .insert({ ...rpaTemplate, cliente_id: clienteIdNovo })
      .select("id")
      .single()
    if (rpaError) return { status: "erro", mensagem: `Dashboard (clonar RPA ${rpaTemplate.numero}): ${rpaError.message}` }

    const { data: bairrosTemplate } = await dashboard
      .from("bairros")
      .select("nome, tipo, prioridade")
      .eq("rpa_id", (await dashboard.from("rpas").select("id").eq("cliente_id", clientesNaCidade[0].id).eq("numero", rpaTemplate.numero).single()).data?.id)

    for (const bairro of bairrosTemplate ?? []) {
      const { error: bairroError } = await dashboard.from("bairros").insert({ ...bairro, rpa_id: novaRpa.id })
      if (bairroError) return { status: "erro", mensagem: `Dashboard (clonar bairro ${bairro.nome}): ${bairroError.message}` }
    }
  }

  return { status: "ok" }
}

export async function provisionarDashboard(
  input: ProvisioningInput,
  clienteId: string,
): Promise<ProvisioningStepResult> {
  const cm = createCadastroMestreClient()
  const { data: jaFeito } = await cm
    .from("integracao_sistema")
    .select("identificador_externo")
    .eq("cliente_id", clienteId)
    .eq("sistema", "dashboard")
    .maybeSingle()
  if (jaFeito) return { status: "ok" }

  const dashboard = createDashboardClient()
  const { data: invited, error: inviteError } = await dashboard.auth.admin.inviteUserByEmail(input.adminEmail)
  if (inviteError || !invited.user) {
    return { status: "erro", mensagem: `Dashboard (convite): ${inviteError?.message ?? "erro desconhecido"}` }
  }

  const { error: perfilError } = await dashboard.from("perfis").insert({
    id: invited.user.id,
    nome: input.adminNome,
    email: input.adminEmail,
    papel: "admin",
    cliente_id: clienteId,
    ativo: true,
  })
  if (perfilError) {
    await dashboard.auth.admin.deleteUser(invited.user.id)
    return { status: "erro", mensagem: `Dashboard (perfil): ${perfilError.message}` }
  }

  const clonagem = await clonarTerritorioDaCidade(dashboard, input.cidade, clienteId)
  if (clonagem.status === "erro") return clonagem

  const { error: integracaoError } = await cm.from("integracao_sistema").insert({
    cliente_id: clienteId,
    sistema: "dashboard",
    identificador_externo: clienteId, // Dashboard usa cliente_id direto, sem id proprio de organizacao
  })
  if (integracaoError) return { status: "erro", mensagem: `Dashboard (registrar integração): ${integracaoError.message}` }

  return { status: "ok" }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/services/provisioning/bussola.ts src/services/provisioning/origem.ts src/services/provisioning/dashboard.ts
git commit -m "feat: passos de provisionamento de Bussola, Origem e Dashboard"
```

---

### Task 5: Orquestrador + integração em `createClientAction`

**Files:**
- Create: `src/services/provisioning/orchestrator.ts`
- Modify: `src/app/(app)/clientes/actions.ts`

**Interfaces:**
- Consumes: `provisionarCadastroMestre`, `provisionarBussola`, `provisionarOrigem`, `provisionarDashboard` (Tasks 3–4).
- Produces: `type ProvisioningReport = { cadastroMestre: ProvisioningStepResult; bussola: ProvisioningStepResult; origem: ProvisioningStepResult; dashboard: ProvisioningStepResult }`; `provisionarClienteCrossSistema(input: ProvisioningInput): Promise<ProvisioningReport>`.

- [ ] **Step 1: Orquestrador**

```ts
// src/services/provisioning/orchestrator.ts
import "server-only"
import { provisionarCadastroMestre } from "./cadastro-mestre"
import { provisionarBussola } from "./bussola"
import { provisionarOrigem } from "./origem"
import { provisionarDashboard } from "./dashboard"
import type { ProvisioningInput, ProvisioningStepResult } from "./types"

export type ProvisioningReport = {
  cadastroMestre: ProvisioningStepResult
  bussola: ProvisioningStepResult
  origem: ProvisioningStepResult
  dashboard: ProvisioningStepResult
}

// Cadastro Mestre sempre primeiro — os outros 3 dependem do clienteId dele
// pra checar idempotência (integracao_sistema). Bússola/Origem/Dashboard
// rodam em paralelo entre si: são independentes um do outro.
export async function provisionarClienteCrossSistema(input: ProvisioningInput): Promise<ProvisioningReport> {
  const cmResult = await provisionarCadastroMestre(input)

  if (cmResult.status === "erro" || !cmResult.clienteId) {
    const naoIniciado: ProvisioningStepResult = { status: "erro", mensagem: "Não iniciado — Cadastro Mestre falhou primeiro." }
    return { cadastroMestre: cmResult, bussola: naoIniciado, origem: naoIniciado, dashboard: naoIniciado }
  }

  const [bussola, origem, dashboard] = await Promise.all([
    provisionarBussola(input, cmResult.clienteId),
    provisionarOrigem(input, cmResult.clienteId),
    provisionarDashboard(input, cmResult.clienteId),
  ])

  return { cadastroMestre: cmResult, bussola, origem, dashboard }
}
```

- [ ] **Step 2: Chamar o orquestrador em `createClientAction`** (`src/app/(app)/clientes/actions.ts`)

Adicionar o import no topo do arquivo:
```ts
import { provisionarClienteCrossSistema } from "@/services/provisioning/orchestrator"
import type { ProvisioningReport } from "@/services/provisioning/orchestrator"
```

Trocar o tipo de retorno da action (linha 19-23):
```ts
export type CreateClientActionState = {
  error: string | null
  success?: boolean
  slug?: string
}
```
Por:
```ts
export type CreateClientActionState = {
  error: string | null
  success?: boolean
  slug?: string
  provisioning?: ProvisioningReport
  provisioningInput?: import("@/services/provisioning/types").ProvisioningInput
}
```

(`provisioningInput` guarda os dados usados no provisionamento — necessário pro botão de retry do Task 6 poder chamar a etapa de novo sem pedir os campos outra vez.)

No final da função `createClientAction`, trocar (linha 92-93):
```ts
  revalidatePath("/clientes")
  return { error: null, success: true, slug: org.slug }
```
Por:
```ts
  const cidade = formData.get("cidade") as string
  const provisioningInput = {
    organizationId: org.id,
    nome: name,
    cidade,
    adminEmail: admin_email,
    adminNome: admin_full_name,
  }
  const provisioning = await provisionarClienteCrossSistema(provisioningInput)

  revalidatePath("/clientes")
  return { error: null, success: true, slug: org.slug, provisioning, provisioningInput }
```

- [ ] **Step 3: Rodar localmente com um cliente de teste completo e confirmar no log (ou via MCP) que as 4 linhas de `integracao_sistema` foram criadas**

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/services/provisioning/orchestrator.ts src/app/\(app\)/clientes/actions.ts
git commit -m "feat: orquestrador de provisionamento cross-sistema, chamado ao criar cliente"
```

---

### Task 6: Ação de retry por etapa + UI de status

**Files:**
- Modify: `src/app/(app)/clientes/actions.ts`
- Modify: `src/app/(app)/clientes/novo/client-form.tsx`

**Interfaces:**
- Produces: `retryProvisioningStepAction(input: ProvisioningInput, etapa: 'bussola' | 'origem' | 'dashboard'): Promise<ProvisioningStepResult>` (Cadastro Mestre não tem retry próprio — se ele falhar, as outras 3 etapas nem chegam a rodar, então repetir o formulário inteiro já resolve).

- [ ] **Step 1: Action de retry** (adicionar em `src/app/(app)/clientes/actions.ts`)

Resolve o `clienteId` de novo a partir do `organizationId` (mesma consulta idempotente
já usada dentro de `provisionarCadastroMestre`) — assim o retry não depende de guardar
`clienteId` em nenhum outro lugar, só o `organizationId` que já está em
`provisioningInput`.

```ts
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import { provisionarBussola } from "@/services/provisioning/bussola"
import { provisionarOrigem } from "@/services/provisioning/origem"
import { provisionarDashboard } from "@/services/provisioning/dashboard"
import type { ProvisioningInput, ProvisioningStepResult } from "@/services/provisioning/types"

const RETRY_STEPS = { bussola: provisionarBussola, origem: provisionarOrigem, dashboard: provisionarDashboard } as const

export async function retryProvisioningStepAction(
  input: ProvisioningInput,
  etapa: keyof typeof RETRY_STEPS,
): Promise<ProvisioningStepResult> {
  await assertPlatformAdmin()

  const cm = createCadastroMestreClient()
  const { data: integracao, error } = await cm
    .from("integracao_sistema")
    .select("cliente_id")
    .eq("sistema", "lidera_mais")
    .eq("identificador_externo", input.organizationId)
    .maybeSingle()

  if (error || !integracao) {
    return { status: "erro", mensagem: "Cadastro Mestre ainda não foi provisionado para este cliente — não é possível repetir esta etapa isoladamente." }
  }

  return RETRY_STEPS[etapa](input, integracao.cliente_id)
}
```

- [ ] **Step 2: Mostrar o status das 4 etapas + botão de retry funcional na tela de sucesso** (`client-form.tsx`, dentro do bloco `if (state.success)`)

Trocar (linhas 48-61):
```tsx
  if (state.success) {
    return (
      <div className="max-w-lg rounded-lg border border-black/5 bg-white p-6">
        <p className="text-sm text-foreground/80">
          Cliente criado. O responsável vai receber um e-mail para definir a senha. Assim que
          entrar, o acesso já vai estar isolado em{" "}
          <strong>{state.slug}.{ROOT_DOMAIN}</strong>.
        </p>
        <Link href="/clientes" className="mt-4 inline-block text-sm text-secondary hover:underline">
          Voltar para a lista de clientes
        </Link>
      </div>
    )
  }
```
Por:
```tsx
  if (state.success) {
    return (
      <div className="max-w-lg space-y-4 rounded-lg border border-black/5 bg-white p-6">
        <p className="text-sm text-foreground/80">
          Cliente criado. O responsável vai receber um e-mail para definir a senha. Assim que
          entrar, o acesso já vai estar isolado em{" "}
          <strong>{state.slug}.{ROOT_DOMAIN}</strong>.
        </p>
        {state.provisioning && state.provisioningInput && (
          <ProvisioningStatus report={state.provisioning} input={state.provisioningInput} />
        )}
        <Link href="/clientes" className="inline-block text-sm text-secondary hover:underline">
          Voltar para a lista de clientes
        </Link>
      </div>
    )
  }
```

Adicionar o componente `ProvisioningStatus` no final do arquivo — client component com
estado próprio, porque o retry precisa atualizar só a linha daquela etapa sem
resubmeter o formulário inteiro:

`useState` já está importado no topo do arquivo (linha 3) — só adicionar os dois
imports novos junto dos existentes:

```tsx
import { retryProvisioningStepAction } from "../actions"
import type { ProvisioningReport } from "@/services/provisioning/orchestrator"
import type { ProvisioningInput, ProvisioningStepResult } from "@/services/provisioning/types"

const STEP_LABELS: Record<keyof ProvisioningReport, string> = {
  cadastroMestre: "Cadastro Mestre",
  bussola: "Bússola",
  origem: "Origem",
  dashboard: "Dashboard",
}

const RETRYABLE_STEPS = ["bussola", "origem", "dashboard"] as const

function ProvisioningStatus({ report, input }: { report: ProvisioningReport; input: ProvisioningInput }) {
  const [results, setResults] = useState(report)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function retry(etapa: (typeof RETRYABLE_STEPS)[number]) {
    setRetrying(etapa)
    const result = await retryProvisioningStepAction(input, etapa)
    setResults((prev) => ({ ...prev, [etapa]: result }))
    setRetrying(null)
  }

  return (
    <div className="rounded-md border border-black/5 bg-black/[0.02] p-3">
      <p className="mb-2 text-xs font-medium uppercase text-foreground/50">Provisionamento nos outros sistemas</p>
      <ul className="space-y-1">
        {(Object.keys(STEP_LABELS) as (keyof ProvisioningReport)[]).map((key) => {
          const result: ProvisioningStepResult = results[key]
          const canRetry = result.status === "erro" && (RETRYABLE_STEPS as readonly string[]).includes(key)
          return (
            <li key={key} className="flex items-center justify-between text-sm">
              <span>{STEP_LABELS[key]}</span>
              <span className="flex items-center gap-2">
                {result.status === "ok" ? (
                  <span className="text-secondary">✓ Pronto</span>
                ) : (
                  <span className="text-status-atrasada" title={result.mensagem}>✗ Falhou</span>
                )}
                {canRetry && (
                  <button
                    type="button"
                    disabled={retrying === key}
                    onClick={() => retry(key as (typeof RETRYABLE_STEPS)[number])}
                    className="rounded border border-black/10 px-2 py-0.5 text-xs hover:bg-black/5 disabled:opacity-60"
                  >
                    {retrying === key ? "Tentando..." : "Tentar de novo"}
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Testar visualmente** — criar um cliente e conferir que a lista de status aparece com os 4 itens "✓ Pronto". Depois, provocar uma falha proposital numa etapa (ex.: comentar temporariamente a chamada de `inviteUserByEmail` do Bússola pra forçar erro) e confirmar que só aquela linha mostra "✗ Falhou" com o botão "Tentar de novo" funcionando — clicar deve trocar pra "✓ Pronto" sem precisar recarregar a página nem resubmeter o formulário.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/clientes/actions.ts src/app/\(app\)/clientes/novo/client-form.tsx
git commit -m "feat: exibe status do provisionamento por sistema apos criar cliente"
```

---

### Task 7: Gatilho 2 — propagar "Configurações > Eleição"

**Files:**
- Modify: `src/app/(app)/configuracoes/eleicao/actions.ts`

**Interfaces:**
- Consumes: `createCadastroMestreClient` (de `external-projects.ts`).

- [ ] **Step 1: Mapear o enum de cargo do Lidera+ para o texto livre do Cadastro Mestre, e propagar após salvar**

Trocar (arquivo inteiro, adicionando o mapeamento e a propagação após o update local):
```ts
"use server"

import { revalidatePath } from "next/cache"
import { requireSessionUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { createCadastroMestreClient } from "@/lib/supabase/external-projects"
import { electionSettingsSchema } from "@/lib/validations/election"
import type { ActionState } from "@/app/login/actions"

async function assertAdminGeral() {
  const session = await requireSessionUser()
  if (session.profile.role !== "admin_geral") {
    throw new Error("Apenas o Admin Geral pode configurar a eleição.")
  }
  return session
}

// election_cargo no Lidera+ é um CHECK constraint (snake_case); campanha.cargo
// no Cadastro Mestre é texto livre capitalizado (ver supabase/schema.sql do
// Cadastro Mestre, Seção 2, tabela campanha). Sem esse mapa, o Cadastro
// Mestre receberia "deputado_federal" em vez de "Deputado Federal".
const CARGO_LABELS: Record<string, string> = {
  prefeito: "Prefeito",
  vice_prefeito: "Vice-Prefeito",
  vereador: "Vereador",
  governador: "Governador",
  vice_governador: "Vice-Governador",
  senador: "Senador",
  deputado_federal: "Deputado Federal",
  deputado_estadual: "Deputado Estadual",
}

export async function updateElectionSettings(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await assertAdminGeral()

  const parsed = electionSettingsSchema.safeParse({
    election_year: formData.get("election_year"),
    election_cargo: formData.get("election_cargo"),
    election_candidate_number: formData.get("election_candidate_number"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", session.profile.organization_id)

  if (error) {
    return { error: `Não foi possível salvar: ${error.message}` }
  }

  // Propaga pro Cadastro Mestre — não bloqueia a resposta se falhar (dado já
  // está salvo aqui, que é o que importa pro usuário); só loga pra
  // diagnóstico manual depois.
  try {
    const cm = createCadastroMestreClient()
    const { data: integracao } = await cm
      .from("integracao_sistema")
      .select("cliente_id")
      .eq("sistema", "lidera_mais")
      .eq("identificador_externo", session.profile.organization_id)
      .maybeSingle()

    if (integracao) {
      await cm
        .from("campanha")
        .update({
          cargo: parsed.data.election_cargo ? CARGO_LABELS[parsed.data.election_cargo] : null,
          numero_urna: parsed.data.election_candidate_number,
          ano_eleicao: parsed.data.election_year,
        })
        .eq("cliente_id", integracao.cliente_id)
    }
  } catch (propagationError) {
    console.error("[eleicao] falha ao propagar pro Cadastro Mestre:", propagationError)
  }

  revalidatePath("/configuracoes/eleicao")
  return { error: null, success: true }
}
```

- [ ] **Step 2: Testar** — editar cargo/número/ano de um cliente já provisionado (Task 5/6), confirmar via MCP que `campanha` no Cadastro Mestre foi atualizada com o cargo capitalizado certo.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/configuracoes/eleicao/actions.ts
git commit -m "feat: propaga cargo/numero/ano para o Cadastro Mestre ao salvar eleicao"
```

---

### Task 8: Teste de ponta a ponta + idempotência

**Files:**
- Nenhum novo — validação manual contra os bancos reais.

- [ ] **Step 1: Criar um cliente de teste completo** pelo formulário (`/clientes/novo`), com uma cidade que já tem estrutura (ex.: "Olinda").

- [ ] **Step 2: Confirmar nos 4 sistemas** (via MCP Supabase, um projeto por vez):
  - Cadastro Mestre: `cliente` + `campanha` (status `planejamento`) + 1 linha de `integracao_sistema` por sistema.
  - Bússola: `organizacoes` + `perfis` (papel `admin`) + convite enviado.
  - Origem: `organizations` + `organization_members` (role `owner`) + `brand_projects` (status `draft`).
  - Dashboard: `perfis` com `cliente_id` certo + RPAs/bairros clonados de Olinda, com metas/resultados vazios (não clonados).

- [ ] **Step 3: Testar idempotência** — chamar `provisionarClienteCrossSistema` de novo manualmente com o mesmo `organizationId` (via um script ad-hoc ou re-executando a action) e confirmar que nenhuma linha duplica em nenhum dos 4 sistemas.

- [ ] **Step 4: Testar Gatilho 2** — editar cargo/número/ano do cliente de teste em "Configurações > Eleição", confirmar propagação.

- [ ] **Step 5: Testar cidade sem estrutura** — criar um segundo cliente de teste numa cidade que não existe em nenhum `cliente.cidade` ainda (ex.: "Recife"). Confirmar que os outros 3 sistemas são provisionados normalmente, e que o Dashboard fica com o `perfis` criado mas **sem** nenhuma linha em `rpas` — sem erro, sem tentativa de adivinhar a estrutura.

- [ ] **Step 6: Limpar os dados de teste** dos dois clientes de teste, nos 4 sistemas + Lidera+ (usar `deleteClientAction` existente para a organização do Lidera+; apagar manualmente as linhas correspondentes nos outros 3, já que não existe cascade cross-projeto).

- [ ] **Step 7: Reportar de volta** — qualquer divergência encontrada entre o plano e o comportamento real (nomes de coluna, RLS bloqueando alguma escrita do service role que não deveria, etc.).
