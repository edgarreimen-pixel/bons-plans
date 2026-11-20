import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, canonicalUrl, dedupeKey, foldText } from '../collector/lib/normalize.mjs';
import { pricesFromTitle } from '../collector/lib/priceText.mjs';
import { classify } from '../collector/lib/classify.mjs';
import { detectDealTypes, detectPromoCode, detectCondition, detectBrand } from '../collector/lib/signals.mjs';
import { isAllowedByRobots } from '../collector/lib/robots.mjs';
import { buildOffer } from '../collector/lib/offer.mjs';

test('parsePrice : formats français, anglais, cas limites', () => {
  assert.equal(parsePrice('1 299,99 €'), 1299.99);
  assert.equal(parsePrice('19.99'), 19.99);
  assert.equal(parsePrice('$1,299.99'), 1299.99);
  assert.equal(parsePrice('12€50'), 12.5);
  assert.equal(parsePrice('1.299,00€'), 1299);
  assert.equal(parsePrice('0,99€'), 0.99);
  assert.equal(parsePrice('Gratuit'), 0);
  assert.equal(parsePrice('1 049 €'), 1049);
  assert.equal(parsePrice('prix inconnu'), null);
  assert.equal(parsePrice(''), null);
});

test('prix dans un titre : seulement à côté d’une devise', () => {
  assert.deepEqual(pricesFromTitle('Casque Sony WH-1000XM5 à 249,99€ (au lieu de 379€)'), { price: 249.99, ref: 379 });
  assert.deepEqual(pricesFromTitle('Paris to Tokyo for €450 roundtrip'), { price: 450, ref: null });
  assert.deepEqual(pricesFromTitle('Samsung 990 Pro 2 To'), { price: null, ref: null });
  assert.deepEqual(pricesFromTitle('Echo Dot 5 - 24,99€ via code'), { price: 24.99, ref: null });
});

test('URL canonique : retire le pistage, garde le reste', () => {
  assert.equal(canonicalUrl('https://Shop.fr/p/1?utm_source=x&color=red&gclid=1#top'), 'https://shop.fr/p/1?color=red');
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
});

test('clé de dédoublonnage insensible à l’ordre, aux accents et au prix', () => {
  assert.equal(dedupeKey('Écouteurs Sony WF-1000XM5 à 199€', 'amazon.fr'), dedupeKey('Sony WF-1000XM5 écouteurs', 'amazon.fr'));
  assert.notEqual(dedupeKey('Sony WF-1000XM5', 'amazon.fr'), dedupeKey('Sony WF-1000XM5', 'fnac.com'));
});

test('classement automatique', () => {
  assert.deepEqual(classify('Robot aspirateur Roborock S8'), { category: 'maison', subcategory: 'robots-aspirateurs' });
  assert.equal(classify('Apple MacBook Air M4 13"').subcategory, 'mac');
  assert.equal(classify('Manette DualSense PS5').subcategory, 'manettes');
  assert.equal(classify('Vol Paris - New York aller retour').category, 'voyages');
  assert.equal(classify('Montre connectée Garmin Venu').subcategory, 'connectes');
  assert.equal(classify('The Witcher 3', { category: 'gaming', subcategory: 'jeux-pc' }).subcategory, 'jeux-pc');
  assert.equal(classify('Truc introuvable xyz').category, 'autres');
});

test('signaux : types d’offres, codes, état, marque', () => {
  assert.deepEqual(detectDealTypes('Déstockage : fin de série chez Darty').sort(), ['destockage']);
  assert.ok(detectDealTypes('Vente flash Black Friday').includes('vente_flash'));
  assert.ok(detectDealTypes('Vente flash Black Friday').includes('saisonnier'));
  assert.equal(detectPromoCode('-20% avec le code BLACK20 sur le site'), 'BLACK20');
  assert.equal(detectPromoCode('Code promo valable sur tout'), null);
  assert.equal(detectCondition('iPhone 15 reconditionné grade A'), 'reconditionne');
  assert.equal(detectBrand('Casque Bose QuietComfort Ultra'), 'Bose');
  assert.equal(foldText('  Été  À ÇA '), 'ete a ca');
});

test('robots.txt', () => {
  const r = 'User-agent: *\nDisallow: /checkout\nDisallow: /*.json$\nAllow: /products.json$\n\nUser-agent: BadBot\nDisallow: /';
  assert.equal(isAllowedByRobots(r, '/products.json'), true);
  assert.equal(isAllowedByRobots(r, '/collections.json'), false);
  assert.equal(isAllowedByRobots(r, '/checkout/1'), false);
  assert.equal(isAllowedByRobots('User-agent: *\nDisallow: /', '/rss/hot'), false);
  assert.equal(isAllowedByRobots('User-agent: BonsPlansBot\nDisallow: /\nUser-agent: *\nAllow: /', '/x'), false);
  assert.equal(isAllowedByRobots('', '/x'), true);
});

test('buildOffer rejette ce qui est invalide et ne complète rien', () => {
  const src = { id: 's', name: 'S', country: 'FR', currency: 'EUR' };
  assert.equal(buildOffer(src, { nativeId: 1, title: '', url: 'https://a.fr' }).reason, 'titre manquant');
  assert.equal(buildOffer(src, { nativeId: 1, title: 'X', url: 'pas une url' }).reason, 'lien invalide');
  assert.equal(buildOffer(src, { nativeId: 1, title: 'X', url: 'https://a.fr', price: 'n/a' }).reason, 'prix illisible');
  assert.equal(buildOffer(src, { nativeId: 1, title: 'X', url: 'https://a.fr' }).reason, 'ni prix ni code');
  const { offer } = buildOffer(src, { nativeId: 7, title: 'Casque JBL Tune 520', url: 'https://a.fr/p?utm_source=z', price: '29,99 €', refPrice: 59.99 });
  assert.equal(offer.offer_key, 's:7');
  assert.equal(offer.url, 'https://a.fr/p');
  assert.equal(offer.price, 29.99);
  assert.equal(offer.announced_ref_price, 59.99);
  assert.equal(offer.brand, 'JBL');
  assert.equal(offer.category, 'audio-culture');
  assert.ok(offer.deal_types.includes('promo'));
  // un "ancien prix" inférieur au prix actuel est ignoré
  assert.equal(buildOffer(src, { nativeId: 8, title: 'Y', url: 'https://a.fr', price: 50, refPrice: 40 }).offer.announced_ref_price, null);
});
