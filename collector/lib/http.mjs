// Client HTTP poli : User-Agent identifiable, délai par domaine, délais
// d'attente, nouvelles tentatives limitées et respect de robots.txt.
import { isAllowedByRobots } from './robots.mjs';

const CONTACT = process.env.BOT_CONTACT_URL || 'https://github.com';
export const USER_AGENT = `BonsPlansBot/1.0 (+${CONTACT})`;
const PER_HOST_DELAY_MS = Number(process.env.PER_HOST_DELAY_MS || 1200);

const lastHit = new Map();
const robotsCache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function politeWait(host) {
  const prev = lastHit.get(host) || 0;
  const wait = prev + PER_HOST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} sur ${url}`);
    this.status = status;
  }
}

async function rawFetch(url, { timeoutMs = 20000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.6', ...headers },
    });
  } finally {
    clearTimeout(t);
  }
}

async function robotsAllows(url) {
  const u = new URL(url);
  const origin = u.origin;
  if (!robotsCache.has(origin)) {
    let txt = '';
    try {
      await politeWait(u.host);
      const r = await rawFetch(`${origin}/robots.txt`, { timeoutMs: 10000 });
      if (r.ok) txt = await r.text();
    } catch { /* robots.txt injoignable : on considère autorisé, comme les robots usuels */ }
    robotsCache.set(origin, txt);
  }
  return isAllowedByRobots(robotsCache.get(origin), u.pathname + u.search, 'BonsPlansBot');
}

/**
 * Télécharge une URL.
 * @param {object} opts
 *  - checkRobots : vérifie robots.txt (obligatoire pour les boutiques génériques)
 *  - as : 'json' | 'text'
 */
export async function get(url, { as = 'text', checkRobots = false, retries = 2, timeoutMs, headers } = {}) {
  if (checkRobots && !(await robotsAllows(url))) {
    const e = new Error(`Refusé par robots.txt : ${url}`);
    e.robots = true;
    throw e;
  }
  const host = new URL(url).host;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeWait(host);
    try {
      const r = await rawFetch(url, {
        timeoutMs,
        headers: { Accept: as === 'json' ? 'application/json' : '*/*', ...headers },
      });
      if (r.status === 429 || r.status >= 500) throw new HttpError(r.status, url);
      if (!r.ok) {
        const e = new HttpError(r.status, url);
        e.fatal = true;
        throw e;
      }
      return as === 'json' ? await r.json() : await r.text();
    } catch (e) {
      lastErr = e;
      if (e.fatal || attempt === retries) break;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}
