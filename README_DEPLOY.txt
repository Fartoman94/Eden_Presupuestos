EDEN PRESUPUESTO - DEPLOY

1. Subí TODO el contenido de esta carpeta manteniendo la estructura:
   - index.html
   - manifest.webmanifest
   - sw.js
   - icons/icon-192.png
   - icons/icon-512.png

2. Publicalo mediante HTTPS. La instalación como app/acceso directo y el service worker
   requieren HTTPS (localhost sirve para pruebas).

3. El HTML fuerza un viewport de 1280 px en navegadores móviles para conservar
   la composición de escritorio y evitar que se active el diseño responsive móvil.

4. El botón “Instalar acceso directo” usa el instalador nativo cuando el navegador
   lo soporta. En iPhone/iPad muestra instrucciones para “Agregar a pantalla de inicio”.

5. La descarga del presupuesto sigue usando la impresión nativa a PDF A4.
