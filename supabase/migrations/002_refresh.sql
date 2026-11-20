-- =====================================================================
--  BONS PLANS — actualisation à l'ouverture + filet de sécurité planifié
--  À exécuter APRÈS 001_schema.sql, dans Supabase > SQL Editor.
--
--  Principe :
--   - l'application, à l'ouverture, lit refresh_state ;
--   - si les données ont plus de 90 min, elle appelle request_refresh() ;
--   - la fonction (verrou anti-abus : 1 déclenchement / 20 min max)
--     demande à GitHub de lancer immédiatement le workflow de collecte.
--   - pg_cron appelle la même fonction toutes les 3 h (secours si le
--     planificateur GitHub est en retard ou désactivé) et fait expirer
--     les offres toutes les heures, même si le collecteur est en panne.
--  Aucune IA n'intervient : uniquement Postgres, GitHub et le collecteur.
-- =====================================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Secrets (à créer une fois, voir README) :
--   select vault.create_secret('github_pat_xxx', 'github_token');
--   select vault.create_secret('votre-compte/bonsplans', 'github_repo');
--   (optionnel) select vault.create_secret('main', 'github_ref');

create or replace function public.request_refresh() returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  st   public.refresh_state;
  tok  text;
  repo text;
  ref  text;
begin
  select * into st from public.refresh_state where id = 1 for update;

  if st.last_success_at is not null
     and st.last_success_at > now() - make_interval(mins => st.stale_after_minutes) then
    return jsonb_build_object('status','fresh','last_success_at', st.last_success_at);
  end if;

  if st.last_run_started_at is not null
     and st.last_run_started_at > now() - interval '30 minutes'
     and (st.last_run_finished_at is null or st.last_run_finished_at < st.last_run_started_at) then
    return jsonb_build_object('status','running','since', st.last_run_started_at);
  end if;

  if st.last_dispatch_at is not null
     and st.last_dispatch_at > now() - make_interval(mins => st.min_dispatch_minutes) then
    return jsonb_build_object('status','pending','dispatched_at', st.last_dispatch_at);
  end if;

  select decrypted_secret into tok  from vault.decrypted_secrets where name = 'github_token';
  select decrypted_secret into repo from vault.decrypted_secrets where name = 'github_repo';
  select decrypted_secret into ref  from vault.decrypted_secrets where name = 'github_ref';
  if tok is null or repo is null then
    return jsonb_build_object('status','not_configured');
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/' || repo || '/actions/workflows/collect.yml/dispatches',
    body    := jsonb_build_object('ref', coalesce(ref,'main'), 'inputs', jsonb_build_object('trigger','app_open')),
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || tok,
                 'Accept', 'application/vnd.github+json',
                 'X-GitHub-Api-Version', '2022-11-28',
                 'User-Agent', 'bonsplans-refresh',
                 'Content-Type', 'application/json')
  );

  update public.refresh_state set last_dispatch_at = now() where id = 1;
  return jsonb_build_object('status','dispatched');
end $$;

revoke execute on function public.request_refresh() from public;
grant  execute on function public.request_refresh() to anon, authenticated;

-- Tâches planifiées côté base (gratuites, incluses dans Supabase)
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('bonsplans-expire','bonsplans-refresh');
end $$;
select cron.schedule('bonsplans-expire',  '5 * * * *',    $$ select public.expire_offers(); $$);
select cron.schedule('bonsplans-refresh', '41 */3 * * *', $$ select public.request_refresh(); $$);
