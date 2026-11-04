const fs=require('fs'); const S=JSON.parse(fs.readFileSync('sheets.json'));
const isF=v=>typeof v==='string'&&v.startsWith('=');
function sheet(name){ const d=S[name]; const rg=(r,c,nr=1,nc=1)=>({
    getValues:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>{const v=(d[r-1+i]||[])[c-1+j]??''; return isF(v)?'':v;})),
    getFormulas:()=>Array.from({length:nr},(_,i)=>Array.from({length:nc},(_,j)=>{const v=(d[r-1+i]||[])[c-1+j]??''; return isF(v)?v:'';})),
    getValue:()=>(d[r-1]||[])[c-1]??'',
    setValues:v=>{v.forEach((row,i)=>{d[r-1+i]=d[r-1+i]||[]; row.forEach((x,j)=>d[r-1+i][c-1+j]=x)}); return rg(r,c,nr,nc);},
    setValue:x=>{d[r-1]=d[r-1]||[]; d[r-1][c-1]=x}, setFormula:x=>{d[r-1]=d[r-1]||[]; d[r-1][c-1]=x}, setNumberFormat(){}, setFontWeight(){return this;}});
  return { getLastRow:()=>{let n=d.length; while(n>1&&d[n-1].every(v=>v===''||v==null))n--; return n;},
  getLastColumn:()=>Math.max(...d.map(r=>r.length)), getRange:rg, appendRow:row=>d.push(row), setFrozenRows(){}, deleteRow:r=>d.splice(r-1,1)};}
global.SpreadsheetApp={getActive:()=>({getSheetByName:n=>S[n]?sheet(n):null, insertSheet:n=>{S[n]=[[]]; return sheet(n);}, getSpreadsheetTimeZone:()=> 'Europe/Madrid'})};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
const C={}; global.CacheService={getScriptCache:()=>({get:k=>C[k]??null,put:(k,v)=>{C[k]=v},remove:k=>{delete C[k]}})};
global.ContentService={createTextOutput:t=>({setMimeType(){return t;}}),MimeType:{JSON:1}};
global.Utilities={formatDate:()=> 'x'}; global.Session={getScriptTimeZone:()=> 'Europe/Madrid'};
global.Utilities={formatDate:()=>'261104-'+String(Math.random()).slice(2,8)};
eval(fs.readFileSync('../out/Code.gs','utf8')+';global.T={eliminarProducto,eliminarProveedor,marcarPedidoHecho,doPost}');
const ok=(n,f)=>{try{const r=f();console.log('OK ',n,r===undefined?'':JSON.stringify(r).slice(0,120))}catch(e){console.log('ERR',n,e.message)}};
const A={nombre:'Admin',pin:'1234'};
const np=()=>S.Productos.filter(r=>r[0]).length-1, nv=()=>S.Proveedores.filter(r=>r[0]).length-1;
console.log('antes', np(), nv());
ok('pedido Erna',()=>T.marcarPedidoHecho(A,{proveedor:'Erna',items:[{id:'P053',cantidad:2}]}).pedidos.length);
ok('borrar P053 (en pedido, falla)',()=>T.eliminarProducto(A,{id:'P053'}));
ok('borrar proveedor Erna (pedido, falla)',()=>T.eliminarProveedor(A,{id:'PR06'}));
ok('borrar P001',()=>T.eliminarProducto(A,{id:'P001'}).productos.length);
ok('borrar P001 otra vez (falla)',()=>T.eliminarProducto(A,{id:'P001'}));
ok('borrar Mónica (PR19) + productos',()=>T.eliminarProveedor(A,{id:'PR19'}).proveedores.length);
console.log('despues', np(), nv(), S.Productos.some(r=>r[2]==='Mónica y Miguel Ángel'));
console.log('formula fila 2', S.Productos[1].join('|').slice(0,120));
ok('basico (falla)',()=>T.eliminarProducto({nombre:'x',pin:'1'},{id:'P002'}));
ok('doPost eliminar',()=>T.doPost({postData:{contents:JSON.stringify({fn:'eliminarProducto',args:[A,{id:'P002'}]})}}).slice(0,40));
