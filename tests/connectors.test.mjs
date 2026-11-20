// Échantillons construits d'après les formats documentés de chaque source.
// Ce sont des données de TEST : elles ne sont jamais envoyées en base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePepperItems } from '../collector/connectors/pepper.mjs';
import { parseRssItems } from '../collector/connectors/rss.mjs';
import { parseSteam } from '../collector/connectors/steam.mjs';
import { parseEpic } from '../collector/connectors/epic.mjs';
import { parseCheapShark } from '../collector/connectors/cheapshark.mjs';
import { parseShopifyProducts, parseWooProducts } from '../collector/connectors/shop.mjs';
import { buildOffer } from '../collector/lib/offer.mjs';

const PEPPER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:pepper="http://www.pepper.com/rss">
<channel><title>Dealabs</title>
<item>
  <title><![CDATA[Aspirateur balai Dyson V15 Detect]]></title>
  <link>https://www.dealabs.com/bons-plans/aspirateur-dyson-v15-detect-3123456</link>
  <pepper:merchant name="Boulanger" price="449,99€"/>
  <description><![CDATA[<img src="https://static-pepper.dealabs.com/x.jpg"/> Livraison gratuite]]></description>
  <category>Électroménager</category>
  <pubDate>Wed, 18 Nov 2026 08:00:00 +0100</pubDate>
  <guid>https://www.dealabs.com/bons-plans/aspirateur-dyson-v15-detect-3123456</guid>
</item>
<item>
  <title>[Expiré] Vieux bon plan</title>
  <link>https://www.dealabs.com/bons-plans/vieux-3000001</link>
  <guid>3000001</guid>
</item>
<item>
  <title>-20% sur tout le site avec le code HIVER20</title>
  <link>https://www.dealabs.com/codes-promo/hiver-3123999</link>
  <pepper:merchant name="Asphalte"/>
  <guid>3123999</guid>
</item>
</channel></rss>`;

test('Pepper (Dealabs) : marchand, prix, image, expirés écartés, code promo', () => {
  const src = { id: 'dealabs', name: 'Dealabs', currency: 'EUR', country: 'FR' };
  const items = parsePepperItems(PEPPER_XML, src);
  assert.equal(items.length, 3);
  assert.equal(items[1].expired, true);
  const a = buildOffer(src, items[0]).offer;
  assert.equal(a.offer_key, 'dealabs:3123456');
  assert.equal(a.merchant, 'Boulanger');
  assert.equal(a.price, 449.99);
  assert.equal(a.image_url, 'https://static-pepper.dealabs.com/x.jpg');
  assert.equal(a.free_shipping, true);
  assert.equal(a.subcategory, 'electromenager');
  assert.equal(a.price_source, 'communaute');
  const c = buildOffer(src, items[2]).offer;
  assert.equal(c.promo_code, 'HIVER20');
  assert.equal(c.price, null);
  assert.ok(c.deal_types.includes('code_promo'));
});

test('RSS générique (Atom) + Secret Flying', () => {
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Paris to Tokyo for €450 roundtrip</title><link rel="alternate" href="https://www.secretflying.com/posts/paris-tokyo-450/"/><id>tag:sf,1</id><updated>2026-11-18T10:00:00Z</updated></entry></feed>`;
  const src = { id: 'secretflying', name: 'Secret Flying', currency: 'EUR', categoryHint: 'voyages' };
  const [it] = parseRssItems(atom, src);
  const o = buildOffer(src, it).offer;
  assert.equal(o.price, 450);
  assert.equal(o.category, 'voyages');
  assert.equal(o.subcategory, 'avion');
});

test('Steam : promos → offres ; non remisés → observations', () => {
  const json = {
    specials: { id: 'cat_specials', name: 'Promotions', items: [
      { id: 292030, type: 0, name: 'The Witcher 3: Wild Hunt', discounted: true, discount_percent: 80, original_price: 2999, final_price: 599, currency: 'EUR', large_capsule_image: 'https://cdn.steam/292030.jpg', windows_available: true, discount_expiration: 1795000000 },
    ] },
    top_sellers: { items: [
      { id: 730, name: 'Counter-Strike 2', discounted: false, discount_percent: 0, original_price: null, final_price: 0, currency: 'EUR' },
      { id: 292030, name: 'doublon', discounted: true, original_price: 2999, final_price: 599 },
    ] },
    status: 1,
  };
  const r = parseSteam(json, { id: 'steam-fr', currency: 'EUR' });
  assert.equal(r.offers.length, 1);
  assert.equal(r.observations.length, 1);
  const o = buildOffer({ id: 'steam-fr', country: 'FR' }, r.offers[0]).offer;
  assert.equal(o.price, 5.99);
  assert.equal(o.announced_ref_price, 29.99);
  assert.equal(o.url, 'https://store.steampowered.com/app/292030/');
  assert.equal(o.subcategory, 'jeux-pc');
  assert.equal(o.price_source, 'marchand');
  assert.ok(o.expires_at);
});

test('Epic : seules les promos en cours, jeux offerts marqués gratuits', () => {
  const now = Date.parse('2026-11-18T12:00:00Z');
  const el = (title, start, end, dp, op) => ({
    title, id: title, description: 'desc', productSlug: title.toLowerCase(),
    keyImages: [{ type: 'Thumbnail', url: 'https://img/t.jpg' }, { type: 'OfferImageWide', url: 'https://img/w.jpg' }],
    catalogNs: { mappings: [{ pageSlug: title.toLowerCase() + '-a1b2', pageType: 'productHome' }] },
    price: { totalPrice: { discountPrice: dp, originalPrice: op, currencyCode: 'EUR', currencyInfo: { decimals: 2 } } },
    promotions: { promotionalOffers: [{ promotionalOffers: [{ startDate: start, endDate: end, discountSetting: { discountType: 'PERCENTAGE', discountPercentage: 0 } }] }], upcomingPromotionalOffers: [] },
  });
  const json = { data: { Catalog: { searchStore: { elements: [
    el('Gratuit', '2026-11-13T16:00:00.000Z', '2026-11-20T16:00:00.000Z', 0, 1999),
    el('Futur', '2026-11-20T16:00:00.000Z', '2026-11-27T16:00:00.000Z', 0, 2499),
    { title: 'Sans promo', id: 'x', price: { totalPrice: { discountPrice: 999, originalPrice: 999 } }, promotions: null },
  ] } } } };
  const offers = parseEpic(json, { locale: 'fr' }, now);
  assert.equal(offers.length, 1);
  const o = buildOffer({ id: 'epic-fr', country: 'FR' }, offers[0]).offer;
  assert.equal(o.price, 0);
  assert.equal(o.announced_ref_price, 19.99);
  assert.ok(o.deal_types.includes('gratuit'));
  assert.equal(o.url, 'https://store.epicgames.com/fr/p/gratuit-a1b2');
  assert.equal(o.image_url, 'https://img/w.jpg');
});

test('CheapShark : nom de boutique, lien de redirection, USD', () => {
  const deals = [
    { internalName: 'X', title: 'Hades', dealID: 'abc%3D', storeID: '1', gameID: '42', salePrice: '6.24', normalPrice: '24.99', isOnSale: '1', savings: '75.03', dealRating: '9.4', thumb: 'https://t.jpg', steamRatingPercent: '98', metacriticScore: '93', lastChange: 1795000000 },
    { title: 'Pas en promo', dealID: 'z', storeID: '1', gameID: '1', salePrice: '9.99', normalPrice: '9.99', isOnSale: '0' },
  ];
  const offers = parseCheapShark(deals, [{ storeID: '1', storeName: 'Steam' }], {});
  assert.equal(offers.length, 1);
  const o = buildOffer({ id: 'cheapshark' }, offers[0]).offer;
  assert.equal(o.merchant, 'Steam');
  assert.equal(o.currency, 'USD');
  assert.equal(o.popularity, 94);
  assert.equal(o.price_source, 'agregateur');
  assert.match(o.url, /^https:\/\/www\.cheapshark\.com\/redirect\?dealID=/);
});

test('Shopify : meilleure variante en promo, observations de toutes les variantes', () => {
  const products = [
    { id: 1, title: 'Pull mérinos', handle: 'pull-merinos', vendor: 'Maison X', product_type: 'Pull', tags: ['hiver'], images: [{ src: 'https://cdn.shopify.com/p.jpg' }],
      variants: [
        { id: 11, title: 'S', price: '89.00', compare_at_price: '129.00', available: true },
        { id: 12, title: 'M', price: '79.00', compare_at_price: '129.00', available: false },
        { id: 13, title: 'L', price: '99.00', compare_at_price: null, available: true },
      ] },
    { id: 2, title: 'Bonnet', handle: 'bonnet', vendor: 'Maison X', variants: [{ id: 21, title: 'Default Title', price: '25.00', compare_at_price: '25.00', available: true }] },
  ];
  const src = { id: 'shop-x', name: 'Maison X', domain: 'maison-x.fr', currency: 'EUR' };
  const r = parseShopifyProducts(products, src);
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].nativeId, 'p1-v11');  // M est en rupture : ignorée
  assert.equal(r.observations.length, 4);
  assert.deepEqual(r.notOnSale.sort(), ['shop-x:p1-v13', 'shop-x:p2-v21']);
  const o = buildOffer(src, r.offers[0]).offer;
  assert.equal(o.title, 'Pull mérinos — S');
  assert.equal(o.url, 'https://maison-x.fr/products/pull-merinos?variant=11');
  assert.equal(o.category, 'mode');
});

test('WooCommerce : prix en unités mineures', () => {
  const products = [
    { id: 5, name: 'Lampe de bureau LED', permalink: 'https://boutique.fr/produit/lampe/', on_sale: true, is_in_stock: true, is_purchasable: true,
      prices: { price: '3490', regular_price: '4990', sale_price: '3490', currency_code: 'EUR', currency_minor_unit: 2 },
      images: [{ src: 'https://boutique.fr/l.jpg' }], categories: [{ name: 'Luminaires' }] },
    { id: 6, name: 'Bougie', permalink: 'https://boutique.fr/produit/bougie/', on_sale: false, prices: { price: '1200', regular_price: '1200', currency_minor_unit: 2 } },
  ];
  const r = parseWooProducts(products, { id: 'shop-b', name: 'B', domain: 'boutique.fr' });
  assert.equal(r.offers.length, 1);
  assert.equal(r.offers[0].price, 34.9);
  assert.equal(r.offers[0].refPrice, 49.9);
  assert.equal(r.observations.length, 2);
});
