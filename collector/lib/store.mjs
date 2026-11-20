// Écriture dans Supabase via son API REST (PostgREST), sans dépendance.
// Utilise la clé service_role : uniquement côté collecteur (secret GitHub),
// jamais dans l'interface web.
import { writeFile, mkdir } from 'node:fs/promises';
import { OFFER_COLUMNS } from './offer.mjs';

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export class SupabaseStore {
  constructor(url, serviceKey) {
    if (!url || !serviceKey) throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (secrets GitHub).');
    this.base = url.replace(/\/$/, '') + '/rest/v1';
    this.headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  }

  async req(path, { method = 'GET', body, prefer } = {}) {
    const r = await fetch(this.base + path, {
      method,
      headers: { ...this.headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status} ${txt.slice(0, 400)}`);
    return txt ? JSON.parse(txt) : null;
  }

  rpc(fn, args = {}) {
    return this.req(`/rpc/${fn}`, { method: 'POST', body: args });
  }

  async getSourcesState() {
    const rows = await this.req('/sources?select=id,last_run_at,last_success_at,consecutive_failures');
    return new Map(rows.map((r) => [r.id, r]));
  }

  async syncSources(sources) {
    const rows = sources.map((s) => ({
      id: s.id, name: s.name, kind: s.kind, status: s.status, country: s.country || null,
      homepage: s.homepage || null, categories: s.categories || [], description: s.description || null,
      ttl_hours: s.ttl_hours || 72, updated_at: new Date().toISOString(),
    }));
    for (const c of chunk(rows, 500)) {
      await this.req('/sources?on_conflict=id', { method: 'POST', body: c, prefer: 'resolution=merge-duplicates,return=minimal' });
    }
  }

  async upsertOffers(offers) {
    const cols = OFFER_COLUMNS.join(',');
    for (const c of chunk(offers, 400)) {
      await this.req(`/offers?on_conflict=offer_key&columns=${cols}`, { method: 'POST', body: c, prefer: 'resolution=merge-duplicates,return=minimal' });
    }
  }

  async recordObservations(obs) {
    let n = 0;
    for (const c of chunk(obs, 1000)) n += (await this.rpc('record_observations', { p_obs: c })) || 0;
    return n;
  }

  finalizeSource(id, seen, fullCatalog, notOnSale) {
    return this.rpc('finalize_source', { p_source: id, p_seen: seen, p_full_catalog: fullCatalog, p_not_on_sale: notOnSale || [] });
  }

  async reportSource(id, patch) {
    await this.req(`/sources?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
  }

  startRun(trigger) { return this.rpc('start_run', { p_trigger: trigger }); }
  finishRun(id, status, stats) { return this.rpc('finish_run', { p_id: id, p_status: status, p_stats: stats }); }
  expire() { return this.rpc('expire_offers'); }
}

/** Mode essai : rien n'est écrit en base, tout est enregistré dans out/. */
export class DryRunStore {
  constructor() { this.offers = []; this.obs = 0; this.report = {}; }
  async getSourcesState() { return new Map(); }
  async syncSources() {}
  async upsertOffers(o) { this.offers.push(...o); }
  async recordObservations(o) { this.obs += o.length; return o.length; }
  async finalizeSource() { return 0; }
  async reportSource(id, patch) { this.report[id] = patch; }
  async startRun() { return 0; }
  async finishRun(_id, status, stats) {
    await mkdir('out', { recursive: true });
    await writeFile('out/dry-run.json', JSON.stringify({ status, stats, sources: this.report, offers: this.offers }, null, 2));
    console.log(`\n[essai] ${this.offers.length} offres réelles collectées, ${this.obs} observations → out/dry-run.json`);
  }
  async expire() { return {}; }
}
