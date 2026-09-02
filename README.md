# Eden Viajes y Turismo — Generador de Presupuestos Web & PWA

Aplicación web y PWA para armar los presupuestos de **Eden Viajes y Turismo SRL** desde el celular o la computadora, con descarga en PDF A4 y funcionamiento offline.

El presupuesto **es** el editor: se abre la aplicación, se ve el documento terminado y se toca cualquier dato para cambiarlo. No hay formularios, ni panel lateral, ni vista previa aparte.

---

## Cómo se usa

1. Abrir la aplicación: aparece el presupuesto, listo para editar.
2. Tocar o hacer clic sobre cualquier dato variable (fecha, origen, destino, importes, condiciones) y escribirlo.
3. El IVA y los totales se recalculan solos, y todo se guarda solo.
4. Tocar **Descargar PDF**.

`Enter` confirma, `Escape` cancela y `Tab` pasa al dato siguiente.

---

## Características

- **Edición directa sobre el documento.** Cada dato variable es texto común hasta que se lo toca; recién ahí aparece el control adecuado (texto, fecha, importe, lista) con el teclado que corresponde en el celular.
- **Mobile real.** El documento se reorganiza según el ancho disponible: en pantallas angostas la tabla se convierte en tarjetas legibles y el encabezado se reacomoda. Desde 320 px, sin scroll horizontal ni textos ilegibles.
- **Hoja A4 en escritorio.** Fondo neutro, hoja blanca centrada con sombra suave: se edita como sobre un papel.
- **PDF siempre igual.** La exportación se arma sobre un escenario fijo de 210 × 297 mm, así que el PDF sale idéntico desde un celular, una tablet o una PC.
- **Cálculo de IVA bidireccional.** De precio neto a total, o de total a neto, con alícuota 10,5 %, 21 % o exento.
- **Autoguardado.** Cada cambio se persiste en `localStorage` con un indicador discreto de "Guardando…" / "Guardado".
- **Historial** de presupuestos guardados y **resumen para WhatsApp**.
- **PWA instalable** con caché offline completa (incluido el motor de PDF).

---

## Estructura del proyecto

```
├── index.html                  # Barra superior mínima, hoja y diálogos
├── css/
│   ├── app.css                 # Marco de la aplicación: barra, menús, diálogos, avisos
│   └── document.css            # El documento: A4 base + adaptación por container queries
├── js/
│   ├── app.js                  # Arranque: une estado, documento, autoguardado y acciones
│   ├── state.js                # Fuente única de verdad (`budget`), persistencia y migración
│   ├── document.js             # Construye el documento editable
│   ├── editable.js             # Edición directa (texto, área, fecha, importe, lista)
│   ├── calc.js                 # IVA y totales
│   ├── format.js               # Formato de importes y fechas en castellano
│   ├── validation.js           # Datos obligatorios antes de exportar
│   ├── toolbar.js              # Barra contextual de las condiciones
│   ├── pdf.js                  # Escenario A4, exportación e impresión
│   ├── ui.js                   # Avisos, diálogos e indicador de guardado
│   ├── history.js              # Presupuestos guardados
│   ├── share.js                # Resumen para WhatsApp
│   ├── love.js                 # Mensaje personal
│   └── pwa.js                  # Instalación y service worker
├── manifest.webmanifest        # Configuración PWA
├── sw.js                       # Service Worker (caché y offline)
├── libs/
│   └── html2pdf.bundle.min.js  # Motor de PDF offline
├── assets/                     # Encabezado, logo, marca de agua y pie
└── icons/                      # Íconos de la PWA
```

---

## Cómo funciona por dentro

- **Un solo estado.** Todo (documento, edición, guardado y PDF) lee y escribe el mismo objeto `budget`. No hay estado del editor separado del de la vista.
- **Responsive por container queries.** Las reglas del documento dependen del ancho de la propia hoja, no del viewport. Por eso la copia que se exporta, que siempre mide 210 mm, se compone con el diseño A4 completo aunque se genere desde un celular.
- **Nada de la aplicación viaja al PDF.** La copia que se captura se limpia antes: se quitan botones, placeholders, ayudas visuales y atributos de edición.

---

## Despliegue

1. Subir todo el contenido a un hosting estático (Vercel, Netlify, GitHub Pages, Firebase Hosting o servidor propio).
2. Servir bajo **HTTPS** para habilitar el Service Worker y la instalación como aplicación.

No hay paso de compilación: son archivos estáticos y módulos ES nativos.

---

Desarrollado para **Eden Viajes y Turismo SRL**.
