// Epic Games Store — jeux offerts / remisés de la semaine (flux public).
// Seules les promotions EN COURS (date de début passée, fin future) sont gardées.

const pickImage = (imgs = []) =>
  (imgs.find((i) => i.type === 'OfferImageWide') || imgs.find((i) => i.type === 'DieselStoreFrontWide') || imgs.find((i) => i.type === 'Thumbnail') || imgs[0] || {}).url;

export function parseEpic(json, source, now = Date.now()) {
  const elements = json?.data?.Catalog?.searchStore?.elements || [];
  const offers = [];
  for (const el of elements) {
    const promos = (el.promotions?.promotionalOffers || []).flatMap((p) => p.promotionalOffers || []);
    const live = promos.find((p) => new Date(p.startDate).getTime() <= now && new Date(p.endDate).getTime() > now);
    if (!live) continue;
    const tp = el.price?.totalPrice;
    if (!tp || typeof tp.discountPrice !== 'number') continue;
    const dec = tp.currencyInfo?.decimals ?? 2;
    const price = tp.discountPrice / 10 ** dec;
    const ref = tp.originalPrice / 10 ** dec;
    const slug = el.catalogNs?.mappings?.find((m) => m.pageType === 'productHome')?.pageSlug
      || el.offerMappings?.find((m) => m.pageType === 'productHome')?.pageSlug
      || el.catalogNs?.mappings?.[0]?.pageSlug || el.offerMappings?.[0]?.pageSlug
      || (el.productSlug || el.urlSlug || '').replace(/\/home$/, '');
    if (!slug) continue;
    if (!(price < ref)) continue;
    offers.push({
      nativeId: el.id,
      title: el.title,
      description: el.description,
      url: `https://store.epicgames.com/${source.locale || 'fr'}/p/${slug}`,
      image: pickImage(el.keyImages),
      price,
      refPrice: ref,
      currency: tp.currencyCode || source.currency,
      merchant: 'Epic Games Store',
      merchantDomain: 'store.epicgames.com',
      startsAt: live.startDate,
      expiresAt: live.endDate,
      priceSource: 'marchand',
      condition: 'numerique',
      availability: 'en_stock',
      categoryHint: 'gaming',
      subcategoryHint: 'jeux-pc',
      dealTypes: price === 0 ? ['gratuit'] : [],
      brand: el.seller?.name || null,
    });
  }
  return offers;
}

export default {
  kind: 'epic',
  async collect(source, { http }) {
    const c = source.country || 'FR';
    const json = await http.get(`https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=${source.locale || 'fr'}&country=${c}&allowCountries=${c}`, { as: 'json' });
    return { offers: parseEpic(json, source), fullCatalog: false };
  },
};
