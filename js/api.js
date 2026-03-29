/* ============================================
   PFL App — API Module
   Fetch with caching, stale-while-revalidate
   ============================================ */

import CONFIG from './config.js';

// ---- Cache Version Management ----
let cacheVersion = 0;

function getCacheVersion() {
  try {
    const v = parseInt(localStorage.getItem(CONFIG.CACHE_VERSION_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

function bumpCacheVersion() {
  cacheVersion = (cacheVersion || 0) + 1;
  try {
    localStorage.setItem(CONFIG.CACHE_VERSION_KEY, String(cacheVersion));
  } catch (e) {}
  return cacheVersion;
}

cacheVersion = getCacheVersion();

// ---- Cache Helpers ----
// Stable key (no version) — version stored inside the cache entry
function makeCacheKey(url) {
  return `pfl_cache::${url}`;
}

function getFromCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || !obj.t || !obj.v) return null;

    const age = Date.now() - obj.t;
    const sameVersion = (obj.cv || 0) === cacheVersion;
    const withinTTL = age <= CONFIG.CACHE_TTL_MS;

    return {
      data: obj.v,
      fresh: sameVersion && withinTTL,
      age,
    };
  } catch (e) {
    return null;
  }
}

function setToCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({
      t: Date.now(),
      cv: cacheVersion,
      v: value,
    }));
  } catch (e) {
    console.warn('[Cache] Failed to save:', e.message);
  }
}

// ---- Network Fetch ----
async function fetchFromNetwork(url, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error('Час очікування вичерпано');
    throw error;
  }
}

// ---- Main Fetch: Stale-While-Revalidate ----
export async function fetchWithCache(url, { force = false, timeout = 15000 } = {}) {
  const cacheKey = makeCacheKey(url);
  const cached = getFromCache(cacheKey);

  // 1. Non-force + fresh cache → return immediately
  if (!force && cached?.fresh) {
    console.log('[API] Cache hit (fresh):', url.substring(0, 50) + '...');
    return cached.data;
  }

  // 2. Non-force + stale cache → return stale, revalidate in background
  if (!force && cached?.data) {
    console.log('[API] Cache hit (stale), revalidating:', url.substring(0, 50) + '...');

    fetchFromNetwork(url, timeout).then(json => {
      if (json?.ok === true) {
        setToCache(cacheKey, json);
        console.log('[API] Background revalidation done');
      }
    }).catch(() => {});

    return cached.data;
  }

  // 3. Force or no cache → fetch from network
  try {
    console.log('[API] Fetching:', url.substring(0, 50) + '...');
    const json = await fetchFromNetwork(url, timeout);

    if (json?.ok === true) {
      setToCache(cacheKey, json);
    }

    return json;
  } catch (error) {
    // 4. Network failed → fall back to stale cache
    if (cached?.data) {
      console.warn('[API] Network error, serving stale cache:', error.message);
      return cached.data;
    }

    throw error;
  }
}

// ---- Specialized Fetch Functions ----
export async function fetchSheetData(params, options = {}) {
  const url = new URL(CONFIG.API_URL);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return fetchWithCache(url.toString(), options);
}

export async function fetchLeaderboard(options = {}) {
  return fetchSheetData({
    sheetId: CONFIG.LEADERBOARD.SHEET_ID,
    sheetName: CONFIG.LEADERBOARD.RESULTS_SHEET,
    range: CONFIG.LEADERBOARD.RESULTS_RANGE,
  }, options);
}

export async function fetchLeaderboardConfig(options = {}) {
  return fetchSheetData({
    sheetId: CONFIG.LEADERBOARD.SHEET_ID,
    sheetName: CONFIG.LEADERBOARD.CONFIG_SHEET,
    range: CONFIG.LEADERBOARD.CONFIG_RANGE,
  }, options);
}

export async function fetchArenaConfig(options = {}) {
  return fetchSheetData({
    sheetId: CONFIG.ARENA.CONFIG_SHEET_ID,
    sheetName: CONFIG.ARENA.CONFIG_SHEET_NAME,
    range: CONFIG.ARENA.CONFIG_RANGE,
  }, options);
}

export async function fetchAppStyles(options = {}) {
  return fetchSheetData({
    sheetId: CONFIG.STYLES.SHEET_ID,
    sheetName: CONFIG.STYLES.SHEET_NAME,
    range: CONFIG.STYLES.RANGE,
  }, options);
}

// ---- Cache Management ----
export function clearCache() {
  bumpCacheVersion();
  console.log('[Cache] Version bumped to:', cacheVersion);
}

export function hasCachedData(url) {
  const cacheKey = makeCacheKey(url);
  return getFromCache(cacheKey) !== null;
}

// ---- Debug ----
export function getCacheStats() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('pfl_cache::'));
    return {
      version: cacheVersion,
      entries: keys.length,
    };
  } catch (e) {
    return { version: cacheVersion, entries: 0 };
  }
}
