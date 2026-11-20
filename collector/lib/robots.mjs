// Interprète minimal mais correct de robots.txt (groupes User-agent,
// Allow/Disallow, jokers * et $, règle la plus longue gagnante).

function parse(txt) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of (txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === 'allow' || key === 'disallow') cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  return groups;
}

function toRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export function isAllowedByRobots(txt, pathAndQuery, agent = 'BonsPlansBot') {
  const groups = parse(txt);
  if (!groups.length) return true;
  const a = agent.toLowerCase();
  let group = groups.find((g) => g.agents.some((x) => x !== '*' && a.includes(x)));
  if (!group) group = groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best = null;
  for (const r of group.rules) {
    if (r.path === '') {
      // "Disallow:" vide = tout autorisé
      continue;
    }
    if (toRegex(r.path).test(pathAndQuery)) {
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return best ? best.allow : true;
}
