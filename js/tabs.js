/* ============================================
   PFL App — Tabs Module
   Tab switching logic, animations
   ============================================ */

import { $, $$, haptic } from './utils.js';
import CONFIG from './config.js';

// ---- State ----
let activeTab = CONFIG.UI.DEFAULT_TAB;
let previousTab = null;
const tabOrder = ['fests', 'leaderboard', 'partners', 'arena'];

// Callbacks for tab activation
const tabCallbacks = new Map();

// ---- Initialize ----
export function initTabs() {
  const tabButtons = $$('.tab-btn');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      if (tabKey && tabKey !== activeTab) {
        switchTab(tabKey);
      }
    });
  });
  
  // Set initial active tab
  updateTabUI(activeTab);
  
  console.log('[Tabs] Initialized');
}

// ---- Switch Tab ----
export function switchTab(tabKey) {
  if (tabKey === activeTab) return;
  
  previousTab = activeTab;
  activeTab = tabKey;
  
  // Haptic feedback
  haptic('light');
  
  // Reset scroll to top
  const scroller = document.getElementById('app-wrap');
  if (scroller) scroller.scrollTop = 0;
  
  // Update UI
  updateTabUI(tabKey);
  
  // Call registered callback
  const callback = tabCallbacks.get(tabKey);
  if (callback) {
    callback();
  }
  
  // Store active tab globally for pull-to-refresh
  window.__activeTabKey = tabKey;
  
  console.log('[Tabs] Switched to:', tabKey);
}

// ---- Update UI ----
function updateTabUI(tabKey) {
  // Update buttons
  $$('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabKey);
  });
  
  // Update content panels
  const prevIndex = tabOrder.indexOf(previousTab);
  const currentIndex = tabOrder.indexOf(tabKey);
  const direction = currentIndex > prevIndex ? 'right' : 'left';
  
  $$('.tab-content').forEach(panel => {
    const isActive = panel.id === `tab-${tabKey}`;
    
    if (isActive) {
      panel.classList.add('active');
      panel.classList.remove('slide-left', 'slide-right');
      panel.classList.add(`slide-${direction}`);
    } else {
      panel.classList.remove('active', 'slide-left', 'slide-right');
    }
  });
}

// ---- Register Callback ----
export function onTabActivate(tabKey, callback) {
  tabCallbacks.set(tabKey, callback);
}

// ---- Getters ----
export function getActiveTab() {
  return activeTab;
}

export function getPreviousTab() {
  return previousTab;
}

// ---- Expose globally for pull-to-refresh ----
window.__activeTabKey = activeTab;
