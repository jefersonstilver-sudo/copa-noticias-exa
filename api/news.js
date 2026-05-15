// ============================================================
//  Central Copa 2026 — Live News API
//  Vercel Serverless Function
//  Sources: Google News RSS + NewsData.io + GNews.io
// ============================================================

const NEWSDATA_KEY = process.env.NEWSDATA_KEY || 'pub_6380ed673a7d406eabdf98ed11f20c87';
const GNEWS_KEY = process.env.GNEWS_KEY || '36812da28a16233d7d5bd92397a18b42';

// In-memory cache (persists across warm invocations on Vercel Fluid Compute)
let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&q=80',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&q=80',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=600&q=80',
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&q=80',
  'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&q=80',
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&q=80',
  'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?w=600&q=80',
  'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=600&q=80',
  'https://images.unsplash.com/photo-1577223625816-7546f13df25d?w=600&q=80',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600&q=80',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&q=80',
  'https://images.unsplash.com/photo-1516475429286-465d815a0df7?w=600&q=80',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=600&q=80',
];

// ============================================================
//  Source 1: Google News RSS (free, no key, unlimited)
// ============================================================
async function fetchGoogleNews() {
  const queries = [
    'copa+do+mundo+2026',
    'convoca%C3%A7%C3%A3o+sele%C3%A7%C3%A3o+brasileira+2026',
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

      for (const item of items.slice(0, 15)) {
        const titleRaw = extractTag(item, 'title');
        const link = extractTag(item, 'link');
        const pubDate = extractTag(item, 'pubDate');
        const sourceName = extractTag(item, 'source');
        const desc = extractTag(item, 'description');

        // Google News appends " - Source" to title
        const title = titleRaw.replace(/ - [^-]{2,30}$/, '').trim();

        articles.push({
          title,
          description: stripHtml(desc).substring(0, 250),
          source: sourceName || 'Google News',
          url: link,
          image: null,
          publishedAt: safeDate(pubDate),
          origin: 'google',
        });
      }
    } catch (e) {
      console.error(`[Google RSS] query="${q}" error:`, e.message);
    }
  }

  return articles;
}

// ============================================================
//  Source 2: NewsData.io (200 req/day free)
// ============================================================
async function fetchNewsData() {
  try {
    const url = `https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=copa%20do%20mundo%202026%20OR%20sele%C3%A7%C3%A3o%20brasileira&language=pt&size=10`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.results) return [];

    return data.results.map((a) => ({
      title: (a.title || '').trim(),
      description: (a.description || '').substring(0, 250),
      source: a.source_name || a.source_id || 'NewsData',
      url: a.link || '',
      image: a.image_url || null,
      publishedAt: safeDate(a.pubDate),
      origin: 'newsdata',
    }));
  } catch (e) {
    console.error('[NewsData] error:', e.message);
    return [];
  }
}

// ============================================================
//  Source 3: GNews.io (100 req/day free)
// ============================================================
async function fetchGNews() {
  try {
    const url = `https://gnews.io/api/v4/search?q=copa+do+mundo+2026&lang=pt&country=br&max=10&sortby=publishedAt&token=${GNEWS_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.articles) return [];

    return data.articles.map((a) => ({
      title: (a.title || '').trim(),
      description: (a.description || '').substring(0, 250),
      source: a.source?.name || 'GNews',
      url: a.url || '',
      image: a.image || null,
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
  // Handle CDATA
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle self-closing or regular tags
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(re);
  if (match) return match[1].trim();

  // Special case for <link> which is not wrapped
  if (tag === 'link') {
    const linkRe = /<link\s*\/?>([^<\s]+)/;
    const m = xml.match(linkRe);
    if (m) return m[1].trim();

    // Try different format
    const linkRe2 = /<link>([\s\S]*?)<\/link>/;
    const m2 = xml.match(linkRe2);
    if (m2) return m2[1].trim();
  }

  return '';
}

function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    if (!a.title || a.title.length < 10) return false;

    const normalized = a.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check for exact or very similar titles
    for (const existing of seen) {
      if (normalized === existing) return false;
      if (wordOverlap(normalized, existing) > 0.65) return false;
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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');

  // Return cache if fresh
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  // Fetch all sources in parallel
  const [google, newsdata, gnews] = await Promise.allSettled([
    fetchGoogleNews(),
    fetchNewsData(),
    fetchGNews(),
  ]);

  const googleArticles = google.status === 'fulfilled' ? google.value : [];
  const newsdataArticles = newsdata.status === 'fulfilled' ? newsdata.value : [];
  const gnewsArticles = gnews.status === 'fulfilled' ? gnews.value : [];

  // Combine all
  let articles = [...gnewsArticles, ...newsdataArticles, ...googleArticles];

  // Assign fallback images where missing
  let imgIdx = 0;
  articles = articles.map((a) => ({
    ...a,
    image: a.image || FALLBACK_IMAGES[imgIdx++ % FALLBACK_IMAGES.length],
  }));

  // Deduplicate
  articles = deduplicateArticles(articles);

  // Sort newest first
  articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  // Limit to 50
  articles = articles.slice(0, 50);

  const result = {
    articles,
    updatedAt: new Date().toISOString(),
    count: articles.length,
    sources: {
      google: googleArticles.length,
      newsdata: newsdataArticles.length,
      gnews: gnewsArticles.length,
    },
    cached: false,
  };

  // Store in cache
  cache = { data: result, ts: Date.now() };

  return res.status(200).json(result);
};
