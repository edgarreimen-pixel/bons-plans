import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: false,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  htmlEntities: true,
});

export const asArray = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
export const textOf = (x) => (x === undefined || x === null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x));

/** Lit un flux RSS 2.0 ou Atom et renvoie des items uniformes (+ l'objet brut). */
export function parseFeed(xml) {
  const doc = parser.parse(xml);
  if (doc?.rss?.channel) {
    return asArray(doc.rss.channel.item).map((it) => ({
      title: textOf(it.title),
      link: textOf(it.link),
      guid: textOf(it.guid),
      description: textOf(it.description) || textOf(it['content:encoded']),
      pubDate: textOf(it.pubDate) || textOf(it['dc:date']),
      categories: asArray(it.category).map(textOf).filter(Boolean),
      image: findImage(it),
      raw: it,
    }));
  }
  if (doc?.feed) {
    return asArray(doc.feed.entry).map((e) => {
      const links = asArray(e.link);
      const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') || links[0];
      return {
        title: textOf(e.title),
        link: alt?.['@_href'] || textOf(alt),
        guid: textOf(e.id),
        description: textOf(e.summary) || textOf(e.content),
        pubDate: textOf(e.updated) || textOf(e.published),
        categories: asArray(e.category).map((c) => c['@_term'] || textOf(c)).filter(Boolean),
        image: findImage(e),
        raw: e,
      };
    });
  }
  throw new Error('Flux non reconnu (ni RSS ni Atom)');
}

function findImage(it) {
  const cands = [
    ...asArray(it['media:content']).map((m) => m['@_url']),
    ...asArray(it['media:thumbnail']).map((m) => m['@_url']),
    ...asArray(it.enclosure).filter((e) => /^image\//.test(e['@_type'] || 'image/')).map((e) => e['@_url']),
  ].filter(Boolean);
  if (cands.length) return cands[0];
  const html = textOf(it.description) || textOf(it['content:encoded']) || textOf(it.content) || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** Cherche récursivement un attribut/élément dont le nom contient `needle`. */
export function findDeep(obj, needle, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (k.toLowerCase().includes(needle)) return typeof v === 'object' ? (v['#text'] ?? v) : v;
  }
  for (const v of Object.values(obj)) {
    const r = findDeep(v, needle, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}
