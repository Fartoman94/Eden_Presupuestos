/**
 * Exportación e impresión.
 *
 * El documento en pantalla es responsive, pero el PDF siempre se arma sobre una
 * copia montada en un escenario de 210 × 297 mm. Como las reglas responsive del
 * documento dependen del ancho de su propio contenedor (container queries), esa
 * copia siempre se compone con el diseño A4 completo, sin importar el
 * dispositivo desde el que se exporte.
 */

import { fitToPage } from './document.js';
import { formatDateShort } from './format.js';

const STAGE_ID = 'pdfStage';

function removeEmptyClauses(clone) {
  clone.querySelectorAll('.doc-clause').forEach((node) => {
    const editable = node.querySelector('.ed');
    if (editable && editable.dataset.empty === 'true') node.remove();
  });

  clone.querySelectorAll('.item-sentence').forEach((sentence) => {
    if (!sentence.querySelector('.doc-clause')) sentence.remove();
  });

  clone.querySelectorAll('.cond').forEach((li) => {
    const editable = li.querySelector('.ed');
    if (!editable || editable.dataset.empty === 'true') li.remove();
  });

  const list = clone.querySelector('.cond-list');
  if (list && !list.children.length) {
    const section = list.closest('.doc-conditions');
    if (section) section.remove();
  }
}

function cleanClone(clone) {
  clone.querySelectorAll('.only-screen').forEach((node) => node.remove());
  removeEmptyClauses(clone);
  clone.querySelectorAll('.ed-ph').forEach((node) => node.remove());
  clone.querySelectorAll('.ed').forEach((node) => {
    node.removeAttribute('tabindex');
    node.removeAttribute('role');
    node.removeAttribute('aria-label');
  });
}

export function removeStage() {
  const existing = document.getElementById(STAGE_ID);
  if (existing) existing.remove();
  document.documentElement.classList.remove('is-exporting');
}

/**
 * Monta la copia A4 lista para capturar o imprimir.
 * La estructura repite la de la pantalla (`.sheet-scaler` > `.sheet`) porque el
 * contenedor de consulta tiene que viajar con la copia: html2pdf reparenta el
 * nodo que recibe, y sin ese contenedor la hoja perdería su escala.
 * @returns {{stage: HTMLElement, page: HTMLElement, sheet: HTMLElement}}
 */
export function buildStage(sheet) {
  removeStage();

  const stage = document.createElement('div');
  stage.id = STAGE_ID;
  stage.className = 'pdf-stage';
  stage.setAttribute('aria-hidden', 'true');

  const page = document.createElement('div');
  page.className = 'pdf-page';

  const scaler = document.createElement('div');
  scaler.className = 'sheet-scaler';

  const clone = sheet.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('pdf-mode');
  cleanClone(clone);

  scaler.appendChild(clone);
  page.appendChild(scaler);
  stage.appendChild(page);
  document.body.appendChild(stage);
  document.documentElement.classList.add('is-exporting');

  fitToPage(clone);
  return { stage, page, sheet: clone };
}

export function buildFilename(budget) {
  const fecha = (formatDateShort(budget.fecha) || 'sin-fecha').replace(/\//g, '-');
  const cliente = budget.cliente
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `Presupuesto_Eden_${fecha}${cliente ? `_${cliente}` : ''}.pdf`;
}

/** Espera a que las imágenes de la copia estén decodificadas. */
async function waitForImages(node) {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 2500);
    });
  }));
}

/** Relación alto/ancho exacta de una hoja A4. */
const A4_RATIO = 841.89 / 595.28;

/**
 * Ajusta el alto del lienzo a la proporción A4 exacta.
 * html2pdf pagina comparando el alto del lienzo con `floor(ancho × proporción)`:
 * un solo píxel de más genera una segunda hoja en blanco.
 */
function normalizeCanvas(source) {
  const height = Math.floor(source.width * A4_RATIO);
  if (height === source.height) return source;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function pdfOptions(budget) {
  return {
    margin: 0,
    filename: buildFilename(budget),
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: {
      scale: Math.min(2, Math.max(1.5, window.devicePixelRatio || 1.5)),
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
  };
}

export async function exportPDF(sheet, budget) {
  const { page } = buildStage(sheet);
  try {
    await waitForImages(page);
    if (!window.html2pdf) throw new Error('html2pdf no disponible');

    const options = pdfOptions(budget);
    const raw = await window.html2pdf().set(options).from(page).toCanvas().get('canvas');
    await window.html2pdf().set(options).from(normalizeCanvas(raw), 'canvas').save();
  } finally {
    removeStage();
  }
}

export function printDocument(sheet) {
  buildStage(sheet);
  window.addEventListener('afterprint', removeStage, { once: true });
  window.print();
}

/** Cubre el atajo Ctrl+P del navegador con el mismo render A4. */
export function attachPrintFallback(getSheet) {
  window.addEventListener('beforeprint', () => {
    if (!document.getElementById(STAGE_ID)) buildStage(getSheet());
  });
  window.addEventListener('afterprint', removeStage);
}
