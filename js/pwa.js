/**
 * Instalación e infraestructura offline.
 * El botón de instalar vive en el menú secundario para no competir con
 * "Descargar PDF".
 */

import { closeDialog, enableBackdropClose, openDialog, toast } from './ui.js';

let deferredPrompt = null;

export function initPWA({ installButton }) {
  const helpDialog = document.getElementById('installDialog');
  if (helpDialog) {
    enableBackdropClose(helpDialog);
    helpDialog.querySelectorAll('[data-role="close"]').forEach((btn) => {
      btn.addEventListener('click', () => closeDialog(helpDialog));
    });
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (installButton) {
    installButton.hidden = standalone;
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (err) { /* cancelado */ }
        deferredPrompt = null;
        return;
      }
      openDialog(helpDialog);
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installButton) installButton.hidden = true;
    toast('Aplicación instalada', 'success');
  });

  // `isSecureContext` cubre https y también las pruebas locales por IP.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* sin offline */ });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}
