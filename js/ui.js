/**
 * Piezas de interfaz fuera del documento: avisos, diálogos, menú y el
 * indicador de guardado.
 */

let toastEl = null;
let toastTimer = null;

export function toast(message, type = 'info', duration = 3200) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.dataset.type = type;
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
}

/* ------------------------------------------------------------------ */
/* Diálogos                                                            */
/* ------------------------------------------------------------------ */

export function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

export function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    if (dialog.open) dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

/** Cierra el diálogo al tocar fuera de la tarjeta. */
export function enableBackdropClose(dialog) {
  if (!dialog) return;
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
}

/**
 * Confirmación propia (nunca `confirm()` nativo) para acciones destructivas.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  const dialog = document.getElementById('confirmDialog');
  const titleEl = dialog.querySelector('.dialog-title');
  const messageEl = dialog.querySelector('.dialog-message');
  const okBtn = dialog.querySelector('[data-role="confirm"]');
  const cancelBtn = dialog.querySelector('[data-role="cancel"]');

  titleEl.textContent = title;
  messageEl.textContent = message;
  okBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;
  okBtn.classList.toggle('btn-danger', danger);
  okBtn.classList.toggle('btn-primary', !danger);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      closeDialog(dialog);
      resolve(value);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onClose = () => finish(false);

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    openDialog(dialog);
    cancelBtn.focus();
  });
}

/* ------------------------------------------------------------------ */
/* Indicador de autoguardado                                           */
/* ------------------------------------------------------------------ */

export function createSaveIndicator(el) {
  const text = el.querySelector('.save-text');
  let clearTimer = null;

  return function setState(state) {
    el.dataset.state = state;
    if (clearTimer) clearTimeout(clearTimer);
    if (state === 'saving') {
      text.textContent = 'Guardando…';
    } else if (state === 'error') {
      text.textContent = 'Sin guardar';
    } else {
      text.textContent = 'Guardado';
      clearTimer = setTimeout(() => { el.dataset.state = 'idle'; }, 2200);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Menú secundario                                                     */
/* ------------------------------------------------------------------ */

export function createMenu(button, menu) {
  function close() {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function open() {
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const first = menu.querySelector('button:not([hidden]):not([disabled])');
    if (first) first.focus();
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (menu.hidden) open();
    else close();
  });

  document.addEventListener('click', (event) => {
    if (menu.hidden) return;
    if (menu.contains(event.target) || button.contains(event.target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      close();
      button.focus();
    }
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('button')) close();
  });

  return { open, close };
}
