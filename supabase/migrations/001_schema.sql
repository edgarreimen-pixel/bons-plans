-- =====================================================================
--  BONS PLANS — schéma principal (Supabase / PostgreSQL 15+)
--  À exécuter une fois dans Supabase > SQL Editor.
--  Idempotent : peut être ré-exécuté sans perte de données.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 1. Sources : registre de toutes les sources (connectées OU prévues)
--    Le statut "active" est déclaré par la config ; la preuve qu'une
--    source fonctionne réellement = last_success_at + last_item_count,
--    écrits par le collecteur après chaque passage.
-- ---------------------------------------------------------------------
create table if not exists public.sources (
  id                   text primary key,
  name                 text not null,
  kind                 text not null,
  status               text not null default 'planned'
                       check (status in ('active','planned','needs_key','disabled')),
  country              text,
  homepage             text,
  categories           text[] not null default '{}',
  description          text,
  ttl_hours            int  not null default 72,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  last_error           text,
  last_item_count      int,
  consecutive_failures int  not null default 0,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Offres
--   price_source : d'où vient le prix actuel
--     'marchand'    = API/flux officiel du marchand lui-même (Steam, Shopify…)
--     'agregateur'  = service de suivi de prix tiers (CheapShark)
--     'communaute'  = signalé par un membre d'une communauté (Dealabs…)
--   ref_status : fiabilité de l'ancien prix
--     'verifie'      = confirmé par NOTRE historique (plus bas prix des 30 j
--                      précédant la baisse, ≥ 7 j d'observation)
--     'annonce'      = prix barré annoncé par le vendeur/la source, non vérifié
--     'non_confirme' = notre historique contredit la réduction annoncée
--     'aucun'        = pas d'ancien prix connu
-- ---------------------------------------------------------------------
create table if not exists public.offers (
  offer_key              text primary key,
  source_id              text not null references public.sources(id) on delete cascade,
  native_id              text,
  title                  text not null,
  brand                  text,
  merchant               text,
  merchant_domain        text,
  url                    text not null,
  image_url              text,
  category               text,
  subcategory            text,
  country                text,
  currency               text not null default 'EUR',
  price                  numeric(12,2),
  announced_ref_price    numeric(12,2),
  verified_ref_price     numeric(12,2),
  announced_discount_pct numeric(5,2),
  verified_discount_pct  numeric(5,2),
  discount_pct           numeric(5,2),
  savings                numeric(12,2),
  price_source           text not null default 'communaute'
                         check (price_source in ('marchand','agregateur','communaute')),
  ref_status             text not null default 'aucun'
                         check (ref_status in ('verifie','annonce','non_confirme','aucun')),
  deal_types             text[] not null default '{}',
  promo_code             text,
  condition              text not null default 'inconnu'
                         check (condition in ('neuf','reconditionne','occasion','numerique','inconnu')),
  free_shipping          boolean,
  availability           text not null default 'inconnu'
                         check (availability in ('en_stock','rupture','inconnu')),
  popularity             numeric(6,2),
  starts_at              timestamptz,
  expires_at             timestamptz,
  published_at           timestamptz,
  first_seen_at          timestamptz not null default now(),
  last_seen_at           timestamptz not null default now(),
  is_active              boolean not null default true,
  inactive_reason        text,
  inactive_at            timestamptz,
  dedupe_key             text not null,
  search_text            text not null default '',
  extra                  jsonb not null default '{}'
);

create index if not exists offers_active_idx     on public.offers (is_active, last_seen_at desc);
create index if not exists offers_dedupe_idx     on public.offers (dedupe_key);
create index if not exists offers_source_idx     on public.offers (source_id);
create index if not exists offers_category_idx   on public.offers (category);
create index if not exists offers_search_trgm    on public.offers using gin (search_text gin_trgm_ops);
create index if not exists offers_dealtypes_idx  on public.offers using gin (deal_types);

-- ---------------------------------------------------------------------
-- 3. Historique des prix (par produit, même hors promotion)
--    Une ligne n'est ajoutée que lorsque le prix CHANGE.
-- ---------------------------------------------------------------------
create table if not exists public.price_history (
  product_key text not null,
  price       numeric(12,2) not null,
  observed_at timestamptz not null default now(),
  primary key (product_key, observed_at)
);
create index if not exists price_history_key_idx on public.price_history (product_key, observed_at desc);

-- ---------------------------------------------------------------------
-- 4. Journal des collectes + état global d'actualisation
-- ---------------------------------------------------------------------
create table if not exists public.runs (
  id          bigserial primary key,
  trigger     text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running','success','partial','failed')),
  stats       jsonb not null default '{}'
);

create table if not exists public.refresh_state (
  id                     int primary key default 1 check (id = 1),
  last_run_started_at    timestamptz,
  last_run_finished_at   timestamptz,
  last_success_at        timestamptz,
  last_dispatch_at       timestamptz,
  stale_after_minutes    int not null default 90,
  min_dispatch_minutes   int not null default 20
);
insert into public.refresh_state (id) values (1) on conflict do nothing;

-- =====================================================================
-- 5. Calcul automatique : vérification des prix et étiquettes
-- =====================================================================
create or replace function public.offers_compute() returns trigger
language plpgsql as $$
declare
  v_last_diff    timestamptz;  -- dernière observation à un prix différent
  v_streak_start timestamptz;  -- début du prix actuel
  v_first        timestamptz;  -- toute première observation
  v_ref          numeric;      -- plus bas prix des 30 j avant la baisse
  v_min_before   numeric;      -- plus bas prix jamais vu avant le prix actuel
  v_auto_tags    text[] := array['exceptionnel','erreur_prix_possible','plus_bas_constate','reduction_non_confirmee'];
begin
  if tg_op = 'UPDATE' then
    new.first_seen_at := old.first_seen_at;
  end if;

  -- retire les étiquettes calculées : elles sont recalculées ci-dessous
  new.deal_types := array(select t from unnest(coalesce(new.deal_types,'{}')) t where t <> all (v_auto_tags));
  new.verified_ref_price := null;
  new.verified_discount_pct := null;

  if new.announced_ref_price is not null and new.price is not null
     and new.announced_ref_price > new.price and new.announced_ref_price > 0 then
    new.announced_discount_pct := round((1 - new.price / new.announced_ref_price) * 100, 2);
  else
    new.announced_discount_pct := null;
    if new.announced_ref_price is not null and new.price is not null
       and new.announced_ref_price <= new.price then
      new.announced_ref_price := null;
    end if;
  end if;

  if new.price is not null then
    select max(observed_at) into v_last_diff
      from public.price_history where product_key = new.offer_key and price <> new.price;
    select min(observed_at) into v_first
      from public.price_history where product_key = new.offer_key;

    if v_last_diff is not null then
      select min(observed_at) into v_streak_start
        from public.price_history where product_key = new.offer_key and observed_at > v_last_diff;
      v_streak_start := coalesce(v_streak_start, now());

      if v_first <= v_streak_start - interval '7 days' then
        -- prix en vigueur pendant les 30 j précédant la baisse :
        -- observations dans la fenêtre + prix déjà en vigueur à son début
        select min(p) into v_ref from (
          select price p from public.price_history
           where product_key = new.offer_key
             and observed_at >= v_streak_start - interval '30 days'
             and observed_at <  v_streak_start
          union all
          (select price from public.price_history
            where product_key = new.offer_key
              and observed_at < v_streak_start - interval '30 days'
            order by observed_at desc limit 1)
        ) w;
      end if;
      select min(price) into v_min_before from public.price_history
       where product_key = new.offer_key and observed_at < v_streak_start;
    end if;
  end if;

  if v_ref is not null and v_ref > new.price then
    new.ref_status            := 'verifie';
    new.verified_ref_price    := v_ref;
    new.verified_discount_pct := round((1 - new.price / v_ref) * 100, 2);
  elsif new.announced_discount_pct is not null and (
          (v_ref is not null and v_ref <= new.price)
       or (v_last_diff is null and v_first is not null and v_first <= now() - interval '30 days')) then
    -- le vendeur annonce une réduction mais le prix était identique ou plus bas récemment
    new.ref_status := 'non_confirme';
    new.deal_types := array_append(new.deal_types, 'reduction_non_confirmee');
  elsif new.announced_discount_pct is not null then
    new.ref_status := 'annonce';
  else
    new.ref_status := 'aucun';
  end if;

  new.discount_pct := case new.ref_status
                        when 'verifie' then new.verified_discount_pct
                        when 'annonce' then new.announced_discount_pct
                        else null end;
  new.savings := case new.ref_status
                   when 'verifie' then round(new.verified_ref_price - new.price, 2)
                   when 'annonce' then round(new.announced_ref_price - new.price, 2)
                   else null end;

  -- étiquettes réservées aux réductions VÉRIFIÉES par l'historique
  if new.ref_status = 'verifie' then
    if new.verified_discount_pct >= 50 then new.deal_types := array_append(new.deal_types, 'exceptionnel'); end if;
    if new.verified_discount_pct >= 70 then new.deal_types := array_append(new.deal_types, 'erreur_prix_possible'); end if;
  end if;
  if v_first is not null and v_first <= now() - interval '60 days'
     and v_min_before is not null and new.price < v_min_before then
    new.deal_types := array_append(new.deal_types, 'plus_bas_constate');
  end if;

  new.deal_types := array(select distinct t from unnest(new.deal_types) t order by t);
  if new.is_active then
    new.inactive_reason := null;
    new.inactive_at := null;
  end if;
  return new;
end $$;

drop trigger if exists offers_compute_trg on public.offers;
create trigger offers_compute_trg before insert or update on public.offers
  for each row execute function public.offers_compute();

create or replace function public.offers_record_price() returns trigger
language plpgsql as $$
begin
  if new.price is not null and (tg_op = 'INSERT' or new.price is distinct from old.price) then
    insert into public.price_history (product_key, price, observed_at)
    select new.offer_key, new.price, now()
     where coalesce((select h.price from public.price_history h
                      where h.product_key = new.offer_key
                      order by h.observed_at desc limit 1), -1) <> new.price
    on conflict do nothing;
  end if;
  return null;
end $$;

drop trigger if exists offers_record_price_trg on public.offers;
create trigger offers_record_price_trg after insert or update of price on public.offers
  for each row execute function public.offers_record_price();

-- =====================================================================
-- 6. Fonctions appelées par le collecteur (clé service_role uniquement)
-- =====================================================================

-- Observations de prix pour des produits HORS promotion (Shopify, Woo…)
-- afin de pouvoir vérifier une future baisse.
create or replace function public.record_observations(p_obs jsonb) returns int
language plpgsql as $$
declare n int;
begin
  insert into public.price_history (product_key, price, observed_at)
  select x.k, x.p, now()
    from jsonb_to_recordset(p_obs) as x(k text, p numeric)
   where x.p is not null
     and coalesce((select h.price from public.price_history h
                    where h.product_key = x.k order by h.observed_at desc limit 1), -1) <> x.p
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Fin de passage d'une source : désactivation de ce qui n'est plus en promo
create or replace function public.finalize_source(
  p_source text, p_seen text[], p_full_catalog boolean, p_not_on_sale text[] default '{}'
) returns int language plpgsql as $$
declare n int := 0; m int := 0;
begin
  update public.offers set is_active = false, inactive_reason = 'plus_en_promotion', inactive_at = now()
   where source_id = p_source and is_active and offer_key = any(p_not_on_sale);
  get diagnostics n = row_count;
  if p_full_catalog then
    update public.offers set is_active = false, inactive_reason = 'retiree_par_la_source', inactive_at = now()
     where source_id = p_source and is_active and not (offer_key = any(p_seen));
    get diagnostics m = row_count;
  end if;
  return n + m;
end $$;

-- Expiration générale (appelée par le collecteur ET par pg_cron)
create or replace function public.expire_offers() returns jsonb
language plpgsql as $$
declare a int; b int; c int; d int;
begin
  update public.offers set is_active = false, inactive_reason = 'expiree', inactive_at = now()
   where is_active and expires_at is not null and expires_at < now();
  get diagnostics a = row_count;

  update public.offers o set is_active = false, inactive_reason = 'non_revue', inactive_at = now()
    from public.sources s
   where o.source_id = s.id and o.is_active
     and o.last_seen_at < now() - make_interval(hours => s.ttl_hours);
  get diagnostics b = row_count;

  delete from public.offers where not is_active and inactive_at < now() - interval '120 days';
  get diagnostics c = row_count;
  delete from public.price_history where observed_at < now() - interval '400 days';
  get diagnostics d = row_count;
  delete from public.runs where started_at < now() - interval '30 days';
  return jsonb_build_object('expired', a, 'stale', b, 'purged_offers', c, 'purged_history', d);
end $$;

create or replace function public.start_run(p_trigger text) returns bigint
language plpgsql as $$
declare v_id bigint;
begin
  insert into public.runs (trigger) values (p_trigger) returning id into v_id;
  update public.refresh_state set last_run_started_at = now() where id = 1;
  return v_id;
end $$;

create or replace function public.finish_run(p_id bigint, p_status text, p_stats jsonb) returns void
language plpgsql as $$
begin
  update public.runs set finished_at = now(), status = p_status, stats = p_stats where id = p_id;
  update public.refresh_state
     set last_run_finished_at = now(),
         last_success_at = case when p_status in ('success','partial') then now() else last_success_at end
   where id = 1;
end $$;

-- =====================================================================
-- 7. Vue publique : offres actives, dédoublonnées
-- =====================================================================
drop view if exists public.offers_public;
create view public.offers_public with (security_invoker = true) as
select distinct on (o.dedupe_key)
       o.*,
       count(*) over (partition by o.dedupe_key) as same_deal_count,
       round((
           coalesce(o.popularity, 35) * 0.5
         + coalesce(o.discount_pct, 0) * 0.5
         + case o.ref_status when 'verifie' then 20 when 'non_confirme' then -30 else 0 end
         + case o.price_source when 'marchand' then 5 else 0 end
         + greatest(0, 20 - extract(epoch from now() - o.first_seen_at) / 10800)
       )::numeric, 2) as rank_score
  from public.offers o
 where o.is_active
 order by o.dedupe_key,
          (o.ref_status = 'verifie') desc,
          (o.price_source = 'marchand') desc,
          o.price asc nulls last,
          o.popularity desc nulls last;

-- Facettes pour les filtres
create or replace function public.get_facets(p_country text default null) returns jsonb
language sql stable security invoker as $$
  with base as (select * from public.offers_public where p_country is null or country = p_country)
  select jsonb_build_object(
    'total',      (select count(*) from base),
    'categories', (select coalesce(jsonb_object_agg(k, n), '{}') from
                    (select coalesce(category,'autres') k, count(*) n from base group by 1) t),
    'merchants',  (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'n', n) order by n desc), '[]') from
                    (select merchant k, count(*) n from base where merchant is not null group by 1 order by 2 desc limit 300) t),
    'brands',     (select coalesce(jsonb_agg(jsonb_build_object('name', k, 'n', n) order by n desc), '[]') from
                    (select brand k, count(*) n from base where brand is not null group by 1 order by 2 desc limit 300) t),
    'countries',  (select coalesce(jsonb_object_agg(k, n), '{}') from
                    (select coalesce(country,'??') k, count(*) n from public.offers_public group by 1) t)
  );
$$;

-- =====================================================================
-- 8. Sécurité : lecture publique, écriture réservée au collecteur
-- =====================================================================
alter table public.sources       enable row level security;
alter table public.offers        enable row level security;
alter table public.price_history enable row level security;
alter table public.runs          enable row level security;
alter table public.refresh_state enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sources','offers','price_history','runs','refresh_state'] loop
    execute format('drop policy if exists "lecture publique" on public.%I', t);
    execute format('create policy "lecture publique" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

revoke execute on function public.record_observations(jsonb)                 from public, anon, authenticated;
revoke execute on function public.finalize_source(text,text[],boolean,text[]) from public, anon, authenticated;
revoke execute on function public.expire_offers()                            from public, anon, authenticated;
revoke execute on function public.start_run(text)                            from public, anon, authenticated;
revoke execute on function public.finish_run(bigint,text,jsonb)              from public, anon, authenticated;
grant  execute on function public.get_facets(text)                           to anon, authenticated;
grant  execute on function public.record_observations(jsonb), public.finalize_source(text,text[],boolean,text[]),
       public.expire_offers(), public.start_run(text), public.finish_run(bigint,text,jsonb) to service_role;
grant  usage  on schema public to anon, authenticated;
grant  select on public.sources, public.offers, public.price_history, public.runs,
                 public.refresh_state, public.offers_public to anon, authenticated;
revoke insert, update, delete on public.sources, public.offers, public.price_history, public.runs,
                 public.refresh_state from anon, authenticated;
