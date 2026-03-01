/* ============================================
   PFL App — Leaderboard Module
   Top 3 podium, rankings table
   ============================================ */

import { fetchLeaderboard, fetchLeaderboardConfig } from './api.js';
import { 
  $, escapeHtml, setButtonLoading, formatNameTwoLines, 
  formatPointsLabel, haptic 
} from './utils.js';

// ---- State ----
let isLoaded = false;
let lbConfig = {};
let pdfOpen = false;

// ---- DOM References ----
const getElements = () => ({
  container: $('#outLeaderboard'),
  card: $('.leaderboard-card'),
  subtitle: $('#subtitle-leaderboard'),
  reloadBtn: $('#reloadLeaderboard'),
  statusBadge: $('#lbStatusBadge'),
});

// ---- Initialize ----
export function initLeaderboard() {
  const { reloadBtn } = getElements();
  
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      haptic('light');
      loadLeaderboard({ force: true });
    });
  }
  
  // PDF link → open in iframe with FAB back
  const pdfLink = $('#pflPdfLink');
  if (pdfLink) {
    pdfLink.addEventListener('click', (e) => {
      e.preventDefault();
      openPdf(pdfLink.href);
    });
  }
  
  // FAB back closes PDF
  const fab = $('#fabBack');
  if (fab) {
    fab.addEventListener('click', () => {
      if (!pdfOpen) return;
      closePdf();
    });
  }
  
  console.log('[Leaderboard] Initialized');
}

// ---- PDF ----
function openPdf(url) {
  const viewer = $('#pdfViewer');
  const frame = $('#pdfViewerFrame');
  const fab = $('#fabBack');
  if (!viewer || !frame) return;

  frame.src = url;
  viewer.style.display = 'block';
  document.body.classList.add('pdf-viewer-open');
  if (fab) fab.classList.add('visible');
  pdfOpen = true;

  const scroller = document.getElementById('app-wrap');
  if (scroller) scroller.scrollTop = 0;
  haptic('light');
}

function closePdf() {
  const viewer = $('#pdfViewer');
  const frame = $('#pdfViewerFrame');
  const fab = $('#fabBack');
  if (!viewer) return;

  viewer.style.display = 'none';
  frame.src = '';
  document.body.classList.remove('pdf-viewer-open');
  if (fab) fab.classList.remove('visible');
  pdfOpen = false;
  haptic('light');
}

// ---- Load Data ----
export async function loadLeaderboard({ force = false } = {}) {
  const { container, card, subtitle, reloadBtn } = getElements();
  
  if (!container) return;
  
  // Show loading state
  setButtonLoading(reloadBtn, true);
  
  if (!isLoaded || force) {
    if (subtitle) {
      subtitle.textContent = 'Оновлюю дані Predator Fest League. Головний приз - 23 Shimano Vanquish 2500S!';
    }
    if (card) card.classList.remove('is-loaded');
  }
  
  try {
    // Load config and data in parallel
    const [configData, leaderboardData] = await Promise.all([
      fetchLeaderboardConfig({ force }),
      fetchLeaderboard({ force }),
    ]);
    
    // Parse config
    if (configData?.ok && Array.isArray(configData.values)) {
      lbConfig = parseConfig(configData.values);
      renderStatusBadge();
    }
    
    // Render leaderboard
    if (!leaderboardData?.ok || !Array.isArray(leaderboardData.values)) {
      throw new Error('Invalid data');
    }
    
    renderLeaderboard(leaderboardData.values);
    
    if (subtitle) {
      subtitle.textContent = 'Рейтинг учасників Predator Fest League. Головний приз - 23 Shimano Vanquish 2500S!';
    }
    
    if (card) card.classList.add('is-loaded');
    isLoaded = true;
    
  } catch (error) {
    console.error('[Leaderboard] Load error:', error);
    
    if (subtitle) {
      subtitle.textContent = 'Помилка завантаження';
    }
    container.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
    
  } finally {
    setButtonLoading(reloadBtn, false);
  }
}

// ---- Parse Config ----
function parseConfig(values) {
  const config = {};
  values.slice(1).forEach(row => {
    const key = String(row[0] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    const val = String(row[1] ?? '').trim();
    if (key && val) config[key] = val;
  });
  return config;
}

// ---- Render Status Badge ----
function renderStatusBadge() {
  const badge = $('#lbStatusBadge');
  if (!badge) return;
  
  const text = lbConfig.status_text || lbConfig.badge_text || lbConfig.text || '';
  if (!text) {
    badge.style.display = 'none';
    return;
  }
  
  badge.style.display = '';
  badge.textContent = text;
}

// ---- Column Detection Helpers ----
function findIdxByKeywords(headersLower, keywords) {
  if (!Array.isArray(headersLower)) return -1;
  for (let i = 0; i < headersLower.length; i++) {
    const h = String(headersLower[i] ?? '');
    if (!h) continue;
    for (const k of keywords) {
      if (h.includes(k)) return i;
    }
  }
  return -1;
}

function calcColStats(rows, colCount, sampleSize = 20) {
  const stats = Array.from({ length: colCount }, () => ({
    total: 0,
    numeric: 0,
    lenSum: 0,
  }));

  const sample = (Array.isArray(rows) ? rows : []).slice(0, sampleSize);

  for (const r of sample) {
    if (!Array.isArray(r)) continue;
    for (let i = 0; i < colCount; i++) {
      const raw = r?.[i];
      const s = String(raw ?? '').trim();
      if (!s) continue;

      const st = stats[i];
      st.total += 1;
      st.lenSum += s.length;

      // Accept commas as decimals (e.g., "14,5")
      const n = s.replace(/\s+/g, '').replace(',', '.');
      if (/^-?\d+(?:\.\d+)?$/.test(n)) {
        st.numeric += 1;
      }
    }
  }

  return stats.map(st => ({
    numRatio: st.total ? st.numeric / st.total : 0,
    avgLen: st.total ? st.lenSum / st.total : 0,
  }));
}

function isRankLikeHeader(h) {
  const s = String(h ?? '').toLowerCase();
  return (
    s === '№' ||
    s.includes('rank') ||
    s.includes('place') ||
    s.includes('пози') ||
    s.includes('місц')
  );
}

function guessPointsIdx(headersLower, colStats) {
  // Prefer numeric-heavy columns (but avoid the rank column)
  let best = -1;
  let bestScore = -1;

  for (let i = 0; i < colStats.length; i++) {
    const h = headersLower?.[i] ?? '';
    if (isRankLikeHeader(h)) continue;

    const { numRatio, avgLen } = colStats[i];
    // Points column usually: mostly numeric + short strings
    const score = numRatio * 10 - Math.min(avgLen, 12) * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best;
}

function guessNameIdx(headersLower, colStats, pointsIdx) {
  // Prefer text-heavy columns with longer strings (avoid rank + points)
  let best = -1;
  let bestScore = -1;

  for (let i = 0; i < colStats.length; i++) {
    if (i === pointsIdx) continue;

    const h = headersLower?.[i] ?? '';
    if (isRankLikeHeader(h)) continue;

    const { numRatio, avgLen } = colStats[i];
    // Name column usually: not numeric + longer strings
    const score = (1 - numRatio) * 10 + Math.min(avgLen, 30) * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best;
}

// ---- Render Leaderboard ----
function renderLeaderboard(values) {
  const { container } = getElements();
  if (!container) return;
  
  const header = values[0];
  const rows = values.slice(1).filter(r => 
    Array.isArray(r) && r.some(c => String(c ?? '').trim() !== '')
  );
  
  // Find column indices (robust: handles unknown header labels)
  const hLower = header.map(h => String(h ?? '').toLowerCase());
  const colStats = calcColStats(rows, header.length);

  let nameIdx = findIdxByKeywords(hLower, ['ім', 'name', 'учас', 'participant', 'angler', 'команд', 'team']);
  let pointsIdx = findIdxByKeywords(hLower, ['бал', 'point', 'points', 'score', 'pts']);

  if (pointsIdx < 0) pointsIdx = guessPointsIdx(hLower, colStats);
  if (nameIdx < 0) nameIdx = guessNameIdx(hLower, colStats, pointsIdx);

  // Final fallbacks
  if (pointsIdx < 0 || pointsIdx >= header.length) {
    pointsIdx = Math.min(2, Math.max(0, header.length - 1));
  }
  if (nameIdx < 0 || nameIdx >= header.length) {
    nameIdx = header.length > 1 ? 1 : 0;
  }
  if (nameIdx === pointsIdx && header.length > 1) {
    nameIdx = pointsIdx === 0 ? 1 : 0;
  }
  
  // Build Top 3 podium
  const top3Html = buildTop3Podium(rows, nameIdx, pointsIdx);
  
  // Build table
  const tableHtml = buildTable(header, rows);
  
  container.innerHTML = `
    ${top3Html}
    <div class="table-wrap" role="region" aria-label="2026 Leaderboard table">
      ${tableHtml}
    </div>
  `;
  
  // Re-render status badge (it's inside the podium)
  renderStatusBadge();
}

// ---- Build Top 3 Podium ----
function buildTop3Podium(rows, nameIdx, pointsIdx) {
  const winners = rows.slice(0, 3);
  if (!winners.length) return '';
  
  const getName = (row) => formatNameTwoLines(row?.[nameIdx]);
  const getPoints = (row) => formatPointsLabel(row?.[pointsIdx]);
  
  const n1 = getName(winners[0]);
  const n2 = getName(winners[1]);
  const n3 = getName(winners[2]);
  
  const pts1 = getPoints(winners[0]);
  const pts2 = getPoints(winners[1]);
  const pts3 = getPoints(winners[2]);
  
  return `
    <div class="top3-podium" aria-label="Top 3 winners podium">
      <div class="top3-podium__inner">
        <div id="lbStatusBadge" class="lb-status-badge" style="display:none;"></div>
        
        ${buildAquarium()}
        
        <div class="top3-people">
          <div class="top3-person place2">
            <div class="top3-avatar"><img src="./assets/imgs/podium-2.png" alt="" /></div>
            <div class="top3-name">${n2}</div>
            <div class="top3-points">${pts2}</div>
          </div>
          
          <div class="top3-person place1">
            <div class="top3-crown">👑</div>
            <div class="top3-avatar"><img src="./assets/imgs/podium-1.png" alt="" /></div>
            <div class="top3-name">${n1}</div>
            <div class="top3-points">${pts1}</div>
          </div>
          
          <div class="top3-person place3">
            <div class="top3-avatar"><img src="./assets/imgs/podium-3.png" alt="" /></div>
            <div class="top3-name">${n3}</div>
            <div class="top3-points">${pts3}</div>
          </div>
        </div>
        
        <div class="top3-stands">
          <div class="top3-stand s2"><div class="num">2</div></div>
          <div class="top3-stand s1"><div class="num">1</div></div>
          <div class="top3-stand s3"><div class="num">3</div></div>
        </div>
      </div>
    </div>
  `;
}

// ---- Build Aquarium (fish & bubbles) ----
function buildAquarium() {
  return `
    <div class="top3-aqua" aria-hidden="true">
      <span class="aqua-fish" style="--d:8s; --y:65%; --del:0s; --s:.95; --flip:1">🐟</span>
      <span class="aqua-fish" style="--d:8s; --y:72%; --del:0.4s; --s:.85; --flip:1">🐠</span>
      <span class="aqua-fish" style="--d:11s; --y:28%; --del:2.5s; --s:1.25; --flip:0">🐠</span>
      <span class="aqua-fish" style="--d:9s; --y:50%; --del:5s; --s:.90; --flip:1">🐡</span>
      <span class="aqua-fish" style="--d:13s; --y:18%; --del:1s; --s:1.15; --flip:0">🐟</span>
      <span class="aqua-fish" style="--d:12s; --y:22%; --del:1.6s; --s:1.05; --flip:0">🐡</span>
      <span class="aqua-fish" style="--d:10s; --y:78%; --del:7s; --s:1.30; --flip:1">🐠</span>
      <span class="aqua-fish" style="--d:9s; --y:42%; --del:9s; --s:1.00; --flip:0">🐟</span>
      <span class="aqua-fish" style="--d:11s; --y:38%; --del:9.5s; --s:.88; --flip:0">🐠</span>
      <span class="aqua-fish" style="--d:7s; --y:920%; --del:3s; --s:.70; --flip:1">🐡</span>
      
      <span class="aqua-bubble" style="--d:4s; --x:8%; --sz:5px; --del:0s;"></span>
      <span class="aqua-bubble" style="--d:6s; --x:22%; --sz:8px; --del:1.5s;"></span>
      <span class="aqua-bubble" style="--d:5s; --x:45%; --sz:6px; --del:0.7s;"></span>
      <span class="aqua-bubble" style="--d:7s; --x:68%; --sz:9px; --del:2.8s;"></span>
      <span class="aqua-bubble" style="--d:4.5s; --x:85%; --sz:5px; --del:1s;"></span>
      <span class="aqua-bubble" style="--d:6.5s; --x:55%; --sz:7px; --del:3.5s;"></span>
      
      <span class="aqua-crab" id="aquaCrab" style="display:none;">🦀</span>
    </div>
  `;
}

// ---- Build Table ----
function buildTable(header, rows) {
  const thead = '<tr>' + header.map(h => 
    `<th>${escapeHtml(h)}</th>`
  ).join('') + '</tr>';
  
  const tbody = rows.map(row => 
    '<tr>' + header.map((_, i) => 
      `<td>${escapeHtml(row?.[i] ?? '')}</td>`
    ).join('') + '</tr>'
  ).join('');
  
  return `
    <table>
      <thead>${thead}</thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

// ---- Export state check ----
export function isLeaderboardLoaded() {
  return isLoaded;
}
