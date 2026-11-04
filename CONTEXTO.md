# El Otro Lado · App de stock — contexto para seguir trabajando

App web de control de stock, pedidos, recepción, precios y caja para **El Otro Lado · Gastro Vermutería** (Elda). Dueño del proyecto: Edu (edu.coloma.m@gmail.com). Todo está en la cuenta de Google del bar **elotroladovermuteria@gmail.com**.

## Dónde está cada cosa

| Pieza | Dónde |
|---|---|
| App para el equipo (pantalla) | https://eolvermu.github.io/stock/ — repo GitHub **EOLVermu/stock** (`index.html`, GitHub Pages desde `main` / raíz) |
| Servidor y datos | Proyecto Apps Script «El Otro Lado - App de stock», ID `1SsHejApxTsH5YFXYOoRaVOn5CBm41MM8tbfQwdwzVusCnfjpkHURZEVw` (cuenta del bar) |
| Implementación web (siempre la misma, se actualiza con «Versión nueva») | `https://script.google.com/macros/s/AKfycby8EZUeAZkRSVIvwKjsK8W-A4bT4zSrq8WIbQKHNKjRRf1UMNfkBizxOifVOU_Ubgq4/exec` — ejecutar como el bar, acceso «Cualquier usuario» |
| Base de datos | Hoja «Stock El Otro Lado», ID `1K378o0x8F9gB85gD-R1UYW1zYJfPd1Afa3bOeSR52xU` (Drive del bar). Pestañas: Productos, Proveedores, Usuarios, Inventario, Pedidos, Precios, Caja, Config |
| Código fuente | `fuente/` en este repo: `build/app.html` (pantalla, con `__LOGO__` y `__API_URL__`), `build/build.py` (genera `out/Index.html` y `out/demo.html`), `out/Code.gs` (servidor) |
| Facturas 3T 2026 | Drive del bar «Mi unidad/DOCUMENTOS DE EMPRESA/3º TRIMESTRE 2026/Más» (ya procesadas) |

## Cómo está hecha

- **Code.gs**: columnas buscadas por nombre de cabecera; `asegurar_()` crea pestañas/columnas que falten; `LockService.getScriptLock()` (no el de documento: el script es independiente). Cada llamada lleva `{nombre, pin}` y `auth_()` lo comprueba; errores con prefijo `SESION:` devuelven a la pantalla de entrada.
- **API**: `doPost` recibe `{fn, args}` (texto JSON, `Content-Type: text/plain`) y solo permite las funciones del objeto `API_`. La pantalla de GitHub llama así, con `credentials:'omit'` (evita el fallo de Google con varias cuentas abiertas). Dentro de Google usa `google.script.run`.
- **Funciones**: usuariosPublicos, entrar, obtenerDatos, guardarRecuento, guardarCantidades, marcarPedidoHecho, recepcionarPedido, guardarCaja, actualizarPrecio, guardarPdf, guardarUsuario, guardarProveedor, guardarProducto, eliminarProducto, eliminarProveedor.
- **Seguridad**: PIN de 6 cifras administradores y 4 básicos; 5 fallos seguidos bloquean ese nombre 15 min (CacheService). La entrada muestra los nombres como botones y entra sola al completar el PIN.
- **Roles**: Básico → Almacén y Recepción. Administrador → además Pedido, Precios, Caja y Administración.
- **Precios**: sin IVA y con descuentos; cada producto lleva en Notas la factura de origen. Historial en la pestaña Precios.

## Cómo se publica un cambio

1. Editar `fuente/build/app.html` y/o `fuente/out/Code.gs`; `python3 build/build.py` (desde `fuente/`).
2. Probar: `node build/gs_test7b.js` (servidor simulado), Playwright sobre `out/demo.html` (usuarios demo: Admin 123456, Lucía 1111, Marta 2222).
3. Apps Script: en el editor (navegador de la app, cuenta del bar = `/u/1/`), sustituir el contenido de `Código.gs` / `Index.html` con `monaco.editor.getModels()[i].setValue(...)`; para cambios pequeños aplicar pares viejo→nuevo y comprobar SHA-256. Guardar e **Implementar → Gestionar implementaciones → lápiz → Versión nueva → Implementar** (mismo enlace).
4. GitHub: copiar `out/Index.html` a `index.html` del repo, cambiando `'__API_URL__'` por la URL de la implementación y añadiendo delante `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" ...>`. Commit y push (autor `Claude <noreply@anthropic.com>`).
5. Para tocar datos en bloque: añadir una función temporal al Code.gs, ejecutarla desde el editor y borrarla después.

## Usuarios

Administradores: Edu, Cristy, Miguel (PIN de 6). Básicos: Agustina, Rosana (PIN de 4). «Admin» desactivado. Los PIN no se guardan aquí.

## Pendiente

- Cambiar los PIN 1234 de Agustina y Rosana.
- Archivar la implementación vieja de la cuenta personal de Edu (enlace `AKfycby0VO…`).
- 58 productos sin precio (no salían en las facturas del 3T): Nicolás y Valero (salvo focaccia y cochinita), cervezas de Bodegas Ruiz, artesanas de Villena, Uriarte, Disvalero, Gil Family, Anforae, Jesús Latas…
- Datos de contacto vacíos: Bodegas Ruiz, Bodegas Nogueras, Uriarte, Disvalero, Gil Family, Anforae, Jesús Latas.
