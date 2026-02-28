/* ============================================
   PFL App — Pull to Refresh
   iOS-style bounce effect (tighter / more controlled)
   ============================================ */

import { $ } from './utils.js';
import { getActiveTab } from './tabs.js';

// ---- Config ----
// NOTE:
// - THRESHOLD is compared against the *effective* pull distance (after resistance)
// - RESIST is the base resistance factor; additional non-linear resistance is applied as you pull further
const THRESHOLD = 160;     // px of effective pull to trigger refresh
const RESIST = 0.18;       // base resistance (smaller => “tighter”)
const MAX_PULL = 240;      // max effective pull (cap)
const CURVE = 220;         // non-linear resistance curve (smaller => gets “heavy” sooner)
const BOUNCE_FACTOR = 0.16; // how much content visually moves vs pull

// ---- State ----
let startY = 0;
let pulling = false;
let pull = 0; // effective pull distance (after resistance)

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
    content.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    content.style.transform = 'translateY(0)';
  }
}

// ---- Compute effective pull with non-linear resistance ----
function computePull(rawDy) {
  // rawDy is physical finger distance in px (positive only)
  // Non-linear resistance: grows “heavier” as rawDy increases.
  const effective = (rawDy * RESIST) / (1 + rawDy / CURVE);
  return Math.min(effective, MAX_PULL);
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
    pull = 0;
  }, { passive: true });

  // NOTE: non-passive so we can preventDefault() while pulling to avoid native overscroll fighting our bounce
  scroller.addEventListener('touchmove', (e) => {
    // If scrolled down, reset and exit
    if (scroller.scrollTop > 0) {
      if (pulling) {
        pulling = false;
        pull = 0;
        resetContentPosition();
      }
      return;
    }

    if (!pulling) return;

    const rawDy = e.touches[0].clientY - startY;

    // If pulling up, cancel and reset
    if (rawDy <= 0) {
      pulling = false;
      pull = 0;
      resetContentPosition();
      return;
    }

    // While pulling at top, stop native scroll/overscroll (makes it feel “tighter”)
    e.preventDefault();

    pull = computePull(rawDy);

    // Apply bounce effect to content (reduced for a “tighter” feel)
    const content = $('#app-content');
    if (content) {
      content.style.transform = `translateY(${pull * BOUNCE_FACTOR}px)`;
      content.style.transition = 'none';
    }
  }, { passive: false });

  scroller.addEventListener('touchend', () => {
    const reached = pull >= THRESHOLD;

    // Always reset state first (prevents double-trigger via document capture listener)
    pulling = false;

    // Always reset content position
    resetContentPosition();

    // Trigger refresh if threshold reached and tab supports it
    if (reached && canRefreshCurrentTab()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      } catch (e) {}

      const btn = getActiveReloadBtn();
      if (btn) btn.click();
    }

    pull = 0;
  }, { passive: true });

  // Also reset on touchcancel
  scroller.addEventListener('touchcancel', () => {
    pulling = false;
    pull = 0;
    resetContentPosition();
  }, { passive: true });

  // Global safety: reset if touch ends anywhere
  document.addEventListener('touchend', () => {
    if (!pulling) return;

    const reached = pull >= THRESHOLD;

    pulling = false;
    resetContentPosition();

    if (reached && canRefreshCurrentTab()) {
      try {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      } catch (e) {}

      const btn = getActiveReloadBtn();
      if (btn) btn.click();
    }

    pull = 0;
  }, { passive: true, capture: true });

  // Reset on visibility change (app goes to background)
  document.addEventListener('visibilitychange', () => {
    if (pulling) {
      pulling = false;
      pull = 0;
      resetContentPosition();
    }
  });

  // Reset on blur (window loses focus)
  window.addEventListener('blur', () => {
    if (pulling) {
      pulling = false;
      pull = 0;
      resetContentPosition();
    }
  });

  console.log('[PullToRefresh] Initialized');
}
