# Deploy — Etapa 8 (Fechamento do MVP)

Este ambiente não tem acesso à conta Vercel da Agencia F4 nem consegue abrir um navegador para testar o PWA instalado num celular de verdade — os dois passos abaixo (deploy e teste de instalação) precisam ser feitos por alguém com acesso a essas contas. O que segue é o roteiro exato, pronto pra rodar sem precisar decidir nada no meio do caminho.

## 1. Pré-requisitos

- Código deste projeto (`lidera-plus/`) num repositório Git (GitHub, GitLab ou Bitbucket) — a Vercel importa direto de lá.
- Conta Vercel (gratuita serve para o MVP) com acesso a esse repositório.
- Projeto Supabase **lidera+** já em produção (já está — `vqrnjiwansfobxaeswnu`, região `sa-east-1`). Não precisa de um Supabase "de produção" separado do de desenvolvimento neste estágio; se a agência quiser separar ambientes futuramente, é criar um segundo projeto Supabase e repetir `schema.sql` + `rls_policies.sql` + `scheduled_jobs.sql` nele.
- `npm install` rodado com sucesso ao menos uma vez localmente antes do primeiro deploy (ver aviso permanente no `README.md` — nenhum pacote deste projeto foi instalado neste ambiente por bloqueio de rede do sandbox; a Vercel roda `npm install` sozinha no build dela, mas vale confirmar local primeiro pra não descobrir um erro de import só depois do deploy).

## 2. Variáveis de ambiente na Vercel

Projeto → Settings → Environment Variables. Usar os mesmos valores de `.env.example`, preenchidos:

| Variável | Valor | Ambiente |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vqrnjiwansfobxaeswnu.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_TpS2uoJ-2m_YuPkRSTBK3A_I-D21X4D` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | pegar em Supabase → Project Settings → API → `service_role` | **Production only**, nunca em Preview público nem no bundle do client (o código já usa `server-only` pra isso não vazar, mas a chave em si é secreta) |
| `NEXT_PUBLIC_SITE_URL` | a URL final do deploy, ex. `https://lidera-plus.vercel.app` (ou domínio próprio) | Production + Preview (em Preview, deixar a Vercel usar a URL do preview automaticamente não dá — ou fixa a de produção, ou aceita que reset de senha em Preview não funciona; não é um fluxo crítico de testar em preview) |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` / `_LNG` / `_ZOOM` | coordenada do centro do município da campanha (opcional — sem isso o mapa cai no centro genérico do Brasil quando não há nenhum pin ainda) | Production + Preview |

## 3. Importar e configurar o projeto na Vercel

1. Vercel → **Add New → Project** → selecionar o repositório.
2. Framework preset: Vercel detecta Next.js automaticamente (não precisa mexer em build command/output).
3. Colar as variáveis da tabela acima antes do primeiro deploy (ou depois, e disparar um redeploy).
4. **Deploy.**

## 4. Pós-deploy — configurar o Supabase Auth pra apontar pro domínio novo

Isso é o passo que mais gente esquece e quebra login em produção silenciosamente:

1. Painel Supabase → projeto **lidera+** → **Authentication → URL Configuration**.
2. **Site URL**: colocar a URL de produção (a mesma de `NEXT_PUBLIC_SITE_URL`).
3. **Redirect URLs**: adicionar `https://<seu-dominio>/auth/confirm` (a rota que já existe em `src/app/auth/confirm/route.ts`) — sem isso, o link de "redefinir senha"/convite de usuário volta um erro de "redirect not allowed" em vez de logar a pessoa.

## 5. Domínio próprio (opcional)

Vercel → Project → Settings → Domains → adicionar o domínio da campanha e seguir a verificação DNS (CNAME/A record, a Vercel mostra o valor exato). Depois de apontar, atualizar `NEXT_PUBLIC_SITE_URL` e o Redirect URL do Supabase (passo 4) pro domínio novo — os dois têm que bater com a URL real que o usuário acessa.

## 6. Confirmar que o PWA está instalável

Depois do primeiro deploy, com o site já em HTTPS (a Vercel já entrega isso por padrão):

1. Abrir o site publicado no Chrome do Android (ou desktop) → deve aparecer o prompt "Instalar app"/"Adicionar à tela inicial" sozinho, ou manualmente em ⋮ → "Instalar app".
2. No iPhone (Safari): não existe prompt automático — o caminho é Compartilhar → **Adicionar à Tela de Início** (por isso o `appleWebApp` em `src/app/layout.tsx` foi configurado, ele ajusta o comportamento desse atalho pra abrir em tela cheia, sem a barra do Safari).
3. Rodar o Lighthouse (aba Lighthouse do Chrome DevTools, categoria "Progressive Web App") na URL publicada — deve vir "installable" ok. Se algo falhar, os arquivos a checar são `public/manifest.json` (ícones/nome/cores) e o service worker gerado pelo `next-pwa` (`next.config.js`; o arquivo `public/sw.js` só existe depois de um `next build` de produção — não existe neste repositório antes do primeiro deploy, é gerado automaticamente pela própria Vercel).
4. **Isso não foi testado de verdade neste ambiente** — sem navegador e sem o `next build` rodando aqui (mesma limitação de sempre, sem `npm install`), a configuração foi escrita seguindo a documentação oficial do `next-pwa` e do `manifest.json`, mas o primeiro teste real de instalação em um aparelho físico é o critério de pronto de fato deste item.

## 7. O que já está em produção e não precisa de ação nesta etapa

- Banco de dados, RLS, Edge Function `daily-alerts` e o agendamento via `pg_cron` já estão live no Supabase — isso não depende do deploy do frontend na Vercel, já funciona hoje independente de onde o site está hospedado.
