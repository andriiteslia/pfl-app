/* ============================================
   PFL App — Fests Module
   Year switching, fest cards, data loading
   ============================================ */

import CONFIG from './config.js';
import { fetchWithCache, fetchSheetData } from './api.js';
import { 
  $, $$, escapeHtml, setButtonLoading, haptic,
  parseDividers
} from './utils.js';

// ---- State ----
let activeYear = '2025';

// Card states
const cardStates = {
  perch: { isOpen: false, view: 'results', resultsLoaded: false, toursLoaded: false },
  predator: { isOpen: false, view: 'personal', personalLoaded: false, teamLoaded: false },
  predator2: { isOpen: false, loaded: false },
};

// ---- Initialize ----
export function initFests() {
  // Year tags
  $$('.fests-year-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const year = tag.dataset.year;
      if (year && year !== activeYear) {
        switchYear(year);
      }
    });
  });

  // Reload button
  const reloadBtn = $('#reload');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      haptic('light');
      reloadFests();
    });
  }

  // Setup card interactions
  setupPerchCard();
  setupPredatorCard();
  setupPredator2Card();

  console.log('[Fests] Initialized');
}

// ---- Switch Year ----
function switchYear(year) {
  activeYear = year;
  haptic('light');

  // Update tags
  $$('.fests-year-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.year === year);
  });

  // Show/hide year panels
  const panel2026 = $('#festsYear2026');
  const panel2025 = $('#festsYear2025');

  if (panel2026) panel2026.style.display = year === '2026' ? 'block' : 'none';
  if (panel2025) panel2025.style.display = year === '2025' ? 'block' : 'none';

  // Update subtitle
  const subtitle = $('#subtitle-fests');
  if (subtitle) {
    subtitle.textContent = year === '2026' 
      ? 'Фести 2026 року' 
      : 'Актуальні результати';
  }

  // Load 2026 data if needed
  if (year === '2026') {
    loadFests2026();
  }
}

// ---- Reload Fests ----
async function reloadFests() {
  const reloadBtn = $('#reload');
  const subtitle = $('#subtitle-fests');
  
  setButtonLoading(reloadBtn, true);
  if (subtitle) subtitle.textContent = 'Оновлюю дані…';

  try {
    if (activeYear === '2025') {
      // Reset loaded states
      cardStates.perch.resultsLoaded = false;
      cardStates.perch.toursLoaded = false;
      cardStates.predator.personalLoaded = false;
      cardStates.predator.teamLoaded = false;
      cardStates.predator2.loaded = false;

      // Reload open cards
      const jobs = [];
      if (cardStates.perch.isOpen) {
        if (cardStates.perch.view === 'results') jobs.push(loadPerchResults(true));
        else jobs.push(loadPerchTours(true));
      }
      if (cardStates.predator.isOpen) {
        if (cardStates.predator.view === 'personal') jobs.push(loadPredatorPersonal(true));
        else jobs.push(loadPredatorTeam(true));
      }
      if (cardStates.predator2.isOpen) {
        jobs.push(loadPredator2(true));
      }
      await Promise.all(jobs);
    } else {
      await loadFests2026(true);
    }

    if (subtitle) subtitle.textContent = 'Актуальні результати';
  } catch (e) {
    if (subtitle) subtitle.textContent = 'Помилка завантаження';
  } finally {
    setButtonLoading(reloadBtn, false);
  }
}

// ---- Load Fests Data (called on init) ----
export async function loadFestsData({ force = false } = {}) {
  // Nothing to load on init - data loads when cards are opened
  console.log('[Fests] Ready');
}

// ---- Perch Card ----
function setupPerchCard() {
  const header = $('#tableHeaderPerch');
  const chevron = $('#chevronPerch');
  const segment = $('#segmentPerch');
  const outResults = $('#outPerchResults');
  const outTours = $('#outPerchTours');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.perch.isOpen = !cardStates.perch.isOpen;
    haptic('light');
    updatePerchView();

    if (cardStates.perch.isOpen && !cardStates.perch.resultsLoaded) {
      loadPerchResults();
    }
  });

  // Segment buttons
  if (segment) {
    segment.querySelectorAll('.segment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = btn.dataset.view;
        if (view === cardStates.perch.view) return;

        cardStates.perch.view = view;
        haptic('light');

        segment.querySelectorAll('.segment').forEach(s => {
          s.classList.toggle('active', s.dataset.view === view);
        });

        updatePerchView();

        if (view === 'tours' && !cardStates.perch.toursLoaded) {
          loadPerchTours();
        }
      });
    });
  }

  function updatePerchView() {
    const isOpen = cardStates.perch.isOpen;
    const view = cardStates.perch.view;

    chevron?.classList.toggle('open', isOpen);
    if (segment) segment.style.display = isOpen ? 'flex' : 'none';

    if (!isOpen) {
      outResults?.classList.add('table-collapsed');
      outTours?.classList.add('table-collapsed');
      return;
    }

    if (view === 'tours') {
      outResults?.classList.add('table-collapsed');
      outTours?.classList.remove('table-collapsed');
    } else {
      outTours?.classList.add('table-collapsed');
      outResults?.classList.remove('table-collapsed');
    }
  }
}

async function loadPerchResults(force = false) {
  const out = $('#outPerchResults');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const data = await fetchWithCache(CONFIG.API_URL, { force });

    if (!data?.ok || !Array.isArray(data.values)) {
      out.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
      return;
    }

    renderTableInto(data.values, out);
    cardStates.perch.resultsLoaded = true;
  } catch (e) {
    out.innerHTML = '<div class="loading-text">Помилка завантаження.</div>';
  }
}

async function loadPerchTours(force = false) {
  const out = $('#outPerchTours');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const url = `${CONFIG.API_URL}?range=A1:I18`;
    const data = await fetchWithCache(url, { force });

    if (!data?.ok || !Array.isArray(data.values)) {
      out.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
      return;
    }

    renderTableInto(data.values, out);
    cardStates.perch.toursLoaded = true;
  } catch (e) {
    out.innerHTML = '<div class="loading-text">Помилка завантаження.</div>';
  }
}

// ---- Predator Card ----
function setupPredatorCard() {
  const header = $('#tableHeaderPredator');
  const chevron = $('#chevronPredator');
  const segment = $('#segmentPredator');
  const outPersonal = $('#outPredatorPersonal');
  const outTeam = $('#outPredatorTeam');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.predator.isOpen = !cardStates.predator.isOpen;
    haptic('light');
    updatePredatorView();

    if (cardStates.predator.isOpen && !cardStates.predator.personalLoaded) {
      loadPredatorPersonal();
    }
  });

  // Segment buttons
  if (segment) {
    segment.querySelectorAll('.segment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = btn.dataset.view;
        if (view === cardStates.predator.view) return;

        cardStates.predator.view = view;
        haptic('light');

        segment.querySelectorAll('.segment').forEach(s => {
          s.classList.toggle('active', s.dataset.view === view);
        });

        updatePredatorView();

        if (view === 'team' && !cardStates.predator.teamLoaded) {
          loadPredatorTeam();
        }
      });
    });
  }

  function updatePredatorView() {
    const isOpen = cardStates.predator.isOpen;
    const view = cardStates.predator.view;

    chevron?.classList.toggle('open', isOpen);
    if (segment) segment.style.display = isOpen ? 'flex' : 'none';

    if (!isOpen) {
      outPersonal?.classList.add('table-collapsed');
      outTeam?.classList.add('table-collapsed');
      return;
    }

    if (view === 'team') {
      outPersonal?.classList.add('table-collapsed');
      outTeam?.classList.remove('table-collapsed');
    } else {
      outTeam?.classList.add('table-collapsed');
      outPersonal?.classList.remove('table-collapsed');
    }
  }
}

async function loadPredatorPersonal(force = false) {
  const out = $('#outPredatorPersonal');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const data = await fetchSheetData({
      sheetId: CONFIG.FESTS_2025.PREDATOR_CUP.PERSONAL.SHEET_ID,
      sheetName: CONFIG.FESTS_2025.PREDATOR_CUP.PERSONAL.SHEET_NAME,
      range: CONFIG.FESTS_2025.PREDATOR_CUP.PERSONAL.RANGE,
    }, { force });

    if (!data?.ok || !Array.isArray(data.values)) {
      out.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
      return;
    }

    renderTableInto(data.values, out);
    cardStates.predator.personalLoaded = true;
  } catch (e) {
    out.innerHTML = '<div class="loading-text">Помилка завантаження.</div>';
  }
}

async function loadPredatorTeam(force = false) {
  const out = $('#outPredatorTeam');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const data = await fetchSheetData({
      sheetId: CONFIG.FESTS_2025.PREDATOR_CUP.TEAM.SHEET_ID,
      sheetName: CONFIG.FESTS_2025.PREDATOR_CUP.TEAM.SHEET_NAME,
      range: CONFIG.FESTS_2025.PREDATOR_CUP.TEAM.RANGE,
    }, { force });

    if (!data?.ok || !Array.isArray(data.values)) {
      out.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
      return;
    }

    renderTableInto(data.values, out);
    cardStates.predator.teamLoaded = true;
  } catch (e) {
    out.innerHTML = '<div class="loading-text">Помилка завантаження.</div>';
  }
}

// ---- Predator 2 Card ----
function setupPredator2Card() {
  const header = $('#tableHeaderPredator2');
  const chevron = $('#chevronPredator2');
  const out = $('#outPredator2');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.predator2.isOpen = !cardStates.predator2.isOpen;
    haptic('light');
    
    chevron?.classList.toggle('open', cardStates.predator2.isOpen);
    out?.classList.toggle('table-collapsed', !cardStates.predator2.isOpen);

    if (cardStates.predator2.isOpen && !cardStates.predator2.loaded) {
      loadPredator2();
    }
  });
}

async function loadPredator2(force = false) {
  const out = $('#outPredator2');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const data = await fetchSheetData({
      sheetId: CONFIG.FESTS_2025.PREDATOR_CUP.PERSONAL.SHEET_ID,
      sheetName: CONFIG.FESTS_2025.PREDATOR_CUP.PERSONAL.SHEET_NAME,
      range: 'O1:R18',
    }, { force });

    if (!data?.ok || !Array.isArray(data.values)) {
      out.innerHTML = '<div class="loading-text">Не вдалося завантажити дані.</div>';
      return;
    }

    renderTableInto(data.values, out);
    cardStates.predator2.loaded = true;
  } catch (e) {
    out.innerHTML = '<div class="loading-text">Помилка завантаження.</div>';
  }
}

// ---- Load Fests 2026 ----
async function loadFests2026(force = false) {
  const loader = $('#yearLoader2026Text');
  if (loader) {
    loader.textContent = 'Фести 2026 року з\'являться тут найближчим часом!';
  }
  // TODO: Implement CONFIG_2026 loading
}

// ---- Render Table ----
function renderTableInto(values, targetEl, options = {}) {
  if (!Array.isArray(values) || values.length === 0) {
    targetEl.innerHTML = '<div class="loading-text">Немає даних</div>';
    return;
  }

  const header = values[0];
  let rows = values.slice(1);

  // Filter empty rows
  rows = rows.filter(r =>
    Array.isArray(r) && r.some(c => String(c ?? '').trim() !== '')
  );

  const colCount = header.length;
  const dividerCols = parseDividers(options.dividers, colCount);
  const borderStyle = '1px solid var(--border)';

  const cellStyle = (colIdx) =>
    dividerCols.has(colIdx + 1) ? ` style="border-right:${borderStyle};"` : '';

  const thead = '<tr>' + header.map((h, i) =>
    `<th${cellStyle(i)}>${escapeHtml(h)}</th>`
  ).join('') + '</tr>';

  const tbody = rows.map(r =>
    '<tr>' + (Array.isArray(r) ? r : []).map((c, i) =>
      `<td${cellStyle(i)}>${escapeHtml(c)}</td>`
    ).join('') + '</tr>'
  ).join('');

  targetEl.innerHTML = `
    <div class="table-wrap" role="region" aria-label="Table">
      <table>
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}

// ---- Export ----
export function isFestsLoaded() {
  return true; // Fests loads on demand
}
