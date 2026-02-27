/* ============================================
   PFL App — Fests Module
   Year switching, fest cards, data loading
   ============================================ */

import CONFIG from './config.js';
import { $, $$, escapeHtml, setButtonLoading, haptic, parseDividers } from './utils.js';
import { mountFests2026, resetFests2026 } from './fests2026.js';

// ---- Hardcoded Data 2025 ----
const DATA_2025 = {
  perchResults: [
    ['№', 'Учасник', 'Бали', 'Вага'],
    ['1', 'Тесля Андрій', '300', '2875'],
    ['2', 'Кірічек Віталій', '299', '2745'],
    ['3', 'Ющук Андрій', '298', '2475'],
    ['4', 'Козак Андрій', '297', '2430'],
    ['5', 'Солтис Юрій', '296', '2315'],
    ['6', 'Базилевич Іван', '295', '2295'],
    ['7', 'Курій Андрій', '294', '2105'],
    ['8', 'Ребрик Олександр', '293', '1980'],
    ['9', 'Гупка Володимир', '292', '1950'],
    ['10', 'Гринюк Роман', '291', '1865'],
    ['11', 'Івасюк Петро', '290', '1760'],
    ['12', 'Коваль Михайло', '289', '1705'],
    ['13', 'Лисенко Тарас', '288', '1640'],
    ['14', 'Мороз Олег', '287', '1555'],
    ['15', 'Шевченко Ігор', '286', '1485'],
    ['16', 'Бондар Сергій', '285', '1390'],
  ],
  perchTours: [
    ['№', 'Учасник', 'Т1', 'Т2', 'Т3', 'Т4', 'Т5', 'Сума', 'Вага'],
    ['1', 'Тесля Андрій', '60', '60', '60', '60', '60', '300', '2875'],
    ['2', 'Кірічек Віталій', '59', '60', '60', '60', '60', '299', '2745'],
    ['3', 'Ющук Андрій', '58', '60', '60', '60', '60', '298', '2475'],
    ['4', 'Козак Андрій', '57', '60', '60', '60', '60', '297', '2430'],
    ['5', 'Солтис Юрій', '56', '60', '60', '60', '60', '296', '2315'],
    ['6', 'Базилевич Іван', '55', '60', '60', '60', '60', '295', '2295'],
    ['7', 'Курій Андрій', '54', '60', '60', '60', '60', '294', '2105'],
    ['8', 'Ребрик Олександр', '53', '60', '60', '60', '60', '293', '1980'],
  ],
  predatorPersonal: [
    ['№', 'Учасник', 'Бали', 'Вага'],
    ['1', 'Кірічек Віталій', '300', '4520'],
    ['2', 'Тесля Андрій', '299', '4380'],
    ['3', 'Козак Андрій', '298', '4210'],
    ['4', 'Ющук Андрій', '297', '3985'],
    ['5', 'Солтис Юрій', '296', '3870'],
    ['6', 'Курій Андрій', '295', '3640'],
    ['7', 'Базилевич Іван', '294', '3520'],
    ['8', 'Гупка Володимир', '293', '3390'],
    ['9', 'Ребрик Олександр', '292', '3245'],
    ['10', 'Гринюк Роман', '291', '3120'],
  ],
  predatorTeam: [
    ['№', 'Команда', 'Бали', 'Вага'],
    ['1', 'Dream Team', '598', '8900'],
    ['2', 'Predators', '595', '8195'],
    ['3', 'Fish Masters', '591', '7505'],
    ['4', 'Lake Warriors', '587', '7160'],
    ['5', 'Pro Anglers', '583', '6765'],
  ],
  predator2: [
    ['№', 'Команда', 'Бали', 'Вага'],
    ['1', 'Fish Masters', '300', '5240'],
    ['2', 'Predators', '299', '5120'],
    ['3', 'Dream Team', '298', '4985'],
    ['4', 'Lake Warriors', '297', '4760'],
    ['5', 'Pro Anglers', '296', '4530'],
    ['6', 'Night Hunters', '295', '4280'],
  ],
};

// ---- State ----
let activeYear = '2025';

const cardStates = {
  perch: { isOpen: false, view: 'results' },
  predator: { isOpen: false, view: 'personal' },
  predator2: { isOpen: false },
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
      console.log('[Fests] Reload clicked, year:', activeYear);
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

  $$('.fests-year-tag').forEach(tag => {
    tag.classList.toggle('active', tag.dataset.year === year);
  });

  const panel2026 = $('#festsYear2026');
  const panel2025 = $('#festsYear2025');

  if (panel2026) panel2026.style.display = year === '2026' ? 'block' : 'none';
  if (panel2025) panel2025.style.display = year === '2025' ? 'block' : 'none';

  const subtitle = $('#subtitle-fests');
  if (subtitle) {
    subtitle.textContent = year === '2026' ? 'Фести 2026 року' : 'Актуальні результати';
  }

  if (year === '2026') {
    mountFests2026();
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
      // Simulate reload delay
      await new Promise(r => setTimeout(r, 500));
      
      // Re-render open cards
      if (cardStates.perch.isOpen) {
        renderPerchData();
      }
      if (cardStates.predator.isOpen) {
        renderPredatorData();
      }
      if (cardStates.predator2.isOpen) {
        renderPredator2Data();
      }
      
      if (subtitle) subtitle.textContent = 'Актуальні результати';
    } else {
      resetFests2026();
      await mountFests2026({ force: true });
      if (subtitle) subtitle.textContent = 'Фести 2026 року';
    }
  } catch (e) {
    console.error('[Fests] Reload error:', e);
    if (subtitle) subtitle.textContent = 'Помилка завантаження';
  } finally {
    setButtonLoading(reloadBtn, false);
  }
}

// ---- Load Fests Data ----
export async function loadFestsData({ force = false } = {}) {
  console.log('[Fests] Ready');
}

// ---- Perch Card ----
function setupPerchCard() {
  const header = $('#tableHeaderPerch');
  const segment = $('#segmentPerch');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.perch.isOpen = !cardStates.perch.isOpen;
    haptic('light');
    updatePerchView();
    
    if (cardStates.perch.isOpen) {
      renderPerchData();
    }
  });

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
        renderPerchData();
      });
    });
  }
}

function updatePerchView() {
  const chevron = $('#chevronPerch');
  const segment = $('#segmentPerch');
  const outResults = $('#outPerchResults');
  const outTours = $('#outPerchTours');
  
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

function renderPerchData() {
  const view = cardStates.perch.view;
  
  if (view === 'results') {
    const out = $('#outPerchResults');
    if (out) renderTableInto(DATA_2025.perchResults, out);
  } else {
    const out = $('#outPerchTours');
    if (out) renderTableInto(DATA_2025.perchTours, out);
  }
}

// ---- Predator Card ----
function setupPredatorCard() {
  const header = $('#tableHeaderPredator');
  const segment = $('#segmentPredator');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.predator.isOpen = !cardStates.predator.isOpen;
    haptic('light');
    updatePredatorView();
    
    if (cardStates.predator.isOpen) {
      renderPredatorData();
    }
  });

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
        renderPredatorData();
      });
    });
  }
}

function updatePredatorView() {
  const chevron = $('#chevronPredator');
  const segment = $('#segmentPredator');
  const outPersonal = $('#outPredatorPersonal');
  const outTeam = $('#outPredatorTeam');
  
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

function renderPredatorData() {
  const view = cardStates.predator.view;
  
  if (view === 'personal') {
    const out = $('#outPredatorPersonal');
    if (out) renderTableInto(DATA_2025.predatorPersonal, out);
  } else {
    const out = $('#outPredatorTeam');
    if (out) renderTableInto(DATA_2025.predatorTeam, out);
  }
}

// ---- Predator 2 Card ----
function setupPredator2Card() {
  const header = $('#tableHeaderPredator2');

  if (!header) return;

  header.addEventListener('click', () => {
    cardStates.predator2.isOpen = !cardStates.predator2.isOpen;
    haptic('light');
    
    const chevron = $('#chevronPredator2');
    const out = $('#outPredator2');
    
    chevron?.classList.toggle('open', cardStates.predator2.isOpen);
    out?.classList.toggle('table-collapsed', !cardStates.predator2.isOpen);

    if (cardStates.predator2.isOpen) {
      renderPredator2Data();
    }
  });
}

function renderPredator2Data() {
  const out = $('#outPredator2');
  if (out) renderTableInto(DATA_2025.predator2, out);
}

// ---- Render Table ----
function renderTableInto(values, targetEl, options = {}) {
  if (!Array.isArray(values) || values.length === 0) {
    targetEl.innerHTML = '<div class="loading-text">Немає даних</div>';
    return;
  }

  const header = values[0];
  let rows = values.slice(1);

  rows = rows.filter(r =>
    Array.isArray(r) && r.some(c => String(c ?? '').trim() !== '')
  );

  const thead = '<tr>' + header.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr>';

  const tbody = rows.map(r =>
    '<tr>' + (Array.isArray(r) ? r : []).map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>'
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
  return true;
}
