# Eden Viajes y Turismo — Generador de Presupuestos Web & PWA

Aplicación web y PWA para la cotización y generación de presupuestos de **Eden Viajes y Turismo SRL**, optimizada para dispositivos móviles, tablets y computadoras, con exportación fiel a PDF A4 y funcionamiento 100% offline.

---

## 🚀 Características y Mejoras

- **📱 Diseño Responsive & Mobile-First:**
  - Selector de pestañas para celulares y tablets (**Editor** / **Vista Previa A4**).
  - Barra flotante inferior de acciones rápidas.
  - Escala automática de la hoja A4 para previsualizar sin desbordes en cualquier pantalla.

- **📄 Descarga Directa de PDF A4:**
  - Generación de PDF nítido en alta calidad (mediante `html2pdf.js` integrado localmente).
  - Impresión nativa (`window.print()` / `Ctrl+P`) con reglas milimétricas para hoja A4 (210mm × 297mm) sin cortes de página.

- **✏️ Sistema de Edición Inteligente:**
  - **Múltiples renglones/servicios dinámicos:** agregá y eliminá tramos de viaje.
  - **Cálculo bidireccional:** calculá desde *Precio Neto* a *Total* o desde *Total Final* a *Neto*.
  - **IVA configurable:** alícuota por renglón (10,5%, 21% o Exento 0%).
  - **Moneda:** selección entre Pesos ($ ARS) y Dólares (USD).
  - **Formateo automático de importes** en tiempo real.
  - **Condiciones comerciales interactivas** con plantillas rápidas.

- **💬 WhatsApp & Utilidades:**
  - Botón para copiar y compartir resumen formateado con emojis por WhatsApp.
  - Autoguardado continuo de borradores en `localStorage`.
  - Historial de presupuestos guardados.
  - Aplicación Progresiva (PWA) instalable en Android, iOS (Safari) y PC.

---

## 📂 Estructura del Proyecto

```
eden_presupuesto_deploy/
├── index.html               # Estructura principal y aplicación web
├── styles.css               # Estilos visuales y reglas A4 de impresión/PDF
├── app.js                   # Lógica reactiva, cálculos, PDF y almacenamiento
├── manifest.webmanifest     # Configuración PWA
├── sw.js                    # Service Worker (caché y offline)
├── libs/
│   └── html2pdf.bundle.min.js # Motor offline de generación de PDF
├── assets/
│   ├── header.png           # Encabezado oficial con logo
│   ├── watermark.png        # Marca de agua
│   └── footer.png           # Pie de página
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🛠️ Despliegue

1. Subir todo el contenido a un hosting estático (Vercel, Netlify, GitHub Pages, Firebase Hosting o servidor propio).
2. Servir siempre bajo **HTTPS** para habilitar el Service Worker y la instalación como App/PWA.

---

Desarrollado para **Eden Viajes y Turismo SRL**.
