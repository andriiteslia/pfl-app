/* ============================================
   PFL App — Pull to Refresh
   iOS-style bounce effect (top & bottom)
   ============================================ */

import { $ } from './utils.js';
import { getActiveTab } from './tabs.js';

// ---- Config ----
const THRESHOLD = 160;
const RESIST = 0.35;
const MAX_PULL = 100; // Maximum visual displacement

// ---- State ----
let startY = 0;
let pulling = false;
let pullingBottom = false;
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

// ---- Check if scroller is at bottom ----
function isAtBottom(scroller) {
  const tolerance = 2; // Small tolerance for rounding errors
  return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - tolerance;
}

// ---- Initialize Pull to Refresh ----
export function initPullToRefresh() {
  const scroller = $('#app-wrap');
  if (!scroller) return;

  scroller.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentDy = 0;
    
    // Check if at top or bottom
    if (scroller.scrollTop <= 0) {
      pulling = true;
      pullingBottom = false;
    } else if (isAtBottom(scroller)) {
      pullingBottom = true;
      pulling = false;
    } else {
      pulling = false;
      pullingBottom = false;
    }
  }, { passive: true });

  scroller.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - startY;
    
    // ---- TOP BOUNCE (pull down) ----
    if (pulling && scroller.scrollTop <= 0) {
      // If pulling up while at top, cancel
      if (dy <= 0) {
        pulling = false;
        currentDy = 0;
        resetContentPosition();
        return;
      }

      // Prevent native overscroll
      e.preventDefault();

      currentDy = dy;
      
      // Calculate bounce with rubber band easing
      const h = rubberBand(dy * RESIST, MAX_PULL);
      
      // Apply bounce effect to content
      const content = $('#app-content');
      if (content) {
        content.style.transform = `translateY(${h}px)`;
        content.style.transition = 'none';
      }
      return;
    }
    
    // ---- BOTTOM BOUNCE (pull up) ----
    if (pullingBottom && isAtBottom(scroller)) {
      // If pulling down while at bottom, cancel
      if (dy >= 0) {
        pullingBottom = false;
        currentDy = 0;
        resetContentPosition();
        return;
      }

      // Prevent native overscroll
      e.preventDefault();

      currentDy = dy;
      
      // Calculate bounce with rubber band easing (negative direction)
      const h = -rubberBand(Math.abs(dy) * RESIST, MAX_PULL);
      
      // Apply bounce effect to content
      const content = $('#app-content');
      if (content) {
        content.style.transform = `translateY(${h}px)`;
        content.style.transition = 'none';
      }
      return;
    }
    
    // ---- SCROLLING IN MIDDLE ----
    // If we were pulling but now scrolled away, reset
    if (pulling && scroller.scrollTop > 0) {
      pulling = false;
      currentDy = 0;
      resetContentPosition();
    }
    if (pullingBottom && !isAtBottom(scroller)) {
      pullingBottom = false;
      currentDy = 0;
      resetContentPosition();
    }
  }, { passive: false });

  scroller.addEventListener('touchend', () => {
    const dy = currentDy;
    const wasPullingTop = pulling;
    
    // Always reset state
    pulling = false;
    pullingBottom = false;
    currentDy = 0;
    
    // Always reset content position
    resetContentPosition();

    // Trigger refresh only for top pull if dy >= THRESHOLD and tab supports it
    if (wasPullingTop && dy >= THRESHOLD && canRefreshCurrentTab()) {
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
    pullingBottom = false;
    currentDy = 0;
    resetContentPosition();
  }, { passive: true });

  // Global safety: reset if touch ends anywhere
  document.addEventListener('touchend', () => {
    if (pulling || pullingBottom) {
      const dy = currentDy;
      const wasPullingTop = pulling;
      pulling = false;
      pullingBottom = false;
      currentDy = 0;
      resetContentPosition();
      
      // Trigger refresh if threshold reached (only for top pull)
      if (wasPullingTop && dy >= THRESHOLD && canRefreshCurrentTab()) {
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
    if (pulling || pullingBottom) {
      pulling = false;
      pullingBottom = false;
      currentDy = 0;
      resetContentPosition();
    }
  });

  // Reset on blur (window loses focus)
  window.addEventListener('blur', () => {
    if (pulling || pullingBottom) {
      pulling = false;
      pullingBottom = false;
      currentDy = 0;
      resetContentPosition();
    }
  });

  console.log('[PullToRefresh] Initialized (top & bottom bounce)');
}
