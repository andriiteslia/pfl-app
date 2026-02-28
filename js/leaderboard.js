/* ============================================
   PFL App — Leaderboard Module
   Top 3 podium, rankings table
   Exact replication from index_old.html
   ============================================ */

import { fetchLeaderboard, fetchLeaderboardConfig } from './api.js';
import { 
  $, escapeHtml, setButtonLoading, formatNameTwoLines, 
  formatPointsLabel, haptic 
} from './utils.js';

// ---- State ----
let isLoaded = false;
let lbConfig = {};

// ---- Skeleton HTML (store initial HTML for reload) ----
let skeletonHtml = '';

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
  const { container, reloadBtn } = getElements();
  
  // Store skeleton HTML for reload
  if (container) {
    skeletonHtml = container.innerHTML;
  }
  
  if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
      haptic('light');
      
      // Show skeleton on reload
      if (container && skeletonHtml) {
        container.innerHTML = skeletonHtml;
      }
      
      await loadLeaderboard({ force: true });
    });
  }
  
  // Initialize crab easter eggs
  initCrabEasterEggs();
  
  console.log('[Leaderboard] Initialized');
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
    }
    
    // Render leaderboard
    if (!leaderboardData?.ok || !Array.isArray(leaderboardData.values)) {
      throw new Error('Invalid data');
    }
    
    renderLeaderboard(leaderboardData.values);
    
    // Apply status badge after rendering
    renderStatusBadge();
    
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

// ---- Points Label Helper (Ukrainian plural) ----
function ptsLabel(val) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return val ? `${val} балів` : '';
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let word;
  if (mod100 >= 11 && mod100 <= 19) word = 'балів';
  else if (mod10 === 1) word = 'бал';
  else if (mod10 >= 2 && mod10 <= 4) word = 'бали';
  else word = 'балів';
  return `${n} ${word}`;
}

// ---- Render Leaderboard ----
function renderLeaderboard(values) {
  const { container } = getElements();
  if (!container) return;
  
  const header = values[0];
  const rows = values.slice(1).filter(r => 
    Array.isArray(r) && r.some(c => String(c ?? '').trim() !== '')
  );
  
  // Find column indices
  const hLower = header.map(h => String(h ?? '').toLowerCase());
  let iName = hLower.findIndex(x => x.includes('ім') || x.includes('name'));
  let iPoints = hLower.findIndex(x => x.includes('бал') || x.includes('point'));
  
  // Fallback to default indices if not found
  if (iName === -1) iName = 1;
  if (iPoints === -1) iPoints = 2;
  
  // Build Top 3 podium
  const top3Html = buildTop3Podium(rows, iName, iPoints);
  
  // Build table header
  const thead = '<tr>' + header.map(h => 
    `<th>${escapeHtml(h)}</th>`
  ).join('') + '</tr>';
  
  // Build table body
  const tbody = rows.map(row => 
    '<tr>' + header.map((_, i) => 
      `<td>${escapeHtml(row?.[i] ?? '')}</td>`
    ).join('') + '</tr>'
  ).join('');
  
  container.innerHTML = `
    ${top3Html}
    <div class="table-wrap" role="region" aria-label="2026 Leaderboard table">
      <table>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
  
  // Re-render status badge (it's inside the podium)
  renderStatusBadge();
  
  // Re-initialize crab easter eggs after DOM update
  initCrabEasterEggs();
}

// ---- Build Top 3 Podium (exact from index_old.html) ----
function buildTop3Podium(rows, iName, iPoints) {
  const p1 = rows[0];
  const p2 = rows[1];
  const p3 = rows[2];
  
  if (!p1) return '';
  
  const n1 = formatNameTwoLines(p1?.[iName]);
  const n2 = formatNameTwoLines(p2?.[iName]);
  const n3 = formatNameTwoLines(p3?.[iName]);
  
  const pts1 = escapeHtml(String(p1?.[iPoints] ?? ''));
  const pts2 = escapeHtml(String(p2?.[iPoints] ?? ''));
  const pts3 = escapeHtml(String(p3?.[iPoints] ?? ''));
  
  return `
    <div class="top3-podium" aria-label="Top 3 winners podium">
      <div class="top3-podium__inner">
        <div id="lbStatusBadge" class="lb-status-badge" style="display:none;"></div>
        <div class="top3-aqua" aria-hidden="true">
          <span class="aqua-fish" style="--d:8s;  --y:65%; --del:0s;   --s:.95; --flip:1">🐟</span>
          <span class="aqua-fish" style="--d:8s;  --y:72%; --del:0.4s; --s:.85; --flip:1">🐠</span>
          <span class="aqua-fish" style="--d:11s; --y:28%; --del:2.5s; --s:1.25; --flip:0">🐠</span>
          <span class="aqua-fish" style="--d:9s;  --y:50%; --del:5s;   --s:.90; --flip:1">🐡</span>
          <span class="aqua-fish" style="--d:13s; --y:18%; --del:1s;   --s:1.15; --flip:0">🐟</span>
          <span class="aqua-fish" style="--d:12s; --y:22%; --del:1.6s; --s:1.05; --flip:0">🐡</span>
          <span class="aqua-fish" style="--d:10s; --y:78%; --del:7s;   --s:1.30; --flip:1">🐠</span>
          <span class="aqua-fish" style="--d:9s;  --y:42%; --del:9s;   --s:1.00; --flip:0">🐟</span>
          <span class="aqua-fish" style="--d:11s; --y:38%; --del:9.5s; --s:.88;  --flip:0">🐠</span>
          <span class="aqua-bubble" style="--d:4s;   --x:8%;  --sz:5px;  --del:0s;"></span>
          <span class="aqua-bubble" style="--d:6s;   --x:22%; --sz:8px;  --del:1.5s;"></span>
          <span class="aqua-bubble" style="--d:5s;   --x:45%; --sz:6px;  --del:0.7s;"></span>
          <span class="aqua-bubble" style="--d:7s;   --x:68%; --sz:9px;  --del:2.8s;"></span>
          <span class="aqua-bubble" style="--d:4.5s; --x:85%; --sz:5px;  --del:1s;"></span>
          <span class="aqua-bubble" style="--d:6.5s; --x:55%; --sz:7px;  --del:3.5s;"></span>
          <span class="aqua-crab" id="aquaCrab" style="display:none;">🦀</span>
        </div>
        <div class="top3-people">
          <div class="top3-person place2">
            <div class="top3-avatar" aria-hidden="true"><img src="./assets/imgs/podium-2.png" alt="" /></div>
            <div class="top3-name">${n2}</div>
            <div class="top3-points">${ptsLabel(pts2)}</div>
          </div>

          <div class="top3-person place1">
            <div class="top3-crown" aria-hidden="true">👑</div>
            <div class="top3-avatar" aria-hidden="true"><img src="./assets/imgs/podium-1.png" alt="" /></div>
            <div class="top3-name">${n1}</div>
            <div class="top3-points">${ptsLabel(pts1)}</div>
          </div>

          <div class="top3-person place3">
            <div class="top3-avatar" aria-hidden="true"><img src="./assets/imgs/podium-3.png" alt="" /></div>
            <div class="top3-name">${n3}</div>
            <div class="top3-points">${ptsLabel(pts3)}</div>
          </div>
        </div>

        <div class="top3-stands" aria-hidden="true">
          <div class="top3-stand s2"><div class="num">2</div></div>
          <div class="top3-stand s1"><div class="num">1</div></div>
          <div class="top3-stand s3"><div class="num">3</div></div>
        </div>
      </div>
    </div>
  `;
}

// ---- Crab Easter Eggs (from index_old.html) ----
function initCrabEasterEggs() {
  // 🦀 CRAB #1: Triple tap on crown
  initCrownCrab();
  
  // 🦀 CRAB #2: Long press on 2nd place avatar
  initPlace2Crab();
  
  // 🦀 CRAB #3: Walking crab at bottom
  initWalkingCrab();
}

// Crown tap counter
let crownTapCount = 0;
let crownTapTimer = null;
let crownLocked = false;

function initCrownCrab() {
  const crownEl = document.querySelector('.top3-crown');
  if (!crownEl || crownEl.dataset.crabCrown) return;
  
  crownEl.dataset.crabCrown = '1';
  crownEl.style.cursor = 'pointer';
  
  crownEl.addEventListener('click', () => {
    if (crownLocked) return;
    crownTapCount++;
    clearTimeout(crownTapTimer);
    crownTapTimer = setTimeout(() => { crownTapCount = 0; }, 600);
    
    if (crownTapCount >= 3) {
      crownTapCount = 0;
      crownLocked = true;
      crownEl.textContent = '🦀';
      crownEl.style.animation = 'none';
      void crownEl.offsetWidth;
      crownEl.style.animation = 'crownFloat 0.4s ease-in-out 3';
      
      try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy'); } catch(e){}
      
      setTimeout(() => {
        crownEl.textContent = '👑';
        crownEl.style.animation = '';
        crownLocked = false;
      }, 5000);
    }
  });
}

// 2nd place long press
let lpTimer = null;
let lpLocked = false;

function initPlace2Crab() {
  const person = document.querySelector('#tab-leaderboard .top3-person.place2');
  if (!person || person.dataset.crabPlace2) return;
  
  person.dataset.crabPlace2 = '1';
  const avatar = person.querySelector('.top3-avatar');
  if (!avatar) return;
  
  function startLP(e) {
    if (lpLocked) return;
    lpTimer = setTimeout(() => triggerCrab(person), 1500);
  }
  
  function cancelLP() { clearTimeout(lpTimer); }
  
  avatar.addEventListener('touchstart', startLP, { passive: true });
  avatar.addEventListener('touchend', cancelLP);
  avatar.addEventListener('touchmove', cancelLP);
  avatar.addEventListener('mousedown', startLP);
  avatar.addEventListener('mouseup', cancelLP);
  avatar.addEventListener('mouseleave', cancelLP);
}

function triggerCrab(person) {
  lpLocked = true;
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy'); } catch(e){}
  
  // Shake
  person.classList.add('shaking');
  person.addEventListener('animationend', function onShake() {
    person.removeEventListener('animationend', onShake);
    person.classList.remove('shaking');
  });
  
  // Crab popup
  let crab = person.querySelector('.crab-popup');
  if (!crab) {
    crab = document.createElement('div');
    crab.className = 'crab-popup';
    crab.textContent = '🦀';
    person.appendChild(crab);
  }
  crab.style.animation = 'crabPopIn .6s cubic-bezier(.34,1.56,.64,1) forwards';
  
  setTimeout(() => {
    crab.style.animation = 'crabPopOut .4s ease-in forwards';
    setTimeout(() => { lpLocked = false; }, 500);
  }, 5000);
}

// Walking crab
let crabTimer = null;
let crabDir = 1;

function initWalkingCrab() {
  const el = document.getElementById('aquaCrab');
  if (!el || el.dataset.crabInit) return;
  
  el.dataset.crabInit = '1';
  el.style.display = 'none';
  
  // First appearance after 30s
  crabTimer = setTimeout(() => runCrab(el), 30000);
}

function runCrab(el) {
  el.style.display = 'block';
  
  // Reset any previous animation state
  el.style.animation = 'none';
  el.style.left = '';
  el.style.right = '';
  void el.offsetWidth;
  
  if (crabDir === 1) {
    // left → right
    el.style.transform = 'scaleX(-1)';
    el.style.left = '-32px';
    el.style.right = '';
    el.style.animation = 'crabWalkRight 4s linear forwards';
  } else {
    // right → left
    el.style.transform = 'scaleX(1)';
    el.style.right = '-32px';
    el.style.left = '';
    el.style.animation = 'crabWalkLeft 4s linear forwards';
  }
  
  // After walk finishes, hide and schedule next run
  el.addEventListener('animationend', function onEnd() {
    el.removeEventListener('animationend', onEnd);
    el.style.display = 'none';
    el.style.animation = 'none';
    crabDir *= -1;
    crabTimer = setTimeout(() => runCrab(el), 30000);
  });
}

// ---- Export state check ----
export function isLeaderboardLoaded() {
  return isLoaded;
}
