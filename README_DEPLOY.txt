EDEN VIAJES Y TURISMO - PRESUPUESTO WEB / PWA (DEPLOY)
=========================================================

Estructura de archivos:
-----------------------
- index.html                   -> Estructura principal y aplicación web
- styles.css                   -> Estilos visuales responsive y reglas A4 de impresión/PDF
- app.js                       -> Lógica del cotizador, cálculos, almacenamiento y exportación
- manifest.webmanifest         -> Configuración PWA (instalable como App)
- sw.js                        -> Service Worker (caché y funcionamiento 100% offline)
- libs/
    - html2pdf.bundle.min.js   -> Motor de generación de PDF integrado offline
- assets/
    - header.png               -> Encabezado oficial con logo
    - watermark.png            -> Marca de agua
    - footer.png               -> Pie de página
- icons/
    - icon-192.png
    - icon-512.png

Novedades y Mejoras Implementadas:
----------------------------------
1. DESCARGA DE PDF DIRECTA Y NÍTIDA (A4 EXACTO):
   - Integración de generación directa en PDF con botón "Descargar PDF A4".
   - Soporte para impresión nativa (Ctrl+P) 100% fiel al formato A4 sin cortes de página.
   - Ajuste milimétrico para evitar hojas en blanco adicionales.

2. INTERFAZ MÓVIL Y ADAPTATIVA (RESPONSIVE):
   - Diseño moderno para celulares con selector de pestañas (Editor / Vista Previa A4).
   - Barra de acciones rápida accesible con el pulgar.
   - Escala automática de la vista previa A4 para ver el documento en cualquier pantalla.

3. SISTEMA DE EDICIÓN AVANZADO:
   - Renglones/servicios dinámicos: agregá o eliminá tramos y servicios.
   - Selector de alícuota de IVA independiente por renglón (10,5%, 21% o Exento 0%).
   - Moneda configurable (Pesos $ ARS o Dólares USD).
   - Cálculo automático bidireccional (de Neto a Total o de Total a Neto).
   - Formateo automático de importes en tiempo real.
   - Condiciones comerciales interactivas con plantillas rápidas sugeridas.

4. UTILIDADES:
   - Compartir por WhatsApp: genera un resumen con formato y emojis para enviar al cliente.
   - Historial de presupuestos y autoguardado en LocalStorage (nunca perdés los datos).
   - PWA instalable con soporte offline completo mediante HTTPS.
