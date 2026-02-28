/* ============================================
   PFL App — Pull to Refresh
   iOS-style bounce + pull indicator
   ============================================ */

import { $ } from './utils.js';
import { getActiveTab } from './tabs.js';

// ---- Config ----
const THRESHOLD = 160;
const RESIST = 0.22;
const MAX_PULL = 240;

// ---- State ----
let startY = 0;
let pulling = false;
let indicator = null;
let currentDy = 0;

// ---- Create Indicator ----
function createIndicator() {
  const el = document.createElement('div');
  el.id = 'ptrIndicator';
  el.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 0;
    overflow: hidden;
    z-index: 1000;
    transition: height 0.2s ease;
    pointer-events: none;
  `;
  el.innerHTML = `<div style="
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--card);
    box-shadow: var(--shadow);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
    transition: transform 0.2s ease;
  ">↓</div>`;
  document.body.appendChild(el);
  return el;
}

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
    
    if (!indicator) {
      indicator = createIndicator();
    }
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

    // Check if this tab can refresh
    const canRefresh = canRefreshCurrentTab();
    
    // Calculate indicator height with resistance
    const h = Math.min(dy * RESIST, MAX_PULL * RESIST);
    
    if (indicator) {
      indicator.style.height = h + 'px';
      
      // Rotate arrow based on progress
      const icon = indicator.querySelector('div');
      if (icon) {
        const progress = Math.min(dy / THRESHOLD, 1);
        const rotate = progress * 180;
        icon.style.transform = `rotate(${rotate}deg)`;
        
        // Change color when threshold reached
        if (canRefresh && dy >= THRESHOLD) {
          icon.style.background = 'var(--brand)';
          icon.style.color = '#fff';
        } else {
          icon.style.background = 'var(--card)';
          icon.style.color = 'inherit';
        }
      }
    }
    
    // Apply bounce effect to content
    const content = $('#app-content');
    if (content) {
      content.style.transform = `translateY(${h * 0.5}px)`;
      content.style.transition = 'none';
    }
  }, { passive: true });

  scroller.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;

    const dy = currentDy;
    currentDy = 0;
    
    // Reset indicator
    if (indicator) {
      indicator.style.height = '0';
      const icon = indicator.querySelector('div');
      if (icon) {
        icon.style.background = 'var(--card)';
        icon.style.color = 'inherit';
      }
    }
    
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
