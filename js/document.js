/**
 * Construye el documento editable. El presupuesto que se ve en pantalla es el
 * mismo nodo que se clona para el PDF: no hay editor separado ni vista previa.
 */

import {
  amountForInput,
  formatDateLong,
  formatDateShort,
  formatMoney,
  normalizeISO,
  parseMoney,
  roundCents
} from './format.js';
import { IVA_RATES, applyNeto, applyRate, applyTotal, normalizeRate, rateLabel, totals } from './calc.js';
import { createEditable } from './editable.js';
import { createItem, uid } from './state.js';

/** Identidad corporativa: no es un dato variable del presupuesto. */
export const EMPRESA = {
  nombre: 'Eden Viajes y Turismo SRL',
  email: 'Eden.turismo.srl@gmail.com',
  telefonos: '2994135341 - 2996326712',
  web: 'www.edenturismosrl.com',
  ciudad: 'Centenario, Neuquén'
};

const ICONS = {
  mail: '<path d="M3 5.5h18v13H3z"/><path d="m3 6.5 9 6.5 9-6.5"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M10.5 5.5h3M11 18.5h2"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  pin: '<path d="M20 10c0 5.2-8 12-8 12S4 15.2 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>'
};

/**
 * `width`/`height` explícitos: html2canvas serializa el SVG a una imagen y toma
 * su tamaño intrínseco de esos atributos, no del CSS. Sin ellos los íconos
 * salen en pantalla pero desaparecen del PDF.
 */
function svgIcon(name) {
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function clause(name, ...children) {
  const node = el('span', 'doc-clause');
  node.dataset.clause = name;
  children.forEach((child) => {
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

/**
 * @param {Object} options
 * @param {HTMLElement} options.root  el `<article class="sheet">`
 * @param {() => Object} options.getBudget
 * @param {(reason:string) => void} options.onChange
 */
export function createBudgetDocument({ root, getBudget, onChange }) {
  let tbody = null;
  let tfoot = null;
  let condList = null;

  const notify = (reason) => { if (onChange) onChange(reason); };
  const currency = () => getBudget().moneda;

  /* ---------------------------------------------------------------- */
  /* Encabezado corporativo                                            */
  /* ---------------------------------------------------------------- */

  function buildHead() {
    const head = el('header', 'doc-head');

    const banner = el('img', 'doc-banner');
    banner.src = './assets/header-clean.png';
    banner.alt = '';
    banner.setAttribute('aria-hidden', 'true');
    head.appendChild(banner);

    const logo = el('img', 'doc-logo');
    logo.src = './assets/logo.png';
    logo.alt = EMPRESA.nombre;
    head.appendChild(logo);

    const contact = el('address', 'doc-contact');
    [
      ['mail', EMPRESA.email],
      ['phone', EMPRESA.telefonos],
      ['web', EMPRESA.web],
      ['pin', EMPRESA.ciudad]
    ].forEach(([icon, value]) => {
      const row = el('span', 'doc-contact-row');
      row.innerHTML = svgIcon(icon);
      row.appendChild(el('span', 'doc-contact-value', value));
      contact.appendChild(row);
    });
    head.appendChild(contact);

    return head;
  }

  /* ---------------------------------------------------------------- */
  /* Título, número, fecha y cliente                                   */
  /* ---------------------------------------------------------------- */

  function buildTitleBar() {
    const bar = el('div', 'doc-titlebar');
    bar.appendChild(el('h1', 'doc-title', 'PRESUPUESTO'));

    const meta = el('div', 'doc-metabar');

    const numero = clause('numero');
    numero.appendChild(createEditable({
      type: 'text',
      field: 'numero',
      label: 'Número de presupuesto',
      placeholder: 'N° de presupuesto',
      maxLength: 24,
      get: () => getBudget().numero,
      format: (v) => (v ? `N° ${v}` : ''),
      set: (v) => { getBudget().numero = v.trim(); notify('numero'); }
    }));
    meta.appendChild(numero);

    const fecha = el('span', 'doc-meta-date');
    fecha.appendChild(document.createTextNode('Fecha: '));
    fecha.appendChild(createEditable({
      type: 'date',
      field: 'fecha',
      label: 'Fecha del presupuesto',
      placeholder: 'Fecha',
      get: () => getBudget().fecha,
      format: (v) => formatDateShort(v),
      parse: (v) => normalizeISO(v),
      toInput: (v) => normalizeISO(v),
      set: (v) => { getBudget().fecha = v; notify('fecha'); }
    }));
    meta.appendChild(fecha);

    bar.appendChild(meta);
    return bar;
  }

  function buildClientLine() {
    const line = clause('cliente', 'Cliente: ');
    line.classList.add('doc-client');
    line.appendChild(createEditable({
      type: 'text',
      field: 'cliente',
      label: 'Cliente o pasajero',
      placeholder: 'Cliente o institución',
      get: () => getBudget().cliente,
      set: (v) => { getBudget().cliente = v; notify('cliente'); }
    }));
    return line;
  }

  /* ---------------------------------------------------------------- */
  /* Renglones                                                          */
  /* ---------------------------------------------------------------- */

  function buildSentence(item) {
    const p = el('p', 'item-sentence');

    p.appendChild(clause('titulo', createEditable({
      type: 'text',
      field: `item:${item.id}:titulo`,
      label: 'Tipo de servicio',
      placeholder: 'Servicio',
      get: () => item.titulo,
      set: (v) => { item.titulo = v; notify('item'); }
    })));

    p.appendChild(clause('salida', ' saliendo el día ', createEditable({
      type: 'date',
      field: `item:${item.id}:salida`,
      label: 'Fecha de salida',
      placeholder: 'fecha de salida',
      get: () => item.salida,
      format: (v) => formatDateLong(v),
      parse: (v) => normalizeISO(v),
      toInput: (v) => normalizeISO(v),
      set: (v) => { item.salida = v; notify('item'); }
    })));

    p.appendChild(clause('origen', ', desde ', createEditable({
      type: 'text',
      field: `item:${item.id}:origen`,
      label: 'Lugar de salida',
      placeholder: 'lugar de salida',
      get: () => item.origen,
      set: (v) => { item.origen = v; notify('item'); }
    })));

    p.appendChild(clause('destino', ' hacia ', createEditable({
      type: 'text',
      field: `item:${item.id}:destino`,
      label: 'Destino',
      placeholder: 'destino',
      get: () => item.destino,
      set: (v) => { item.destino = v; notify('item'); }
    })));

    p.appendChild(clause('regreso', ', regresando el día ', createEditable({
      type: 'date',
      field: `item:${item.id}:regreso`,
      label: 'Fecha de regreso',
      placeholder: 'fecha de regreso',
      get: () => item.regreso,
      format: (v) => formatDateLong(v),
      parse: (v) => normalizeISO(v),
      toInput: (v) => normalizeISO(v),
      set: (v) => { item.regreso = v; notify('item'); }
    })));

    p.appendChild(el('span', 'item-sentence-dot', '.'));
    return p;
  }

  /**
   * Etiqueta visible sólo en la presentación de pantalla angosta, donde la
   * tabla se convierte en tarjetas y las columnas necesitan nombre propio.
   */
  function cellLabel(text) {
    return el('span', 'cell-label only-screen', text);
  }

  function buildRateEditable() {
    return createEditable({
      type: 'select',
      field: 'ivaRate',
      label: 'Alícuota de IVA',
      className: 'ed--rate',
      options: IVA_RATES.map((r) => ({ value: r.value, label: r.label })),
      get: () => normalizeRate(getBudget().items[0] && getBudget().items[0].ivaRate),
      format: (v) => rateLabel(v),
      toInput: (v) => String(normalizeRate(v)),
      parse: (v) => normalizeRate(Number.parseFloat(v)),
      set: (v) => {
        getBudget().items.forEach((it) => applyRate(it, v));
        notify('iva-rate');
      }
    });
  }

  function buildItemRow(item, index) {
    const budget = getBudget();
    const tr = el('tr', 'item-row');
    tr.dataset.itemId = item.id;

    const tdDesc = el('td', 'cell-desc');
    tdDesc.appendChild(cellLabel('Descripción'));
    tdDesc.appendChild(buildSentence(item));

    const detalle = clause('detalle');
    detalle.classList.add('item-detail');
    detalle.appendChild(createEditable({
      type: 'textarea',
      field: `item:${item.id}:detalle`,
      label: 'Detalle adicional del servicio',
      placeholder: 'Agregar detalle (opcional)',
      fill: true,
      get: () => item.detalle,
      set: (v) => { item.detalle = v; notify('item'); }
    }));
    tdDesc.appendChild(detalle);

    if (budget.items.length > 1) {
      const tools = el('div', 'item-tools only-screen');
      const del = el('button', 'doc-chip doc-chip--danger');
      del.type = 'button';
      del.textContent = 'Eliminar renglón';
      del.setAttribute('aria-label', `Eliminar renglón ${index + 1}`);
      del.addEventListener('click', () => removeItem(item.id));
      tools.appendChild(del);
      tdDesc.appendChild(tools);
    }
    tr.appendChild(tdDesc);

    const tdNeto = el('td', 'cell-num');
    tdNeto.appendChild(cellLabel('Precio neto'));
    tdNeto.appendChild(createEditable({
      type: 'currency',
      field: `item:${item.id}:neto`,
      label: 'Precio neto',
      placeholder: '0,00',
      fill: true,
      get: () => item.neto,
      format: (v) => formatMoney(v, currency()),
      toInput: (v) => amountForInput(v),
      parse: (v) => parseMoney(v),
      set: (v) => { applyNeto(item, v); notify('importe'); }
    }));
    tr.appendChild(tdNeto);

    const tdIva = el('td', 'cell-num cell-iva');
    const ivaLabel = cellLabel('IVA ');
    ivaLabel.appendChild(buildRateEditable());
    tdIva.appendChild(ivaLabel);
    tdIva.appendChild(el('span', 'cell-static', formatMoney(item.iva, currency())));
    tr.appendChild(tdIva);

    const tdTotal = el('td', 'cell-num cell-total');
    tdTotal.appendChild(cellLabel('Total final'));
    tdTotal.appendChild(createEditable({
      type: 'currency',
      field: `item:${item.id}:total`,
      label: 'Total final',
      placeholder: '0,00',
      fill: true,
      get: () => item.total,
      format: (v) => formatMoney(v, currency()),
      toInput: (v) => amountForInput(v),
      parse: (v) => parseMoney(v),
      set: (v) => { applyTotal(item, v); notify('importe'); }
    }));
    tr.appendChild(tdTotal);

    return tr;
  }

  function buildTable() {
    const wrap = el('div', 'doc-table-wrap');
    const table = el('table', 'doc-table');

    const colgroup = document.createElement('colgroup');
    ['col-desc', 'col-neto', 'col-iva', 'col-total'].forEach((c) => {
      const col = document.createElement('col');
      col.className = c;
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.appendChild(el('th', 'th-desc', 'Descripción'));
    headRow.appendChild(el('th', 'th-num', 'Precio neto'));

    const thIva = el('th', 'th-num');
    thIva.appendChild(document.createTextNode('IVA '));
    thIva.appendChild(buildRateEditable());
    headRow.appendChild(thIva);

    headRow.appendChild(el('th', 'th-num', 'Total final'));
    thead.appendChild(headRow);
    table.appendChild(thead);

    tbody = document.createElement('tbody');
    table.appendChild(tbody);

    tfoot = document.createElement('tfoot');
    table.appendChild(tfoot);

    wrap.appendChild(table);

    const add = el('button', 'doc-add only-screen');
    add.type = 'button';
    add.innerHTML = '<span class="doc-add-plus" aria-hidden="true">+</span> Agregar renglón';
    add.addEventListener('click', addItem);
    wrap.appendChild(add);

    return wrap;
  }

  function renderRows() {
    const budget = getBudget();
    tbody.textContent = '';
    budget.items.forEach((item, index) => tbody.appendChild(buildItemRow(item, index)));
    renderFoot();
  }

  function renderFoot() {
    const budget = getBudget();
    tfoot.textContent = '';
    if (budget.items.length < 2) return;

    const sums = totals(budget.items);
    const tr = el('tr', 'total-row');
    tr.appendChild(el('td', 'cell-total-label', 'TOTAL'));

    [['Total neto', sums.neto], ['Total IVA', sums.iva], ['Total final', sums.total]].forEach(([label, value]) => {
      const cell = el('td', 'cell-num');
      cell.appendChild(cellLabel(label));
      cell.appendChild(el('span', 'cell-static', formatMoney(value, currency())));
      tr.appendChild(cell);
    });

    tfoot.appendChild(tr);
  }

  function addItem() {
    const budget = getBudget();
    const last = budget.items[budget.items.length - 1];
    budget.items.push(createItem({
      ivaRate: last ? last.ivaRate : 0.105,
      origen: last ? last.origen : ''
    }));
    renderRows();
    notify('items');
    const rows = tbody.querySelectorAll('.item-row');
    const target = rows[rows.length - 1];
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function removeItem(id) {
    const budget = getBudget();
    if (budget.items.length <= 1) return;
    budget.items = budget.items.filter((it) => it.id !== id);
    renderRows();
    notify('items');
  }

  /* ---------------------------------------------------------------- */
  /* Condiciones                                                        */
  /* ---------------------------------------------------------------- */

  function buildConditions() {
    const section = el('section', 'doc-conditions');
    section.setAttribute('aria-label', 'Condiciones del servicio');
    condList = el('ul', 'cond-list');
    section.appendChild(condList);

    const add = el('button', 'doc-add only-screen');
    add.type = 'button';
    add.innerHTML = '<span class="doc-add-plus" aria-hidden="true">+</span> Agregar condición';
    add.addEventListener('click', () => addCondition());
    section.appendChild(add);

    return section;
  }

  function renderConditions(focusId) {
    const budget = getBudget();
    condList.textContent = '';
    budget.condiciones.forEach((cond) => {
      const li = el('li', `cond${cond.bold ? ' is-bold' : ''}`);
      li.dataset.condId = cond.id;
      const editable = createEditable({
        type: 'textarea',
        field: `cond:${cond.id}`,
        label: 'Condición del servicio',
        placeholder: 'Escribí la condición',
        className: 'cond-text',
        fill: true,
        get: () => cond.texto,
        set: (v) => { cond.texto = v; notify('condicion'); }
      });
      li.appendChild(editable);
      condList.appendChild(li);

      if (focusId === cond.id) {
        requestAnimationFrame(() => {
          editable.focus();
          editable.beginEdit();
        });
      }
    });
  }

  function addCondition(afterId, preset) {
    const budget = getBudget();
    const nueva = { id: uid('c'), texto: preset ? preset.texto : '', bold: preset ? preset.bold : false };
    const index = afterId ? budget.condiciones.findIndex((c) => c.id === afterId) : -1;
    if (index === -1) budget.condiciones.push(nueva);
    else budget.condiciones.splice(index + 1, 0, nueva);
    renderConditions(nueva.id);
    notify('condiciones');
  }

  function findCondition(id) {
    return getBudget().condiciones.find((c) => c.id === id);
  }

  const conditionActions = {
    isBold(id) {
      const cond = findCondition(id);
      return Boolean(cond && cond.bold);
    },
    bold(id) {
      const cond = findCondition(id);
      if (!cond) return;
      cond.bold = !cond.bold;
      const li = condList.querySelector(`[data-cond-id="${CSS.escape(id)}"]`);
      if (li) li.classList.toggle('is-bold', cond.bold);
      notify('condicion');
    },
    duplicate(id) {
      const cond = findCondition(id);
      if (!cond) return;
      addCondition(id, { texto: cond.texto, bold: cond.bold });
    },
    move(id, delta) {
      const budget = getBudget();
      const index = budget.condiciones.findIndex((c) => c.id === id);
      const next = index + delta;
      if (index === -1 || next < 0 || next >= budget.condiciones.length) return;
      const [moved] = budget.condiciones.splice(index, 1);
      budget.condiciones.splice(next, 0, moved);
      renderConditions();
      notify('condiciones');
    },
    remove(id) {
      const budget = getBudget();
      budget.condiciones = budget.condiciones.filter((c) => c.id !== id);
      renderConditions();
      notify('condiciones');
    }
  };

  /* ---------------------------------------------------------------- */
  /* Validez                                                            */
  /* ---------------------------------------------------------------- */

  function buildValidity() {
    const p = clause('validez');
    p.classList.add('doc-validity');
    p.appendChild(createEditable({
      type: 'textarea',
      field: 'validez',
      label: 'Vigencia del presupuesto',
      placeholder: 'Vigencia del presupuesto',
      fill: true,
      get: () => getBudget().validez,
      set: (v) => { getBudget().validez = v; notify('validez'); }
    }));
    return p;
  }

  /* ---------------------------------------------------------------- */
  /* Montaje y actualización                                            */
  /* ---------------------------------------------------------------- */

  function render() {
    root.textContent = '';
    root.appendChild(buildHead());

    const body = el('div', 'doc-body');
    const watermark = el('img', 'doc-watermark');
    watermark.src = './assets/watermark.png';
    watermark.alt = '';
    watermark.setAttribute('aria-hidden', 'true');
    body.appendChild(watermark);

    const main = el('div', 'doc-main');
    main.appendChild(buildTitleBar());
    main.appendChild(buildClientLine());
    main.appendChild(buildTable());
    main.appendChild(buildConditions());
    main.appendChild(buildValidity());
    body.appendChild(main);
    root.appendChild(body);

    const foot = el('footer', 'doc-foot');
    const footImg = el('img');
    footImg.src = './assets/footer.png';
    footImg.alt = '';
    footImg.setAttribute('aria-hidden', 'true');
    foot.appendChild(footImg);
    root.appendChild(foot);

    renderRows();
    renderConditions();
  }

  /** Actualiza sólo los valores derivados, sin reconstruir el documento. */
  function refresh() {
    const budget = getBudget();

    tbody.querySelectorAll('.item-row').forEach((row) => {
      const item = budget.items.find((it) => it.id === row.dataset.itemId);
      if (!item) return;
      const ivaCell = row.querySelector('.cell-iva');
      if (!ivaCell) return;
      const value = ivaCell.querySelector('.cell-static');
      if (value) value.textContent = formatMoney(item.iva, currency());
    });

    root.querySelectorAll('.ed').forEach((node) => {
      if (typeof node.refresh === 'function') node.refresh();
    });

    renderFoot();
  }

  return {
    render,
    refresh,
    renderRows,
    renderConditions,
    conditionActions,
    addCondition,
    addItem,
    removeItem
  };
}

/**
 * Reduce proporcionalmente el contenido para que entre en la hoja A4 sin
 * recortes. Sólo actúa cuando el documento se muestra a tamaño de página.
 */
export function fitToPage(sheet) {
  const main = sheet.querySelector('.doc-main');
  if (!main) return 1;
  main.style.setProperty('--fit', '1');

  if (sheet.getBoundingClientRect().width < 700) return 1;

  let fit = 1;
  let guard = 0;
  while (main.scrollHeight > main.clientHeight + 1 && fit > 0.62 && guard < 24) {
    fit = roundCents(fit - 0.03);
    main.style.setProperty('--fit', String(fit));
    guard += 1;
  }
  return fit;
}
