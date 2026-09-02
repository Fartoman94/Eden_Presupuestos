/**
 * Mensaje personal de la herramienta interna.
 * Aparece como máximo una vez cada 7 días, se cierra con el corazón y nunca
 * forma parte del documento ni del PDF.
 */

import { closeDialog, enableBackdropClose, openDialog } from './ui.js';

const KEY = 'eden_mensaje_amor_visto';
const DAYS = 7;
const INTERVAL_MS = DAYS * 24 * 60 * 60 * 1000;

function readMark() {
  let mark = '';
  try {
    const row = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${encodeURIComponent(KEY)}=`));
    if (row) mark = decodeURIComponent(row.split('=')[1]);
  } catch (err) { /* cookies deshabilitadas */ }
  if (!mark) {
    try { mark = localStorage.getItem(KEY) || ''; } catch (err) { /* sin storage */ }
  }
  return Number(mark) || 0;
}

function writeMark(mark) {
  try {
    document.cookie = `${encodeURIComponent(KEY)}=${encodeURIComponent(mark)}; max-age=${DAYS * 24 * 60 * 60}; path=/; SameSite=Lax`;
  } catch (err) { /* cookies deshabilitadas */ }
  try { localStorage.setItem(KEY, String(mark)); } catch (err) { /* sin storage */ }
}

export function initLoveMessage() {
  const dialog = document.getElementById('loveDialog');
  if (!dialog) return { show: () => {} };

  enableBackdropClose(dialog);
  dialog.querySelectorAll('[data-role="close"]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(dialog));
  });

  const show = () => {
    writeMark(Date.now());
    openDialog(dialog);
  };

  const last = readMark();
  if (!last || Date.now() - last >= INTERVAL_MS) {
    setTimeout(show, 700);
  }

  return { show };
}
