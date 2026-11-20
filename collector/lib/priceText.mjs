// Extraction prudente d'un prix écrit dans un titre de bon plan.
// Ne renvoie un prix que s'il est accolé à un symbole monétaire.
import { parsePrice } from './normalize.mjs';

const CUR = '(?:€|eur\\b|euros?\\b|\\$|usd\\b|£|gbp\\b|chf\\b)';
const NUM = '\\d{1,3}(?:[ \\u00a0\\u202f.,]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
const AFTER = new RegExp(`(${NUM})\\s?${CUR}`, 'gi');
const BEFORE = new RegExp(`${CUR}\\s?(${NUM})`, 'gi');
const EURO_MID = /(\d+)\s?€\s?(\d{2})\b/g;

function allPrices(s) {
  const found = [];
  for (const m of s.matchAll(EURO_MID)) found.push({ i: m.index, v: Number(`${m[1]}.${m[2]}`) });
  for (const re of [AFTER, BEFORE]) for (const m of s.matchAll(re)) {
    if (found.some((f) => Math.abs(f.i - m.index) < 3)) continue;
    const v = parsePrice(m[1]);
    if (v !== null) found.push({ i: m.index, v });
  }
  return found.sort((a, b) => a.i - b.i);
}

export function pricesFromTitle(title) {
  const s = String(title || '');
  const list = allPrices(s);
  if (!list.length) return { price: null, ref: null };
  const lower = s.toLowerCase();
  const refIdx = lower.search(/au lieu de|\bvs\b|\bwas\b|prix conseill|instead of|\(?ancien prix/);
  let price = list[0].v;
  let ref = null;
  if (refIdx > -1) {
    const after = list.find((p) => p.i > refIdx);
    if (after) ref = after.v;
    const before = list.filter((p) => p.i < refIdx).pop();
    if (before) price = before.v;
  }
  return { price, ref: ref !== null && ref > price ? ref : null };
}

export function currencyFromText(s, fallback) {
  const t = String(s || '');
  if (/€|\beur\b|euro/i.test(t)) return 'EUR';
  if (/£|\bgbp\b/i.test(t)) return 'GBP';
  if (/\$|\busd\b/i.test(t)) return 'USD';
  if (/\bchf\b/i.test(t)) return 'CHF';
  return fallback;
}
