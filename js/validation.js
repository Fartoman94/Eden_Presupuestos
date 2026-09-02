/**
 * Validaciones. Se usan antes de exportar el PDF y para marcar campos en pantalla.
 * La edición nunca se bloquea: los valores se sanean al confirmarlos y acá sólo
 * se avisa lo que falta.
 */

import { normalizeISO } from './format.js';
import { totals } from './calc.js';

/**
 * @returns {{field: string, message: string}[]} lista vacía si el presupuesto está listo
 */
export function validateBudget(budget) {
  const problems = [];

  if (!normalizeISO(budget.fecha)) {
    problems.push({ field: 'fecha', message: 'Completá la fecha del presupuesto antes de descargar el PDF.' });
  }

  budget.items.forEach((item, index) => {
    const ref = budget.items.length > 1 ? ` del renglón ${index + 1}` : '';

    if (!item.destino.trim()) {
      problems.push({
        field: `item:${item.id}:destino`,
        message: `Completá el destino${ref} antes de descargar el PDF.`
      });
    }

    if (!(item.total > 0)) {
      problems.push({
        field: `item:${item.id}:total`,
        message: `Cargá un importe${ref} antes de descargar el PDF.`
      });
    }

    const salida = normalizeISO(item.salida);
    const regreso = normalizeISO(item.regreso);
    if (salida && regreso && regreso < salida) {
      problems.push({
        field: `item:${item.id}:regreso`,
        message: `La fecha de regreso${ref} no puede ser anterior a la de salida.`
      });
    }
  });

  if (!(totals(budget.items).total > 0) && !problems.some((p) => p.field.endsWith(':total'))) {
    problems.push({ field: 'total', message: 'El presupuesto no tiene importes cargados.' });
  }

  return problems;
}
