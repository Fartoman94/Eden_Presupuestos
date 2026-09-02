/**
 * Historial de presupuestos guardados en el dispositivo.
 */

import { formatDateShort } from './format.js';
import { totals } from './calc.js';
import { loadHistory, removeFromHistory, saveToHistory } from './state.js';
import { closeDialog, confirmDialog, enableBackdropClose, openDialog, toast } from './ui.js';

export function initHistory({ getBudget, onLoad }) {
  const dialog = document.getElementById('historyDialog');
  const list = dialog.querySelector('.history-list');

  enableBackdropClose(dialog);
  dialog.querySelectorAll('[data-role="close"]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(dialog));
  });

  function render() {
    const entries = loadHistory();
    list.textContent = '';

    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'Todavía no guardaste ningún presupuesto.';
      list.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'history-item';

      const info = document.createElement('div');
      info.className = 'history-info';

      const title = document.createElement('span');
      title.className = 'history-title';
      title.textContent = entry.titulo;
      info.appendChild(title);

      const meta = document.createElement('span');
      meta.className = 'history-meta';
      const sums = totals(entry.data.items);
      meta.textContent = `${formatDateShort(entry.data.fecha)} · ${entry.data.moneda} ${sums.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      info.appendChild(meta);

      row.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const load = document.createElement('button');
      load.type = 'button';
      load.className = 'btn btn-ghost btn-sm';
      load.textContent = 'Abrir';
      load.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Abrir presupuesto guardado',
          message: 'Se reemplazará el presupuesto que estás editando.',
          confirmText: 'Abrir'
        });
        if (!ok) return;
        onLoad(entry.data);
        closeDialog(dialog);
        toast('Presupuesto cargado', 'success');
      });
      actions.appendChild(load);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-icon btn-sm';
      del.setAttribute('aria-label', `Eliminar ${entry.titulo}`);
      del.textContent = '✕';
      del.addEventListener('click', () => {
        removeFromHistory(entry.id);
        render();
      });
      actions.appendChild(del);

      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  const saveBtn = dialog.querySelector('[data-role="save-current"]');
  saveBtn.addEventListener('click', () => {
    const budget = getBudget();
    const titulo = budget.cliente.trim() ||
      (budget.items[0] && budget.items[0].destino.trim()) ||
      `Presupuesto ${formatDateShort(budget.fecha)}`;
    if (saveToHistory(budget, titulo)) {
      toast('Guardado en el historial', 'success');
      render();
    } else {
      toast('No se pudo guardar en este dispositivo', 'error');
    }
  });

  return {
    open() {
      render();
      openDialog(dialog);
    }
  };
}
