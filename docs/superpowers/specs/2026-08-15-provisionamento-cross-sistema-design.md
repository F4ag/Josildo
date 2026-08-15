# Provisionamento automático cross-sistema — Design

**Status:** aprovado, aguardando plano de implementação.
**Data:** 2026-08-15
**Repositório de implementação:** `lidera-mais` (é de onde os dois gatilhos partem).

## 1. Objetivo

Hoje, cadastrar um cliente novo no ecossistema (Lidera+, Bússola, Origem, Dashboard,
Cadastro Mestre) é manual: cada sistema recebe o cliente cadastrado à parte, e o
vínculo entre eles (`integracao_sistema`, no Cadastro Mestre) é preenchido à mão —
já encontramos "sujeira" nisso durante a etapa anterior (identificador do Dashboard do
Ricardo apontando pro project ref em vez de um cliente_id real).

Objetivo: quando um cliente é criado no Lidera+, ele aparece automaticamente nos
outros 3 sistemas (Origem, Bússola, Dashboard), com login próprio criado em cada um,
sem cadastro manual repetido.

**Fora de escopo nesta etapa:**
- Login único de verdade (SSO) entre os sistemas — decisão explícita: cada sistema
  mantém autenticação independente (ver Seção 6). SSO real (via `signInWithIdToken`
  ou equivalente) fica como iniciativa separada, se algum dia for priorizada.
- Criar estrutura territorial nova no Dashboard para uma cidade que ainda não tem
  RPAs/bairros mapeados — isso continua sendo um pedido manual à parte (ver Seção 4).
- Automação do diagnóstico do Origem (Portal do Político → relatório em PDF) — fica
  para uma etapa própria, depois desta.
- Pesquisa na internet no Bússola (para o formulário "Novo Alvo") — feature própria,
  não faz parte do provisionamento.
- Multi-tenant do Dashboard em si — spec e plano já existem separadamente
  (`2026-08-15-dashboard-multi-tenant-design.md`, no repositório do Dashboard) e
  continuam válidos; este provisionamento assume que o Dashboard já sabe isolar por
  `cliente_id` (o que já está implementado em produção, descoberto durante a
  auditoria dessa outra etapa).

## 2. Dois gatilhos

### Gatilho 1 — criar cliente (`/clientes/novo`, F4 admin)

Formulário ampliado: nome, slug, **cidade**, e-mail do admin (cargo/número/ano **não**
entram aqui — ver Gatilho 2). Ao salvar, dispara a propagação síncrona (Seção 3).

### Gatilho 2 — salvar "Configurações > Eleição" (cliente edita, no próprio subdomínio)

Tela já existe e já funciona (`configuracoes/eleicao`, hoje só grava localmente no
Lidera+). Passa a também propagar `cargo`/`numero_urna`/`ano_eleicao` como `UPDATE`
para `campanha` no Cadastro Mestre, e para os sistemas que precisarem desse dado.

## 3. O que cada sistema recebe (Gatilho 1)

| Sistema | Cria | Convite de login |
|---|---|---|
| Cadastro Mestre | `cliente` (nome, cidade) + `campanha` (cargo/numero_urna/ano_eleicao `null`, status `planejamento`) + `integracao_sistema` (uma linha por sistema, preenchida conforme cada etapa concluir) | — (não tem login próprio) |
| Bússola | `organizacoes` (nome, slug) | admin, papel `admin` |
| Origem | `organizations` (name) + `organization_members` | admin, role `owner` |
| Dashboard | `perfis` com `cliente_id` correto + clone das RPAs/bairros **se** a cidade já tiver estrutura mapeada (ver Seção 4) | admin, papel `admin` |

O convite do admin dentro do próprio Lidera+ já existe hoje
(`/configuracoes/usuarios`) — não faz parte deste trabalho.

## 4. Dashboard — clonar estrutura de cidade

Quando a cidade informada no Gatilho 1 já tem RPAs/bairros mapeados (Olinda/Paulista
hoje): clonar essas linhas para o `cliente_id` novo — cada cliente precisa das suas
próprias linhas (metas/resultados são rastreados por cliente, não dá pra compartilhar
a mesma linha de `rpas`/`bairros` entre dois clientes). A clonagem copia a
estrutura (números de RPA, nomes de bairro, tipo, prioridade) sem copiar
metas/resultados/líderes/grupos — o cliente novo começa com território mapeado mas
zerado operacionalmente.

Quando a cidade é nova, sem estrutura: **não é automático**. O provisionamento cria o
cliente normalmente nos outros 3 sistemas, mas o Dashboard fica sem território
mapeado até alguém (a Agência F4) pedir explicitamente pra desenhar a divisão
territorial daquela cidade — decisão consciente, não lacuna.

## 5. Falha parcial e nova tentativa

Cada uma das 4 etapas do Gatilho 1 (Cadastro Mestre, Bússola, Origem, Dashboard) roda
de forma independente e reporta separadamente — mesmo padrão de isolamento de erro já
usado na Central de Estratégia (Seção 5 daquela spec). Se uma falhar, as etapas já
concluídas continuam válidas; a tela mostra qual falhou, com botão de "tentar de novo"
só daquela etapa específica.

Toda etapa é **idempotente**: antes de criar, checa se já existe uma linha
correspondente (via `integracao_sistema.identificador_externo`, ou equivalente em cada
sistema) — repetir uma etapa que já deu certo nunca duplica dado.

## 6. Autenticação — decisão explícita

Cada sistema mantém login **independente** — sem tentativa de sincronizar senha entre
eles. Avaliadas três opções (documentadas na conversa de brainstorming): senha
espelhada só na criação (rejeitada — diverge silenciosamente após o primeiro reset em
qualquer um dos sistemas, e o histórico desta mesma sessão com reset de senha em só
*um* sistema já mostrou o tamanho da dor disso), SSO de verdade via `signInWithIdToken`
(mais correto, mas é uma iniciativa de infraestrutura própria, maior que este
provisionamento), e contas independentes (escolhida: cada sistema cria sua própria
conta no convite, sem promessa de sincronia depois).

## 7. Onde o código mora

Dentro do repositório `lidera-mais`, já que é de lá que os dois gatilhos partem
(`/clientes/novo` e `/configuracoes/eleicao`). Reaproveita os clients de service role
já existentes em `src/lib/supabase/external-projects.ts` (criados para a Central de
Estratégia) — hoje só leitura, este trabalho adiciona as operações de escrita
(inserção de organização/cliente + convite de admin) nos mesmos 4 projetos externos
(Cadastro Mestre, Bússola, Origem, Dashboard).

## 8. Testes

- Criar um cliente de teste completo pelo Gatilho 1, confirmar que aparece corretamente
  nos 4 sistemas, com login funcionando em cada um.
- Simular falha proposital numa etapa (ex.: credencial errada temporariamente) e
  confirmar que as outras 3 completam normalmente, e que o retry da etapa que falhou
  não duplica as que já tinham dado certo.
- Rodar o Gatilho 1 duas vezes seguidas com o mesmo clique (dois submits acidentais)
  e confirmar que não duplica nada (teste de idempotência).
- Testar Gatilho 2: editar cargo/número/ano em "Configurações > Eleição" de um cliente
  já criado, confirmar que `campanha` no Cadastro Mestre é atualizada.
- Testar clonagem de território: criar um cliente novo na cidade "Olinda" (que já tem
  estrutura pelo Ricardo Sousa) e confirmar que o cliente novo recebe as mesmas 10
  RPAs/49 bairros, com `cliente_id` próprio e metas/resultados zerados.
- Testar cidade sem estrutura: confirmar que o cliente é criado normalmente nos outros
  3 sistemas, e que o Dashboard fica sem território mapeado, sem erro.
