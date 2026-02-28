/* ============================================
   PFL App — Pull to Refresh
   iOS-style bounce effect
   ============================================ */

import { $ } from './utils.js';
import { getActiveTab } from './tabs.js';

// ---- Config ----
const THRESHOLD = 200;
const RESIST = 0.35;
const MAX_PULL = 120; // Maximum visual displacement

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

// ---- Reset content position ----
function resetContentPosition() {
  const content = $('#app-content');
  if (content) {
    content.style.transition = 'transform 0.35s cubic-bezier(0.4, 0.0, 0.2, 1)';
    content.style.transform = 'translateY(0)';
  }
}

// ---- Easing function for rubber band effect ----
function rubberBand(x, max) {
  // Attempt to move screen from 0 to max will end up at position 0.55 * max
  // Creates that iOS "rubber band" feel
  return max * (1 - Math.exp(-x / max / 0.55));
}

// ---- Initialize Pull to Refresh ----
export function initPullToRefresh() {
  const scroller = $('#app-wrap');
  if (!scroller) return;

  scroller.addEventListener('touchstart', (e) => {
    // Only start if at top of scroll
    if (scroller.scrollTop > 0) {
      pulling = false;
      return;
    }
    
    startY = e.touches[0].clientY;
    pulling = true;
    currentDy = 0;
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    // If scrolled down, reset and exit
    if (scroller.scrollTop > 0) {
      if (pulling) {
        pulling = false;
        currentDy = 0;
        resetContentPosition();
      }
      return;
    }
    
    if (!pulling) return;
    
    const dy = e.touches[0].clientY - startY;
    
    // If pulling up, cancel and reset
    if (dy <= 0) {
      pulling = false;
      currentDy = 0;
      resetContentPosition();
      return;
    }

    currentDy = dy;
    
    // Calculate bounce with rubber band easing
    const h = rubberBand(dy * RESIST, MAX_PULL);
    
    // Apply bounce effect to content
    const content = $('#app-content');
    if (content) {
      content.style.transform = `translateY(${h}px)`;
      content.style.transition = 'none';
    }
  }, { passive: true });

  scroller.addEventListener('touchend', () => {
    const dy = currentDy;
    
    // Always reset state
    pulling = false;
    currentDy = 0;
    
    // Always reset content position
    resetContentPosition();

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

  // Also reset on touchcancel
  scroller.addEventListener('touchcancel', () => {
    pulling = false;
    currentDy = 0;
    resetContentPosition();
  }, { passive: true });

  // Global safety: reset if touch ends anywhere
  document.addEventListener('touchend', () => {
    if (pulling) {
      const dy = currentDy;
      pulling = false;
      currentDy = 0;
      resetContentPosition();
      
      // Trigger refresh if threshold reached
      if (dy >= THRESHOLD && canRefreshCurrentTab()) {
        try {
          window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
        } catch(e) {}
        const btn = getActiveReloadBtn();
        if (btn) btn.click();
      }
    }
  }, { passive: true, capture: true });

  // Reset on visibility change (app goes to background)
  document.addEventListener('visibilitychange', () => {
    if (pulling) {
      pulling = false;
      currentDy = 0;
      resetContentPosition();
    }
  });

  // Reset on blur (window loses focus)
  window.addEventListener('blur', () => {
    if (pulling) {
      pulling = false;
      currentDy = 0;
      resetContentPosition();
    }
  });

  console.log('[PullToRefresh] Initialized');
}
