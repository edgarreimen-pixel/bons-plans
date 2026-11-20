import pepper from './pepper.mjs';
import rss from './rss.mjs';
import steam from './steam.mjs';
import epic from './epic.mjs';
import cheapshark from './cheapshark.mjs';
import shop from './shop.mjs';

// Un "kind" = un type de connecteur réutilisable par N sources.
export const CONNECTORS = Object.fromEntries([pepper, rss, steam, epic, cheapshark, shop].map((c) => [c.kind, c]));
