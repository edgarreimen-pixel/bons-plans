// CheapShark — API publique et gratuite qui suit les prix de ~30 boutiques
// de jeux PC (Steam, GOG, Humble, Fanatical, GamesPlanet…). Prix en USD.
// Lien obligatoire via leur redirection (conditions d'utilisation de l'API).

export function parseCheapShark(deals, stores, source) {
  const storeName = new Map((stores || []).map((s) => [String(s.storeID), s.storeName]));
  const out = [];
  for (const d of deals || []) {
    if (String(d.isOnSale) !== '1') continue;
    const sale = Number(d.salePrice);
    const normal = Number(d.normalPrice);
    if (!Number.isFinite(sale) || !Number.isFinite(normal) || !(sale < normal)) continue;
    const store = storeName.get(String(d.storeID)) || `Boutique #${d.storeID}`;
    out.push({
      nativeId: `${d.gameID}-${d.storeID}`,
      title: d.title,
      url: `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(d.dealID)}`,
      image: d.thumb,
      price: sale,
      refPrice: normal,
      currency: 'USD',
      merchant: store,
      priceSource: 'agregateur',
      condition: 'numerique',
      availability: 'en_stock',
      categoryHint: 'gaming',
      subcategoryHint: 'jeux-pc',
      popularity: Number(d.dealRating) * 10,
      publishedAt: d.lastChange ? Number(d.lastChange) : null,
      extra: {
        metacritic: Number(d.metacriticScore) || null,
        steamRating: Number(d.steamRatingPercent) || null,
        steamRatingCount: Number(d.steamRatingCount) || null,
        steamAppID: d.steamAppID || null,
      },
    });
  }
  return out;
}

export default {
  kind: 'cheapshark',
  async collect(source, { http }) {
    const stores = await http.get('https://www.cheapshark.com/api/1.0/stores', { as: 'json' });
    const all = [];
    for (const sortBy of source.sorts || ['Deal Rating', 'Recent']) {
      const url = `https://www.cheapshark.com/api/1.0/deals?onSale=1&pageSize=60&sortBy=${encodeURIComponent(sortBy)}&upperPrice=${source.upperPrice || 60}`;
      all.push(...(await http.get(url, { as: 'json' })));
    }
    const seen = new Set();
    const unique = all.filter((d) => (seen.has(d.dealID) ? false : seen.add(d.dealID)));
    return { offers: parseCheapShark(unique, stores, source), fullCatalog: false };
  },
};
