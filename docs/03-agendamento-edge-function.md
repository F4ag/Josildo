# Agendamento da Edge Function `daily-alerts`

Módulo 10 (Alertas) do prompt master. A função `supabase/functions/daily-alerts/index.ts`
roda 1x por dia, sozinha, via `pg_cron` + `pg_net` — sem depender de nenhum
serviço externo de cron.

## Como está configurado

- Job: `cron.job` com `jobname = 'daily-alerts'`, criado por
  `supabase/scheduled_jobs.sql` (já aplicado ao projeto `lidera+` via migration
  `schedule_daily_alerts_edge_function`).
- Schedule: `0 9 * * *` — 09:00 UTC = **06:00 horário de Brasília** (BRT,
  UTC-3, sem horário de verão desde 2019). Roda antes do expediente.
- O job faz um `net.http_post` direto para a URL pública da função
  (`https://vqrnjiwansfobxaeswnu.supabase.co/functions/v1/daily-alerts`),
  autenticado com a **anon key** (chave pública — a função tem
  `verify_jwt = true`, então só exige um JWT válido; a lógica de negócio por
  dentro da função usa a `service_role` key para ignorar RLS de propósito,
  já que ela precisa ver e alterar dados de todas as lideranças).

## O que a função faz a cada execução

1. Marca como `atrasada` toda demanda com `due_date` vencido que ainda não
   foi resolvida/cancelada/recusada, grava o histórico em `demand_updates` e
   notifica `admin_geral`/`admin_equipe` ativos.
2. Notifica demandas e atendimentos vencendo **hoje** (sem mudar status).
3. Notifica atendimentos atrasados (o enum de `attendances` não tem status
   "atrasado" — aqui é só notificação, não muda o registro).
4. Notifica aniversariantes de hoje (1 notificação agregada, não 1 por pessoa).

É idempotente: rodar duas vezes no mesmo dia não duplica notificação (checa
se já existe uma notificação do mesmo tipo/registro criada hoje antes de
inserir).

## Teste manual feito (critério de pronto da Etapa 6)

1. Criada uma demanda de teste com `due_date` 3 dias no passado e status
   `em_andamento`.
2. Função invocada manualmente via `net.http_post` (mesmo mecanismo do cron).
3. Confirmado que a demanda virou `status = 'atrasada'` de verdade no banco.
4. Encontrado e corrigido um bug: o `summary` da resposta afirmava ter criado
   notificações mesmo quando não existe nenhum `admin_geral`/`admin_equipe`
   ativo no projeto (`staffIds` vazio) — a tabela `notifications` continuava
   vazia, mas o contador subia do mesmo jeito. Corrigido fazendo `notifyStaff`
   retornar `boolean` (só `true` quando realmente inseriu linha) e os 4
   pontos de chamada só incrementarem o contador correspondente `if (notified)`.
   Adicionado também `staff_users_found` ao `summary` para facilitar
   diagnóstico. Função redeployada (v2) e reinvocada — resposta confirmada
   batendo com a realidade do banco (`staff_users_found: 0`,
   `demand_overdue_notifications: 0`, `notifications` vazia).
5. Demanda de teste removida do banco depois de validar.

**Pendência conhecida:** o caminho de *inserção* de notificação (quando
existe pelo menos 1 `admin_geral`/`admin_equipe` ativo) ainda não foi
exercitado de ponta a ponta, porque este projeto ainda não tem nenhum usuário
desse tipo cadastrado. Isso será validado naturalmente assim que o primeiro
Admin Geral for convidado pela tela `/configuracoes/usuarios` — vale rodar a
função manualmente uma vez depois disso (SQL abaixo) e conferir se a tabela
`notifications` recebe as linhas.

## Rodar manualmente / verificar

```sql
-- Disparar a função na mão (mesmo request que o cron faz)
select net.http_post(
  url := 'https://vqrnjiwansfobxaeswnu.supabase.co/functions/v1/daily-alerts',
  headers := jsonb_build_object(
    'Authorization', 'Bearer <anon_key>',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);

-- Ver a resposta da última chamada (troque o id pelo retornado acima)
select status_code, content::text from net._http_response where id = <request_id>;

-- Ver histórico de execuções do cron
select * from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'daily-alerts')
  order by start_time desc limit 10;

-- Trocar o horário ou recriar o job (ex: se a anon key for rotacionada)
select cron.unschedule('daily-alerts');
-- e rodar de novo o select cron.schedule(...) de supabase/scheduled_jobs.sql
```

## Alternativa manual (se pg_cron algum dia não for suficiente)

Supabase também permite invocar a função por um scheduler externo (GitHub
Actions, cron de outro servidor, etc.) batendo na mesma URL com a mesma
`Authorization: Bearer <anon_key>`. Não é necessário para o MVP — `pg_cron`
roda dentro do próprio banco, sem infraestrutura extra.
