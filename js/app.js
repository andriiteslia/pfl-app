/* ============================================
   PFL App — Main Application
   Entry point, initialization
   ============================================ */

import CONFIG from './config.js';
import { initTabs, onTabActivate, getActiveTab } from './tabs.js';
import { initFests, loadFestsData, isFestsLoaded } from './fests.js';
import { initLeaderboard, loadLeaderboard, isLeaderboardLoaded } from './leaderboard.js';
import { initArena, loadArena, isArenaLoaded } from './arena.js';
import { fetchAppStyles } from './api.js';
import { $ } from './utils.js';

// ---- Theme Management ----
function initTheme() {
  try {
    // Check for theme override in localStorage
    const override = localStorage.getItem('theme_override');
    if (override === 'dark' || override === 'light') {
      document.documentElement.setAttribute('data-theme', override === 'dark' ? 'dark' : '');
      updateThemeToggleIcon();
      return;
    }
    
    // Check Telegram WebApp theme
    const tg = window.Telegram?.WebApp;
    if (tg?.colorScheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    updateThemeToggleIcon();
  } catch (e) {
    console.warn('[Theme] Error:', e);
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? 'dark' : '');
  
  try {
    localStorage.setItem('theme_override', newTheme);
  } catch (e) {}
  
  updateThemeToggleIcon();
  
  // Haptic feedback
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  } catch (e) {}
}

function updateThemeToggleIcon() {
  const btn = $('#themeToggle');
  if (!btn) return;
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
}

function initThemeToggle() {
  const btn = $('#themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }
}

// ---- Styles from Google Sheets ----
async function loadAppStylesFromSheet() {
  try {
    const data = await fetchAppStyles();
    
    if (!data?.ok || !Array.isArray(data.values) || data.values.length < 2) {
      return;
    }
    
    // Parse key/value rows
    const styles = {};
    data.values.slice(1).forEach(row => {
      const key = String(row[0] ?? '').trim().toLowerCase();
      const val = String(row[1] ?? '').trim();
      if (key && val) styles[key] = val;
    });
    
    // Load Google Fonts
    const fontsToLoad = new Set();
    if (styles.ui_font) fontsToLoad.add(styles.ui_font);
    if (styles.table_font) fontsToLoad.add(styles.table_font);
    
    fontsToLoad.forEach(fontName => {
      const id = `gf-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
      if (document.getElementById(id)) return;
      
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    });
    
    // Apply CSS variables
    const root = document.documentElement;
    const fallback = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    const normSize = (v) => v && /^\d+(\.\d+)?$/.test(v.trim()) ? v.trim() + 'px' : v;
    
    if (styles.ui_font) {
      root.style.setProperty('--font-ui', `"${styles.ui_font}", ${fallback}`);
    }
    if (styles.table_font) {
      root.style.setProperty('--font-table', `"${styles.table_font}", ${fallback}`);
    }
    if (styles.table_font_size) {
      root.style.setProperty('--table-font-size', normSize(styles.table_font_size));
    }
    if (styles.card_title_font_size) {
      root.style.setProperty('--card-title-font-size', normSize(styles.card_title_font_size));
    }
    
    console.log('[Styles] Applied:', styles);
  } catch (e) {
    console.warn('[Styles] Failed to load:', e);
  }
}

// ---- Telegram WebApp Integration ----
function initTelegram() {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    
    // Expand to full height
    tg.expand();
    
    // Update viewport height CSS variable
    const updateViewport = () => {
      const vh = tg.viewportStableHeight || window.innerHeight;
      document.documentElement.style.setProperty('--tg-viewport-height', `${vh}px`);
      document.documentElement.style.setProperty('--tg-viewport-stable-height', `${vh}px`);
    };
    
    updateViewport();
    tg.onEvent('viewportChanged', updateViewport);
    
    console.log('[Telegram] WebApp initialized');
  } catch (e) {
    console.warn('[Telegram] Not available:', e);
  }
}

// ---- Pull to Refresh ----
function initPullToRefresh() {
  const scroller = $('#app-wrap');
  if (!scroller) return;
  
  const THRESHOLD = 120;
  const RESIST = 0.4;
  
  let startY = 0;
  let pulling = false;
  let indicator = null;
  
  function createIndicator() {
    const el = document.createElement('div');
    el.className = 'ptr-indicator';
    el.innerHTML = `<div class="ptr-indicator__icon">↓</div>`;
    document.body.appendChild(el);
    return el;
  }
  
  function getActiveReloadBtn() {
    const tab = getActiveTab();
    if (tab === 'fests') return $('#reload');
    if (tab === 'leaderboard') return $('#reloadLeaderboard');
    if (tab === 'arena') return $('#reloadArena');
    return null;
  }
  
  scroller.addEventListener('touchstart', (e) => {
    if (scroller.scrollTop > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
    if (!indicator) indicator = createIndicator();
  }, { passive: true });
  
  scroller.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const dy = (e.touches[0].clientY - startY) * RESIST;
    if (dy <= 0) {
      pulling = false;
      return;
    }
    
    const h = Math.min(dy, THRESHOLD + 16);
    indicator.style.height = h + 'px';
    
    const icon = indicator.querySelector('.ptr-indicator__icon');
    const rotate = Math.min((dy / THRESHOLD) * 180, 180);
    icon.style.transform = `rotate(${rotate}deg)`;
  }, { passive: true });
  
  scroller.addEventListener('touchend', () => {
    if (!pulling || !indicator) return;
    pulling = false;
    
    const h = parseInt(indicator.style.height) || 0;
    indicator.style.height = '0';
    
    if (h >= THRESHOLD * RESIST) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      } catch (e) {}
      
      const btn = getActiveReloadBtn();
      if (btn) btn.click();
    }
  });
  
  console.log('[PTR] Pull-to-refresh initialized');
}

// ---- Tab Callbacks ----
function setupTabCallbacks() {
  onTabActivate('fests', () => {
    if (!isFestsLoaded()) {
      loadFestsData();
    }
  });

  onTabActivate('leaderboard', () => {
    if (!isLeaderboardLoaded()) {
      loadLeaderboard();
    }
  });

  onTabActivate('arena', () => {
    if (!isArenaLoaded()) {
      loadArena();
    }
  });
}

// ---- Main Init ----
async function init() {
  console.log('[PFL App] Starting...');
  
  // 1. Theme (already applied in head, but re-check)
  initTheme();
  initThemeToggle();
  
  // 2. Telegram integration
  initTelegram();
  
  // 3. Load styles from Google Sheets (async, non-blocking)
  loadAppStylesFromSheet();
  
  // 4. Initialize modules
  initTabs();
  initFests();
  initLeaderboard();
  initArena();
  
  // 5. Setup tab activation callbacks
  setupTabCallbacks();
  
  // 6. Pull to refresh
  initPullToRefresh();
  
  // 7. Load initial data for visible tab
  const activeTab = getActiveTab();
  if (activeTab === 'fests') {
    loadFestsData();
  } else if (activeTab === 'leaderboard') {
    loadLeaderboard();
  }
  
  console.log('[PFL App] Ready!');
}

// ---- Start ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
