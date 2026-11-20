// Détection des types d'offres et attributs à partir du texte.
// Ne marque une offre que sur indice explicite dans le texte de la source.
import { foldText } from './normalize.mjs';

const PATTERNS = [
  ['destockage', /\b(destockage|destocke|fin de serie|fin de stock|outlet|clearance|deballe|bradage)\b/],
  ['liquidation', /\b(liquidation|liquide tout|cessation d activite|fermeture definitive)\b/],
  ['vente_flash', /\b(vente[s]? flash|flash sale|offre eclair|lightning deal|deal du jour|24 ?h seulement|aujourd hui seulement)\b/],
  ['code_promo', /\b(code promo|code reduc|coupon|bon de reduction|avec le code|code ?:)\b/],
  ['gratuit', /\b(gratuit|gratuitement|offert|free to keep|100 ?% de reduction)\b/],
  ['vente_privee', /\b(vente[s]? privee[s]?|reserve aux membres|members only|acces vip)\b/],
  ['offre_lancement', /\b(offre de lancement|prix de lancement|launch (offer|price)|precommande|pre commande)\b/],
  ['saisonnier', /\b(black friday|cyber monday|soldes|french days|prime day|singles day|11\.11|noel|rentree|saint valentin|fete des (meres|peres)|nouvel an|ventes d hiver|ventes d ete)\b/],
  ['cumulable', /\b(cumulable|odr|offre de remboursement|via remboursement|cashback|bonus reprise)\b/],
  ['exclusif', /\b(exclusi(f|ve|vite)|en exclusivite|only at)\b/],
  ['erreur_prix_signalee', /\b(erreur de prix|erreur tarifaire|price error|price mistake|glitch)\b/],
];

export function detectDealTypes(text) {
  const t = ' ' + foldText(text) + ' ';
  const out = new Set();
  for (const [k, re] of PATTERNS) if (re.test(t)) out.add(k);
  return [...out];
}

export function detectCondition(text) {
  const t = foldText(text);
  if (/\b(reconditionne|refurbished|renewed|remis a neuf|grade [abc]|tres bon etat)\b/.test(t)) return 'reconditionne';
  if (/\b(occasion|seconde main|second hand|used)\b/.test(t)) return 'occasion';
  return null;
}

export function detectFreeShipping(text) {
  const t = foldText(text);
  if (/\b(livraison (gratuite|offerte)|frais de port (offerts|gratuits)|port (gratuit|offert)|free (shipping|delivery))\b/.test(t)) return true;
  return null;
}

export function detectPromoCode(text) {
  const s = String(text || '');
  const m = s.match(/(?:code(?:\s+promo)?|coupon)\s*[:«"“]?\s*([A-Z0-9][A-Z0-9_-]{3,24})\b/i);
  if (!m) return null;
  const code = m[1];
  // un vrai code contient au moins une majuscule ou un chiffre et n'est pas un mot courant
  if (!/[A-Z0-9]/.test(code) || /^(promo|reduction|valable|disponible|avec|pour)$/i.test(code)) return null;
  return code.toUpperCase();
}

const BRANDS = ['Apple','Samsung','Sony','LG','Philips','Xiaomi','Huawei','Honor','OnePlus','Google','Microsoft','Lenovo','HP','Dell','Asus','Acer','MSI','Razer','Logitech','Corsair','SteelSeries','HyperX','Bose','JBL','Sennheiser','Marshall','Sonos','Bang & Olufsen','Jabra','Anker','Ugreen','Belkin','TP-Link','Netgear','Nintendo','PlayStation','Xbox','Valve','Ubisoft','Electronic Arts','Bethesda','Canon','Nikon','Fujifilm','Panasonic','GoPro','DJI','Garmin','Fitbit','Withings','Dyson','Rowenta','Moulinex','SEB','Tefal','Krups','DeLonghi','Nespresso','Philips','KitchenAid','Kenwood','Bosch','Siemens','Miele','Whirlpool','Electrolux','Beko','Roborock','iRobot','Dreame','Ecovacs','Shark','Ninja','Thermomix','Vorwerk','Ikea','Nike','Adidas','Puma','New Balance','Asics','Salomon','The North Face','Patagonia','Columbia','Levi\'s','Lacoste','Tommy Hilfiger','Calvin Klein','Ralph Lauren','Converse','Vans','Timberland','Dr. Martens','Kipling','Samsonite','Eastpak','L\'Oréal','Lancôme','Dior','Chanel','Yves Saint Laurent','Clarins','Nivea','Oral-B','Braun','Gillette','Lego','Playmobil','Hasbro','Mattel','Makita','DeWalt','Ryobi','Black+Decker','Stanley','Karcher','Kärcher','Weber','Decathlon','Quechua','Kalenji','Herman Miller','Secretlab','Flexispot','Kobo','Kindle','Amazon','Crucial','Kingston','Western Digital','Seagate','SanDisk','Samsung','Intel','AMD','Nvidia','Gigabyte','be quiet!','Noctua','Fairphone','Motorola','Nothing','Oppo','Realme','Vivo','TCL','Hisense','Epson','Brother','BenQ','ViewSonic','Xgimi','Nanoleaf','Govee','Eufy','Ring','Arlo','Netatmo','Tado'];
const BRAND_RE = BRANDS.map((b) => [b, new RegExp(`(^|[^a-z0-9])${foldText(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)]);

export function detectBrand(text) {
  const t = foldText(text);
  for (const [b, re] of BRAND_RE) if (re.test(t)) return b;
  return null;
}
