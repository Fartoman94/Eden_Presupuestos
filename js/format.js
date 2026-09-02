/**
 * Formato y parseo de valores (moneda argentina y fechas ISO).
 * Regla del proyecto: internamente todo es número o fecha ISO `YYYY-MM-DD`.
 * Los strings formateados existen sólo para mostrar.
 */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** Convierte cualquier entrada a un número finito. Nunca devuelve NaN/Infinity. */
export function toNumber(value) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Redondea a centavos evitando errores de coma flotante. */
export function roundCents(n) {
  const v = toNumber(n);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Parsea un importe escrito por una persona en formato argentino.
 * Acepta "125.000,50", "125000,5", "125,000.50", "$ 1.200" y variantes.
 */
export function parseMoney(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;

  let s = String(input == null ? '' : input).trim().replace(/[^0-9,.\-]/g, '');
  if (!s || s === '-' || s === ',' || s === '.') return 0;

  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // La coma es decimal salvo que se use como separador de miles (1,200,000)
    const parts = s.split(',');
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    s = isThousands ? parts.join('') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    const parts = s.split('.');
    const isThousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
    if (isThousands) s = parts.join('');
  }

  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return roundCents(negative ? -n : n);
}

/** "125000.5" -> "125.000,50" (sin símbolo). */
export function formatAmount(value) {
  return roundCents(value).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** "125000.5" -> "$ 125.000,50". */
export function formatMoney(value, symbol = '$') {
  return `${symbol} ${formatAmount(value)}`;
}

/** Valor listo para escribir dentro de un input (sin separador de miles). */
export function amountForInput(value) {
  const n = roundCents(value);
  if (!n) return '';
  return String(n).replace('.', ',');
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Valida y normaliza una fecha ISO. Devuelve '' si no es válida. */
export function normalizeISO(value) {
  const s = String(value == null ? '' : value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return '';
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) return '';
  return `${y}-${mo}-${d}`;
}

/** "2026-09-02" -> "02/09/2026". */
export function formatDateShort(iso) {
  const v = normalizeISO(iso);
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-09-10" -> "10 de septiembre de 2026". */
export function formatDateLong(iso) {
  const v = normalizeISO(iso);
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`;
}

/** "02/09/2026" -> "2026-09-02" (para migrar datos guardados). */
export function isoFromShort(value) {
  const m = /^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/.exec(String(value || '').trim());
  if (!m) return '';
  let [, d, mo, y] = m;
  if (y.length === 2) y = String(2000 + Number(y));
  return normalizeISO(`${y}-${pad(Number(mo))}-${pad(Number(d))}`);
}

/** Nombre de mes en español -> número (1-12). 0 si no se reconoce. */
export function monthFromName(name) {
  const clean = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const idx = MESES.findIndex((m) => m.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === clean);
  return idx === -1 ? 0 : idx + 1;
}

export { MESES, pad };
