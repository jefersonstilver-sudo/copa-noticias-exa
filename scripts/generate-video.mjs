#!/usr/bin/env node
// ============================================================
//  Central Copa 2026 — DOOH Video Generator (MP4)
//  Gera MP4 (1920x1080, 10s) + relatório TXT
//  Pipeline: Fetch news → HTML → Playwright record → ffmpeg → MP4 → Google Drive
// ============================================================

import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..');
const VIDEOS_DIR = join(PROJECT_DIR, 'videos');
const REPORTS_DIR = join(PROJECT_DIR, 'videos', 'reports');
const TEMP_DIR = join(PROJECT_DIR, 'scripts', '.temp');
const API_URL = 'https://central-copa-2026.vercel.app/api/news';

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Ensure dirs exist
[VIDEOS_DIR, REPORTS_DIR, TEMP_DIR].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

// ============================================================
//  Fetch news
// ============================================================
async function fetchNews() {
  console.log('[1/6] Buscando noticias ao vivo...');
  const res = await fetch(API_URL + '?t=' + Date.now());
  if (!res.ok) throw new Error('API error: ' + res.status);
  const data = await res.json();
  console.log(`      ${data.count} artigos (Google: ${data.sources.google}, NewsData: ${data.sources.newsdata}, GNews: ${data.sources.gnews})`);
  return data;
}

// ============================================================
//  File naming
// ============================================================
function getMeta() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const d = String(brt.getUTCDate()).padStart(2, '0');
  const mes = MESES[brt.getUTCMonth()];
  const h = String(brt.getUTCHours()).padStart(2, '0');
  const m = String(brt.getUTCMinutes()).padStart(2, '0');

  const base = `copa-2026-${d}-${mes}-${h}h`;
  return {
    base,
    mp4: join(VIDEOS_DIR, base + '.mp4'),
    txt: join(REPORTS_DIR, base + '.txt'),
    tempHtml: join(TEMP_DIR, base + '.html'),
    tempWebm: join(TEMP_DIR, base + '.webm'),
    dateStr: `${d}/${String(brt.getUTCMonth() + 1).padStart(2, '0')}/${brt.getUTCFullYear()}`,
    timeStr: `${h}:${m}`,
    fullDate: `${d} de ${MESES_FULL[brt.getUTCMonth()]} de ${brt.getUTCFullYear()}`,
  };
}

// ============================================================
//  Generate HTML (temp file for recording)
// ============================================================
function generateHTML(articles, meta) {
  const headline = articles[0];
  const cards = articles.slice(1, 5);
  const ticker = articles.slice(0, 10);

  const copaDate = new Date('2026-06-11T20:00:00Z');
  const diff = Math.max(0, copaDate - new Date());
  const dias = Math.floor(diff / 86400000);
  const horas = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
  const mins = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920">
<title>Copa 2026 - ${meta.dateStr} ${meta.timeStr}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Bebas+Neue&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
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
  filter: brightness(0.25) saturate(1.3);
}
@keyframes bgZoom { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }

.vignette {
  position: absolute; inset: 0; z-index: 1;
  background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.85) 100%);
}
.scanlines {
  position: absolute; inset: 0; z-index: 2;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px);
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
.top-bar .brand { display: flex; align-items: center; gap: 16px; }
.top-bar .brand-text {
  font-family: 'Orbitron', sans-serif; font-size: 26px;
  font-weight: 900; letter-spacing: 6px; text-transform: uppercase;
}
.top-bar .brand-sep { width: 2px; height: 32px; background: rgba(255,255,255,0.3); }
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
  margin-left: auto; text-align: right; font-family: 'Orbitron', sans-serif;
}
.top-bar .date-time .date { font-size: 20px; font-weight: 700; letter-spacing: 2px; }
.top-bar .date-time .time { font-size: 14px; font-weight: 400; opacity: 0.7; letter-spacing: 1px; margin-top: 2px; }

/* === UPDATE STAMP === */
.update-stamp {
  position: absolute; top: 92px; left: 48px; z-index: 11;
  display: flex; align-items: center; gap: 10px;
  background: rgba(0,0,0,0.65); border: 1px solid rgba(46,204,113,0.4);
  border-radius: 8px; padding: 10px 20px;
  backdrop-filter: blur(10px);
  animation: fadeSlideUp 0.6s ease-out 0.2s both;
}
@keyframes fadeSlideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
.update-stamp .dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #2ecc71; box-shadow: 0 0 16px #2ecc71;
  animation: blink 1.5s infinite;
}
.update-stamp span { font-size: 17px; font-weight: 700; color: #2ecc71; letter-spacing: 1.5px; }

/* === COUNTDOWN === */
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
  letter-spacing: 4px; color: rgba(255,255,255,0.5); margin-bottom: 12px;
}
.countdown-nums { display: flex; gap: 8px; }
.cd-box {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px; padding: 10px 14px; min-width: 64px;
}
.cd-box .num {
  font-family: 'Orbitron', sans-serif; font-size: 36px; font-weight: 900;
  background: linear-gradient(135deg, #e50914, #ff6b35, #d4a843, #1a6dd4);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1;
}
.cd-box .lbl { font-size: 9px; letter-spacing: 2px; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-top: 4px; }

/* === HEADLINE === */
.headline-area {
  position: absolute; top: 150px; left: 48px; right: 380px; z-index: 10;
  animation: fadeSlideUp 0.8s ease-out 0.3s both;
}
.headline-tag {
  display: inline-block; background: #e50914; color: #fff;
  font-size: 18px; font-weight: 900; letter-spacing: 3px;
  padding: 10px 28px; border-radius: 4px; text-transform: uppercase;
  animation: pulse 2s infinite; margin-bottom: 18px;
}
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(229,9,20,0.5); } 50% { box-shadow: 0 0 24px 6px rgba(229,9,20,0.3); } }
.headline-title {
  font-size: 62px; font-weight: 900; line-height: 1.1;
  text-shadow: 0 4px 40px rgba(0,0,0,0.8); max-width: 1000px;
}
.headline-source {
  font-size: 20px; color: rgba(255,255,255,0.5);
  margin-top: 18px; font-weight: 600; letter-spacing: 1px;
}

/* === NEWS CARDS === */
.cards-row {
  position: absolute; bottom: 130px; left: 48px; right: 48px; z-index: 10;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px;
}
.card {
  background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; overflow: hidden; backdrop-filter: blur(16px);
  opacity: 0; transform: translateY(30px);
  animation: cardIn 0.6s ease-out forwards;
}
.card:nth-child(1) { animation-delay: 1.2s; }
.card:nth-child(2) { animation-delay: 1.6s; }
.card:nth-child(3) { animation-delay: 2.0s; }
.card:nth-child(4) { animation-delay: 2.4s; }
@keyframes cardIn { to { opacity:1; transform:translateY(0); } }
.card-img {
  width: 100%; height: 145px; object-fit: cover;
  border-bottom: 2px solid rgba(229,9,20,0.4);
  background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
}
.card-body { padding: 14px 16px; }
.card-src { font-size: 13px; font-weight: 800; color: #e50914; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
.card-title { font-size: 18px; font-weight: 700; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card-time { font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 8px; }

/* === BOTTOM === */
.bottom-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
  height: 56px;
  background: linear-gradient(90deg, rgba(5,5,9,0.97), rgba(12,12,20,0.98));
  border-top: 2px solid rgba(229,9,20,0.5);
  display: flex; align-items: center;
}
.bottom-brand {
  background: #e50914; height: 100%; padding: 0 24px;
  display: flex; align-items: center; gap: 10px;
  font-family: 'Orbitron', sans-serif; font-size: 12px;
  font-weight: 900; letter-spacing: 3px; white-space: nowrap; flex-shrink: 0;
}
.bottom-ticker { flex: 1; overflow: hidden; white-space: nowrap; padding: 0 20px; }
.bottom-ticker-track {
  display: inline-block;
  animation: tickerScroll 40s linear infinite;
}
.bottom-ticker-track span {
  display: inline-block; padding: 0 28px;
  font-size: 17px; font-weight: 600; letter-spacing: 0.5px;
}
.bottom-ticker-track span::before { content: '\\26BD'; margin-right: 10px; }
@keyframes tickerScroll { 100% { transform: translateX(-50%); } }
.bottom-update {
  flex-shrink: 0; padding: 0 24px; text-align: right;
  border-left: 1px solid rgba(255,255,255,0.08);
  height: 100%; display: flex; flex-direction: column;
  align-items: flex-end; justify-content: center;
}
.bottom-update .upd-label { font-size: 11px; color: rgba(255,255,255,0.35); letter-spacing: 2px; text-transform: uppercase; }
.bottom-update .upd-time { font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700; color: #2ecc71; margin-top: 2px; }

.br-stripe {
  position: absolute; bottom: 56px; left: 0; right: 0; height: 4px; z-index: 10;
  background: linear-gradient(90deg, #009c3b, #FFDF00, #002776, #FFDF00, #009c3b);
  background-size: 200% 100%; animation: barShift 4s linear infinite;
}

/* PARTICLES */
.particle {
  position: absolute; border-radius: 50%; pointer-events: none; z-index: 3;
  animation: float linear infinite;
}
@keyframes float {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  10% { opacity: 0.5; }
  90% { opacity: 0.2; }
  100% { transform: translateY(-1100px) rotate(720deg); opacity: 0; }
}
</style>
</head>
<body>

<div class="bg"></div>
<div class="vignette"></div>
<div class="scanlines"></div>

${Array.from({length: 18}, (_, i) => {
  const size = 2 + Math.random() * 4;
  const left = Math.random() * 100;
  const delay = Math.random() * 8;
  const dur = 6 + Math.random() * 6;
  const colors = ['rgba(229,9,20,0.4)', 'rgba(212,168,67,0.3)', 'rgba(26,109,212,0.3)', 'rgba(255,255,255,0.2)'];
  return `<div class="particle" style="width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;left:${left.toFixed(1)}%;bottom:-20px;background:${colors[i%4]};animation-delay:${delay.toFixed(1)}s;animation-duration:${dur.toFixed(1)}s;"></div>`;
}).join('\n')}

<div class="top-bar">
  <div class="brand">
    <span class="brand-text">CENTRAL COPA 2026</span>
    <span class="brand-sep"></span>
    <span class="live-badge"><span class="live-dot"></span> AO VIVO</span>
  </div>
  <div class="date-time">
    <div class="date">${esc(meta.dateStr)} - ${esc(meta.timeStr)} BRT</div>
    <div class="time">POWERED BY EXA MIDIA &bull; FOZ DO IGUACU, PR</div>
  </div>
</div>

<div class="update-stamp">
  <span class="dot"></span>
  <span>ATUALIZADO EM ${esc(meta.dateStr)} AS ${esc(meta.timeStr)} BRT</span>
</div>

<div class="countdown-corner">
  <h3>COPA DO MUNDO 2026</h3>
  <div class="countdown-nums">
    <div class="cd-box"><div class="num">${dias}</div><div class="lbl">DIAS</div></div>
    <div class="cd-box"><div class="num">${horas}</div><div class="lbl">HORAS</div></div>
    <div class="cd-box"><div class="num">${mins}</div><div class="lbl">MIN</div></div>
  </div>
</div>

<div class="headline-area">
  <div class="headline-tag">DESTAQUE AGORA</div>
  <div class="headline-title">${esc(headline.title)}</div>
  <div class="headline-source">${esc(headline.source)} &bull; ${timeAgo(headline.publishedAt)} &bull; ${esc(meta.fullDate)}</div>
</div>

<div class="cards-row">
${cards.map(a => `  <div class="card">
    <img class="card-img" src="${esc(a.image)}" alt="" onerror="this.style.display='none'">
    <div class="card-body">
      <div class="card-src">${esc(a.source)}</div>
      <div class="card-title">${esc(a.title)}</div>
      <div class="card-time">${timeAgo(a.publishedAt)}</div>
    </div>
  </div>`).join('\n')}
</div>

<div class="br-stripe"></div>

<div class="bottom-bar">
  <div class="bottom-brand">EXA MIDIA &bull; COPA 2026</div>
  <div class="bottom-ticker">
    <div class="bottom-ticker-track">
      ${ticker.map(a => `<span>${esc(a.source).toUpperCase()}: ${esc(a.title)}</span>`).join('')}
      ${ticker.map(a => `<span>${esc(a.source).toUpperCase()}: ${esc(a.title)}</span>`).join('')}
    </div>
  </div>
  <div class="bottom-update">
    <div class="upd-label">ULTIMA ATUALIZACAO</div>
    <div class="upd-time">${esc(meta.timeStr)} BRT</div>
  </div>
</div>

</body></html>`;
}

// ============================================================
//  Record HTML → MP4
// ============================================================
async function recordVideo(htmlPath, mp4Path, meta) {
  console.log('[3/6] Gravando video (10 segundos)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: TEMP_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Load the HTML file
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  // Wait for fonts and images
  await page.waitForTimeout(2000);

  // Record for 10 seconds
  console.log('      Gravando 10s...');
  await page.waitForTimeout(10000);

  // Close to save video
  const video = page.video();
  await context.close();
  await browser.close();

  // Get the recorded webm path
  const webmPath = await video.path();
  console.log(`      WebM salvo: ${webmPath}`);

  // Convert WebM → MP4 with ffmpeg
  console.log('[4/6] Convertendo para MP4 (ffmpeg)...');
  const ffmpegCmd = `ffmpeg -y -i "${webmPath}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -an "${mp4Path}"`;
  execSync(ffmpegCmd, { stdio: 'pipe' });

  // Clean up temp files
  if (existsSync(webmPath)) unlinkSync(webmPath);
  if (existsSync(htmlPath)) unlinkSync(htmlPath);

  console.log(`      MP4 salvo: ${mp4Path}`);
}

// ============================================================
//  Generate TXT report
// ============================================================
function generateReport(articles, meta, sources) {
  const lines = [];
  lines.push('======================================================================');
  lines.push('  RELATORIO DE NOTICIAS - VIDEO DOOH COPA 2026');
  lines.push(`  Data: ${meta.fullDate}`);
  lines.push(`  Horario: ${meta.timeStr} BRT`);
  lines.push('  Gerado por: EXA Solucoes - Sistema Automatizado');
  lines.push('======================================================================');
  lines.push('');
  lines.push('VIDEO GERADO');
  lines.push('----------------------------------------------------------------------');
  lines.push(`  Arquivo MP4:     ${meta.base}.mp4`);
  lines.push('  Resolucao:       1920x1080 (horizontal)');
  lines.push('  Duracao:         10 segundos');
  lines.push(`  Gerado em:       ${meta.dateStr} as ${meta.timeStr} BRT`);
  lines.push('');
  lines.push(`NOTICIAS INCLUIDAS NO VIDEO (${articles.length})`);
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
  lines.push('======================================================================');
  lines.push(`  Powered by EXA Solucoes - Central Copa 2026`);
  lines.push(`  Gerado automaticamente em ${meta.dateStr} as ${meta.timeStr} BRT`);
  lines.push('======================================================================');

  return lines.join('\n');
}

// ============================================================
//  Helpers
// ============================================================
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  console.log('');
  console.log('========================================');
  console.log(' Central Copa 2026 - Video MP4 Generator');
  console.log('========================================');
  console.log('');

  const data = await fetchNews();
  const meta = getMeta();
  const articles = data.articles.slice(0, 10);

  if (articles.length < 5) {
    console.error('[!] Poucas noticias:', articles.length);
    process.exit(1);
  }

  // Generate temp HTML
  console.log('[2/6] Gerando HTML temporario...');
  const html = generateHTML(articles, meta);
  writeFileSync(meta.tempHtml, html, 'utf-8');

  // Record video
  await recordVideo(meta.tempHtml, meta.mp4, meta);

  // Generate report
  console.log('[5/6] Gerando relatorio...');
  const txt = generateReport(articles, meta, data.sources);
  writeFileSync(meta.txt, txt, 'utf-8');

  // Upload to Google Drive via rclone
  console.log('[6/6] Enviando para Google Drive...');
  try {
    execSync(`rclone copyto "${meta.mp4}" "gdrive:${meta.base}.mp4" --verbose`, { stdio: 'inherit' });
    console.log('      MP4 enviado ao Drive!');
  } catch (e) {
    console.warn('      [AVISO] Falha ao enviar MP4:', e.message);
  }
  try {
    execSync(`rclone copyto "${meta.txt}" "gdrive:Relatorios/${meta.base}.txt" --verbose`, { stdio: 'inherit' });
    console.log('      Relatorio enviado ao Drive!');
  } catch (e) {
    console.warn('      [AVISO] Falha ao enviar relatorio:', e.message);
  }

  console.log('');
  console.log('========================================');
  console.log(`  MP4:       ${meta.mp4}`);
  console.log(`  Relatorio: ${meta.txt}`);
  console.log(`  Drive:     Enviado automaticamente`);
  console.log(`  Noticias:  ${articles.length}`);
  console.log(`  Destaque:  "${articles[0].title.substring(0, 60)}..."`);
  console.log(`  Data:      ${meta.fullDate} as ${meta.timeStr} BRT`);
  console.log('========================================');
  console.log('');
}

main().catch(e => {
  console.error('[ERRO]', e.message);
  process.exit(1);
});
