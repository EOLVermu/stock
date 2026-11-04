import json, base64, random
src=open('build/app.html').read()
logo='data:image/jpeg;base64,'+base64.b64encode(open('build/logo_hd.jpg','rb').read()).decode()
app=src.replace('__LOGO__',logo)
open('out/Index.html','w').write(app)
# ---------- demo con datos de ejemplo
D=json.load(open('build/datos.json'))
random.seed(7)
UNI={'Bebida':'caja','Vino y vermut':'botella','Comida':'ud','Limpieza':'garrafa','Menaje':'paquete'}
PRE={'Bebida':(9,22),'Vino y vermut':(5,14),'Comida':(2,12),'Limpieza':(3,9),'Menaje':(2,6)}
prods=[]
from datetime import datetime, timedelta
now=datetime(2026,11,3,12)
for i,p in enumerate(D['productos'],1):
    cat=p['categoria']; mn=random.choice([1,2,2,3,4]); ideal=mn+random.choice([2,3,4,6])
    act=random.choice([0,1,mn,mn+1,mn+2,ideal,''])
    lo,hi=PRE[cat]
    prods.append(dict(id=f'P{i:03d}',nombre=p['producto'],proveedor=p['proveedor'],categoria=cat,unidad=UNI[cat],minimo=mn,ideal=ideal,actual=act,
      aPedir='',ultimaCuenta=(now-timedelta(days=random.choice([0,1,2,9]))).isoformat()+'Z' if act!='' else '',contadoPor=random.choice(['Lucía','Marta','Andrea']) if act!='' else '',
      activo=True,precio=round(random.uniform(lo,hi),2) if random.random()<.7 else '',precioFecha='',ultimoPedido='',notas=''))
provs=[dict(id=f'PR{i:02d}',nombre=s,activo=True,direccion='Pol. Ind. Ejemplo, nave 4' if s=='Bodegas Ruiz' else '',tipo=D['sup_cat'][s],contacto='',telefono='965 000 000' if s=='Bodegas Ruiz' else '',whatsapp='34600000000' if s in('Bodegas Ruiz','Dialsur') else '',
  email='pedidos@ejemplo.com' if s=='Bodegas Villena' else '',canal='Compra en tienda' if s=='Mercadona' else ('WhatsApp' if s in('Bodegas Ruiz','Dialsur') else ''),
  diaPedido='Lunes' if s in('Bodegas Ruiz','Dialsur') else '',diaReparto='',pedidoMinimo=100 if s=='Bodegas Ruiz' else '',orden=i,notas='') for i,s in enumerate(D['proveedores'],1)]
import datetime as _dt
pedidos=[dict(num='D1',proveedor='Bodegas Ruiz',fecha='2026-11-01T10:00:00Z',hechoPor='Admin',estado='Pendiente',
  lineas=[dict(id=p['id'],producto=p['nombre'],unidad=p['unidad'],cantidad=q,recibido=0) for p,q in zip([x for x in prods if x['proveedor']=='Bodegas Ruiz'][:4],[3,2,6,4])]),
  dict(num='D2',proveedor='Dialsur',fecha='2026-10-29T10:00:00Z',hechoPor='Admin',estado='Parcial',
  lineas=[dict(id=p['id'],producto=p['nombre'],unidad=p['unidad'],cantidad=q,recibido=r) for p,q,r in zip([x for x in prods if x['proveedor']=='Dialsur'][:3],[5,2,4],[5,0,1])])]
caja=[]
d0=_dt.date(2026,9,1)
while d0<_dt.date(2026,11,3):
    if d0.weekday()!=0:
        ef=round(random.uniform(180,520),2); ta=round(random.uniform(400,1400),2)
        caja.append(dict(fecha=d0.isoformat(),efectivo=ef,tarjeta=ta,total=round(ef+ta,2),notas='',por='Admin'))
    d0+=_dt.timedelta(days=1)
datos=dict(pedidos=pedidos,caja=caja,proveedores=provs,productos=prods,config={'MENSAJE_PEDIDO':'Hola{contacto}, somos El Otro Lado. Os pasamos el pedido:\n{lineas}\n¡Gracias!','ASUNTO_EMAIL':'Pedido El Otro Lado - {fecha}'})
mock='''<script>
/* DEMO: simula el servidor de Google con datos de ejemplo en memoria */
window.DEMO_DATOS = %s;
(function(){
  const D = window.DEMO_DATOS;
  const U = [{nombre:'Admin',pin:'123456',rol:'Administrador',activo:true},{nombre:'Lucía',pin:'1111',rol:'Básico',activo:true},
             {nombre:'Marta',pin:'2222',rol:'Básico',activo:true},{nombre:'Andrea',pin:'3333',rol:'Básico',activo:true}];
  const num = v => (v === '' || v == null || isNaN(Number(v))) ? '' : Number(v);
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
  function auth(c, admin){ const u = U.find(x => c && norm(x.nombre) === norm(c.nombre));
    if (!u || !u.activo || u.pin !== String(c.pin)) throw new Error('SESION: Nombre o PIN incorrectos.');
    if (admin && u.rol !== 'Administrador') throw new Error('Solo un administrador puede hacer esto.'); return {nombre:u.nombre, rol:u.rol}; }
  D.pedidos = D.pedidos || []; D.caja = D.caja || [];
  function datos(u){ const x = JSON.parse(JSON.stringify(D)); x.usuario = u;
    x.pedidos = x.pedidos.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial');
    if (u.rol === 'Administrador') x.usuarios = U.map(v => ({nombre:v.nombre, rol:v.rol, activo:v.activo, tienePin:!!v.pin}));
    else { x.productos = x.productos.filter(p => p.activo !== false).map(p => { delete p.precio; return p; }); delete x.config; delete x.caja; }
    return x; }
  const api = {
    usuariosPublicos(){ return U.filter(u => u.activo).map(u => ({ nombre: u.nombre, largo: String(u.pin).length })); },
    entrar(c){ const u = auth(c); return {usuario:u, datos:datos(u)}; },
    obtenerDatos(c){ return datos(auth(c)); },
    guardarRecuento(c, pl){ const u = auth(c), now = new Date().toISOString();
      pl.items.forEach(it => { const p = D.productos.find(x => x.id === it.id); if (!p) return;
        if (it.actual !== '') { p.actual = num(it.actual); p.ultimaCuenta = now; p.contadoPor = u.nombre; }
        if ('aPedir' in it) p.aPedir = num(it.aPedir); }); return datos(u); },
    guardarCantidades(c, pl){ const u = auth(c, true); pl.items.forEach(it => { const p = D.productos.find(x => x.id === it.id); if (p) p.aPedir = num(it.aPedir); }); return datos(u); },
    marcarPedidoHecho(c, pl){ const u = auth(c, true), now = new Date().toISOString();
      const ped = { num: 'D' + Date.now(), proveedor: pl.proveedor, fecha: now, hechoPor: u.nombre, estado: 'Pendiente', lineas: [] };
      pl.items.forEach(it => { const p = D.productos.find(x => x.id === it.id); if (p){ p.aPedir = ''; p.ultimoPedido = now; ped.lineas.push({ id: p.id, producto: p.nombre, unidad: p.unidad, cantidad: Number(it.cantidad), recibido: 0 }); } });
      if (ped.lineas.length) D.pedidos.push(ped); return datos(u); },
    recepcionarPedido(c, pl){ const u = auth(c); if (pl.cerrar && u.rol !== 'Administrador') throw new Error('Solo un administrador puede cerrar un pedido con faltas.');
      const ped = D.pedidos.find(p => p.num === pl.num && (p.estado === 'Pendiente' || p.estado === 'Parcial')); if (!ped) throw new Error('Este pedido ya no está pendiente.');
      let algo = false; (pl.lineas || []).forEach(l => { const ln = ped.lineas.find(x => x.id === l.id); const q = Number(l.cantidad) || 0; if (ln && q > 0){ algo = true; ln.recibido += q;
        const p = D.productos.find(x => x.id === l.id); if (p){ p.actual = (p.actual === '' ? 0 : p.actual) + q; p.ultimaCuenta = new Date().toISOString(); p.contadoPor = u.nombre; } } });
      const completo = ped.lineas.every(l => l.recibido >= l.cantidad);
      if (!algo && !completo && !pl.cerrar) throw new Error('No has marcado nada como recibido.');
      ped.estado = completo ? 'Completo' : pl.cerrar ? 'Cerrado con faltas' : 'Parcial'; return datos(u); },
    guardarCaja(c, pl){ const u = auth(c, true); const i = D.caja.findIndex(x => x.fecha === pl.fecha);
      if (pl.efectivo === '' && pl.tarjeta === ''){ if (i >= 0) D.caja.splice(i, 1); return datos(u); }
      const ef = Number(pl.efectivo) || 0, ta = Number(pl.tarjeta) || 0;
      const r = { fecha: pl.fecha, efectivo: ef, tarjeta: ta, total: Math.round((ef + ta) * 100) / 100, notas: pl.notas || '', por: u.nombre };
      if (i >= 0) D.caja[i] = r; else D.caja.push(r); return datos(u); },
    actualizarPrecio(c, pl){ const u = auth(c, true); const p = D.productos.find(x => x.id === pl.id); if (p){ p.precio = num(pl.precio); p.precioFecha = new Date().toISOString(); } return datos(u); },
    guardarPdf(c){ auth(c, true); return { url: '', nombre: 'demo.pdf' }; },
    guardarUsuario(c, o){ const yo = auth(c, true);
      if (!o.nombre) throw new Error('Falta el nombre.');
      const largo = o.rol === 'Administrador' ? 6 : 4;
      if (o.pin && !new RegExp('^\\\\d{' + largo + '}$').test(o.pin)) throw new Error('El PIN tiene que tener ' + largo + ' números.');
      if (U.some(x => norm(x.nombre) === norm(o.nombre) && norm(x.nombre) !== norm(o.original))) throw new Error('Ya existe un usuario con ese nombre.');
      const restantes = U.filter(x => x.rol === 'Administrador' && x.activo && norm(x.nombre) !== norm(o.original)).length;
      if (!restantes && (o.rol !== 'Administrador' || o.activo === false)) throw new Error('Tiene que quedar al menos un administrador activo.');
      let u = U.find(x => norm(x.nombre) === norm(o.original));
      if (!u){ if (!o.pin) throw new Error('Pon un PIN de ' + largo + ' números para el usuario nuevo.'); u = {}; U.push(u); }
      Object.assign(u, {nombre:o.nombre, rol:o.rol, activo:o.activo !== false}); if (o.pin) u.pin = o.pin;
      const soyYo = norm(o.original) === norm(yo.nombre);
      return { datos: datos(soyYo ? {nombre:u.nombre, rol:u.rol} : yo), cred: soyYo ? {nombre:u.nombre, pin:u.pin} : null }; },
    guardarProveedor(c, o){ const u = auth(c, true);
      if (!o.nombre) throw new Error('Falta el nombre del proveedor.');
      if (D.proveedores.some(x => norm(x.nombre) === norm(o.nombre) && x.id !== o.id)) throw new Error('Ya existe un proveedor con ese nombre.');
      let p = D.proveedores.find(x => x.id === o.id);
      if (!p){ p = {id:'PR' + String(D.proveedores.length + 1).padStart(2,'0')}; D.proveedores.push(p); }
      const antes = p.nombre;
      Object.assign(p, o, {id:p.id, whatsapp:String(o.whatsapp||'').replace(/\\D/g,''), pedidoMinimo:num(o.pedidoMinimo), orden:num(o.orden) === '' ? D.proveedores.length : num(o.orden)});
      if (antes && antes !== p.nombre) D.productos.forEach(x => { if (x.proveedor === antes) x.proveedor = p.nombre; });
      D.proveedores.sort((a,b) => (a.orden||999) - (b.orden||999)); return datos(u); },
    eliminarProducto(c, o){ const u = auth(c, true); const i = D.productos.findIndex(x => x.id === o.id); if (i < 0) throw new Error('Ese producto ya no existe.');
      if (D.pedidos.some(p => (p.estado === 'Pendiente' || p.estado === 'Parcial') && p.lineas.some(l => l.id === o.id))) throw new Error('No se puede eliminar: está en un pedido pendiente de recibir. Recíbelo o ciérralo antes.');
      D.productos.splice(i, 1); return datos(u); },
    eliminarProveedor(c, o){ const u = auth(c, true); const pv = D.proveedores.find(x => x.id === o.id); if (!pv) throw new Error('Ese proveedor ya no existe.');
      if (D.pedidos.some(p => (p.estado === 'Pendiente' || p.estado === 'Parcial') && p.proveedor === pv.nombre)) throw new Error('No se puede eliminar: ' + pv.nombre + ' tiene un pedido pendiente de recibir. Recíbelo o ciérralo antes.');
      D.productos = D.productos.filter(x => x.proveedor !== pv.nombre); D.proveedores = D.proveedores.filter(x => x !== pv); return datos(u); },
    guardarProducto(c, o){ const u = auth(c, true);
      if (!o.nombre) throw new Error('Falta el nombre del producto.');
      let p = D.productos.find(x => x.id === o.id);
      if (!p){ p = {id:'P' + String(D.productos.length + 1).padStart(3,'0'), actual:'', aPedir:'', ultimaCuenta:'', contadoPor:'', precioFecha:'', ultimoPedido:''}; D.productos.push(p); }
      Object.assign(p, o, {id:p.id}); return datos(u); }
  };
  function runner(ok, ko){
    return new Proxy({}, { get(_, k){
      if (k === 'withSuccessHandler') return f => runner(f, ko);
      if (k === 'withFailureHandler') return f => runner(ok, f);
      return (...a) => setTimeout(() => { try { ok && ok(api[k](...a)); } catch(e){ ko && ko(e); } }, 200);
    }});
  }
  window.google = { script: { run: runner() } };
})();
</script>
''' % json.dumps(datos,ensure_ascii=False)
banner='<div style="background:var(--info);color:#231E1F;font-size:13px;font-weight:600;text-align:center;padding:6px 16px">Demo con datos inventados. Entra como Admin (PIN 123456) o como Lucía (PIN 1111, usuario básico).</div>\n'
demo=app.replace('<div id="app">',banner+'<div id="app">',1).replace('<script src="https://cdnjs',mock+'<script src="https://cdnjs',1)
demo=demo.replace('<a href="${url}" download="${esc(nombre)}">Descargar</a></div>`;','En la app real se descarga y se guarda en vuestra carpeta de Drive.</div>`;')
open('out/demo.html','w').write(demo)
print(len(app)//1024,'KB app;',len(demo)//1024,'KB demo')
