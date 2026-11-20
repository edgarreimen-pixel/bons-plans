// Classement automatique par mots-clés (aucune IA, déterministe).
import { TAXONOMY } from '../../web/taxonomy.js';
import { foldText } from './normalize.mjs';

const RULES = [];
for (const [cat, c] of Object.entries(TAXONOMY)) {
  for (const [sub, s] of Object.entries(c.subs)) {
    for (const raw of s.kw) {
      const kw = foldText(raw).trim();
      if (!kw) continue;
      const words = kw.split(' ').length;
      const re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ -]?')}([^a-z0-9]|$)`);
      RULES.push({ cat, sub, re, weight: Math.pow(words, 1.6) });
    }
  }
}

/**
 * @param {string} text  titre (+ éventuellement description)
 * @param {object} hint  { category, subcategory, text } fournis par la source
 */
export function classify(text, hint = {}) {
  const t = ' ' + foldText(text) + ' ';
  const h = hint.text ? ' ' + foldText(hint.text) + ' ' : '';
  const scores = new Map();
  for (const r of RULES) {
    let s = 0;
    if (r.re.test(t)) s += r.weight;
    if (h && r.re.test(h)) s += r.weight * 0.6;
    if (s) {
      const k = `${r.cat}/${r.sub}`;
      scores.set(k, (scores.get(k) || 0) + s);
    }
  }
  if (hint.category) {
    // la source sait de quoi elle parle (ex. Steam = jeux PC) : bonus fort
    for (const [k, v] of scores) if (k.startsWith(hint.category + '/')) scores.set(k, v + 3);
    if (hint.subcategory) scores.set(`${hint.category}/${hint.subcategory}`, (scores.get(`${hint.category}/${hint.subcategory}`) || 0) + 4);
  }
  let best = null;
  for (const [k, v] of scores) if (!best || v > best[1]) best = [k, v];
  if (!best) return { category: hint.category || 'autres', subcategory: hint.subcategory || null };
  const [category, subcategory] = best[0].split('/');
  return { category, subcategory };
}
