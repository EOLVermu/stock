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
eval(fs.readFileSync('../out/Code.gs','utf8')+';global.T={entrar,guardarUsuario,doPost}');
const ok=(n,f)=>{try{const r=f();console.log('OK ',n,r===undefined?'':JSON.stringify(r).slice(0,150))}catch(e){console.log('ERR',n,e.message)}};
const A={nombre:'Admin',pin:'1234'};
ok('admin entra (pin viejo 4)',()=>T.entrar(A).usuario);
ok('basico 6 cifras (falla)',()=>T.guardarUsuario(A,{nombre:'Lucía',rol:'Básico',pin:'111111'}));
ok('alta Lucia 4',()=>T.guardarUsuario(A,{nombre:'Lucía',rol:'Básico',pin:'1111'}).cred);
ok('subir a admin sin pin (falla)',()=>T.guardarUsuario(A,{original:'Lucía',nombre:'Lucía',rol:'Administrador'}));
ok('subir a admin pin 4 (falla)',()=>T.guardarUsuario(A,{original:'Lucía',nombre:'Lucía',rol:'Administrador',pin:'1111'}));
ok('subir a admin pin 6',()=>T.guardarUsuario(A,{original:'Lucía',nombre:'Lucía',rol:'Administrador',pin:'654321'}).datos.usuarios);
ok('editar sin cambiar rol ni pin',()=>!!T.guardarUsuario(A,{original:'Lucía',nombre:'Lucía',rol:'Administrador',activo:true}));
for(let i=1;i<=6;i++) ok('fallo '+i,()=>T.entrar({nombre:'lucia',pin:'000000'}));
ok('bloqueada aunque PIN bueno',()=>T.entrar({nombre:'Lucía',pin:'654321'}));
Object.keys(C).forEach(k=>delete C[k]);
ok('tras 15 min entra',()=>T.entrar({nombre:'Lucía',pin:'654321'}).usuario);
ok('doPost entrar',()=>T.doPost({postData:{contents:JSON.stringify({fn:'entrar',args:[{nombre:'Lucía',pin:'654321'}]})}}).slice(0,80));
ok('doPost prohibida',()=>T.doPost({postData:{contents:JSON.stringify({fn:'usuarios_',args:[]})}}));
ok('doPost mal pin',()=>T.doPost({postData:{contents:JSON.stringify({fn:'entrar',args:[{nombre:'x',pin:'1'}]})}}));
