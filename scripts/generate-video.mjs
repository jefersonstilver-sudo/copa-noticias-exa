#!/usr/bin/env node
// ============================================================
//  Central Copa 2026 — DOOH Video Generator
//  Gera HTML (1920x1080, 10s) + relatório TXT
//  Busca notícias ao vivo da API
// ============================================================

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR = join(__dirname, '..', 'videos');
const API_URL = 'https://central-copa-2026.vercel.app/api/news';

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ============================================================
//  Fetch news
// ============================================================
async function fetchNews() {
  console.log('[*] Buscando notícias de', API_URL);
  const res = await fetch(API_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('API error: ' + res.status);
  const data = await res.json();
  console.log(`[*] ${data.count} artigos recebidos (Google: ${data.sources.google}, NewsData: ${data.sources.newsdata}, GNews: ${data.sources.gnews})`);
  return data;
}

// ============================================================
//  Generate filenames
// ============================================================
function getFileNames() {
  const now = new Date();
  // BRT = UTC-3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const d = String(brt.getUTCDate()).padStart(2, '0');
  const mes = MESES[brt.getUTCMonth()];
  const h = String(brt.getUTCHours()).padStart(2, '0');

  const base = `copa-2026-${d}-${mes}-${h}h`;
  return {
    html: join(VIDEOS_DIR, base + '.html'),
    txt: join(VIDEOS_DIR, base + '.txt'),
    base,
    date: brt,
    dateStr: `${d}/${String(brt.getUTCMonth() + 1).padStart(2, '0')}/${brt.getUTCFullYear()}`,
    timeStr: `${h}:${String(brt.getUTCMinutes()).padStart(2, '0')}`,
    fullDate: `${d} de ${MESES_FULL[brt.getUTCMonth()]} de ${brt.getUTCFullYear()}`,
  };
}

// ============================================================
//  Generate TXT report
// ============================================================
function generateReport(articles, meta, sources) {
  const lines = [];
  lines.push('======================================================================');
  lines.push('  RELATÓRIO DE NOTÍCIAS - VÍDEO DOOH COPA 2026');
  lines.push(`  Data: ${meta.fullDate}`);
  lines.push(`  Horário: ${meta.timeStr} BRT`);
  lines.push('  Gerado por: EXA Soluções - Sistema Automatizado');
  lines.push('======================================================================');
  lines.push('');
  lines.push('VÍDEO GERADO');
  lines.push('----------------------------------------------------------------------');
  lines.push(`  Arquivo HTML:    ${meta.base}.html`);
  lines.push('  Resolução:       1920x1080 (horizontal)');
  lines.push('  Duração:         10 segundos');
  lines.push('  Formato final:   MP4 (a ser gravado via Puppeteer/Playwright)');
  lines.push('');
  lines.push(`NOTÍCIAS INCLUÍDAS NO VÍDEO (${articles.length})`);
  lines.push('----------------------------------------------------------------------');

  articles.forEach((a, i) => {
    lines.push(`  ${i + 1}. ${a.title}`);
    lines.push(`     Fonte: ${a.source}`);
    lines.push(`     URL: ${a.url}`);
    lines.push(`     Publicado: ${new Date(a.publishedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    lines.push('');
  });

  lines.push('FONTES CONSULTADAS');
  lines.push('----------------------------------------------------------------------');
  lines.push(`  Google News RSS: ${sources.google} artigos`);
  lines.push(`  NewsData.io:     ${sources.newsdata} artigos`);
  lines.push(`  GNews.io:        ${sources.gnews} artigos`);
  lines.push('');
  lines.push('IMAGENS UTILIZADAS');
  lines.push('----------------------------------------------------------------------');
  lines.push('  Background: Estádio de futebol (Unsplash)');
  lines.push('  Bandeiras:  flagcdn.com/w40/ (CDN oficial)');
  lines.push('  Logo:       logo-exa-branca.png (EXA Mídia)');
  lines.push('');
  lines.push('======================================================================');
  lines.push(`  Powered by EXA Soluções - Central Copa 2026`);
  lines.push(`  Gerado automaticamente em ${meta.dateStr} às ${meta.timeStr} BRT`);
  lines.push('======================================================================');

  return lines.join('\n');
}

// ============================================================
//  Generate HTML video
// ============================================================
function generateVideoHTML(articles, meta) {
  const headline = articles[0];
  const cards = articles.slice(1, 5);
  const ticker = articles.slice(0, 10);

  // Countdown to Copa (June 11, 2026 17:00 UTC)
  const copaDate = new Date('2026-06-11T20:00:00Z'); // 17h BRT
  const diff = copaDate - new Date();
  const dias = Math.max(0, Math.floor(diff / 86400000));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920">
<title>Copa 2026 - ${meta.dateStr} ${meta.timeStr}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Bebas+Neue&family=Orbitron:wght@400;700;900&display=swap');
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1920px; height: 1080px; overflow: hidden;
  font-family: 'Inter', sans-serif; color: #fff;
  background: #050509;
}

/* === BACKGROUND === */
.bg {
  position: absolute; inset: 0; z-index: 0;
  background: url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1920&q=90') center/cover;
  animation: bgZoom 12s ease-in-out infinite alternate;
  filter: brightness(0.3) saturate(1.2);
}
@keyframes bgZoom { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }

.vignette {
  position: absolute; inset: 0; z-index: 1;
  background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.85) 100%);
}

.scanlines {
  position: absolute; inset: 0; z-index: 2;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px);
  pointer-events: none;
}

/* === TOP BAR === */
.top-bar {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  height: 72px;
  background: linear-gradient(90deg, #b8070f, #e50914, #ff2222, #e50914, #b8070f);
  background-size: 200% 100%;
  animation: barShift 6s linear infinite;
  display: flex; align-items: center; padding: 0 48px;
  box-shadow: 0 4px 40px rgba(229,9,20,0.5);
}
@keyframes barShift { 100% { background-position: 200% 0; } }

.top-bar .brand {
  display: flex; align-items: center; gap: 16px;
}
.top-bar .brand-text {
  font-family: 'Orbitron', sans-serif; font-size: 18px;
  font-weight: 900; letter-spacing: 6px; text-transform: uppercase;
}
.top-bar .brand-sep {
  width: 2px; height: 32px; background: rgba(255,255,255,0.3);
}
.top-bar .live-badge {
  display: flex; align-items: center; gap: 8px;
  background: rgba(0,0,0,0.3); padding: 6px 16px; border-radius: 20px;
  font-size: 13px; font-weight: 800; letter-spacing: 2px;
}
.live-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 20px #fff;
  animation: blink 1s infinite;
}
@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.2; } }

.top-bar .date-time {
  margin-left: auto; text-align: right;
  font-family: 'Orbitron', sans-serif;
}
.top-bar .date-time .date {
  font-size: 14px; font-weight: 700; letter-spacing: 2px;
}
.top-bar .date-time .time {
  font-size: 11px; font-weight: 400; opacity: 0.7; letter-spacing: 1px;
  margin-top: 2px;
}

/* === COUNTDOWN CORNER === */
.countdown-corner {
  position: absolute; top: 92px; right: 48px; z-index: 10;
  background: rgba(0,0,0,0.7); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px; padding: 20px 28px; text-align: center;
  backdrop-filter: blur(20px);
  animation: fadeSlideLeft 0.8s ease-out 0.5s both;
}
@keyframes fadeSlideLeft { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }

.countdown-corner h3 {
  font-family: 'Orbitron', sans-serif; font-size: 11px;
  letter-spacing: 4px; color: rgba(255,255,255,0.5); margin-bottom: 10px;
}
.countdown-nums {
  display: flex; gap: 8px;
}
.cd-box {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 10px 14px; min-width: 60px;
}
.cd-box .num {
  font-family: 'Orbitron', sans-serif; font-size: 28px; font-weight: 900;
  background: linear-gradient(135deg, #e50914, #ff6b35, #d4a843, #1a6dd4);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  line-height: 1;
}
.cd-box .lbl {
  font-size: 9px; letter-spacing: 2px; color: rgba(255,255,255,0.4);
  text-transform: uppercase; margin-top: 4px;
}

/* === HEADLINE === */
.headline-area {
  position: absolute; top: 100px; left: 48px; right: 360px; z-index: 10;
  animation: fadeSlideUp 0.8s ease-out 0.3s both;
}
@keyframes fadeSlideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }

.headline-tag {
  display: inline-block;
  background: #e50914; color: #fff;
  font-size: 13px; font-weight: 900; letter-spacing: 3px;
  padding: 6px 20px; border-radius: 4px;
  text-transform: uppercase;
  animation: pulse 2s infinite;
  margin-bottom: 16px;
}
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(229,9,20,0.5); } 50% { box-shadow: 0 0 20px 4px rgba(229,9,20,0.3); } }

.headline-title {
  font-family: 'Inter', sans-serif;
  font-size: 48px; font-weight: 900; line-height: 1.15;
  text-shadow: 0 4px 40px rgba(0,0,0,0.8);
  max-width: 900px;
}
.headline-source {
  font-size: 15px; color: rgba(255,255,255,0.5);
  margin-top: 14px; font-weight: 600;
  letter-spacing: 1px;
}

/* === NEWS CARDS === */
.cards-row {
  position: absolute; bottom: 140px; left: 48px; right: 48px; z-index: 10;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
}
.card {
  background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; overflow: hidden;
  backdrop-filter: blur(16px);
  opacity: 0; transform: translateY(30px);
  animation: cardIn 0.6s ease-out forwards;
}
.card:nth-child(1) { animation-delay: 1.2s; }
.card:nth-child(2) { animation-delay: 1.6s; }
.card:nth-child(3) { animation-delay: 2.0s; }
.card:nth-child(4) { animation-delay: 2.4s; }
@keyframes cardIn { to { opacity:1; transform:translateY(0); } }

.card-img {
  width: 100%; height: 140px; object-fit: cover;
  border-bottom: 2px solid rgba(229,9,20,0.4);
}
.card-body { padding: 14px 16px; }
.card-src {
  font-size: 10px; font-weight: 800; color: #e50914;
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;
}
.card-title {
  font-size: 14px; font-weight: 700; line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.card-time {
  font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 6px;
}

/* === BOTTOM TICKER === */
.bottom-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
  height: 56px;
  background: linear-gradient(90deg, rgba(5,5,9,0.95), rgba(12,12,20,0.98));
  border-top: 2px solid rgba(229,9,20,0.5);
  display: flex; align-items: center;
}
.bottom-brand {
  background: #e50914; height: 100%; padding: 0 24px;
  display: flex; align-items: center; gap: 10px;
  font-family: 'Orbitron', sans-serif; font-size: 11px;
  font-weight: 900; letter-spacing: 3px; white-space: nowrap;
  flex-shrink: 0;
}
.bottom-ticker {
  flex: 1; overflow: hidden; white-space: nowrap;
  padding: 0 20px;
}
.bottom-ticker-track {
  display: inline-block;
  animation: tickerScroll 35s linear infinite;
}
.bottom-ticker-track span {
  display: inline-block; padding: 0 28px;
  font-size: 14px; font-weight: 600; letter-spacing: 0.5px;
}
.bottom-ticker-track span::before {
  content: '\\26BD'; margin-right: 10px; font-size: 12px;
}
@keyframes tickerScroll { 100% { transform: translateX(-50%); } }

.bottom-update {
  flex-shrink: 0; padding: 0 24px; text-align: right;
  border-left: 1px solid rgba(255,255,255,0.08);
  height: 100%; display: flex; flex-direction: column;
  align-items: flex-end; justify-content: center;
}
.bottom-update .upd-label {
  font-size: 9px; color: rgba(255,255,255,0.35);
  letter-spacing: 2px; text-transform: uppercase;
}
.bottom-update .upd-time {
  font-family: 'Orbitron', sans-serif; font-size: 14px;
  font-weight: 700; color: #2ecc71;
  margin-top: 2px;
}

/* === UPDATE STAMP (prominent) === */
.update-stamp {
  position: absolute; top: 92px; left: 48px; z-index: 11;
  display: flex; align-items: center; gap: 10px;
  background: rgba(0,0,0,0.6); border: 1px solid rgba(46,204,113,0.3);
  border-radius: 8px; padding: 8px 16px;
  backdrop-filter: blur(10px);
  animation: fadeSlideUp 0.6s ease-out 0.2s both;
}
.update-stamp .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #2ecc71; box-shadow: 0 0 12px #2ecc71;
  animation: blink 1.5s infinite;
}
.update-stamp span {
  font-size: 12px; font-weight: 700; color: #2ecc71;
  letter-spacing: 1px;
}

/* === PARTICLES === */
.particle {
  position: absolute; border-radius: 50%;
  pointer-events: none; z-index: 3;
  animation: float linear infinite;
}
@keyframes float {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { transform: translateY(-1100px) rotate(720deg); opacity: 0; }
}

/* === BRAZIL FLAG STRIPE === */
.br-stripe {
  position: absolute; bottom: 56px; left: 0; right: 0;
  height: 4px; z-index: 10;
  background: linear-gradient(90deg, #009c3b, #FFDF00, #002776, #FFDF00, #009c3b);
  background-size: 200% 100%;
  animation: barShift 4s linear infinite;
}
</style>
</head>
<body>

<!-- Background layers -->
<div class="bg"></div>
<div class="vignette"></div>
<div class="scanlines"></div>

<!-- Particles -->
${Array.from({length: 20}, (_, i) => {
  const size = 2 + Math.random() * 4;
  const left = Math.random() * 100;
  const delay = Math.random() * 8;
  const dur = 6 + Math.random() * 6;
  const colors = ['rgba(229,9,20,0.5)', 'rgba(212,168,67,0.4)', 'rgba(26,109,212,0.4)', 'rgba(255,255,255,0.3)'];
  const color = colors[i % 4];
  return `<div class="particle" style="width:${size}px;height:${size}px;left:${left}%;bottom:-20px;background:${color};animation-delay:${delay}s;animation-duration:${dur}s;"></div>`;
}).join('\n')}

<!-- TOP BAR -->
<div class="top-bar">
  <div class="brand">
    <span class="brand-text">CENTRAL COPA 2026</span>
    <span class="brand-sep"></span>
    <span class="live-badge"><span class="live-dot"></span> AO VIVO</span>
  </div>
  <div class="date-time">
    <div class="date">${meta.dateStr} - ${meta.timeStr} BRT</div>
    <div class="time">POWERED BY EXA MIDIA | FOZ DO IGUACU, PR</div>
  </div>
</div>

<!-- UPDATE STAMP -->
<div class="update-stamp">
  <span class="dot"></span>
  <span>ATUALIZADO ${meta.dateStr} AS ${meta.timeStr} BRT</span>
</div>

<!-- COUNTDOWN -->
<div class="countdown-corner">
  <h3>COPA DO MUNDO 2026</h3>
  <div class="countdown-nums">
    <div class="cd-box"><div class="num">${dias}</div><div class="lbl">DIAS</div></div>
    <div class="cd-box"><div class="num">${String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0')}</div><div class="lbl">HORAS</div></div>
    <div class="cd-box"><div class="num">${String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')}</div><div class="lbl">MIN</div></div>
  </div>
</div>

<!-- HEADLINE -->
<div class="headline-area">
  <div class="headline-tag">DESTAQUE AGORA</div>
  <div class="headline-title">${escHtml(headline.title)}</div>
  <div class="headline-source">${escHtml(headline.source)} &bull; ${timeAgo(headline.publishedAt)} &bull; ${meta.fullDate}</div>
</div>

<!-- NEWS CARDS -->
<div class="cards-row">
${cards.map(a => `  <div class="card">
    <img class="card-img" src="${escHtml(a.image)}" alt="" onerror="this.style.background='linear-gradient(135deg,#1a1a2e,#0f3460)';this.style.height='140px';">
    <div class="card-body">
      <div class="card-src">${escHtml(a.source)}</div>
      <div class="card-title">${escHtml(a.title)}</div>
      <div class="card-time">${timeAgo(a.publishedAt)}</div>
    </div>
  </div>`).join('\n')}
</div>

<!-- BRAZIL STRIPE -->
<div class="br-stripe"></div>

<!-- BOTTOM TICKER -->
<div class="bottom-bar">
  <div class="bottom-brand">EXA MIDIA &bull; COPA 2026</div>
  <div class="bottom-ticker">
    <div class="bottom-ticker-track">
      ${ticker.map(a => `<span>${escHtml(a.source).toUpperCase()}: ${escHtml(a.title)}</span>`).join('')}
      ${ticker.map(a => `<span>${escHtml(a.source).toUpperCase()}: ${escHtml(a.title)}</span>`).join('')}
    </div>
  </div>
  <div class="bottom-update">
    <div class="upd-label">ULTIMA ATUALIZACAO</div>
    <div class="upd-time">${meta.timeStr} BRT</div>
  </div>
</div>

</body>
</html>`;
}

// ============================================================
//  Helpers
// ============================================================
function escHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `Ha ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Ha ${hrs}h`;
  return `Ha ${Math.floor(hrs / 24)} dia(s)`;
}

// ============================================================
//  Main
// ============================================================
async function main() {
  console.log('========================================');
  console.log(' Central Copa 2026 — Video Generator');
  console.log('========================================');

  const data = await fetchNews();
  const meta = getFileNames();
  const articles = data.articles.slice(0, 10);

  if (articles.length < 5) {
    console.error('[!] Poucas noticias recebidas:', articles.length);
    process.exit(1);
  }

  // Generate HTML video
  const html = generateVideoHTML(articles, meta);
  writeFileSync(meta.html, html, 'utf-8');
  console.log(`[OK] Video HTML: ${meta.html}`);

  // Generate TXT report
  const txt = generateReport(articles, meta, data.sources);
  writeFileSync(meta.txt, txt, 'utf-8');
  console.log(`[OK] Relatorio:  ${meta.txt}`);

  console.log('');
  console.log(`[*] ${articles.length} noticias incluidas`);
  console.log(`[*] Destaque: "${articles[0].title.substring(0, 70)}..."`);
  console.log(`[*] Data: ${meta.fullDate} as ${meta.timeStr} BRT`);
  console.log('========================================');
}

main().catch(e => {
  console.error('[ERRO]', e.message);
  process.exit(1);
});
