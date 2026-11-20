// =====================================================================
//  Bons Plans — interface. Lecture seule ; aucune IA n'est sollicitée.
// =====================================================================
import * as api from './api.js';
import { TAXONOMY, DEAL_TYPES } from './taxonomy.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : null);

// ---------- Préférences locales (favoris, pays) ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('bp:' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bp:' + k, JSON.stringify(v)); } catch { /* navigation privée */ } },
};
let favorites = new Set(store.get('favorites', []));
const toggleFav = (key) => {
  favorites.has(key) ? favorites.delete(key) : favorites.add(key);
  store.set('favorites', [...favorites]);
  return favorites.has(key);
};

// ---------- Formatage ----------
const money = (v, cur = 'EUR') => {
  if (v === null || v === undefined) return null;
  try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); }
  catch { return `${v} ${cur}`; }
};
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(iso) {
  if (!iso) return '—';
  const s = (new Date(iso) - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return 'à l’instant';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
function remaining(iso) {
  if (!iso) return null;
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return 'terminée';
  const h = ms / 3600e3;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60e3))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}
const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const pct = (v) => `−${Math.round(v)} %`;

const COUNTRIES = { FR: '🇫🇷 France', INT: '🌍 International', GB: '🇬🇧 Royaume-Uni', DE: '🇩🇪 Allemagne', ES: '🇪🇸 Espagne', IT: '🇮🇹 Italie', US: '🇺🇸 États-Unis' };
const CONDITIONS = { neuf: 'Neuf', reconditionne: 'Reconditionné', occasion: 'Occasion', numerique: 'Numérique', inconnu: 'Non précisé' };
const PRICE_SOURCE = { marchand: 'Prix du marchand', agregateur: 'Suivi de prix tiers', communaute: 'Prix communautaire' };
const FILTER_DEAL_TYPES = ['destockage', 'liquidation', 'vente_flash', 'code_promo', 'gratuit', 'vente_privee', 'offre_lancement', 'saisonnier', 'cumulable', 'exclusif', 'erreur_prix_signalee', 'exceptionnel', 'plus_bas_constate'];

// ---------- État des filtres (synchronisé avec l'adresse : recherches partageables) ----------
const DEFAULTS = {
  q: '', category: '', subcategory: '', sort: 'pertinence', countries: store.get('countries', ['FR', 'INT']),
  priceMin: '', priceMax: '', discountMin: 0, verifiedOnly: false, merchantOnly: false, merchants: [], brands: [],
  conditions: [], freeShipping: false, inStock: false, dealTypes: [], endsWithin: '', popularityMin: 0, newOnly: false,
};
let filters = { ...DEFAULTS };
const LIST_KEYS = ['countries', 'merchants', 'brands', 'conditions', 'dealTypes'];
const BOOL_KEYS = ['verifiedOnly', 'merchantOnly', 'freeShipping', 'inStock', 'newOnly'];

function filtersFromParams(params) {
  const f = { ...DEFAULTS };
  for (const [k, v] of params) {
    if (!(k in DEFAULTS)) continue;
    if (LIST_KEYS.includes(k)) f[k] = v ? v.split('|') : [];
    else if (BOOL_KEYS.includes(k)) f[k] = v === '1';
    else f[k] = v;
  }
  return f;
}
function filtersToParams(f) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    const d = DEFAULTS[k];
    if (JSON.stringify(v) === JSON.stringify(d)) continue;
    if (Array.isArray(v)) p.set(k, v.join('|'));
    else if (typeof v === 'boolean') p.set(k, v ? '1' : '0');
    else if (v !== '' && v !== null) p.set(k, v);
  }
  return p.toString();
}
const activeFilterCount = () => ['priceMin', 'priceMax', 'discountMin', 'verifiedOnly', 'merchantOnly', 'merchants', 'brands', 'conditions', 'freeShipping', 'inStock', 'dealTypes', 'endsWithin', 'popularityMin', 'newOnly']
  .filter((k) => JSON.stringify(filters[k]) !== JSON.stringify(DEFAULTS[k])).length;

// ---------- Toast & feuille ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}
let sheetOnClose = null;
function openSheet(html, onClose) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grabber"></div>${html}`;
  sh.scrollTop = 0;
  sh.classList.add('on');
  $('#scrim').classList.add('on');
  document.body.style.overflow = 'hidden';
  sheetOnClose = onClose || null;
  sh.querySelector('[data-close]')?.addEventListener('click', closeSheet);
  return sh;
}
function closeSheet() {
  $('#sheet').classList.remove('on');
  $('#scrim').classList.remove('on');
  document.body.style.overflow = '';
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (cb) cb();
}
$('#scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#sheet').classList.contains('on')) closeSheet(); });

// Glisser vers le bas pour fermer (mobile)
(() => {
  const sh = $('#sheet');
  let y0 = null;
  sh.addEventListener('touchstart', (e) => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) sh.style.transform = `translate(-50%, ${dy}px)`;
  }, { passive: true });
  sh.addEventListener('touchend', (e) => {
    if (y0 === null) return;
    const dy = e.changedTouches[0].clientY - y0;
    sh.style.transform = '';
    y0 = null;
    if (dy > 110) closeSheet();
  });
})();

// ---------- Fraîcheur des données (vérifiée à chaque ouverture) ----------
let lastSuccessSeen = null;
let pollTimer = null;
function setFresh(kind, text) {
  const el = $('#fresh');
  el.className = `fresh ${kind}`;
  $('.txt', el).textContent = text;
}
async function checkFreshness() {
  if (!api.configured) { setFresh('stale', 'Non configurée'); return; }
  try {
    const st = await api.fetchRefreshState(true);
    lastSuccessSeen = st?.last_success_at || null;
    const staleMin = st?.stale_after_minutes || 90;
    const age = lastSuccessSeen ? (Date.now() - new Date(lastSuccessSeen)) / 60e3 : Infinity;
    if (age <= staleMin) { setFresh('ok', `À jour · ${ago(lastSuccessSeen)}`); return; }
    setFresh('busy', 'Actualisation…');
    let res = { status: 'error' };
    try { res = await api.requestRefresh(); } catch { /* RPC absente : actualisation planifiée seulement */ }
    if (['dispatched', 'running', 'pending'].includes(res?.status)) {
      setFresh('busy', lastSuccessSeen ? 'Mise à jour en cours…' : 'Première collecte en cours…');
      startPolling();
    } else {
      setFresh('stale', lastSuccessSeen ? `Mis à jour ${ago(lastSuccessSeen)}` : 'Aucune collecte encore');
    }
  } catch {
    setFresh('stale', 'Hors ligne');
  }
}
function startPolling() {
  clearInterval(pollTimer);
  const t0 = Date.now();
  pollTimer = setInterval(async () => {
    if (Date.now() - t0 > 15 * 60e3) { clearInterval(pollTimer); setFresh('stale', `Mis à jour ${ago(lastSuccessSeen)}`); return; }
    try {
      const st = await api.fetchRefreshState(true);
      if (st?.last_success_at && st.last_success_at !== lastSuccessSeen) {
        clearInterval(pollTimer);
        lastSuccessSeen = st.last_success_at;
        setFresh('ok', `À jour · ${ago(lastSuccessSeen)}`);
        api.clearCache();
        toast('Nouvelles offres disponibles');
        if (route().name === 'offres') renderOffers({ keepScroll: true });
      }
    } catch { /* on réessaie */ }
  }, 30_000);
}
$('#fresh').addEventListener('click', () => {
  if (!lastSuccessSeen) return;
  toast(`Dernière collecte réussie : ${dateTime(lastSuccessSeen)}`);
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkFreshness(); });

// ---------- Cartes ----------
const catIcon = (c) => TAXONOMY[c]?.icon || '✨';
function badgeHtml(o) {
  if (o.price === 0) return `<span class="badge-pct badge-free">Gratuit</span>`;
  if (o.discount_pct >= 1) {
    const verified = o.ref_status === 'verifie';
    return `<span class="badge-pct ${verified ? '' : 'announced'}" title="${verified ? 'Réduction vérifiée par notre historique' : 'Réduction annoncée par le vendeur'}">${pct(o.discount_pct)}</span>`;
  }
  return '';
}
function tagsHtml(o, max = 3) {
  const t = [];
  if (o.ref_status === 'verifie') t.push('<span class="tag ok">✓ Prix vérifié</span>');
  if (o.ref_status === 'non_confirme') t.push('<span class="tag warn">Réduction non confirmée</span>');
  for (const d of ['erreur_prix_possible', 'exceptionnel', 'plus_bas_constate', 'vente_flash', 'destockage', 'liquidation', 'code_promo', 'vente_privee', 'erreur_prix_signalee', 'saisonnier']) {
    if (o.deal_types?.includes(d)) t.push(`<span class="tag ${['erreur_prix_possible', 'exceptionnel', 'vente_flash'].includes(d) ? 'deal' : 'info'}">${esc(DEAL_TYPES[d]?.label || d)}</span>`);
  }
  const left = remaining(o.expires_at);
  if (left && left !== 'terminée') t.push(`<span class="tag">⏱ ${left}</span>`);
  if (o.free_shipping) t.push('<span class="tag">Livraison offerte</span>');
  if (o.condition === 'reconditionne') t.push('<span class="tag">Reconditionné</span>');
  return t.slice(0, max).join('');
}
function cardHtml(o, i) {
  const img = safeUrl(o.image_url);
  const ref = o.ref_status === 'verifie' ? o.verified_ref_price : o.ref_status === 'annonce' ? o.announced_ref_price : null;
  const price = money(o.price, o.currency);
  return `<button class="card glass" data-key="${esc(o.offer_key)}" style="animation-delay:${Math.min(i, 12) * 35}ms">
    <div class="media">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'${catIcon(o.category)}'}))">` : `<span class="ph">${catIcon(o.category)}</span>`}
      ${badgeHtml(o)}
      <span class="fav" role="button" tabindex="0" aria-label="Favori" aria-pressed="${favorites.has(o.offer_key)}" data-fav="${esc(o.offer_key)}">${favorites.has(o.offer_key) ? '♥' : '♡'}</span>
    </div>
    <div class="body">
      <div class="meta"><span>${esc(o.merchant || 'Marchand non précisé')}</span>${o.same_deal_count > 1 ? `<span>· ${o.same_deal_count} sources</span>` : ''}</div>
      <h3>${esc(o.title)}</h3>
      <div class="tags">${tagsHtml(o)}</div>
      <div class="price-row">
        ${price ? `<span class="price">${price}</span>` : `<span class="price unknown">${o.promo_code ? 'Code promo' : 'Prix sur le site'}</span>`}
        ${ref ? `<span class="was">${money(ref, o.currency)}</span>` : ''}
      </div>
    </div>
  </button>`;
}

// ---------- Vue Offres ----------
let facets = null;
let listState = { offset: 0, total: null, loading: false, done: false, token: 0 };
let io = null;

function categoryChips() {
  const counts = facets?.categories || {};
  const all = `<button class="chip" data-cat="" aria-pressed="${!filters.category}">Tout ${facets ? `<small>${facets.total}</small>` : ''}</button>`;
  const cats = Object.entries(TAXONOMY)
    .map(([k, c]) => ({ k, c, n: counts[k] || 0 }))
    .sort((a, b) => (b.n > 0) - (a.n > 0) || b.n - a.n)
    .map(({ k, c, n }) => `<button class="chip" data-cat="${k}" aria-pressed="${filters.category === k}">${c.icon} ${esc(c.label)} ${facets ? `<small>${n}</small>` : ''}</button>`);
  return all + cats.join('');
}
function subChips() {
  const c = TAXONOMY[filters.category];
  if (!c || !Object.keys(c.subs).length) return '';
  return `<div class="chips subchips">
    <button class="chip" data-sub="" aria-pressed="${!filters.subcategory}">Toutes</button>
    ${Object.entries(c.subs).map(([k, s]) => `<button class="chip" data-sub="${k}" aria-pressed="${filters.subcategory === k}">${esc(s.label)}</button>`).join('')}
  </div>`;
}

function pillGroup(name, options, selected, multi = true) {
  return `<div class="pills">${Object.entries(options).map(([k, label]) => `<button class="pill" type="button" data-pill="${name}" data-val="${esc(k)}" data-multi="${multi}" aria-pressed="${multi ? selected.includes(k) : String(selected) === String(k)}">${esc(label)}</button>`).join('')}</div>`;
}
function searchList(name, items, selected) {
  if (!items?.length) return '<p class="fnote">Aucune donnée pour l’instant.</p>';
  return `<input class="field" type="search" placeholder="Rechercher…" data-filterlist="${name}">
  <div class="searchlist" data-list="${name}">
    ${items.map((m) => `<label data-name="${esc(api.fold(m.name))}"><input type="checkbox" data-check="${name}" value="${esc(m.name)}" ${selected.includes(m.name) ? 'checked' : ''}> ${esc(m.name)} <small>${m.n}</small></label>`).join('')}
  </div>`;
}
function filtersHtml(mode) {
  return `
  <div class="fgroup"><h4>Prix</h4>
    <div class="frow"><input class="field" inputmode="decimal" placeholder="Min" data-num="priceMin" value="${esc(filters.priceMin)}"><span>—</span><input class="field" inputmode="decimal" placeholder="Max" data-num="priceMax" value="${esc(filters.priceMax)}"></div>
    <p class="fnote">Dans la devise de chaque offre.</p></div>
  <div class="fgroup"><h4>Réduction minimale</h4>${pillGroup('discountMin', { 0: 'Toutes', 20: '20 %+', 30: '30 %+', 50: '50 %+', 70: '70 %+' }, filters.discountMin, false)}</div>
  <div class="fgroup"><h4>Fiabilité</h4>
    <label class="switch">Réductions vérifiées uniquement <input type="checkbox" data-bool="verifiedOnly" ${filters.verifiedOnly ? 'checked' : ''}></label>
    <label class="switch">Prix fournis par le marchand <input type="checkbox" data-bool="merchantOnly" ${filters.merchantOnly ? 'checked' : ''}></label></div>
  <div class="fgroup"><h4>Type d’offre</h4>${pillGroup('dealTypes', Object.fromEntries(FILTER_DEAL_TYPES.map((k) => [k, DEAL_TYPES[k].label])), filters.dealTypes)}</div>
  <div class="fgroup"><h4>Durée restante</h4>${pillGroup('endsWithin', { '': 'Indifférent', 6: '< 6 h', 24: '< 24 h', 72: '< 3 jours', 168: '< 7 jours' }, filters.endsWithin, false)}</div>
  <div class="fgroup"><h4>Disponibilité & livraison</h4>
    <label class="switch">En stock uniquement <input type="checkbox" data-bool="inStock" ${filters.inStock ? 'checked' : ''}></label>
    <label class="switch">Livraison gratuite <input type="checkbox" data-bool="freeShipping" ${filters.freeShipping ? 'checked' : ''}></label>
    <label class="switch">Nouveautés (24 h) <input type="checkbox" data-bool="newOnly" ${filters.newOnly ? 'checked' : ''}></label></div>
  <div class="fgroup"><h4>Popularité</h4>${pillGroup('popularityMin', { 0: 'Toutes', 40: 'Appréciées', 70: 'Très populaires' }, filters.popularityMin, false)}</div>
  <div class="fgroup"><h4>État du produit</h4>${pillGroup('conditions', CONDITIONS, filters.conditions)}</div>
  <div class="fgroup"><h4>Pays</h4>${pillGroup('countries', COUNTRIES, filters.countries)}</div>
  <div class="fgroup"><h4>Enseigne</h4>${searchList('merchants', facets?.merchants, filters.merchants)}</div>
  <div class="fgroup"><h4>Marque</h4>${searchList('brands', facets?.brands, filters.brands)}</div>
  <div class="filters-actions">
    <button class="btn" type="button" data-reset>Réinitialiser</button>
    ${mode === 'sheet' ? '<button class="btn primary" type="button" data-close style="flex:1;justify-content:center">Voir les résultats</button>' : ''}
  </div>`;
}

function bindFilters(root, onChange) {
  root.addEventListener('click', (e) => {
    const pill = e.target.closest('[data-pill]');
    if (pill) {
      const name = pill.dataset.pill;
      const val = pill.dataset.val;
      if (pill.dataset.multi === 'true') {
        const set = new Set(filters[name]);
        set.has(val) ? set.delete(val) : set.add(val);
        filters[name] = [...set];
        if (name === 'countries') store.set('countries', filters.countries);
      } else {
        filters[name] = ['discountMin', 'popularityMin'].includes(name) ? Number(val) : val;
        root.querySelectorAll(`[data-pill="${name}"]`).forEach((b) => b.setAttribute('aria-pressed', b === pill));
      }
      if (pill.dataset.multi === 'true') pill.setAttribute('aria-pressed', filters[name].includes(val));
      onChange();
    }
    if (e.target.closest('[data-reset]')) {
      const keep = { q: filters.q, category: filters.category, subcategory: filters.subcategory, sort: filters.sort };
      filters = { ...DEFAULTS, ...keep, countries: ['FR', 'INT'] };
      store.set('countries', filters.countries);
      root.innerHTML = filtersHtml(root.dataset.mode);
      onChange();
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.bool) { filters[t.dataset.bool] = t.checked; onChange(); }
    if (t.dataset.check) {
      const set = new Set(filters[t.dataset.check]);
      t.checked ? set.add(t.value) : set.delete(t.value);
      filters[t.dataset.check] = [...set];
      onChange();
    }
  });
  let numTimer;
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.num) {
      clearTimeout(numTimer);
      numTimer = setTimeout(() => { filters[t.dataset.num] = t.value.replace(',', '.').replace(/[^\d.]/g, ''); onChange(); }, 450);
    }
    if (t.dataset.filterlist) {
      const needle = api.fold(t.value);
      root.querySelectorAll(`[data-list="${t.dataset.filterlist}"] label`).forEach((l) => { l.style.display = l.dataset.name.includes(needle) ? '' : 'none'; });
    }
  });
}

function syncUrl() {
  const qs = filtersToParams(filters);
  const target = '#/' + (qs ? `?${qs}` : '');
  if (location.hash !== target) history.replaceState(null, '', target);
}

async function renderOffers({ keepScroll = false } = {}) {
  if (!keepScroll || !app.querySelector('.grid')) {
    app.innerHTML = `
    <section class="hero">
      <h1>Les vraies <em>bonnes affaires</em>,<br>vérifiées.</h1>
      <p>Promotions, déstockages, ventes flash et codes promo collectés automatiquement auprès de communautés, de marchands et de boutiques indépendantes. Chaque réduction affiche son niveau de fiabilité.</p>
    </section>
    <form class="searchbar glass" role="search" id="searchform">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Produit, marque, besoin…" value="${esc(filters.q)}" autocomplete="off" enterkeyhint="search" aria-label="Rechercher">
      <button class="btn open-filters" type="button" id="openFilters">Filtres ${activeFilterCount() ? `<span class="count">${activeFilterCount()}</span>` : ''}</button>
    </form>
    <div class="chips" id="cats">${categoryChips()}</div>
    <div id="subs">${subChips()}</div>
    <div class="toolbar">
      <span class="result-count" id="count">Chargement…</span>
      <select class="select" id="sort" aria-label="Trier">${Object.entries(api.SORTS).map(([k, s]) => `<option value="${k}" ${filters.sort === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
    </div>
    <div class="layout with-side">
      <aside class="filters-panel glass" id="side" data-mode="side" aria-label="Filtres">${filtersHtml('side')}</aside>
      <div><div class="grid" id="grid"></div><div class="more" id="more"></div></div>
    </div>`;

    const refresh = () => { syncUrl(); loadList(true); $('#openFilters').innerHTML = `Filtres ${activeFilterCount() ? `<span class="count">${activeFilterCount()}</span>` : ''}`; };
    let qTimer;
    $('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { filters.q = e.target.value; refresh(); }, 320); });
    $('#searchform').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(qTimer); filters.q = $('#q').value; refresh(); $('#q').blur(); });
    $('#sort').addEventListener('change', (e) => { filters.sort = e.target.value; refresh(); });
    $('#cats').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      filters.category = b.dataset.cat === filters.category ? '' : b.dataset.cat;
      filters.subcategory = '';
      $('#cats').querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.cat === filters.category));
      $('#subs').innerHTML = subChips();
      refresh();
    });
    $('#subs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sub]');
      if (!b) return;
      filters.subcategory = b.dataset.sub;
      $('#subs').querySelectorAll('[data-sub]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.sub === filters.subcategory));
      refresh();
    });
    bindFilters($('#side'), refresh);
    $('#openFilters').addEventListener('click', () => {
      const sh = openSheet(`<div class="sheet-head"><h2 id="sheet-title">Filtres</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div><div data-mode="sheet" id="sheetFilters">${filtersHtml('sheet')}</div>`,
        () => { $('#side').innerHTML = filtersHtml('side'); });
      sh.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheet));
      bindFilters($('#sheetFilters'), refresh);
    });
    $('#grid').addEventListener('click', onGridClick);
    $('#grid').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.fav) { e.preventDefault(); onGridClick(e); } });

    api.fetchFacets(filters.countries.length === 1 ? filters.countries[0] : null).then((f) => {
      facets = f;
      if (!$('#cats')) return;
      $('#cats').innerHTML = categoryChips();
      if (!$('#sheet').classList.contains('on')) $('#side').innerHTML = filtersHtml('side');
    }).catch(() => {});
  }
  await loadList(true);
}

function onGridClick(e) {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.stopPropagation();
    const on = toggleFav(fav.dataset.fav);
    fav.setAttribute('aria-pressed', on);
    fav.textContent = on ? '♥' : '♡';
    toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
    if (!on && route().name === 'favoris') fav.closest('.card')?.remove();
    return;
  }
  const card = e.target.closest('[data-key]');
  if (card) openDetail(card.dataset.key);
}

async function loadList(reset, extra = {}) {
  const grid = $('#grid');
  if (!grid) return;
  if (reset) {
    listState = { offset: 0, total: null, loading: false, done: false, token: listState.token + 1 };
    grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join('');
  }
  if (listState.loading || listState.done) return;
  listState.loading = true;
  const token = listState.token;
  try {
    const { items, total } = await api.fetchOffers({ ...filters, ...extra }, listState.offset);
    if (token !== listState.token) return;
    if (reset) grid.innerHTML = '';
    grid.insertAdjacentHTML('beforeend', items.map((o, i) => cardHtml(o, i)).join(''));
    listState.offset += items.length;
    listState.total = total;
    listState.done = items.length === 0 || (total !== null && listState.offset >= total);
    const count = $('#count');
    if (count) count.textContent = total === null ? `${listState.offset} offres` : `${total.toLocaleString('fr-FR')} offre${total > 1 ? 's' : ''} active${total > 1 ? 's' : ''}`;
    if (reset && !items.length) grid.innerHTML = emptyHtml(extra.keys ? 'favoris' : 'filtres');
    setupInfinite(extra);
  } catch {
    if (token === listState.token) grid.innerHTML = `<div class="empty glass" style="grid-column:1/-1"><div class="big">📡</div><h2>Connexion impossible</h2><p>Les offres n’ont pas pu être chargées. Vérifiez votre connexion puis réessayez.</p><p><button class="btn" onclick="location.reload()">Réessayer</button></p></div>`;
  } finally {
    if (token === listState.token) listState.loading = false;
  }
}

function emptyHtml(kind) {
  if (kind === 'favoris') return `<div class="empty glass" style="grid-column:1/-1"><div class="big">♡</div><h2>Aucun favori actif</h2><p>Touchez le cœur d’une offre pour la retrouver ici. Les offres expirées disparaissent automatiquement.</p></div>`;
  const neverCollected = !lastSuccessSeen;
  return `<div class="empty glass" style="grid-column:1/-1"><div class="big">${neverCollected ? '⏳' : '🔍'}</div>
    <h2>${neverCollected ? 'Aucune offre collectée pour l’instant' : 'Aucune offre ne correspond'}</h2>
    <p>${neverCollected ? 'La première collecte n’a pas encore eu lieu. Elle démarre automatiquement ; revenez dans quelques minutes.' : 'Essayez d’élargir la recherche, de retirer un filtre ou d’ajouter des pays.'}</p></div>`;
}

function setupInfinite(extra) {
  io?.disconnect();
  const more = $('#more');
  if (!more) return;
  more.innerHTML = listState.done ? '' : '<button class="btn" id="moreBtn">Afficher plus</button>';
  if (listState.done) return;
  $('#moreBtn').addEventListener('click', () => loadList(false, extra));
  io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) loadList(false, extra); }, { rootMargin: '600px' });
  io.observe(more);
}

// ---------- Favoris ----------
async function renderFavorites() {
  app.innerHTML = `<section class="hero"><h1>Vos <em>favoris</em></h1><p>Enregistrés sur cet appareil. Les offres expirées ou retirées par leur source n’apparaissent plus.</p></section>
  <div class="toolbar"><span class="result-count" id="count"></span></div>
  <div class="grid" id="grid"></div><div class="more" id="more"></div>`;
  $('#grid').addEventListener('click', onGridClick);
  if (!favorites.size) { $('#grid').innerHTML = emptyHtml('favoris'); return; }
  await loadList(true, { ...DEFAULTS, countries: [], keys: [...favorites].slice(0, 150) });
}

// ---------- Fiche détaillée ----------
function verifyBox(o) {
  const cur = o.currency;
  const src = o.sources?.name || o.source_id;
  const origin = { marchand: `Prix relevé directement auprès du marchand (${esc(src)}).`, agregateur: `Prix fourni par un service de suivi des prix (${esc(src)}).`, communaute: `Prix indiqué par un membre de la communauté ${esc(src)} ; il peut avoir changé depuis.` }[o.price_source];
  switch (o.ref_status) {
    case 'verifie': return `<div class="verify ok"><strong>✓ Réduction vérifiée</strong>${money(o.verified_ref_price, cur)} était le prix le plus bas pratiqué au cours des 30 jours précédant la baisse, d’après notre propre historique de prix. ${origin}</div>`;
    case 'annonce': return `<div class="verify"><strong>Prix barré annoncé par le vendeur</strong>L’ancien prix de ${money(o.announced_ref_price, cur)} n’a pas encore pu être vérifié par notre historique (le suivi démarre dès la première collecte). ${origin}</div>`;
    case 'non_confirme': return `<div class="verify warn"><strong>⚠ Réduction non confirmée</strong>Le vendeur affiche un prix barré de ${money(o.announced_ref_price, cur)}, mais nous avons relevé un prix identique ou inférieur au cours des 30 derniers jours. ${origin}</div>`;
    default: return `<div class="verify"><strong>Pas d’ancien prix connu</strong>${origin}</div>`;
  }
}
function historyChart(rows, current, cur) {
  if (!rows || rows.length < 2) return `<p class="fnote">Historique de prix : ${rows?.length === 1 ? `premier relevé le ${dateTime(rows[0].observed_at)}` : 'aucun relevé'}. Le suivi se construit à chaque collecte.</p>`;
  const pts = rows.map((r) => ({ t: new Date(r.observed_at).getTime(), p: Number(r.price) }));
  pts.push({ t: Date.now(), p: Number(current ?? pts.at(-1).p) });
  const t0 = pts[0].t, t1 = pts.at(-1).t;
  const pMin = Math.min(...pts.map((x) => x.p)), pMax = Math.max(...pts.map((x) => x.p));
  const X = (t) => ((t - t0) / Math.max(1, t1 - t0)) * 300;
  const Y = (p) => 100 - ((p - pMin) / Math.max(0.01, pMax - pMin)) * 90 - 5;
  let d = `M${X(pts[0].t)},${Y(pts[0].p)}`;
  for (let i = 1; i < pts.length; i++) d += ` H${X(pts[i].t)} V${Y(pts[i].p)}`;
  return `<div class="chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Historique du prix">
    <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} V100 H0 Z" fill="url(#g)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
    <div class="legend"><span>${new Date(t0).toLocaleDateString('fr-FR')}</span><span>min ${money(pMin, cur)} · max ${money(pMax, cur)}</span><span>aujourd’hui</span></div></div>`;
}

async function openDetail(key) {
  history.replaceState(null, '', `#/offre/${encodeURIComponent(key)}`);
  const backTo = filtersToParams(filters);
  const sh = openSheet(`<div class="sheet-head"><h2 id="sheet-title">Chargement…</h2><button class="icon-btn" data-close aria-label="Fermer">✕</button></div><div class="skeleton" style="aspect-ratio:2/1"></div>`,
    () => { if (location.hash.startsWith('#/offre/')) history.replaceState(null, '', '#/' + (backTo ? `?${backTo}` : '')); if (!app.innerHTML) render(); });
  try {
    const [o, hist] = await Promise.all([api.fetchOffer(key), api.fetchHistory(key)]);
    if (!o) { sh.innerHTML = `<div class="grabber"></div><div class="sheet-head"><h2 id="sheet-title">Offre introuvable</h2><button class="icon-btn" data-close>✕</button></div><p>Cette offre a été retirée ou a expiré.</p>`; sh.querySelector('[data-close]').onclick = closeSheet; return; }
    const img = safeUrl(o.image_url);
    const link = safeUrl(o.url);
    const ref = o.ref_status === 'verifie' ? o.verified_ref_price : o.ref_status === 'annonce' ? o.announced_ref_price : null;
    const left = remaining(o.expires_at);
    const cls = TAXONOMY[o.category];
    sh.innerHTML = `<div class="grabber"></div>
    <div class="sheet-head"><span class="tag">${cls ? `${cls.icon} ${esc(cls.label)}${o.subcategory && cls.subs[o.subcategory] ? ' · ' + esc(cls.subs[o.subcategory].label) : ''}` : ''}</span><button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
    <div class="detail">
      <div class="media">${img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : `<span class="ph" style="font-size:72px">${catIcon(o.category)}</span>`}</div>
      <div>
        <div class="meta" style="color:var(--ink-2);font-size:13px">${esc(o.merchant || 'Marchand non précisé')}${o.brand ? ' · ' + esc(o.brand) : ''}</div>
        <h2 id="sheet-title">${esc(o.title)}</h2>
        <div class="price-row">
          ${o.price !== null ? `<span class="price">${money(o.price, o.currency)}</span>` : '<span class="price unknown">Prix à consulter sur le site</span>'}
          ${ref ? `<span class="was" style="font-size:16px">${money(ref, o.currency)}</span>` : ''}
          ${o.discount_pct ? `<span class="tag deal">${pct(o.discount_pct)} · ${money(o.savings, o.currency)} d’économie</span>` : ''}
        </div>
        <div class="tags" style="margin-top:10px">${tagsHtml(o, 8)}</div>
        ${o.promo_code ? `<p><button class="code-box" id="copyCode" title="Copier le code">${esc(o.promo_code)} <span style="font-size:12px;font-weight:600">Copier</span></button></p>` : ''}
        <div style="margin-top:14px">${verifyBox(o)}</div>
        <dl class="facts">
          <dt>Enseigne</dt><dd>${esc(o.merchant || '—')}</dd>
          <dt>Source</dt><dd>${esc(o.sources?.name || o.source_id)} · ${esc(PRICE_SOURCE[o.price_source])}</dd>
          <dt>Collecte</dt><dd>${dateTime(o.last_seen_at)} (vue pour la première fois ${ago(o.first_seen_at)})</dd>
          <dt>Expiration</dt><dd>${o.expires_at ? `${dateTime(o.expires_at)}${left ? ` · ${left === 'terminée' ? 'terminée' : 'encore ' + left}` : ''}` : 'Non communiquée'}</dd>
          <dt>Disponibilité</dt><dd>${{ en_stock: 'En stock', rupture: 'Rupture de stock', inconnu: 'Non communiquée' }[o.availability]}</dd>
          <dt>État</dt><dd>${CONDITIONS[o.condition]}</dd>
          <dt>Livraison</dt><dd>${o.free_shipping ? 'Gratuite (annoncée)' : 'Non précisée'}</dd>
          <dt>Pays</dt><dd>${esc(COUNTRIES[o.country] || o.country || '—')}</dd>
          ${o.extra?.temperature !== undefined ? `<dt>Communauté</dt><dd>${Math.round(o.extra.temperature)}° de popularité</dd>` : ''}
        </dl>
        <h4 style="margin:6px 0 0;font-size:13px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em">Historique du prix</h4>
        ${historyChart(hist, o.price, o.currency)}
        <div class="cta">
          ${link ? `<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">Voir l’offre ↗</a>` : ''}
          <button class="btn" id="favBtn">${favorites.has(o.offer_key) ? '♥ Favori' : '♡ Favori'}</button>
          <button class="btn" id="shareBtn">Partager</button>
        </div>
        <p class="fnote">Vérifiez toujours le prix final sur le site du marchand avant d’acheter. ${o.is_active ? '' : '<strong>Cette offre n’est plus active.</strong>'}</p>
      </div>
    </div>`;
    sh.querySelector('[data-close]').onclick = closeSheet;
    $('#copyCode')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(o.promo_code); toast('Code copié'); } catch { toast(o.promo_code); } });
    $('#favBtn').addEventListener('click', (e) => { const on = toggleFav(o.offer_key); e.currentTarget.textContent = on ? '♥ Favori' : '♡ Favori'; document.querySelectorAll(`[data-fav="${CSS.escape(o.offer_key)}"]`).forEach((f) => { f.textContent = on ? '♥' : '♡'; f.setAttribute('aria-pressed', on); }); });
    $('#shareBtn').addEventListener('click', async () => {
      const url = location.href;
      try { if (navigator.share) await navigator.share({ title: o.title, text: `${o.title} — ${money(o.price, o.currency) || ''}`, url }); else { await navigator.clipboard.writeText(url); toast('Lien copié'); } } catch { /* annulé */ }
    });
  } catch {
    sh.innerHTML = `<div class="grabber"></div><div class="sheet-head"><h2 id="sheet-title">Erreur de chargement</h2><button class="icon-btn" data-close>✕</button></div><p>Réessayez dans un instant.</p>`;
    sh.querySelector('[data-close]').onclick = closeSheet;
  }
}

// ---------- Sources ----------
const KIND_LABEL = { pepper: 'Communauté (RSS)', rss: 'Flux RSS', steam: 'API marchand', epic: 'API marchand', cheapshark: 'API publique', shop: 'Boutique indépendante', 'shop:shopify': 'Boutique Shopify', 'shop:woocommerce': 'Boutique WooCommerce', planned: 'Prévue' };
function sourceStatus(s) {
  if (s.status === 'active') {
    if (!s.last_run_at) return { cls: '', label: 'Connectée · en attente du 1er passage', group: 'connected' };
    if (s.last_success_at && (!s.last_error || s.last_error.startsWith('Partiel')) && new Date(s.last_success_at) >= new Date(s.last_run_at) - 1000)
      return { cls: s.last_error ? 'warn' : 'ok', label: s.last_error ? 'Connectée · partielle' : 'Connectée · fonctionne', group: 'connected' };
    return { cls: 'warn', label: 'Connectée · en échec', group: 'failing' };
  }
  if (s.status === 'needs_key') return { cls: 'info', label: 'Prévue · clé ou compte requis', group: 'planned' };
  if (s.status === 'disabled') return { cls: '', label: 'Désactivée', group: 'planned' };
  return { cls: '', label: 'Prévue · non collectée', group: 'planned' };
}
function sourceCard(s) {
  const st = sourceStatus(s);
  return `<div class="src glass">
    <div class="src-top"><b>${esc(s.name)}</b><span class="tag">${esc(KIND_LABEL[s.kind] || s.kind)}</span><span class="tag ${st.cls} st">${st.label}</span></div>
    <p>${esc(s.description || '')}</p>
    ${s.status === 'active' ? `<p>${s.last_success_at ? `Dernière réussite ${ago(s.last_success_at)} · ${s.last_item_count ?? 0} offre${s.last_item_count > 1 ? 's' : ''}` : 'Jamais réussie pour l’instant'}${s.country ? ' · ' + esc(COUNTRIES[s.country] || s.country) : ''}</p>` : ''}
    ${s.last_error ? `<p class="err">${esc(s.last_error)}</p>` : ''}
    ${safeUrl(s.homepage) ? `<p><a href="${esc(s.homepage)}" target="_blank" rel="noopener noreferrer">${esc(s.homepage.replace(/^https?:\/\//, ''))}</a></p>` : ''}
  </div>`;
}
async function renderSources() {
  app.innerHTML = `<section class="hero"><h1>Sources <em>connectées</em> et prévues</h1><p>État mesuré à chaque collecte, sans retouche. Une source « connectée » n’est comptée comme fonctionnelle que si son dernier passage a réellement rapporté des données.</p></section><div id="srcBody"><div class="skeleton" style="aspect-ratio:5/1;margin-top:20px"></div></div>`;
  try {
    const [sources, runs] = await Promise.all([api.fetchSources(), api.fetchLastRuns()]);
    const groups = { connected: [], failing: [], planned: [] };
    for (const s of sources) groups[sourceStatus(s).group].push(s);
    const working = groups.connected.filter((s) => s.last_success_at);
    const offers = working.reduce((a, s) => a + (s.last_item_count || 0), 0);
    $('#srcBody').innerHTML = `
      <div class="stats">
        <div class="stat glass"><b>${working.length}</b><span>sources qui fonctionnent</span></div>
        <div class="stat glass"><b>${groups.failing.length}</b><span>connectées en échec</span></div>
        <div class="stat glass"><b>${groups.planned.length}</b><span>prévues (non collectées)</span></div>
        <div class="stat glass"><b>${offers.toLocaleString('fr-FR')}</b><span>offres au dernier passage</span></div>
      </div>
      ${groups.connected.length ? `<h2 class="section-title">Connectées</h2><div class="src-list">${groups.connected.map(sourceCard).join('')}</div>` : ''}
      ${groups.failing.length ? `<h2 class="section-title">Connectées mais en échec</h2><div class="src-list">${groups.failing.map(sourceCard).join('')}</div>` : ''}
      <h2 class="section-title">Prévues pour une intégration future</h2>
      <p class="fnote" style="margin:-4px 2px 12px">Aucune donnée n’est collectée pour ces sources. Elles nécessitent une API, un compte partenaire ou un accord, ou leurs conditions interdisent la collecte automatisée.</p>
      <div class="src-list">${groups.planned.map(sourceCard).join('')}</div>
      <h2 class="section-title">Dernières collectes</h2>
      <div class="src-list">${runs.map((r) => `<div class="src glass"><div class="src-top"><b>${dateTime(r.started_at)}</b><span class="tag ${r.status === 'success' ? 'ok' : r.status === 'running' ? 'info' : 'warn'} st">${{ success: 'Réussie', partial: 'Partielle', failed: 'Échec', running: 'En cours' }[r.status]}</span></div>
        <p>${{ schedule: 'Planifiée', app_open: 'Ouverture de l’appli', manual: 'Manuelle' }[r.trigger] || esc(r.trigger)} · ${r.stats?.offers ?? '—'} offres · ${r.stats?.sources_ok ?? '—'} sources OK${r.stats?.deactivated ? ` · ${r.stats.deactivated} désactivées` : ''}${r.stats?.duration_s ? ` · ${r.stats.duration_s} s` : ''}</p></div>`).join('') || '<p class="fnote">Aucune collecte pour l’instant.</p>'}</div>`;
  } catch {
    $('#srcBody').innerHTML = '<div class="empty glass"><h2>Chargement impossible</h2><p>Réessayez dans un instant.</p></div>';
  }
}

// ---------- Fiabilité ----------
function renderAbout() {
  app.innerHTML = `<section class="hero"><h1>Comment les prix sont <em>vérifiés</em></h1><p>Aucune réduction n’est présentée comme exceptionnelle sans preuve.</p></section>
  <article class="prose glass" style="border-radius:28px;padding:clamp(20px,4vw,36px);margin-top:20px">
    <h2>D’où viennent les offres ?</h2>
    <p>Un moteur de collecte autonome interroge les sources toutes les deux heures, et dès qu’un visiteur ouvre l’application avec des données de plus de 90 minutes. Il fonctionne seul, sans intelligence artificielle : consulter l’application ne déclenche aucun coût.</p>
    <ul>
      <li><b>Prix du marchand</b> : relevé directement auprès du site qui vend (Steam, Epic, boutiques indépendantes).</li>
      <li><b>Suivi de prix tiers</b> : fourni par un service spécialisé (CheapShark).</li>
      <li><b>Prix communautaire</b> : signalé par les membres d’une communauté de bons plans (Dealabs…). Il peut avoir changé depuis.</li>
    </ul>
    <h2>Les quatre niveaux de fiabilité</h2>
    <ul>
      <li><span class="tag ok">✓ Prix vérifié</span> L’ancien prix est le <b>plus bas prix pratiqué pendant les 30 jours précédant la baisse</b> (règle européenne « Omnibus »), d’après notre propre historique, avec au moins 7 jours d’observation.</li>
      <li><span class="tag">Annoncé</span> Prix barré affiché par le vendeur, pas encore vérifiable. La remise s’affiche sur fond sombre et non rouge.</li>
      <li><span class="tag warn">Réduction non confirmée</span> Le vendeur affiche un prix barré, mais nous avons relevé un prix identique ou inférieur dans les 30 derniers jours. Aucun pourcentage n’est mis en avant.</li>
      <li><span class="tag">Sans ancien prix</span> Le prix est affiché seul.</li>
    </ul>
    <p>Les mentions <b>Exceptionnel</b> (−50 % et plus), <b>Erreur de prix possible</b> (−70 % et plus) et <b>Plus bas prix constaté</b> (60 jours d’historique) ne sont attribuées <b>qu’aux réductions vérifiées</b>. Une « erreur de prix signalée » par la communauté reste présentée comme un signalement.</p>
    <h2>Expiration et doublons</h2>
    <p>Une offre est désactivée dès que sa date de fin est passée, que le marchand l’a retirée, qu’elle n’est plus en promotion, ou qu’elle n’a pas été revue par sa source depuis un délai propre à chaque source. Une offre présente sur plusieurs sources n’est affichée qu’une fois, en privilégiant le prix vérifié puis le prix du marchand.</p>
    <h2>Ce que l’application ne fait jamais</h2>
    <ul><li>Inventer un prix, une promotion ou un lien.</li><li>Collecter un site dont le fichier robots.txt ou les conditions l’interdisent.</li><li>Afficher des données de démonstration comme si elles étaient réelles.</li></ul>
  </article>`;
}

// ---------- Non configurée ----------
function renderSetup() {
  app.innerHTML = `<div class="setup glass"><h1 style="margin-top:0;letter-spacing:-.03em">Application non encore reliée à sa base</h1>
  <p>Cette page fonctionne, mais aucune base de données n’est configurée : aucune offre n’est donc affichée (l’application n’affiche jamais de fausses données).</p>
  <p>Pour la brancher, renseignez les variables <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code> du dépôt GitHub, comme indiqué dans le fichier <code>README.md</code>, étape 5.</p></div>`;
}

// ---------- Routeur ----------
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  if (h.startsWith('/offre/')) return { name: 'offre', key: decodeURIComponent(h.slice(7)) };
  const [path, qs] = h.split('?');
  const name = { '/': 'offres', '/favoris': 'favoris', '/sources': 'sources', '/a-propos': 'a-propos' }[path] || 'offres';
  return { name, params: new URLSearchParams(qs || '') };
}
function setNav(name) {
  document.querySelectorAll('[data-route]').forEach((a) => (a.dataset.route === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}
function render() {
  const r = route();
  if (!api.configured) { setNav(r.name); renderSetup(); return; }
  if (r.name === 'offre') {
    setNav('offres');
    if (!app.innerHTML) renderOffers();
    openDetail(r.key);
    return;
  }
  if ($('#sheet').classList.contains('on')) closeSheet();
  setNav(r.name);
  window.scrollTo({ top: 0 });
  if (r.name === 'offres') { filters = filtersFromParams(r.params); renderOffers(); }
  else if (r.name === 'favoris') renderFavorites();
  else if (r.name === 'sources') renderSources();
  else renderAbout();
}
window.addEventListener('hashchange', render);

// ---------- Démarrage ----------
render();
checkFreshness();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
