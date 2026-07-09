# Etapa 8 — Fechamento do MVP

Resumo do que foi feito para fechar o MVP (`docs/02-plano-mvp.md`), com foco nos itens que não são só "criar uma tela nova" — a revisão de permissões e o checklist de LGPD encontraram bugs reais que estavam em produção desde etapas anteriores.

## 1. Logo oficial

O cliente enviou a arte final do Lidera+ (pino de mapa + rede de lideranças + seta de crescimento + "+"). Como este ambiente não teve acesso ao arquivo de imagem original (só a visualização em chat, sem um arquivo salvo em disco pra copiar), a marca foi **recriada em SVG** batendo exatamente com a paleta já usada no projeto (`tailwind.config.ts`: `#0B2545` azul, `#1E7A46` verde, `#D4A017` dourado):

- `public/brand/icon-mark.svg` — ícone isolado, fundo transparente.
- `public/brand/icon-mark-inverted.svg` — mesmo ícone com o pino claro, para o Sidebar (fundo navy).
- `public/brand/icon-maskable.svg` — variante com fundo sólido de ponta a ponta e a marca encolhida na "zona segura" central, para o ícone "maskable" do Android.
- `public/brand/logo-lockup.svg` — ícone + wordmark "Lidera+", usado na tela de login.
- `public/icons/*.png` — rasterizado a partir dos SVGs acima (192, 512, maskable-512, apple-touch-icon 180, favicon 32).

Aplicada em: `src/app/login/page.tsx`, `src/components/layout/sidebar.tsx`, `src/app/layout.tsx` (favicon/apple icon via `metadata.icons`), `public/manifest.json`.

**Se o cliente mandar o arquivo de imagem original depois**, é só substituir os arquivos em `public/brand/`/`public/icons/` pelas versões de verdade (mesmos nomes) e regerar os PNGs — nenhum outro arquivo precisa mudar.

## 2. PWA instalável

- `next.config.js` envolvido com `next-pwa` (já estava em `docs/01-arquitetura-tecnica.md` como decisão arquitetural da Etapa 0, mas nunca tinha sido implementado). Gera o service worker em build de produção (`disable` em dev, de propósito).
- `public/manifest.json` (já existia como placeholder desde o scaffold inicial) ganhou o ícone maskable e `purpose` correto em cada entrada.
- `src/app/layout.tsx` ganhou `metadata.icons` (favicon SVG + PNG, apple-touch-icon) e `metadata.appleWebApp` (iOS não lê o manifest pra virar "app" — precisa dessa meta tag à parte).
- **Não testado de verdade** (sem `npm install`/navegador neste sandbox) — roteiro de verificação manual em `docs/05-deploy.md` §6.

## 3. Revisão de permissões ponta a ponta — 2 bugs reais encontrados

Em vez de só reler o código, criei 3 usuários de teste (um por perfil), 2 lideranças, 1 apoiador e 2 demandas direto no banco (sem passar pelo GoTrue — sem risco de mandar e-mail de verdade) e rodei queries **simulando cada perfil de verdade** via `set local role authenticated` + `set_config('request.jwt.claims', ...)`. Dados de teste removidos depois; nenhum residual no banco.

- **Bug 1 (grave):** as funções `is_own_supporter()`, `current_leader_can_view_attendances()` e `can_access_related_record()`, que ficam no schema `private` desde o hardening de segurança da Etapa 0, chamavam umas às outras **sem qualificar o schema**. Como o `search_path` delas é só `'public'`, toda chamada cruzada quebrava com "function does not exist" — na prática, **qualquer query de um usuário com perfil `lideranca` em leaders/supporters/demands/attendances/attachments falhava com erro**. O arquivo `supabase/rls_policies.sql` sempre teve o código certo (com `private.` explícito); o banco é que tinha uma versão desatualizada de uma migration antiga. Corrigido via `apply_migration` e confirmado com o teste real descrito acima (liderança viu só a própria rede; admin_equipe não conseguiu deletar liderança nem editar demanda de outra liderança, sem erro, 0 linhas afetadas; admin_geral viu tudo). Detalhe técnico completo no comentário adicionado a `supabase/rls_policies.sql`.
- **Bug 2:** o `middleware.ts` redirecionava pra `/login` qualquer request de usuário deslogado pra uma rota não-pública — incluindo `/brand/logo-lockup.svg`, a própria logo usada NA tela de login. Ou seja, a logo nunca carregaria pra ninguém que ainda não tivesse logado (o único público que realmente vê a tela de login). Corrigido excluindo `brand/` (e os arquivos gerados pelo `next-pwa`, `sw.js`/`workbox-*.js`) do matcher do middleware.
- Conferido também: `canAccessRoute()` cobre `/mapa` e `/aniversariantes` automaticamente (o middleware usa uma lista de exceção `PUBLIC_PATHS`, não uma lista de rotas protegidas — toda rota nova já nasce protegida sem precisar registrar em lugar nenhum).

**Lição registrada em `rls_policies.sql`:** rodar `get_advisors` sozinho não basta pra validar RLS — ele pega search_path mutável e exposição indevida, mas não pega chamada cruzada quebrada entre funções. Só um teste funcional como sessão autenticada de verdade pega isso.

## 4. Checklist LGPD — 1 gap real encontrado

`supporters` tem 3 colunas de consentimento distintas (`consent_registration`, `consent_whatsapp`, `consent_email`) — consentir em ser cadastrado não é a mesma coisa que consentir em receber WhatsApp. `consent_registration` já era obrigatório no formulário (confirmado, correto). Mas **nenhum dos 6 pontos que mostram o botão de WhatsApp para um apoiador checava `consent_whatsapp`** — o botão aparecia sempre que havia telefone.

Corrigido: `WhatsAppButton` ganhou a prop `consentWhatsapp` (desabilita o botão com uma explicação em vez de escondê-lo, quando `false`); `consent_whatsapp` passou a ser buscado onde faltava (`services/birthdays.ts`, `services/dashboard.ts`, `services/attendances.ts`) e passado nos 6 pontos de uso (`apoiadores`, `pessoas-atendidas`, `atendimentos`, `aniversariantes`, `dashboard`). Os 2 pontos de uso em **lideranças** ficaram sem essa restrição de propósito — contato profissional da campanha, não dado pessoal de eleitor. Detalhe completo em `docs/04-checklist-lgpd.md`.

## 5. Deploy

Documentado passo a passo em `docs/05-deploy.md` — variáveis de ambiente pra Vercel (incluindo `NEXT_PUBLIC_SITE_URL`, que faltava no `.env.example` e é usada pra montar link de redefinição de senha/convite por e-mail), configuração de Redirect URL no Supabase Auth, e checklist de verificação do PWA instalado. **Não executado** — este ambiente não tem acesso à conta Vercel da agência; é o próximo passo humano.

## Risco residual conhecido (documentado, não resolvido nesta etapa)

- PDF de relatórios (`@react-pdf/renderer`) nunca rodou de verdade — mesma limitação de sempre (sem `npm install` no sandbox). Maior risco de ajuste fino no primeiro `npm run dev` local.
- Caminho de *inserção* de notificação da Edge Function `daily-alerts` (quando existe pelo menos 1 admin ativo) não foi exercitado — este projeto Supabase ainda não tem nenhum `admin_geral`/`admin_equipe` cadastrado de verdade.
