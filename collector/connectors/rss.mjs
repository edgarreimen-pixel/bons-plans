// Connecteur générique pour tout flux RSS/Atom de bons plans
// (blogs de bons plans, alertes voyages, communautés étrangères…).
// Ajouter une source = ajouter une entrée "rss" dans config/sources.json.
import { parseFeed } from '../lib/xml.mjs';
import { pricesFromTitle, currencyFromText } from '../lib/priceText.mjs';

export function parseRssItems(xml, source) {
  return parseFeed(xml).map((it) => {
    const p = pricesFromTitle(it.title);
    const id = it.guid || it.link;
    return {
      nativeId: id ? id.replace(/^https?:\/\//, '').slice(0, 180) : null,
      title: it.title,
      url: it.link,
      description: it.description,
      image: it.image,
      price: p.price,
      refPrice: p.ref,
      currency: currencyFromText(it.title, source.currency),
      merchant: source.merchant || null,
      categoryText: it.categories.join(' '),
      publishedAt: it.pubDate,
      priceSource: 'communaute',
      allowNoPrice: source.allowNoPrice !== false,
    };
  });
}

export default {
  kind: 'rss',
  async collect(source, { http }) {
    const out = [];
    const errors = [];
    for (const feed of source.feeds) {
      try { out.push(...parseRssItems(await http.get(feed, { as: 'text', checkRobots: true }), source)); }
      catch (e) { errors.push(`${feed}: ${e.message}`); }
    }
    if (errors.length === source.feeds.length) throw new Error(errors.join(' | '));
    const maxAgeDays = source.maxAgeDays ?? 10;
    const fresh = out.filter((r) => !r.publishedAt || Date.now() - new Date(r.publishedAt) < maxAgeDays * 864e5);
    return { offers: fresh, fullCatalog: false, warnings: errors };
  },
};
