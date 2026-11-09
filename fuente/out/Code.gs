/**
 * EL OTRO LADO · Gastro Vermutería
 * App de control de stock y pedidos (Google Apps Script + Hoja de cálculo de Google)
 * Versión 3: usuarios con PIN, roles, administración, recepción de pedidos y caja.
 *
 * Este archivo va en Extensiones > Apps Script de la hoja "Stock El Otro Lado".
 * Las columnas se buscan por el nombre de la cabecera (fila 1), así que se
 * pueden reordenar o añadir columnas sin tocar el código.
 */

const HOJA = {
  PRODUCTOS: 'Productos',
  PROVEEDORES: 'Proveedores',
  USUARIOS: 'Usuarios',
  INVENTARIO: 'Inventario',
  PEDIDOS: 'Pedidos',
  PRECIOS: 'Precios',
  CAJA: 'Caja',
  CONFIG: 'Config'
};

// Cabeceras que la app necesita. Si faltan en la hoja (por ejemplo, en una hoja
// de una versión anterior) se añaden solas al final.
const CABECERAS = {
  Inventario: ['Fecha', 'Contado por', 'ID producto', 'Producto', 'Proveedor', 'Stock contado', 'A pedir', 'Motivo'],
  Pedidos: ['Fecha', 'Nº pedido', 'Proveedor', 'ID producto', 'Producto', 'Cantidad', 'Unidad', 'Precio (€)', 'Importe (€)',
    'Hecho por', 'Enviado por', 'Recibido', 'Estado', 'Fecha recepción', 'Recibido por'],
  Caja: ['Fecha', 'Efectivo (€)', 'Tarjeta (€)', 'Total (€)', 'Notas', 'Registrado por', 'Actualizado']
};
// ID de la hoja de Google (lo que va entre /d/ y /edit en su dirección).
// Solo hace falta si el script no está creado desde Extensiones > Apps Script de la propia hoja.
const ID_HOJA = '1K378o0x8F9gB85gD-R1UYW1zYJfPd1Afa3bOeSR52xU';
const ADMIN = 'Administrador';
const MAX_FALLOS = 5;      // intentos de PIN fallidos seguidos antes de bloquear
const MIN_BLOQUEO = 15;    // minutos de bloqueo
const MAX_FALLOS_ENTRADA = 10;   // en la pantalla de entrada (solo PIN): fallos seguidos antes de bloquearla
const MIN_BLOQUEO_ENTRADA = 5;   // minutos que queda bloqueada
const LARGO_PIN = { Administrador: 6, 'Básico': 4 };
const BASICO = 'Básico';

/* ---------- Web app ---------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('El Otro Lado · Stock')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- API para la versión de la app alojada fuera de Google ---------- */
// La pantalla (Index.html) puede funcionar aquí dentro o alojada en otra web; en ese caso
// llama a estas mismas funciones por POST, sin la sesión de Google (evita el fallo de varias cuentas).
const API_ = {
  entrar: (...a) => entrar(...a), obtenerDatos: (...a) => obtenerDatos(...a), guardarRecuento: (...a) => guardarRecuento(...a),
  guardarCantidades: (...a) => guardarCantidades(...a), marcarPedidoHecho: (...a) => marcarPedidoHecho(...a),
  recepcionarPedido: (...a) => recepcionarPedido(...a), guardarCaja: (...a) => guardarCaja(...a), guardarObservaciones: (...a) => guardarObservaciones(...a),
  actualizarPrecio: (...a) => actualizarPrecio(...a), guardarPdf: (...a) => guardarPdf(...a),
  guardarUsuario: (...a) => guardarUsuario(...a), guardarProveedor: (...a) => guardarProveedor(...a),
  guardarProducto: (...a) => guardarProducto(...a),
  eliminarProducto: (...a) => eliminarProducto(...a), eliminarProveedor: (...a) => eliminarProveedor(...a)
};
function doPost(e) {
  let out;
  try {
    const b = JSON.parse(e.postData.contents);
    if (!Object.prototype.hasOwnProperty.call(API_, b.fn)) throw new Error('Función no permitida');
    out = { ok: true, r: API_[b.fn].apply(null, Array.isArray(b.args) ? b.args : []) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍸 El Otro Lado')
    .addItem('Abrir enlace de la app', 'mostrarEnlace')
    .addToUi();
}

function mostrarEnlace() {
  const url = ScriptApp.getService().getUrl();
  const html = url
    ? '<p style="font-family:Arial">Enlace de la app:</p><p><a href="' + url + '" target="_blank">' + url + '</a></p>'
    : '<p style="font-family:Arial">Todavía no has implementado la app. Ve a Implementar &gt; Nueva implementación &gt; Aplicación web.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(140), 'App de stock');
}

/* ---------- Utilidades de tabla ---------- */

function libro_() {
  return SpreadsheetApp.getActive() || SpreadsheetApp.openById(ID_HOJA);
}

function hoja_(nombre) {
  const sh = libro_().getSheetByName(nombre);
  if (!sh) throw new Error('No encuentro la pestaña "' + nombre + '". No cambiéis el nombre de las pestañas.');
  return sh;
}

function cabeceras_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  h.forEach((t, i) => { if (t !== '') map[String(t).trim()] = i; });
  return { lista: h, idx: map };
}

/** Crea la pestaña si no existe y añade las cabeceras que falten */
function asegurar_(nombre) {
  const libro = libro_();
  let sh = libro.getSheetByName(nombre);
  const quiero = CABECERAS[nombre] || [];
  if (!sh) {
    sh = libro.insertSheet(nombre);
    sh.getRange(1, 1, 1, quiero.length).setValues([quiero]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const hay = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x).trim());
  const faltan = quiero.filter(h => !hay.includes(h));
  if (faltan.length) {
    const desde = hay.filter(x => x !== '').length ? lastCol + 1 : 1;
    sh.getRange(1, desde, 1, faltan.length).setValues([faltan]).setFontWeight('bold');
  }
  return sh;
}

/** Añade filas a una pestaña a partir de objetos {cabecera: valor} */
function anadirFilas_(nombre, objetos) {
  if (!objetos.length) return;
  const sh = asegurar_(nombre);
  const cab = cabeceras_(sh);
  const filas = objetos.map(o => {
    const f = new Array(cab.lista.length).fill('');
    Object.keys(o).forEach(k => { if (k in cab.idx) f[cab.idx[k]] = o[k]; });
    return f;
  });
  sh.getRange(sh.getLastRow() + 1, 1, filas.length, cab.lista.length).setValues(filas);
}

/** Zona horaria de la hoja (para fechas de caja sin desfases) */
function tz_() {
  try { return libro_().getSpreadsheetTimeZone() || Session.getScriptTimeZone(); } catch (e) { return Session.getScriptTimeZone(); }
}

function col_(cab, nombre) {
  if (!(nombre in cab.idx)) throw new Error('Falta la columna "' + nombre + '" en la hoja.');
  return cab.idx[nombre];
}

function valor_(v) {
  if (v instanceof Date) return v.toISOString();
  return v;
}

function leerTabla_(nombre, columnaClave) {
  const sh = hoja_(nombre);
  const cab = cabeceras_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const datos = sh.getRange(2, 1, last - 1, cab.lista.length).getValues();
  const out = [];
  datos.forEach((fila, i) => {
    if (columnaClave && String(fila[cab.idx[columnaClave]]).trim() === '') return;
    const o = { _fila: i + 2 };
    cab.lista.forEach((h, j) => { if (h !== '') o[String(h).trim()] = valor_(fila[j]); });
    out.push(o);
  });
  return out;
}

const esActivo_ = v => String(v).trim().toUpperCase() !== 'NO';
const txt_ = v => (v === null || v === undefined) ? '' : String(v).trim();
const norm_ = v => txt_(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function num_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function config_() {
  const cfg = {};
  leerTabla_(HOJA.CONFIG, 'Clave').forEach(r => { cfg[r['Clave']] = r['Valor']; });
  return cfg;
}

function conBloqueo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Escribe un objeto {cabecera: valor} en una fila (solo las columnas que vienen) */
function escribirFila_(sh, cab, fila, obj) {
  const r = sh.getRange(fila, 1, 1, cab.lista.length);
  const v = r.getValues()[0];
  const f = r.getFormulas ? r.getFormulas()[0] : [];
  Object.keys(obj).forEach(k => { v[col_(cab, k)] = obj[k]; });
  r.setValues([v.map((x, j) => (f[j] ? f[j] : x))]);
}

/** Primera fila libre mirando una columna (sirve aunque haya fórmulas más abajo) */
function filaLibre_(sh, cab, columna) {
  const c = col_(cab, columna);
  const last = sh.getLastRow();
  if (last < 2) return 2;
  const vals = sh.getRange(2, c + 1, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (txt_(vals[i][0]) !== '') return i + 3;
  }
  return 2;
}

function letra_(n) { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/* ---------- Usuarios y permisos ---------- */

function usuarios_() {
  return leerTabla_(HOJA.USUARIOS, 'Nombre').map(u => ({
    _fila: u._fila, nombre: txt_(u['Nombre']), pin: txt_(u['PIN']).replace(/\.0$/, ''),
    rol: norm_(u['Rol']) === 'administrador' ? ADMIN : BASICO, activo: esActivo_(u['Activo'])
  }));
}

/** Comprueba nombre + PIN en cada llamada. Devuelve {nombre, rol} o lanza error */
function auth_(cred, soloAdmin) {
  if (!cred || !cred.nombre) throw new Error('SESION: Vuelve a entrar con tu nombre y PIN.');
  // Bloqueo por intentos fallidos: tras MAX_FALLOS seguidos, ese nombre queda bloqueado MIN_BLOQUEO minutos
  const cache = CacheService.getScriptCache();
  const clave = 'fallos_' + norm_(cred.nombre).replace(/[^a-z0-9]/g, '_').slice(0, 200);
  const fallos = Number(cache.get(clave) || 0);
  if (fallos >= MAX_FALLOS) throw new Error('SESION: Demasiados intentos fallidos. Espera ' + MIN_BLOQUEO + ' minutos y vuelve a probar.');
  const u = usuarios_().find(x => norm_(x.nombre) === norm_(cred.nombre));
  if (!u || !u.activo || u.pin === '' || u.pin !== txt_(cred.pin)) {
    cache.put(clave, String(fallos + 1), MIN_BLOQUEO * 60);
    if (fallos + 1 >= MAX_FALLOS) throw new Error('SESION: Demasiados intentos fallidos. Espera ' + MIN_BLOQUEO + ' minutos y vuelve a probar.');
    throw new Error('SESION: Nombre o PIN incorrectos.');
  }
  if (fallos) cache.remove(clave);
  if (soloAdmin && u.rol !== ADMIN) throw new Error('Solo un administrador puede hacer esto.');
  return { nombre: u.nombre, rol: u.rol };
}

/** Entrar: valida y devuelve el usuario y los datos de su rol */
function entrar(cred) {
  const u = (cred && cred.nombre) ? auth_(cred) : authPin_(cred);
  return { usuario: u, datos: datos_(u) };
}

/** Entrada solo con PIN: el PIN identifica al usuario. Bloqueo general tras varios fallos seguidos. */
function authPin_(cred) {
  const pin = txt_(cred && cred.pin);
  const cache = CacheService.getScriptCache();
  const clave = 'fallos_entrada';
  const fallos = Number(cache.get(clave) || 0);
  const bloqueo = 'SESION: Demasiados intentos fallidos. Espera ' + MIN_BLOQUEO_ENTRADA + ' minutos y vuelve a probar.';
  if (fallos >= MAX_FALLOS_ENTRADA) throw new Error(bloqueo);
  const quienes = pin ? usuarios_().filter(x => x.activo && x.pin !== '' && x.pin === pin) : [];
  if (quienes.length > 1) throw new Error('SESION: Ese PIN lo tienen varias personas. Un administrador tiene que poner a cada una el suyo.');
  if (!quienes.length) {
    cache.put(clave, String(fallos + 1), MIN_BLOQUEO_ENTRADA * 60);
    if (fallos + 1 >= MAX_FALLOS_ENTRADA) throw new Error(bloqueo);
    throw new Error('SESION: PIN incorrecto.');
  }
  if (fallos) cache.remove(clave);
  return { nombre: quienes[0].nombre, rol: quienes[0].rol };
}

/* ---------- Lectura ---------- */

function proveedorObj_(p) {
  return {
    id: txt_(p['ID']), nombre: txt_(p['Proveedor']), tipo: p['Tipo'] || '',
    contacto: p['Persona de contacto'] || '', telefono: txt_(p['Teléfono']),
    whatsapp: txt_(p['WhatsApp']).replace(/[^0-9]/g, ''), email: p['Email'] || '', direccion: p['Dirección'] || '',
    canal: p['Cómo se pide'] || '', diaPedido: p['Día de pedido'] || '', diaReparto: p['Día de reparto'] || '',
    pedidoMinimo: num_(p['Pedido mínimo (€)']), orden: num_(p['Orden']), activo: esActivo_(p['Activo']), notas: p['Notas'] || ''
  };
}

function productoObj_(p) {
  return {
    id: txt_(p['ID']), nombre: txt_(p['Producto']), proveedor: txt_(p['Proveedor']),
    categoria: p['Categoría'] || '', unidad: p['Unidad'] || '',
    minimo: num_(p['Stock mínimo']), ideal: num_(p['Stock ideal']), actual: num_(p['Stock actual']),
    aPedir: num_(p['A pedir']), ultimaCuenta: p['Última cuenta'] || '', contadoPor: p['Contado por'] || '',
    precio: num_(p['Precio (€)']), precioFecha: p['Precio actualizado'] || '', ultimoPedido: p['Último pedido'] || '',
    activo: esActivo_(p['Activo']), notas: p['Notas'] || ''
  };
}

function datos_(u) {
  const esAdmin = u.rol === ADMIN;
  const alfa = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base', numeric: true });
  let proveedores = leerTabla_(HOJA.PROVEEDORES, 'Proveedor').map(proveedorObj_).sort(alfa);
  let productos = leerTabla_(HOJA.PRODUCTOS, 'Producto').map(productoObj_).sort(alfa);
  if (!esAdmin) {
    // Usuario básico: solo lo necesario para contar
    proveedores = proveedores.filter(p => p.activo).map(p => ({ id: p.id, nombre: p.nombre, orden: p.orden, activo: true }));
    productos = productos.filter(p => p.activo).map(p => {
      const c = Object.assign({}, p); delete c.precio; delete c.precioFecha; return c;
    });
  }
  const out = { usuario: u, proveedores, productos, pedidos: pedidosAbiertos_(esAdmin), ahora: new Date().toISOString() };
  if (esAdmin) {
    out.caja = caja_();
    out.config = config_();
    out.usuarios = usuarios_().map(x => ({ nombre: x.nombre, rol: x.rol, activo: x.activo, tienePin: x.pin !== '' }));
  }
  return out;
}

function obtenerDatos(cred) {
  return datos_(auth_(cred));
}

/* ---------- Almacén (todos los usuarios) ---------- */

/** Lee toda la hoja Productos una vez para escribir por columnas (mucho más rápido) */
function tablaProductos_() {
  const sh = hoja_(HOJA.PRODUCTOS);
  const cab = cabeceras_(sh);
  const n = Math.max(sh.getLastRow() - 1, 0);
  const datos = n ? sh.getRange(2, 1, n, cab.lista.length).getValues() : [];
  const filas = {};
  const cId = col_(cab, 'ID');
  datos.forEach((r, i) => { if (r[cId] !== '') filas[String(r[cId])] = i; });
  const cols = {};
  return {
    sh, cab, datos, filas, n,
    col(nombre) {
      if (!cols[nombre]) {
        const c = col_(cab, nombre);
        cols[nombre] = { c, vals: datos.map(r => [r[c]]), tocada: false };
      }
      return cols[nombre];
    },
    set(nombre, i, valor) { const k = this.col(nombre); k.vals[i][0] = valor; k.tocada = true; },
    get(nombre, i) { return datos[i][col_(cab, nombre)]; },
    guardar() {
      Object.keys(cols).forEach(k => {
        if (cols[k].tocada && n) sh.getRange(2, cols[k].c + 1, n, 1).setValues(cols[k].vals);
      });
    }
  };
}

/**
 * Guarda un recuento.
 * payload = { items: [{ id, actual, aPedir }] }
 */
function guardarRecuento(cred, payload) {
  const u = auth_(cred);
  if (!payload || !payload.items || !payload.items.length) return datos_(u);
  return conBloqueo_(() => {
    const t = tablaProductos_();
    const ahora = new Date();
    const log = [];
    payload.items.forEach(it => {
      const i = t.filas[String(it.id)];
      if (i === undefined) return;
      const actual = num_(it.actual);
      const aPedir = num_(it.aPedir);
      if (actual !== '') {
        t.set('Stock actual', i, actual);
        t.set('Última cuenta', i, ahora);
        t.set('Contado por', i, u.nombre);
      }
      if ('aPedir' in it) t.set('A pedir', i, aPedir);
      const mn = num_(t.get('Stock mínimo', i)), id = num_(t.get('Stock ideal', i));
      let sugerido = '';
      if (actual !== '' && mn !== '' && id !== '') sugerido = actual <= mn ? Math.max(id - actual, 0) : 0;
      log.push({ 'Fecha': ahora, 'Contado por': u.nombre, 'ID producto': it.id, 'Producto': t.get('Producto', i),
        'Proveedor': t.get('Proveedor', i), 'Stock contado': actual, 'A pedir': aPedir !== '' ? aPedir : sugerido, 'Motivo': 'Recuento' });
    });
    t.guardar();
    anadirFilas_(HOJA.INVENTARIO, log);
    return datos_(u);
  });
}

/* ---------- Pedido y precios (administradores) ---------- */

function guardarCantidades(cred, payload) {
  const u = auth_(cred, true);
  if (!payload || !payload.items || !payload.items.length) return datos_(u);
  return conBloqueo_(() => {
    const t = tablaProductos_();
    payload.items.forEach(it => {
      const i = t.filas[String(it.id)];
      if (i !== undefined) t.set('A pedir', i, num_(it.aPedir));
    });
    t.guardar();
    return datos_(u);
  });
}

/** payload = { proveedor, via, items: [{id, cantidad}] } */
function marcarPedidoHecho(cred, payload) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const t = tablaProductos_();
    const ahora = new Date();
    const numPedido = Utilities.formatDate(ahora, tz_(), 'yyMMdd-HHmmss');
    const log = [];
    (payload.items || []).forEach(it => {
      const i = t.filas[String(it.id)];
      if (i === undefined) return;
      const precio = num_(t.get('Precio (€)', i));
      const cant = num_(it.cantidad);
      if (cant === '' || cant <= 0) return;
      log.push({ 'Fecha': ahora, 'Nº pedido': numPedido, 'Proveedor': payload.proveedor, 'ID producto': it.id,
        'Producto': t.get('Producto', i), 'Cantidad': cant, 'Unidad': t.get('Unidad', i), 'Precio (€)': precio,
        'Importe (€)': (precio !== '' && cant !== '') ? Math.round(precio * cant * 100) / 100 : '',
        'Hecho por': u.nombre, 'Enviado por': payload.via || '', 'Recibido': 0, 'Estado': 'Pendiente' });
      t.set('A pedir', i, '');
      t.set('Último pedido', i, ahora);
    });
    t.guardar();
    anadirFilas_(HOJA.PEDIDOS, log);
    return datos_(u);
  });
}

/** Cambia el precio y lo apunta en el historial. Devuelve los datos actualizados */
function actualizarPrecio(cred, payload) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    registrarPrecio_(payload.id, num_(payload.precio), u.nombre);
    return datos_(u);
  });
}

function registrarPrecio_(id, nuevo, quien) {
  const sh = hoja_(HOJA.PRODUCTOS);
  const cab = cabeceras_(sh);
  const fila = buscarFila_(sh, cab, 'ID', id);
  if (!fila) throw new Error('Producto no encontrado');
  const v = sh.getRange(fila, 1, 1, cab.lista.length).getValues()[0];
  const antes = num_(v[col_(cab, 'Precio (€)')]);
  if (nuevo === '' || nuevo === antes) return;
  const ahora = new Date();
  sh.getRange(fila, col_(cab, 'Precio (€)') + 1).setValue(nuevo);
  sh.getRange(fila, col_(cab, 'Precio actualizado') + 1).setValue(ahora);
  const variacion = (antes !== '' && antes !== 0) ? (nuevo - antes) / antes : '';
  const pre = hoja_(HOJA.PRECIOS);
  pre.appendRow([ahora, id, v[col_(cab, 'Producto')], v[col_(cab, 'Proveedor')], antes, nuevo, variacion, quien]);
  pre.getRange(pre.getLastRow(), 7).setNumberFormat('0.0%');
}

function buscarFila_(sh, cab, columna, valor) {
  const c = col_(cab, columna);
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, c + 1, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (norm_(vals[i][0]) === norm_(valor) && txt_(vals[i][0]) !== '') return i + 2;
  return 0;
}

/** Guarda el PDF generado en la app en una carpeta de Drive y devuelve su enlace */
function guardarPdf(cred, base64, nombreArchivo) {
  auth_(cred, true);
  const cfg = config_();
  const nombreCarpeta = cfg.CARPETA_PDF || 'El Otro Lado - Listas de pedido';
  const it = DriveApp.getFoldersByName(nombreCarpeta);
  const carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(nombreCarpeta);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'application/pdf', nombreArchivo);
  const f = carpeta.createFile(blob);
  return { url: f.getUrl(), nombre: f.getName() };
}

/* ---------- Administración ---------- */

/**
 * Alta o edición de usuario.
 * u = { original, nombre, rol, activo, pin }  (original vacío = alta; pin vacío = no cambiar)
 */
function guardarUsuario(cred, u) {
  const yo = auth_(cred, true);
  return conBloqueo_(() => {
    const sh = hoja_(HOJA.USUARIOS);
    const cab = cabeceras_(sh);
    const nombre = txt_(u.nombre);
    const pin = txt_(u.pin);
    if (!nombre) throw new Error('Falta el nombre.');
    const todos = usuarios_();
    const dup = todos.find(x => norm_(x.nombre) === norm_(nombre) && norm_(x.nombre) !== norm_(u.original));
    if (dup) throw new Error('Ya existe un usuario llamado ' + dup.nombre + '.');
    const rol = u.rol === ADMIN ? ADMIN : BASICO;
    const activo = u.activo === false ? 'NO' : 'SÍ';
    const largo = LARGO_PIN[rol];
    const quien = rol === ADMIN ? 'un administrador' : 'un usuario básico';
    if (pin && !new RegExp('^\\d{' + largo + '}$').test(pin)) throw new Error('El PIN de ' + quien + ' tiene que tener ' + largo + ' números.');
    if (pin && todos.some(x => x.pin === pin && norm_(x.nombre) !== norm_(u.original))) throw new Error('Ese PIN ya lo usa otra persona. Elige otro.');
    const antes = todos.find(x => norm_(x.nombre) === norm_(u.original));
    if (!pin && antes && antes.rol !== rol && antes.pin.length !== largo) throw new Error('Al cambiarle el rol, ponle un PIN nuevo de ' + largo + ' números.');
    // No dejar la app sin administradores activos
    const adminsRestantes = todos.filter(x => x.rol === ADMIN && x.activo && norm_(x.nombre) !== norm_(u.original)).length;
    if (adminsRestantes === 0 && (rol !== ADMIN || activo === 'NO')) throw new Error('Tiene que quedar al menos un administrador activo.');
    let fila = u.original ? buscarFila_(sh, cab, 'Nombre', u.original) : 0;
    if (!fila) {
      if (!pin) throw new Error('Pon un PIN de ' + largo + ' números para el usuario nuevo.');
      fila = filaLibre_(sh, cab, 'Nombre');
    }
    const obj = { 'Nombre': nombre, 'Rol': rol, 'Activo': activo };
    if (pin) obj['PIN'] = pin;
    sh.getRange(fila, col_(cab, 'PIN') + 1).setNumberFormat('@');
    escribirFila_(sh, cab, fila, obj);
    // Si me cambio a mí mismo, el cliente necesita las credenciales nuevas
    const soyYo = norm_(u.original) === norm_(yo.nombre);
    const nuevaCred = soyYo ? { nombre, pin: pin || txt_(cred.pin) } : null;
    const yoAhora = soyYo ? { nombre, rol } : yo;
    return { datos: datos_(yoAhora), cred: nuevaCred };
  });
}

/**
 * Alta o edición de proveedor.
 * p = { id, nombre, tipo, contacto, telefono, whatsapp, email, direccion, canal, diaPedido, diaReparto, pedidoMinimo, orden, activo, notas }
 * Si cambia el nombre, se actualiza también en todos sus productos.
 */
function guardarProveedor(cred, p) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const sh = hoja_(HOJA.PROVEEDORES);
    const cab = cabeceras_(sh);
    const nombre = txt_(p.nombre);
    if (!nombre) throw new Error('Falta el nombre del proveedor.');
    const lista = leerTabla_(HOJA.PROVEEDORES, 'Proveedor');
    const dup = lista.find(x => norm_(x['Proveedor']) === norm_(nombre) && txt_(x['ID']) !== txt_(p.id));
    if (dup) throw new Error('Ya existe un proveedor llamado ' + dup['Proveedor'] + '.');
    let fila = p.id ? buscarFila_(sh, cab, 'ID', p.id) : 0;
    let id = txt_(p.id), anterior = '', esNuevo = false;
    if (fila) {
      anterior = txt_(sh.getRange(fila, col_(cab, 'Proveedor') + 1).getValue());
    } else {
      const max = lista.reduce((m, x) => Math.max(m, parseInt(String(x['ID']).replace(/\D/g, ''), 10) || 0), 0);
      id = 'PR' + String(max + 1).padStart(2, '0');
      fila = filaLibre_(sh, cab, 'Proveedor');
      esNuevo = true;
    }
    const orden = num_(p.orden) !== '' ? num_(p.orden) : (esNuevo ? lista.length + 1 : '');
    const obj = {
      'ID': id, 'Proveedor': nombre, 'Tipo': txt_(p.tipo), 'Persona de contacto': txt_(p.contacto),
      'Teléfono': txt_(p.telefono), 'WhatsApp': txt_(p.whatsapp).replace(/[^0-9]/g, ''), 'Email': txt_(p.email),
      'Dirección': txt_(p.direccion), 'Cómo se pide': txt_(p.canal), 'Día de pedido': txt_(p.diaPedido),
      'Día de reparto': txt_(p.diaReparto), 'Pedido mínimo (€)': num_(p.pedidoMinimo), 'Orden': orden,
      'Activo': p.activo === false ? 'NO' : 'SÍ', 'Notas': txt_(p.notas)
    };
    Object.keys(obj).forEach(k => { if (!(k in cab.idx)) delete obj[k]; });
    sh.getRange(fila, col_(cab, 'Teléfono') + 1).setNumberFormat('@');
    sh.getRange(fila, col_(cab, 'WhatsApp') + 1).setNumberFormat('@');
    escribirFila_(sh, cab, fila, obj);
    // Renombrado: arrastrar el nombre a sus productos
    if (anterior && anterior !== nombre) {
      const t = tablaProductos_();
      t.datos.forEach((r, i) => { if (txt_(t.get('Proveedor', i)) === anterior) t.set('Proveedor', i, nombre); });
      t.guardar();
    }
    return datos_(u);
  });
}

/**
 * Alta o edición de producto.
 * p = { id, nombre, proveedor, categoria, unidad, minimo, ideal, precio, activo, notas }
 */
function guardarProducto(cred, p) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const sh = hoja_(HOJA.PRODUCTOS);
    const cab = cabeceras_(sh);
    const nombre = txt_(p.nombre);
    if (!nombre) throw new Error('Falta el nombre del producto.');
    if (!txt_(p.proveedor)) throw new Error('Elige un proveedor.');
    const lista = leerTabla_(HOJA.PRODUCTOS, 'Producto');
    const dup = lista.find(x => norm_(x['Producto']) === norm_(nombre) && norm_(x['Proveedor']) === norm_(p.proveedor) && txt_(x['ID']) !== txt_(p.id));
    if (dup) throw new Error('Ese producto ya existe en ' + dup['Proveedor'] + '.');
    const mn = num_(p.minimo), id2 = num_(p.ideal);
    if (mn !== '' && id2 !== '' && id2 < mn) throw new Error('El stock ideal no puede ser menor que el mínimo.');
    let fila = p.id ? buscarFila_(sh, cab, 'ID', p.id) : 0;
    let id = txt_(p.id), nuevo = false;
    if (!fila) {
      const max = lista.reduce((m, x) => Math.max(m, parseInt(String(x['ID']).replace(/\D/g, ''), 10) || 0), 0);
      id = 'P' + String(max + 1).padStart(3, '0');
      fila = filaLibre_(sh, cab, 'Producto');
      nuevo = true;
    }
    const obj = {
      'ID': id, 'Producto': nombre, 'Proveedor': txt_(p.proveedor), 'Categoría': txt_(p.categoria),
      'Unidad': txt_(p.unidad), 'Stock mínimo': mn, 'Stock ideal': id2,
      'Activo': p.activo === false ? 'NO' : 'SÍ', 'Notas': txt_(p.notas)
    };
    escribirFila_(sh, cab, fila, obj);
    // Fórmula de "Sugerido" para filas nuevas (por si no estaba ya)
    if (nuevo && 'Sugerido' in cab.idx) {
      const L = n => letra_(col_(cab, n)) + fila;
      sh.getRange(fila, col_(cab, 'Sugerido') + 1).setFormula(
        '=IF(OR(' + L('Producto') + '="",' + L('Stock mínimo') + '="",' + L('Stock ideal') + '="",' + L('Stock actual') + '=""),"",IF(' +
        L('Stock actual') + '<=' + L('Stock mínimo') + ',MAX(' + L('Stock ideal') + '-' + L('Stock actual') + ',0),0))');
    }
    if (num_(p.precio) !== '') registrarPrecio_(id, num_(p.precio), u.nombre);
    return datos_(u);
  });
}

/**
 * Eliminar un producto (definitivo). No se puede si está en un pedido pendiente de recibir.
 * El historial (inventario, pedidos y precios) se conserva.
 */
function eliminarProducto(cred, p) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const sh = hoja_(HOJA.PRODUCTOS);
    const cab = cabeceras_(sh);
    const id = txt_(p && p.id);
    const fila = id ? buscarFila_(sh, cab, 'ID', id) : 0;
    if (!fila) throw new Error('Ese producto ya no existe.');
    const ped = pedidosAbiertos_(false).find(x => x.lineas.some(l => l.id === id));
    if (ped) throw new Error('No se puede eliminar: está en un pedido de ' + ped.proveedor + ' pendiente de recibir. Recíbelo o ciérralo antes.');
    sh.deleteRow(fila);
    return datos_(u);
  });
}

/**
 * Eliminar un proveedor (definitivo) junto con todos sus productos.
 * No se puede si tiene pedidos pendientes de recibir.
 */
function eliminarProveedor(cred, p) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const sh = hoja_(HOJA.PROVEEDORES);
    const cab = cabeceras_(sh);
    const id = txt_(p && p.id);
    const fila = id ? buscarFila_(sh, cab, 'ID', id) : 0;
    if (!fila) throw new Error('Ese proveedor ya no existe.');
    const nombre = txt_(sh.getRange(fila, col_(cab, 'Proveedor') + 1).getValue());
    const ped = pedidosAbiertos_(false).find(x => norm_(x.proveedor) === norm_(nombre));
    if (ped) throw new Error('No se puede eliminar: ' + nombre + ' tiene un pedido pendiente de recibir. Recíbelo o ciérralo antes.');
    // Primero sus productos (de abajo arriba para no descolocar las filas)
    const shP = hoja_(HOJA.PRODUCTOS);
    const filas = leerTabla_(HOJA.PRODUCTOS, 'Producto').filter(x => norm_(x['Proveedor']) === norm_(nombre)).map(x => x._fila).sort((a, b) => b - a);
    filas.forEach(f => shP.deleteRow(f));
    sh.deleteRow(fila);
    return datos_(u);
  });
}

/* ---------- Recepción de pedidos (todos los usuarios) ---------- */

const ABIERTO_ = e => { const x = norm_(e); return x === '' || x === 'pendiente' || x === 'parcial'; };

/** Pedidos pendientes o parciales, agrupados por Nº de pedido */
function pedidosAbiertos_(conPrecios) {
  const sh = asegurar_(HOJA.PEDIDOS);
  const filas = leerTabla_(HOJA.PEDIDOS, 'Nº pedido');
  const mapa = {};
  filas.forEach(r => {
    if (!ABIERTO_(r['Estado'])) return;
    const num = txt_(r['Nº pedido']);
    if (!mapa[num]) mapa[num] = { num, proveedor: txt_(r['Proveedor']), fecha: r['Fecha'] || '', hechoPor: txt_(r['Hecho por']),
      estado: 'Pendiente', ultimaRecepcion: '', lineas: [] };
    const p = mapa[num];
    const l = { id: txt_(r['ID producto']), producto: txt_(r['Producto']), unidad: txt_(r['Unidad']),
      cantidad: num_(r['Cantidad']) || 0, recibido: num_(r['Recibido']) || 0 };
    if (conPrecios) l.precio = num_(r['Precio (€)']);
    p.lineas.push(l);
    if (norm_(r['Estado']) === 'parcial') p.estado = 'Parcial';
    if (r['Fecha recepción'] && (!p.ultimaRecepcion || r['Fecha recepción'] > p.ultimaRecepcion)) p.ultimaRecepcion = r['Fecha recepción'];
  });
  return Object.keys(mapa).map(k => mapa[k]).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/**
 * Recepción de un pedido.
 * payload = { num, lineas: [{ id, cantidad }], cerrar: false|true }
 * cantidad = lo que llega ahora. Se suma al stock del almacén.
 * Si todo está recibido, el pedido queda "Completo"; si no, "Parcial".
 * cerrar = true (solo administradores) cierra el pedido aunque falten cosas ("Cerrado con faltas").
 */
function recepcionarPedido(cred, payload) {
  const u = auth_(cred);
  if (payload.cerrar && u.rol !== ADMIN) throw new Error('Solo un administrador puede cerrar un pedido con faltas.');
  return conBloqueo_(() => {
    const sh = asegurar_(HOJA.PEDIDOS);
    const cab = cabeceras_(sh);
    const n = sh.getLastRow() - 1;
    if (n < 1) throw new Error('No hay pedidos.');
    const datos = sh.getRange(2, 1, n, cab.lista.length).getValues();
    const c = k => col_(cab, k);
    const llega = {};
    (payload.lineas || []).forEach(l => { const q = num_(l.cantidad); if (q !== '' && q > 0) llega[String(l.id)] = (llega[String(l.id)] || 0) + q; });
    const ahora = new Date();
    const filasPedido = [];
    datos.forEach((r, i) => { if (txt_(r[c('Nº pedido')]) === txt_(payload.num) && ABIERTO_(r[c('Estado')])) filasPedido.push(i); });
    if (!filasPedido.length) throw new Error('Este pedido ya no está pendiente. Recarga la app.');
    const proveedor = txt_(datos[filasPedido[0]][c('Proveedor')]);
    // 1) Actualizar lo recibido en cada línea
    let completo = true;
    const entradas = [];
    filasPedido.forEach(i => {
      const r = datos[i];
      const id = txt_(r[c('ID producto')]);
      const q = llega[id] || 0;
      const recibido = (num_(r[c('Recibido')]) || 0) + q;
      r[c('Recibido')] = recibido;
      if (recibido < (num_(r[c('Cantidad')]) || 0)) completo = false;
      if (q) { r[c('Fecha recepción')] = ahora; r[c('Recibido por')] = u.nombre; entradas.push({ id, q, producto: r[c('Producto')] }); }
    });
    const estado = completo ? 'Completo' : (payload.cerrar ? 'Cerrado con faltas' : 'Parcial');
    if (!entradas.length && !payload.cerrar && !completo) throw new Error('No has marcado nada como recibido.');
    filasPedido.forEach(i => {
      datos[i][c('Estado')] = estado;
      if (!datos[i][c('Fecha recepción')] && (payload.cerrar || completo)) datos[i][c('Fecha recepción')] = ahora;
      if (!datos[i][c('Recibido por')] && (payload.cerrar || completo)) datos[i][c('Recibido por')] = u.nombre;
    });
    ['Recibido', 'Estado', 'Fecha recepción', 'Recibido por'].forEach(k => {
      sh.getRange(2, c(k) + 1, n, 1).setValues(datos.map(r => [r[c(k)]]));
    });
    // 2) Sumar al almacén
    if (entradas.length) {
      const t = tablaProductos_();
      const log = [];
      entradas.forEach(e => {
        const i = t.filas[e.id];
        if (i === undefined) return;
        const antes = num_(t.get('Stock actual', i));
        const nuevo = (antes === '' ? 0 : antes) + e.q;
        t.set('Stock actual', i, nuevo);
        t.set('Última cuenta', i, ahora);
        t.set('Contado por', i, u.nombre);
        log.push({ 'Fecha': ahora, 'Contado por': u.nombre, 'ID producto': e.id, 'Producto': t.get('Producto', i),
          'Proveedor': proveedor, 'Stock contado': nuevo, 'A pedir': '', 'Motivo': 'Recepción pedido ' + payload.num + ' (+' + e.q + ')' });
      });
      t.guardar();
      anadirFilas_(HOJA.INVENTARIO, log);
    }
    return datos_(u);
  });
}

/* ---------- Caja (administradores) ---------- */

function fechaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = txt_(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const e = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return e ? e[3] + '-' + ('0' + e[2]).slice(-2) + '-' + ('0' + e[1]).slice(-2) : s;
}

function caja_() {
  asegurar_(HOJA.CAJA);
  return leerTablaCruda_(HOJA.CAJA, 'Fecha').map(r => ({
    fecha: fechaTxt_(r['Fecha']), efectivo: num_(r['Efectivo (€)']), tarjeta: num_(r['Tarjeta (€)']),
    total: num_(r['Total (€)']), notas: txt_(r['Notas']), por: txt_(r['Registrado por'])
  })).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.fecha));
}

/** Como leerTabla_ pero sin convertir fechas a texto ISO */
function leerTablaCruda_(nombre, columnaClave) {
  const sh = hoja_(nombre);
  const cab = cabeceras_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cab.lista.length).getValues()
    .filter(f => !columnaClave || txt_(f[cab.idx[columnaClave]]) !== '')
    .map(f => { const o = {}; cab.lista.forEach((h, j) => { if (h !== '') o[String(h).trim()] = f[j]; }); return o; });
}

/**
 * Guarda la caja de un día. payload = { fecha: 'aaaa-mm-dd', efectivo, tarjeta, notas }
 * Si efectivo y tarjeta van vacíos, se borra ese día.
 */
/** Observaciones generales del pedido (pantalla Pedido). Se guardan en Config, clave OBSERVACIONES_PEDIDO. */
function guardarObservaciones(cred, texto) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const t = String(texto == null ? '' : texto).slice(0, 2000);
    const sh = hoja_(HOJA.CONFIG);
    const cab = cabeceras_(sh);
    const cK = col_(cab, 'Clave'), cV = col_(cab, 'Valor');
    const last = sh.getLastRow();
    let fila = 0;
    if (last >= 2) {
      const i = sh.getRange(2, cK + 1, last - 1, 1).getValues().findIndex(r => txt_(r[0]) === 'OBSERVACIONES_PEDIDO');
      if (i >= 0) fila = i + 2;
    }
    if (!fila) { fila = last + 1; sh.getRange(fila, cK + 1).setValue('OBSERVACIONES_PEDIDO'); }
    sh.getRange(fila, cV + 1).setNumberFormat('@').setValue(t);   // como texto: un «=» al principio no se toma por fórmula
    return datos_(u);
  });
}

function guardarCaja(cred, payload) {
  const u = auth_(cred, true);
  return conBloqueo_(() => {
    const fecha = txt_(payload.fecha);
    const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new Error('Fecha no válida.');
    const sh = asegurar_(HOJA.CAJA);
    const cab = cabeceras_(sh);
    const cF = col_(cab, 'Fecha');
    const last = sh.getLastRow();
    let fila = 0;
    if (last >= 2) {
      const vals = sh.getRange(2, cF + 1, last - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) if (fechaTxt_(vals[i][0]) === fecha) { fila = i + 2; break; }
    }
    const ef = num_(payload.efectivo), ta = num_(payload.tarjeta);
    if (ef === '' && ta === '') {
      if (fila) sh.deleteRow(fila);
      return datos_(u);
    }
    if (!fila) fila = Math.max(last + 1, 2);
    const total = Math.round(((ef || 0) + (ta || 0)) * 100) / 100;
    // Mediodía para que ningún cambio de zona horaria mueva el día
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    escribirFila_(sh, cab, fila, { 'Fecha': d, 'Efectivo (€)': ef === '' ? 0 : ef, 'Tarjeta (€)': ta === '' ? 0 : ta,
      'Total (€)': total, 'Notas': txt_(payload.notas), 'Registrado por': u.nombre, 'Actualizado': new Date() });
    sh.getRange(fila, cF + 1).setNumberFormat('dd/mm/yyyy');
    ['Efectivo (€)', 'Tarjeta (€)', 'Total (€)'].forEach(k => sh.getRange(fila, col_(cab, k) + 1).setNumberFormat('#,##0.00 €'));
    return datos_(u);
  });
}
