const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/claude/vermut/out/demo.html'); await p.waitForTimeout(700);
  await p.click('[data-nombre="Admin"]'); for (const d of '123456') await p.click(`[data-tecla="${d}"]`); await p.waitForTimeout(400);
  await p.click('[data-ir="admin"]'); await p.click('[data-admintab="productos"]'); await p.waitForTimeout(200);
  const nAntes = await p.$$eval('[data-editar-producto]', x=>x.length);
  const prim = await p.$eval('[data-editar-producto]', x=>x.dataset.editarProducto);
  await p.click(`[data-editar-producto="${prim}"]`); await p.waitForTimeout(200);
  await p.screenshot({path:'/tmp/claude-0/del1.png'});
  await p.click('#bBorrar'); await p.waitForTimeout(200); await p.screenshot({path:'/tmp/claude-0/del2.png'});
  console.log('conf:', (await p.innerText('.hoja')).replace(/\s+/g,' '));
  await p.click('#bSiBorrar'); await p.waitForTimeout(400);
  console.log('productos', nAntes, '->', await p.$$eval('[data-editar-producto]', x=>x.length));
  // proveedor con pedido pendiente (D1/D2) -> debe fallar
  await p.click('[data-admintab="proveedores"]'); await p.waitForTimeout(200);
  const provs = await p.$$eval('[data-editar-proveedor]', x=>x.map(y=>y.dataset.editarProveedor));
  await p.click(`[data-editar-proveedor="${provs[0]}"]`); await p.click('#bBorrar'); await p.click('#bSiBorrar'); await p.waitForTimeout(300);
  console.log('prov0:', (await p.innerText('.hoja').catch(()=> 'cerrada')).replace(/\s+/g,' ').slice(0,250));
  await p.click('[data-cerrar]').catch(()=>{}); 
  const last = provs[provs.length-1];
  await p.click(`[data-editar-proveedor="${last}"]`); await p.click('#bBorrar'); console.log('conf last:', (await p.innerText('.hoja')).replace(/\s+/g,' ').slice(0,160)); await p.click('#bSiBorrar'); await p.waitForTimeout(300);
  console.log('provs', provs.length, '->', await p.$$eval('[data-editar-proveedor]', x=>x.length));
  console.log('errores', errs); await b.close();
})();
