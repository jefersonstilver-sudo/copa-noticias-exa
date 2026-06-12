// ============================================================
//  Central Copa 2026 — Live Scores & Standings API v4
//  Vercel Serverless Function
//  Sources (priority order):
//    1. football-data.org (env FOOTBALL_DATA_KEY) — best quality
//    2. ESPN API (free, no key) — live scores + results
//    3. openfootball (free) — fixtures fallback
//  Includes: broadcast info + BRT times + venues
// ============================================================

const FD_KEY = process.env.FOOTBALL_DATA_KEY || '';
const FD_BASE = 'https://api.football-data.org/v4/competitions/WC';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const OPENFOOTBALL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 45 * 1000; // 45s for fresher live data

// ============================================================
//  Broadcast info
// ============================================================
const BROADCASTS = {
  default: [
    { name: 'CazéTV', icon: '🎮', url: 'https://www.youtube.com/@CazeTV/streams' },
    { name: 'Globo', icon: '📺', url: 'https://globoplay.globo.com/' },
    { name: 'SporTV', icon: '📡', url: 'https://globoplay.globo.com/' },
    { name: 'FIFA+', icon: '⚽', url: 'https://www.fifa.com/fifaplus' },
  ],
  brazil: [
    { name: 'Globo (aberta)', icon: '📺', url: 'https://globoplay.globo.com/' },
    { name: 'Globoplay', icon: '▶️', url: 'https://globoplay.globo.com/' },
    { name: 'CazéTV', icon: '🎮', url: 'https://www.youtube.com/@CazeTV/streams' },
    { name: 'SporTV', icon: '📡', url: 'https://globoplay.globo.com/' },
    { name: 'FIFA+', icon: '⚽', url: 'https://www.fifa.com/fifaplus' },
  ],
};

function getBroadcast(match) {
  const isBrazil = match.home.code === 'br' || match.away.code === 'br';
  return isBrazil ? BROADCASTS.brazil : BROADCASTS.default;
}

// ============================================================
//  Teams dictionary
// ============================================================
const TEAMS = {
  'brazil': { pt: 'Brasil', code: 'br' },
  'brasil': { pt: 'Brasil', code: 'br' },
  'argentina': { pt: 'Argentina', code: 'ar' },
  'mexico': { pt: 'México', code: 'mx' },
  'méxico': { pt: 'México', code: 'mx' },
  'south africa': { pt: 'África do Sul', code: 'za' },
  'south korea': { pt: 'Coreia do Sul', code: 'kr' },
  'korea republic': { pt: 'Coreia do Sul', code: 'kr' },
  'czech republic': { pt: 'Tchéquia', code: 'cz' },
  'czechia': { pt: 'Tchéquia', code: 'cz' },
  'canada': { pt: 'Canadá', code: 'ca' },
  'bosnia and herzegovina': { pt: 'Bósnia', code: 'ba' },
  'bosnia-herzegovina': { pt: 'Bósnia', code: 'ba' },
  'bosnia & herzegovina': { pt: 'Bósnia', code: 'ba' },
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

// Also map by ESPN abbreviated names / country codes
const CODE_MAP = {
  'BRA': 'br', 'ARG': 'ar', 'MEX': 'mx', 'RSA': 'za', 'KOR': 'kr',
  'CZE': 'cz', 'CAN': 'ca', 'BIH': 'ba', 'QAT': 'qa', 'SUI': 'ch',
  'MAR': 'ma', 'HAI': 'ht', 'SCO': 'gb-sct', 'USA': 'us', 'PAR': 'py',
  'AUS': 'au', 'TUR': 'tr', 'GER': 'de', 'CIV': 'ci', 'ECU': 'ec',
  'CUW': 'cw', 'NED': 'nl', 'SWE': 'se', 'TUN': 'tn', 'JPN': 'jp',
  'BEL': 'be', 'EGY': 'eg', 'IRN': 'ir', 'NZL': 'nz', 'ESP': 'es',
  'KSA': 'sa', 'URU': 'uy', 'CPV': 'cv', 'FRA': 'fr', 'SEN': 'sn',
  'IRQ': 'iq', 'NOR': 'no', 'ALG': 'dz', 'AUT': 'at', 'JOR': 'jo',
  'POR': 'pt', 'COD': 'cd', 'UZB': 'uz', 'COL': 'co', 'ENG': 'gb-eng',
  'CRO': 'hr', 'GHA': 'gh', 'PAN': 'pa',
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function resolveTeam(name) {
  if (!name) return { pt: 'A definir', code: 'un', tbd: true };
  const key = String(name).trim().toLowerCase();
  if (TEAMS[key]) return { ...TEAMS[key], tbd: false };
  return { pt: String(name).trim(), code: 'un', tbd: true };
}

function resolveByCode(abbr) {
  const code = CODE_MAP[abbr];
  if (code) {
    // Find the pt name
    for (const v of Object.values(TEAMS)) {
      if (v.code === code) return { pt: v.pt, code, tbd: false };
    }
    return { pt: abbr, code, tbd: false };
  }
  return null;
}

function flag(code) {
  return `https://flagcdn.com/w80/${code}.png`;
}

// ============================================================
//  Date helpers — BRT (UTC-3)
// ============================================================
function brParts(date) {
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
//  Source 1: football-data.org (best, needs key)
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
    const match = {
      id: m.id,
      iso: p.iso, ymd: p.ymd, dia: p.dia, mes: p.mes, semana: p.semana, hora: p.hora,
      status,
      minute: m.minute || null,
      stage: stagePt(m.stage),
      group: groupPt(m.group || m.stage),
      venue: (m.venue || ''),
      home: { name: home.pt, code: home.code, flag: flag(home.code), tbd: home.tbd },
      away: { name: away.pt, code: away.code, flag: flag(away.code), tbd: away.tbd },
      score: {
        home: m.score && m.score.fullTime ? m.score.fullTime.home : null,
        away: m.score && m.score.fullTime ? m.score.fullTime.away : null,
      },
    };
    match.broadcast = getBroadcast(match);
    return match;
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
        pos: r.position, team: t.pt, code: t.code, flag: flag(t.code),
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
//  Source 2: ESPN API (free, no key, live scores!)
// ============================================================
async function fetchESPN() {
  // ESPN scoreboard returns today's matches with live scores
  // We fetch multiple date ranges to get recent + upcoming
  const dates = [];
  const now = new Date();
  // Get last 3 days + today + next 5 days
  for (let i = -3; i <= 5; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }

  const allMatches = [];
  const fetches = dates.map(async (dateStr) => {
    try {
      const url = `${ESPN_SCOREBOARD}?dates=${dateStr}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CentralCopa2026/2.0)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return parseESPNEvents(data);
    } catch (e) {
      console.error(`[ESPN] error for ${dateStr}:`, e.message);
      return [];
    }
  });

  const results = await Promise.allSettled(fetches);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      allMatches.push(...r.value);
    }
  }

  // Deduplicate by match ID
  const seen = new Set();
  const unique = allMatches.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const standings = computeStandings(unique);
  return { source: 'espn-live', matches: unique, standings };
}

function parseESPNEvents(data) {
  if (!data || !data.events) return [];
  return data.events.map((ev) => {
    const comp = ev.competitions && ev.competitions[0];
    if (!comp) return null;

    const date = new Date(ev.date || comp.date);
    const p = brParts(date);

    // Status
    const st = comp.status || {};
    const stType = (st.type && st.type.name) || '';
    let status = 'scheduled';
    let minute = null;
    if (stType === 'STATUS_IN_PROGRESS' || stType === 'STATUS_HALFTIME' || stType === 'STATUS_FIRST_HALF' || stType === 'STATUS_SECOND_HALF') {
      status = 'live';
      minute = st.displayClock || (st.type && st.type.shortDetail) || null;
    } else if (stType === 'STATUS_FULL_TIME' || stType === 'STATUS_FINAL' || stType === 'STATUS_END_PERIOD') {
      status = 'finished';
    }

    // Teams
    const competitors = comp.competitors || [];
    let homeData = competitors.find(c => c.homeAway === 'home') || competitors[0];
    let awayData = competitors.find(c => c.homeAway === 'away') || competitors[1];
    if (!homeData || !awayData) return null;

    function parseTeam(c) {
      const teamObj = c.team || {};
      const name = teamObj.displayName || teamObj.name || teamObj.shortDisplayName || '';
      const abbr = teamObj.abbreviation || '';

      // Try to resolve by abbreviation first, then by name
      let resolved = resolveByCode(abbr);
      if (!resolved) resolved = resolveTeam(name);

      return {
        name: resolved.pt,
        code: resolved.code,
        flag: flag(resolved.code),
        tbd: resolved.tbd,
        score: parseInt(c.score, 10),
      };
    }

    const home = parseTeam(homeData);
    const away = parseTeam(awayData);

    // Venue
    const venue = comp.venue ? (comp.venue.fullName || comp.venue.shortName || '') : '';

    // Group/stage
    const notes = (comp.notes || []).map(n => n.headline || '').join(' ');
    const group = groupPt(notes) || groupPt(ev.season && ev.season.type && ev.season.type.name) || null;
    const stage = notes ? stagePt(notes) : 'Fase de Grupos';

    // Events/incidents (goals, cards)
    let events = [];
    if (comp.details) {
      events = comp.details.map(d => ({
        type: d.type && d.type.text || '',
        clock: d.clock && d.clock.displayValue || '',
        team: d.team && d.team.abbreviation || '',
        athlete: d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName || '',
      }));
    }

    const match = {
      id: 'espn-' + ev.id,
      iso: p.iso, ymd: p.ymd, dia: p.dia, mes: p.mes, semana: p.semana, hora: p.hora,
      status,
      minute,
      stage,
      group,
      venue,
      home: { name: home.name, code: home.code, flag: home.flag, tbd: home.tbd },
      away: { name: away.name, code: away.code, flag: away.flag, tbd: away.tbd },
      score: {
        home: (status === 'finished' || status === 'live') ? home.score : null,
        away: (status === 'finished' || status === 'live') ? away.score : null,
      },
      events: events.length ? events : undefined,
    };
    match.broadcast = getBroadcast(match);
    return match;
  }).filter(Boolean);
}

// ============================================================
//  Source 3 (fallback): openfootball/worldcup.json
// ============================================================
function parseOpenfootballDate(dateStr, timeStr) {
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
    const match = {
      id: 'of-' + (m.num || i),
      iso: p.iso, ymd: p.ymd, dia: p.dia, mes: p.mes, semana: p.semana, hora: p.hora,
      status: hasScore ? 'finished' : 'scheduled',
      minute: null,
      stage: stagePt(null, m.round),
      group: groupPt(m.group),
      venue: '',
      home: { name: home.pt, code: home.code, flag: flag(home.code), tbd: home.tbd },
      away: { name: away.pt, code: away.code, flag: flag(away.code), tbd: away.tbd },
      score: { home: hasScore ? m.score.ft[0] : null, away: hasScore ? m.score.ft[1] : null },
    };
    match.broadcast = getBroadcast(match);
    return match;
  });

  const standings = computeStandings(matches);
  return { source: 'openfootball', matches, standings };
}

// ============================================================
//  Compute standings from match results
// ============================================================
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
//  Merge ESPN live data with openfootball fixtures
//  ESPN has today's scores; openfootball has full schedule
// ============================================================
function mergeData(espn, openfootball) {
  // Use ESPN as primary (has live scores), fill gaps with openfootball
  const espnById = new Map();
  const espnByTeams = new Map();

  for (const m of espn.matches) {
    espnById.set(m.id, m);
    // Index by home+away codes for dedup
    const key = m.home.code + '-' + m.away.code + '-' + m.ymd;
    espnByTeams.set(key, m);
  }

  // Add openfootball matches that ESPN doesn't have (future games beyond ESPN range)
  for (const m of openfootball.matches) {
    const key = m.home.code + '-' + m.away.code + '-' + m.ymd;
    const keyRev = m.away.code + '-' + m.home.code + '-' + m.ymd;
    if (!espnByTeams.has(key) && !espnByTeams.has(keyRev)) {
      espn.matches.push(m);
    }
  }

  // Recompute standings with all data
  espn.standings = computeStandings(espn.matches);
  espn.source = 'espn-live';
  return espn;
}

// ============================================================
//  Build response
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
    .slice(0, 16);
  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && new Date(m.iso).getTime() >= nowMs - 3 * 3600 * 1000)
    .slice(0, 24);
  const brazil = matches.filter((m) => m.home.code === 'br' || m.away.code === 'br');

  const brtNow = new Date(nowMs - 3 * 3600 * 1000);
  const brtClock = String(brtNow.getUTCHours()).padStart(2, '0') + ':' + String(brtNow.getUTCMinutes()).padStart(2, '0');

  return {
    source: base.source,
    updatedAt: new Date().toISOString(),
    brtClock,
    counts: { total: matches.length, live: live.length, today: today.length, finished: recent.length },
    live, today, recent, upcoming, brazil,
    standings: base.standings,
    matches,
  };
}

// ============================================================
//  Handler
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    const brtNow = new Date(Date.now() - 3 * 3600 * 1000);
    const brtClock = String(brtNow.getUTCHours()).padStart(2, '0') + ':' + String(brtNow.getUTCMinutes()).padStart(2, '0');
    return res.status(200).json({ ...cache.data, brtClock, cached: true });
  }

  let base = null;

  // Try football-data.org first (best quality)
  try {
    base = await fetchFootballData();
  } catch (e) {
    console.error('[scores] football-data failed:', e.message);
  }

  // Try ESPN (free, has live scores)
  if (!base) {
    try {
      const espnData = await fetchESPN();
      if (espnData && espnData.matches.length > 0) {
        // Also fetch openfootball for full schedule and merge
        try {
          const ofData = await fetchOpenfootball();
          base = mergeData(espnData, ofData);
        } catch (e) {
          // ESPN alone is fine
          base = espnData;
        }
      }
    } catch (e) {
      console.error('[scores] ESPN failed:', e.message);
    }
  }

  // Fallback to openfootball alone
  if (!base) {
    try {
      base = await fetchOpenfootball();
    } catch (e) {
      console.error('[scores] openfootball failed:', e.message);
      return res.status(200).json({
        source: 'none', error: true, brtClock: '--:--',
        live: [], today: [], recent: [], upcoming: [], brazil: [],
        standings: [], matches: [], updatedAt: new Date().toISOString(),
      });
    }
  }

  const result = buildResponse(base);
  cache = { data: result, ts: Date.now() };
  return res.status(200).json({ ...result, cached: false });
}
