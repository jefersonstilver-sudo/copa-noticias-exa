// ============================================================
//  Central Copa 2026 — Live Scores & Standings API
//  Vercel Serverless Function
//  Primary : football-data.org (env FOOTBALL_DATA_KEY) — near-live scores + standings
//  Fallback : openfootball/worldcup.json — full fixtures, no key required
//  Output  : normalized JSON (live / today / recent / upcoming / standings)
// ============================================================

const FD_KEY = process.env.FOOTBALL_DATA_KEY || '';
const FD_BASE = 'https://api.football-data.org/v4/competitions/WC';
const OPENFOOTBALL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 60 * 1000; // 60s

// ============================================================
//  Team dictionary: EN (and aliases) -> { pt, code }
//  code = flagcdn ISO code (gb-eng / gb-sct for home nations)
// ============================================================
const TEAMS = {
  'brazil': { pt: 'Brasil', code: 'br' },
  'argentina': { pt: 'Argentina', code: 'ar' },
  'mexico': { pt: 'México', code: 'mx' },
  'south africa': { pt: 'África do Sul', code: 'za' },
  'south korea': { pt: 'Coreia do Sul', code: 'kr' },
  'korea republic': { pt: 'Coreia do Sul', code: 'kr' },
  'czech republic': { pt: 'Tchéquia', code: 'cz' },
  'czechia': { pt: 'Tchéquia', code: 'cz' },
  'canada': { pt: 'Canadá', code: 'ca' },
  'bosnia and herzegovina': { pt: 'Bósnia', code: 'ba' },
  'bosnia-herzegovina': { pt: 'Bósnia', code: 'ba' },
  'qatar': { pt: 'Catar', code: 'qa' },
  'switzerland': { pt: 'Suíça', code: 'ch' },
  'morocco': { pt: 'Marrocos', code: 'ma' },
  'haiti': { pt: 'Haiti', code: 'ht' },
  'scotland': { pt: 'Escócia', code: 'gb-sct' },
  'usa': { pt: 'Estados Unidos', code: 'us' },
  'united states': { pt: 'Estados Unidos', code: 'us' },
  'paraguay': { pt: 'Paraguai', code: 'py' },
  'australia': { pt: 'Austrália', code: 'au' },
  'turkey': { pt: 'Turquia', code: 'tr' },
  'türkiye': { pt: 'Turquia', code: 'tr' },
  'turkiye': { pt: 'Turquia', code: 'tr' },
  'germany': { pt: 'Alemanha', code: 'de' },
  'ivory coast': { pt: 'Costa do Marfim', code: 'ci' },
  "côte d'ivoire": { pt: 'Costa do Marfim', code: 'ci' },
  "cote d'ivoire": { pt: 'Costa do Marfim', code: 'ci' },
  'ecuador': { pt: 'Equador', code: 'ec' },
  'curaçao': { pt: 'Curaçao', code: 'cw' },
  'curacao': { pt: 'Curaçao', code: 'cw' },
  'netherlands': { pt: 'Holanda', code: 'nl' },
  'sweden': { pt: 'Suécia', code: 'se' },
  'tunisia': { pt: 'Tunísia', code: 'tn' },
  'japan': { pt: 'Japão', code: 'jp' },
  'belgium': { pt: 'Bélgica', code: 'be' },
  'egypt': { pt: 'Egito', code: 'eg' },
  'iran': { pt: 'Irã', code: 'ir' },
  'ir iran': { pt: 'Irã', code: 'ir' },
  'new zealand': { pt: 'Nova Zelândia', code: 'nz' },
  'spain': { pt: 'Espanha', code: 'es' },
  'saudi arabia': { pt: 'Arábia Saudita', code: 'sa' },
  'uruguay': { pt: 'Uruguai', code: 'uy' },
  'cape verde': { pt: 'Cabo Verde', code: 'cv' },
  'cabo verde': { pt: 'Cabo Verde', code: 'cv' },
  'france': { pt: 'França', code: 'fr' },
  'senegal': { pt: 'Senegal', code: 'sn' },
  'iraq': { pt: 'Iraque', code: 'iq' },
  'norway': { pt: 'Noruega', code: 'no' },
  'algeria': { pt: 'Argélia', code: 'dz' },
  'austria': { pt: 'Áustria', code: 'at' },
  'jordan': { pt: 'Jordânia', code: 'jo' },
  'portugal': { pt: 'Portugal', code: 'pt' },
  'dr congo': { pt: 'RD Congo', code: 'cd' },
  'congo dr': { pt: 'RD Congo', code: 'cd' },
  'democratic republic of congo': { pt: 'RD Congo', code: 'cd' },
  'uzbekistan': { pt: 'Uzbequistão', code: 'uz' },
  'colombia': { pt: 'Colômbia', code: 'co' },
  'england': { pt: 'Inglaterra', code: 'gb-eng' },
  'croatia': { pt: 'Croácia', code: 'hr' },
  'ghana': { pt: 'Gana', code: 'gh' },
  'panama': { pt: 'Panamá', code: 'pa' },
};

// Months PT
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function resolveTeam(name) {
  if (!name) return { pt: 'A definir', code: 'un', tbd: true };
  const key = String(name).trim().toLowerCase();
  if (TEAMS[key]) return { ...TEAMS[key], tbd: false };
  // Placeholder slots (e.g. "UEFA Path A winner", "2A", "W74")
  return { pt: prettyPlaceholder(name), code: 'un', tbd: true };
}

function prettyPlaceholder(name) {
  const n = String(name).trim();
  const map = {
    'UEFA Path A winner': 'Repescagem UEFA A',
    'UEFA Path B winner': 'Repescagem UEFA B',
    'UEFA Path C winner': 'Repescagem UEFA C',
    'UEFA Path D winner': 'Repescagem UEFA D',
    'IC Path 1 winner': 'Repescagem Mundial 1',
    'IC Path 2 winner': 'Repescagem Mundial 2',
  };
  if (map[n]) return map[n];
  return n; // group/knockout codes like "1A", "W74", "3C/D/F/G/H"
}

function flag(code) {
  return `https://flagcdn.com/w80/${code}.png`;
}

// ============================================================
//  Date helpers — render in America/Sao_Paulo (BRT, UTC-3)
// ============================================================
function brParts(date) {
  // date: JS Date (UTC). Shift to BRT (-3h, no DST in BR since 2019).
  const brt = new Date(date.getTime() - 3 * 3600 * 1000);
  return {
    iso: date.toISOString(),
    ymd: brt.toISOString().slice(0, 10),
    dia: String(brt.getUTCDate()).padStart(2, '0'),
    mes: MESES[brt.getUTCMonth()],
    semana: DIAS[brt.getUTCDay()],
    hora: String(brt.getUTCHours()).padStart(2, '0') + ':' + String(brt.getUTCMinutes()).padStart(2, '0'),
  };
}

function groupPt(g) {
  if (!g) return null;
  const m = String(g).match(/([A-L])\b/i) || String(g).match(/group[_\s]?([a-l])/i);
  return m ? 'Grupo ' + m[1].toUpperCase() : null;
}

function stagePt(stage, round) {
  const s = (stage || round || '').toString().toUpperCase();
  if (s.includes('GROUP') || s.includes('MATCHDAY')) return 'Fase de Grupos';
  if (s.includes('LAST_32') || s.includes('ROUND OF 32') || s.includes('ROUND_OF_32')) return 'Fase de 32';
  if (s.includes('LAST_16') || s.includes('ROUND OF 16') || s.includes('ROUND_OF_16')) return 'Oitavas';
  if (s.includes('QUARTER')) return 'Quartas';
  if (s.includes('SEMI')) return 'Semifinal';
  if (s.includes('THIRD')) return 'Disputa 3º lugar';
  if (s.includes('FINAL')) return 'Final';
  return 'Fase de Grupos';
}

// ============================================================
//  Source 1: football-data.org
// ============================================================
async function fetchFootballData() {
  if (!FD_KEY) return null;
  const headers = { 'X-Auth-Token': FD_KEY };
  const opt = { headers, signal: AbortSignal.timeout(8000) };

  const [mRes, sRes] = await Promise.all([
    fetch(`${FD_BASE}/matches`, opt),
    fetch(`${FD_BASE}/standings`, opt),
  ]);
  if (!mRes.ok) throw new Error('FD matches HTTP ' + mRes.status);
  const mData = await mRes.json();
  const sData = sRes.ok ? await sRes.json() : { standings: [] };

  const matches = (mData.matches || []).map((m) => {
    const date = new Date(m.utcDate);
    const p = brParts(date);
    const st = m.status;
    let status = 'scheduled';
    if (st === 'IN_PLAY' || st === 'PAUSED') status = 'live';
    else if (st === 'FINISHED') status = 'finished';
    const home = resolveTeam(m.homeTeam && m.homeTeam.name);
    const away = resolveTeam(m.awayTeam && m.awayTeam.name);
    return {
      id: m.id,
      iso: p.iso, ymd: p.ymd, dia: p.dia, mes: p.mes, semana: p.semana, hora: p.hora,
      status,
      minute: m.minute || null,
      stage: stagePt(m.stage),
      group: groupPt(m.group || m.stage),
      home: { name: home.pt, code: home.code, flag: flag(home.code), tbd: home.tbd },
      away: { name: away.pt, code: away.code, flag: flag(away.code), tbd: away.tbd },
      score: {
        home: m.score && m.score.fullTime ? m.score.fullTime.home : null,
        away: m.score && m.score.fullTime ? m.score.fullTime.away : null,
      },
    };
  });

  const standings = normalizeFDStandings(sData.standings || []);
  return { source: 'football-data', matches, standings };
}

function normalizeFDStandings(raw) {
  const out = [];
  for (const s of raw) {
    if (s.type && s.type !== 'TOTAL') continue;
    const g = groupPt(s.group);
    if (!g) continue;
    const table = (s.table || []).map((r) => {
      const t = resolveTeam(r.team && r.team.name);
      return {
        pos: r.position,
        team: t.pt, code: t.code, flag: flag(t.code),
        j: r.playedGames, v: r.won, e: r.draw, d: r.lost,
        gp: r.goalsFor, gc: r.goalsAgainst, sg: r.goalDifference, pts: r.points,
      };
    });
    out.push({ group: g, table });
  }
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}

// ============================================================
//  Source 2 (fallback): openfootball/worldcup.json
// ============================================================
function parseOpenfootballDate(dateStr, timeStr) {
  // dateStr "2026-06-13", timeStr "18:00 UTC-4"
  const m = (timeStr || '').match(/(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})/);
  if (!m) return new Date(dateStr + 'T12:00:00Z');
  const [, hh, mm, off] = m;
  const utcHour = parseInt(hh, 10) - parseInt(off, 10);
  const base = new Date(dateStr + 'T00:00:00Z');
  base.setUTCHours(utcHour, parseInt(mm, 10), 0, 0);
  return base;
}

async function fetchOpenfootball() {
  const res = await fetch(OPENFOOTBALL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('openfootball HTTP ' + res.status);
  const data = await res.json();

  const matches = (data.matches || []).map((m, i) => {
    const date = parseOpenfootballDate(m.date, m.time);
    const p = brParts(date);
    const home = resolveTeam(m.team1);
    const away = resolveTeam(m.team2);
    const hasScore = m.score && m.score.ft;
    return {
      id: 'of-' + (m.num || i),
      iso: p.iso, ymd: p.ymd, dia: p.dia, mes: p.mes, semana: p.semana, hora: p.hora,
      status: hasScore ? 'finished' : 'scheduled',
      minute: null,
      stage: stagePt(null, m.round),
      group: groupPt(m.group),
      home: { name: home.pt, code: home.code, flag: flag(home.code), tbd: home.tbd },
      away: { name: away.pt, code: away.code, flag: flag(away.code), tbd: away.tbd },
      score: { home: hasScore ? m.score.ft[0] : null, away: hasScore ? m.score.ft[1] : null },
    };
  });

  const standings = computeStandings(matches);
  return { source: 'openfootball', matches, standings };
}

// Compute group standings from finished matches (works for both sources if needed)
function computeStandings(matches) {
  const groups = {};
  for (const m of matches) {
    if (!m.group) continue;
    groups[m.group] = groups[m.group] || {};
    for (const side of ['home', 'away']) {
      const t = m[side];
      if (t.tbd) continue;
      if (!groups[m.group][t.name]) {
        groups[m.group][t.name] = { team: t.name, code: t.code, flag: t.flag, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 };
      }
    }
    if (m.status !== 'finished' || m.score.home == null) continue;
    const h = groups[m.group][m.home.name], a = groups[m.group][m.away.name];
    if (!h || !a) continue;
    h.j++; a.j++;
    h.gp += m.score.home; h.gc += m.score.away;
    a.gp += m.score.away; a.gc += m.score.home;
    if (m.score.home > m.score.away) { h.v++; h.pts += 3; a.d++; }
    else if (m.score.home < m.score.away) { a.v++; a.pts += 3; h.d++; }
    else { h.e++; a.e++; h.pts++; a.pts++; }
  }
  const out = Object.keys(groups).sort().map((g) => {
    const table = Object.values(groups[g]).map((r) => ({ ...r, sg: r.gp - r.gc }));
    table.sort((x, y) => y.pts - x.pts || y.sg - x.sg || y.gp - x.gp || x.team.localeCompare(y.team));
    table.forEach((r, i) => { r.pos = i + 1; });
    return { group: g, table };
  });
  return out;
}

// ============================================================
//  Build response buckets
// ============================================================
function buildResponse(base) {
  const matches = base.matches.slice().sort((a, b) => new Date(a.iso) - new Date(b.iso));
  const nowMs = Date.now();
  const todayYmd = brParts(new Date()).ymd;

  const live = matches.filter((m) => m.status === 'live');
  const today = matches.filter((m) => m.ymd === todayYmd);
  const recent = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.iso) - new Date(a.iso))
    .slice(0, 12);
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && new Date(m.iso).getTime() >= nowMs - 3 * 3600 * 1000)
    .slice(0, 16);

  const brazil = matches.filter((m) => m.home.code === 'br' || m.away.code === 'br');

  return {
    source: base.source,
    updatedAt: new Date().toISOString(),
    counts: { total: matches.length, live: live.length, today: today.length, finished: recent.length },
    live, today, recent, upcoming, brazil,
    standings: base.standings,
    matches,
  };
}

// ============================================================
//  Handler
// ============================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  let base = null;
  try {
    base = await fetchFootballData(); // null if no key
  } catch (e) {
    console.error('[scores] football-data failed:', e.message);
  }
  if (!base) {
    try {
      base = await fetchOpenfootball();
    } catch (e) {
      console.error('[scores] openfootball failed:', e.message);
      return res.status(200).json({ source: 'none', error: true, live: [], today: [], recent: [], upcoming: [], brazil: [], standings: [], matches: [], updatedAt: new Date().toISOString() });
    }
  }

  const result = buildResponse(base);
  cache = { data: result, ts: Date.now() };
  return res.status(200).json({ ...result, cached: false });
};
