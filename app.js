/**
 * EDEN VIAJES Y TURISMO - GENERADOR DE PRESUPUESTOS (APP.JS)
 * Arquitectura modular: Estado, Cálculos, Renderizado, Exportación PDF, PWA y Storage.
 */

(function() {
  'use strict';

  // Constantes de configuración
  const STORAGE_KEY_DRAFT = 'eden_presupuesto_draft_v2';
  const STORAGE_KEY_HISTORY = 'eden_presupuestos_history_v2';
  const LOVE_COOKIE = 'eden_mensaje_amor_visto';
  const LOVE_INTERVAL_DAYS = 7;
  const LOVE_INTERVAL_MS = LOVE_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

  // Estado inicial por defecto
  const defaultState = {
    fecha: obtenerFechaHoy(),
    numero: '',
    cliente: '',
    destino: '',
    moneda: '$',
    validez: 'Presupuesto válido por 7 días a partir de la fecha de emisión.',
    items: [
      {
        id: 'item-1',
        desc: 'Servicio de traslado saliendo el día ____ de _________________ del 2026 hacia ___________________ y regresando el día ____ de _________________ del 2026.',
        neto: 0,
        ivaRate: 0.105,
        total: 0
      }
    ],
    condiciones: [
      { id: 'c-1', texto: 'El servicio se seña con el 30% del valor total.', bold: false },
      { id: 'c-2', texto: 'Este valor está sujeto a los incrementos que puedan surgir hasta 5 días antes de la salida, de no haber cancelado la totalidad del mismo.', bold: false },
      { id: 'c-3', texto: 'Viáticos y alojamiento del chofer a cargo del contratante.', bold: false },
      { id: 'c-4', texto: 'El IVA será contemplado en caso de solicitar facturación o abonar mediante transferencia bancaria.', bold: true }
    ]
  };

  // Estado reactivo
  let appState = JSON.parse(JSON.stringify(defaultState));
  let deferredInstallPrompt = null;

  // =========================================================================
  // UTILIDADES DE FORMATO Y FECHA
  // =========================================================================
  function obtenerFechaHoy() {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  function parseAR(valor) {
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    let s = String(valor || '').trim().replace(/[^0-9,.-]/g, '');
    if (!s) return 0;

    const ultimaComa = s.lastIndexOf(',');
    const ultimoPunto = s.lastIndexOf('.');

    if (ultimaComa >= 0 && ultimoPunto >= 0) {
      s = ultimaComa > ultimoPunto
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
    } else if (ultimaComa >= 0) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (ultimoPunto >= 0) {
      const partes = s.split('.');
      if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
        s = partes.join('');
      }
    }
    return Number.parseFloat(s) || 0;
  }

  function redondearCentavos(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function fmtImporte(n) {
    const num = typeof n === 'number' ? n : parseAR(n);
    return num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // =========================================================================
  // CÁLCULOS
  // =========================================================================
  function recalcularItem(item, origen) {
    const ivaRate = typeof item.ivaRate === 'number' ? item.ivaRate : 0.105;
    if (origen === 'total') {
      const total = redondearCentavos(parseAR(item.total));
      const neto = redondearCentavos(total / (1 + ivaRate));
      const iva = redondearCentavos(total - neto);
      item.neto = neto;
      item.iva = iva;
      item.total = total;
    } else {
      const neto = redondearCentavos(parseAR(item.neto));
      const iva = redondearCentavos(neto * ivaRate);
      const total = redondearCentavos(neto + iva);
      item.neto = neto;
      item.iva = iva;
      item.total = total;
    }
  }

  function obtenerTotalesGlobales() {
    let subtotalNeto = 0;
    let totalIVA = 0;
    let totalFinal = 0;

    appState.items.forEach(item => {
      subtotalNeto += parseAR(item.neto);
      totalIVA += parseAR(item.iva || (item.total - item.neto));
      totalFinal += parseAR(item.total);
    });

    return {
      subtotalNeto: redondearCentavos(subtotalNeto),
      totalIVA: redondearCentavos(totalIVA),
      totalFinal: redondearCentavos(totalFinal)
    };
  }

  // =========================================================================
  // RENDERIZADO DEL FORMULARIO Y VISTA PREVIA
  // =========================================================================
  function renderizarTodo() {
    renderizarFormulario();
    renderizarVistaPreviaA4();
    guardarBorradorLocal();
    ajustarEscalaA4();
  }

  function renderizarFormulario() {
    // Datos generales
    const fInput = document.getElementById('inputFecha');
    if (fInput) fInput.value = appState.fecha || '';
    const numInput = document.getElementById('inputNumero');
    if (numInput) numInput.value = appState.numero || '';
    const cliInput = document.getElementById('inputCliente');
    if (cliInput) cliInput.value = appState.cliente || '';
    const destInput = document.getElementById('inputDestino');
    if (destInput) destInput.value = appState.destino || '';
    const monSelect = document.getElementById('selectMoneda');
    if (monSelect) monSelect.value = appState.moneda || '$';
    const valInput = document.getElementById('inputValidez');
    if (valInput) valInput.value = appState.validez || '';

    // Símbolos de moneda en los inputs
    document.querySelectorAll('.currency-symbol').forEach(el => {
      el.textContent = appState.moneda;
    });

    // Renderizar ítems
    const itemsList = document.getElementById('itemsList');
    if (itemsList) {
      itemsList.innerHTML = '';
      appState.items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
          <div class="item-card-header">
            <span class="item-badge">Renglón #${index + 1}</span>
            ${appState.items.length > 1 ? `<button type="button" class="btn-icon delete" title="Eliminar renglón" data-action="delete-item" data-id="${item.id}">✕</button>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Descripción del servicio o tramo</label>
            <textarea class="form-textarea item-desc-input" data-id="${item.id}" rows="2" placeholder="Detalle del traslado o servicio...">${escapeHTML(item.desc)}</textarea>
          </div>
          <div class="item-fields-grid">
            <div class="form-group">
              <label class="form-label">Tasa de IVA</label>
              <select class="form-select item-iva-rate" data-id="${item.id}">
                <option value="0.105" ${item.ivaRate === 0.105 ? 'selected' : ''}>10,5%</option>
                <option value="0.21" ${item.ivaRate === 0.21 ? 'selected' : ''}>21%</option>
                <option value="0" ${item.ivaRate === 0 ? 'selected' : ''}>0% (Exento)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Precio Neto</label>
              <div class="input-currency-wrapper">
                <span class="currency-symbol">${appState.moneda}</span>
                <input type="text" class="form-input item-neto-input" data-id="${item.id}" value="${fmtImporte(item.neto)}" inputmode="decimal">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Total Final</label>
              <div class="input-currency-wrapper">
                <span class="currency-symbol">${appState.moneda}</span>
                <input type="text" class="form-input item-total-input" data-id="${item.id}" value="${fmtImporte(item.total)}" inputmode="decimal">
              </div>
            </div>
          </div>
        `;
        itemsList.appendChild(card);
      });
    }

    // Totales globales en el editor
    const totales = obtenerTotalesGlobales();
    const edSub = document.getElementById('editorSubtotal');
    if (edSub) edSub.textContent = `${appState.moneda} ${fmtImporte(totales.subtotalNeto)}`;
    const edIva = document.getElementById('editorIVA');
    if (edIva) edIva.textContent = `${appState.moneda} ${fmtImporte(totales.totalIVA)}`;
    const edTot = document.getElementById('editorTotalFinal');
    if (edTot) edTot.textContent = `${appState.moneda} ${fmtImporte(totales.totalFinal)}`;

    // Renderizar condiciones
    const conditionsList = document.getElementById('conditionsList');
    if (conditionsList) {
      conditionsList.innerHTML = '';
      appState.condiciones.forEach((cond) => {
        const el = document.createElement('div');
        el.className = `condition-item ${cond.bold ? 'is-bold' : ''}`;
        el.innerHTML = `
          <textarea class="condition-input" data-id="${cond.id}" rows="1">${escapeHTML(cond.texto)}</textarea>
          <div class="condition-actions">
            <button type="button" class="btn-icon ${cond.bold ? 'active' : ''}" title="Alternar Negrita" data-action="toggle-bold" data-id="${cond.id}">B</button>
            <button type="button" class="btn-icon delete" title="Eliminar condición" data-action="delete-cond" data-id="${cond.id}">✕</button>
          </div>
        `;
        conditionsList.appendChild(el);
      });
    }
  }

  function renderizarVistaPreviaA4() {
    // Meta / Encabezado
    const a4Fecha = document.getElementById('a4Fecha');
    if (a4Fecha) a4Fecha.textContent = appState.fecha || obtenerFechaHoy();

    const clientWrapper = document.getElementById('a4ClientWrapper');
    if (clientWrapper) {
      if (appState.cliente || appState.destino) {
        let textoCliente = '';
        if (appState.cliente) textoCliente += `Cliente: ${appState.cliente}`;
        if (appState.destino) textoCliente += (textoCliente ? ' | ' : '') + `Destino: ${appState.destino}`;
        clientWrapper.innerHTML = `<span>${escapeHTML(textoCliente)}</span>`;
        clientWrapper.style.display = 'block';
      } else {
        clientWrapper.innerHTML = '';
        clientWrapper.style.display = 'none';
      }
    }

    // Tabla de ítems A4
    const tableBody = document.getElementById('a4TableBody');
    if (tableBody) {
      tableBody.innerHTML = '';
      appState.items.forEach(item => {
        recalcularItem(item, 'neto');
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <div class="a4-item-desc">${escapeHTML(item.desc)}</div>
          </td>
          <td class="text-right">
            <div class="a4-money-wrap"><span>${appState.moneda}</span> <span>${fmtImporte(item.neto)}</span></div>
          </td>
          <td class="text-right">
            <div class="a4-money-wrap"><span>${appState.moneda}</span> <span>${fmtImporte(item.iva || 0)}</span></div>
          </td>
          <td class="text-right">
            <div class="a4-money-wrap"><span>${appState.moneda}</span> <span>${fmtImporte(item.total)}</span></div>
          </td>
        `;
        tableBody.appendChild(tr);
      });
    }

    // Condiciones A4
    const a4CondList = document.getElementById('a4ConditionsList');
    if (a4CondList) {
      a4CondList.innerHTML = '';
      appState.condiciones.forEach(cond => {
        if (!cond.texto.trim()) return;
        const li = document.createElement('li');
        if (cond.bold) li.className = 'bold';
        li.textContent = cond.texto;
        a4CondList.appendChild(li);
      });
    }

    // Validez
    const a4Val = document.getElementById('a4Validity');
    if (a4Val) a4Val.textContent = appState.validez || '';
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // AJUSTE DE ESCALA EN VISTA PREVIA (RESPONSIVE)
  // =========================================================================
  function ajustarEscalaA4() {
    const a4El = document.getElementById('presupuestoA4');
    const viewport = document.querySelector('.a4-viewport');
    if (!a4El || !viewport) return;

    if (window.innerWidth <= 1024) {
      const containerWidth = viewport.clientWidth - 16;
      const a4WidthPx = 794;
      if (containerWidth > 0 && containerWidth < a4WidthPx) {
        const scale = containerWidth / a4WidthPx;
        a4El.style.transform = `scale(${scale})`;
        a4El.style.marginBottom = `-${(1123 * (1 - scale))}px`;
      } else {
        a4El.style.transform = 'none';
        a4El.style.marginBottom = '0';
      }
    } else {
      a4El.style.transform = 'none';
      a4El.style.marginBottom = '0';
    }
  }

  window.addEventListener('resize', ajustarEscalaA4);

  // =========================================================================
  // MANIPULACIÓN DE ESTADO / EVENTOS
  // =========================================================================
  function inicializarEventos() {
    // Inputs principales
    document.getElementById('inputFecha')?.addEventListener('input', (e) => {
      appState.fecha = e.target.value;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
    });

    document.getElementById('btnFechaHoy')?.addEventListener('click', () => {
      appState.fecha = obtenerFechaHoy();
      const el = document.getElementById('inputFecha');
      if (el) el.value = appState.fecha;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
      mostrarToast('📅 Fecha actualizada a hoy');
    });

    document.getElementById('inputNumero')?.addEventListener('input', (e) => {
      appState.numero = e.target.value;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
    });

    document.getElementById('inputCliente')?.addEventListener('input', (e) => {
      appState.cliente = e.target.value;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
    });

    document.getElementById('inputDestino')?.addEventListener('input', (e) => {
      appState.destino = e.target.value;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
    });

    document.getElementById('selectMoneda')?.addEventListener('change', (e) => {
      appState.moneda = e.target.value;
      renderizarTodo();
    });

    document.getElementById('inputValidez')?.addEventListener('input', (e) => {
      appState.validez = e.target.value;
      renderizarVistaPreviaA4();
      guardarBorradorLocal();
    });

    // Agregar nuevo renglón
    document.getElementById('btnAddItem')?.addEventListener('click', () => {
      const nuevoId = 'item-' + Date.now();
      appState.items.push({
        id: nuevoId,
        desc: 'Servicio de traslado...',
        neto: 0,
        ivaRate: 0.105,
        total: 0
      });
      renderizarTodo();
      mostrarToast('➕ Renglón agregado');
    });

    // Eventos delegados en lista de ítems
    const itemsList = document.getElementById('itemsList');
    if (itemsList) {
      itemsList.addEventListener('input', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        const item = appState.items.find(i => i.id === id);
        if (!item) return;

        if (target.classList.contains('item-desc-input')) {
          item.desc = target.value;
          renderizarVistaPreviaA4();
          guardarBorradorLocal();
        } else if (target.classList.contains('item-neto-input')) {
          item.neto = parseAR(target.value);
          recalcularItem(item, 'neto');
          actualizarCamposItemEnDOM(id, item);
          renderizarVistaPreviaA4();
          guardarBorradorLocal();
        } else if (target.classList.contains('item-total-input')) {
          item.total = parseAR(target.value);
          recalcularItem(item, 'total');
          actualizarCamposItemEnDOM(id, item);
          renderizarVistaPreviaA4();
          guardarBorradorLocal();
        }
      });

      itemsList.addEventListener('change', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        const item = appState.items.find(i => i.id === id);
        if (!item) return;

        if (target.classList.contains('item-iva-rate')) {
          item.ivaRate = Number.parseFloat(target.value) || 0;
          recalcularItem(item, 'neto');
          renderizarTodo();
        } else if (target.classList.contains('item-neto-input')) {
          target.value = fmtImporte(item.neto);
        } else if (target.classList.contains('item-total-input')) {
          target.value = fmtImporte(item.total);
        }
      });

      itemsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete-item"]');
        if (btn) {
          const id = btn.dataset.id;
          if (appState.items.length <= 1) {
            alert('Debe existir al menos un renglón en el presupuesto.');
            return;
          }
          appState.items = appState.items.filter(i => i.id !== id);
          renderizarTodo();
          mostrarToast('🗑️ Renglón eliminado');
        }
      });
    }

    function actualizarCamposItemEnDOM(id, item) {
      if (!itemsList) return;
      const card = itemsList.querySelector(`.item-card:has([data-id="${id}"])`);
      if (!card) return;
      const netoInput = card.querySelector('.item-neto-input');
      const totalInput = card.querySelector('.item-total-input');
      if (document.activeElement !== netoInput && netoInput) netoInput.value = fmtImporte(item.neto);
      if (document.activeElement !== totalInput && totalInput) totalInput.value = fmtImporte(item.total);

      const totales = obtenerTotalesGlobales();
      const edSub = document.getElementById('editorSubtotal');
      if (edSub) edSub.textContent = `${appState.moneda} ${fmtImporte(totales.subtotalNeto)}`;
      const edIva = document.getElementById('editorIVA');
      if (edIva) edIva.textContent = `${appState.moneda} ${fmtImporte(totales.totalIVA)}`;
      const edTot = document.getElementById('editorTotalFinal');
      if (edTot) edTot.textContent = `${appState.moneda} ${fmtImporte(totales.totalFinal)}`;
    }

    // Agregar nueva condición
    document.getElementById('btnAddCondition')?.addEventListener('click', () => {
      const nuevoId = 'c-' + Date.now();
      appState.condiciones.push({
        id: nuevoId,
        texto: 'Nueva condición comercial...',
        bold: false
      });
      renderizarTodo();
      mostrarToast('➕ Condición agregada');
    });

    // Eventos delegados en lista de condiciones
    const conditionsList = document.getElementById('conditionsList');
    if (conditionsList) {
      conditionsList.addEventListener('input', (e) => {
        const target = e.target;
        if (target.classList.contains('condition-input')) {
          const id = target.dataset.id;
          const cond = appState.condiciones.find(c => c.id === id);
          if (cond) {
            cond.texto = target.value;
            renderizarVistaPreviaA4();
            guardarBorradorLocal();
          }
        }
      });

      conditionsList.addEventListener('click', (e) => {
        const btnBold = e.target.closest('[data-action="toggle-bold"]');
        if (btnBold) {
          const id = btnBold.dataset.id;
          const cond = appState.condiciones.find(c => c.id === id);
          if (cond) {
            cond.bold = !cond.bold;
            renderizarTodo();
          }
          return;
        }
        const btnDel = e.target.closest('[data-action="delete-cond"]');
        if (btnDel) {
          const id = btnDel.dataset.id;
          if (appState.condiciones.length <= 1) {
            alert('Debe haber al menos una condición en el presupuesto.');
            return;
          }
          appState.condiciones = appState.condiciones.filter(c => c.id !== id);
          renderizarTodo();
          mostrarToast('🗑️ Condición eliminada');
        }
      });
    }

    // Plantillas rápidas de condiciones
    document.querySelectorAll('.chip-btn[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const texto = btn.getAttribute('data-template');
        const bold = btn.getAttribute('data-bold') === 'true';
        appState.condiciones.push({
          id: 'c-' + Date.now(),
          texto: texto,
          bold: bold
        });
        renderizarTodo();
        mostrarToast('✓ Plantilla agregada a condiciones');
      });
    });

    // Botones de acción principales
    document.querySelectorAll('.btn-download-pdf').forEach(btn => {
      btn.addEventListener('click', descargarPDF);
    });

    document.querySelectorAll('.btn-print-native').forEach(btn => {
      btn.addEventListener('click', () => window.print());
    });

    document.querySelectorAll('.btn-share-whatsapp').forEach(btn => {
      btn.addEventListener('click', compartirWhatsApp);
    });

    document.querySelectorAll('.btn-new-budget').forEach(btn => {
      btn.addEventListener('click', nuevoPresupuesto);
    });

    document.getElementById('btnSaveHistory')?.addEventListener('click', guardarEnHistorial);
    document.getElementById('btnOpenHistory')?.addEventListener('click', abrirModalHistorial);

    // Selector de pestañas móvil
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.dataset.tab;

        const editorPanel = document.querySelector('.editor-panel');
        const previewPanel = document.querySelector('.preview-panel');

        if (target === 'editor') {
          if (editorPanel) editorPanel.classList.remove('tab-hidden');
          if (previewPanel) previewPanel.classList.add('tab-hidden');
        } else {
          if (editorPanel) editorPanel.classList.add('tab-hidden');
          if (previewPanel) previewPanel.classList.remove('tab-hidden');
          ajustarEscalaA4();
        }
      });
    });
  }

  // =========================================================================
  // DESCARGA DIRECTA DE PDF (HTML2PDF OFFLINE / WINDOW.PRINT)
  // =========================================================================
  async function descargarPDF() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.hidden = false;

    // Asegurar que el estado esté totalmente actualizado en el DOM
    renderizarVistaPreviaA4();

    const a4El = document.getElementById('presupuestoA4');
    const fechaNombre = (appState.fecha || 'presupuesto').replace(/\//g, '-');
    const clienteNombre = (appState.cliente || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const nombreArchivo = `Presupuesto_Eden_${fechaNombre}${clienteNombre ? '_' + clienteNombre : ''}.pdf`;

    if (window.html2pdf) {
      const prevTransform = a4El.style.transform;
      const prevMargin = a4El.style.marginBottom;
      a4El.style.transform = 'none';
      a4El.style.marginBottom = '0';

      const opt = {
        margin: 0,
        filename: nombreArchivo,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        }
      };

      try {
        await window.html2pdf().set(opt).from(a4El).save();
        mostrarToast('✅ PDF descargado exitosamente');
      } catch (err) {
        console.warn('Error al generar PDF con html2pdf, recurriendo a impresión nativa:', err);
        window.print();
      } finally {
        a4El.style.transform = prevTransform;
        a4El.style.marginBottom = prevMargin;
        if (loadingOverlay) loadingOverlay.hidden = true;
      }
    } else {
      if (loadingOverlay) loadingOverlay.hidden = true;
      window.print();
    }
  }

  // =========================================================================
  // COMPARTIR POR WHATSAPP
  // =========================================================================
  function compartirWhatsApp() {
    const totales = obtenerTotalesGlobales();
    let texto = `🚌 *PRESUPUESTO - EDEN VIAJES Y TURISMO*\n`;
    texto += `📅 *Fecha:* ${appState.fecha || obtenerFechaHoy()}\n`;
    if (appState.cliente) texto += `👤 *Cliente:* ${appState.cliente}\n`;
    if (appState.destino) texto += `📍 *Destino:* ${appState.destino}\n`;
    texto += `\n📌 *Detalle del Servicio:*\n`;

    appState.items.forEach((item) => {
      texto += `• ${item.desc.trim()}\n`;
      texto += `  _Importe:_ ${appState.moneda} ${fmtImporte(item.total)}\n`;
    });

    texto += `\n💰 *TOTAL FINAL:* ${appState.moneda} ${fmtImporte(totales.totalFinal)}\n`;
    texto += `\n📋 *Condiciones:*\n`;
    appState.condiciones.forEach(c => {
      if (c.texto.trim()) texto += `• ${c.texto.trim()}\n`;
    });

    if (appState.validez) {
      texto += `\n⏳ _${appState.validez}_\n`;
    }

    texto += `\n📞 *Consultas:* 2994135341 - 2996326712 | Eden.turismo.srl@gmail.com`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('📋 ¡Texto copiado listo para pegar en WhatsApp!');
      }).catch(() => {
        abrirEnlaceWhatsApp(texto);
      });
    } else {
      abrirEnlaceWhatsApp(texto);
    }
  }

  function abrirEnlaceWhatsApp(texto) {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  // =========================================================================
  // LOCALSTORAGE / BORRADOR Y HISTORIAL
  // =========================================================================
  function guardarBorradorLocal() {
    try {
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(appState));
    } catch (e) {}
  }

  function cargarBorradorLocal() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DRAFT);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          appState = parsed;
        }
      }
    } catch (e) {}
  }

  function nuevoPresupuesto() {
    if (confirm('¿Deseás crear un nuevo presupuesto? Se limpiará el formulario actual.')) {
      appState = JSON.parse(JSON.stringify(defaultState));
      appState.fecha = obtenerFechaHoy();
      renderizarTodo();
      mostrarToast('✨ Nuevo presupuesto listo');
    }
  }

  function guardarEnHistorial() {
    const titulo = prompt('Ingresá un nombre o referencia para guardar este presupuesto:', appState.cliente || `Presupuesto ${appState.fecha}`);
    if (titulo === null) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      const historial = raw ? JSON.parse(raw) : [];
      const itemHistorial = {
        id: 'hist-' + Date.now(),
        titulo: titulo || `Presupuesto ${appState.fecha}`,
        fechaGuardado: new Date().toLocaleString('es-AR'),
        data: JSON.parse(JSON.stringify(appState))
      };
      historial.unshift(itemHistorial);
      if (historial.length > 30) historial.pop();
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historial));
      mostrarToast('💾 Presupuesto guardado en el historial');
    } catch (e) {
      alert('No se pudo guardar en el historial local.');
    }
  }

  function abrirModalHistorial() {
    const modal = document.getElementById('historyModal');
    const container = document.getElementById('historyList');
    if (!modal || !container) return;

    let historial = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      historial = raw ? JSON.parse(raw) : [];
    } catch (e) {}

    if (historial.length === 0) {
      container.innerHTML = '<p style="color:#6b7280;text-align:center;padding:16px 0;">No hay presupuestos guardados aún.</p>';
    } else {
      container.innerHTML = '';
      historial.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;';
        div.innerHTML = `
          <div>
            <div style="font-weight:700;font-size:13.5px;color:#1f2937;">${escapeHTML(item.titulo)}</div>
            <div style="font-size:11.5px;color:#6b7280;">Guardado: ${escapeHTML(item.fechaGuardado)}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm btn-primary" data-action="load-history" data-id="${item.id}">Cargar</button>
            <button type="button" class="btn btn-sm btn-danger" data-action="delete-history" data-id="${item.id}">✕</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    modal.hidden = false;
  }

  document.getElementById('historyList')?.addEventListener('click', (e) => {
    const btnLoad = e.target.closest('[data-action="load-history"]');
    if (btnLoad) {
      const id = btnLoad.dataset.id;
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      const historial = raw ? JSON.parse(raw) : [];
      const encontrado = historial.find(h => h.id === id);
      if (encontrado && encontrado.data) {
        appState = JSON.parse(JSON.stringify(encontrado.data));
        renderizarTodo();
        document.getElementById('historyModal').hidden = true;
        mostrarToast('📂 Presupuesto cargado exitosamente');
      }
      return;
    }

    const btnDel = e.target.closest('[data-action="delete-history"]');
    if (btnDel) {
      const id = btnDel.dataset.id;
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      let historial = raw ? JSON.parse(raw) : [];
      historial = historial.filter(h => h.id !== id);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historial));
      abrirModalHistorial();
      mostrarToast('🗑️ Eliminado del historial');
    }
  });

  document.getElementById('btnHistoryClose')?.addEventListener('click', () => {
    document.getElementById('historyModal').hidden = true;
  });

  // =========================================================================
  // MENSAJE DE AMOR Y PWA
  // =========================================================================
  function leerMarcaMensajeAmor() {
    let marca = '';
    try {
      const match = document.cookie.split('; ').find(row => row.startsWith(encodeURIComponent(LOVE_COOKIE) + '='));
      if (match) marca = decodeURIComponent(match.split('=')[1]);
    } catch (e) {}
    if (!marca) {
      try { marca = localStorage.getItem(LOVE_COOKIE) || ''; } catch (e) {}
    }
    return Number(marca) || 0;
  }

  function guardarMarcaMensajeAmor(marca) {
    const maxAge = LOVE_INTERVAL_DAYS * 24 * 60 * 60;
    try {
      document.cookie = `${encodeURIComponent(LOVE_COOKIE)}=${encodeURIComponent(marca)}; max-age=${maxAge}; path=/; SameSite=Lax`;
    } catch (e) {}
    try {
      localStorage.setItem(LOVE_COOKIE, String(marca));
    } catch (e) {}
  }

  function verificarMensajeAmor() {
    const ultimaVez = leerMarcaMensajeAmor();
    if (!ultimaVez || Date.now() - ultimaVez >= LOVE_INTERVAL_MS) {
      guardarMarcaMensajeAmor(Date.now());
      const modal = document.getElementById('loveModal');
      if (modal) modal.hidden = false;
    }
  }

  window.cerrarMensajeAmor = function() {
    const modal = document.getElementById('loveModal');
    if (modal) modal.hidden = true;
  };

  // Toast Helper
  let toastTimer = null;
  function mostrarToast(msg) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  // PWA Instalación
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('btnInstallApp');
    if (btn) {
      btn.hidden = false;
      btn.textContent = '▣ Instalar App';
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('btnInstallApp');
    if (btn) {
      btn.textContent = '✓ App Instalada';
      btn.disabled = true;
    }
  });

  window.instalarApp = async function() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (err) {}
      deferredInstallPrompt = null;
      return;
    }
    const modalHelp = document.getElementById('installHelpModal');
    if (modalHelp) modalHelp.hidden = false;
  };

  window.cerrarAyudaInstalacion = function() {
    const modalHelp = document.getElementById('installHelpModal');
    if (modalHelp) modalHelp.hidden = true;
  };

  // =========================================================================
  // INICIALIZACIÓN GENERAL
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    cargarBorradorLocal();
    inicializarEventos();
    renderizarTodo();
    verificarMensajeAmor();

    // Service Worker
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW registration failed:', err);
      });
    }
  });

})();
