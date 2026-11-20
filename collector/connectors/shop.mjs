// Boutiques indépendantes et marques émergentes : connecteur générique
// pour les boutiques Shopify (/products.json) et WooCommerce (Store API),
// deux catalogues publics servis à tous les visiteurs.
// - respect strict de robots.txt (refus = source marquée "bloquée")
// - TOUS les produits sont observés : un prix barré annoncé ne devient
//   "vérifié" que si notre propre historique le confirme.
import { HttpError } from '../lib/http.mjs';

const MAX_VARIANTS_OBSERVED = 8;

export function parseShopifyProducts(products, source) {
  const offers = [];
  const observations = [];
  const notOnSale = [];
  for (const p of products || []) {
    const variants = (p.variants || []).slice(0, 50);
    let best = null;
    for (const v of variants) {
      const price = Number(v.price);
      const cmp = v.compare_at_price === null || v.compare_at_price === undefined ? null : Number(v.compare_at_price);
      if (!Number.isFinite(price)) continue;
      const key = `${source.id}:p${p.id}-v${v.id}`;
      if (variants.indexOf(v) < MAX_VARIANTS_OBSERVED) observations.push({ k: key, p: price });
      const onSale = cmp !== null && Number.isFinite(cmp) && cmp > price;
      if (!onSale) notOnSale.push(key);
      if (onSale && v.available !== false) {
        const pct = 1 - price / cmp;
        if (!best || pct > best.pct) best = { v, price, cmp, pct };
      }
    }
    if (!best) continue;
    const vt = best.v.title && !/^default title$/i.test(best.v.title) ? ` — ${best.v.title}` : '';
    const img = best.v.featured_image?.src || p.images?.[0]?.src || null;
    offers.push({
      nativeId: `p${p.id}-v${best.v.id}`,
      title: `${p.title}${vt}`,
      description: [p.product_type, ...(Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(','))].filter(Boolean).join(' '),
      url: `https://${source.domain}/products/${p.handle}?variant=${best.v.id}`,
      image: img,
      price: best.price,
      refPrice: best.cmp,
      currency: source.currency,
      merchant: source.name,
      merchantDomain: source.domain,
      brand: p.vendor && p.vendor.toLowerCase() !== source.name.toLowerCase() ? p.vendor : source.brand || p.vendor,
      priceSource: 'marchand',
      availability: best.v.available === false ? 'rupture' : 'en_stock',
      condition: 'neuf',
      categoryHint: source.categoryHint,
      categoryText: p.product_type,
      publishedAt: p.published_at,
    });
  }
  return { offers, observations, notOnSale };
}

export function parseWooProducts(products, source) {
  const offers = [];
  const observations = [];
  const notOnSale = [];
  for (const p of products || []) {
    const pr = p.prices;
    if (!pr) continue;
    const unit = 10 ** (pr.currency_minor_unit ?? 2);
    const price = Number(pr.price) / unit;
    const regular = Number(pr.regular_price) / unit;
    if (!Number.isFinite(price)) continue;
    const key = `${source.id}:${p.id}`;
    observations.push({ k: key, p: price });
    const onSale = p.on_sale && Number.isFinite(regular) && regular > price;
    if (!onSale) { notOnSale.push(key); continue; }
    if (p.is_in_stock === false || p.is_purchasable === false) continue;
    offers.push({
      nativeId: String(p.id),
      title: p.name,
      description: [p.short_description, ...(p.categories || []).map((c) => c.name)].filter(Boolean).join(' '),
      url: p.permalink,
      image: p.images?.[0]?.src || null,
      price,
      refPrice: regular,
      currency: pr.currency_code || source.currency,
      merchant: source.name,
      merchantDomain: source.domain,
      brand: p.brands?.[0]?.name || source.brand || null,
      priceSource: 'marchand',
      availability: p.is_in_stock === false ? 'rupture' : 'en_stock',
      condition: 'neuf',
      categoryHint: source.categoryHint,
      categoryText: (p.categories || []).map((c) => c.name).join(' '),
    });
  }
  return { offers, observations, notOnSale };
}

async function detectPlatform(source, http) {
  try {
    const j = await http.get(`https://${source.domain}/products.json?limit=1`, { as: 'json', checkRobots: true, retries: 0 });
    if (Array.isArray(j?.products)) return 'shopify';
  } catch (e) { if (e.robots) throw e; }
  try {
    const j = await http.get(`https://${source.domain}/wp-json/wc/store/v1/products?per_page=1`, { as: 'json', checkRobots: true, retries: 0 });
    if (Array.isArray(j)) return 'woocommerce';
  } catch (e) { if (e.robots) throw e; }
  throw new Error(`Plateforme non reconnue pour ${source.domain} (ni Shopify ni WooCommerce public)`);
}

export default {
  kind: 'shop',
  async collect(source, { http }) {
    const platform = source.platform && source.platform !== 'auto' ? source.platform : await detectPlatform(source, http);
    const maxPages = source.maxPages || 4;
    const all = { offers: [], observations: [], notOnSale: [] };
    let complete = false;
    for (let page = 1; page <= maxPages; page++) {
      let batch;
      if (platform === 'shopify') {
        const j = await http.get(`https://${source.domain}/products.json?limit=250&page=${page}`, { as: 'json', checkRobots: true });
        batch = j?.products || [];
        const r = parseShopifyProducts(batch, source);
        all.offers.push(...r.offers); all.observations.push(...r.observations); all.notOnSale.push(...r.notOnSale);
        if (batch.length < 250) { complete = true; break; }
      } else {
        try {
          batch = await http.get(`https://${source.domain}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { as: 'json', checkRobots: true });
        } catch (e) {
          if (e instanceof HttpError && e.status === 400) { complete = true; break; } // page au-delà de la dernière
          throw e;
        }
        const r = parseWooProducts(batch, source);
        all.offers.push(...r.offers); all.observations.push(...r.observations); all.notOnSale.push(...r.notOnSale);
        if (!Array.isArray(batch) || batch.length < 100) { complete = true; break; }
      }
    }
    const offerKeys = new Set(all.offers.map((o) => `${source.id}:${o.nativeId}`));
    return {
      offers: all.offers,
      observations: all.observations,
      notOnSaleKeys: all.notOnSale.filter((k) => !offerKeys.has(k)),
      fullCatalog: complete,
      meta: { platform },
    };
  },
};
