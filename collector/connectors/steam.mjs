// Steam (Valve) — vitrine publique "featuredcategories".
// Prix fournis par le marchand lui-même, en centimes, dans la devise du pays.
// Les jeux NON remisés sont aussi enregistrés comme observations de prix,
// ce qui permet de vérifier une future baisse.

export function parseSteam(json, source) {
  const items = new Map();
  for (const val of Object.values(json || {})) {
    if (!val || typeof val !== 'object' || !Array.isArray(val.items)) continue;
    for (const it of val.items) if (it && it.id && !items.has(it.id)) items.set(it.id, it);
  }
  const offers = [];
  const observations = [];
  const notOnSale = [];
  for (const it of items.values()) {
    if (typeof it.final_price !== 'number') continue;
    const key = String(it.id);
    const final = it.final_price / 100;
    if (it.discounted && it.original_price > it.final_price) {
      offers.push({
        nativeId: key,
        title: it.name,
        url: `https://store.steampowered.com/app/${it.id}/`,
        image: it.large_capsule_image || it.header_image || it.small_capsule_image,
        price: final,
        refPrice: it.original_price / 100,
        currency: it.currency || source.currency,
        merchant: 'Steam',
        merchantDomain: 'store.steampowered.com',
        expiresAt: it.discount_expiration || null,
        priceSource: 'marchand',
        condition: 'numerique',
        availability: 'en_stock',
        categoryHint: 'gaming',
        subcategoryHint: 'jeux-pc',
        extra: { platform: [it.windows_available && 'Windows', it.mac_available && 'Mac', it.linux_available && 'Linux'].filter(Boolean) },
      });
    } else {
      observations.push({ k: `${source.id}:${key}`, p: final });
      notOnSale.push(`${source.id}:${key}`);
    }
  }
  return { offers, observations, notOnSale };
}

export default {
  kind: 'steam',
  async collect(source, { http }) {
    const json = await http.get(`https://store.steampowered.com/api/featuredcategories?cc=${source.cc || 'fr'}&l=${source.lang || 'french'}`, { as: 'json', checkRobots: true });
    const r = parseSteam(json, source);
    return { offers: r.offers, observations: r.observations, notOnSaleKeys: r.notOnSale, fullCatalog: false };
  },
};
