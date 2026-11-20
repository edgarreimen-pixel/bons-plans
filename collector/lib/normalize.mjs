// Normalisation : textes, prix, URL, clés de dédoublonnage.

const TRACKING_PARAMS = /^(utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|igshid|yclid|ref_?|referrer|spm|scm|trk|cmpid|campaign_id|affid|aff_id|clickid|irclickid|ranmid|ranEAID|ranSiteID|siteID|awc|zanpid)$/i;

export function foldText(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanText(s, max = 300) {
  const t = String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

export function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return null;
  }
}

export function domainOf(raw) {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Interprète un prix écrit librement : "1 299,99 €", "19.99", "$1,299.99",
 * "12€50", "Gratuit". Renvoie null si aucun prix n'est lisible
 * (on n'invente jamais de prix).
 */
export function parsePrice(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? round2(input) : null;
  let s = String(input).trim();
  if (!s) return null;
  if (/^(gratuit|free|offert|0\s*€)$/i.test(s)) return 0;
  // 12€50 → 12.50
  const euroMid = s.match(/(\d+)\s*€\s*(\d{2})\b/);
  if (euroMid) return round2(Number(`${euroMid[1]}.${euroMid[2]}`));
  const m = s.match(/\d[\d\s.,  ]*/);
  if (!m) return null;
  let n = m[0].replace(/[\s  ]/g, '');
  n = n.replace(/[.,]$/, '');
  const lastComma = n.lastIndexOf(',');
  const lastDot = n.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // le dernier séparateur est le séparateur décimal
    if (lastComma > lastDot) n = n.replace(/\./g, '').replace(',', '.');
    else n = n.replace(/,/g, '');
  } else if (lastComma > -1) {
    const dec = n.length - lastComma - 1;
    n = dec === 3 && n.split(',').length > 1 && !/^0,/.test(n) ? n.replace(/,/g, '') : n.replace(/,/g, '.');
    if ((n.match(/\./g) || []).length > 1) n = n.replace(/\.(?=.*\.)/g, '');
  } else if (lastDot > -1) {
    const parts = n.split('.');
    if (parts.length > 2 || (parts[parts.length - 1].length === 3 && parts[0] !== '0')) n = n.replace(/\./g, '');
  }
  const v = Number(n);
  return Number.isFinite(v) ? round2(v) : null;
}

export const round2 = (x) => Math.round(x * 100) / 100;

const STOP = new Set('le la les un une des de du d l et a au aux en pour avec sans sur the and for with of in to by x pack lot'.split(' '));

export function dedupeKey(title, merchant) {
  const tokens = foldText(title)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t) && !/^\d+([.,]\d+)?(e|eur|euros|€)?$/.test(t))
    .slice(0, 10)
    .sort();
  return `${foldText(merchant || '?')}|${tokens.join(' ')}`;
}

export function safeDate(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
