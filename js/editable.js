/**
 * Edición directa sobre el documento.
 *
 * Cada campo variable del presupuesto es un `<span class="ed">` que se ve como
 * texto normal. Al tocarlo o hacerle clic se reemplaza por el control nativo que
 * corresponde (texto, área de texto, fecha, importe o lista), y al confirmar
 * vuelve a ser texto. No se usa `contenteditable`: así el teclado del celular,
 * el selector de fechas y el formato quedan bajo control del componente.
 */

const EDITABLE_SELECTOR = '.ed:not([data-locked="true"])';

let mirror = null;
let activeEditable = null;

function getMirror() {
  if (!mirror) {
    mirror = document.createElement('span');
    mirror.className = 'ed-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mirror);
  }
  return mirror;
}

/** Mantiene el campo a la vista cuando aparece el teclado virtual. */
function keepVisible(el) {
  const run = () => {
    if (!el.isConnected) return;
    const vv = window.visualViewport;
    const top = vv ? vv.offsetTop : 0;
    const height = vv ? vv.height : window.innerHeight;
    const rect = el.getBoundingClientRect();
    const margin = 24;
    if (rect.top < top + margin || rect.bottom > top + height - margin) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  requestAnimationFrame(run);
  setTimeout(run, 260);
  setTimeout(run, 620);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    if (activeEditable && activeEditable.isConnected) keepVisible(activeEditable);
  });
}

/**
 * Un toque que empieza y termina sobre el mismo campo abre la edición, aunque
 * el documento se haya reacomodado en el medio: al confirmar el campo anterior
 * el texto cambia de ancho y el navegador termina disparando el `click` sobre
 * un ancestro común en vez del campo tocado.
 */
let pointerStart = null;

function editableFrom(node) {
  return node && node.closest ? node.closest(EDITABLE_SELECTOR) : null;
}

function withinReach(el, event) {
  const rect = el.getBoundingClientRect();
  const slack = 20;
  return (
    event.clientX >= rect.left - slack &&
    event.clientX <= rect.right + slack &&
    event.clientY >= rect.top - slack &&
    event.clientY <= rect.bottom + slack
  );
}

document.addEventListener('pointerdown', (event) => {
  const target = editableFrom(event.target);
  pointerStart = target ? { target, x: event.clientX, y: event.clientY } : null;
}, true);

document.addEventListener('click', (event) => {
  const start = pointerStart;
  pointerStart = null;

  let target = editableFrom(event.target);
  if (!target && start && start.target.isConnected && withinReach(start.target, event)) {
    target = start.target;
  }
  if (!target || typeof target.beginEdit !== 'function' || target.isEditing()) return;
  target.beginEdit();
}, true);

function editablesInOrder(root) {
  const scope = root || document;
  return Array.from(scope.querySelectorAll(EDITABLE_SELECTOR))
    .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

function focusAdjacent(el, backwards) {
  const list = editablesInOrder(el.closest('.sheet') || document);
  const index = list.indexOf(el);
  if (index === -1) return false;
  const next = list[index + (backwards ? -1 : 1)];
  if (!next) return false;
  next.focus();
  if (typeof next.beginEdit === 'function') next.beginEdit();
  return true;
}

/**
 * @param {Object} config
 * @param {'text'|'textarea'|'currency'|'number'|'date'|'select'} config.type
 * @param {() => any} config.get        lectura desde el modelo
 * @param {(value:any) => void} config.set escritura en el modelo (recibe el valor ya saneado)
 * @param {(value:any) => string} [config.format] cómo se muestra cuando no se edita
 * @param {(raw:string) => any} [config.parse] cómo se sanea lo que se escribió
 * @param {(value:any) => string} [config.toInput] valor inicial del control
 * @param {string} [config.placeholder] pista cuando está vacío (no sale en el PDF)
 * @param {string} [config.label] aria-label
 * @param {string} [config.field] identificador para validaciones
 * @param {{value:string,label:string}[]} [config.options] para `select`
 * @param {boolean} [config.fill] ocupa el ancho disponible en vez de ajustarse al texto
 * @param {string} [config.className]
 */
export function createEditable(config) {
  const {
    type = 'text',
    get,
    set,
    format,
    parse,
    toInput,
    placeholder = '',
    label,
    field,
    options = [],
    fill = false,
    className = '',
    maxLength
  } = config;

  const el = document.createElement('span');
  el.className = ['ed', `ed--${type}`, fill ? 'ed--fill' : '', className].filter(Boolean).join(' ');
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.dataset.type = type;
  if (label) el.setAttribute('aria-label', label);
  if (field) el.dataset.field = field;

  let editing = false;
  let cancelled = false;
  let input = null;
  let painted = null;
  let original = null;
  let live = false;

  const display = () => (format ? format(get()) : String(get() == null ? '' : get()));

  /**
   * Sólo toca el DOM cuando el texto cambió. Repintar en cada actualización
   * invalidaba el nodo que el dedo estaba tocando y encarecía cada tecla.
   */
  function render() {
    if (editing) return;
    const text = display();
    if (painted === text) return;
    painted = text;
    el.textContent = '';
    const empty = text === '' || text == null;
    el.classList.toggle('is-empty', empty);
    el.dataset.empty = empty ? 'true' : 'false';
    if (empty) {
      const ph = document.createElement('span');
      ph.className = 'ed-ph';
      ph.textContent = placeholder || '—';
      el.appendChild(ph);
    } else {
      el.appendChild(document.createTextNode(text));
    }
  }

  function autosize() {
    if (!input) return;
    if (type === 'textarea') {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
      return;
    }
    if (fill || type === 'date' || type === 'select') return;
    const m = getMirror();
    const cs = window.getComputedStyle(input);
    m.style.font = cs.font;
    m.style.letterSpacing = cs.letterSpacing;
    m.style.textTransform = cs.textTransform;
    m.textContent = input.value || input.placeholder || '';
    const width = Math.ceil(m.getBoundingClientRect().width) + 2;
    input.style.width = `${Math.max(width, 18)}px`;
  }

  function buildInput() {
    let node;
    if (type === 'textarea') {
      node = document.createElement('textarea');
      node.rows = 1;
    } else if (type === 'select') {
      node = document.createElement('select');
      options.forEach((opt) => {
        const o = document.createElement('option');
        o.value = String(opt.value);
        o.textContent = opt.label;
        node.appendChild(o);
      });
    } else {
      node = document.createElement('input');
      if (type === 'date') {
        node.type = 'date';
      } else {
        node.type = 'text';
        if (type === 'currency') node.inputMode = 'decimal';
        if (type === 'number') node.inputMode = 'numeric';
        if (type === 'text') node.autocapitalize = 'sentences';
      }
      node.autocomplete = 'off';
      node.spellcheck = type === 'text';
    }

    node.className = 'ed-input';
    if (maxLength) node.maxLength = maxLength;
    if (placeholder && type !== 'select' && type !== 'date') node.placeholder = placeholder;
    if (label) node.setAttribute('aria-label', label);

    const raw = get();
    node.value = toInput ? toInput(raw) : (raw == null ? '' : String(raw));
    return node;
  }

  function beginEdit() {
    if (editing || el.dataset.locked === 'true') return;
    editing = true;
    cancelled = false;
    painted = null;
    live = false;
    original = get();
    activeEditable = el;
    el.classList.add('is-editing');
    el.classList.remove('has-error');
    el.textContent = '';

    input = buildInput();
    el.appendChild(input);
    autosize();

    input.addEventListener('input', () => {
      autosize();
      if (type === 'textarea' || type === 'text') commit({ keepEditing: true });
    });
    input.addEventListener('change', () => {
      // Elegir del calendario o de la lista ya es la confirmación del dato.
      if (type === 'select' || type === 'date') commit();
      else autosize();
    });
    input.addEventListener('blur', () => {
      if (cancelled) {
        cancelled = false;
        revert();
        endEdit();
        return;
      }
      commit();
    });
    input.addEventListener('keydown', onKeyDown);

    input.focus();
    if (type !== 'date' && type !== 'select' && typeof input.select === 'function') input.select();
    if (type === 'date' && typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (err) { /* el navegador puede rechazarlo */ }
    }
    keepVisible(el);
    el.dispatchEvent(new CustomEvent('ed:begin', { bubbles: true, detail: { field } }));
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      input.blur();
      el.focus();
      return;
    }
    if (event.key === 'Enter') {
      if (type === 'textarea' && event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      commit();
      el.focus();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      commit();
      if (!focusAdjacent(el, event.shiftKey)) el.focus();
    }
  }

  function endEdit() {
    editing = false;
    input = null;
    if (activeEditable === el) activeEditable = null;
    el.classList.remove('is-editing');
    render();
    el.dispatchEvent(new CustomEvent('ed:end', { bubbles: true, detail: { field } }));
  }

  /** Deshace lo que se fue escribiendo en vivo cuando la edición se cancela. */
  function revert() {
    if (!live) return;
    live = false;
    set(original);
    el.dispatchEvent(new CustomEvent('ed:change', { bubbles: true, detail: { field, value: original } }));
  }

  /**
   * @param {{keepEditing?: boolean}} [opts] cuando es `true` sólo actualiza el
   * modelo (escritura en vivo) sin cerrar el editor.
   */
  function commit(opts = {}) {
    if (!editing || !input) return;
    const value = parse ? parse(input.value) : input.value;
    set(value);
    el.dispatchEvent(new CustomEvent('ed:change', { bubbles: true, detail: { field, value } }));
    if (opts.keepEditing) {
      live = true;
      return;
    }
    live = false;
    endEdit();
  }

  el.addEventListener('keydown', (event) => {
    // El control quitado del DOM al confirmar sigue burbujeando su tecla: sin
    // este filtro, el Enter que cierra la edición la volvería a abrir.
    if (editing || event.target !== el) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      beginEdit();
    }
  });

  el.refresh = () => { if (!editing) render(); };
  el.beginEdit = beginEdit;
  el.isEditing = () => editing;

  render();
  return el;
}

export function markError(root, fields) {
  root.querySelectorAll('.ed.has-error').forEach((el) => el.classList.remove('has-error'));
  let first = null;
  fields.forEach((f) => {
    const el = root.querySelector(`.ed[data-field="${CSS.escape(f)}"]`);
    if (el) {
      el.classList.add('has-error');
      if (!first) first = el;
    }
  });
  return first;
}

export function clearErrors(root) {
  root.querySelectorAll('.ed.has-error').forEach((el) => el.classList.remove('has-error'));
}

export function blurActiveEditable() {
  const el = document.activeElement;
  if (el && el.classList && el.classList.contains('ed-input')) el.blur();
  activeEditable = null;
}
