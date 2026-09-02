/**
 * Fuente única de verdad del presupuesto.
 * Un solo objeto `budget` alimenta el documento, la edición, el guardado y el PDF.
 */

import { isoFromShort, monthFromName, normalizeISO, pad, roundCents, todayISO } from './format.js';
import { normalizeRate, reconcile } from './calc.js';

export const STORAGE_KEY = 'eden_presupuesto_v3';
export const HISTORY_KEY = 'eden_presupuestos_history_v3';
const LEGACY_DRAFT_KEY = 'eden_presupuesto_draft_v2';
const LEGACY_HISTORY_KEY = 'eden_presupuestos_history_v2';

export const DEFAULT_VALIDEZ = 'Presupuesto válido por 7 días a partir de la fecha de emisión.';
export const DEFAULT_TITULO = 'Servicio de traslado';

let seq = 0;
export function uid(prefix) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function createItem(extra = {}) {
  return {
    id: uid('item'),
    titulo: DEFAULT_TITULO,
    salida: '',
    origen: '',
    destino: '',
    regreso: '',
    detalle: '',
    neto: 0,
    ivaRate: 0.105,
    iva: 0,
    total: 0,
    ...extra
  };
}

export function createDefaultBudget() {
  return {
    v: 3,
    fecha: todayISO(),
    numero: '',
    cliente: '',
    moneda: '$',
    validez: DEFAULT_VALIDEZ,
    items: [createItem()],
    condiciones: [
      { id: uid('c'), texto: 'El servicio se seña con el 30% del valor total.', bold: false },
      {
        id: uid('c'),
        texto: 'Este valor está sujeto a los incrementos que puedan surgir hasta 5 días antes de la salida, de no haber cancelado la totalidad del mismo.',
        bold: false
      },
      { id: uid('c'), texto: 'Viáticos y alojamiento del chofer a cargo del contratante.', bold: false },
      {
        id: uid('c'),
        texto: 'El IVA será contemplado en caso de solicitar facturación o abonar mediante transferencia bancaria.',
        bold: true
      }
    ]
  };
}

/* ------------------------------------------------------------------ */
/* Normalización y migración                                           */
/* ------------------------------------------------------------------ */

function str(value) {
  return typeof value === 'string' ? value : (value == null ? '' : String(value));
}

/**
 * Intenta extraer datos de la plantilla vieja con guiones bajos:
 * "Servicio de traslado saliendo el día 10 de septiembre del 2026 hacia Bariloche
 *  y regresando el día 14 de septiembre del 2026."
 */
function parseLegacyDescription(desc) {
  const text = str(desc);
  if (!/^\s*servicio de traslado/i.test(text)) return null;

  const out = { titulo: DEFAULT_TITULO, salida: '', origen: '', destino: '', regreso: '', detalle: '' };
  const clean = (v) => str(v).replace(/_+/g, '').trim().replace(/\s{2,}/g, ' ');

  const dateAt = (dayRaw, monthRaw, yearRaw) => {
    const day = Number(clean(dayRaw));
    const month = monthFromName(clean(monthRaw));
    const year = Number(clean(yearRaw));
    if (!day || !month || !year) return '';
    return normalizeISO(`${year}-${pad(month)}-${pad(day)}`);
  };

  const salida = /saliendo el d[ií]a\s+([^\s]+)\s+de\s+([^\s]+)\s+del?\s+(\d{4}|_+)/i.exec(text);
  if (salida) out.salida = dateAt(salida[1], salida[2], salida[3]);

  const regreso = /regresando el d[ií]a\s+([^\s]+)\s+de\s+([^\s]+)\s+del?\s+(\d{4}|_+)/i.exec(text);
  if (regreso) out.regreso = dateAt(regreso[1], regreso[2], regreso[3]);

  const desde = /\bdesde\s+([^,]+?)\s+(?:hacia|hasta)\b/i.exec(text);
  if (desde) out.origen = clean(desde[1]);

  const hacia = /\b(?:hacia|hasta)\s+(.+?)(?:\s+y\s+regresando|,|\.|$)/i.exec(text);
  if (hacia) out.destino = clean(hacia[1]);

  return out;
}

function normalizeItem(raw) {
  const base = createItem();
  if (!raw || typeof raw !== 'object') return base;

  const item = {
    ...base,
    id: str(raw.id) || base.id,
    titulo: str(raw.titulo) || DEFAULT_TITULO,
    salida: normalizeISO(raw.salida) || isoFromShort(raw.salida),
    origen: str(raw.origen),
    destino: str(raw.destino),
    regreso: normalizeISO(raw.regreso) || isoFromShort(raw.regreso),
    detalle: str(raw.detalle),
    neto: roundCents(raw.neto),
    ivaRate: normalizeRate(raw.ivaRate),
    iva: roundCents(raw.iva),
    total: roundCents(raw.total)
  };

  // Migración desde el modelo viejo, que guardaba una descripción de texto libre.
  if (raw.desc && !raw.titulo) {
    const parsed = parseLegacyDescription(raw.desc);
    if (parsed) {
      Object.assign(item, parsed);
    } else {
      item.detalle = str(raw.desc).replace(/_{2,}/g, '').replace(/\s{2,}/g, ' ').trim();
    }
  }

  return reconcile(item);
}

function normalizeCondition(raw) {
  if (typeof raw === 'string') return { id: uid('c'), texto: raw, bold: false };
  return {
    id: str(raw && raw.id) || uid('c'),
    texto: str(raw && raw.texto),
    bold: Boolean(raw && raw.bold)
  };
}

/** Convierte cualquier objeto guardado (v2 o v3) en un presupuesto válido. */
export function normalizeBudget(raw) {
  const fallback = createDefaultBudget();
  if (!raw || typeof raw !== 'object') return fallback;

  const items = Array.isArray(raw.items) && raw.items.length
    ? raw.items.map(normalizeItem)
    : [createItem()];

  // El modelo viejo guardaba un destino suelto, fuera de los renglones.
  const destinoSuelto = str(raw.destino).trim();
  if (destinoSuelto && !items[0].destino) items[0].destino = destinoSuelto;

  const condiciones = Array.isArray(raw.condiciones)
    ? raw.condiciones.map(normalizeCondition)
    : fallback.condiciones;

  return {
    v: 3,
    fecha: normalizeISO(raw.fecha) || isoFromShort(raw.fecha) || todayISO(),
    numero: str(raw.numero),
    cliente: str(raw.cliente),
    moneda: raw.moneda === 'USD' ? 'USD' : '$',
    validez: raw.validez == null ? DEFAULT_VALIDEZ : str(raw.validez),
    items,
    condiciones
  };
}

export function cloneBudget(budget) {
  return JSON.parse(JSON.stringify(budget));
}

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadBudget() {
  const stored = readJSON(STORAGE_KEY);
  if (stored) return normalizeBudget(stored);

  const legacy = readJSON(LEGACY_DRAFT_KEY);
  if (legacy) return normalizeBudget(legacy);

  return createDefaultBudget();
}

export function persistBudget(budget) {
  return writeJSON(STORAGE_KEY, budget);
}

/**
 * Autoguardado con rebote. Notifica "guardando" y "guardado" para el indicador.
 */
export function createAutosave(getBudget, onStatus, delay = 500) {
  let timer = null;
  let settle = null;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const ok = persistBudget(getBudget());
    if (settle) clearTimeout(settle);
    if (onStatus) onStatus(ok ? 'saved' : 'error');
    return ok;
  }

  function schedule() {
    if (onStatus) onStatus('saving');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const ok = persistBudget(getBudget());
      if (onStatus) onStatus(ok ? 'saved' : 'error');
    }, delay);
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return { schedule, flush };
}

/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

export function loadHistory() {
  const current = readJSON(HISTORY_KEY);
  if (Array.isArray(current)) return current;

  const legacy = readJSON(LEGACY_HISTORY_KEY);
  if (Array.isArray(legacy)) {
    const migrated = legacy.map((entry) => ({
      id: str(entry && entry.id) || uid('hist'),
      titulo: str(entry && entry.titulo) || 'Presupuesto',
      fechaGuardado: str(entry && entry.fechaGuardado),
      data: normalizeBudget(entry && entry.data)
    }));
    writeJSON(HISTORY_KEY, migrated);
    return migrated;
  }

  return [];
}

export function saveToHistory(budget, titulo) {
  const history = loadHistory();
  history.unshift({
    id: uid('hist'),
    titulo: titulo || 'Presupuesto',
    fechaGuardado: new Date().toLocaleString('es-AR'),
    data: cloneBudget(budget)
  });
  while (history.length > 30) history.pop();
  return writeJSON(HISTORY_KEY, history);
}

export function removeFromHistory(id) {
  const history = loadHistory().filter((entry) => entry.id !== id);
  return writeJSON(HISTORY_KEY, history);
}
