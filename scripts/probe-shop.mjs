#!/usr/bin/env node
// Teste une boutique et l'ajoute à config/shops.json si elle expose un
// catalogue public autorisé par son robots.txt.
//   npm run probe -- www.exemple.fr "Nom de la boutique" [categorie]
import { readFile, writeFile } from 'node:fs/promises';
import shop from '../collector/connectors/shop.mjs';
import * as http from '../collector/lib/http.mjs';
import { buildOffer } from '../collector/lib/offer.mjs';

const [domainArg, nameArg, cat] = process.argv.slice(2);
if (!domainArg) {
  console.log('Usage : npm run probe -- www.exemple.fr "Nom" [categorie]');
  process.exit(1);
}
const domain = domainArg.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const source = { id: 'probe', name: nameArg || domain, domain, platform: 'auto', currency: 'EUR', country: 'FR', categoryHint: cat, maxPages: 2 };

try {
  const r = await shop.collect(source, { http });
  const valid = r.offers.map((o) => buildOffer(source, o).offer).filter(Boolean);
  console.log(`✓ ${domain} : plateforme ${r.meta.platform}, ${r.observations.length} prix observés, ${valid.length} produits avec prix barré.`);
  for (const o of valid.slice(0, 5)) console.log(`   · ${o.title} — ${o.price} ${o.currency} (barré ${o.announced_ref_price})`);
  const path = new URL('../config/shops.json', import.meta.url);
  const cfg = JSON.parse(await readFile(path, 'utf8'));
  if (cfg.shops.some((s) => s.domain === domain)) console.log('Déjà présente dans shops.json.');
  else {
    cfg.shops.push({ domain, name: source.name, country: 'FR', currency: 'EUR', platform: r.meta.platform, ...(cat ? { categoryHint: cat } : {}) });
    await writeFile(path, JSON.stringify(cfg, null, 2) + '\n');
    console.log('Ajoutée à config/shops.json — elle sera collectée au prochain passage.');
  }
} catch (e) {
  console.log(`✗ ${domain} : ${e.message}`);
  process.exit(2);
}
