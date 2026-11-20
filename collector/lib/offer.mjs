// Construction d'une offre normalisée, avec validation stricte.
// Toute offre sans titre, sans lien valide ou au prix illisible est rejetée :
// rien n'est jamais complété "au hasard".
import { canonicalUrl, cleanText, dedupeKey, domainOf, foldText, parsePrice, safeDate, round2 } from './normalize.mjs';
import { classify } from './classify.mjs';
import { detectBrand, detectCondition, detectDealTypes, detectFreeShipping, detectPromoCode } from './signals.mjs';

export const OFFER_COLUMNS = [
  'offer_key', 'source_id', 'native_id', 'title', 'brand', 'merchant', 'merchant_domain', 'url', 'image_url',
  'category', 'subcategory', 'country', 'currency', 'price', 'announced_ref_price', 'price_source',
  'deal_types', 'promo_code', 'condition', 'free_shipping', 'availability', 'popularity', 'starts_at',
  'expires_at', 'published_at', 'last_seen_at', 'is_active', 'dedupe_key', 'search_text', 'extra',
];

/**
 * @param {object} source  entrée de config/sources.json
 * @param {object} r       données brutes extraites par le connecteur
 * @returns {{offer?: object, reason?: string}}
 */
export function buildOffer(source, r) {
  const title = cleanText(r.title, 220);
  if (!title) return { reason: 'titre manquant' };
  const url = canonicalUrl(r.url);
  if (!url) return { reason: 'lien invalide' };
  if (r.nativeId === undefined || r.nativeId === null || r.nativeId === '') return { reason: 'identifiant manquant' };

  const price = r.price === undefined ? null : parsePrice(r.price);
  if (r.price !== undefined && r.price !== null && r.price !== '' && price === null) return { reason: 'prix illisible' };
  let ref = r.refPrice === undefined || r.refPrice === null ? null : parsePrice(r.refPrice);
  if (ref !== null && price !== null && ref <= price) ref = null;

  const text = [title, r.description || ''].join(' — ');
  const dealTypes = new Set([...(r.dealTypes || []), ...detectDealTypes(text)]);
  if (price === 0) dealTypes.add('gratuit');
  if (ref !== null) dealTypes.add('promo');
  const expires = safeDate(r.expiresAt);
  if (expires && new Date(expires) - Date.now() < 48 * 3600e3 && new Date(expires) > Date.now()) dealTypes.add('vente_flash');
  const promoCode = r.promoCode || detectPromoCode(text);
  if (promoCode) dealTypes.add('code_promo');
  if (price === null && !promoCode && !dealTypes.has('gratuit') && !r.allowNoPrice) return { reason: 'ni prix ni code' };

  const cls = classify(text, { category: r.categoryHint || source.categoryHint, subcategory: r.subcategoryHint, text: r.categoryText });
  const merchant = cleanText(r.merchant || source.merchant || '', 80) || null;
  const merchantDomain = r.merchantDomain || (r.merchantUrl ? domainOf(r.merchantUrl) : null) || source.merchantDomain || null;
  const brand = cleanText(r.brand || '', 60) || detectBrand(title);
  const image = r.image ? canonicalUrl(String(r.image).replace(/^\/\//, 'https://')) : null;

  const offer = {
    offer_key: `${source.id}:${r.nativeId}`,
    source_id: source.id,
    native_id: String(r.nativeId),
    title,
    brand: brand || null,
    merchant,
    merchant_domain: merchantDomain,
    url,
    image_url: image,
    category: cls.category,
    subcategory: cls.subcategory,
    country: r.country || source.country || null,
    currency: (r.currency || source.currency || 'EUR').toUpperCase(),
    price: price === null ? null : round2(price),
    announced_ref_price: ref === null ? null : round2(ref),
    price_source: r.priceSource || source.priceSource || 'communaute',
    deal_types: [...dealTypes].sort(),
    promo_code: promoCode || null,
    condition: r.condition || detectCondition(text) || 'inconnu',
    free_shipping: r.freeShipping ?? detectFreeShipping(text),
    availability: r.availability || 'inconnu',
    popularity: r.popularity === undefined || r.popularity === null ? null : Math.max(0, Math.min(100, round2(r.popularity))),
    starts_at: safeDate(r.startsAt),
    expires_at: expires,
    published_at: safeDate(r.publishedAt),
    last_seen_at: new Date().toISOString(),
    is_active: true,
    dedupe_key: dedupeKey(title, merchantDomain || merchant),
    search_text: foldText([title, brand, merchant, cls.category, cls.subcategory, r.description ? cleanText(r.description, 400) : ''].filter(Boolean).join(' ')),
    extra: r.extra || {},
  };
  return { offer };
}

/** Températures Pepper (−∞…+∞) → popularité 0–100 */
export const temperatureToPopularity = (t) => (t === null || t === undefined || !Number.isFinite(+t) ? null : 100 * (1 - Math.exp(-Math.max(+t, 0) / 300)));
