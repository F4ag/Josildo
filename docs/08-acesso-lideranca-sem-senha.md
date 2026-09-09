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
   revogado. Se vazar, o admin_geral revoga (e qualquer sessão já aberta com
   aquele acesso é encerrada na hora) e gera um novo.

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

### 4.1 Nova coluna em `leaders`

```sql
alter table leaders add column access_token text unique;
```

- `access_token`: string aleatória e única (gerada com um gerador
  criptograficamente seguro, ex.: 32 bytes em base64url) por liderança.
  `null` = liderança sem link ativo (nunca gerado, ou revogado).
- O link final tem o formato:
  `https://<subdominio-do-cliente>/acesso-lideranca/<access_token>`.
- **Gerar novo link** = sobrescrever `access_token` com um valor novo (o
  antigo para de bater com qualquer linha e vira automaticamente inválido).
- **Revogar** = `access_token = null` (ver §7 sobre também encerrar sessão
  ativa).

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
satisfazer essa exigência técnica — não é enviado nenhum e-mail para esse
endereço, ele nunca é exibido em nenhuma tela, é um detalhe interno do
mecanismo de login. Se a liderança tiver e-mail de verdade cadastrado, esse é
o e-mail usado no login por trás — mas, de novo, ninguém precisa checar
caixa de entrada: o acesso é só pelo link.

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
  mudança), reaproveita esse login e só adiciona o `access_token` — a senha
  continua valendo em paralelo, como uma segunda forma de entrar.
- **Com `access_token` ativo:** botão "Enviar pelo WhatsApp" (abre `wa.me`
  com o telefone da própria liderança já preenchido e uma mensagem padrão
  contendo o link — mesmo padrão de `lib/whatsapp.ts`) e botão "Revogar
  acesso" (com confirmação, já que também encerra sessão aberta — ver §7).

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

1. Busca em `leaders` uma linha com `access_token = token`. Não encontrar =
   token inválido ou já revogado.
2. Se encontrar, localiza o usuário de autenticação vinculado
   (`leaders.user_id` → `users_profiles`/`auth.users`) e o e-mail dele
   (real ou sintético, ver §4.2).
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
- Revogar não é só "apagar o link" — também derruba qualquer sessão já
  aberta com aquele acesso (`auth.admin.signOut(userId, "global")`), então
  revogação tem efeito imediato mesmo que o dispositivo da liderança já
  estivesse logado.
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
  (Configurações > Usuários continua com e-mail/senha, como hoje).
- Lideranças com login antigo (e-mail/senha) não são migradas
  automaticamente.
