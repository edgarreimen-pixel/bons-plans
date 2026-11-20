#!/usr/bin/env node
// =====================================================================
//  Collecteur autonome de bonnes affaires — aucune IA, aucune clé Claude.
//  Lancé par GitHub Actions (toutes les 2 h + à la demande de l'appli).
//
//  node collector/index.mjs              → collecte réelle → Supabase
//  node collector/index.mjs --dry-run    → collecte réelle → out/dry-run.json
//  node collector/index.mjs --only=steam-fr,dealabs
// =====================================================================
import { readFile } from 'node:fs/promises';
import * as http from './lib/http.mjs';
import { buildOffer } from './lib/offer.mjs';
import { SupabaseStore, DryRunStore } from './lib/store.mjs';
import { CONNECTORS } from './connectors/registry.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const DRY = !!args['dry-run'];
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const TRIGGER = args.trigger || process.env.RUN_TRIGGER || 'manual';
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS || 14 * 60e3);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const started = Date.now();

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export async function loadSources() {
  const base = JSON.parse(await readFile(new URL('../config/sources.json', import.meta.url), 'utf8'));
  const shops = JSON.parse(await readFile(new URL('../config/shops.json', import.meta.url), 'utf8'));
  const fromShops = shops.shops.map((s) => ({
    id: `shop-${s.domain.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name: s.name,
    kind: 'shop',
    status: s.status || 'active',
    country: s.country || 'FR',
    currency: s.currency || 'EUR',
    homepage: `https://${s.domain}`,
    domain: s.domain,
    platform: s.platform || 'auto',
    categories: s.categories || [],
    categoryHint: s.categoryHint,
    brand: s.brand,
    description: s.description || 'Boutique indépendante — catalogue public',
    ttl_hours: 30,
    maxPages: s.maxPages,
  }));
  return [...base.sources, ...fromShops];
}

async function runSource(store, source, state) {
  const connector = CONNECTORS[source.kind];
  const t0 = Date.now();
  const res = { id: source.id, ok: false, offers: 0, rejected: {}, observations: 0, deactivated: 0, ms: 0 };
  try {
    if (!connector) throw new Error(`Aucun connecteur pour le type "${source.kind}"`);
    const out = await connector.collect(source, { http, log });
    const valid = new Map();
    for (const raw of out.offers || []) {
      const { offer, reason } = buildOffer(source, raw);
      if (!offer) { res.rejected[reason] = (res.rejected[reason] || 0) + 1; continue; }
      valid.set(offer.offer_key, offer);
    }
    const offers = [...valid.values()];
    if (offers.length) await store.upsertOffers(offers);
    if (out.observations?.length) res.observations = await store.recordObservations(out.observations);
    // On ne désactive QUE après une collecte réussie (jamais sur erreur)
    res.deactivated = await store.finalizeSource(source.id, offers.map((o) => o.offer_key), !!out.fullCatalog, out.notOnSaleKeys || []);
    res.offers = offers.length;
    res.ok = true;
    await store.reportSource(source.id, {
      last_run_at: new Date().toISOString(), last_success_at: new Date().toISOString(),
      last_error: out.warnings?.length ? `Partiel : ${out.warnings.join(' | ')}`.slice(0, 500) : null,
      last_item_count: offers.length, consecutive_failures: 0,
      ...(out.meta?.platform ? { kind: `shop:${out.meta.platform}` } : {}),
    });
    log(`✓ ${source.id}: ${offers.length} offres, ${res.observations} obs., ${res.deactivated} désactivées${Object.keys(res.rejected).length ? ', rejets ' + JSON.stringify(res.rejected) : ''}`);
  } catch (e) {
    res.error = e.robots ? `Bloqué par robots.txt — source non collectée` : String(e.message || e).slice(0, 500);
    await store.reportSource(source.id, {
      last_run_at: new Date().toISOString(), last_error: res.error,
      consecutive_failures: (state?.consecutive_failures || 0) + 1,
    }).catch(() => {});
    log(`✗ ${source.id}: ${res.error}`);
  }
  res.ms = Date.now() - t0;
  return res;
}

/** Une source en échec répété n'est retentée qu'une fois par jour. */
function shouldSkip(source, state) {
  if (!state || (state.consecutive_failures || 0) < 6) return false;
  const last = state.last_run_at ? new Date(state.last_run_at).getTime() : 0;
  return Date.now() - last < 24 * 3600e3;
}

export async function main() {
  const store = DRY ? new DryRunStore() : new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sources = await loadSources();
  await store.syncSources(sources);
  const state = await store.getSourcesState();
  const runId = await store.startRun(TRIGGER);
  const queue = sources.filter((s) => s.status === 'active' && (!ONLY || ONLY.has(s.id)));
  log(`Collecte (${TRIGGER}) : ${queue.length} sources actives sur ${sources.length} référencées`);

  const results = [];
  const skipped = [];
  let i = 0;
  async function worker() {
    while (i < queue.length) {
      const s = queue[i++];
      if (Date.now() - started > TIME_BUDGET_MS) { skipped.push({ id: s.id, why: 'budget temps' }); continue; }
      if (!DRY && shouldSkip(s, state.get(s.id))) { skipped.push({ id: s.id, why: 'échecs répétés, retentée sous 24 h' }); continue; }
      results.push(await runSource(store, s, state.get(s.id)));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  let expiry = {};
  try { expiry = await store.expire(); } catch (e) { log('expiration :', e.message); }

  const ok = results.filter((r) => r.ok).length;
  const status = results.length === 0 ? 'failed' : ok === results.length ? 'success' : ok > 0 ? 'partial' : 'failed';
  const stats = {
    sources_ok: ok, sources_failed: results.length - ok, skipped,
    offers: results.reduce((a, r) => a + r.offers, 0),
    observations: results.reduce((a, r) => a + r.observations, 0),
    deactivated: results.reduce((a, r) => a + r.deactivated, 0),
    expiry, duration_s: Math.round((Date.now() - started) / 1000),
    per_source: results.map(({ id, ok, offers, error, ms }) => ({ id, ok, offers, error, ms })),
  };
  await store.finishRun(runId, status, stats);
  log(`Terminé : ${status} — ${stats.offers} offres, ${ok}/${results.length} sources OK, ${stats.duration_s}s`);
  if (status === 'failed') process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
