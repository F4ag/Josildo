-- Mirror local do agendamento aplicado ao projeto Supabase lidera+
-- (já aplicado via apply_migration "schedule_daily_alerts_edge_function").
--
-- Módulo 10: agenda a Edge Function daily-alerts para rodar 1x por dia via
-- pg_cron + pg_net. Chamada autenticada com a anon key (chave pública, RLS
-- não é o que protege esse endpoint — verify_jwt=true na função exige só um
-- JWT válido, e a lógica interna usa a service_role key por dentro).
--
-- Horário: 09:00 UTC = 06:00 horário de Brasília (BRT, UTC-3, sem horário de
-- verão desde 2019) — roda antes do expediente, para os alertas já estarem
-- prontos quando a equipe chegar.
--
-- Se a anon key for rotacionada, rode de novo (cron.schedule com o mesmo
-- nome substitui o job anterior automaticamente):
--
--   select cron.unschedule('daily-alerts');
--   select cron.schedule('daily-alerts', '0 9 * * *', $$ ... $$);

select cron.schedule(
  'daily-alerts',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://vqrnjiwansfobxaeswnu.supabase.co/functions/v1/daily-alerts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcm5qaXdhbnNmb2J4YWVzd251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjM1NjYsImV4cCI6MjA5OTA5OTU2Nn0.hRHQmgW-lIh1mL_BX0NCmF_fAGnpfqBVlHWpJiIABjg',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verificação:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'daily-alerts';
-- select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'daily-alerts') order by start_time desc limit 5;

-- ----------------------------------------------------------------------------
-- election-results-sync — Edge Function import-election-results, a cada 2
-- horas. A função sai rápido (sem custo real) se nenhuma organização tiver
-- candidato configurado, ou se o arquivo do TSE ainda não tiver sido
-- publicado (fetch retorna 404 até a apuração começar) — por isso o job
-- fica sempre ativo, em vez de precisar ser ligado manualmente perto da
-- eleição. No dia da eleição, dá pra chamar a function manualmente (mesma
-- URL, headers de Authorization) pra não esperar o intervalo de 2h.
--
--   select cron.unschedule('election-results-sync');
--   select cron.schedule('election-results-sync', '0 */2 * * *', $$ ... $$);
-- ----------------------------------------------------------------------------

select cron.schedule(
  'election-results-sync',
  '0 */2 * * *',
  $$
  select net.http_post(
    url := 'https://vqrnjiwansfobxaeswnu.supabase.co/functions/v1/import-election-results',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcm5qaXdhbnNmb2J4YWVzd251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MjM1NjYsImV4cCI6MjA5OTA5OTU2Nn0.hRHQmgW-lIh1mL_BX0NCmF_fAGnpfqBVlHWpJiIABjg',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verificação:
-- select jobid, jobname, schedule, active from cron.job where jobname = 'election-results-sync';
-- select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'election-results-sync') order by start_time desc limit 5;
