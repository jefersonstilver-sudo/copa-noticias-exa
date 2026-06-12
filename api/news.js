// ============================================================
//  Central Copa 2026 — Live News API v2
//  Vercel Serverless Function
//  Sources: Google News RSS + NewsData.io + GNews.io
//  Filters: removes betting, spam, irrelevant content
//  Adds: scope classification (brasil | mundo) + buckets
//  v3 — Brasil/Mundo split
// ============================================================

const NEWSDATA_KEY = process.env.NEWSDATA_KEY || '';
const GNEWS_KEY = process.env.GNEWS_KEY || '';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 min

// High-quality football/stadium images that always work
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=600&h=340&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&h=340&fit=crop&q=80',
];

// ============================================================
//  SPAM / IRRELEVANT CONTENT FILTER
// ============================================================
const BLOCKED_KEYWORDS = [
  'aposta', 'apostar', 'apostas', 'bet ', 'bets ', 'odds',
  'br4bet', 'estrela bet', 'estrelabet', 'multibet', 'betano',
  'pixbet', 'sportingbet', 'betfair', 'casa de apostas',
  'cassino', 'casino', 'slot', 'bonus de',
  'virginia ', 'virginia fonseca', 'influenciador',
  'horoscopo', 'horóscopo', 'signo', 'astrologia',
  'coluna hd', 'fofoca', 'celebridade',
];

const RELEVANCE_KEYWORDS = [
  'copa do mundo', 'copa 2026', 'world cup',
  'seleção brasileira', 'selecao brasileira', 'brasil copa',
  'convocação', 'convocados', 'convocacao',
  'ancelotti', 'neymar', 'vini', 'endrick', 'pedro', 'raphinha',
  'richarlison', 'rodrygo', 'militão', 'estêvão',
  'fase de grupos', 'grupo c', 'oitavas', 'quartas', 'semifinal', 'final',
  'estádio', 'estadio', 'metlife', 'azteca', 'hard rock',
  'fifa', 'eliminatórias', 'amistoso',
  'marrocos', 'haiti', 'escócia',
  'frança', 'argentina', 'alemanha', 'espanha', 'inglaterra', 'portugal',
  'lesao', 'lesão', 'cortado', 'machucado',
  'tabela copa', 'jogos da copa', 'abertura copa',
  'torcida', 'ingresso', 'sede', 'sedes',
];

// ============================================================
//  BRAZIL vs WORLD classification
// ============================================================
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const BRAZIL_TERMS = [
  'brasil', 'brasileir', 'selecao brasileira', 'ancelotti', 'neymar',
  'vini jr', 'vinicius', 'endrick', 'raphinha', 'richarlison', 'rodrygo',
  'militao', 'estevao', 'alisson', 'casemiro', 'marquinhos', 'bruno guimaraes',
  'cbf', 'canarinho', 'hexa', 'patria de chuteiras', 'wesley', 'bremer',
];

function classifyScope(article) {
  const t = norm(article.title + ' ' + article.description);
  for (const k of BRAZIL_TERMS) {
    if (t.includes(k)) return 'brasil';
  }
  return 'mundo';
}

function isRelevant(article) {
  const text = (article.title + ' ' + article.description).toLowerCase();

  // Block spam/betting
  for (const kw of BLOCKED_KEYWORDS) {
    if (text.includes(kw)) return false;
  }

  // Must contain at least one relevance keyword
  for (const kw of RELEVANCE_KEYWORDS) {
    if (text.includes(kw)) return true;
  }

  return false;
}

// ============================================================
//  Source 1: Google News RSS
// ============================================================
async function fetchGoogleNews() {
  const queries = [
    'copa+do+mundo+2026',
    'copa+2026+jogos+resultado+hoje',
    'copa+2026+brasil+neymar+ancelotti',
    'world+cup+2026+resultado+gols',
    'copa+2026+franca+argentina+espanha+inglaterra+portugal',
  ];
  const articles = [];

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CentralCopa2026/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const item of items.slice(0, 20)) {
        const titleRaw = extractTag(item, 'title');
        const link = extractTag(item, 'link');
        const pubDate = extractTag(item, 'pubDate');
        const sourceName = extractTag(item, 'source');
        const desc = extractTag(item, 'description');

        // Google appends " - Source" to title
        const title = titleRaw.replace(/ - [^-]{2,40}$/, '').trim();
        if (!title || title.length < 15) continue;

        // Try to extract image from description HTML
        const imgMatch = desc.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
        const image = imgMatch ? imgMatch[1] : null;

        // Google News descriptions are HTML lists of related articles — not useful
        // Generate a clean description from the title + source instead
        const cleanDesc = title.length > 60 ? title : (title + ' — ' + (sourceName || 'Google News'));

        articles.push({
          title,
          description: cleanDesc.substring(0, 250),
          source: sourceName || 'Google News',
          url: link,
          image,
          publishedAt: safeDate(pubDate),
          origin: 'google',
        });
      }
    } catch (e) {
      console.error(`[Google RSS] error:`, e.message);
    }
  }
  return articles;
}

// ============================================================
//  Source 2: NewsData.io
// ============================================================
async function fetchNewsData() {
  if (!NEWSDATA_KEY) return [];
  try {
    const url = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=copa%20do%20mundo%202026&language=pt&size=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.results) return [];

    return data.results.map((a) => ({
      title: (a.title || '').trim(),
      description: stripHtml(a.description || '').substring(0, 250),
      source: a.source_name || a.source_id || 'NewsData',
      url: a.link || '',
      image: validateImageUrl(a.image_url),
      publishedAt: safeDate(a.pubDate),
      origin: 'newsdata',
    }));
  } catch (e) {
    console.error('[NewsData] error:', e.message);
    return [];
  }
}

// ============================================================
//  Source 3: GNews.io
// ============================================================
async function fetchGNews() {
  if (!GNEWS_KEY) return [];
  try {
    const url = `https://gnews.io/api/v4/search?q=copa+do+mundo+2026&lang=pt&country=br&max=10&sortby=publishedAt&token=${GNEWS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.articles) return [];

    return data.articles.map((a) => ({
      title: (a.title || '').trim(),
      description: stripHtml(a.description || '').substring(0, 250),
      source: a.source?.name || 'GNews',
      url: a.url || '',
      image: validateImageUrl(a.image),
      publishedAt: safeDate(a.publishedAt),
      origin: 'gnews',
    }));
  } catch (e) {
    console.error('[GNews] error:', e.message);
    return [];
  }
}

// ============================================================
//  Utilities
// ============================================================
function extractTag(xml, tag) {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  if (match) return match[1].trim();

  if (tag === 'link') {
    const m = xml.match(/<link>([\s\S]*?)<\/link>/);
    if (m) return m[1].trim();
  }
  return '';
}

function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/https?:\/\/\S+/g, '') // remove raw URLs
    .replace(/\s+/g, ' ')
    .trim();
}

function validateImageUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  if (!url.startsWith('http')) return null;
  // Block tiny tracking pixels and broken patterns
  if (url.includes('1x1') || url.includes('pixel') || url.includes('tracker')) return null;
  return url;
}

function safeDate(str) {
  if (!str) return new Date().toISOString();
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function deduplicateArticles(articles) {
  const seen = [];
  return articles.filter((a) => {
    if (!a.title || a.title.length < 15) return false;

    const normalized = a.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    for (const existing of seen) {
      if (normalized === existing) return false;
      if (wordOverlap(normalized, existing) > 0.6) return false;
    }
    seen.push(normalized);
    return true;
  });
}

function wordOverlap(a, b) {
  const wordsA = a.split(' ').filter((w) => w.length > 3);
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 3));
  if (wordsA.length === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return matches / Math.max(wordsA.length, 1);
}

// ============================================================
//  Handler
// ============================================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  const [google, newsdata, gnews] = await Promise.allSettled([
    fetchGoogleNews(),
    fetchNewsData(),
    fetchGNews(),
  ]);

  const googleArticles = google.status === 'fulfilled' ? google.value : [];
  const newsdataArticles = newsdata.status === 'fulfilled' ? newsdata.value : [];
  const gnewsArticles = gnews.status === 'fulfilled' ? gnews.value : [];

  // Combine — prioritize sources with images (GNews, NewsData) first
  let articles = [...gnewsArticles, ...newsdataArticles, ...googleArticles];

  // FILTER: remove irrelevant/spam content
  articles = articles.filter(isRelevant);

  // Deduplicate
  articles = deduplicateArticles(articles);

  // Sort newest first
  articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Assign fallback images to articles without images
  articles = articles.map((a) => {
    if (!a.image) {
      const hash = a.title.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      a.image = FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
    }
    return a;
  });

  // Limit
  articles = articles.slice(0, 60);

  // Tag scope (brasil | mundo) and split into buckets
  articles = articles.map((a) => ({ ...a, scope: classifyScope(a) }));
  const brasil = articles.filter((a) => a.scope === 'brasil');
  const mundo = articles.filter((a) => a.scope === 'mundo');

  const result = {
    articles,
    brasil,
    mundo,
    updatedAt: new Date().toISOString(),
    count: articles.length,
    scopeCounts: { brasil: brasil.length, mundo: mundo.length },
    sources: {
      google: googleArticles.length,
      newsdata: newsdataArticles.length,
      gnews: gnewsArticles.length,
    },
    filtered: {
      beforeFilter: googleArticles.length + newsdataArticles.length + gnewsArticles.length,
      afterFilter: articles.length,
    },
    cached: false,
  };

  cache = { data: result, ts: Date.now() };
  return res.status(200).json(result);
};
