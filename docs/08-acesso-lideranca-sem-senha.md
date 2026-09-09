# Acesso de liderança por link (sem senha) — Lidera+

**Status:** desenho aprovado, aguardando plano de implementação.

---

## 1. Motivação

Hoje, dar acesso ao sistema para uma liderança depende de um fluxo de e-mail
com senha: o admin_geral marca "criar acesso de login" ao cadastrar a
liderança, o Supabase manda um convite por e-mail, a liderança precisa abrir
o e-mail, clicar, definir uma senha e só então consegue entrar. Na prática
isso trava a adoção — muita liderança de campo não usa e-mail no dia a dia,
esquece a senha, ou nunca chega a abrir o convite.

Este documento descreve a substituição desse fluxo por um **link de acesso
único por liderança**, entregue pelo WhatsApp (canal que o admin_geral já usa
para falar com a liderança), que loga a pessoa direto no sistema sem exigir
e-mail nem senha.

---

## 2. Visão geral do fluxo

1. Admin_geral cadastra uma liderança nova em `/liderancas/novo`.
2. Ao salvar, o sistema gera automaticamente um **token de acesso** único
   vinculado àquela liderança e cria (ou reaproveita) o login por trás dela.
3. Na tela de detalhe da liderança (`/liderancas/[id]`), aparece um bloco
   "Acesso ao sistema" com um botão **"Enviar pelo WhatsApp"**: abre o
   WhatsApp do próprio admin_geral com uma mensagem pronta contendo o link.
   O admin_geral confere e envia pro número da liderança.
4. A liderança abre o link no celular dela. O sistema reconhece o token,
   cria uma sessão de verdade (igual à de quem loga com senha) e a redireciona
   para `/dashboard`, já com a role `lideranca` e a rede dela.
5. O link **não expira sozinho** — continua funcionando enquanto não for
   revogado. Se vazar, o admin_geral revoga (o que também bloqueia qualquer
   sessão já aberta com aquele acesso dentro de pouco tempo, ver §8) e gera
   um novo.

Esse mecanismo troca **apenas a forma de entrar**. Depois de autenticada, a
liderança é tratada exatamente como hoje: mesma role, mesmo `leader_id`
vinculado ao perfil, mesmas políticas de RLS (só a própria rede de
apoiadores).

---

## 3. Mudanças de permissão (junto com esta mudança)

Duas restrições de escopo foram decididas junto com este trabalho, porque
mexem na mesma tela/ação de cadastro de liderança:

- **`lideranca` deixa de poder cadastrar outra liderança.** Hoje a role
  `lideranca` pode cadastrar uma liderança "abaixo" dela na hierarquia
  (`parent_leader_id`, RLS `ld_lideranca_insert_subordinate`). Isso é
  removido — tanto da tela (`can(role, "create", "leaders")` passa a ser
  `false` para `lideranca` em `lib/permissions.ts`) quanto do banco (a
  policy de RLS que permite esse insert é derrubada numa migração). Dado
  antigo (lideranças já cadastradas por outras lideranças, com
  `parent_leader_id` preenchido) não é alterado — só a criação de novas para
  frente é bloqueada. A partir de agora, `lideranca` só cadastra apoiador.
- **`admin_equipe` continua podendo cadastrar liderança**, sem mudança de
  permissão — mas (ver §5) não gera link automático ao fazer isso.

Nenhuma outra permissão muda. Em particular, `lideranca` continua podendo
editar o próprio cadastro (endereço, telefone, etc.) — só a criação de nova
liderança sai do escopo dela.

---

## 4. Modelo de dados

### 4.1 Tabela própria `leader_access_tokens` (revisado após revisão final — ver §10)

O token **não** fica numa coluna de `leaders`. A revisão final do
branch (§10) encontrou que RLS é uma trava por linha, não por coluna —
qualquer policy de select em `leaders` (mesmo restrita a "só o que eu
cadastrei" ou "só minhas subordinadas") acabaria devolvendo o token junto
com o resto da linha pra quem tem select naquela linha, permitindo que
admin_equipe ou uma liderança "avó" lessem o token de outra conta e
assumissem a sessão dela. Uma tabela própria, com RLS ativa e **nenhuma
policy**, resolve isso de vez: ninguém autenticado consegue ler/escrever
essa tabela por nenhum caminho — só o client de service_role (que ignora
RLS por completo) chega nela, e todo acesso já passa por
`src/services/leader-access.ts`/Server Actions `admin_geral`-only mesmo.

```sql
create table leader_access_tokens (
  leader_id uuid primary key references leaders(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table leader_access_tokens enable row level security;
-- De propósito: nenhuma policy aqui. RLS ativa + zero policies = ninguém
-- autenticado (nem admin_geral, nem admin_equipe, nem lideranca) consegue
-- ler ou escrever esta tabela por PostgREST; só o client de service_role
-- (que ignora RLS) acessa, sempre a partir de services/leader-access.ts.
```

- `token`: string aleatória e única (gerada com um gerador
  criptograficamente seguro, ex.: 32 bytes em base64url) por liderança.
  Ausência de linha para aquele `leader_id` = liderança sem link ativo
  (nunca gerado, ou revogado).
- O link final tem o formato:
  `https://<subdominio-do-cliente>/acesso-lideranca/<token>`.
- **Gerar novo link** = `upsert` substituindo a linha daquele `leader_id`
  com um `token` novo (o antigo para de bater com qualquer linha e vira
  automaticamente inválido).
- **Revogar** = apagar a linha daquele `leader_id` + banir o login por trás
  (ver §8 e §10 sobre o efeito em sessão já aberta e em login antigo por
  senha).
- `on delete cascade`: excluir a liderança (depois de excluir o login por
  trás, ver §10) já limpa a linha de token sozinho, sem passo manual extra.

### 4.2 Login por trás do link

Toda liderança cadastrada por admin_geral passa a ganhar, na hora do
cadastro, um usuário de autenticação (`auth.users` + `users_profiles` com
`role = 'lideranca'` e `leader_id` apontando pra ela) — igual ao que hoje só
acontecia se o checkbox "criar acesso de login" fosse marcado, mas agora
sempre, automaticamente, sem esse checkbox existir mais.

O Supabase exige um e-mail (ou telefone) único por usuário de autenticação.
O campo "E-mail" no cadastro de liderança é opcional (e continua sendo). Para
liderança sem e-mail preenchido, o sistema gera um e-mail interno sintético
(ex.: `lideranca-<id-da-lideranca>@interno.lideramais.app.br`) só para
satisfazer essa exigência técnica em `auth.users` — não é enviado nenhum
e-mail para esse endereço. Esse e-mail sintético **nunca é gravado em
`users_profiles.email`** (fica `null` ali) — é só um detalhe interno de
`auth.users`, nunca aparece em nenhuma tela (nem em Configurações >
Usuários, ver §9). Se a liderança tiver e-mail de verdade cadastrado, esse é
o e-mail usado no login por trás e também o que aparece em
`users_profiles.email` normalmente — mas, de novo, ninguém precisa checar
caixa de entrada: o acesso é só pelo link.

Se o e-mail informado pela liderança já pertencer a outra conta de login
existente (ex.: duas lideranças cadastradas com o mesmo e-mail de família),
a criação do login com aquele e-mail falha — nesse caso o sistema cai
automaticamente para o e-mail sintético em vez de travar o cadastro.

---

## 5. Cadastro de liderança — o que muda

Em `/liderancas/novo` (e na Server Action `createLeaderAction`):

- O checkbox "Criar acesso de login agora e enviar convite por e-mail" é
  removido do formulário.
- Quando quem cadastra é **admin_geral**: ao salvar, o sistema cria o login
  por trás (§4.2) e já gera o `access_token`, deixando a liderança pronta
  para receber o link.
- Quando quem cadastra é **admin_equipe**: a liderança é criada **sem**
  login e sem `access_token` — mesma trava que já existe hoje (só
  admin_geral podia marcar o checkbox de convite, mesmo admin_equipe
  podendo cadastrar liderança). Ela fica "sem acesso" até um admin_geral
  gerar o link manualmente na tela de detalhe.

O bloco de hierarquia (`role === "lideranca"` cadastrando uma subordinada,
em `liderancas/actions.ts`) é removido junto, já que essa capacidade deixa
de existir (§3).

---

## 6. Tela de detalhe da liderança — bloco "Acesso ao sistema"

Visível só para **admin_geral**, em `/liderancas/[id]`:

- **Sem `access_token` ativo:** botão "Gerar link de acesso". Cobre os
  casos de liderança criada por admin_equipe, liderança antiga (antes desta
  mudança) sem login algum, ou liderança que teve o acesso revogado. Se a
  liderança ainda não tiver nenhum login por trás (§4.2) — caso de
  admin_equipe ou de liderança bem antiga — esse botão cria o login
  primeiro (mesma lógica de quando admin_geral cadastra) e só então gera o
  token. Se já existir um login (ex.: liderança com senha de antes desta
  mudança), reaproveita esse login e só adiciona a linha em
  `leader_access_tokens` — a senha continua valendo em paralelo enquanto o
  link não for revogado.
- **Sem telefone cadastrado:** o botão "Enviar pelo WhatsApp" não aparece
  (mesmo comportamento de `WhatsAppButton` em qualquer outra tela do
  sistema). Nesse caso o link é mostrado como texto selecionável na própria
  tela, pra o admin_geral copiar e mandar por qualquer outro canal — sem
  isso, uma liderança sem telefone ficaria com "acesso gerado" mas
  impossível de entregar.
- **Com link ativo:** botão "Enviar pelo WhatsApp" (abre `wa.me` com o
  telefone da própria liderança já preenchido e uma mensagem padrão contendo
  o link — mesmo padrão de `lib/whatsapp.ts`) e botão "Revogar acesso". A
  confirmação desse botão avisa explicitamente que revogar **bane o login
  inteiro** — se essa liderança também tinha senha de antes desta mudança,
  a senha para de funcionar junto (decisão explícita: revogar significa
  "esta pessoa não entra mais de jeito nenhum", não só "este link específico
  não vale mais" — ver §10). Quem revogar por engano usa "Gerar link de
  acesso" de novo pra reabrir tudo (link novo + login desbanido).

Mensagem padrão sugerida para o WhatsApp (editável na hora de enviar, como
já é hoje o padrão de `wa.me`):

> Oi, {{nome}}! Aqui está seu acesso ao Lidera+: {{link}}
> É só clicar para entrar — não precisa de senha.

**Lideranças já existentes** (com login por e-mail/senha de antes desta
mudança) não são alteradas: continuam entrando com e-mail e senha
normalmente. O botão "Gerar link de acesso" fica disponível pra elas também,
como uma opção a mais — não uma migração forçada.

---

## 7. Rota de resgate do link

Nova rota pública (adicionada a `PUBLIC_PATHS` em
`lib/supabase/middleware.ts`): `/acesso-lideranca/[token]`.

Ao ser acessada:

1. Busca em `leader_access_tokens` uma linha com `token = token` (client de
   service_role — ver §4.1/§10). Não encontrar = token inválido ou já
   revogado.
2. Se encontrar, usa o `leader_id` pra pegar `leaders.user_id` e, a partir
   dele, o usuário de autenticação vinculado (`users_profiles`/`auth.users`)
   e o e-mail dele (real ou sintético, ver §4.2).
3. No servidor, usa o client administrativo do Supabase para gerar um
   magic link (`auth.admin.generateLink({ type: "magiclink", email })`) e
   imediatamente resgatá-lo (`auth.verifyOtp`) usando o client de sessão da
   requisição — isso cria uma sessão de verdade e grava o cookie de sessão
   na resposta, sem passar pelo fragmento de URL (`#access_token=...`) que
   já deu problema em outros fluxos de e-mail deste projeto (ver comentário
   em `login/actions.ts`).
4. Redireciona para `/dashboard`, já autenticado.

Se o token não for encontrado ou estiver revogado, mostra uma página
genérica de "link inválido ou expirado" — sem detalhar o motivo, para não
ajudar tentativa de adivinhação de token.

---

## 8. Segurança — modelo aceito

Este mecanismo troca uma senha por um **token permanente na URL**: quem
tiver o link, tem acesso completo à conta daquela liderança (role
`lideranca`, rede dela) até o link ser revogado. Isso é uma troca consciente
de segurança por praticidade, já validada nesta conversa. Mitigações
incluídas no desenho:

- Token longo o suficiente para não ser adivinhável (32 bytes aleatórios).
- Revogar não é só "apagar o link" — também bane o login por trás dele
  (`auth.admin.updateUserById(userId, { ban_duration: "876000h" })`). Isso
  não mata uma sessão já aberta na hora exata do clique (o token de sessão
  em uso continua válido até expirar sozinho), mas impede qualquer renovação
  futura — na prática a sessão morre dentro do tempo de vida do token de
  acesso do Supabase, tipicamente menos de uma hora. O Supabase não oferece
  uma forma de derrubar instantaneamente uma sessão de outra pessoa a partir
  do id dela (só a partir do próprio token de quem está logado), então esse
  é o limite real de "imediato" aceito aqui.
- A responsabilidade de mandar o link pro número certo é do admin_geral (o
  sistema não envia nada sozinho) — mesma responsabilidade que ele já tem
  hoje ao mandar qualquer mensagem sensível pelo WhatsApp.
- Página de erro genérica na rota de resgate, sem diferenciar "token não
  existe" de "token revogado", para não facilitar tentativa e erro.

Fora do escopo deste desenho (podem virar melhorias futuras, não bloqueiam
esta entrega): expiração automática por tempo, log de auditoria de quando
cada link foi usado, limite de dispositivos simultâneos.

---

## 9. Fora de escopo

- Nada muda na relação apoiador ↔ liderança (`supporters.leader_id`) nem
  nas políticas de RLS que já isolam cada liderança à própria rede.
- Nada muda no fluxo de convite de `admin_geral`/`admin_equipe`
  (Configurações > Usuários continua com e-mail/senha, como hoje). A lista
  de usuários passa a incluir toda liderança que já tem login por trás
  (antes só aparecia quem tinha marcado o checkbox de convite) — decisão
  explícita (§10): faz sentido mostrar ali todo mundo com algum tipo de
  acesso, incluindo por link.
- Lideranças com login antigo (e-mail/senha) não são migradas
  automaticamente.

---

## 10. Revisão pós-implementação (correções antes de aplicar a migração)

A revisão final do branch (depois das 7 tasks implementadas, antes de
aplicar a migração de banco de verdade) encontrou dois problemas que
mudam este desenho, resolvidos nesta conversa antes de corrigir o código:

1. **Vazamento do token via RLS (crítico).** `access_token` como coluna de
   `leaders` é legível por qualquer policy de select naquela tabela — o que
   inclui `admin_equipe` (vê o que cadastrou) e `lideranca` (vê
   sub-lideranças antigas que ela cadastrou). Ler o token de outra conta =
   assumir a sessão dela. Corrigido movendo o token pra uma tabela própria
   sem nenhuma policy de RLS (§4.1) — só o service_role chega lá.
2. **Exclusão de liderança quebrada (crítico).** Toda liderança cadastrada
   por admin_geral agora ganha login (`users_profiles`) automaticamente —
   antes só quem tinha o checkbox de convite marcado. A FK de
   `users_profiles` pra `leaders` (via `leader_id`) não tem `on delete
   cascade`/`set null`, então excluir a liderança sem excluir o login antes
   passou a falhar sempre, com uma mensagem que erra o motivo (parece erro
   de apoiador/demanda vinculado, mas é o login). Corrigido: excluir
   liderança agora sempre apaga o login por trás primeiro (mesma lógica que
   já existia pro rollback do fluxo antigo de convite), antes de excluir a
   linha de `leaders`.

Três decisões de comportamento, confirmadas nesta conversa:

- **Revogar bane tudo, sem exceção** (não só "este link específico") — se a
  liderança também tinha senha de antes desta mudança, revogar derruba a
  senha junto. Ver §6.
- **Toda liderança com login aparece em Configurações > Usuários**, mesmo
  que só tenha acesso por link (antes só quem tinha convite por e-mail
  aparecia ali). O e-mail sintético nunca é exibido (fica em branco) — ver
  §4.2 e §9.
- **E-mail duplicado nunca trava o cadastro** — se o e-mail da liderança já
  pertence a outro login, o sistema usa o e-mail sintético como
  alternativa automática. Ver §4.2.

Também corrigido nesse mesmo momento (achado importante, sem decisão de
produto necessária): liderança sem telefone cadastrado ganha um jeito de
copiar o link na tela — ver §6.
