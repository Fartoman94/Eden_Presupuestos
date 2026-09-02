/**
 * Exportación e impresión.
 *
 * El documento en pantalla es responsive, pero el PDF siempre se arma sobre una
 * copia montada en un escenario de 210 × 297 mm. Como las reglas responsive del
 * documento dependen del ancho de su propio contenedor (container queries), esa
 * copia siempre se compone con el diseño A4 completo, sin importar el
 * dispositivo desde el que se exporte.
 */

import { fitToPage, overflowsPage } from './document.js';
import { formatDateShort } from './format.js';

const STAGE_ID = 'pdfStage';
const MAX_PAGES = 12;

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

/**
 * Copia el tamaño real de cada imagen al clon. Sin esto la copia se mide con
 * las imágenes todavía sin cargar, el alto del encabezado y del pie da cero y
 * el reparto en hojas sale mal.
 */
function copyImageSizes(source, clone) {
  const originals = source.querySelectorAll('img');
  clone.querySelectorAll('img').forEach((img, index) => {
    const original = originals[index];
    if (!original || !original.naturalWidth) return;
    img.setAttribute('width', String(original.naturalWidth));
    img.setAttribute('height', String(original.naturalHeight));
  });
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

/* ------------------------------------------------------------------ */
/* Reparto en hojas                                                    */
/* ------------------------------------------------------------------ */

const mainOf = (sheet) => sheet.querySelector('.doc-main');

/** Hoja nueva con el mismo marco (encabezado, marca de agua y pie) y sin cuerpo. */
function blankSheetFrom(sheet) {
  const clone = sheet.cloneNode(true);
  mainOf(clone).textContent = '';
  return clone;
}

/** Copia el armazón de la tabla (columnas y encabezado) sin renglones. */
function emptyTableFrom(wrap) {
  const copy = wrap.cloneNode(false);
  const table = wrap.querySelector('table');
  const clone = table.cloneNode(false);

  const colgroup = table.querySelector('colgroup');
  if (colgroup) clone.appendChild(colgroup.cloneNode(true));
  const thead = table.querySelector('thead');
  if (thead) clone.appendChild(thead.cloneNode(true));
  clone.appendChild(document.createElement('tbody'));

  // El total general acompaña al último tramo de la tabla.
  const tfoot = table.querySelector('tfoot');
  if (tfoot) clone.appendChild(tfoot);

  copy.appendChild(clone);
  return copy;
}

/**
 * Pasa a `target` el último bloque de `source` que se pueda separar: primero la
 * vigencia, después las condiciones de a una y por último los renglones.
 * @returns {boolean} si movió algo
 */
function moveLastBlock(source, target) {
  const from = mainOf(source);
  const to = mainOf(target);
  const last = from.lastElementChild;
  if (!last) return false;

  if (last.classList.contains('doc-conditions')) {
    const list = last.querySelector('.cond-list');
    if (list && list.children.length) {
      let section = to.querySelector('.doc-conditions');
      if (!section) {
        section = last.cloneNode(false);
        section.appendChild(list.cloneNode(false));
        to.insertBefore(section, to.firstChild);
      }
      const destino = section.querySelector('.cond-list');
      destino.insertBefore(list.lastElementChild, destino.firstChild);
      if (!list.children.length) last.remove();
      return true;
    }
  }

  if (last.classList.contains('doc-table-wrap')) {
    const tbody = last.querySelector('tbody');
    if (tbody && tbody.children.length) {
      let wrap = to.querySelector('.doc-table-wrap');
      if (!wrap) {
        wrap = emptyTableFrom(last);
        to.insertBefore(wrap, to.firstChild);
      }
      const destino = wrap.querySelector('tbody');
      destino.insertBefore(tbody.lastElementChild, destino.firstChild);
      if (!tbody.children.length) last.remove();
      return true;
    }
  }

  // Mudar el bloque entero a una hoja vacía no achica nada: quedaría igual.
  if (from.children.length === 1 && !to.children.length) return false;

  to.insertBefore(last, to.firstChild);
  return true;
}

/**
 * Reparte el documento en tantas hojas A4 como haga falta. Cada hoja repite el
 * encabezado y el pie, así que las siguientes siguen siendo el mismo documento
 * comercial.
 * @returns {HTMLElement[]} las hojas, en orden
 */
function paginate({ addPage, dropPage }, first) {
  const sheets = [first];
  let current = first;
  let guard = 0;

  while (overflowsPage(current) && guard < MAX_PAGES) {
    guard += 1;
    const next = blankSheetFrom(first);
    const page = addPage(next);

    let moved = false;
    while (overflowsPage(current) && moveLastBlock(current, next)) moved = true;
    if (!moved) {
      dropPage(page);
      break;
    }

    sheets.push(next);
    current = next;
  }

  return sheets;
}

/**
 * Monta la copia A4 lista para capturar o imprimir.
 * Cada hoja repite la estructura de la pantalla (`.sheet-scaler` > `.sheet`)
 * porque el contenedor de consulta tiene que viajar con la copia: html2pdf
 * reparenta el nodo que recibe, y sin ese contenedor la hoja perdería su escala.
 * @returns {{stage: HTMLElement, pages: HTMLElement[], sheets: HTMLElement[]}}
 */
export function buildStage(sheet) {
  removeStage();

  const stage = document.createElement('div');
  stage.id = STAGE_ID;
  stage.className = 'pdf-stage';
  stage.setAttribute('aria-hidden', 'true');

  const pages = [];
  const addPage = (hoja) => {
    const page = document.createElement('div');
    page.className = 'pdf-page';
    const scaler = document.createElement('div');
    scaler.className = 'sheet-scaler';
    scaler.appendChild(hoja);
    page.appendChild(scaler);
    stage.appendChild(page);
    pages.push(page);
    return page;
  };
  const dropPage = (page) => {
    const index = pages.indexOf(page);
    if (index >= 0) pages.splice(index, 1);
    page.remove();
  };

  const clone = sheet.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('pdf-mode');
  copyImageSizes(sheet, clone);
  cleanClone(clone);

  addPage(clone);
  document.body.appendChild(stage);
  document.documentElement.classList.add('is-exporting');

  fitToPage(clone);
  // En el papel la hoja nunca crece: lo que sobra pasa a la hoja siguiente.
  if (clone.classList.contains('is-overflowing')) {
    // Achicar la letra sólo vale la pena para ahorrar una hoja. Si igual hacen
    // falta varias, el documento vuelve a su tamaño normal.
    mainOf(clone).style.setProperty('--fit', '1');
    clone.classList.remove('is-overflowing');
  }

  const sheets = paginate({ addPage, dropPage }, clone);
  sheets.forEach((hoja, i) => { if (i) hoja.classList.remove('is-overflowing'); });

  return { stage, pages, sheets };
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

/**
 * @returns {Promise<number>} cuántas hojas A4 salieron
 */
export async function exportPDF(sheet, budget) {
  const { stage, pages } = buildStage(sheet);
  try {
    await waitForImages(stage);
    if (!window.html2pdf) throw new Error('html2pdf no disponible');

    const options = pdfOptions(budget);
    const canvases = [];

    // Se captura de a una hoja: así todas se dibujan en la misma posición.
    for (const page of pages) {
      pages.forEach((otra) => { otra.style.display = otra === page ? '' : 'none'; });
      const raw = await window.html2pdf().set(options).from(page).toCanvas().get('canvas');
      canvases.push(normalizeCanvas(raw));
    }
    pages.forEach((page) => { page.style.display = ''; });

    const pdf = await window.html2pdf().set(options).from(canvases[0], 'canvas').toPdf().get('pdf');
    canvases.slice(1).forEach((canvas) => {
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', options.image.quality), 'JPEG', 0, 0, 210, 297);
    });
    pdf.save(options.filename);

    return canvases.length;
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
