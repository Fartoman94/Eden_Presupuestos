/**
 * Resumen del presupuesto para compartir por WhatsApp.
 */

import { formatDateLong, formatDateShort, formatMoney } from './format.js';
import { totals } from './calc.js';
import { EMPRESA } from './document.js';
import { toast } from './ui.js';

function describeItem(item) {
  const parts = [item.titulo || 'Servicio'];
  if (item.salida) parts.push(`saliendo el día ${formatDateLong(item.salida)}`);
  if (item.origen) parts.push(`desde ${item.origen}`);
  if (item.destino) parts.push(`hacia ${item.destino}`);
  if (item.regreso) parts.push(`regresando el día ${formatDateLong(item.regreso)}`);
  let text = parts.join(' ').replace(' desde', ', desde').replace(' regresando', ', regresando');
  if (item.detalle.trim()) text += `. ${item.detalle.trim()}`;
  return `${text}.`;
}

export function buildShareText(budget) {
  const sums = totals(budget.items);
  const lines = ['🚌 *PRESUPUESTO — EDEN VIAJES Y TURISMO*'];
  lines.push(`📅 Fecha: ${formatDateShort(budget.fecha)}`);
  if (budget.numero) lines.push(`🧾 N° ${budget.numero}`);
  if (budget.cliente) lines.push(`👤 Cliente: ${budget.cliente}`);

  lines.push('', '📌 *Detalle del servicio:*');
  budget.items.forEach((item) => {
    lines.push(`• ${describeItem(item)}`);
    lines.push(`   _Total:_ ${formatMoney(item.total, budget.moneda)}`);
  });

  lines.push('', `💰 *TOTAL FINAL:* ${formatMoney(sums.total, budget.moneda)}`);

  const condiciones = budget.condiciones.filter((c) => c.texto.trim());
  if (condiciones.length) {
    lines.push('', '📋 *Condiciones:*');
    condiciones.forEach((c) => lines.push(`• ${c.texto.trim()}`));
  }

  if (budget.validez.trim()) lines.push('', `⏳ ${budget.validez.trim()}`);
  lines.push('', `📞 ${EMPRESA.telefonos} | ${EMPRESA.email}`);

  return lines.join('\n');
}

export async function shareBudget(budget) {
  const text = buildShareText(budget);

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Presupuesto Eden', text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Resumen copiado, listo para pegar en WhatsApp', 'success');
      return;
    } catch (err) { /* seguimos con el enlace */ }
  }

  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
