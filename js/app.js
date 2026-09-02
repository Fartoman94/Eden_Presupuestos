/**
 * Arranque de Eden Presupuestos.
 * Une la fuente única de verdad (`budget`) con el documento editable, el
 * autoguardado y las acciones de la barra superior.
 */

import { createAutosave, createDefaultBudget, loadBudget, normalizeBudget } from './state.js';
import { createBudgetDocument, fitToPage } from './document.js';
import { createConditionToolbar } from './toolbar.js';
import { markError, clearErrors, blurActiveEditable } from './editable.js';
import { validateBudget } from './validation.js';
import { attachPrintFallback, exportPDF, printDocument } from './pdf.js';
import { initHistory } from './history.js';
import { initLoveMessage } from './love.js';
import { initPWA } from './pwa.js';
import { shareBudget } from './share.js';
import {
  closeDialog,
  confirmDialog,
  createMenu,
  createSaveIndicator,
  enableBackdropClose,
  toast
} from './ui.js';

const THEME_KEY = 'eden_tema_color';
const HINT_KEY = 'eden_hint_edicion_v3';

const sheet = document.getElementById('docSheet');
const overlay = document.getElementById('loadingOverlay');

let budget = loadBudget();

const setSaveState = createSaveIndicator(document.getElementById('saveStatus'));
const autosave = createAutosave(() => budget, setSaveState);

const doc = createBudgetDocument({
  root: sheet,
  getBudget: () => budget,
  onChange: handleChange
});

createConditionToolbar({ actions: doc.conditionActions });

/* ------------------------------------------------------------------ */
/* Ciclo de actualización                                              */
/* ------------------------------------------------------------------ */

let refreshQueued = false;
let fitTimer = null;

function scheduleFit() {
  if (fitTimer) clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    fitTimer = null;
    fitToPage(sheet);
  }, 140);
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    doc.refresh();
    scheduleFit();
  });
}

function handleChange() {
  autosave.schedule();
  scheduleRefresh();
  dismissHint();
}

function renderAll() {
  doc.render();
  clearErrors(sheet);
  requestAnimationFrame(() => fitToPage(sheet));
}

/* ------------------------------------------------------------------ */
/* Acciones principales                                                */
/* ------------------------------------------------------------------ */

async function newBudget() {
  const ok = await confirmDialog({
    title: 'Crear nuevo presupuesto',
    message: 'Los datos del presupuesto actual serán reemplazados.',
    confirmText: 'Crear nuevo presupuesto',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;
  budget = createDefaultBudget();
  renderAll();
  autosave.flush();
  toast('Nuevo presupuesto listo', 'success');
}

function loadBudgetData(data) {
  budget = normalizeBudget(data);
  renderAll();
  autosave.flush();
}

function checkBeforeExport() {
  const problems = validateBudget(budget);
  clearErrors(sheet);
  if (!problems.length) return true;

  const first = markError(sheet, problems.map((p) => p.field));
  toast(problems[0].message, 'error', 5200);
  if (first) {
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => first.focus(), 380);
  }
  return false;
}

async function downloadPDF() {
  blurActiveEditable();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!checkBeforeExport()) return;

  autosave.flush();
  overlay.hidden = false;
  try {
    const hojas = await exportPDF(sheet, budget);
    toast(hojas > 1 ? `PDF descargado (${hojas} hojas A4)` : 'PDF descargado', 'success');
  } catch (err) {
    console.error('No se pudo generar el PDF', err);
    toast('No se pudo generar el PDF, probá con Imprimir', 'error', 5000);
  } finally {
    overlay.hidden = true;
  }
}

function print() {
  blurActiveEditable();
  if (!checkBeforeExport()) return;
  printDocument(sheet);
}

/* ------------------------------------------------------------------ */
/* Barra superior y menú                                               */
/* ------------------------------------------------------------------ */

document.getElementById('btnNew').addEventListener('click', newBudget);
document.getElementById('btnPdf').addEventListener('click', downloadPDF);

createMenu(document.getElementById('btnMenu'), document.getElementById('appMenu'));

const history = initHistory({
  getBudget: () => budget,
  onLoad: loadBudgetData
});

document.getElementById('menuHistory').addEventListener('click', () => history.open());
document.getElementById('menuShare').addEventListener('click', () => shareBudget(budget));
document.getElementById('menuPrint').addEventListener('click', print);

const menuCurrency = document.getElementById('menuCurrency');
function syncCurrencyLabel() {
  menuCurrency.querySelector('.menu-value').textContent =
    budget.moneda === 'USD' ? 'Dólares (USD)' : 'Pesos ($)';
}
menuCurrency.addEventListener('click', () => {
  budget.moneda = budget.moneda === 'USD' ? '$' : 'USD';
  syncCurrencyLabel();
  handleChange();
  toast(`Moneda: ${budget.moneda === 'USD' ? 'dólares' : 'pesos'}`, 'info', 2000);
});

const menuTheme = document.getElementById('menuTheme');
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  menuTheme.querySelector('.menu-value').textContent = theme === 'oscuro' ? 'Oscuro' : 'Claro';
  try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* sin storage */ }
}
menuTheme.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'oscuro' ? 'claro' : 'oscuro');
});

const love = initLoveMessage();
document.getElementById('menuLove').addEventListener('click', () => love.show());

initPWA({ installButton: document.getElementById('menuInstall') });

document.querySelectorAll('dialog').forEach(enableBackdropClose);

/* ------------------------------------------------------------------ */
/* Ayuda de primera vez                                                */
/* ------------------------------------------------------------------ */

const hint = document.getElementById('editHint');

function dismissHint(persist = true) {
  if (hint.hidden) return;
  hint.hidden = true;
  if (persist) {
    try { localStorage.setItem(HINT_KEY, '1'); } catch (err) { /* sin storage */ }
  }
}

hint.querySelector('[data-role="close"]').addEventListener('click', () => dismissHint());

let seenHint = true;
try { seenHint = localStorage.getItem(HINT_KEY) === '1'; } catch (err) { /* sin storage */ }
hint.hidden = seenHint;

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

let themeStored = 'claro';
try { themeStored = localStorage.getItem(THEME_KEY) || 'claro'; } catch (err) { /* sin storage */ }
applyTheme(themeStored);
syncCurrencyLabel();

renderAll();
attachPrintFallback(() => sheet);

let resizeTimer = null;
window.addEventListener('resize', () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => fitToPage(sheet), 160);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => fitToPage(sheet));
}

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    autosave.flush();
    toast('Guardado', 'success', 1600);
  }
});

// Cerrar el diálogo de confirmación con el botón físico "atrás" no debe dejar
// diálogos abiertos al volver a la app.
window.addEventListener('pagehide', () => {
  document.querySelectorAll('dialog[open]').forEach(closeDialog);
});
