/**
 * Mini barra flotante contextual para las condiciones.
 * Sólo aparece mientras se edita una condición y vive fuera de la hoja,
 * así nunca se exporta al PDF ni interfiere con el documento.
 */

const BUTTONS = [
  { action: 'bold', label: 'Negrita', text: 'B', className: 'ctb-bold' },
  { action: 'duplicate', label: 'Duplicar condición', text: '⧉' },
  { action: 'up', label: 'Mover arriba', text: '↑' },
  { action: 'down', label: 'Mover abajo', text: '↓' },
  { action: 'remove', label: 'Eliminar condición', text: '✕', className: 'ctb-danger' }
];

export function createConditionToolbar({ actions }) {
  const bar = document.createElement('div');
  bar.className = 'cond-toolbar only-screen';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Acciones de la condición');
  bar.hidden = true;

  const buttons = {};
  BUTTONS.forEach((def) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ctb-btn ${def.className || ''}`.trim();
    btn.textContent = def.text;
    btn.title = def.label;
    btn.setAttribute('aria-label', def.label);
    // `pointerdown` + preventDefault evita que el campo pierda el foco al tocar.
    btn.addEventListener('pointerdown', (event) => event.preventDefault());
    btn.addEventListener('click', () => run(def.action));
    buttons[def.action] = btn;
    bar.appendChild(btn);
  });

  document.body.appendChild(bar);

  let currentId = null;
  let currentEl = null;
  let hideTimer = null;

  function run(action) {
    if (!currentId) return;
    const id = currentId;
    if (action === 'bold') {
      actions.bold(id);
      syncBold();
      return;
    }
    if (action === 'duplicate') actions.duplicate(id);
    else if (action === 'up') actions.move(id, -1);
    else if (action === 'down') actions.move(id, 1);
    else if (action === 'remove') actions.remove(id);
    hide();
  }

  function syncBold() {
    if (!currentId) return;
    buttons.bold.classList.toggle('is-active', actions.isBold(currentId));
    buttons.bold.setAttribute('aria-pressed', actions.isBold(currentId) ? 'true' : 'false');
  }

  function place() {
    if (bar.hidden || !currentEl || !currentEl.isConnected) return;
    const rect = currentEl.getBoundingClientRect();
    const size = bar.getBoundingClientRect();
    const margin = 8;
    let top = rect.top - size.height - 6;
    if (top < margin) top = Math.min(rect.bottom + 6, window.innerHeight - size.height - margin);
    let left = rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - size.width - margin));
    bar.style.top = `${Math.max(margin, top)}px`;
    bar.style.left = `${left}px`;
  }

  function show(li) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    currentEl = li;
    currentId = li.dataset.condId;
    bar.hidden = false;
    syncBold();
    requestAnimationFrame(place);
  }

  function hide() {
    bar.hidden = true;
    currentEl = null;
    currentId = null;
  }

  document.addEventListener('ed:begin', (event) => {
    const li = event.target.closest && event.target.closest('.cond');
    if (li) show(li);
    else hide();
  });

  document.addEventListener('ed:end', (event) => {
    const li = event.target.closest && event.target.closest('.cond');
    if (!li) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      const active = document.activeElement;
      if (active && bar.contains(active)) return;
      if (active && active.closest && active.closest('.cond')) return;
      hide();
    }, 120);
  });

  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', place);

  return { hide, place };
}
