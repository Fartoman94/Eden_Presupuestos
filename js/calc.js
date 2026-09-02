/**
 * Cálculos del presupuesto. Siempre sobre números, nunca sobre texto formateado.
 * El flujo es unidireccional según el campo que la persona editó:
 *   neto  -> iva -> total
 *   total -> neto -> iva
 * No hay recálculo en cadena, así que no puede haber loops.
 */

import { roundCents, toNumber } from './format.js';

export const IVA_RATES = [
  { value: 0.105, label: '10,5%' },
  { value: 0.21, label: '21%' },
  { value: 0, label: 'exento' }
];

export function normalizeRate(rate) {
  const n = toNumber(rate);
  if (n < 0 || n > 1) return 0.105;
  return n;
}

export function rateLabel(rate) {
  const r = normalizeRate(rate);
  const found = IVA_RATES.find((o) => Math.abs(o.value - r) < 1e-9);
  if (found) return found.label;
  return `${(r * 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`;
}

/** Recalcula un renglón a partir del precio neto. Muta el ítem. */
export function applyNeto(item, neto) {
  const rate = normalizeRate(item.ivaRate);
  const n = Math.max(0, roundCents(neto));
  item.ivaRate = rate;
  item.neto = n;
  item.iva = roundCents(n * rate);
  item.total = roundCents(n + item.iva);
  return item;
}

/** Recalcula un renglón a partir del total final. Muta el ítem. */
export function applyTotal(item, total) {
  const rate = normalizeRate(item.ivaRate);
  const t = Math.max(0, roundCents(total));
  const neto = roundCents(t / (1 + rate));
  item.ivaRate = rate;
  item.total = t;
  item.neto = neto;
  item.iva = roundCents(t - neto);
  return item;
}

/** Reaplica la alícuota manteniendo el neto como valor de referencia. */
export function applyRate(item, rate) {
  item.ivaRate = normalizeRate(rate);
  return applyNeto(item, item.neto);
}

/** Deja el ítem consistente (se usa al cargar datos guardados). */
export function reconcile(item) {
  const rate = normalizeRate(item.ivaRate);
  item.ivaRate = rate;
  const neto = roundCents(item.neto);
  const total = roundCents(item.total);
  if (!neto && total) return applyTotal(item, total);
  return applyNeto(item, neto);
}

export function totals(items) {
  let neto = 0;
  let iva = 0;
  let total = 0;
  (items || []).forEach((item) => {
    neto += toNumber(item.neto);
    iva += toNumber(item.iva);
    total += toNumber(item.total);
  });
  return {
    neto: roundCents(neto),
    iva: roundCents(iva),
    total: roundCents(total)
  };
}
