// Accès lecture seule à Supabase (clé "anon" publique + RLS).
// Aucune requête ne passe par une IA : consulter l'appli ne coûte rien.

const cfg = window.BONSPLANS_CONFIG || {};
export const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/VOTRE/.test(cfg.supabaseUrl));
const BASE = configured ? cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1' : '';
const HEADERS = configured ? { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` } : {};

const memo = new Map();
const MEMO_MS = 60_000;

async function request(path, { method = 'GET', body, headers = {}, cache = true } = {}) {
  const key = method + path + (headers.Range || '');
  const hit = cache && method === 'GET' ? memo.get(key) : null;
  if (hit && Date.now() - hit.t < MEMO_MS) return hit.v;
  const r = await fetch(BASE + path, {
    method,
    headers: { ...HEADERS, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 206) throw new Error(`Erreur ${r.status}`);
  const data = await r.json();
  const range = r.headers.get('content-range');
  const total = range && range.includes('/') ? Number(range.split('/')[1]) : null;
  const v = { data, total: Number.isFinite(total) ? total : null };
  if (cache && method === 'GET') memo.set(key, { t: Date.now(), v });
  return v;
}

export const clearCache = () => memo.clear();

export const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;          // valeur citée pour in.(...)
const like = (w) => w.replace(/[%*,()"\\]/g, ' ').trim();

export const SORTS = {
  pertinence: { label: 'Pertinence', order: 'rank_score.desc,first_seen_at.desc' },
  remise:     { label: 'Plus forte remise', order: 'discount_pct.desc.nullslast,rank_score.desc' },
  prix:       { label: 'Prix croissant', order: 'price.asc.nullslast' },
  nouveau:    { label: 'Nouveautés', order: 'first_seen_at.desc' },
  fin:        { label: 'Se termine bientôt', order: 'expires_at.asc.nullslast' },
  populaire:  { label: 'Popularité', order: 'popularity.desc.nullslast,rank_score.desc' },
};

/** Construit la requête PostgREST à partir de l'état des filtres. */
export function buildQuery(f) {
  const p = new URLSearchParams();
  p.set('select', 'offer_key,source_id,title,brand,merchant,url,image_url,category,subcategory,country,currency,price,announced_ref_price,verified_ref_price,discount_pct,savings,price_source,ref_status,deal_types,promo_code,condition,free_shipping,availability,popularity,expires_at,first_seen_at,last_seen_at,same_deal_count,extra');
  const and = [];
  for (const w of fold(f.q).split(/\s+/).map(like).filter(Boolean).slice(0, 6)) and.push(`search_text.ilike.*${w}*`);
  if (and.length) p.set('and', `(${and.join(',')})`);
  if (f.category) p.set('category', `eq.${f.category}`);
  if (f.subcategory) p.set('subcategory', `eq.${f.subcategory}`);
  if (f.countries?.length) p.set('country', `in.(${f.countries.map(q).join(',')})`);
  if (f.priceMin !== '' && f.priceMin != null) p.append('price', `gte.${Number(f.priceMin)}`);
  if (f.priceMax !== '' && f.priceMax != null) p.append('price', `lte.${Number(f.priceMax)}`);
  if (f.discountMin) p.set('discount_pct', `gte.${Number(f.discountMin)}`);
  if (f.verifiedOnly) p.set('ref_status', 'eq.verifie');
  if (f.merchantOnly) p.set('price_source', 'eq.marchand');
  if (f.merchants?.length) p.set('merchant', `in.(${f.merchants.map(q).join(',')})`);
  if (f.brands?.length) p.set('brand', `in.(${f.brands.map(q).join(',')})`);
  if (f.conditions?.length) p.set('condition', `in.(${f.conditions.join(',')})`);
  if (f.freeShipping) p.set('free_shipping', 'is.true');
  if (f.inStock) p.set('availability', 'neq.rupture');
  if (f.dealTypes?.length) p.set('deal_types', `ov.{${f.dealTypes.join(',')}}`);
  if (f.endsWithin) p.set('expires_at', `lte.${new Date(Date.now() + Number(f.endsWithin) * 3600e3).toISOString()}`);
  if (f.sort === 'fin' && !f.endsWithin) p.set('expires_at', 'not.is.null');
  if (f.popularityMin) p.set('popularity', `gte.${Number(f.popularityMin)}`);
  if (f.newOnly) p.set('first_seen_at', `gte.${new Date(Date.now() - 24 * 3600e3).toISOString()}`);
  if (f.keys) p.set('offer_key', `in.(${f.keys.map(q).join(',')})`);
  p.set('order', (SORTS[f.sort] || SORTS.pertinence).order);
  return p.toString();
}

export async function fetchOffers(filters, offset = 0, limit = 36) {
  const { data, total } = await request(`/offers_public?${buildQuery(filters)}`, {
    headers: { Range: `${offset}-${offset + limit - 1}`, 'Range-Unit': 'items', Prefer: 'count=estimated' },
  });
  return { items: data, total };
}

export async function fetchOffer(key) {
  const { data } = await request(`/offers?offer_key=eq.${encodeURIComponent(key)}&select=*,sources(name,kind)`);
  return data[0] || null;
}

export async function fetchHistory(key) {
  const since = new Date(Date.now() - 365 * 864e5).toISOString();
  const { data } = await request(`/price_history?product_key=eq.${encodeURIComponent(key)}&observed_at=gte.${since}&order=observed_at.asc&select=price,observed_at`);
  return data;
}

export async function fetchFacets(country) {
  const { data } = await request('/rpc/get_facets', { method: 'POST', body: { p_country: country || null }, cache: false });
  return data;
}

export async function fetchSources() {
  const { data } = await request('/sources?select=*&order=status.asc,name.asc');
  return data;
}

export async function fetchRefreshState(fresh = false) {
  const { data } = await request('/refresh_state?select=*', { cache: !fresh });
  return data[0] || null;
}

export async function fetchLastRuns() {
  const { data } = await request('/runs?select=id,trigger,started_at,finished_at,status,stats&order=started_at.desc&limit=8', { cache: false });
  return data;
}

export async function requestRefresh() {
  const { data } = await request('/rpc/request_refresh', { method: 'POST', body: {}, cache: false });
  return data;
}
