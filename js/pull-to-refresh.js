/* ============================================
   PFL App — Pull to Refresh
   iOS-style bounce effect
   ============================================ */

import { $ } from './utils.js';
import { getActiveTab } from './tabs.js';

// ---- Config ----
const THRESHOLD = 200;
const RESIST = 0.22;
const MAX_PULL = 240;

// ---- State ----
let startY = 0;
let pulling = false;
let currentDy = 0;

// ---- Get Reload Button for Current Tab ----
function getActiveReloadBtn() {
  const tab = getActiveTab();
  if (tab === 'fests') return $('#reload');
  if (tab === 'leaderboard') return $('#reloadLeaderboard');
  if (tab === 'arena') return $('#reloadArena');
  return null;
}

// ---- Check if tab supports refresh ----
function canRefreshCurrentTab() {
  const tab = getActiveTab();
  // Partners tab has no refresh
  if (tab === 'partners') return false;
  return true;
}

// ---- Initialize Pull to Refresh ----
export function initPullToRefresh() {
  const scroller = $('#app-wrap');
  if (!scroller) return;

  scroller.addEventListener('touchstart', (e) => {
    // Only start if at top of scroll
    if (scroller.scrollTop > 0) return;
    
    startY = e.touches[0].clientY;
    pulling = true;
    currentDy = 0;
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    
    const dy = e.touches[0].clientY - startY;
    
    // If pulling up, cancel
    if (dy <= 0) {
      pulling = false;
      currentDy = 0;
      return;
    }

    currentDy = dy;
    
    // Calculate bounce height with resistance
    const h = Math.min(dy * RESIST, MAX_PULL * RESIST);
    
    // Apply bounce effect to content
    const content = $('#app-content');
    if (content) {
      content.style.transform = `translateY(${h}px)`;
      content.style.transition = 'none';
    }
  }, { passive: true });

  scroller.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;

    const dy = currentDy;
    currentDy = 0;
    
    // Reset content position with bounce
    const content = $('#app-content');
    if (content) {
      content.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      content.style.transform = 'translateY(0)';
    }

    // Trigger refresh if dy >= THRESHOLD and tab supports it
    if (dy >= THRESHOLD && canRefreshCurrentTab()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      } catch(e) {}
      
      const btn = getActiveReloadBtn();
      if (btn) {
        btn.click();
      }
    }
  }, { passive: true });

  console.log('[PullToRefresh] Initialized');
}
