// Test de bout en bout du collecteur avec un réseau simulé :
// vérifie la tolérance aux pannes (un flux cassé, un robots.txt
// restrictif) sans jamais désactiver d'offres sur erreur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('collecte complète en mode essai avec réseau simulé', async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    url = String(url);
    calls.push(url);
    const res = (status, body, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });
    if (url.endsWith('/robots.txt')) {
      if (url.includes('kith.com')) return res(200, 'User-agent: *\nDisallow: /products', 'text/plain');
      return res(404, '');
    }
    if (url.includes('dealabs.com/rss/hot')) return res(200, `<rss xmlns:pepper="x"><channel><item><title>Lego Technic 42143</title><link>https://www.dealabs.com/bons-plans/lego-3200001</link><pepper:merchant name="Fnac" price="299€"/><guid>3200001</guid></item></channel></rss>`, 'text/xml');
    if (url.includes('dealabs.com/rss/new')) return res(503, 'down');
    if (url.includes('steampowered')) return res(200, { specials: { items: [{ id: 1, name: 'Jeu', discounted: true, original_price: 2000, final_price: 1000, currency: 'EUR' }] } });
    if (url.includes('asphalte.com/products.json')) return res(200, { products: [] });
    return res(404, 'not found');
  };
  process.env.PER_HOST_DELAY_MS = '0';
  process.argv = ['node', 'collector/index.mjs', '--dry-run', '--only=dealabs,steam-fr,shop-asphalte-com,shop-kith-com'];
  const { main } = await import('../collector/index.mjs?t=' + Date.now());
  await main();
  const fs = await import('node:fs/promises');
  const out = JSON.parse(await fs.readFile('out/dry-run.json', 'utf8'));
  assert.equal(out.status, 'partial');
  assert.equal(out.offers.length, 2);
  assert.ok(out.offers.find((o) => o.offer_key === 'dealabs:3200001' && o.price === 299 && o.merchant === 'Fnac'));
  assert.match(out.sources.dealabs.last_error, /^Partiel/);
  assert.equal(out.sources['shop-asphalte-com'].last_item_count, 0);
  assert.match(out.sources['shop-kith-com'].last_error, /robots\.txt/);
  assert.ok(!calls.some((u) => u.includes('kith.com/products.json')), 'robots.txt doit empêcher la requête');
});
