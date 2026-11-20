// Réseau communautaire Pepper (Dealabs FR, hotukdeals UK, mydealz DE,
// Chollometro ES, Pepper IT…) via leurs flux RSS publics.
// Les prix sont ceux indiqués par les membres : price_source = 'communaute'.
// Le lien pointe vers la fiche du bon plan sur le site communautaire
// (on ne reconstruit pas le lien marchand).
import { parseFeed, findDeep, textOf } from '../lib/xml.mjs';
import { pricesFromTitle, currencyFromText } from '../lib/priceText.mjs';
import { parsePrice } from '../lib/normalize.mjs';
import { temperatureToPopularity } from '../lib/offer.mjs';

export function parsePepperItems(xml, source) {
  const items = parseFeed(xml);
  return items.map((it) => {
    const merchantNode = it.raw['pepper:merchant'] || findDeep(it.raw, 'merchant');
    const merchantName = merchantNode && typeof merchantNode === 'object' ? merchantNode['@_name'] : textOf(merchantNode);
    const attrPrice = merchantNode && typeof merchantNode === 'object' ? merchantNode['@_price'] : undefined;
    const fromTitle = pricesFromTitle(it.title);
    const temperature = findDeep(it.raw, 'temperature');
    const idMatch = (it.link || '').match(/-(\d{4,})(?:[/?#]|$)/) || (it.guid || '').match(/(\d{4,})/);
    const expiredFlag = /\b(expir|abgelaufen|caducad|scadut)/i.test(it.title) || /\bexpired\b/i.test(String(findDeep(it.raw, 'status') ?? ''));
    const price = attrPrice !== undefined && parsePrice(attrPrice) !== null ? parsePrice(attrPrice) : fromTitle.price;
    return {
      expired: expiredFlag,
      nativeId: idMatch ? idMatch[1] : it.guid || it.link,
      title: it.title.replace(/\s*\[(expir[ée]+|expired)\]\s*/i, ' ').trim(),
      url: it.link,
      description: it.description,
      image: it.image,
      price,
      refPrice: fromTitle.ref,
      currency: currencyFromText(attrPrice || it.title, source.currency),
      merchant: merchantName || null,
      categoryText: it.categories.join(' '),
      publishedAt: it.pubDate,
      popularity: temperature !== undefined ? temperatureToPopularity(parseFloat(temperature)) : null,
      extra: temperature !== undefined ? { temperature: parseFloat(temperature), community: source.name } : { community: source.name },
      priceSource: 'communaute',
      allowNoPrice: true,
    };
  });
}

export default {
  kind: 'pepper',
  async collect(source, { http }) {
    const out = [];
    const seen = new Set();
    const errors = [];
    let okFeeds = 0;
    for (const feed of source.feeds) {
      let xml;
      try { xml = await http.get(feed, { as: 'text', checkRobots: true }); okFeeds++; }
      catch (e) { errors.push(`${feed}: ${e.message}`); continue; }
      for (const r of parsePepperItems(xml, source)) {
        if (r.expired || seen.has(r.nativeId)) continue;
        seen.add(r.nativeId);
        out.push(r);
      }
    }
    if (!okFeeds) throw new Error(errors.join(' | '));
    return { offers: out, fullCatalog: false, warnings: errors };
  },
};
