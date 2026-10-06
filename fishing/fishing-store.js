/* PFL Fishing — player's saved progress (v1.25).
 *
 * What is kept for the player, across launches and devices:
 *   bag      – every fish caught and not released (species + weight)
 *   records  – per species: heaviest fish (kg, date, lure) + how many caught in total
 *   lure     – the lure chosen in the lure box
 *
 * Where: Telegram CloudStorage (per Telegram account, Bot API 6.9+), so it
 * follows the player to another phone / Telegram Desktop. A copy is always
 * kept in localStorage: the game starts from it instantly, and outside
 * Telegram (or on old clients) it is the only storage.
 *
 * CloudStorage limits: value ≤ 4096 chars, 1024 keys. The bag is packed as
 * "<species code><grams in base 36>" joined by commas (~5 chars a fish) and
 * split into chunks of ≤ 4000 chars (keys pflf_bag0…pflf_bag9 → ~8000 fish).
 * pflf_bagmeta = { n: chunks, upd: ms } — the newer copy (cloud vs this
 * device) wins on start. Records merge (heaviest + biggest counter win).
 *
 * Nobody else sees this data, so it isn't verified anywhere.
 *
 * Load order: … fishing-lures.js → fishing-store.js → fishing-audio.js → fishing-view.js
 */
(function () {
  'use strict';

  const P = window.PFLFishing;
  const KEY = 'pflf_';                       // CloudStorage keys: [A-Za-z0-9_-], ≤ 128
  const LS = 'pfl.fishing.store.';           // localStorage copy
  const CHUNK = 4000;
  const MAX_CHUNKS = 10;
  const CLOUD_TIMEOUT_MS = 5000;
  const WRITE_DELAY_MS = 700;                // writes are batched (a few catches in a row → one write)

  const SP_CODE = { perch: 'p', zander: 'z', pike: 'h', catfish: 's', crab: 'c' };
  const CODE_SP = Object.fromEntries(Object.entries(SP_CODE).map(([k, v]) => [v, k]));

  // ---- bag <-> text -----------------------------------------------------------
  function encodeBag(bag) {
    return bag.filter((f) => SP_CODE[f.species] && f.kg > 0)
      .map((f) => SP_CODE[f.species] + Math.max(1, Math.round(f.kg * 1000)).toString(36))
      .join(',');
  }
  function decodeBag(text) {
    if (!text) return [];
    return text.split(',').map((t) => {
      const sp = CODE_SP[t[0]];
      const g = parseInt(t.slice(1), 36);
      return sp && g > 0 ? { species: sp, kg: g / 1000 } : null;
    }).filter(Boolean);
  }
  function splitChunks(text) {
    const out = [];
    for (let i = 0; i < text.length && out.length < MAX_CHUNKS; i += CHUNK) {
      let end = Math.min(text.length, i + CHUNK);
      if (end < text.length) end = text.lastIndexOf(',', end) + 1 || end;   // never split a fish
      out.push(text.slice(i, end).replace(/,$/, ''));
      i = end - CHUNK;
    }
    return out;
  }

  // ---- localStorage ---------------------------------------------------------------
  const lsGet = (k) => { try { return localStorage.getItem(LS + k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS + k, v); } catch (e) { /* full / private */ } };
  const parse = (s, d) => { try { const v = JSON.parse(s); return v ?? d; } catch (e) { return d; } };

  // ---- Telegram CloudStorage (callbacks → promises) -----------------------------------
  const tg = window.Telegram?.WebApp;
  const CS = (() => {
    try { return tg?.CloudStorage && tg.isVersionAtLeast?.('6.9') ? tg.CloudStorage : null; } catch (e) { return null; }
  })();
  function withTimeout(p) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), CLOUD_TIMEOUT_MS))]);
  }
  const csGet = (keys) => withTimeout(new Promise((res, rej) => {
    try { CS.getItems(keys, (err, vals) => (err ? rej(err) : res(vals || {}))); } catch (e) { rej(e); }
  }));
  const csSet = (k, v) => withTimeout(new Promise((res, rej) => {
    try { CS.setItem(k, v, (err, ok) => (err ? rej(err) : res(ok))); } catch (e) { rej(e); }
  }));
  const csDel = (keys) => withTimeout(new Promise((res, rej) => {
    try { CS.removeItems(keys, (err, ok) => (err ? rej(err) : res(ok))); } catch (e) { rej(e); }
  }));

  // ---- records ----------------------------------------------------------------------
  // { perch: { kg, at, lure: {lure,size,weight}, n }, … }
  function mergeRecords(a, b) {
    const out = {};
    new Set([...Object.keys(a || {}), ...Object.keys(b || {})]).forEach((sp) => {
      const x = a?.[sp], y = b?.[sp];
      if (!x || !y) { out[sp] = { ...(x || y) }; return; }
      const best = (y.kg || 0) > (x.kg || 0) ? y : x;
      out[sp] = { ...best, n: Math.max(x.n || 0, y.n || 0) };
    });
    return out;
  }

  function createFishingStore() {
    // this device's copy — available at once
    const st = {
      bag: decodeBag(lsGet('bag') || ''),
      bagUpd: Number(lsGet('bagUpd')) || 0,      // 0 = never saved on this device
      records: parse(lsGet('records'), {}),
      lure: parse(lsGet('lure'), null),
    };
    let cloudChunks = [];                       // what the cloud has now (to write only what changed)
    let writeTimer = 0;
    const dirty = new Set();

    function snapshot() {
      return { bag: st.bag.slice(), bagUpd: st.bagUpd, records: { ...st.records }, lure: st.lure && { ...st.lure } };
    }

    // ---- cloud → here (on start) ----
    async function sync() {
      if (!CS) return { snap: snapshot(), changed: false, backend: 'local' };
      let changed = false;
      try {
        const v = await csGet([KEY + 'bagmeta', KEY + 'records', KEY + 'lure']);
        const meta = parse(v[KEY + 'bagmeta'], null);
        // records: merge both ways
        const cloudRec = parse(v[KEY + 'records'], {});
        const merged = mergeRecords(st.records, cloudRec);
        if (JSON.stringify(merged) !== JSON.stringify(st.records)) { st.records = merged; lsSet('records', JSON.stringify(merged)); changed = true; }
        if (JSON.stringify(merged) !== JSON.stringify(cloudRec)) dirty.add('records');
        // lure: the newer choice wins
        const cloudLure = parse(v[KEY + 'lure'], null);
        if (cloudLure && (!st.lure || (cloudLure.t || 0) > (st.lure.t || 0))) { st.lure = cloudLure; lsSet('lure', JSON.stringify(cloudLure)); changed = true; }
        else if (st.lure && (!cloudLure || (st.lure.t || 0) > (cloudLure.t || 0))) dirty.add('lure');
        // bag: the newer copy wins
        if (meta && meta.n > 0) {
          const keys = Array.from({ length: Math.min(meta.n, MAX_CHUNKS) }, (_, i) => KEY + 'bag' + i);
          const parts = await csGet(keys);
          cloudChunks = keys.map((k) => parts[k] || '');
        } else cloudChunks = [];
        const cloudUpd = meta?.upd || 0;
        if (cloudUpd > st.bagUpd) {
          st.bag = decodeBag(cloudChunks.filter(Boolean).join(','));
          st.bagUpd = cloudUpd;
          lsSet('bag', encodeBag(st.bag)); lsSet('bagUpd', String(st.bagUpd));
          changed = true;
        } else if (st.bagUpd > cloudUpd) dirty.add('bag');
        if (dirty.size) scheduleWrite();
        return { snap: snapshot(), changed, backend: 'cloud' };
      } catch (e) {
        console.warn('[Fishing] CloudStorage not available, local only:', e?.message || e);
        return { snap: snapshot(), changed: false, backend: 'local' };
      }
    }

    // ---- here → cloud (batched) ----
    function scheduleWrite() {
      if (!CS) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(flush, WRITE_DELAY_MS);
    }
    async function flush() {
      clearTimeout(writeTimer);
      if (!CS || !dirty.size) return;
      const what = [...dirty];
      dirty.clear();
      try {
        if (what.includes('bag')) {
          const chunks = splitChunks(encodeBag(st.bag));
          const jobs = [];
          chunks.forEach((c, i) => { if (cloudChunks[i] !== c) jobs.push(csSet(KEY + 'bag' + i, c)); });
          await Promise.all(jobs);
          if (cloudChunks.length > chunks.length) {
            await csDel(Array.from({ length: cloudChunks.length - chunks.length }, (_, i) => KEY + 'bag' + (chunks.length + i)));
          }
          await csSet(KEY + 'bagmeta', JSON.stringify({ n: chunks.length, upd: st.bagUpd }));
          cloudChunks = chunks;
        }
        if (what.includes('records')) await csSet(KEY + 'records', JSON.stringify(st.records));
        if (what.includes('lure')) await csSet(KEY + 'lure', JSON.stringify(st.lure));
      } catch (e) {
        console.warn('[Fishing] CloudStorage write failed, will retry:', e?.message || e);
        what.forEach((w) => dirty.add(w));
        clearTimeout(writeTimer);
        writeTimer = setTimeout(flush, 5000);
      }
    }

    // ---- API ----
    function saveBag(bag) {
      st.bag = bag.map((f) => ({ species: f.species, kg: f.kg }));
      st.bagUpd = Date.now();
      lsSet('bag', encodeBag(st.bag));
      lsSet('bagUpd', String(st.bagUpd));
      dirty.add('bag');
      scheduleWrite();
    }
    function saveRecords(records) {
      st.records = { ...records };
      lsSet('records', JSON.stringify(st.records));
      dirty.add('records');
      scheduleWrite();
    }
    function saveLure(choice) {
      st.lure = { ...choice, t: Date.now() };
      lsSet('lure', JSON.stringify(st.lure));
      dirty.add('lure');
      scheduleWrite();
    }

    return {
      backend: CS ? 'cloud' : 'local',
      local: snapshot,         // this device's copy, at once
      sync,                    // → Promise<{ snap, changed, backend }>
      saveBag, saveRecords, saveLure,
      flush,                   // write now (on minimise)
    };
  }

  P.createFishingStore = createFishingStore;
  P._store = { encodeBag, decodeBag, splitChunks, mergeRecords };   // for tests
})();
