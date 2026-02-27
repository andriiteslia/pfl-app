/* ============================================
   PFL App — Fests Module
   Year switching, fest cards, data loading
   ============================================ */

import CONFIG from './config.js';
import { fetchWithCache, fetchSheetData } from './api.js';
import { 
  $, $$, escapeHtml, setButtonLoading, haptic,
  normBool, normStr, parseDividers
} from './utils.js';

// ---- State ----
let activeYear = '2026';
let festsLoadedOnce = false;
let perchToursLoadedOnce = false;

// Card collapse states
const cardStates = {
  perchCup: { isOpen: false, view: 'results' },
  perchCupR1: { isOpen: false, view: 'results' },
  predatorCup: { isOpen: false, view: 'personal' },
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
      loadFestsData({ force: true });
    });
  }

  // Setup 2025 card interactions
  setupPerchCupCard();
  setupPredatorCupCard();

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

  // Load data if needed
  if (year === '2025' && !perchToursLoadedOnce) {
    // Data loads on card expand
  }
}

// ---- Load Fests Data ----
export async function loadFestsData({ force = false } = {}) {
  const subtitle = $('#subtitle-fests');
  const reloadBtn = $('#reload');
  const loader = $('#yearLoader2026Text');

  setButtonLoading(reloadBtn, true);

  if (subtitle) subtitle.textContent = 'Оновлюю дані…';

  try {
    // For now, just show that it's loaded
    // TODO: Implement 2026 fests loading from config
    
    if (loader) {
      loader.textContent = 'Фести 2026 року з\'являться тут найближчим часом!';
    }

    if (subtitle) subtitle.textContent = 'Актуальні результати';
    festsLoadedOnce = true;

  } catch (error) {
    console.error('[Fests] Load error:', error);
    if (subtitle) subtitle.textContent = 'Помилка завантаження';
  } finally {
    setButtonLoading(reloadBtn, false);
  }
}

// ---- Setup Perch Cup Card (2025) ----
function setupPerchCupCard() {
  const header = $('#tableHeader');
  const chevron = $('#tableChevron');
  const segment = $('#perchSegment');
  const outResults = $('#out');
  const outTours = $('#outTours');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.perchCup.isOpen = !cardStates.perchCup.isOpen;
    haptic('light');
    updatePerchCupView();

    // Load data on first open
    if (cardStates.perchCup.isOpen && !festsLoadedOnce) {
      loadPerchCupResults();
    }
  });

  // Segment buttons
  if (segment) {
    segment.querySelectorAll('.segment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const view = btn.dataset.view;
        if (view === cardStates.perchCup.view) return;

        cardStates.perchCup.view = view;
        haptic('light');

        segment.querySelectorAll('.segment').forEach(s => {
          s.classList.toggle('active', s.dataset.view === view);
        });

        updatePerchCupView();

        // Load tours if needed
        if (view === 'tours' && !perchToursLoadedOnce) {
          loadPerchCupTours();
        }
      });
    });
  }

  function updatePerchCupView() {
    const isOpen = cardStates.perchCup.isOpen;
    const view = cardStates.perchCup.view;

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

// ---- Load Perch Cup Results ----
async function loadPerchCupResults() {
  const out = $('#out');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const data = await fetchWithCache(CONFIG.API_URL);

    if (!data?.ok || !Array.isArray(data.values)) {
      out.textContent = 'Не вдалося завантажити дані.';
      return;
    }

    renderTableInto(data.values, out);
    festsLoadedOnce = true;
  } catch (e) {
    out.textContent = 'Помилка завантаження.';
  }
}

// ---- Load Perch Cup Tours ----
async function loadPerchCupTours() {
  const out = $('#outTours');
  if (!out) return;

  out.innerHTML = '<div class="loading-text">Завантажую дані…</div>';

  try {
    const params = { range: 'A1:I18' };
    const url = `${CONFIG.API_URL}?range=${params.range}`;
    const data = await fetchWithCache(url);

    if (!data?.ok || !Array.isArray(data.values)) {
      out.textContent = 'Не вдалося завантажити дані.';
      return;
    }

    renderTableInto(data.values, out);
    perchToursLoadedOnce = true;
  } catch (e) {
    out.textContent = 'Помилка завантаження.';
  }
}

// ---- Setup Predator Cup Card (2025) ----
function setupPredatorCupCard() {
  // TODO: Implement Predator Cup card if needed
}

// ---- Render Table ----
function renderTableInto(values, targetEl, options = {}) {
  if (!Array.isArray(values) || values.length === 0) {
    targetEl.textContent = 'Немає даних';
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
  return festsLoadedOnce;
}
