# Checklist LGPD (Módulo 15) — Etapa 8

`supporters` guarda 3 colunas de consentimento distintas (`supabase/schema.sql`), de propósito — consentir em ser cadastrado não é a mesma coisa que consentir em receber mensagem:

- `consent_registration` — obrigatório para o cadastro existir.
- `consent_whatsapp` — opcional, default `false`.
- `consent_email` — opcional, default `false` (sem uso ainda; não há envio de e-mail implementado no MVP).

## O que já estava correto

- `consent_registration` é obrigatório no formulário de apoiador (`src/lib/validations/supporter.ts`, `.refine((v) => v === true)`) — sem marcar, o `createSupporter`/`updateSupporter` nem chega a rodar. Verificado no form (`supporter-form.tsx`) e na action (`apoiadores/actions.ts`).
- RLS + `ADMIN_ONLY_ROUTE_PREFIXES` (`src/lib/permissions.ts`) já restringem quem acessa dado de apoiador/liderança por perfil — isso é controle de acesso, não consentimento de contato, mas é parte do mesmo módulo (minimização de exposição de dado pessoal).

## Gap encontrado e corrigido nesta revisão

`consent_whatsapp` existia na tabela e no formulário de cadastro, mas **nenhum dos 6 pontos que renderizam o botão de WhatsApp para um apoiador checava essa coluna** — o botão aparecia sempre que havia telefone, sem olhar se a pessoa autorizou contato por esse canal. Ou seja: dava para marcar "sim, pode me cadastrar" e "não, não me manda WhatsApp" e o sistema ainda oferecia o botão de mandar WhatsApp.

Corrigido:

- `src/components/whatsapp-button.tsx` ganhou a prop `consentWhatsapp?: boolean`. Quando `false`, renderiza um botão desabilitado ("Sem consentimento", com `title` explicando) em vez do link `wa.me` — deixa claro que é uma restrição de consentimento, não falta de telefone.
- `consent_whatsapp` passou a ser selecionado onde faltava: `services/birthdays.ts` (tela `/aniversariantes`), `services/dashboard.ts` (`listBirthdaysToday`, card "Aniversariantes de hoje"), `services/attendances.ts` (`getAttendanceById`). Em `services/supporters.ts` já vinha de graça (`select("*")`).
- Os 6 pontos de uso passaram a passar a prop: `apoiadores/page.tsx`, `apoiadores/[id]/page.tsx`, `pessoas-atendidas/[id]/page.tsx`, `atendimentos/[id]/page.tsx`, `aniversariantes/page.tsx`, `dashboard/page.tsx`.
- Os 2 pontos de uso em **lideranças** (`liderancas/page.tsx`, `liderancas/[id]/page.tsx`) foram deixados sem a prop de propósito — liderança/equipe é contato profissional da campanha, não dado pessoal de eleitor coberto por esse consentimento específico do Módulo 15 (mesma distinção já feita no prompt master original).

## O que fica para depois do MVP

- `consent_email` está guardado mas nunca é lido em lugar nenhum, porque não existe nenhum envio de e-mail no sistema ainda (nem para apoiador, nem transacional). Quando um módulo de e-mail for implementado (fora do MVP), replicar o mesmo padrão do `consent_whatsapp`.
- Não existe hoje uma tela para o apoiador revisar/revogar consentimento depois de cadastrado (direito de retirada de consentimento da LGPD) — só dá para editar via `apoiadores/[id]/editar`, sem fluxo dedicado. Registrar como item de v2 se a agência quiser um processo formal de "direito do titular".
- (Conferido, já correto: `apoiadores/actions.ts` já preenche `consent_date`/`consent_origin` automaticamente no cadastro — não precisa de ajuste.)
