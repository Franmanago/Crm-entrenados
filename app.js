(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GYMS=['LEVEL','CROSSFORCE','ONLINE'];
const GYM_LBL={LEVEL:'LEVEL',CROSSFORCE:'CrossForce',ONLINE:'Online'};
const GYM_VAR={LEVEL:'--accent',CROSSFORCE:'--cf',ONLINE:'--online'};
const DEF_CFG={online:40000,gyms:{
  LEVEL:{pctFran:0.7,tarifas:{"1":51000,"2":60000,"3":69000,"4":75000,"5":89000}},
  CROSSFORCE:{pctFran:0.6,tarifas:{"1":55000,"2":62000,"3":70000,"4":77000,"5":84000}}}};
const AVISOS_DEF={pagoOn:true,rutinaOn:true,diasPago:3,diasRutina:5,
  pago:'Hola {nombre}! Tu cuota vence {cuando} ({fecha}). El valor es {monto}. Podés abonar en efectivo o por transferencia. ¡Gracias!',
  rutina:'Tu mes de entrenamiento se completa {cuando} ({fecha}). Con la renovación de la cuota te preparo la próxima rutina para que no cortes la continuidad.',
  alias:'',banco:'',wa:'',gyms:{LEVEL:true,ONLINE:true,CROSSFORCE:false}};
const avisoAuto=e=>{const g=gymOf(e);const m={...AVISOS_DEF.gyms,...(S.cfg.avisos?.gyms||{})};return m[g]!==false};
const avisoOn=e=>e.avisoPago==='si'?true:e.avisoPago==='no'?false:avisoAuto(e);
function normCfg(raw){
  const c=JSON.parse(JSON.stringify(DEF_CFG));
  if(!raw){c.avisos={...AVISOS_DEF};c.alertas={dias:10,acwr:1.5};c.rmDefs=[];c.redondeo=2.5;c.posiciones=['Extremo','Pivote','Armador','Arquero'];c.bloques=['ZONA MEDIA','FUERZA 1','FUERZA 2','FUERZA 3','PLAYITA'];c.appUrl='';return c}
  if(raw.online!=null)c.online=Number(raw.online)||0;
  if(raw.gyms){for(const g of ['LEVEL','CROSSFORCE'])if(raw.gyms[g])c.gyms[g]={...c.gyms[g],...raw.gyms[g]}}
  else{if(raw.tarifas)c.gyms.LEVEL.tarifas=raw.tarifas;if(raw.pctFran!=null)c.gyms.LEVEL.pctFran=raw.pctFran}
  c.rmDefs=Array.isArray(raw.rmDefs)?raw.rmDefs:[];c.redondeo=Number(raw.redondeo)||2.5;
  c.posiciones=Array.isArray(raw.posiciones)?raw.posiciones:['Extremo','Pivote','Armador','Arquero'];
  c.bloques=Array.isArray(raw.bloques)?raw.bloques:['ZONA MEDIA','FUERZA 1','FUERZA 2','FUERZA 3','PLAYITA'];
  c.appUrl=raw.appUrl||'';
  c.alertas={dias:Number(raw.alertas?.dias)||10,acwr:Number(raw.alertas?.acwr)||1.5};
  c.avisos={...AVISOS_DEF,...(raw.avisos||{}),gyms:{...AVISOS_DEF.gyms,...(raw.avisos?.gyms||{})}};
  return c;
}
const S={equipos:[],tests:[],temps:[],eqSel:null,evs:[],liqs:[],rends:[],pv:'ganado',ents:{},hist:[],pagos:[],meses:{},rutinas:[],ejs:{},ejsV:0,plantillas:{},regs:[],cfgRaw:{},mes:null,cfg:normCfg(),db:null,loaded:false,view:'panel',filter:'activos',q:''};
const WA='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';

/* ---------- fechas ---------- */
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const days=(a,b)=>Math.round((a-b)/864e5);
const fmtD=s=>{const d=parse(s);return d?pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear():'—'};
const fmtShort=s=>{const d=parse(s);return d?pad(d.getDate())+'/'+pad(d.getMonth()+1):'—'};
const addMonth=s=>{const d=parse(s)||today();const day=d.getDate();const n=new Date(d.getFullYear(),d.getMonth()+1,1);const last=new Date(n.getFullYear(),n.getMonth()+1,0).getDate();n.setDate(Math.min(day,last));return iso(n)};
const money=n=>'$'+Math.round(n||0).toLocaleString('es-AR');
const pct=n=>Math.round(n*100)+'%';

/* ---------- reglas de negocio ---------- */
const estado=e=>e.estado==='Inactivo'?'Baja':(e.estado||'Activo');
const isAct=e=>estado(e)==='Activo';
const gymOf=e=>GYMS.includes(e.gym)?e.gym:'LEVEL';
const pctFran=g=>g==='ONLINE'?1:(Number(S.cfg.gyms[g]?.pctFran)||0);
const sinCuota=e=>e&&e.cuota==='sin';
function monto(e){
  if(sinCuota(e))return 0;
  if(e.cuota==='fijo')return Math.round(Number(e.montoFijo)||0);
  const g=gymOf(e);
  if(g==='ONLINE')return Number(S.cfg.online)||0;
  const base=Number(S.cfg.gyms[g].tarifas[String(e.estimulos)])||0;
  return Math.round(base*(1-(Number(e.promo)||0)));
}
function estadoPago(e){
  if(!isAct(e))return'—';
  if(sinCuota(e))return'Sin cuota';
  const v=parse(e.proxVenc);
  if(!v||v<today())return'Vencido';
  return e.pagoRegistrado==='Debe'?'Pendiente':'Al día';
}
const diasVenc=e=>{const v=parse(e.proxVenc);return v?days(v,today()):null};
const diasRutina=e=>{const r=parse(e.ultRutina);return r?days(today(),r):null};
function periodo(e){const r=parse(e.ultRutina);if(!r)return'';const d=r.getDate();return d<=5?'Periodo A':d<=15?'Periodo B':d<=22?'Periodo C':'Periodo D'}
const rutinaRevisar=e=>isAct(e)&&(['Cambiar','Planificar','Sin definir'].includes(e.modalidad)||(diasRutina(e)??0)>30);
const pagoPill=p=>p==='Al día'?'p-ok':p==='Pendiente'?'p-warn':p==='Vencido'?'p-bad':'p-mute';
const estPill=s=>s==='Activo'?'p-ok':s==='Suspendido'?'p-warn':'p-bad';
const gymPill=g=>g==='ONLINE'?'p-on':g==='CROSSFORCE'?'p-cf':'p-lv';
const gymTag=e=>`<span class="pill ${gymPill(gymOf(e))}">${GYM_LBL[gymOf(e)]}</span>`;
const titleCase=s=>String(s||'').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
const name=e=>titleCase(e.nombre);
const firstName=e=>name(e).split(' ')[0];
const phoneDigits=e=>String(e.telefono||'').replace(/\D/g,'');

/* ---------- mensajes ---------- */
const TEMPLATES=[['pago','Recordatorio de vencimiento'],['vencido','Cuota pendiente'],['rutina','Rutina nueva'],['link','Link personal'],['ausencia','No viene entrenando'],['vuelta','Invitar a volver'],['libre','Mensaje libre']];
function waText(e,kind){
  const n=firstName(e),m=money(monto(e)),v=fmtD(e.proxVenc);
  if(kind==='pago')return `Hola ${n}! Te recuerdo que tu cuota de ${m} vence el ${v}. Podés abonarla por transferencia o en el gimnasio. ¡Gracias!`;
  if(kind==='vencido')return `Hola ${n}, ¿cómo estás? Te escribo porque la cuota de ${m} figura pendiente${e.proxVenc?` (vencimiento ${v})`:''}. Avisame cuando puedas abonarla. ¡Gracias!`;
  if(kind==='rutina'){const u=portalUrl(e);return `Hola ${n}! Ya está lista tu rutina nueva 💪${u?`\nLa ves acá, con los videos y para anotar tus kg: ${u}`:''}`}
  if(kind==='ausencia')return `Hola ${n}! ¿Cómo andás? Hace unos días que no veo entrenamientos marcados en tu link. ¿Todo bien? Si necesitás que adaptemos la rutina o los horarios, avisame y lo vemos 💪`;
  if(kind==='link'){const u=portalUrl(e);return `Hola ${n}! Este es tu link personal para ver tu rutina con los videos y anotar los kg que vas usando: ${u||'(todavía sin link)'}\nGuardalo en favoritos 😉`}
  if(kind==='vuelta')return `Hola ${n}! ¿Cómo andás? Quería saber si tenés ganas de retomar los entrenamientos. Tengo lugar en los horarios de siempre, avisame y lo coordinamos.`;
  return `Hola ${n}! `;
}
const waUrl=(e,text)=>'https://api.whatsapp.com/send?phone='+phoneDigits(e)+'&text='+encodeURIComponent(text);
const waKind=e=>{if(!isAct(e))return'vuelta';if(sinCuota(e))return'link';const p=estadoPago(e);return p==='Vencido'||p==='Pendiente'?'vencido':'pago'};
const msgBtn=(e,kind,label)=>`<button class="wa" data-msg="${esc(e.id)}" data-kind="${kind}">${WA}${esc(label||'Avisar')}</button>`;

/* ---------- UI helpers ---------- */
/* El aviso va en la capa superior (popover) para verse también encima de una hoja modal abierta.
   Sin soporte de popover, se muestra igual que antes (detrás de la hoja). */
const POP=Object.hasOwn(HTMLElement.prototype,'popover');
/* Anuncio para lectores de pantalla: con una hoja modal abierta lo de afuera queda inerte, así que se anuncia desde la hoja */
function anunciar(m){const ov=$('#overlay'),host=ov&&ov.open?ov:document.body;
  if(typeof host.ariaNotify==='function'){try{host.ariaNotify(m);return}catch(_){}}
  let lr=host.querySelector(':scope>.sr-live');if(!lr){lr=document.createElement('div');lr.className='sr-live';lr.setAttribute('aria-live','polite');host.appendChild(lr)}
  lr.textContent='';setTimeout(()=>{lr.textContent=m},30)}
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;anunciar(m);
  if(POP){try{if(t.matches(':popover-open'))t.hidePopover();t.showPopover()}catch(_){}}
  clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;if(POP)try{t.hidePopover()}catch(_){}},2600)}
function banner(m){const b=$('#banner');b.textContent=m||'';b.hidden=!m}
$('#today').textContent=today().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
const plural=(n,a,b)=>n+' '+(n===1?a:b);

/* ---------- MESES ---------- */
const MESES_N=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const mesKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1);
const curMes=()=>mesKey(today());
const mesLbl=k=>{const [y,m]=k.split('-').map(Number);return MESES_N[m-1]+' '+y};
const mesCorto=k=>{const [y,m]=k.split('-').map(Number);return MESES_N[m-1].slice(0,3)+' '+String(y).slice(2)};
const mesShift=(k,n)=>{const [y,m]=k.split('-').map(Number);return mesKey(new Date(y,m-1+n,1))};
/* primer cobro: el pago más antiguo registrado o, si todavía no pagó nunca, la fecha de primer pago cargada en la ficha.
   Quien arranca a pagar en un mes posterior no figura como deuda en los meses anteriores. */
const primerCobro=e=>{const fs=S.pagos.filter(p=>p.entrenadoId===e.id&&p.fecha).map(p=>p.fecha);if(e.ultPago)fs.push(e.ultPago);return fs.sort()[0]||e.inicio||''};
const cobraEn=(e,M)=>{if(!M)return true;const f=primerCobro(e);return !f||f.slice(0,7)<=M};
const liveRoster=M=>Object.values(S.ents).filter(e=>isAct(e)&&!sinCuota(e)&&cobraEn(e,M)).map(e=>({id:e.id,nombre:e.nombre,gym:gymOf(e),monto:monto(e),pct:pctFran(gymOf(e))}));
function mesesList(){
  const s=new Set([curMes()]);
  Object.keys(S.meses).forEach(k=>s.add(k));
  S.pagos.forEach(p=>p.mes&&s.add(p.mes));
  return [...s].sort();
}
function monthData(M){
  const doc=S.meses[M];
  const roster=doc&&doc.plantel?doc.plantel:liveRoster(M);
  const pagos=S.pagos.filter(p=>p.mes===M);
  const paid=new Set(pagos.map(p=>p.entrenadoId));
  const G={};GYMS.forEach(g=>G[g]={n:0,f:0,c:0,p:0,ff:0,fc:0,fp:0});
  const liq=liqMes(M);
  roster.forEach(r=>{const g=G[r.gym]||G.LEVEL;g.n++;g.f+=r.monto;g.ff+=r.monto*r.pct;if(r.gym!=='CROSSFORCE'&&!paid.has(r.id)){g.p+=r.monto;g.fp+=r.monto*r.pct}});
  pagos.forEach(p=>{const g=G[p.gym]||G.LEVEL;g.c+=Number(p.monto)||0;g.fc+=(Number(p.monto)||0)*(p.pctFran??1)});
  if(liq){const pc=pctFran('CROSSFORCE')||1;G.CROSSFORCE.fc+=Number(liq.monto)||0;G.CROSSFORCE.c+=(Number(liq.monto)||0)/pc;if(!G.CROSSFORCE.ff&&liq.esperado){G.CROSSFORCE.ff=Number(liq.esperado)||0;G.CROSSFORCE.f=G.CROSSFORCE.ff/pc}}
  const T={n:0,f:0,c:0,p:0,ff:0,fc:0,fp:0};GYMS.forEach(g=>Object.keys(T).forEach(k=>T[k]+=G[g][k]));
  const pend=roster.filter(r=>r.gym!=='CROSSFORCE'&&!paid.has(r.id));
  return {M,roster,pagos,paid,G,T,pend,liq,cerrado:!!(doc&&doc.cerrado)};
}
const adeudados=id=>unpaidMeses(id).filter(k=>k<curMes());
function unpaidMeses(id){
  return mesesList().filter(M=>M<=curMes()).filter(M=>{const d=monthData(M);return d.roster.some(r=>r.id===id)&&!d.paid.has(id)});
}

/* ---------- PANEL ---------- */
function renderPanel(){
  const el=$('#v-panel');
  const all=Object.values(S.ents);
  if(!S.loaded){el.innerHTML='<div class="card empty">Cargando entrenados…</div>';return}
  if(!all.length){el.innerHTML='<div class="card pad"><b>Todavía no hay entrenados cargados.</b><p class="hint">Tocá “+ Nuevo entrenado” para agregar el primero.</p></div>';return}
  const meses=mesesList();
  if(!S.mes||!meses.includes(S.mes))S.mes=curMes();
  const tabFin=S.ptab==='fin';
  const M=tabFin?S.mes:curMes(),isCur=M===curMes(),D=monthData(M);
  const act=all.filter(isAct);
  const susp=all.filter(e=>estado(e)==='Suspendido').sort((a,b)=>name(a).localeCompare(name(b),'es'));
  const bajas=all.filter(e=>estado(e)==='Baja').sort((a,b)=>name(a).localeCompare(name(b),'es'));
  const prox=act.filter(e=>{const d=diasVenc(e);return estadoPago(e)==='Al día'&&d!==null&&d>=0&&d<=7}).sort((a,b)=>diasVenc(a)-diasVenc(b));
  const rut=act.filter(rutinaRevisar).sort((a,b)=>(diasRutina(b)??999)-(diasRutina(a)??999));
  const plans={};act.forEach(e=>plans[e.plan||'Sin plan']=(plans[e.plan||'Sin plan']||0)+1);
  const est={};act.forEach(e=>est[e.estimulos]=(est[e.estimulos]||0)+1);
  const maxP=Math.max(...Object.values(plans),1),maxE=Math.max(...Object.values(est),1);
  const ag={};act.forEach(e=>{const d=diasVenc(e);if(d!==null&&d>=0&&d<=30)(ag[e.proxVenc]=ag[e.proxVenc]||[]).push(e)});
  const agK=Object.keys(ag).sort();
  const pctCob=D.T.f?Math.min(1,D.T.c/D.T.f):0;
  // estado de cada pendiente del mes
  const pendInfo=D.pend.map(r=>{const e=S.ents[r.id];let tag,cls,kind='vencido';
    if(!isCur){tag='Sin pagar';cls='p-bad'}
    else if(!e||!isAct(e)){tag=e?estado(e):'Sin ficha';cls='p-mute'}
    else{const p=estadoPago(e);if(p==='Al día'){tag='Vence '+fmtShort(e.proxVenc);cls='p-mute';kind='pago'}else{tag=p;cls=pagoPill(p)}}
    return {r,e,tag,cls,kind}}).sort((a,b)=>(a.cls==='p-mute')-(b.cls==='p-mute')||(a.e?.proxVenc||'').localeCompare(b.e?.proxVenc||''));
  const urg=pendInfo.filter(x=>x.cls!=='p-mute'&&x.e&&isAct(x.e));
  const hoyV=act.filter(e=>diasVenc(e)===0&&estadoPago(e)==='Al día');
  const aus=ausentes();const cargaAlta=act.map(e=>({e,a:acwr(e.id)})).filter(x=>x.a.ratio!=null&&x.a.ratio>S.cfg.alertas.acwr).sort((x,y)=>y.a.ratio-x.a.ratio);
  const bienHoy=act.map(e=>({e,b:S.regs.find(r=>r.entrenadoId===e.id&&r.tipo==='bien'&&r.fecha===iso(today())),st:estadoBien(e.id,iso(today()))})).filter(x=>x.b&&x.st&&x.st.k!=='verde').sort((a,b)=>(a.st.k==='rojo'?0:1)-(b.st.k==='rojo'?0:1));
  S._lists={deuda:urg.map(x=>x.e),prox,hoy:hoyV,ausentes:aus.map(x=>x.e)};
  const li=(e,meta,kind)=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${meta}</span>${msgBtn(e,kind,'Avisar')}</li>`;
  const bulkBtn=(key,n)=>n>1?`<button class="btn" style="padding:5px 10px;font-size:13px" data-bulk="${key}">Avisar a los ${n}</button>`:'';
  const head=(t,key,n)=>`<div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>${t}</b>${bulkBtn(key,n)}</div>`;
  const prev=mesShift(curMes(),-1),prevOpen=meses.includes(prev)&&!(S.meses[prev]&&S.meses[prev].cerrado);
  // historial de meses
  const hist=meses.map(monthData);
  const maxF=Math.max(...hist.map(h=>Math.max(h.T.ff,h.T.fc)),1);

  const hoyHTML=()=>`<div class="hoy-res"><span>${mesLbl(M)}: cobraste <b>${money(D.T.fc)}</b> de ${money(D.T.ff)}</span><span class="prog"><i style="width:${D.T.ff?Math.min(100,D.T.fc/D.T.ff*100):0}%"></i></span><button class="lnk-f" type="button" data-ptab="fin">Ver finanzas ›</button></div>
  <h2 class="sec">${isCur?'Para hacer hoy':'Cuotas de '+mesLbl(M)}</h2>
  <div class="grid2 hoy-grid">
    ${isCur?`<div class="card">${head(`Vencen hoy · ${fmtShort(iso(today()))}`,'hoy',hoyV.length)}
      ${hoyV.length?`<ul class="alist">${hoyV.map(e=>li(e,`${money(monto(e))}`,'pago')).join('')}</ul>${hoyV.length===1?'':''}`:'<div class="empty">Hoy no vence ninguna cuota.</div>'}</div>`:''}
    ${isCur&&aus.length?`<div class="card">${head(`Sin entrenar hace ${S.cfg.alertas.dias} días o más`,'ausentes',aus.length)}
      <ul class="alist">${aus.map(x=>li(x.e,`últ. ${fmtShort(x.ult)} · ${x.d} d`,'ausencia')).join('')}</ul><p class="hint pad" style="padding-top:6px">Solo entrenados que marcan asistencia en su link.</p></div>`:''}
    ${isCur&&cargaAlta.length?`<div class="card falta-card"><div class="pad" style="padding-bottom:6px"><b>Carga en aumento</b> <span class="pill p-bad">${cargaAlta.length}</span><p class="hint">La carga de los últimos 7 días es más de ${S.cfg.alertas.acwr} veces su promedio de las 4 semanas anteriores.</p></div>
      <ul class="alist">${cargaAlta.map(x=>`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}</button><span class="meta"><span class="pill p-bad">${x.a.ratio.toFixed(2)}</span> ${x.a.agudo} UA esta semana</span></li>`).join('')}</ul></div>`:''}
    ${isCur?(()=>{const wd=((today().getDay()+6)%7)+1;const L=act.flatMap(e=>(e.horarios||[]).filter(h=>Number(h.dia)===wd).map(h=>({e,h}))).sort((x,y)=>x.h.hora.localeCompare(y.h.hora));
      return L.length?`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Hoy entrenan</b> <span class="pill p-ok">${L.length}</span><p class="hint">Según los horarios cargados en cada ficha.</p></div><ul class="alist">${L.map(({e,h})=>`<li><span class="hor-h">${esc(h.hora)}</span><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${gymTag(e)}${ultAsis(e.id)===iso(today())?' <span class="pill p-ok">✓ Ya marcó</span>':''}</span></li>`).join('')}</ul></div>`:''})():''}
    ${isCur&&bienHoy.length?`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Wellness de hoy: moderado o bajo</b> <span class="pill p-warn">${bienHoy.length}</span><p class="hint">Comparado con su propio promedio de las últimas 4 semanas. Si la rutina tiene el ajuste activado, ya entrenan con la carga reducida.</p></div>
      <ul class="alist">${bienHoy.map(x=>`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}<br><span class="hint">${bienTxt(x.b.datos)}</span></button><span class="pill ${EST[x.st.k][1]}">${EST[x.st.k][0]}${activaDe(x.e.id)?.ajusteWellness?' · '+EST[x.st.k][2]+'%':''}</span></li>`).join('')}</ul></div>`:''}
    <div class="card">${head(isCur?`Cobros de ${mesLbl(M)} · ${D.pagos.length} pagaron`:`Sin pagar en ${mesLbl(M)}`,'deuda',urg.length)}
      ${pendInfo.length?`<ul class="alist">${pendInfo.map(x=>x.e?`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}</button><span class="meta"><span class="pill ${x.cls}">${esc(x.tag)}</span> ${money(x.r.monto)}</span>${msgBtn(x.e,x.kind,'Avisar')}</li>`:`<li><span class="nm">${esc(titleCase(x.r.nombre))}</span><span class="meta">${money(x.r.monto)}</span></li>`).join('')}</ul>`:'<div class="empty">Todos pagaron este mes.</div>'}
    </div>
    ${isCur?`<div class="card">${head('Vencen en los próximos 7 días','prox',prox.length)}
      ${prox.length?`<ul class="alist">${prox.map(e=>li(e,`${fmtShort(e.proxVenc)} · ${diasVenc(e)===0?'hoy':diasVenc(e)+' d'}`,'pago')).join('')}</ul>`:'<div class="empty">No hay vencimientos esta semana.</div>'}
    </div>
    ${entregasCard()}
    ${sinTerminarCard(true)}
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Rutinas a revisar</b></div>
      ${rut.length?`<ul class="alist">${rut.map(e=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${diasRutina(e)!==null&&diasRutina(e)>30?diasRutina(e)+' días':esc(e.modalidad)}</span></li>`).join('')}</ul>`:'<div class="empty">Todas las rutinas están al día.</div>'}
    </div>
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Agenda de vencimientos · 30 días</b></div>
      ${agK.length?`<ul class="alist">${agK.map(k=>`<li><span class="nm" style="flex:0 0 64px;font-weight:600">${fmtShort(k)}</span><span class="meta" style="flex:1;white-space:normal">${ag[k].length} · ${ag[k].slice(0,4).map(e=>esc(firstName(e))).join(', ')}${ag[k].length>4?'…':''}</span><span class="meta">${money(ag[k].reduce((a,e)=>a+monto(e),0))}</span></li>`).join('')}</ul>`:'<div class="empty">Sin vencimientos próximos.</div>'}
    </div>`:`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Pagos registrados · ${D.pagos.length}</b></div>
      ${D.pagos.length?`<ul class="alist">${D.pagos.slice().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')).map(p=>`<li><span class="nm">${esc(titleCase(p.nombre||S.ents[p.entrenadoId]?.nombre||p.entrenadoId))}</span><span class="meta">${fmtShort(p.fecha)} · ${money(p.monto)}${p.forma?' · '+esc(formaTxt(p)):''}</span></li>`).join('')}</ul>`:'<div class="empty">Sin pagos registrados.</div>'}
    </div>`}
  </div>

`;
  const finHTML=()=>`  <div class="chips" id="mesChips" style="margin-bottom:14px">${meses.map(k=>`<button class="chip" data-mes="${k}" aria-pressed="${k===M}">${mesLbl(k)}${S.meses[k]?.cerrado?' ✓':''}</button>`).join('')}</div>
  <h2 class="sec">${mesLbl(M)} ${D.cerrado?'<span class="pill p-mute">Cerrado</span>':isCur?'<span class="pill p-ok">En curso</span>':'<span class="pill p-warn">Abierto</span>'}</h2>
  <div class="seg" role="tablist"><button type="button" data-pv="ganado" aria-pressed="${S.pv!=='caja'}">Ganado</button><button type="button" data-pv="caja" aria-pressed="${S.pv==='caja'}">Caja</button></div>
  ${S.pv==='caja'?cajaHTML(M):`<div class="kpis">
    <div class="card kpi hl"><div class="lbl">Tu ganancia cobrada</div><div class="val">${money(D.T.fc)}</div><div class="sub">${D.T.ff?Math.round(D.T.fc/D.T.ff*100):0}% de ${money(D.T.ff)} esperados</div><div class="prog" style="margin-top:8px"><i style="width:${D.T.ff?Math.min(100,D.T.fc/D.T.ff*100):0}%"></i></div></div>
    <button type="button" class="card kpi kpi-btn${S.faltaVer?' on':''}" data-falta="1" aria-expanded="${!!S.faltaVer}" aria-controls="falta-l"><div class="lbl">Falta cobrar</div><div class="val" style="color:var(--bad)">${money(D.T.p)}</div><div class="sub">${plural(D.pend.length,'entrenado','entrenados')} · <u>${S.faltaVer?'ocultar':'ver quiénes'}</u> <span class="kpi-car" aria-hidden="true">▾</span></div></button>
    <div class="card kpi"><div class="lbl">Plantel del mes</div><div class="val">${D.T.n}</div><div class="sub">${GYMS.map(g=>D.G[g].n+' '+GYM_LBL[g]).join(' · ')}</div></div>
    ${isCur?`<div class="card kpi"><div class="lbl">Rutinas a revisar</div><div class="val" style="color:var(--warn)">${rut.length}</div><div class="sub">+30 días o a cambiar</div></div>`:''}
  </div>
  ${S.faltaVer?`<div class="card falta-l" id="falta-l">${head(`Faltan cobrar en ${mesLbl(M)} · ${money(D.T.p)}`,'deuda',urg.length)}
    ${pendInfo.length?`<ul class="alist">${pendInfo.map(x=>x.e?`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}<br><span class="hint">${esc(GYM_LBL[gymOf(x.e)]||'')}${x.e.telefono?'':' · sin teléfono'}</span></button><span class="meta"><span class="pill ${x.cls}">${esc(x.tag)}</span> <b>${money(x.r.monto)}</b></span><span class="fl-acc">${isCur&&isAct(x.e)?`<button type="button" class="btn sm pri" data-cobrar="${esc(x.e.id)}">Cobrar</button>`:''}${msgBtn(x.e,x.kind,'Avisar')}</span></li>`:`<li><span class="nm">${esc(titleCase(x.r.nombre))}<br><span class="hint">sin ficha</span></span><span class="meta"><b>${money(x.r.monto)}</b></span></li>`).join('')}</ul>
      <p class="hint pad" style="padding-top:6px">${isCur?'“Cobrar” abre el registro de pago de esa persona; al guardarlo sale de esta lista. Tocá el nombre para ver la ficha.':'Mes anterior: tocá el nombre para abrir la ficha y registrar el pago.'}</p>`:'<div class="empty">Todos pagaron este mes.</div>'}</div>`:''}

  <h2 class="sec">Reparto de ${mesLbl(M)}</h2>
  <div class="grid2 g-rep">
    <div class="card"><div class="tbl-wrap"><table class="t-stack">
      <thead><tr><th></th><th>Esperado</th><th>Cobrado</th><th>Falta</th></tr></thead>
      <tbody>
        ${GYMS.map(g=>g==='CROSSFORCE'?`<tr><td>Fran · CrossForce (${pct(pctFran(g))}) ${D.liq?`<button class="lnk-f" type="button" data-liq="${esc(D.liq._id)}"><span class="pill p-ok">liquidado ${fmtShort(D.liq.fecha)}</span></button>`:'<span class="pill p-gymc">a liquidar</span>'}</td><td>${money(D.G[g].ff)}</td><td>${D.liq?money(D.G[g].fc):'—'}</td><td>${D.liq?`<span class="${D.G[g].fc-D.G[g].ff<0?'neg':''}">${D.G[g].fc-D.G[g].ff<0?'−':'+'}${money(Math.abs(D.G[g].fc-D.G[g].ff))}</span>`:'<button class="lnk-f" type="button" data-liqnew="'+M+'">Cargar liquidación ›</button>'}</td></tr>`:`<tr><td>Fran · ${GYM_LBL[g]} (${pct(pctFran(g))})</td><td>${money(D.G[g].ff)}</td><td>${money(D.G[g].fc)}</td><td>${money(D.G[g].fp)}</td></tr>`).join('')}
        <tr class="total"><td>Total Fran</td><td>${money(D.T.ff)}</td><td>${money(D.T.fc)}</td><td>${money(D.T.fp)}</td></tr>
        ${['LEVEL','CROSSFORCE'].map(g=>{const x=D.G[g];return `<tr><td>Gimnasio ${GYM_LBL[g]} (${pct(1-pctFran(g))})</td><td>${money(x.f-x.ff)}</td><td>${money(x.c-x.fc)}</td><td>${money(x.p-x.fp)}</td></tr>`}).join('')}
      </tbody></table></div></div>
    <div class="card pad">
      <div class="kpi" style="padding:0"><div class="lbl">Facturación esperada por origen</div></div>
      <div class="split">${GYMS.map(g=>`<i style="width:${D.G[g].f/(D.T.f||1)*100}%;background:var(${GYM_VAR[g]})"></i>`).join('')}</div>
      <div class="legend">${GYMS.map(g=>`<span><i class="dot" style="background:var(${GYM_VAR[g]})"></i>${GYM_LBL[g]} <b>${money(D.G[g].f)}</b></span>`).join('')}</div>
      <div class="kpi" style="padding:14px 0 0"><div class="lbl">Cobrado por origen</div></div>
      <div class="split">${GYMS.map(g=>`<i style="width:${D.G[g].c/(D.T.f||1)*100}%;background:var(${GYM_VAR[g]})"></i>`).join('')}</div>
      <div class="legend">${GYMS.map(g=>`<span><i class="dot" style="background:var(${GYM_VAR[g]})"></i>${GYM_LBL[g]} <b>${money(D.G[g].c)}</b></span>`).join('')}</div>
    </div>
  </div>

  ${(()=>{const t=porForma(D.pagos),tot=t.ef+t.tr+t.nd;return `<h2 class="sec">Cobrado por forma de pago</h2>
  <div class="grid2"><div class="card"><div class="tbl-wrap"><table>
    <thead><tr><th></th><th>Cobrado</th><th>Tu parte</th></tr></thead>
    <tbody><tr><td><button class="lnk-f" data-formas="ef">Efectivo <span aria-hidden="true">›</span></button></td><td>${money(t.ef)}</td><td>${money(t.fef)}</td></tr>
      <tr><td><button class="lnk-f" data-formas="tr">Transferencia <span aria-hidden="true">›</span></button></td><td>${money(t.tr)}</td><td>${money(t.ftr)}</td></tr>
      ${t.nd?`<tr><td><button class="lnk-f" data-formas="nd">Sin forma cargada <span aria-hidden="true">›</span></button></td><td>${money(t.nd)}</td><td>${money(t.fnd)}</td></tr>`:''}
      <tr class="total"><td><button class="lnk-f" data-formas="all">Total <span aria-hidden="true">›</span></button></td><td>${money(tot)}</td><td>${money(t.fef+t.ftr+t.fnd)}</td></tr></tbody></table></div></div>
    <div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Efectivo vs transferencia</div></div>
      <div class="split"><i style="width:${t.ef/(tot||1)*100}%;background:var(--ok)" data-formas="ef" title="Ver pagos en efectivo"></i><i style="width:${t.tr/(tot||1)*100}%;background:var(--accent)" data-formas="tr" title="Ver pagos por transferencia"></i>${t.nd?`<i style="width:${t.nd/(tot||1)*100}%;background:var(--line)"></i>`:''}</div>
      <div class="legend"><button class="lnk-f" data-formas="ef"><i class="dot" style="background:var(--ok)"></i>Efectivo <b>${money(t.ef)}</b></button><button class="lnk-f" data-formas="tr"><i class="dot" style="background:var(--accent)"></i>Transferencia <b>${money(t.tr)}</b></button>${t.nd?`<button class="lnk-f" data-formas="nd"><i class="dot" style="background:var(--line)"></i>Sin dato <b>${money(t.nd)}</b></button>`:''}</div>
      <p class="hint" style="margin-top:8px">Tocá una forma de pago para ver quién pagó así. En los pagos mixtos se suma a cada columna la parte que corresponde. “Tu parte” aplica el % de cada gimnasio.</p></div></div>`})()}
`}
${!isCur?`  <h2 class="sec">${isCur?'Para hacer hoy':'Cuotas de '+mesLbl(M)}</h2>
  <div class="grid2">
    ${isCur?`<div class="card">${head(`Vencen hoy · ${fmtShort(iso(today()))}`,'hoy',hoyV.length)}
      ${hoyV.length?`<ul class="alist">${hoyV.map(e=>li(e,`${money(monto(e))}`,'pago')).join('')}</ul>${hoyV.length===1?'':''}`:'<div class="empty">Hoy no vence ninguna cuota.</div>'}</div>`:''}
    ${isCur&&aus.length?`<div class="card">${head(`Sin entrenar hace ${S.cfg.alertas.dias} días o más`,'ausentes',aus.length)}
      <ul class="alist">${aus.map(x=>li(x.e,`últ. ${fmtShort(x.ult)} · ${x.d} d`,'ausencia')).join('')}</ul><p class="hint pad" style="padding-top:6px">Solo entrenados que marcan asistencia en su link.</p></div>`:''}
    ${isCur&&cargaAlta.length?`<div class="card falta-card"><div class="pad" style="padding-bottom:6px"><b>Carga en aumento</b> <span class="pill p-bad">${cargaAlta.length}</span><p class="hint">La carga de los últimos 7 días es más de ${S.cfg.alertas.acwr} veces su promedio de las 4 semanas anteriores.</p></div>
      <ul class="alist">${cargaAlta.map(x=>`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}</button><span class="meta"><span class="pill p-bad">${x.a.ratio.toFixed(2)}</span> ${x.a.agudo} UA esta semana</span></li>`).join('')}</ul></div>`:''}
    ${isCur?(()=>{const wd=((today().getDay()+6)%7)+1;const L=act.flatMap(e=>(e.horarios||[]).filter(h=>Number(h.dia)===wd).map(h=>({e,h}))).sort((x,y)=>x.h.hora.localeCompare(y.h.hora));
      return L.length?`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Hoy entrenan</b> <span class="pill p-ok">${L.length}</span><p class="hint">Según los horarios cargados en cada ficha.</p></div><ul class="alist">${L.map(({e,h})=>`<li><span class="hor-h">${esc(h.hora)}</span><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${gymTag(e)}${ultAsis(e.id)===iso(today())?' <span class="pill p-ok">✓ Ya marcó</span>':''}</span></li>`).join('')}</ul></div>`:''})():''}
    ${isCur&&bienHoy.length?`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Wellness de hoy: moderado o bajo</b> <span class="pill p-warn">${bienHoy.length}</span><p class="hint">Comparado con su propio promedio de las últimas 4 semanas. Si la rutina tiene el ajuste activado, ya entrenan con la carga reducida.</p></div>
      <ul class="alist">${bienHoy.map(x=>`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}<br><span class="hint">${bienTxt(x.b.datos)}</span></button><span class="pill ${EST[x.st.k][1]}">${EST[x.st.k][0]}${activaDe(x.e.id)?.ajusteWellness?' · '+EST[x.st.k][2]+'%':''}</span></li>`).join('')}</ul></div>`:''}
    <div class="card">${head(isCur?`Cobros de ${mesLbl(M)} · ${D.pagos.length} pagaron`:`Sin pagar en ${mesLbl(M)}`,'deuda',urg.length)}
      ${pendInfo.length?`<ul class="alist">${pendInfo.map(x=>x.e?`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}</button><span class="meta"><span class="pill ${x.cls}">${esc(x.tag)}</span> ${money(x.r.monto)}</span>${msgBtn(x.e,x.kind,'Avisar')}</li>`:`<li><span class="nm">${esc(titleCase(x.r.nombre))}</span><span class="meta">${money(x.r.monto)}</span></li>`).join('')}</ul>`:'<div class="empty">Todos pagaron este mes.</div>'}
    </div>
    ${isCur?`<div class="card">${head('Vencen en los próximos 7 días','prox',prox.length)}
      ${prox.length?`<ul class="alist">${prox.map(e=>li(e,`${fmtShort(e.proxVenc)} · ${diasVenc(e)===0?'hoy':diasVenc(e)+' d'}`,'pago')).join('')}</ul>`:'<div class="empty">No hay vencimientos esta semana.</div>'}
    </div>
    ${entregasCard()}
    ${sinTerminarCard(true)}
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Rutinas a revisar</b></div>
      ${rut.length?`<ul class="alist">${rut.map(e=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${diasRutina(e)!==null&&diasRutina(e)>30?diasRutina(e)+' días':esc(e.modalidad)}</span></li>`).join('')}</ul>`:'<div class="empty">Todas las rutinas están al día.</div>'}
    </div>
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Agenda de vencimientos · 30 días</b></div>
      ${agK.length?`<ul class="alist">${agK.map(k=>`<li><span class="nm" style="flex:0 0 64px;font-weight:600">${fmtShort(k)}</span><span class="meta" style="flex:1;white-space:normal">${ag[k].length} · ${ag[k].slice(0,4).map(e=>esc(firstName(e))).join(', ')}${ag[k].length>4?'…':''}</span><span class="meta">${money(ag[k].reduce((a,e)=>a+monto(e),0))}</span></li>`).join('')}</ul>`:'<div class="empty">Sin vencimientos próximos.</div>'}
    </div>`:`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Pagos registrados · ${D.pagos.length}</b></div>
      ${D.pagos.length?`<ul class="alist">${D.pagos.slice().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')).map(p=>`<li><span class="nm">${esc(titleCase(p.nombre||S.ents[p.entrenadoId]?.nombre||p.entrenadoId))}</span><span class="meta">${fmtShort(p.fecha)} · ${money(p.monto)}${p.forma?' · '+esc(formaTxt(p)):''}</span></li>`).join('')}</ul>`:'<div class="empty">Sin pagos registrados.</div>'}
    </div>`}
  </div>

`:''}  <h2 class="sec">Resumen por mes</h2>
  <div class="card"><div class="tbl-wrap"><table>
    <thead><tr><th>Mes</th><th>Plantel</th><th>Esperado</th><th>Cobrado</th><th>Falta</th><th>Fran cobrado</th>${GYMS.map(g=>`<th>${GYM_LBL[g]}</th>`).join('')}</tr></thead>
    <tbody>${hist.slice().reverse().map(h=>`<tr${h.M===M?' class="total"':''}><td><button class="nm" style="font-weight:600;border:0;background:none;padding:0;color:var(--accent)" data-mes="${h.M}">${mesLbl(h.M)}</button></td><td>${h.T.n}</td><td>${money(h.T.f)}</td><td>${money(h.T.c)}</td><td>${money(h.T.p)}</td><td><b>${money(h.T.fc)}</b></td>${GYMS.map(g=>`<td>${money(h.G[g].c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <div class="pad" style="border-top:1px solid var(--line)"><b style="font-size:14px">Tu ganancia por mes</b>
    ${hist.map(h=>`<div class="bar-row"><span>${mesCorto(h.M)}</span><span class="bar" style="height:14px;position:relative"><i style="width:${h.T.ff/maxF*100}%;background:var(--accent-soft);position:absolute;left:0;top:0"></i><i style="width:${h.T.fc/maxF*100}%;position:absolute;left:0;top:0"></i></span><span style="text-align:right">${money(h.T.fc)}</span></div>`).join('')}
    <div class="legend" style="margin-top:6px"><span><i class="dot" style="background:var(--accent)"></i>Cobrado</span><span><i class="dot" style="background:var(--accent-soft)"></i>Esperado</span></div>
  </div></div>

  ${isCur?`<h2 class="sec">Suspendidos y bajas</h2>
  <div class="grid2">
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Suspendidos</b> <span class="pill p-warn">${susp.length}</span><p class="hint">Pueden volver. No cuentan en la facturación.</p></div>
      ${susp.length?`<ul class="alist">${susp.map(e=>li(e,`${gymTag(e)} ${e.fechaEstado?'desde '+fmtShort(e.fechaEstado):''}`,'vuelta')).join('')}</ul>`:'<div class="empty">No hay suspendidos.</div>'}
    </div>
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Bajas</b> <span class="pill p-bad">${bajas.length}</span><p class="hint">No vuelven a entrenar. Quedan guardados con su historial.</p></div>
      ${bajas.length?`<ul class="alist">${bajas.map(e=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${gymTag(e)} ${e.fechaEstado?fmtShort(e.fechaEstado):''}</span></li>`).join('')}</ul>`:'<div class="empty">No hay bajas.</div>'}
    </div>
  </div>
  <h2 class="sec">Composición</h2>
  <div class="grid2">
    <div class="card pad"><b>Por plan</b>${Object.entries(plans).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><span class="bar"><i style="width:${v/maxP*100}%"></i></span><span style="text-align:right">${v}</span></div>`).join('')}</div>
    <div class="card pad"><b>Por estímulos semanales</b>${Object.entries(est).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`<div class="bar-row"><span>${k} por semana</span><span class="bar"><i style="width:${v/maxE*100}%"></i></span><span style="text-align:right">${v}</span></div>`).join('')}</div>
  </div>`:''}`;
  el.innerHTML=`
  ${prevOpen?`<div class="banner" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>${mesLbl(prev)} terminó y todavía está abierto. Al cerrarlo se guarda quiénes estaban activos y cuánto pagaba cada uno.</span><button class="btn" data-cerrar="${prev}">Cerrar ${mesLbl(prev)}</button></div>`:''}
  <div class="seg ptabs" role="tablist" aria-label="Secciones del panel"><button type="button" role="tab" data-ptab="hoy" aria-pressed="${!tabFin}" aria-selected="${!tabFin}">Hoy</button><button type="button" role="tab" data-ptab="fin" aria-pressed="${tabFin}" aria-selected="${tabFin}">Finanzas</button></div>
  ${tabFin?finHTML():hoyHTML()}`;
  const g=el.querySelector('.hoy-grid');
  if(g){const ok=[];g.querySelectorAll(':scope>.card').forEach(c=>{const em=c.querySelector(':scope>.empty');if(em&&!c.querySelector('.alist')){ok.push(em.textContent.trim());c.remove()}});
    if(ok.length)g.insertAdjacentHTML('afterend',`<div class="card ok-lines" aria-label="Sin pendientes">${ok.map(t=>`<div><span class="ok-ic" aria-hidden="true">✓</span>${esc(t)}</div>`).join('')}</div>`)}
  listasBuscables(el);
}
async function cerrarMes(M){
  const d=monthData(M);
  if(await write(()=>S.db.doc('meses/'+M).set({mes:M,cerrado:true,fechaCierre:iso(today()),plantel:d.roster})))toast(mesLbl(M)+' cerrado');
}




/* ----- listas del panel: máximo 5 visibles, scroll y buscador ----- */
function listasBuscables(root){
  S.fq=S.fq||{};
  root.querySelectorAll('.grid2 > .card > ul.alist').forEach(ul=>{
    const lis=[...ul.children].filter(x=>x.tagName==='LI');if(lis.length<=5)return;
    const card=ul.parentElement,t=(card.querySelector('b')?.textContent||'').replace(/[\d·:]+/g,'').trim().slice(0,40);
    const h=lis.slice(0,5).reduce((a,li)=>a+li.offsetHeight,0);
    ul.classList.add('al-scroll');if(h>0)ul.style.maxHeight=(h+2)+'px';
    const box=document.createElement('div');box.className='al-q';
    box.innerHTML=`<input type="search" placeholder="Buscar entrenado (${lis.length})" aria-label="Buscar en ${esc(t)}" value="${esc(S.fq[t]||'')}"><span class="al-n"></span>`;
    ul.before(box);const inp=box.firstChild,n=box.lastChild;
    const empty=document.createElement('div');empty.className='empty al-vacio';empty.textContent='Ningún entrenado coincide.';empty.hidden=true;ul.after(empty);
    const apply=()=>{const q=normN(inp.value);S.fq[t]=inp.value;let k=0;lis.forEach(li=>{const ok=!q||normN(li.textContent).includes(q);li.hidden=!ok;if(ok)k++});n.textContent=q?`${k} de ${lis.length}`:'';empty.hidden=k>0;ul.hidden=!k};
    inp.addEventListener('input',apply);if(inp.value)apply();
  });
}
/* ----- liquidaciones de CrossForce, rendiciones a LEVEL y caja ----- */
const normN=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let pr=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(pr[j]+1,c[j-1]+1,pr[j-1]+(a[i-1]===b[j-1]?0:1));pr=c}return pr[n]}
function parseMonto(v){if(typeof v==='number')return v;let t=String(v||'').replace(/[^\d.,-]/g,'');if(!t)return 0;
  const lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
  if(lc>-1&&ld>-1){const dec=lc>ld?',':'.';t=t.split(dec==='.'?',':'.').join('');if(dec===',')t=t.replace(',','.')}
  else if(lc>-1){t=/,\d{3}$/.test(t)?t.replace(/,/g,''):t.replace(',','.')}
  else if(ld>-1&&/^-?\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
  return Number(t)||0}
function parseFechaCel(v){if(v instanceof Date&&!isNaN(v))return iso(v);if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Date.UTC(1899,11,30)+v*864e5);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
  const m=String(v||'').match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);if(!m)return '';let y=m[3]?Number(m[3]):today().getFullYear();if(y<100)y+=2000;return y+'-'+pad(Number(m[2]))+'-'+pad(Number(m[1]))}
function liqFilas(aoa){
  const out=[];let fecha='';
  for(const r of aoa){if(!r)continue;const cells=r.map(c=>c==null?'':c);
    const nom=cells.find(c=>typeof c==='string'&&/[a-záéíóúñ]{2,}/i.test(c)&&!/\d/.test(c)&&!/^(fecha|personalizado|nombre|total|veces|fran|monto)/i.test(c.trim()));
    if(!nom){const f0=cells.slice(0,1).map(parseFechaCel)[0];if(f0)fecha=f0;continue}
    const idx=cells.indexOf(nom),rest=cells.slice(idx+1);
    const f=cells.slice(0,idx).map(parseFechaCel).find(Boolean);if(f)fecha=f;
    const veces=rest.find(c=>(typeof c==='number'&&c>=1&&c<=7&&Number.isInteger(c))||(/^\s*[1-7]\s*$/.test(String(c))));
    const mon=rest.map(parseMonto).find(x=>x>=1000)||0;
    out.push({fecha,nombre:String(nom).trim(),veces:veces==null?'':Number(veces),monto:mon,eid:''});
  }
  return out}
function liqMatch(filas){
  const cands=Object.values(S.ents).filter(e=>gymOf(e)==='CROSSFORCE').map(e=>({e,n:normN(e.nombre),t:normN(e.nombre).split(' ')}));
  const used=new Set();
  filas.forEach(f=>{const n=normN(f.nombre),t=n.split(' ');let best=null,how='';
    const ex=cands.find(c=>c.n===n);if(ex){best=ex;how='ok'}
    if(!best){const near=cands.map(c=>({c,d:lev(c.n,n)})).sort((a,b)=>a.d-b.d)[0];if(near&&near.d<=2){best=near.c;how='ok'}}
    if(!best&&t.length>1){const ap=t[t.length-1];const L=cands.filter(c=>c.t.includes(ap)||c.t.some(x=>x.length>3&&lev(x,ap)<=1));
      const L2=L.filter(c=>c.t[0].startsWith(t[0].slice(0,3))||t[0].startsWith(c.t[0].slice(0,3)));
      const pick=L2.length===1?L2[0]:L.length===1?L[0]:null;if(pick){best=pick;how='ap'}}
    if(best&&!used.has(best.e.id)){f.eid=best.e.id;f.how=how;used.add(best.e.id)}else{f.eid='';f.how=''}});
  return filas}
const liqsDe=g=>S.liqs.filter(l=>(l.gym||'CROSSFORCE')===g).sort((a,b)=>(b.mes||'').localeCompare(a.mes||''));
const liqMes=M=>liqsDe('CROSSFORCE').find(l=>l.mes===M)||null;
function liqDeEnt(eid){const L=liqsDe('CROSSFORCE');if(!L.length)return null;const ult=L[0];for(const l of L){const f=(l.filas||[]).find(x=>x.eid===eid);if(f)return {l,f,ultima:l===ult,ult}}return {l:null,f:null,ult}}
function esperadoFila(f){const e=f.eid&&S.ents[f.eid];const pc=pctFran('CROSSFORCE');if(e)return Math.round(monto(e)*pc);const b=Number(S.cfg.gyms.CROSSFORCE.tarifas[String(f.veces)])||0;return Math.round(b*pc)}
async function leerXLSX(buf,hojaRe,opt={}){
  const u8=new Uint8Array(buf),dv=new DataView(buf);let eo=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-70000);i--)if(dv.getUint32(i,true)===0x06054b50){eo=i;break}
  if(eo<0)throw new Error('El archivo no parece un Excel (.xlsx).');
  const n=dv.getUint16(eo+10,true);let p=dv.getUint32(eo+16,true);const files={};const td=new TextDecoder();
  for(let k=0;k<n;k++){if(dv.getUint32(p,true)!==0x02014b50)break;const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    files[td.decode(u8.subarray(p+46,p+46+nl))]={meth,cs,lo};p+=46+nl+xl+cl}
  const get=async name=>{const f=files[name];if(!f)return null;const ln=dv.getUint16(f.lo+26,true),le=dv.getUint16(f.lo+28,true),st=f.lo+30+ln+le,raw=u8.slice(st,st+f.cs);
    if(f.meth===0)return td.decode(raw);const ds=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return await new Response(ds).text()};
  const X=t=>new DOMParser().parseFromString(t,'application/xml');
  const ss=[];const sst=await get('xl/sharedStrings.xml');if(sst)X(sst).querySelectorAll('si').forEach(si=>ss.push([...si.getElementsByTagName('t')].map(t=>t.textContent).join('')));
  let hoja=null;
  if(hojaRe){const wbx=await get('xl/workbook.xml'),rl=await get('xl/_rels/workbook.xml.rels');if(wbx&&rl){const sh=[...X(wbx).getElementsByTagName('sheet')],rels=[...X(rl).getElementsByTagName('Relationship')];
    const m=sh.find(s=>hojaRe.test((s.getAttribute('name')||'').trim()));if(m){const rid=m.getAttribute('r:id')||m.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const r=rels.find(x=>x.getAttribute('Id')===rid);
      if(r){const tg=r.getAttribute('Target').replace(/^\/?(xl\/)?/,'');hoja='xl/'+tg}}}}
  if(!hoja&&hojaRe&&opt.estricta)return null;
  if(!hoja)hoja=files['xl/worksheets/sheet1.xml']?'xl/worksheets/sheet1.xml':Object.keys(files).filter(k=>/^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  if(!hoja)throw new Error('No encontré hojas en el Excel.');
  const doc=X(await get(hoja)),aoa=[];
  doc.querySelectorAll('sheetData > row').forEach(r=>{const ri=Number(r.getAttribute('r'))-1;const row=[];r.querySelectorAll('c').forEach(c=>{const ref=c.getAttribute('r')||'';let ci=0;for(const ch of ref.replace(/\d/g,''))ci=ci*26+ch.charCodeAt(0)-64;ci--;
    const t=c.getAttribute('t'),v=c.querySelector('v')?.textContent;let val=null;
    if(t==='s')val=ss[Number(v)]??'';else if(t==='inlineStr')val=[...c.getElementsByTagName('t')].map(x=>x.textContent).join('');else if(t==='str'||t==='e')val=v??'';else if(t==='b')val=v==='1';else if(v!=null&&v!=='')val=Number(v);
    row[ci]=val});aoa[ri]=row});
  /* celdas combinadas: con hoja elegida por nombre, se copia el valor a todo el rango (ej. «PRETEMPORADA» en 6 semanas) */
  if(hojaRe&&!opt.sinComb){const col=t=>{let c=0;for(const ch of t)c=c*26+ch.charCodeAt(0)-64;return c-1};
    doc.querySelectorAll('mergeCells > mergeCell').forEach(m=>{const mm=/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(m.getAttribute('ref')||'');if(!mm)return;
      const c0=col(mm[1]),r0=+mm[2]-1,c1=col(mm[3]),r1=+mm[4]-1,v=aoa[r0]&&aoa[r0][c0];if(v==null||v==='')return;
      for(let r=r0;r<=r1;r++){aoa[r]=aoa[r]||[];for(let c=c0;c<=c1;c++)if(aoa[r][c]==null||aoa[r][c]==='')aoa[r][c]=v}})}
  return aoa}
function liqNueva(){const prev=mesShift(curMes(),-1);return {id:null,mes:liqMes(prev)?curMes():prev,fecha:iso(today()),monto:'',forma:'efectivo',filas:[],archivo:'',msg:''}}
function liqHTML(){
  const L=S.lq,pc=pctFran('CROSSFORCE');
  const cf=Object.values(S.ents).filter(e=>gymOf(e)==='CROSSFORCE').sort((a,b)=>name(a).localeCompare(name(b),'es'));
  const tot=L.filas.reduce((a,f)=>a+(Number(f.monto)||0),0),esp=L.filas.reduce((a,f)=>a+esperadoFila(f),0),rec=Number(L.monto)||tot,dif=rec-esp;
  const asig=new Set(L.filas.map(f=>f.eid).filter(Boolean));
  const [y,m]=L.mes.split('-').map(Number),finMes=iso(new Date(y,m,0));
  const faltan=cf.filter(e=>!asig.has(e.id)&&isAct(e)&&(!e.inicio||e.inicio<=finMes));
  const nuevos=cf.filter(e=>!asig.has(e.id)&&isAct(e)&&e.inicio&&e.inicio>finMes);
  const meses=[...new Set([mesShift(curMes(),-2),mesShift(curMes(),-1),curMes(),L.mes])].sort();
  return `<div class="form card pad liq-f">
    <label>Mes que liquida<select id="lq-mes">${meses.map(k=>`<option value="${k}" ${k===L.mes?'selected':''}>${mesLbl(k)}</option>`).join('')}</select></label>
    <label>Fecha en que te pagaron<input id="lq-fecha" type="date" value="${esc(L.fecha)}"></label>
    <label>Monto recibido<input id="lq-monto" type="number" min="0" step="any" value="${esc(L.monto)}" placeholder="${tot?Math.round(tot):''}"></label>
    <label>Forma<select id="lq-forma">${[['efectivo','Efectivo'],['transferencia','Transferencia']].map(([k,l])=>`<option value="${k}" ${k===L.forma?'selected':''}>${l}</option>`).join('')}</select></label>
    <div class="full liq-drop"><label class="btn" style="cursor:pointer">Subir Excel del gym<input id="lq-file" type="file" accept=".xlsx,.csv" hidden></label><span class="hint" style="margin:0">${L.archivo?`<b>${esc(L.archivo)}</b> · ${L.filas.length} filas`:'o copiá las filas en el Excel y pegalas acá abajo'}</span></div>
    ${L.filas.length?'':`<textarea id="lq-paste" class="full" rows="4" placeholder="Pegá acá las filas copiadas del Excel (fecha, nombre, veces, monto)"></textarea><div class="full actions"><button class="btn" type="button" data-lq="paste">Leer filas pegadas</button></div>`}
    ${L.msg?`<p class="full imp-err">${esc(L.msg)}</p>`:''}
  </div>
  ${L.filas.length?`<div class="liq-res"><div><span>Te rindieron</span><b>${money(rec)}</b><i>${plural(L.filas.length,'entrenado','entrenados')}${L.monto&&Math.abs(rec-tot)>1?' · el Excel suma '+money(tot):''}</i></div><div><span>Esperado (${pct(pc)} de la tarifa)</span><b>${money(esp)}</b><i>con las promos de cada ficha</i></div><div><span>Diferencia</span><b class="${dif<0?'neg':''}">${dif<0?'−':dif>0?'+':''}${money(Math.abs(dif))}</b><i>${dif?'revisá las filas marcadas':'coincide'}</i></div></div>
  <div class="card"><div class="tbl-wrap"><table class="liq-t"><thead><tr><th>Pagó</th><th>En el Excel</th><th>Es…</th><th>Te rinden</th><th>Esperado</th><th>Dif.</th></tr></thead><tbody>
    ${L.filas.map((f,i)=>{const e2=esperadoFila(f),d=(Number(f.monto)||0)-e2;return `<tr class="${f.eid?'':'liq-sin'}"><td>${f.fecha?fmtShort(f.fecha):'—'}</td><td>${esc(f.nombre)}${f.veces?`<br><span class="hint" style="display:inline">${f.veces}× por semana</span>`:''}</td>
      <td><select data-lqe="${i}"><option value="">— No está en tu lista —</option>${cf.map(e=>`<option value="${esc(e.id)}" ${e.id===f.eid?'selected':''}>${esc(name(e))} · ${esc(e.id)}</option>`).join('')}</select>${f.how==='ap'?'<br><span class="pill p-warn">Por apellido: confirmá</span>':''}</td>
      <td>${money(f.monto)}</td><td class="hint">${money(e2)}</td><td>${d?`<span class="${d<0?'neg':''}">${d<0?'−':'+'}${money(Math.abs(d))}</span>`:'<span class="hint">ok</span>'}</td></tr>`}).join('')}
  </tbody></table></div></div>
  ${faltan.length||nuevos.length?`<div class="card pad" style="margin-top:12px"><b>Tus CrossForce que no figuran en ${mesLbl(L.mes)}</b>
    ${faltan.length?`<ul class="alist">${faltan.map(e=>`<li><span class="nm">${esc(name(e))} · ${esc(e.id)}</span><span class="pill p-bad">No figura</span></li>`).join('')}</ul>`:''}
    ${nuevos.length?`<p class="hint">Empezaron después de ${mesLbl(L.mes)}: ${nuevos.map(e=>esc(name(e))).join(', ')}.</p>`:''}</div>`:''}`:''}
  <div class="actions" style="margin-top:14px">${L.filas.length?`<button class="btn pri" type="button" data-lq="save">Guardar liquidación</button>`:''}${L.id?`<button class="btn" type="button" data-lq="del">${L.armed?'Confirmar borrado':'Borrar'}</button>`:''}<button class="btn" type="button" data-close>Cancelar</button></div>`;
}
function liqLeerForm(){const L=S.lq;if(!L)return;const v=id=>$(id)?.value;if($('#lq-mes'))L.mes=v('#lq-mes');if($('#lq-fecha'))L.fecha=v('#lq-fecha');if($('#lq-monto'))L.monto=v('#lq-monto');if($('#lq-forma'))L.forma=v('#lq-forma')}
async function liqGuardar(){const L=S.lq;liqLeerForm();if(!L.fecha){L.msg='Falta la fecha en que te pagaron.';renderSheet();return}
  const tot=L.filas.reduce((a,f)=>a+(Number(f.monto)||0),0);
  const doc={gym:'CROSSFORCE',mes:L.mes,fecha:L.fecha,monto:Number(L.monto)||tot,forma:L.forma,filas:L.filas.map(f=>({fecha:f.fecha,nombre:f.nombre,veces:f.veces,monto:Number(f.monto)||0,eid:f.eid||''})),esperado:L.filas.reduce((a,f)=>a+esperadoFila(f),0),archivo:L.archivo||'',ts:Date.now()};
  const otra=liqMes(L.mes);if(otra&&otra._id!==L.id){L.msg=`Ya hay una liquidación de ${mesLbl(L.mes)}. Abrila desde el panel para corregirla.`;renderSheet();return}
  const ok=L.id?await write(()=>S.db.collection('liquidaciones').doc(L.id).set(doc)):await write(()=>S.db.collection('liquidaciones').add(doc));
  if(ok){toast('Liquidación de '+mesLbl(L.mes)+' guardada');closeSheet()}}
function rendHTML(M){const R=S.rend;const c=cajaDe(M);
  const L=S.rends.filter(r=>r.mes===M).sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));
  return `<div class="liq-res"><div><span>${pct(1-pctFran('LEVEL'))} de lo cobrado en LEVEL</span><b>${money(c.aRendir)}</b></div><div><span>Rendido</span><b>${money(c.rendido)}</b></div><div><span>Por rendir</span><b class="${c.porRendir>0?'neg':''}">${money(c.porRendir)}</b></div></div>
  ${L.length?`<div class="card"><ul class="alist">${L.map(r=>`<li><span class="nm">${fmtD(r.fecha)} · ${money(r.monto)} <span class="hint" style="display:inline">${r.forma==='transferencia'?'Transferencia':'Efectivo'}</span></span><button class="x-sm" type="button" data-rdel="${esc(r._id)}">${R.armed===r._id?'Confirmar':'Borrar'}</button></li>`).join('')}</ul></div>`:''}
  <div class="form card pad" style="margin-top:12px"><div class="full"><b>Registrar rendición</b></div>
    <label>Fecha<input id="rd-fecha" type="date" value="${esc(iso(today()))}"></label>
    <label>Monto<input id="rd-monto" type="number" min="0" step="any" value="${c.porRendir>0?Math.round(c.porRendir):''}"></label>
    <label>Forma<select id="rd-forma"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label>
    <label>Mes<input value="${mesLbl(M)}" readonly></label>
    <div class="full actions"><button class="btn pri" type="button" data-rsave="${M}">Guardar rendición</button><button class="btn" type="button" data-close>Cerrar</button></div></div>`}
function cajaDe(M){
  const enM=f=>(f||'').slice(0,7)===M;
  const pm=S.pagos.filter(p=>enM(p.fecha));
  const lev=pm.filter(p=>p.gym==='LEVEL'),onl=pm.filter(p=>p.gym==='ONLINE'),otros=pm.filter(p=>p.gym==='CROSSFORCE');
  const sum=(a,f)=>a.reduce((x,p)=>x+f(p),0);
  const L=sum(lev,p=>Number(p.monto)||0),Lf=sum(lev,p=>(Number(p.monto)||0)*(p.pctFran??pctFran('LEVEL'))),O=sum(onl,p=>Number(p.monto)||0),X=sum(otros,p=>Number(p.monto)||0),Xf=sum(otros,p=>(Number(p.monto)||0)*(p.pctFran??1));
  const liqs=S.liqs.filter(l=>enM(l.fecha)),Q=sum(liqs,l=>Number(l.monto)||0);
  const aRendir=L-Lf,rends=S.rends.filter(r=>r.mes===M),rendido=sum(rends,r=>Number(r.monto)||0);
  const efe=sum(pm,p=>partes(p).ef)+sum(liqs.filter(l=>l.forma!=='transferencia'),l=>Number(l.monto)||0)-sum(rends.filter(r=>r.forma!=='transferencia'),r=>Number(r.monto)||0);
  const tra=sum(pm,p=>partes(p).tr+partes(p).nd)+sum(liqs.filter(l=>l.forma==='transferencia'),l=>Number(l.monto)||0)-sum(rends.filter(r=>r.forma==='transferencia'),r=>Number(r.monto)||0);
  return {L,Lf,O,X,Xf,Q,liqs,aRendir,rendido,porRendir:Math.max(0,aRendir-rendido),entro:L+O+X+Q,disp:Lf+O+Xf+Q,saldo:L+O+X+Q-rendido,efe,tra};
}
function cajaHTML(M){const c=cajaDe(M);
  return `<div class="kpis">
    <div class="card kpi hl"><div class="lbl">Disponible real</div><div class="val">${money(c.disp)}</div><div class="sub">lo tuyo de lo que entró en ${mesLbl(M).split(' ')[0].toLowerCase()}</div></div>
    <div class="card kpi"><div class="lbl">Entró a tu cuenta</div><div class="val">${money(c.entro)}</div><div class="sub">efectivo + transferencias</div></div>
    <div class="card kpi"><div class="lbl">Por rendir a LEVEL</div><div class="val" style="color:${c.porRendir>0?'var(--bad)':'inherit'}">${money(c.porRendir)}</div><div class="sub">de ${money(c.aRendir)} · rendiste ${money(c.rendido)}</div></div>
  </div>
  <div class="grid2">
    <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Movimientos de ${mesLbl(M)}</th><th>Entró</th><th>Es tuyo</th></tr></thead><tbody>
      <tr><td>Cobros LEVEL</td><td>${money(c.L)}</td><td>${money(c.Lf)}</td></tr>
      <tr><td>Cobros Online</td><td>${money(c.O)}</td><td>${money(c.O)}</td></tr>
      ${c.X?`<tr><td>Cobros CrossForce (pagos sueltos)</td><td>${money(c.X)}</td><td>${money(c.Xf)}</td></tr>`:''}
      ${c.liqs.length?c.liqs.map(l=>`<tr><td><button class="lnk-f" type="button" data-liq="${esc(l._id)}">Liquidación CrossForce (${mesLbl(l.mes).split(' ')[0].toLowerCase()}) · ${fmtShort(l.fecha)} ›</button></td><td>${money(l.monto)}</td><td>${money(l.monto)}</td></tr>`).join(''):`<tr><td class="hint">Sin liquidación de CrossForce cobrada este mes</td><td></td><td></td></tr>`}
      ${S.rends.filter(r=>r.mes===M).map(r=>`<tr><td>Rendición a LEVEL · ${fmtShort(r.fecha)}</td><td class="neg">−${money(r.monto)}</td><td class="hint">ya descontado</td></tr>`).join('')}
      <tr class="total"><td>Saldo en mano</td><td>${money(c.saldo)}</td><td>${money(c.disp)}</td></tr></tbody></table></div>
      <p class="hint pad" style="padding-top:4px">${c.porRendir>0?`“Saldo en mano” incluye ${money(c.porRendir)} que todavía tenés que rendirle a LEVEL. `:''}En efectivo ${money(c.efe)} · por transferencia ${money(c.tra)}.</p></div>
    <div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">LEVEL · rendición de ${mesLbl(M)}</div></div>
      <div class="split"><i style="width:${c.aRendir?Math.min(100,c.rendido/c.aRendir*100):0}%;background:var(--ok-fill,var(--ok))"></i><i style="width:${c.aRendir?100-Math.min(100,c.rendido/c.aRendir*100):0}%;background:var(--bad);opacity:.35"></i></div>
      <div class="legend"><span>Rendido <b>${money(c.rendido)}</b></span><span>Por rendir <b>${money(c.porRendir)}</b></span></div>
      <div class="actions" style="margin-top:12px"><button class="btn pri" type="button" data-rend="${M}">+ Registrar rendición</button><button class="btn" type="button" data-liqnew="1">+ Liquidación CrossForce</button></div>
      <p class="hint" style="margin-top:8px">El ${pct(1-pctFran('LEVEL'))} de LEVEL se calcula sobre lo que cobraste en el mes. Las liquidaciones de CrossForce cuentan en el mes en que te pagan.</p></div>
  </div>`}
/* ----- estado de rutina y de pago para el listado ----- */
function ultPagoReg(e){let m='';for(const p of S.pagos)if(p.entrenadoId===e.id&&(p.fecha||'')>m)m=p.fecha;return m}
function pagoInfo(e){
  if(sinCuota(e))return {k:'sin',txt:'Sin cuota',cls:'p-mute',sub:e.cuotaMotivo||'no paga'};
  const v=parse(e.proxVenc),dv=diasVenc(e);
  if(gymOf(e)==='CROSSFORCE'){const x=liqDeEnt(e.id);const mesC=k=>mesLbl(k).split(' ')[0].toLowerCase();
    if(x&&x.f&&x.ultima)return {k:'gym',txt:'Pagó al gym',cls:'p-gymc',sub:`${x.f.fecha?fmtShort(x.f.fecha):''} · liquidado ${mesC(x.l.mes)}`};
    if(x&&x.ult){const [yy,mm]=x.ult.mes.split('-').map(Number),fin=iso(new Date(yy,mm,0));if(!(e.inicio&&e.inicio>fin))return {k:'gym',txt:'Cobra el gym',cls:'p-gymc',sub:`no figuró en ${mesC(x.ult.mes)}`+(x.f?` · últ. ${mesC(x.l.mes)}`:'')}}
    return {k:'gym',txt:'Cobra el gym',cls:'p-gymc',sub:v?'vence '+fmtShort(e.proxVenc):''}}
  const u=ultPagoReg(e);
  let desde='';if(v){const x=new Date(v);x.setMonth(x.getMonth()-1);x.setDate(x.getDate()-10);desde=iso(x)}
  if(u&&v&&v>=today()&&u>=desde&&e.pagoRegistrado!=='Debe')return {k:'ok',txt:'Al día',cls:'p-ok',sub:`pagó ${fmtShort(u)} · vence ${fmtShort(e.proxVenc)}`};
  if(!v||v<today())return {k:'vencido',txt:'Vencido',cls:'p-bad',sub:v?`hace ${-dv} d · ${fmtShort(e.proxVenc)}`:'sin vencimiento'};
  const pre=e.pagoRegistrado==='Debe'&&u>=desde?'pago parcial · ':u?'':'sin pagos · ';
  return {k:'pend',txt:'Pendiente',cls:'p-warn',sub:`${pre}vence ${dv===0?'hoy':'en '+dv+' d'} · ${fmtShort(e.proxVenc)}`};
}
function rutinaInfo(e){
  const t=iso(today()),a=activaDe(e.id),c=colaDe(e.id),lista=c.find(r=>(r.fechaSugerida||t)<=t),esp=c.find(r=>(r.fechaSugerida||t)>t);
  if(lista)return {k:'entregar',txt:'Para entregar',cls:'p-warn',sub:'en cola desde '+fmtShort(lista.fechaSugerida||t)};
  if(a){const dur=Number(a.duracionSemanas)||4,fin=new Date(parse(a.fechaEntrega)||today());fin.setDate(fin.getDate()+dur*7);const resta=days(fin,today());
    if(resta<0)return {k:'vencida',txt:'Vencida',cls:'p-bad',sub:`hace ${-resta} d`+(esp?' · próxima '+fmtShort(esp.fechaSugerida):'')};
    if(resta<=5)return {k:'renovar',txt:resta===0?'Renovar hoy':`Renovar en ${resta} d`,cls:'p-warn',sub:'termina '+fmtShort(iso(fin))+(esp?' · próxima lista':'')};
    return {k:'ok',txt:'Al día',cls:'p-ok',sub:`semana ${Math.min(dur,semanaActual(a)+1)} de ${dur}`}}
  if(esp)return {k:'espera',txt:'En espera',cls:'p-warn',sub:'entrega '+fmtShort(esp.fechaSugerida)};
  return {k:'sin',txt:'Sin rutina',cls:'p-mute',sub:e.ultRutina?'últ. '+fmtShort(e.ultRutina):''};
}
/* ---------- LISTA ---------- */
S.ptab=(()=>{try{return localStorage.getItem('entrena.ptab')==='fin'?'fin':'hoy'}catch(_){return 'hoy'}})();
const SORTS=[['nombre','Entrenado'],['plan','Plan'],['monto','Mensualidad'],['rutina','Rutina'],['pago','Pago']];
S.ord=(()=>{try{const o=JSON.parse(localStorage.getItem('entrena.ord')||'null');if(o&&SORTS.some(x=>x[0]===o.k)&&(o.d===1||o.d===-1))return o}catch(_){}return {k:'nombre',d:1}})();
const guardarOrd=()=>{try{localStorage.setItem('entrena.ord',JSON.stringify(S.ord))}catch(_){}};
/* orden: estados por urgencia, desempate por días y nombre */
const RUT_ORD={vencida:0,entregar:1,renovar:2,espera:3,ok:4,sin:5};
const PAG_ORD={vencido:0,pend:1,ok:2,gym:3,sin:4};
function ordVal(e,k){const act=estado(e)==='Activo';
  if(k==='plan')return [String(e.plan||'~').toLowerCase(),Number(e.estimulos)||0];
  if(k==='monto')return [monto(e)];
  if(k==='rutina'){if(!act)return [9,0];const r=rutinaInfo(e),a=activaDe(e.id);let n=0;
    if(a){const fin=new Date(parse(a.fechaEntrega)||today());fin.setDate(fin.getDate()+(Number(a.duracionSemanas)||4)*7);n=days(fin,today())}
    return [RUT_ORD[r.k]??6,n]}
  if(k==='pago'){if(!act)return [9,0];const q=pagoInfo(e);return [PAG_ORD[q.k]??5,diasVenc(e)??-9999]}
  return []}
function ordenar(list){const {k,d}=S.ord;const nm=(a,b)=>name(a).localeCompare(name(b),'es');
  if(k==='nombre')return list.sort((a,b)=>d*nm(a,b));
  const cache=new Map(list.map(e=>[e,ordVal(e,k)]));
  return list.sort((a,b)=>{const x=cache.get(a),y=cache.get(b);
    if(k!=='plan'&&k!=='monto'&&(x[0]===9)!==(y[0]===9))return x[0]===9?1:-1; /* bajas/suspendidos siempre al final */
    for(let i=0;i<x.length;i++){const u=x[i],v=y[i];const c=typeof u==='string'?u.localeCompare(v,'es'):u-v;if(c)return d*c}
    return nm(a,b)})}
const FILTERS=[['activos','Activos'],['LEVEL','LEVEL'],['CROSSFORCE','CrossForce'],['ONLINE','Online'],['deuda','Deben'],['rutina','Rutina a revisar'],['Suspendido','Suspendidos'],['Baja','Bajas']];
function renderLista(){
  const el=$('#v-lista');
  if(!el.dataset.built){
    el.innerHTML=`<div class="toolbar"><input id="q" class="search" type="search" placeholder="Buscar por nombre o teléfono" autocomplete="off"><div class="chips" id="chips">${FILTERS.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${k===S.filter}">${l}</button>`).join('')}</div></div><div class="cnt-bar"><p class="count" id="cnt"></p><label class="ord-m">Ordenar<select id="ord-m">${SORTS.map(([k,l])=>`<option value="${k}:1">${l}${k==='nombre'?' (A-Z)':k==='monto'?' (menor a mayor)':k==='plan'?' (A-Z)':' (urgentes primero)'}</option><option value="${k}:-1">${l}${k==='nombre'?' (Z-A)':k==='monto'?' (mayor a menor)':k==='plan'?' (Z-A)':' (urgentes al final)'}</option>`).join('')}</select></label></div><div class="card"><div class="rhead">${SORTS.map(([k,l])=>`<button type="button" class="sh" data-sort="${k}">${l}<i aria-hidden="true"></i></button>`).join('')}<span></span></div><div class="rows" id="rows"></div></div>`;
    el.dataset.built=1;
    $('#q').addEventListener('input',e=>{S.q=e.target.value.trim().toLowerCase();renderRows()});
    el.querySelector('.rhead').addEventListener('click',ev=>{const b=ev.target.closest('[data-sort]');if(!b)return;const k=b.dataset.sort,o=S.ord;
      S.ord=o.k!==k?{k,d:1}:o.d===1?{k,d:-1}:{k:'nombre',d:1};guardarOrd();renderRows()});
    $('#ord-m').addEventListener('change',ev=>{const [k,d]=ev.target.value.split(':');S.ord={k,d:Number(d)};guardarOrd();renderRows()});
    $('#chips').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;S.filter=b.dataset.f;el.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.f===S.filter));renderRows()});
  }
  renderRows();
}
function renderRows(){
  if(!$('#rows'))return;
  let list=Object.values(S.ents);
  const f=S.filter;
  if(GYMS.includes(f))list=list.filter(e=>gymOf(e)===f&&isAct(e));
  else if(f==='activos')list=list.filter(isAct);
  else if(f==='deuda')list=list.filter(e=>isAct(e)&&['pend','vencido'].includes(pagoInfo(e).k));
  else if(f==='rutina')list=list.filter(rutinaRevisar);
  else if(f==='Suspendido'||f==='Baja')list=list.filter(e=>estado(e)===f);
  if(S.q){const qd=S.q.replace(/\D/g,'');list=list.filter(e=>(e.nombre||'').toLowerCase().includes(S.q)||(qd&&phoneDigits(e).includes(qd)))}
  ordenar(list);
  document.querySelectorAll('#v-lista .sh').forEach(b=>{const on=b.dataset.sort===S.ord.k;b.classList.toggle('on',on);b.setAttribute('aria-sort',on?(S.ord.d===1?'ascending':'descending'):'none');b.querySelector('i').textContent=on?(S.ord.d===1?'▲':'▼'):''});
  const om=$('#ord-m');if(om)om.value=S.ord.k+':'+S.ord.d;
  $('#cnt').textContent=S.loaded?plural(list.length,'entrenado','entrenados'):'Cargando…';
  $('#rows').innerHTML=list.length?list.map(e=>{const es=estado(e);return `<button class="row" data-open="${esc(e.id)}">
    <span class="c"><span class="n">${esc(name(e))}</span><br><span class="s">${gymTag(e)} ${esc(e.id)}</span><span class="m-plan">${esc(e.plan||'Sin plan')} · ${esc(e.estimulos||'?')}×/sem · <b>${sinCuota(e)?'Sin cuota':money(monto(e))}</b>${!sinCuota(e)&&Number(e.promo)&&e.cuota!=='fijo'?` <span class="m-promo">promo ${pct(e.promo)}</span>`:''}</span></span>
    <span class="c h">${esc(e.plan||'—')}<br><span class="s">${esc(e.estimulos)}×/sem</span></span>
    <span class="c h">${money(monto(e))}${Number(e.promo)?`<br><span class="s">promo ${pct(e.promo)}</span>`:''}</span>
    ${es==='Activo'?(()=>{const r=rutinaInfo(e),q=pagoInfo(e);return `<span class="c rp" data-l="Rutina"><span class="pill ${r.cls}">${esc(r.txt)}</span>${r.sub?`<br><span class="s">${esc(r.sub)}</span>`:''}</span>
    <span class="c rp" data-l="Pago"><span class="pill ${q.cls}">${esc(q.txt)}</span>${q.sub?`<br><span class="s">${esc(q.sub)}</span>`:''}</span>`})():`<span class="c h">—</span><span class="c rp"><span class="pill ${estPill(es)}">${es}</span></span>`}
    <span class="c h"></span></button>`}).join(''):`<div class="empty">${S.loaded?'No hay entrenados con ese filtro.':'Cargando…'}</div>`;
}

/* ---------- AJUSTES ---------- */
function renderAjustes(){
  const c=S.cfg;
  const gymForm=g=>`<div class="card pad form" style="margin-bottom:12px">
    <div class="full"><span class="pill ${gymPill(g)}">${GYM_LBL[g]}</span></div>
    ${[1,2,3,4,5].map(n=>`<label>${n}× por semana<input id="t-${g}-${n}" type="number" min="0" step="any" value="${esc(c.gyms[g].tarifas[String(n)]??'')}"></label>`).join('')}
    <label>% para Fran<input id="p-${g}" type="number" min="0" max="100" step="1" value="${Math.round(c.gyms[g].pctFran*100)}"></label>
  </div>`;
  $('#v-ajustes').innerHTML=`<h2 class="sec">Tarifas y reparto por gimnasio</h2>
  <form id="cfgf">
    ${gymForm('LEVEL')}${gymForm('CROSSFORCE')}
    <div class="card pad form" style="margin-bottom:12px"><div class="full"><span class="pill p-on">Online</span></div>
      <label>Precio mensual<input id="tonl" type="number" min="0" step="any" value="${esc(c.online)}"></label><label>% para Fran<input value="100%" readonly></label></div>
    <p class="hint">Los valores son sin promo; las promos de 10% y 15% se descuentan sobre estos precios. Al guardar se recalcula todo el panel.</p>
    <div class="actions" style="margin-top:12px"><button class="btn pri" type="submit">Guardar ajustes</button></div>
  </form>
  <h2 class="sec">Rutinas</h2>
  <form id="cfgr" class="card pad form">
    <label class="full">Dirección de la app (para los links de los entrenados)<input id="c-url" value="${esc(c.appUrl)}" placeholder="Se completa sola: ${esc(location.origin+location.pathname.replace(/[^/]*$/,''))}"></label>
    <label>Posiciones (separadas por coma)<input id="c-pos" value="${esc((c.posiciones||[]).join(', '))}"></label>
    <label>Bloques sugeridos<input id="c-bl" value="${esc((c.bloques||[]).join(', '))}"></label>
    <label>Redondeo de kg<input id="c-red" type="number" step="0.25" min="0.25" value="${esc(c.redondeo)}"></label>
    <label>Alerta: días sin entrenar<input id="c-dias" type="number" min="3" max="60" value="${esc(c.alertas.dias)}"></label>
    <label>Alerta: carga aguda/crónica mayor a<input id="c-acwr" type="number" min="1" max="3" step="0.1" value="${esc(c.alertas.acwr)}"></label>
    <div class="full"><b style="font-size:14px">Marcas RM</b><p class="hint">Si una marca no está cargada se calcula desde otra (ej: Sentadilla frontal = 75% de Sentadilla).</p></div>
    <div class="full tbl-wrap"><table id="rmdefs"><thead><tr><th>Marca</th><th>Se calcula desde</th><th>Factor</th><th></th></tr></thead><tbody>
      ${(c.rmDefs||[]).map((d,i)=>`<tr><td><input data-rd="mov" placeholder="Marca" value="${esc(d.mov)}"></td><td><select data-rd="base"><option value="">— (se carga)</option>${c.rmDefs.map(x=>`<option ${x.mov===d.base?'selected':''}>${esc(x.mov)}</option>`).join('')}</select></td><td><input data-rd="factor" placeholder="Factor" type="number" step="0.01" value="${esc(d.factor??'')}" style="width:80px"></td><td><button type="button" class="x-sm" data-rddel="${i}">Quitar</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="full actions"><button class="btn" type="button" id="rd-add">+ Marca</button><button class="btn pri" type="submit">Guardar ajustes de rutinas</button></div>
  </form>
  <h2 class="sec">Avisos en el link del entrenado</h2>
  <form class="card pad form" id="cfga">
    <p class="hint full" style="margin:0">Se muestran solos según la fecha de vencimiento de cada entrenado y desaparecen cuando registrás el pago. Podés usar {nombre}, {fecha}, {cuando}, {monto} y {banco}.</p>
    <div class="full"><span class="lbl-s">Mostrar los avisos a los entrenados de</span><div class="chips">${[['LEVEL','Level'],['ONLINE','Online'],['CROSSFORCE','CrossForce']].map(([g,l])=>`<label class="chip av-g"><input type="checkbox" data-avg="${g}" ${c.avisos.gyms[g]!==false?'checked':''}> ${l}</label>`).join('')}</div><p class="hint" style="margin:6px 0 0">Si un gimnasio cobra directamente (como CrossForce), dejalo sin tildar. En la ficha de cada entrenado podés hacer una excepción.</p></div>
    <label class="plan-on full"><input type="checkbox" id="av-pon" ${c.avisos.pagoOn?'checked':''}> <span><b>Aviso de pago:</b> aparece antes del wellness (o antes de ver la rutina) desde <input id="av-pd" type="number" min="1" max="10" value="${esc(c.avisos.diasPago)}" style="width:56px"> días antes del vencimiento. Lo ve una vez por día y tiene que tocar “Entendido”.</span></label>
    <label class="full">Texto del aviso de pago<textarea id="av-p" rows="3">${esc(c.avisos.pago)}</textarea></label>
    <label>Alias o CBU para transferir (opcional)<input id="av-al" value="${esc(c.avisos.alias)}" placeholder="ej: fran.entrena.mp"></label>
    <label>Banco o billetera virtual<input id="av-bco" value="${esc(c.avisos.banco||'')}" placeholder="ej: Mercado Pago" list="dl-bancos"><datalist id="dl-bancos"><option>Mercado Pago</option><option>Ualá</option><option>Naranja X</option><option>Brubank</option><option>Banco Nación</option><option>Banco Galicia</option><option>Banco Santander</option><option>Banco Provincia</option><option>BBVA</option><option>Macro</option></datalist></label>
    <label>Tu WhatsApp para el comprobante (opcional)<input id="av-wa" value="${esc(c.avisos.wa)}" placeholder="+54911..."></label>
    <label class="plan-on full"><input type="checkbox" id="av-ron" ${c.avisos.rutinaOn?'checked':''}> <span><b>Aviso de rutina:</b> aparece arriba de la rutina desde <input id="av-rd" type="number" min="1" max="15" value="${esc(c.avisos.diasRutina)}" style="width:56px"> días antes del vencimiento.</span></label>
    <label class="full">Texto del aviso de rutina<textarea id="av-r" rows="3">${esc(c.avisos.rutina)}</textarea></label>
    <div class="full actions"><button class="btn pri" type="submit">Guardar avisos</button></div>
  </form>
  <h2 class="sec">Períodos de renovación de rutina</h2>
  <div class="card"><div class="tbl-wrap"><table><thead><tr><th>Período</th><th>Días del mes</th></tr></thead><tbody>
  <tr><td>Periodo A</td><td>1 – 5</td></tr><tr><td>Periodo B</td><td>6 – 15</td></tr><tr><td>Periodo C</td><td>16 – 22</td></tr><tr><td>Periodo D</td><td>23 – 31</td></tr></tbody></table></div></div>`;
  $('#cfgf').addEventListener('submit',async ev=>{ev.preventDefault();
    const nc={online:Number($('#tonl').value)||0,gyms:{}};
    for(const g of ['LEVEL','CROSSFORCE']){const t={};[1,2,3,4,5].forEach(n=>t[String(n)]=Number($(`#t-${g}-${n}`).value)||0);
      nc.gyms[g]={tarifas:t,pctFran:Math.min(100,Math.max(0,Number($('#p-'+g).value)||0))/100}}
    if(await write(()=>S.db.doc('config/general').set({...S.cfgRaw,...nc})))toast('Ajustes guardados');
  });
  $('#cfga').addEventListener('submit',async ev=>{ev.preventDefault();
    const av={pagoOn:$('#av-pon').checked,rutinaOn:$('#av-ron').checked,diasPago:Math.min(10,Math.max(1,Number($('#av-pd').value)||3)),diasRutina:Math.min(15,Math.max(1,Number($('#av-rd').value)||5)),
      pago:$('#av-p').value.trim()||AVISOS_DEF.pago,rutina:$('#av-r').value.trim()||AVISOS_DEF.rutina,alias:$('#av-al').value.trim(),banco:$('#av-bco').value.trim(),wa:$('#av-wa').value.replace(/[^\d+]/g,''),gyms:Object.fromEntries([...document.querySelectorAll('[data-avg]')].map(x=>[x.dataset.avg,x.checked]))};
    if(await write(()=>S.db.doc('config/general').set({...S.cfgRaw,avisos:av})))toast('Avisos guardados');
  });
  const readDefs=()=>[...document.querySelectorAll('#rmdefs tbody tr')].map(tr=>{const mov=tr.querySelector('[data-rd=mov]').value.trim().toUpperCase();const base=tr.querySelector('[data-rd=base]').value;const f=Number(tr.querySelector('[data-rd=factor]').value);return mov?{mov,...(base&&base!==mov?{base,factor:f||1}:{})}:null}).filter(Boolean);
  $('#rd-add').addEventListener('click',()=>{S.cfg.rmDefs=[...readDefs(),{mov:''}];renderAjustes()});
  $('#cfgr').addEventListener('click',ev=>{const b=ev.target.closest('[data-rddel]');if(b){const d=readDefs();d.splice(Number(b.dataset.rddel),1);S.cfg.rmDefs=d;renderAjustes()}});
  $('#cfgr').addEventListener('submit',async ev=>{ev.preventDefault();
    const split=v=>v.split(',').map(x=>x.trim()).filter(Boolean);
    const nc={appUrl:$('#c-url').value.trim(),posiciones:split($('#c-pos').value),bloques:split($('#c-bl').value).map(x=>x.toUpperCase()),redondeo:Number($('#c-red').value)||2.5,rmDefs:readDefs(),alertas:{dias:Number($('#c-dias').value)||10,acwr:Number($('#c-acwr').value)||1.5}};
    if(await write(()=>S.db.doc('config/general').set({...S.cfgRaw,...nc})))toast('Ajustes guardados');
  });
}

/* ---------- FICHA ---------- */
let openId=null,sheetMode='ver',sheetArg=null,bulk=null;
/* Las hojas (ficha, editor, formularios) se abren en un <dialog> modal nativo:
   el navegador bloquea la página de atrás, mantiene el foco adentro, y cierra con Esc o con el gesto "atrás" del celular. */
function openSheet(id,mode,arg){if(id!==openId){S.asW=0;S.asSec=null}openId=id;sheetMode=mode||'ver';sheetArg=arg||null;renderSheet();
  const ov=$('#overlay'),t=ov.querySelector('.sheet-h h3');if(t)ov.setAttribute('aria-label',t.textContent);
  if(!ov.open){if(typeof ov.showModal==='function')ov.showModal();else ov.setAttribute('open','')}}
function closeSheet(){const ov=$('#overlay');_shId=null;_shK='';openId=null;bulk=null;
  if(ov.open){if(typeof ov.close==='function')ov.close();else ov.removeAttribute('open')}ov.innerHTML='';delete ov.dataset.warned}
(()=>{const ov=$('#overlay');
  /* Esc / gesto atrás: antes de cerrar, respetar cambios sin guardar del editor y cerrar el autocompletar si está abierto */
  ov.addEventListener('cancel',ev=>{
    const ac=ov.querySelector('.ac-wrap .ac-pop');if(ac){ev.preventDefault();ac.remove();return}
    if(openId==='__rut'&&S.edit&&S.edit.dirty&&!ov.dataset.warned){ev.preventDefault();ov.dataset.warned=1;toast('Hay cambios sin guardar. Volvé a cerrar para descartarlos');return}});
  ov.addEventListener('close',()=>{if(openId)closeSheet()})})();
function setMode(m,arg){sheetMode=m;sheetArg=arg||null;renderSheet()}
/* Al volver a dibujar una pantalla, se conserva dónde estabas: scroll, listas internas y el campo con foco.
   Así tocar un botón o guardar no "refresca" la vista ni la manda arriba. */
function focoSel(root){const ae=document.activeElement;if(!ae||!root.contains(ae)||ae===document.body)return null;const d=ae.dataset;let sel=null;
  if(ae.id)sel='#'+CSS.escape(ae.id);else if(d.p!=null&&d.f)sel=`[data-p="${d.p}"][data-f="${d.f}"]`;else if(d.h)sel=`[data-h="${d.h}"]`;else if(d.in&&d.uid)sel=`[data-in="${d.in}"][data-uid="${d.uid}"]`;else if(ae.name)sel=`[name="${CSS.escape(ae.name)}"]`;
  if(!sel)return null;let a=null,z=null;try{a=ae.selectionStart;z=ae.selectionEnd}catch(_){}return {sel,a,z}}
function focoVolver(root,f){if(!f)return;const n=root.querySelector(f.sel);if(!n)return;n.focus({preventScroll:true});try{if(f.a!=null)n.setSelectionRange(f.a,f.z)}catch(_){}}
const INNER='.al-scroll,.tbl-wrap,.cw-body,[data-keep-scroll]';
function conservar(root,fn){if(!root)return fn();const inn=[...root.querySelectorAll(INNER)].map(e=>[e.scrollTop,e.scrollLeft]),f=focoSel(root);fn();
  [...root.querySelectorAll(INNER)].forEach((e,i)=>{const v=inn[i];if(v){e.scrollTop=v[0];e.scrollLeft=v[1]}});focoVolver(root,f)}
let _shK='',_shId=null;
function renderSheet(){const ov=$('#overlay'),sh=ov.querySelector('.sheet'),k=openId+'|'+sheetMode,same=!!sh&&_shId===openId,keep=same&&_shK===k,st=keep?sh.scrollTop:0;
  const go=()=>renderSheet0();if(keep)conservar(ov,go);else go();
  const n=ov.querySelector('.sheet');if(n){if(same)n.classList.add('noanim');if(keep)n.scrollTop=st}
  _shK=k;_shId=openId}
function renderSheet0(){
  const ov=$('#overlay');
  ov.oninput=null;ov.onchange=null;
  if(openId==='__test'){const a=sheetArg||{};if(!S.ents[a.eid]){closeSheet();return}ov.innerHTML=shell(a.id?'Editar test':'Nuevo test',testFormHTML(a));bindTest(a);return}
  if(openId==='__equipo'){const a=sheetArg||{};ov.innerHTML=shell(a.id?'Editar equipo':'Nuevo equipo',equipoFormHTML(a));bindEquipo(a);return}
  if(openId==='__tlote'){const a=sheetArg||{};const q=(S.equipos||[]).find(x=>x._id===a.eq);if(!q){closeSheet();return}ov.innerHTML=shell('Tests · '+q.nombre,loteHTML(a));ov.querySelector('.sheet').classList.add('wide');bindLote(a);return}
  if(openId==='__tpnew'){const a=sheetArg||{};ov.innerHTML=shell('Nueva temporada',tpNewHTML(a));bindTpNew(a);return}
  if(openId==='__tpsem'){const a=sheetArg||{};if(!(S.temps||[]).find(x=>x._id===a.tid)){closeSheet();return}ov.innerHTML=shell('Semana '+(a.i+1),tpSemHTML(a));ov.querySelector('.sheet').classList.add('wide');bindTpSem(a);return}
  if(openId==='__tptab'){const a=sheetArg||{};if(!(S.temps||[]).find(x=>x._id===a.tid)){closeSheet();return}ov.innerHTML=shell('Tabla de la temporada',tpTabHTML(a));ov.querySelector('.sheet').classList.add('wide');bindTpTab(a);return}
  if(openId==='__tpent'){const a=sheetArg||{};if(!(S.temps||[]).find(x=>x._id===a.tid)){closeSheet();return}ov.innerHTML=shell('Entregar al plantel',tpEntHTML(a));bindTpEnt(a);return}
  if(openId==='__prot'){const a=sheetArg||{};ov.innerHTML=shell('Protocolos de test',protFormHTML(a));ov.querySelector('.sheet').classList.add('wide');bindProt(a);return}
  if(openId==='__epform'){const a=sheetArg||{};ov.innerHTML=shell('Fórmulas de Equipo Pro',epFormHTML(a));ov.querySelector('.sheet').classList.add('wide');bindEpForm(a);return}
  if(openId==='__tpsync'){const a=sheetArg||{};if(!(S.temps||[]).find(x=>x._id===a.tid)){closeSheet();return}ov.innerHTML=shell('Actualizar desde Excel',tpSyncHTML(a));bindTpSync(a);return}
  if(openId==='__guia'){const a=sheetArg||{};ov.innerHTML=shell('Guía del entrenador',guiaHTML(a));ov.querySelector('.sheet').classList.add('wide');bindGuia(a);if(a.sec&&a.sec!=='inicio')requestAnimationFrame(()=>{const d=document.getElementById('g-'+a.sec);if(d)d.scrollIntoView({block:'start'})});return}
  if(openId==='__tpcfg'){const a=sheetArg||{};if(!(S.temps||[]).find(x=>x._id===a.tid)){closeSheet();return}ov.innerHTML=shell('Ajustes de la temporada',tpCfgHTML(a));bindTpCfg(a);return}
  if(openId==='__bulk'){ov.innerHTML=shell('Envío de mensajes',bulkHTML());bindBulk();return}
  if(openId==='__rut'){const R=S.edit.data;ov.innerHTML=shell(S.edit.col==='plantillas'?(S.edit.id?'Plantilla':'Nueva plantilla'):(R.nombre||'Rutina'),editorHTML());ov.querySelector('.sheet').classList.add('wide');bindEditor();return}
  if(openId==='__ej'){ov.innerHTML=shell(S.ejEdit.id?'Ejercicio':'Nuevo ejercicio',ejHTML());bindEj();return}
  if(openId==='__copiar'){ov.innerHTML=shell('Copiar rutina de otro entrenado',copiarHTML(sheetArg));bindCopiar(sheetArg);return}
  if(openId==='__asig'){ov.innerHTML=shell('Asignar plantilla',asignarHTML(sheetArg));ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};bindAsignar(sheetArg);return}
  if(openId==='__formas'){ov.innerHTML=shell('Pagos de '+mesLbl(sheetArg.mes),formasHTML(sheetArg));ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
      const f=ev.target.closest('[data-formas]');if(f){sheetArg.f=f.dataset.formas;renderSheet();return}const o=ev.target.closest('[data-open]');if(o)openSheet(o.dataset.open)};return}
  if(openId==='__cev'){const ev=calBuscar(sheetArg);if(!ev){closeSheet();return}ov.innerHTML=shell(ev.k==='ent'?'Entrenamiento':ev.k==='ev'?'Evento':ev.k==='pago'?'Cuota':'Rutina',cevHTML(ev));
    ov.onclick=ev2=>{if(ev2.target===ov||ev2.target.closest('[data-close]')){closeSheet();return}const o=ev2.target.closest('[data-open]');if(o){openSheet(o.dataset.open);return}const m=ev2.target.closest('[data-msg]');if(m){openSheet(m.dataset.msg,'wa',m.dataset.kind);return}
      const ed=ev2.target.closest('[data-cedit]');if(ed){const v=S.evs.find(x=>x._id===ed.dataset.cedit);if(v)openSheet('__evf','edit',{...v});return}handleRut(ev2)};return}
  if(openId==='__evf'){const v=sheetArg||{};ov.innerHTML=shell(v._id?'Editar evento':'Nuevo evento',evFormHTML(v));
    ov.onclick=async ev2=>{if(ev2.target===ov||ev2.target.closest('[data-close]')){closeSheet();return}const dl=ev2.target.closest('[data-evdel]');if(dl){if(S.evArm!==dl.dataset.evdel){S.evArm=dl.dataset.evdel;renderSheet();return}S.evArm=null;if(await write(()=>S.db.collection('eventos').doc(dl.dataset.evdel).delete())){toast('Evento borrado');closeSheet()}}};
    $('#evf').onsubmit=async ev2=>{ev2.preventDefault();const d={titulo:$('#ev-t').value.trim(),tipo:$('#ev-tipo').value,eid:$('#ev-e').value,fecha:$('#ev-f').value,hora:$('#ev-h').value,dur:Number($('#ev-d').value)||60,rep:$('#ev-r').value,hasta:$('#ev-r').value==='semanal'?$('#ev-hasta').value:'',notas:$('#ev-n').value.trim(),ts:Date.now()};
      if(!d.titulo||!d.fecha){toast('Completá título y fecha');return}
      const ok=v._id?await write(()=>S.db.collection('eventos').doc(v._id).set(d)):await write(()=>S.db.collection('eventos').add(d));if(ok){toast('Evento guardado');closeSheet()}};return}
  if(openId==='__cexp'){S.calExp=S.calExp||{ent:true,pago:true,rut:true,ev:true,dias:60};ov.innerHTML=shell('Pasar a Google Calendar',expHTML());
    ov.onchange=ev2=>{const x=ev2.target.closest('[data-ex]');if(x)S.calExp[x.dataset.ex]=x.checked;const y=ev2.target.closest('[data-exd]');if(y)S.calExp.dias=Number(y.value)};
    ov.onclick=ev2=>{if(ev2.target===ov||ev2.target.closest('[data-close]')){closeSheet();return}if(ev2.target.closest('[data-exgo]')){const r=icsTxt(S.calExp);if(!r.n){toast('No hay eventos para exportar');return}
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([r.txt],{type:'text/calendar;charset=utf-8'}));a.download='entrena.ics';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast(plural(r.n,'evento exportado','eventos exportados'))}};return}
  if(openId==='__liq'){if(!S.lq)S.lq=liqNueva();ov.innerHTML=shell(S.lq.id?'Liquidación CrossForce · '+mesLbl(S.lq.mes):'Registrar liquidación CrossForce',liqHTML());ov.querySelector('.sheet').classList.add('wide');
    const fi=$('#lq-file');if(fi)fi.onchange=async()=>{const file=fi.files[0];if(!file)return;liqLeerForm();try{const buf=await file.arrayBuffer();const aoa=/\.csv$/i.test(file.name)?new TextDecoder().decode(buf).split(/\r?\n/).map(l=>l.split(/[;,\t](?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c=>c.replace(/^"|"$/g,'').trim()||null)):await leerXLSX(buf);
      const f=liqMatch(liqFilas(aoa));if(!f.length)throw new Error('No encontré filas con nombre y monto en el Excel.');S.lq.filas=f;S.lq.archivo=file.name;S.lq.msg='';const fs=f.map(x=>x.fecha).filter(Boolean).sort();if(fs.length&&!S.lq.id)S.lq.mes=fs[fs.length-1].slice(0,7)}catch(x){S.lq.msg=x.message}renderSheet()};
    ov.oninput=ev=>{if(ev.target.matches('#lq-monto,#lq-fecha,#lq-mes,#lq-forma'))liqLeerForm()};
    ov.onchange=ev=>{const se=ev.target.closest('[data-lqe]');if(se){liqLeerForm();const i=Number(se.dataset.lqe),f=S.lq.filas[i];if(se.value)S.lq.filas.forEach((g,j)=>{if(j!==i&&g.eid===se.value){g.eid='';g.how=''}});f.eid=se.value;f.how='';renderSheet();return}if(ev.target.matches('#lq-mes')){liqLeerForm();renderSheet()}};
    ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}const b=ev.target.closest('[data-lq]');if(!b)return;const k=b.dataset.lq;
      if(k==='paste'){liqLeerForm();const t=$('#lq-paste').value;const aoa=t.split(/\r?\n/).map(l=>l.split('\t').map(c=>c.trim()===''?null:c.trim()));const f=liqMatch(liqFilas(aoa));if(!f.length){S.lq.msg='No encontré filas con nombre y monto. Copiá desde la columna de fecha hasta la de monto.'}else{S.lq.filas=f;S.lq.archivo='Filas pegadas';S.lq.msg=''}renderSheet();return}
      if(k==='save'){await liqGuardar();return}
      if(k==='del'){if(!S.lq.armed){S.lq.armed=true;renderSheet();return}if(await write(()=>S.db.collection('liquidaciones').doc(S.lq.id).delete())){toast('Liquidación borrada');closeSheet()}}};return}
  if(openId==='__rend'){const M=sheetArg||curMes();S.rend=S.rend||{};ov.innerHTML=shell('Rendición a LEVEL · '+mesLbl(M),rendHTML(M));
    ov.oninput=null;ov.onchange=null;
    ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
      const sv=ev.target.closest('[data-rsave]');if(sv){const m=Number($('#rd-monto').value)||0,f=$('#rd-fecha').value;if(!m||!f){toast('Completá fecha y monto');return}if(await write(()=>S.db.collection('rendiciones').add({gym:'LEVEL',mes:M,fecha:f,monto:m,forma:$('#rd-forma').value,ts:Date.now()}))){toast('Rendición guardada');renderSheet()}return}
      const dl=ev.target.closest('[data-rdel]');if(dl){if(S.rend.armed!==dl.dataset.rdel){S.rend.armed=dl.dataset.rdel;renderSheet();return}if(await write(()=>S.db.collection('rendiciones').doc(dl.dataset.rdel).delete())){S.rend.armed=null;toast('Rendición borrada');renderSheet()}}};return}
  if(openId==='__rv'){const r=S.rutinas.find(x=>x._id===sheetArg);if(!r){closeSheet();return}const e=S.ents[r.entrenadoId];
    ov.innerHTML=shell((e?firstName(e)+' · ':'')+(r.nombre||'Rutina'),`<div class="actions" style="margin-bottom:10px"><button class="btn" type="button" data-open="${esc(r.entrenadoId)}">← Volver a la ficha</button></div>`+rutVistaHTML(r,e));ov.querySelector('.sheet').classList.add('wide');
    ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}const o=ev.target.closest('[data-open]');if(o){openSheet(o.dataset.open);return}
      const ia=ev.target.closest('[data-rvia]');if(ia){if(e)iaCopiar(e,r);return}handleRut(ev)};return}
  if(openId==='__posp'){const r=S.rutinas.find(x=>x._id===sheetArg);if(!r){closeSheet();return}ov.innerHTML=shell('Posponer entrega',posponerHTML(r));ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};bindPosponer(r);return}
  const isNew=openId==='__new';
  const e=isNew?{id:nextId(),nombre:'',telefono:'+549',gym:'LEVEL',estado:'Activo',plan:'Deportivo',estimulos:2,promo:0,pagoRegistrado:'Al día',modalidad:'Periodizada',inicio:iso(today()),ultPago:iso(today()),proxVenc:addMonth(iso(today())),ultRutina:'',obs:''}:S.ents[openId];
  if(!e){closeSheet();return}
  let body='';
  if(sheetMode==='editar'||isNew) body=formHTML(e,isNew);
  else if(sheetMode==='pago') body=pagoHTML(e);
  else if(sheetMode==='wa') body=waHTML(e,sheetArg);
  else if(sheetMode==='estado') body=estadoHTML(e,sheetArg);
  else body=fichaHTML(e);
  ov.innerHTML=shell(isNew?'Nuevo entrenado':name(e),body);
  bindSheet(e,isNew);
}
const shell=(t,b)=>`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t)}"><div class="sheet-h"><h3>${esc(t)}</h3><button class="x" data-close aria-label="Cerrar">×</button></div><div class="sheet-b">${b}</div></div>`;
function fichaHTML(e){
  const p=estadoPago(e),dr=diasRutina(e),dv=diasVenc(e),es=estado(e);
  const ps=S.pagos.filter(p=>p.entrenadoId===e.id).sort((a,b)=>(b.mes||'').localeCompare(a.mes||'')||(b.fecha||'').localeCompare(a.fecha||''));
  const um=adeudados(e.id);
  const hs=S.hist.filter(h=>h.entrenadoId===e.id).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.ts||0)-(a.ts||0));
  const estBtns=es==='Activo'?`<button class="btn" data-estado="Suspendido">Suspender</button><button class="btn danger" data-estado="Baja">Dar de baja</button>`
    :es==='Suspendido'?`<button class="btn pri" data-estado="Activo">Reactivar</button><button class="btn danger" data-estado="Baja">Dar de baja</button>`
    :`<button class="btn pri" data-estado="Activo">Reactivar</button>`;
  return `<div class="actions">${gymTag(e)}<span class="pill ${estPill(es)}">${es}</span>${es==='Activo'?`<span class="pill ${pagoPill(p)}">Pago: ${p}</span>`:''}${rutinaRevisar(e)?'<span class="pill p-warn">Revisar rutina</span>':''}</div>
  ${es!=='Activo'?`<div class="banner" style="margin:0">${es==='Suspendido'?'Suspendido':'Dado de baja'}${e.fechaEstado?' el '+fmtD(e.fechaEstado):''}${e.motivoEstado?' · '+esc(e.motivoEstado):''}. No cuenta en la facturación ni en los avisos de cobro.</div>`:''}
  <div class="actions">
    ${es==='Activo'&&!sinCuota(e)?`<button class="btn pri" data-mode="pago">Registrar pago</button><button class="btn" data-act="rutina">Renové la rutina hoy</button>`:''}
    <button class="btn" data-mode="wa">${WA.replace('<svg','<svg style="width:14px;height:14px;fill:var(--ok);vertical-align:-2px"')} Mensaje</button>
    <button class="btn" data-mode="editar">Editar</button>
  </div>
  <dl class="card facts" style="margin:0">
    <div><dt>ID</dt><dd>${esc(e.id)}</dd></div>
    <div><dt>Teléfono</dt><dd>${esc(e.telefono)}</dd></div>
    <div><dt>Plan</dt><dd>${esc(e.plan)} · ${esc(e.estimulos)}×/sem</dd></div>
    ${e.perfil||e.nivel||e.objetivo?`<div><dt>Perfil</dt><dd>${esc([e.perfil,e.nivel].filter(Boolean).join(' · ')||'—')}${e.objetivo?`<br><span class="hint" style="display:inline">${esc(e.objetivo)}</span>`:''}</dd></div>`:''}
    <div><dt>Mensualidad</dt><dd>${sinCuota(e)?'Sin cuota'+(e.cuotaMotivo?` <span class="hint" style="display:inline">· ${esc(e.cuotaMotivo)}</span>`:''):money(monto(e))+(e.cuota==='fijo'?' <span class="hint" style="display:inline">(monto fijo)</span>':Number(e.promo)?' (promo '+pct(e.promo)+')':'')}</dd></div>
    <div><dt>Último pago</dt><dd>${fmtD(e.ultPago)}</dd></div>
    <div><dt>Próximo vencimiento</dt><dd>${fmtD(e.proxVenc)}${dv!==null&&es==='Activo'?` <span class="hint" style="display:inline">(${dv<0?'hace '+(-dv)+' d':dv===0?'hoy':'en '+dv+' d'})</span>`:''}</dd></div>
    ${(()=>{const a=activaDe(e.id);if(a){const w=a.fechaEntrega?Math.floor(days(today(),parse(a.fechaEntrega))/7)+1:null,dur=Number(a.duracionSemanas)||4;
      const pe=a.equipo?null:rutDe(e.id).find(r=>r.estado==='activa'&&r.equipo);
      return `<div><dt>${a.equipo?'Plan del equipo':'Rutina activa'}</dt><dd>${esc(a.nombre||'Rutina')}</dd></div><div><dt>Entregada</dt><dd>${fmtD(a.fechaEntrega)}${w?` <span class="hint" style="display:inline">(semana ${Math.min(w,dur)} de ${dur})</span>`:''}</dd></div>${pe?`<div><dt>Plan del equipo</dt><dd>${esc(pe.nombre)} <span class="hint" style="display:inline">(también lo ve en su link)</span></dd></div>`:''}`}
      return `<div><dt>Rutina</dt><dd>${esc(e.modalidad||'—')}</dd></div><div><dt>Última rutina</dt><dd>${fmtD(e.ultRutina)}${dr!==null?` <span class="hint" style="display:inline">(${dr} d · ${periodo(e)})</span>`:''}</dd></div>`})()}
    ${e.inicio?`<div><dt>Fecha de inicio</dt><dd>${fmtD(e.inicio)}</dd></div>`:''}
    <div><dt>Pago registrado</dt><dd>${esc(e.pagoRegistrado)}</dd></div>
    <div><dt>Avisos de cuota en su link</dt><dd><select data-avpago="${esc(e.id)}" class="av-sel"><option value="" ${!e.avisoPago?'selected':''}>Según gimnasio (${avisoAuto(e)?'sí':'no'})</option><option value="si" ${e.avisoPago==='si'?'selected':''}>Sí, mostrar</option><option value="no" ${e.avisoPago==='no'?'selected':''}>No mostrar</option></select></dd></div>
  </dl>
  ${e.obs?`<div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Observaciones</div></div><div style="margin-top:4px;overflow-wrap:anywhere">${esc(e.obs)}</div></div>`:''}
  ${fichaRutinasHTML(e)}
  <div class="card">
    <div class="pad" style="padding-bottom:4px"><b>Pagos</b>${um.length?` <span class="pill p-bad">Adeuda ${um.map(mesLbl).join(', ')}</span>`:''}</div>
    ${ps.length?`<ul class="timeline">${ps.map(p=>`<li><span class="d">${fmtD(p.fecha)}</span><span class="t"><span class="pill p-ok">${mesLbl(p.mes)}</span> ${money(p.monto)}${p.forma?` <span class="hint" style="display:inline">· ${esc(formaTxt(p))}</span>`:''}</span><button class="del" data-delp="${esc(p._id)}" aria-label="Borrar pago">Borrar</button></li>`).join('')}</ul>`:'<div class="empty">Sin pagos registrados en la app.</div>'}
  </div>
  <div class="card">
    <div class="pad" style="padding-bottom:4px"><b>Historial</b></div>
    <form id="hf" class="form pad" style="padding-top:8px">
      <label>Fecha<input id="hfecha" type="date" value="${iso(today())}"></label>
      <label>Tipo<select id="htipo">${['Lesión','Ausencia','Evaluación física','Meta','Rutina','Pago','Otro'].map(t=>`<option>${t}</option>`).join('')}</select></label>
      <label class="full">Detalle<input id="hdet" type="text" placeholder="Ej: molestia en rodilla derecha, bajar carga en sentadilla" required></label>
      <div class="full actions"><button class="btn" type="submit">Agregar al historial</button></div>
    </form>
    ${hs.length?`<ul class="timeline">${hs.map(h=>`<li><span class="d">${fmtD(h.fecha)}</span><span class="t"><span class="pill p-mute">${esc(h.tipo)}</span> ${esc(h.detalle)}</span><button class="del" data-delh="${esc(h._id)}" aria-label="Borrar evento">Borrar</button></li>`).join('')}</ul>`:'<div class="empty">Sin eventos todavía. Registrá lesiones, ausencias, evaluaciones o metas.</div>'}
  </div>
  <div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Estado del entrenado</div></div><div class="actions" style="margin-top:8px">${estBtns}</div></div>`;
}
function estadoHTML(e,target){
  const txt={Suspendido:['Suspender','Queda guardado y lo podés reactivar cuando vuelva. Sale de la facturación y de los avisos de cobro.','Ej: viaje, lesión, pausa por exámenes'],
    Baja:['Dar de baja','Para quien no va a volver a entrenar con vos. Se conserva la ficha y el historial.','Ej: se mudó, cambió de entrenador'],
    Activo:['Reactivar','Vuelve a contar en la facturación. Revisá el vencimiento para que el estado de pago quede bien.','Ej: retoma después de las vacaciones']}[target];
  return `<form id="esf" class="form card pad">
    <p class="hint full">${txt[1]}</p>
    <label>Fecha<input id="es-fecha" type="date" value="${iso(today())}" required></label>
    ${target==='Activo'?`<label>Próximo vencimiento<input id="es-venc" type="date" value="${addMonth(iso(today()))}"></label>`:'<span></span>'}
    <label class="full">Motivo (opcional)<input id="es-mot" type="text" placeholder="${txt[2]}"></label>
    <div class="full actions"><button class="btn ${target==='Baja'?'danger armed':'pri'}" type="submit">${txt[0]}</button><button class="btn" type="button" data-mode="ver">Cancelar</button></div>
  </form>`;
}
function formHTML(e,isNew){
  const o=(arr,v)=>arr.map(x=>`<option ${String(x)===String(v)?'selected':''}>${esc(x)}</option>`).join('');
  return `<form id="ef" class="form" data-cq="${esc(e.cuota||'')}">
    <label class="full">Nombre completo<input id="f-nombre" required value="${esc(e.nombre)}"></label>
    <label>Teléfono<input id="f-tel" type="tel" required value="${esc(e.telefono)}" placeholder="+5491100000000"></label>
    <label>ID<input id="f-id" value="${esc(e.id)}" ${isNew?'':'readonly'}></label>
    <label>Gimnasio<select id="f-gym">${GYMS.map(g=>`<option value="${g}" ${gymOf(e)===g?'selected':''}>${GYM_LBL[g]}</option>`).join('')}</select></label>
    <label>Estado<select id="f-estado">${o(['Activo','Suspendido','Baja'],estado(e))}</select></label>
    <label>Plan<input id="f-plan" list="planes" value="${esc(e.plan)}"><datalist id="planes"><option>Deportivo</option><option>C. General</option><option>Hipertrofia</option><option>Fuerza</option><option>Salud</option></datalist></label>
    <label>Estímulos/sem<select id="f-est">${o([1,2,3,4,5],e.estimulos)}</select></label>
    <div class="full cq"><span class="cq-l">Cuota</span><div class="seg cq-seg" role="radiogroup" aria-label="Cuota">${[['','Según tarifa'],['fijo','Monto fijo'],['sin','Sin cuota']].map(([k,l])=>`<button type="button" role="radio" data-cq="${k}" aria-pressed="${(e.cuota||'')===k}" aria-checked="${(e.cuota||'')===k}">${l}</button>`).join('')}</div><input type="hidden" id="f-cuota" value="${esc(e.cuota||'')}"></div>
    <label class="cq-t">Promo<select id="f-promo">${[0,0.1,0.15].map(x=>`<option value="${x}" ${Number(e.promo)===x?'selected':''}>${pct(x)}</option>`).join('')}</select></label>
    <label class="cq-t">Mensualidad<input id="f-monto" readonly value="${money(monto({...e,cuota:''}))}"></label>
    <label class="cq-f full">Monto fijo por mes<input id="f-fijo" type="number" min="0" step="any" inputmode="numeric" value="${esc(e.montoFijo??'')}" placeholder="Ej: 45000"></label>
    <label class="cq-s full">Motivo (opcional)<input id="f-cmot" value="${esc(e.cuotaMotivo||'')}" placeholder="Ej: plantel AFALP, familiar, canje"></label>
    <p class="hint full cq-s" style="margin:0">No paga: no aparece en cobros, vencimientos, avisos de pago ni en el calendario de cuotas. Igual tiene rutina, link y asistencia.</p>
    <label class="cq-p">Último pago<input id="f-ultpago" type="date" value="${esc(e.ultPago||'')}"></label>
    <label class="cq-p">Próximo vencimiento<input id="f-venc" type="date" value="${esc(e.proxVenc||'')}"></label>
    <label class="cq-p">Pago registrado<select id="f-pago">${o(['Al día','Debe'],e.pagoRegistrado)}</select></label>
    <label>Modalidad rutina<select id="f-mod">${o(['Periodizada','Diaria','Cambiar','Planificar','Sin definir'],e.modalidad)}</select></label>
    <label>Última rutina<input id="f-rut" type="date" value="${esc(e.ultRutina||'')}"></label>
    <label>Fecha de inicio<input id="f-inicio" type="date" value="${esc(e.inicio||'')}"></label>
    <label>Grupo / equipo<input id="f-grupo" list="dl-grupos" value="${esc(e.grupo||'')}" placeholder="Ej: Handball AFALP"><datalist id="dl-grupos">${[...new Set(Object.values(S.ents).map(x=>x.grupo).filter(Boolean))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>
    <label>Perfil<select id="f-perfil">${o(['','Entrenado','Deportista'],e.perfil||'')}</select></label>
    <label>Nivel<select id="f-nivel">${o(['','Principiante','Intermedio','Avanzado'],e.nivel||'')}</select></label>
    <label class="full">Objetivo<input id="f-obj" value="${esc(e.objetivo||'')}" placeholder="Ej: hipertrofia tren inferior · rendimiento handball (arquero)"></label>
    <label>Posición<select id="f-pos"><option value="">—</option>${(S.cfg.posiciones||[]).map(p=>`<option ${p===e.posicion?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    <label class="full">Observaciones<textarea id="f-obs">${esc(e.obs||'')}</textarea></label>
    <p class="hint full cq-t">La mensualidad se calcula sola según gimnasio, estímulos y promo (tarifas en Ajustes).</p>
    <div class="full actions"><button class="btn pri" type="submit">${isNew?'Crear entrenado':'Guardar cambios'}</button>${isNew?'':'<button class="btn" type="button" data-mode="ver">Cancelar</button><button class="btn danger" type="button" id="delbtn" style="margin-left:auto">Eliminar ficha</button>'}</div>
  </form>`;
}
const FORMAS=[['efectivo','Efectivo'],['transferencia','Transferencia'],['mixto','Mixto']];
function partes(p){const m=Number(p.monto)||0;if(p.forma==='efectivo')return {ef:m,tr:0,nd:0};if(p.forma==='transferencia')return {ef:0,tr:m,nd:0};
  if(p.forma==='mixto'){const ef=Math.min(m,Number(p.efectivo)||0);return {ef,tr:m-ef,nd:0}}return {ef:0,tr:0,nd:m}}
function formaTxt(p){if(p.forma==='mixto'){const x=partes(p);return `Mixto: ${money(x.ef)} efectivo + ${money(x.tr)} transf.`}return p.forma==='efectivo'?'Efectivo':p.forma==='transferencia'?'Transferencia':''}
function porForma(pagos){const t={ef:0,tr:0,nd:0,fef:0,ftr:0,fnd:0};pagos.forEach(p=>{const x=partes(p),k=p.pctFran??1;t.ef+=x.ef;t.tr+=x.tr;t.nd+=x.nd;t.fef+=x.ef*k;t.ftr+=x.tr*k;t.fnd+=x.nd*k});return t}
function formasHTML(a){
  const M=a.mes,f=a.f||'all',ps=monthData(M).pagos.slice().sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')||(x.nombre||'').localeCompare(y.nombre||'','es'));
  const inF=p=>{const x=partes(p);return f==='all'||(f==='ef'&&x.ef>0)||(f==='tr'&&x.tr>0)||(f==='mx'&&p.forma==='mixto')||(f==='nd'&&x.nd>0)};
  const val=p=>{const x=partes(p);return f==='ef'?x.ef:f==='tr'?x.tr:f==='nd'?x.nd:Number(p.monto)||0};
  const L=ps.filter(inF),tot=L.reduce((a2,p)=>a2+val(p),0),tu=L.reduce((a2,p)=>a2+val(p)*(p.pctFran??1),0);
  const cnt=k=>ps.filter(p=>{const x=partes(p);return k==='all'||(k==='ef'&&x.ef>0)||(k==='tr'&&x.tr>0)||(k==='mx'&&p.forma==='mixto')||(k==='nd'&&x.nd>0)}).length;
  const chips=[['all','Todos'],['ef','Efectivo'],['tr','Transferencia'],['mx','Mixtos'],['nd','Sin forma']].filter(([k])=>k==='all'||cnt(k)).map(([k,l])=>`<button type="button" class="chip" data-formas="${k}" aria-pressed="${k===f}">${l} (${cnt(k)})</button>`).join('');
  const tag=p=>p.forma==='mixto'?`<span class="pill p-mute">Mixto</span> <span class="hint" style="display:inline">${money(partes(p).ef)} ef. + ${money(partes(p).tr)} transf.</span>`:p.forma==='efectivo'?'<span class="pill p-ok">Efectivo</span>':p.forma==='transferencia'?'<span class="pill p-lv">Transferencia</span>':'<span class="pill p-mute">Sin dato</span>';
  const tl=f==='all'?'Cobrado':f==='ef'?'En efectivo':f==='tr'?'Por transferencia':f==='mx'?'Pagos mixtos':'Sin forma cargada';
  return `<div class="chips" style="margin-bottom:12px">${chips}</div>
  <div class="fl-tot"><div><span>${tl}</span><b>${money(tot)}</b><small>${plural(L.length,'pago','pagos')}</small></div><div><span>Tu parte</span><b>${money(Math.round(tu))}</b><small>con el % de cada gimnasio</small></div></div>
  ${L.length?`<ul class="fl">${L.map(p=>`<li><div class="fl-a"><button class="fl-n" data-open="${esc(p.entrenadoId)}">${esc(S.ents[p.entrenadoId]?name(S.ents[p.entrenadoId]):(p.nombre||'—'))}</button><b>${money(val(p))}</b></div>
      <div class="fl-b"><span>${fmtShort(p.fecha)} · ${esc(GYM_LBL[p.gym]||p.gym||'')}</span>${tag(p)}<span class="fl-tu">tu parte ${money(Math.round(val(p)*(p.pctFran??1)))}</span></div></li>`).join('')}</ul>`:'<div class="empty">No hay pagos con esta forma en el mes.</div>'}
  ${f==='nd'?'<p class="hint" style="margin-top:10px">Son pagos cargados antes de que existiera la forma de pago. Si querés, podés borrarlos y volver a registrarlos indicando la forma.</p>':''}`;
}
function pagoHTML(e){
  const sug=(e.pagoRegistrado==='Debe'&&parse(e.proxVenc)&&parse(e.proxVenc)>=today())?e.proxVenc:addMonth(e.proxVenc||iso(today()));
  const um=unpaidMeses(e.id),cm=curMes();
  const opts=[...new Set([...um,mesShift(cm,-2),mesShift(cm,-1),cm,mesShift(cm,1)])].sort();
  const defM=um[0]||cm;
  return `<form id="pf" class="form card pad">
    <label class="full">Cuota del mes<select id="p-mes">${opts.map(k=>`<option value="${k}" ${k===defM?'selected':''}>${mesLbl(k)}${um.includes(k)&&k<cm?' · adeudada':''}</option>`).join('')}</select></label>
    <label>Fecha de pago<input id="p-fecha" type="date" value="${iso(today())}" required></label>
    <label>Monto abonado<input id="p-monto" type="number" min="0" step="any" value="${monto(e)}" required></label>
    <div class="full"><span class="lbl-s">Forma de pago</span><div class="chips" id="p-forma">${FORMAS.map(([k,l])=>`<button type="button" class="chip" data-forma="${k}" aria-pressed="${k==='efectivo'}">${l}</button>`).join('')}</div></div>
    <div class="full mixto" id="p-mix" hidden><label>En efectivo<input id="p-ef" type="number" min="0" step="any" value="0"></label><label>Por transferencia<input id="p-tr" type="number" min="0" step="any" value="${monto(e)}"></label><p class="hint full" id="p-mixh"></p></div>
    <label class="full">Nuevo vencimiento<input id="p-venc" type="date" value="${sug}" required></label>
    <p class="hint full">Vencimiento actual: ${fmtD(e.proxVenc)}. Al guardar, el estado pasa a “Al día” y el pago queda en el historial.</p>
    <div class="full actions"><button class="btn pri" type="submit">Confirmar pago</button><button class="btn" type="button" data-mode="ver">Cancelar</button></div>
  </form>`;
}
function composer(e,k,idp){
  return `<label class="full">Plantilla<select id="${idp}kind">${TEMPLATES.map(([v,l])=>`<option value="${v}" ${v===k?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="full">Mensaje para ${esc(firstName(e))} · ${esc(e.telefono)}<textarea id="${idp}text" style="min-height:130px">${esc(waText(e,k))}</textarea></label>`;
}
function waHTML(e,kind){
  const k=kind||waKind(e);
  return `<div class="card pad form">
    ${composer(e,k,'w-')}
    <p class="hint full">Redactá acá. Al tocar “Enviar”, WhatsApp se abre con el mensaje ya escrito: solo confirmás el envío. Queda registrado en el historial.</p>
    <div class="full actions"><a id="w-send" class="btn pri" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(waUrl(e,waText(e,k)))}">${WA.replace('<svg','<svg style="width:15px;height:15px;fill:currentColor;vertical-align:-3px"')} Enviar</a><button class="btn" id="w-copy" type="button">Copiar texto</button><button class="btn" type="button" data-mode="ver">Volver</button></div>
  </div>`;
}
function bulkHTML(){
  const b=bulk,e=S.ents[b.ids[b.i]];
  if(b.i>=b.ids.length||!e)return `<div class="card pad"><b>Listo: ${plural(b.sent,'mensaje enviado','mensajes enviados')}.</b><p class="hint">Cada envío quedó anotado en el historial del entrenado.</p><div class="actions" style="margin-top:10px"><button class="btn pri" data-close>Cerrar</button></div></div>`;
  return `<div class="step"><span>${b.title}</span><span>${b.i+1} de ${b.ids.length}</span></div>
  <div class="prog"><i style="width:${b.i/b.ids.length*100}%"></i></div>
  <div class="card pad form">
    <div class="full actions" style="align-items:center">${gymTag(e)}<b style="font-size:17px">${esc(name(e))}</b><span class="pill ${pagoPill(estadoPago(e))}">${estadoPago(e)}</span><span class="hint">${money(monto(e))} · vence ${fmtD(e.proxVenc)}</span></div>
    ${composer(e,b.kind,'b-')}
    <div class="full actions"><a id="b-send" class="btn pri" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(waUrl(e,waText(e,b.kind)))}">Enviar y seguir</a><button class="btn" id="b-skip" type="button">Saltear</button></div>
    <p class="hint full">Después de enviar en WhatsApp, volvé a esta pestaña: ya va a estar el siguiente.</p>
  </div>`;
}
function bindBulk(){
  const ov=$('#overlay');
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};
  const e=S.ents[bulk.ids[bulk.i]];if(!e||bulk.i>=bulk.ids.length)return;
  const sync=()=>{$('#b-send').href=waUrl(e,$('#b-text').value)};
  $('#b-kind').addEventListener('change',()=>{bulk.kind=$('#b-kind').value;$('#b-text').value=waText(e,bulk.kind);sync()});
  $('#b-text').addEventListener('input',sync);
  $('#b-send').addEventListener('click',()=>{const t=$('#b-text').value;logMsg(e,t);bulk.sent++;bulk.i++;setTimeout(renderSheet,300)});
  $('#b-skip').addEventListener('click',()=>{bulk.i++;renderSheet()});
}
function startBulk(key){
  const l=S._lists?.[key]||[];if(!l.length)return;
  const K={deuda:['vencido','Cobros pendientes'],prox:['pago','Vencen esta semana'],hoy:['pago','Vencen hoy'],ausentes:['ausencia','Sin entrenar']}[key]||['pago','Mensajes'];
  bulk={ids:l.map(e=>e.id),i:0,sent:0,kind:K[0],title:K[1]};
  openSheet('__bulk');
}
function logMsg(e,text){
  const short=text.length>140?text.slice(0,137)+'…':text;
  addHist(e.id,'Mensaje','WhatsApp: '+short);
}
function bindSheet(e,isNew){
  if(!isNew&&sheetMode==='ver')bindFichaRutinas(e);
  const ov=$('#overlay');
  ov.onclick=ev=>{
    if(ev.target===ov||ev.target.closest('[data-close]'))return closeSheet();
    const m=ev.target.closest('[data-mode]');if(m){setMode(m.dataset.mode,m.dataset.kindsel);return}
    const es=ev.target.closest('[data-estado]');if(es){setMode('estado',es.dataset.estado);return}
    if(ev.target.closest('[data-act="rutina"]'))return renovarRutina(e);
    const dh=ev.target.closest('[data-delh]');if(dh)return delHist(dh.dataset.delh,dh);
    const dp=ev.target.closest('[data-delp]');if(dp)return delPago(dp.dataset.delp,dp);
    const aw=ev.target.closest('[data-asw]');if(aw){S.asW=Math.min(0,(S.asW||0)+Number(aw.dataset.asw));S.asSec=null;renderSheet();return}
    const at=ev.target.closest('[data-astog]');if(at)return asisToggle(e,at);
    const rv=ev.target.closest('[data-regver]');if(rv){const k=rv.dataset.regver;S.regVer=S.regVer||{};if(S.regVer[k])delete S.regVer[k];else S.regVer[k]=1;S.regEd=null;renderSheet();return}
    const rt=ev.target.closest('[data-regtodo]');if(rt){const k=rt.dataset.regtodo;S.regVer[k]=S.regVer[k]==='todo'?1:'todo';renderSheet();return}
    const re=ev.target.closest('[data-reged]');if(re){S.regEd=re.dataset.reged;renderSheet();return}
    if(ev.target.closest('[data-regcancel]')){S.regEd=null;renderSheet();return}
    const rs=ev.target.closest('[data-regsave]');if(rs)return regGuardar(e,rs);
    const rd=ev.target.closest('[data-regdel]');if(rd)return regBorrar(rd);
    const lv=ev.target.closest('[data-limpver]');if(lv){S.limpVer=lv.dataset.limpver||null;renderSheet();return}
    const lp=ev.target.closest('[data-limpiar]');if(lp)return limpiarRut(e,lp);
  };
  ov.onchange=ev=>{const f=ev.target.closest('[data-asf]');if(f)return asisFecha(e,f);const sc=ev.target.closest('[data-assec]');if(sc){S.asSec=Number(sc.value);renderSheet()}};
  const ef=$('#ef');
  if(ef){
    const upd=()=>{const t={...e,cuota:'',gym:$('#f-gym').value,estimulos:Number($('#f-est').value),promo:Number($('#f-promo').value)};$('#f-monto').value=money(monto(t))};
    ['#f-gym','#f-est','#f-promo'].forEach(s=>$(s).addEventListener('change',upd));
    ef.querySelectorAll('button[data-cq]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.cq;$('#f-cuota').value=k;ef.dataset.cq=k;ef.querySelectorAll('button[data-cq]').forEach(x=>{x.setAttribute('aria-pressed',x===b);x.setAttribute('aria-checked',x===b)});if(k==='fijo')$('#f-fijo').focus()}));
    ef.addEventListener('submit',async ev=>{ev.preventDefault();
      const id=$('#f-id').value.trim().toUpperCase();
      if(isNew&&(!/^[A-Z0-9_-]{1,20}$/.test(id)||S.ents[id])){toast('Ese ID ya existe o no es válido');return}
      const tel=$('#f-tel').value.replace(/[^\d+]/g,'');
      const d={...(isNew?{}:e),id,nombre:$('#f-nombre').value.trim(),telefono:tel.startsWith('+')?tel:'+'+tel,gym:$('#f-gym').value,estado:$('#f-estado').value,plan:$('#f-plan').value.trim(),
        estimulos:Number($('#f-est').value),promo:Number($('#f-promo').value),ultPago:$('#f-ultpago').value,proxVenc:$('#f-venc').value,pagoRegistrado:$('#f-pago').value,
        modalidad:$('#f-mod').value,ultRutina:$('#f-rut').value,inicio:$('#f-inicio').value,obs:$('#f-obs').value.trim(),grupo:$('#f-grupo').value.trim(),posicion:$('#f-pos').value,perfil:$('#f-perfil').value,nivel:$('#f-nivel').value,objetivo:$('#f-obj').value.trim()};
      delete d.montoOnline;
      const cq=$('#f-cuota').value;d.cuota=cq;
      if(cq==='fijo'){const m=Number($('#f-fijo').value);if(!(m>0)){toast('Cargá el monto fijo');$('#f-fijo').focus();return}d.montoFijo=m}else delete d.montoFijo;
      if(cq==='sin'){d.cuotaMotivo=$('#f-cmot').value.trim();if(!d.avisoPago){d.avisoPago='no';d.avisoSinCuota=true}}else{delete d.cuotaMotivo;if(d.avisoSinCuota){delete d.avisoPago;delete d.avisoSinCuota}}
      if(!d.cuota)delete d.cuota;
      if(!isNew&&estado(e)!==d.estado)d.fechaEstado=iso(today());
      if(await write(()=>S.db.collection('entrenados').doc(id).set(d))){
        if(isNew)await addHist(id,'Otro','Alta en el CRM');
        else if(estado(e)!==d.estado)await addHist(id,'Estado',`Pasa a ${d.estado}`);
        toast(isNew?'Entrenado creado':'Cambios guardados');S.ents[id]=d;openId=id;setMode('ver');}
    });
    const del=$('#delbtn');
    if(del)del.addEventListener('click',async()=>{
      if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='Borra todo. Tocá de nuevo';setTimeout(()=>{if(del.isConnected){del.classList.remove('armed');del.textContent='Eliminar ficha'}},4000);return}
      if(await write(()=>S.db.collection('entrenados').doc(e.id).delete())){toast('Ficha eliminada');closeSheet()}
    });
  }
  const pf=$('#pf');
  if(pf){const mixH=()=>{const m=Number($('#p-monto').value)||0,ef=Number($('#p-ef').value)||0,tr=Number($('#p-tr').value)||0;$('#p-mixh').textContent=ef+tr===m?`Total ${money(m)} ✓`:`Efectivo + transferencia = ${money(ef+tr)} · el monto es ${money(m)}`;$('#p-mixh').style.color=ef+tr===m?'':'var(--bad)'};
    $('#p-forma').addEventListener('click',ev=>{const b=ev.target.closest('[data-forma]');if(!b)return;$('#p-forma').querySelectorAll('[data-forma]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#p-mix').hidden=b.dataset.forma!=='mixto';mixH()});
    $('#p-ef').addEventListener('input',()=>{const m=Number($('#p-monto').value)||0;$('#p-tr').value=Math.max(0,m-(Number($('#p-ef').value)||0));mixH()});
    $('#p-tr').addEventListener('input',mixH);
    $('#p-monto').addEventListener('input',()=>{const m=Number($('#p-monto').value)||0;$('#p-tr').value=Math.max(0,m-(Number($('#p-ef').value)||0));mixH()});}
  if(pf)pf.addEventListener('submit',async ev=>{ev.preventDefault();
    const f=$('#p-fecha').value,v=$('#p-venc').value,m=Number($('#p-monto').value)||0,mes=$('#p-mes').value,g=gymOf(e);
    if(S.pagos.some(p=>p.entrenadoId===e.id&&p.mes===mes)&&!$('#pf').dataset.dup){$('#pf').dataset.dup=1;toast('Ya tiene un pago en '+mesLbl(mes)+'. Tocá Confirmar de nuevo para sumarlo igual');return}
    const forma=($('#p-forma [aria-pressed=true]')||{}).dataset?.forma||'efectivo';let ef=forma==='efectivo'?m:forma==='mixto'?Number($('#p-ef').value)||0:0,tr=forma==='transferencia'?m:forma==='mixto'?Number($('#p-tr').value)||0:0;
    if(forma==='mixto'&&(ef+tr!==m||!ef||!tr)){toast(`En un pago mixto, efectivo + transferencia tiene que dar ${money(m)}`);return}
    if(!await write(()=>S.db.collection('pagos').add({entrenadoId:e.id,nombre:e.nombre,gym:g,fecha:f,monto:m,mes,pctFran:pctFran(g),forma,efectivo:ef,transferencia:tr,ts:Date.now()})))return;
    const rest=adeudados(e.id).filter(k=>k!==mes);
    if(await write(()=>S.db.collection('entrenados').doc(e.id).update({ultPago:f,proxVenc:v,pagoRegistrado:rest.length?'Debe':'Al día',ultMonto:m}))){
      await addHist(e.id,'Pago',`${money(m)} · ${formaTxt({forma,monto:m,efectivo:ef})} · cuota ${mesLbl(mes)} · próximo vencimiento ${fmtD(v)}`,f);
      toast('Pago registrado');setMode('ver');}
  });
  const esf=$('#esf');
  if(esf)esf.addEventListener('submit',async ev=>{ev.preventDefault();
    const target=sheetArg,f=$('#es-fecha').value,mot=$('#es-mot').value.trim();
    const d={estado:target,fechaEstado:f,motivoEstado:mot};
    if(target==='Activo'){const v=$('#es-venc').value;if(v)d.proxVenc=v;d.motivoEstado=''}
    if(await write(()=>S.db.collection('entrenados').doc(e.id).update(d))){
      await addHist(e.id,'Estado',({Suspendido:'Suspendido',Baja:'Dado de baja',Activo:'Reactivado'})[target]+(mot?': '+mot:''),f);
      toast(({Suspendido:'Entrenado suspendido',Baja:'Entrenado dado de baja',Activo:'Entrenado reactivado'})[target]);setMode('ver');}
  });
  const hf=$('#hf');
  if(hf)hf.addEventListener('submit',async ev=>{ev.preventDefault();
    const det=$('#hdet').value.trim();if(!det)return;
    if(await addHist(e.id,$('#htipo').value,det,$('#hfecha').value)){toast('Evento agregado');$('#hdet').value=''}
  });
  const wk=$('#w-kind');
  if(wk){
    const sync=()=>{$('#w-send').href=waUrl(e,$('#w-text').value)};
    wk.addEventListener('change',()=>{$('#w-text').value=waText(e,wk.value);sync()});
    $('#w-text').addEventListener('input',sync);
    $('#w-send').addEventListener('click',()=>{logMsg(e,$('#w-text').value);setTimeout(()=>{toast('Mensaje registrado en el historial');setMode('ver')},300)});
    $('#w-copy').addEventListener('click',()=>{const t=$('#w-text').value;const p=navigator.clipboard?.writeText(t);if(p)p.then(()=>toast('Texto copiado'),()=>{$('#w-text').select();toast('Seleccionado: copialo con Ctrl+C')});else $('#w-text').select()});
  }
}
async function renovarRutina(e){
  const d={ultRutina:iso(today())};
  if(['Cambiar','Planificar','Sin definir'].includes(e.modalidad))d.modalidad='Periodizada';
  if(await write(()=>S.db.collection('entrenados').doc(e.id).update(d))){await addHist(e.id,'Rutina','Rutina renovada');toast('Rutina renovada')}
}
async function addHist(id,tipo,detalle,fecha){
  return write(()=>S.db.collection('historial').add({entrenadoId:id,tipo,detalle,fecha:fecha||iso(today()),ts:Date.now()}));
}
async function delPago(pid,btn){
  if(btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.textContent='¿Seguro?';btn.style.color='var(--bad)';return}
  if(await write(()=>S.db.collection('pagos').doc(pid).delete()))toast('Pago borrado');
}
async function delHist(hid,btn){
  if(btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.textContent='¿Seguro?';btn.style.color='var(--bad)';return}
  if(await write(()=>S.db.collection('historial').doc(hid).delete()))toast('Evento borrado');
}
function nextId(){const n=Object.keys(S.ents).map(k=>parseInt(k.replace(/\D/g,''),10)).filter(x=>!isNaN(x));return 'E'+String((n.length?Math.max(...n):0)+1).padStart(3,'0')}
async function write(fn){
  if(!S.db){toast('No se puede guardar desde esta vista');return false}
  try{await fn();return true}
  catch(err){
    if(err&&err.code==='unavailable'){await new Promise(r=>setTimeout(r,400+Math.random()*600));try{await fn();return true}catch(e2){}}
    toast(err&&err.code==='invalid_argument'?'No tenés permiso para editar estos datos':'No se pudo guardar. Probá de nuevo.');return false}
}

/* ================== RUTINAS ================== */
const keyN=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const ruid=()=>Math.random().toString(16).slice(2,12);
const clone=o=>JSON.parse(JSON.stringify(o));
const ejByName=()=>{if(S._ejIdx&&S._ejIdxV===S.ejsV)return S._ejIdx;const m={};Object.entries(S.ejs).forEach(([id,e])=>m[keyN(e.nombre)]=id);S._ejIdx=m;S._ejIdxV=S.ejsV;return m};
const movs=()=>(S.cfg.rmDefs||[]).map(d=>d.mov);
function rmValue(e,mov,depth=0){
  if(!e||!mov||depth>5)return null;
  const v=Number((e.rm||{})[mov]);
  if(v>0)return v;
  const d=(S.cfg.rmDefs||[]).find(x=>x.mov===mov);
  if(d&&d.base){const b=rmValue(e,d.base,depth+1);return b?b*Number(d.factor||1):null}
  return null;
}
const mround=(x,step)=>{step=Number(step)||2.5;return Math.round(x/step)*step};
function kgItem(it,e){
  if(it.pct&&it.rm&&e){const rv=rmValue(e,it.rm);if(rv){const k=mround(rv*Number(it.pct)/100,S.cfg.redondeo);return {txt:String(+k.toFixed(2)),calc:true}}return {txt:'',calc:false,falta:true}}
  return {txt:it.kg||'',calc:false};
}
/* las rutinas de equipo activas van al final: «la rutina activa» del entrenado es siempre la propia si tiene una */
const rutDe=id=>{const a=S.rutinas.filter(r=>r.entrenadoId===id),eq=r=>r.equipo&&r.estado==='activa';return [...a.filter(r=>!eq(r)),...a.filter(eq)]};
const activaDe=id=>rutDe(id).filter(r=>r.estado==='activa').sort((a,b)=>(!!a.equipo)-(!!b.equipo)||(b.fechaEntrega||'').localeCompare(a.fechaEntrega||''))[0];
const colaDe=id=>rutDe(id).filter(r=>r.estado==='cola').sort((a,b)=>(a.fechaSugerida||'9').localeCompare(b.fechaSugerida||'9'));
const diasDe=r=>Math.max(0,...(r.secciones||[]).map(s=>(s.dias||[]).length));
function portalUrl(e){
  if(!e||!e.token)return '';
  let base=(S.cfg.appUrl||'').trim();
  if(!base)base=location.origin+location.pathname.replace(/[^/]*$/,'');
  if(!base.endsWith('/'))base+='/';
  return base+'entrenado.html?t='+e.token;
}
async function ensureToken(e){
  if(e.token)return e.token;
  const t=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(await write(()=>S.db.collection('entrenados').doc(e.id).update({token:t}))){e.token=t;return t}
  return '';
}
function rotacion(nDias,est,semanas){
  if(!nDias||!est||est>=nDias)return null;
  const out=[];let k=0;
  for(let w=0;w<(semanas||4);w++){const s=[];for(let j=0;j<est;j++){s.push(k%nDias);k++}out.push(s)}
  return out;
}
const semanaActual=r=>{const d=parse(r.fechaEntrega);return d?Math.floor(days(today(),d)/7):0};

/* ----- carga, bienestar y asistencia ----- */
const especial=r=>/^(asis|carga|bien):/.test(String(r.item||''));
function cargaDias(id){const m={};S.regs.filter(r=>r.entrenadoId===id&&r.tipo==='carga').forEach(r=>{const v=(Number(r.datos?.min)||0)*(Number(r.datos?.rpe)||0);if(v)m[r.fecha]=(m[r.fecha]||0)+v});return m}
function acwr(id,ref){
  const m=cargaDias(id);const end=ref?parse(ref):today();let ag=0,cr=0;
  for(let i=0;i<28;i++){const d=new Date(end);d.setDate(d.getDate()-i);const v=m[iso(d)]||0;if(i<7)ag+=v;cr+=v}
  const crs=cr/4;const ks=Object.keys(m).sort();const hist=ks.length&&days(end,parse(ks[0]))>=21;
  return {agudo:Math.round(ag),cronico:Math.round(crs),ratio:crs>0&&hist?ag/crs:null};
}
const acwrTxt=r=>r==null?'sin historial suficiente (se necesitan 3 semanas)':r>1.5?'carga muy alta, riesgo de sobrecarga':r>1.3?'en aumento':r<0.8?'carga baja':'zona adecuada';
const acwrPill=r=>r==null?'p-mute':r>S.cfg.alertas.acwr?'p-bad':r>1.3||r<0.8?'p-warn':'p-ok';
/* wellness: 5 preguntas de 1 a 5 (las respuestas viejas traen "cuerpo", que cuenta como dolor) */
const BK=[['sueno','Sueño'],['fatiga','Energía'],['dolor','Dolor'],['estres','Estrés'],['animo','Ánimo']];
function bienVals(d){const o={};BK.forEach(([k])=>{let v=Number(d?.[k]);if(!v&&k==='dolor')v=Number(d?.cuerpo);if(v)o[k]=v});return o}
function bienProm(d){const v=Object.values(bienVals(d));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null}
const bienTot=d=>{const m=bienProm(d);return m==null?0:+m.toFixed(1)};
function bienEstado(d,hist){const v=Object.values(bienVals(d));if(!v.length)return null;const m=bienProm(d);
  const hs=(hist||[]).map(bienProm).filter(x=>x!=null);const base=hs.length>=7?hs.reduce((a,b)=>a+b,0)/hs.length:null;const mn=Math.min(...v),dif=base!=null?+(m-base).toFixed(2):0;
  return {k:(mn<=1||(base!=null?dif<-1:m<3))?'rojo':(mn<=2||(base!=null?dif<-0.5:m<4))?'amarillo':'verde',m:+m.toFixed(1),base:base!=null?+base.toFixed(1):null}}
function estadoBien(eid,fecha){const r=S.regs.find(x=>x.entrenadoId===eid&&x.tipo==='bien'&&x.fecha===fecha);if(!r)return null;if(r.datos?.estado)return {k:r.datos.estado,m:r.datos.prom,base:r.datos.base??null};
  const d0=new Date(parse(fecha));d0.setDate(d0.getDate()-28);const ini=iso(d0);return bienEstado(r.datos,S.regs.filter(x=>x.entrenadoId===eid&&x.tipo==='bien'&&x.fecha<fecha&&x.fecha>=ini).map(x=>x.datos))}
const EST={verde:['Óptimo','p-ok',0],amarillo:['Moderado','p-warn',-5],rojo:['Bajo','p-bad',-10]};
const bienTxt=d=>{const v=bienVals(d);return BK.filter(([k])=>v[k]).map(([k,l])=>`${l} ${v[k]}`).join(' · ')+(Object.keys(v).length?` · prom. ${bienTot(d)}`:'')};
/* kg que correspondía ese día (con el ajuste por wellness si la rutina lo usa) */
function kgDia(it,e,fecha,rid){const k=kgItem(it,e);const r=rid&&S.rutinas.find(x=>x._id===rid);if(!r?.ajusteWellness||!(it.pct&&it.rm)||!k.calc)return k.txt;
  const st=estadoBien(e.id,fecha);if(!st||st.k==='verde')return k.txt;return kgItem({...it,pct:Math.max(0,Number(it.pct)+EST[st.k][2])},e).txt}
function ultAsis(id){return S.regs.filter(r=>r.entrenadoId===id&&String(r.item||'').startsWith('asis:')).map(r=>r.fecha).sort().pop()||null}
function ausentes(){
  const n=S.cfg.alertas.dias;
  return Object.values(S.ents).filter(isAct).map(e=>{const u=ultAsis(e.id);return {e,ult:u,d:u?days(today(),parse(u)):null}})
    .filter(x=>x.ult&&x.d>=n&&activaDe(x.e.id)).sort((a,b)=>b.d-a.d);
}
function semanasDe(ini,fin){const out=[];const d=new Date(ini);d.setDate(d.getDate()-((d.getDay()+6)%7));while(d<=fin){const a=new Date(d),b=new Date(d);b.setDate(b.getDate()+6);out.push([a,b]);d.setDate(d.getDate()+7)}return out}
function mesesDe(e){const s=new Set(mesesList());S.regs.forEach(r=>{if(r.entrenadoId===e.id&&r.fecha)s.add(r.fecha.slice(0,7))});return [...s].filter(k=>k<=curMes()).sort().reverse()}
function periodoData(e,M,corto){
  const [y,m]=M.split('-').map(Number);const ini=new Date(y,m-1,1),fin=new Date(y,m,0);const iI=iso(ini),iF=iso(fin);
  const regs=S.regs.filter(r=>r.entrenadoId===e.id&&r.fecha>=iI&&r.fecha<=iF);
  const sem=semanasDe(ini,fin).map(([a,b])=>[a<ini?ini:a,b>fin?fin:b]);const est=Number(e.estimulos)||0;
  const asis=regs.filter(r=>String(r.item||'').startsWith('asis:'));
  const cnt=(a,b)=>new Set(asis.filter(r=>r.fecha>=iso(a)&&r.fecha<=iso(b)).map(r=>r.fecha+r.item)).size;
  const cr=regs.filter(r=>r.tipo==='carga');const cd=cargaDias(e.id);
  const rpe=[0,0,0,0];cr.forEach(r=>{const v=Number(r.datos?.rpe)||0;if(v)rpe[v<=4?0:v<=6?1:v<=8?2:3]++});
  const bl=regs.filter(r=>r.tipo==='bien');const avg=k=>bl.length?+(bl.reduce((s2,r)=>s2+(Number(r.datos?.[k])||0),0)/bl.length).toFixed(1):0;
  const avgK=k=>{const v=bl.map(r=>bienVals(r.datos)[k]).filter(Boolean);return v.length?+(v.reduce((a2,b2)=>a2+b2,0)/v.length).toFixed(1):0};
  const bien={n:bl.length};BK.forEach(([k])=>bien[k]=avgK(k));bien.tot=bl.length?+(bl.reduce((s2,r)=>s2+bienTot(r.datos),0)/bl.length).toFixed(1):0;
  bien.est={verde:0,amarillo:0,rojo:0};bl.forEach(r=>{const st=estadoBien(e.id,r.fecha);if(st)bien.est[st.k]++});
  return {M,corto,hechos:new Set(asis.map(r=>r.fecha+r.item)).size,meta:Math.round(est*(fin.getDate()/7)),
    semanas:sem.map(([a,b])=>({lbl:fmtShort(iso(a)),v:cnt(a,b)})),
    carga:Math.round(cr.reduce((s2,r)=>s2+(Number(r.datos?.min)||0)*(Number(r.datos?.rpe)||0),0)),sesiones:cr.length,rpe,bien,
    bienSem:sem.map(([a,b])=>{const x=bl.filter(r=>r.fecha>=iso(a)&&r.fecha<=iso(b));return x.length?+(x.reduce((s2,r)=>s2+bienTot(r.datos),0)/x.length).toFixed(1):null}),
    cargaSem:sem.map(([a,b])=>{let v=0;for(const k in cd)if(k>=iso(a)&&k<=iso(b))v+=cd[k];const ac=acwr(e.id,iso(b));return {lbl:fmtShort(iso(a)),v:Math.round(v),acwr:ac.ratio}}),
    ini:iI,fin:iF};
}
const UNI_RE=/\b(cmj|sj|abalakov|drop ?jump|salto vertical|salto horizontal|salto largo|salto en largo|multisaltos?)\b/i;
const UNIS=[['kg','Kg'],['cm','Cm'],['m','Metros'],['seg','Seg'],['reps','Reps']];
const uniDe=it=>(it&&it.unidad)||(it&&it.ej&&S.ejs[it.ej]?.unidad)||(UNI_RE.test(String(it?.nombre||''))?'cm':'kg');
const numKg=v=>parseFloat(String(v??'').replace(',','.'));
const repsN=v=>{const m=String(v??'').match(/\d+/);return m?Number(m[0]):null};
/* kg por ejercicio y día: lo que anotó el entrenado y, los días que marcó asistencia sin anotar, lo que indicaba la rutina */
function kgPorEj(e,iI,iF){const g={};const rs=S.regs.filter(r=>r.entrenadoId===e.id&&r.fecha>=iI&&r.fecha<=iF);
  const put=(k,nombre,fecha,kg,reps,plan,u)=>{if(!(kg>0))return;(g[k]=g[k]||{nombre,u:u||'kg',p:{}});const o=g[k].p[fecha];if(!o||kg>o.kg||(kg===o.kg&&(repsN(reps)||0)>(repsN(o.reps)||0)))g[k].p[fecha]={kg,reps:String(reps||''),plan}};
  const hecho=new Set();
  rs.filter(r=>!especial(r)).forEach(r=>{hecho.add(r.item+'|'+r.fecha);const it=r.rutinaId?itemDe(r.rutinaId,r.item):null;put(r.ej||it?.ej||keyN(r.nombre||it?.nombre||r.item),r.nombre||it?.nombre||'Ejercicio',r.fecha,numKg(r.kg),r.reps||it?.reps,false,uniDe(it||{nombre:r.nombre,ej:r.ej}))});
  rs.filter(r=>String(r.item||'').startsWith('asis:')).forEach(a=>{const dia=diaDe(a.rutinaId,a.item.slice(5));if(!dia)return;
    dia.bloques.forEach(b=>b.items.forEach(it=>{if(!String(it.nombre||'').trim()||hecho.has(it.uid+'|'+a.fecha))return;put(it.ej||keyN(it.nombre),it.nombre,a.fecha,numKg(kgDia(it,e,a.fecha,a.rutinaId)),it.reps,true,uniDe(it))}))});
  /* el resumen de fuerza es en kg: los saltos (cm), tiempos o metros no se mezclan */
  for(const k in g)if(g[k].u!=='kg')delete g[k];
  return g}
function diaDe(rid,uid){const r=S.rutinas.find(x=>x._id===rid);for(const s of r?.secciones||[])for(const d of s.dias||[])if(d.uid===uid)return d;return null}
function itemDe(rid,uid){const r=S.rutinas.find(x=>x._id===rid);for(const s of r?.secciones||[])for(const d of s.dias||[])for(const b of d.bloques||[])for(const i of b.items||[])if(i.uid===uid)return i;return null}
function resumenData(e,M,vs){
  const ms=vs?[M,vs].sort():[M];const two=ms.length===2;
  const yrs=new Set(ms.map(k=>k.slice(0,4))).size>1;
  const corto=k=>{const [y,m]=k.split('-').map(Number);return MESES_N[m-1]+(yrs?' '+y:'')};
  const P=ms.map(k=>periodoData(e,k,corto(k)));
  let kg=[];
  const best=o=>Object.values(o).reduce((m,x)=>!m||x.kg>m.kg||(x.kg===m.kg&&(repsN(x.reps)||0)>(repsN(m.reps)||0))?x:m,null);
  const mod=o=>Object.values(o).filter(x=>!x.plan).length;
  if(two){const g1=kgPorEj(e,P[0].ini,P[0].fin),g2=kgPorEj(e,P[1].ini,P[1].fin);
    kg=Object.keys(g2).filter(k=>g1[k]).map(k=>{const A=best(g1[k].p),B=best(g2[k].p);return {nombre:g2[k].nombre,a:A.kg,b:B.kg,ar:A.reps,br:B.reps,n:Object.keys(g1[k].p).length+Object.keys(g2[k].p).length,mod:mod(g1[k].p)+mod(g2[k].p)}})}
  else{const g=kgPorEj(e,P[0].ini,P[0].fin);kg=Object.values(g).map(x=>{const pts=Object.entries(x.p).sort((a,b)=>a[0].localeCompare(b[0]));const B=best(x.p);return {nombre:x.nombre,a:pts[0][1].kg,ar:pts[0][1].reps,b:B.kg,br:B.reps,n:pts.length,mod:mod(x.p)}})}
  kg.sort((a,b)=>(b.b-b.a)/b.a-(a.b-a.a)/a.a);
  const fuerzaPct=kg.length?+(kg.reduce((s2,k)=>s2+(k.b-k.a)/k.a,0)/kg.length*100).toFixed(1):null;
  const carga=P.flatMap((q,i)=>q.cargaSem.map(c=>({...c,p:i})));
  const a=activaDe(e.id);
  const sub=[e.grupo,e.estimulos?`${e.estimulos} entrenamientos por semana`:'',a?'Rutina: '+a.nombre:''].filter(Boolean).join(' · ');
  const vacio=!P.some(q=>q.hechos||q.carga||q.bien.n)&&!kg.length?'Todavía no hay datos anotados en el link para este período.':'';
  return {titulo:two?`Comparativa: ${mesLbl(ms[0])} vs ${mesLbl(ms[1])}`:`Resumen de ${mesLbl(M)}`,sub,periodos:P,kg,kgLbls:['Primer día del mes','Mejor del mes'],fuerzaPct,carga,metaSem:Number(e.estimulos)||0,umbral:S.cfg.alertas.acwr,vacio,generado:fmtD(iso(today()))};
}
function nombreResumen(e,M,vs){const t=vs?`Comparativa ${[M,vs].sort().map(mesLbl).join(' vs ')}`:`Resumen ${mesLbl(M)}`;return (t+' - '+name(e)).replace(/[\\/:*?"<>|]+/g,' ')+'.pdf'}
function descargarReportes(ids,M,vs){
  const es=ids.map(id=>S.ents[id]).filter(Boolean);if(!es.length){toast('Elegí al menos un entrenado');return}
  if(vs&&vs===M){toast('Elegí dos meses distintos para comparar');return}
  try{
    const files=es.map(e=>({name:nombreResumen(e,M,vs),data:RutinaPDF.resumen(e,resumenData(e,M,vs))}));
    if(files.length===1){RutinaPDF.download(files[0].data,files[0].name,'application/pdf');toast('Hoja resumen descargada');return}
    RutinaPDF.download(RutinaPDF.zip(files),`${vs?'Comparativas':'Resumenes'} ${mesLbl(M)}.zip`,'application/zip');toast(`${files.length} hojas descargadas en un .zip`);
  }catch(err){console.error(err);toast('No se pudo generar la hoja resumen')}
}

/* ----- rutinas sin terminar ----- */
/* ----- bloques de distancias: metros × reps × pausa / metros en X seg ----- */
function distSeg(v){v=String(v??'').trim().replace(/,/g,'.').replace(/’|´/g,"'").replace(/”|''/g,'"');if(!v)return null;let m;
  if(m=v.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*(?:"|s)?)?$/))return Number(m[1])*60+Number(m[2]||0);
  if(m=v.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/))return Number(m[1])*60+Number(m[2]);
  if(m=v.match(/^(\d+(?:\.\d+)?)\s*(?:"|s|seg|segs|segundos)?$/i))return Number(m[1]);
  if(m=v.match(/^(\d+(?:\.\d+)?)\s*(?:min|mins|minutos)$/i))return Number(m[1])*60;return null}
function distFmtT(s){if(s==null)return '';if(s<60)return (Math.round(s*10)/10)+'"';const mi=Math.floor(s/60),r=Math.round(s-mi*60);return r?`${mi}'${String(r).padStart(2,'0')}"`:`${mi}'`}
const distT=v=>{const s=distSeg(v);return s==null?String(v??'').trim():distFmtT(s)};
const distM=v=>(String(v??'').match(/\d+(?:[.,]\d+)?/g)||[]).reduce((a,x)=>a+Number(x.replace(',','.')),0);
const distMil=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function distPace(it){const m=String(it.metros||'').trim(),t=distSeg(it.tiempo);if(!/^\d+(?:[.,]\d+)?$/.test(m)||!t)return '';const mm=Number(m.replace(',','.'));if(mm<400)return '';return distFmtT(t/mm*1000)+'/km'}
function distParts(it){const reps=parseInt(it.reps)||0,m=String(it.metros||'').trim();
  return {vol:m?((reps>1?reps+' × ':'')+m+' m'):(reps?reps+' reps':''),en:String(it.tiempo||'').trim()?'en '+distT(it.tiempo):'',pausa:String(it.pausa||'').trim()?'pausa '+distT(it.pausa):'',ritmo:distPace(it)}}
function distTxt(it){const p=distParts(it);return [p.vol+(p.en?' '+p.en:''),p.pausa,p.ritmo].filter(Boolean).join(' · ')}
function distTot(b){const ser=Math.max(1,parseInt(b.series)||1);return (b.items||[]).reduce((a,i)=>a+distM(i.metros)*Math.max(1,parseInt(i.reps)||1),0)*ser}
function distBlk(b){const ser=parseInt(b.series)||0,tot=distTot(b);return [ser>1?ser+' series':'',ser>1&&String(b.pausaSeries||'').trim()?'entre series '+distT(b.pausaSeries):'',tot?'total '+distMil(tot)+' m':''].filter(Boolean).join(' · ')}
const itemVacio=i=>!['nombre','reps','kg','pct','notas','metros','tiempo','pausa'].some(k=>String(i[k]??'').trim());
function faltantes(r){
  const out=[];
  (r.secciones||[]).forEach((s,si)=>(s.dias||[]).forEach((d,di)=>{
    let sinReps=0,sinEj=0;const vac=[];let tot=0;
    (d.bloques||[]).forEach(b=>{const v=(b.items||[]).filter(i=>!itemVacio(i));tot+=v.length;if(!v.length)vac.push(b.nombre||'bloque');
      v.forEach(i=>{if(!String(i.nombre||'').trim())sinEj++;else if(b.modo==='dist'?!String(i.metros||'').trim():(b.modo!=='timer'&&b.modo!=='test'&&!String(i.reps||'').trim()))sinReps++})});
    const p=[];
    if(!tot)p.push('sin ejercicios');
    else{if(sinEj)p.push(plural(sinEj,'fila sin ejercicio','filas sin ejercicio'));if(sinReps)p.push(plural(sinReps,'ejercicio sin reps','ejercicios sin reps'));if(vac.length)p.push((vac.length===1?'bloque vacío: ':'bloques vacíos: ')+vac.map(x=>titleCase(x)).join(', '))}
    if(p.length)out.push({si,di,lugar:((r.secciones.length>1&&s.titulo)?s.titulo+' · ':'')+(d.nombre||'Día '+(di+1)),txt:p.join(' · ')});
  }));
  return out;
}
const sinTerminar=()=>S.rutinas.filter(r=>(r.estado==='cola'||r.estado==='activa')&&S.ents[r.entrenadoId]&&isAct(S.ents[r.entrenadoId])&&faltantes(r).length);
const faltaPill=r=>faltantes(r).length?' <span class="pill p-bad">Sin terminar</span>':'';
function sinTerminarCard(compact){
  const l=sinTerminar();if(!l.length)return compact?'':'';
  return `<div class="card falta-card"><div class="pad" style="padding-bottom:6px"><b>Rutinas sin terminar</b> <span class="pill p-bad">${l.length}</span><p class="hint">Les falta ejercicio o repeticiones en algún día. Los kg pueden quedar vacíos.</p></div>
    <ul class="alist">${l.map(r=>{const e=S.ents[r.entrenadoId];const f=faltantes(r);return `<li><span class="nm" style="white-space:normal"><b>${esc(name(e))}</b> · ${esc(r.nombre||'Rutina')} <span class="pill ${r.estado==='activa'?'p-ok':'p-warn'}">${r.estado==='activa'?'Activa':'En cola'}</span><br>${f.slice(0,compact?2:6).map(x=>`<span class="hint">${esc(x.lugar)}: ${esc(x.txt)}</span>`).join('<br>')}${f.length>(compact?2:6)?`<br><span class="hint">y ${f.length-(compact?2:6)} más…</span>`:''}</span><button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Completar</button></li>`}).join('')}</ul></div>`;
}

/* ----- tablero de entregas ----- */
function entregasData(){
  const t=iso(today());
  const cola=S.rutinas.filter(r=>r.estado==='cola'&&S.ents[r.entrenadoId]&&isAct(S.ents[r.entrenadoId]));
  const listas=cola.filter(r=>(r.fechaSugerida||t)<=t).sort((a,b)=>(a.fechaSugerida||'').localeCompare(b.fechaSugerida||''));
  const espera=cola.filter(r=>(r.fechaSugerida||t)>t).sort((a,b)=>(a.fechaSugerida||'').localeCompare(b.fechaSugerida||''));
  const conCola=new Set(cola.map(r=>r.entrenadoId));
  const sinProx=Object.values(S.ents).filter(e=>isAct(e)&&!conCola.has(e.id)).map(e=>({e,a:activaDe(e.id)}))
    .sort((x,y)=>(x.a?.fechaEntrega||'0').localeCompare(y.a?.fechaEntrega||'0'));
  return {listas,espera,sinProx};
}
/* estado del plan de cada entrenado (rutina + pago) */
function estadoPlan(e){const t=iso(today()),a=activaDe(e.id),c=colaDe(e.id),lista=c.find(r=>(r.fechaSugerida||t)<=t),esp=c.find(r=>(r.fechaSugerida||t)>t);
  let k,txt,cls,sub='';
  if(lista){k='entregar';txt='Para entregar';cls='p-ok';sub=lista.nombre||'Rutina'}
  else if(a){const dur=Number(a.duracionSemanas)||4,fin=new Date(parse(a.fechaEntrega)||today());fin.setDate(fin.getDate()+dur*7);const resta=days(fin,today());
    sub=`${a.nombre||'Rutina'} · semana ${Math.min(dur,semanaActual(a)+1)} de ${dur}`;
    if(resta<0){k='vencida';txt=`Terminó hace ${-resta} d`;cls='p-bad'}else if(resta<=7){k='porterminar';txt=`Termina en ${resta} d`;cls='p-warn'}else{k='activa';txt='Activa';cls='p-ok'}}
  else if(esp){k='espera';txt='En espera';cls='p-warn';sub=`${esp.nombre||'Rutina'} · ${fmtShort(esp.fechaSugerida)}`}
  else{k='sin';txt='Sin rutina';cls='p-mute';sub=e.ultRutina?'últ. '+fmtShort(e.ultRutina):''}
  const prox=esp&&k!=='espera'?`Próxima: ${fmtShort(esp.fechaSugerida)}`:'';
  return {k,txt,cls,sub,prox}}
function pagoMes(e){const M=curMes();const ps=S.pagos.filter(p=>p.entrenadoId===e.id&&p.mes===M).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));return ps[0]||null}
const PLAN_F=[['todos','Todos'],['activa','Activa'],['porterminar','Por terminar'],['vencida','Rutina terminada'],['entregar','Para entregar'],['espera','En espera'],['sin','Sin rutina']];
const PAGO_F=[['todos','Todos'],['Pagó','Pagaron este mes'],['Al día','Al día sin pago del mes'],['Pendiente','Pendientes'],['Vencido','Vencidos']];
const pagoEst=e=>pagoMes(e)?'Pagó':estadoPago(e);
const pagoEstPill=k=>k==='Pagó'?'p-ok':pagoPill(k);
function listadoPlanHTML(){
  const fp=S.lpPago||'todos',fr=S.lpPlan||'todos',fg=S.lpGym||'todos';
  const okG=e=>fg==='todos'||gymOf(e)===fg;
  const rows=Object.values(S.ents).filter(e=>isAct(e)&&okG(e)).map(e=>({e,pl:estadoPlan(e),pg:pagoEst(e),pm:pagoMes(e),ch:cambiosDe(e,7).filter(x=>x.cambio).length})).sort((a,b)=>name(a.e).localeCompare(name(b.e),'es'));
  const cP=k=>rows.filter(x=>(k==='todos'||x.pg===k)&&(fr==='todos'||x.pl.k===fr)).length,cR=k=>rows.filter(x=>(fp==='todos'||x.pg===fp)&&(k==='todos'||x.pl.k===k)).length;
  const L=rows.filter(x=>(fp==='todos'||x.pg===fp)&&(fr==='todos'||x.pl.k===fr));
  const cG=k=>Object.values(S.ents).filter(e=>isAct(e)&&(k==='todos'||gymOf(e)===k)).length;
  return `<div class="card pad lp-f"><div><span class="lbl-s">Gimnasio</span><div class="chips">${[['todos','Todos'],['LEVEL','LEVEL'],['CROSSFORCE','CrossForce'],['ONLINE','Online']].filter(([k])=>k==='todos'||cG(k)).map(([k,l])=>`<button class="chip" data-lpgym="${k}" aria-pressed="${k===fg}">${l} (${cG(k)})</button>`).join('')}</div></div>
    <div><span class="lbl-s">Pago del mes</span><div class="chips">${PAGO_F.map(([k,l])=>`<button class="chip" data-lppago="${k}" aria-pressed="${k===fp}">${l} (${cP(k)})</button>`).join('')}</div></div>
    <div><span class="lbl-s">Estado de la rutina</span><div class="chips">${PLAN_F.filter(([k])=>k==='todos'||cR(k)).map(([k,l])=>`<button class="chip" data-lpplan="${k}" aria-pressed="${k===fr}">${l} (${cR(k)})</button>`).join('')}</div></div></div>
  <p class="count">${plural(L.length,'entrenado','entrenados')}</p>
  <div class="card tbl-wrap"><table class="lp"><thead><tr><th>Entrenado</th><th>Pago del mes</th><th>Rutina</th><th>Cambios del entrenado</th><th></th></tr></thead><tbody>
  ${L.map(({e,pl,pg,pm,ch})=>`<tr><td><button class="fl-n" data-open="${esc(e.id)}">${esc(name(e))}</button><div class="hint">${gymTag(e)} ${e.estimulos?e.estimulos+' estímulos':''}</div></td>
    <td><span class="pill ${pagoEstPill(pg)}">${pg}</span><div class="hint">${pm?`${fmtShort(pm.fecha)} · ${money(pm.monto)}${pm.forma?' · '+esc(pm.forma):''}`:pg==='Vencido'?'venció '+fmtShort(e.proxVenc):'vence '+fmtShort(e.proxVenc)}</div></td>
    <td><span class="pill ${pl.cls}">${esc(pl.txt)}</span><div class="hint">${esc(pl.sub)}${pl.prox?' · '+esc(pl.prox):''}</div></td>
    <td>${ch?`<span class="pill p-warn">${ch} esta semana</span>`:'<span class="hint">—</span>'}</td>
    <td class="lp-a">${pl.k==='entregar'?`<button class="wa" data-entregar="${esc(colaDe(e.id)[0]._id)}">Entregar</button>`:pl.k==='sin'||pl.k==='vencida'||pl.k==='porterminar'?`<button class="btn" style="padding:5px 10px;font-size:13px" data-asignar="" data-para="${esc(e.id)}">Planificar</button>`:activaDe(e.id)?`<button class="btn" style="padding:5px 10px;font-size:13px" data-editrut="${esc(activaDe(e.id)._id)}">Abrir rutina</button>`:''}</td></tr>`).join('')||`<tr><td colspan="5" class="empty">Nadie en este filtro.</td></tr>`}
  </tbody></table></div>`;
}
/* cambios que hizo el entrenado respecto de lo indicado */
function cambiosDe(e,dias){const desde=dias?iso(new Date(today().getTime()-dias*864e5)):'';
  return S.regs.filter(r=>r.entrenadoId===e.id&&!especial(r)&&(!desde||r.fecha>=desde)).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')||(y.ts||0)-(x.ts||0)).map(r=>{
    const it=r.rutinaId?itemDe(r.rutinaId,r.item):null;const pk=it?kgDia(it,e,r.fecha,r.rutinaId):'',pr=it?String(it.reps||''):'';
    const dk=!!(it&&String(r.kg||'').trim()&&numKg(r.kg)!==numKg(pk)),dr=!!(it&&String(r.reps||'').trim()&&String(r.reps).trim().toLowerCase()!==pr.trim().toLowerCase());
    const nota=r.nota&&r.nota!=='Hecho'?r.nota:'';return {r,it,pk,pr,dk,dr,nota,c:r.cansancio,cambio:dk||dr||!!nota||!!r.cansancio,nombre:r.nombre||it?.nombre||'Ejercicio'}})}
function cambiosHTML(e){
  const all=cambiosDe(e,30),ch=all.filter(x=>x.cambio),ver=S.verCambios===e.id,L=ver?ch:ch.slice(0,8);
  const nk=new Set(ch.filter(x=>x.dk).map(x=>x.r.item)).size,nr=new Set(ch.filter(x=>x.dr).map(x=>x.r.item)).size,nn=ch.filter(x=>x.nota).length;
  if(!all.length)return '';
  return `<div class="pad" style="border-top:1px solid var(--line)"><b style="font-size:14px">Cambios del entrenado en la rutina</b><p class="hint" style="margin:2px 0 8px">Lo que modificó respecto de lo que indicaste, en los últimos 30 días.</p>
    <div class="chips" style="gap:6px"><span class="pill p-mute">${plural(all.length,'ejercicio tildado','ejercicios tildados')}</span>${nk?`<span class="pill p-warn">Kg distinto en ${plural(nk,'ejercicio','ejercicios')}</span>`:''}${nr?`<span class="pill p-warn">Reps distintas en ${nr}</span>`:''}${nn?`<span class="pill p-lv">${plural(nn,'comentario','comentarios')}</span>`:''}</div></div>
    ${ch.length?`<ul class="timeline ch-tl">${L.map(x=>`<li><span class="d">${fmtShort(x.r.fecha)}</span><span class="t"><b>${esc(x.nombre)}</b>${x.dk?` · Kg <s>${esc(x.pk||'—')}</s> → <b class="ch-v">${esc(x.r.kg)}</b>`:''}${x.dr?` · Reps <s>${esc(x.pr||'—')}</s> → <b class="ch-v">${esc(x.r.reps)}</b>`:''}${x.c?` · Cansancio <b>${x.c}</b>`:''}${x.nota?` · <i>“${esc(x.nota)}”</i>`:''}</span><span></span></li>`).join('')}</ul>
      ${ch.length>8?`<div class="pad" style="padding-top:0"><button class="btn" style="padding:5px 10px;font-size:13px" data-vercambios="${ver?'':esc(e.id)}">${ver?'Ver menos':'Ver los '+ch.length+' cambios'}</button></div>`:''}`:'<div class="pad hint" style="padding-top:0">Hizo todo como lo indicaste.</div>'}`;
}
function entBadge(it,path,e,tm){const rs=S.regs.filter(r=>r.entrenadoId===e.id&&r.item===it.uid).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||''));const r=rs[0];if(!r)return '';
  const pk=kgDia(it,e,r.fecha,r.rutinaId),dk=String(r.kg||'').trim()&&numKg(r.kg)!==numKg(pk),dr=!tm&&String(r.reps||'').trim()&&String(r.reps).trim().toLowerCase()!==String(it.reps||'').trim().toLowerCase();
  if(!dk&&!dr)return `<div class="it-ent ok">✓ El entrenado lo hizo como indicaste (${fmtShort(r.fecha)})</div>`;
  return `<div class="it-ent">El entrenado usó ${dr?`<b>${esc(r.reps)}${/\d$/.test(String(r.reps).trim())?' reps':''}</b>`:''}${dr&&dk?' × ':''}${dk?`<b>${esc(r.kg)} kg</b>`:''} el ${fmtShort(r.fecha)}${rs.length>1?` · ${rs.length} registros`:''}<button type="button" data-act="usarEnt" data-p="${path}" data-kg="${dk?esc(r.kg):''}" data-reps="${dr?esc(r.reps):''}">Usar en la rutina</button></div>`}
function entregasCard(){
  const {listas}=entregasData();
  return `<div class="card"><div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Rutinas para entregar</b><button class="btn" style="padding:5px 10px;font-size:13px" data-goto="rutinas">Ver tablero</button></div>
    ${listas.length?`<ul class="alist">${listas.slice(0,8).map(r=>`<li><button class="nm" data-open="${esc(r.entrenadoId)}">${esc(name(S.ents[r.entrenadoId]))}</button><span class="meta">${esc(r.nombre||'Rutina')}</span><button class="wa" data-entregar="${esc(r._id)}">Entregar</button></li>`).join('')}</ul>`:'<div class="empty">No hay rutinas listas para entregar.</div>'}</div>`;
}
const SUBS=[['entregas','Entregas'],['plantillas','Plantillas'],['imprimir','Imprimir'],['biblioteca','Biblioteca de videos']];
function renderRutinas(){
  const el=$('#v-rutinas');
  if(!S.loaded){el.innerHTML='<div class="card empty">Cargando…</div>';return}
  S.rsub=S.rsub||'entregas';
  let body='';
  if(S.rsub==='entregas'){
    const {listas,espera,sinProx}=entregasData();
    const rowR=(r,btns)=>{const e=S.ents[r.entrenadoId];return `<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}${pgP(e)}<br><span class="hint">${esc(r.nombre||'Rutina')}${r.fechaSugerida?' · '+fmtShort(r.fechaSugerida):''}${faltaPill(r)}${r.pospuesta?.motivo?' · '+esc(r.pospuesta.motivo):''}</span></button>${btns}</li>`};
    const vista=S.evista||'tablero';
    const fp='todos',okP=r=>{const e=S.ents[r.entrenadoId||r.id];return fp==='todos'||(e&&pagoEst(e)===fp)};
    const cnt=k=>Object.values(S.ents).filter(e=>isAct(e)&&(k==='todos'||pagoEst(e)===k)).length;
    const pgP=e=>{const pg=pagoEst(e);return ` <span class="pill ${pagoEstPill(pg)}">${pg}</span>`};
    const top=`<div class="actions" style="margin-bottom:12px;justify-content:space-between;flex-wrap:wrap"><button class="btn pri" data-asignar="">Asignar plantilla a entrenados o grupo</button>
      <div class="chips"><button class="chip" data-evista="tablero" aria-pressed="${vista==='tablero'}">Tablero</button><button class="chip" data-evista="listado" aria-pressed="${vista==='listado'}">Listado de todos</button></div></div>`;
    if(vista==='listado'){body=top+listadoPlanHTML()}else{
    body=top;
    body+=`
    ${sinTerminarCard(false)?`<div style="margin-bottom:12px">${sinTerminarCard(false)}</div>`:''}
    <div class="grid3">
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>Para entregar</b> <span class="pill p-ok">${listas.filter(okP).length}</span><p class="hint">Llegó la fecha. Confirmá o posponé.</p></div>
        ${listas.filter(okP).length?`<ul class="alist">${listas.filter(okP).map(r=>rowR(r,`<span class="actions" style="flex-wrap:nowrap"><button class="wa" data-entregar="${esc(r._id)}">Entregar</button><button class="btn" style="padding:5px 8px;font-size:13px" data-posponer="${esc(r._id)}">Posponer</button></span>`)).join('')}</ul>`:'<div class="empty">Nada para entregar hoy.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>En espera</b> <span class="pill p-warn">${espera.filter(okP).length}</span><p class="hint">Planificadas para más adelante o pospuestas.</p></div>
        ${espera.filter(okP).length?`<ul class="alist">${espera.filter(okP).map(r=>rowR(r,`<span class="actions" style="flex-wrap:nowrap">${r.fechaSugerida?`<a class="btn" style="padding:5px 8px;font-size:13px" target="_blank" rel="noopener" href="${esc(gcalUrl('Entregar rutina · '+name(S.ents[r.entrenadoId]),r.fechaSugerida,r.nombre||'Rutina'))}" title="Agendar en Google Calendar">Agendar</a>`:''}<button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Abrir</button></span>`)).join('')}</ul>`:'<div class="empty">Sin rutinas en espera.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>Sin próxima planificada</b> <span class="pill p-mute">${sinProx.filter(x=>okP(x.e)).length}</span><p class="hint">Ordenados por la rutina más vieja.</p></div>
        ${sinProx.filter(x=>okP(x.e)).length?`<ul class="alist">${sinProx.filter(x=>okP(x.e)).map(({e,a})=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}${pgP(e)}<br><span class="hint">${a?esc(a.nombre||'Rutina')+' · desde '+fmtShort(a.fechaEntrega):'Sin rutina en la app'+(e.ultRutina?' · últ. '+fmtShort(e.ultRutina):'')}</span></button><button class="btn" style="padding:5px 8px;font-size:13px" data-asignar="" data-para="${esc(e.id)}">Planificar</button></li>`).join('')}</ul>`:'<div class="empty">Todos tienen la próxima en cola.</div>'}</div>
    </div>`}
  }else if(S.rsub==='imprimir'){
    body=imprimirHTML();
  }else if(S.rsub==='plantillas'){
    const pl=Object.entries(S.plantillas).sort((a,b)=>(a[1].nombre||'').localeCompare(b[1].nombre||''));
    body=`<div class="actions" style="margin-bottom:12px"><button class="btn pri" data-newplant="1">Nueva plantilla</button></div>
    <div class="card">${pl.length?`<ul class="alist">${pl.map(([id,p])=>`<li><span class="nm" style="white-space:normal"><b>${esc(p.nombre)}</b><br><span class="hint">${p.tipo==='equipo'?'Equipo':'Individual'} · ${plural((p.secciones||[]).length,'sección','secciones')} · ${diasDe(p)} días · ${p.duracionSemanas||4} semanas</span></span><span class="actions" style="flex-wrap:nowrap"><button class="btn" style="padding:5px 8px;font-size:13px" data-editplant="${esc(id)}">Editar</button><button class="btn pri" style="padding:5px 8px;font-size:13px" data-asignar="${esc(id)}">Asignar</button></span></li>`).join('')}</ul>`:'<div class="empty">Todavía no hay plantillas.</div>'}</div>`;
  }else{
    const q=keyN(S.bq||'');
    const list=Object.entries(S.ejs).filter(([,e])=>!q||keyN(e.nombre).includes(q)).sort((a,b)=>a[1].nombre.localeCompare(b[1].nombre,'es'));
    const uso={};S.rutinas.concat(Object.values(S.plantillas)).forEach(r=>(r.secciones||[]).forEach(s=>s.dias.forEach(d=>d.bloques.forEach(b=>b.items.forEach(i=>{if(i.ej)uso[i.ej]=(uso[i.ej]||0)+1})))));
    body=`<div class="toolbar"><input id="bq" class="search" type="search" placeholder="Buscar ejercicio" value="${esc(S.bq||'')}" autocomplete="off"><button class="btn pri" data-newej="1">Agregar ejercicio</button></div>
    <p class="count">${plural(list.length,'ejercicio','ejercicios')}</p>
    <div class="card"><ul class="alist">${list.map(([id,e])=>`<li><button class="nm" data-editej="${esc(id)}">${esc(e.nombre)}</button><span class="meta">${e.rm?`<span class="pill p-lv">RM ${esc(e.rm)}</span> `:''}${uso[id]?uso[id]+' usos':''}</span>${e.video?`<a class="wa" style="color:var(--accent)" target="_blank" rel="noopener" href="${esc(e.video)}">▶ Video</a>`:'<span class="pill p-bad">Sin video</span>'}</li>`).join('')}</ul></div>`;
  }
  el.innerHTML=`<div class="chips" style="margin-bottom:14px">${SUBS.map(([k,l])=>`<button class="chip" data-rsub="${k}" aria-pressed="${k===S.rsub}">${l}</button>`).join('')}</div>${body}`;
  el.onchange=null;el.onclick=null;if(S.rsub==='imprimir')bindImprimir();
  const bq=$('#bq');if(bq){bq.addEventListener('input',()=>{S.bq=bq.value;const p=bq.selectionStart;renderRutinas();const n=$('#bq');n.focus();n.setSelectionRange(p,p)})}
}

/* ----- Google Calendar: abre el evento ya cargado (día completo) ----- */
function gcalUrl(t,f,det){const d=parse(f);if(!d)return '';const n=new Date(d);n.setDate(n.getDate()+1);return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(t)}&dates=${iso(d).replace(/-/g,'')}/${iso(n).replace(/-/g,'')}&details=${encodeURIComponent(det||'')}`}
const gcalBtn=(lbl,t,f,det)=>{const u=gcalUrl(t,f,det);return u?`<a class="btn gcal" target="_blank" rel="noopener" href="${esc(u)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>${esc(lbl)}</a>`:''};
const DSEM=[[1,'Lunes','Lun','MO'],[2,'Martes','Mar','TU'],[3,'Miércoles','Mié','WE'],[4,'Jueves','Jue','TH'],[5,'Viernes','Vie','FR'],[6,'Sábado','Sáb','SA'],[7,'Domingo','Dom','SU']];
const dsem=n=>DSEM.find(x=>x[0]===Number(n))||DSEM[0];
const pad2=n=>String(n).padStart(2,'0');
/* evento semanal: un botón por cada horario distinto (los días con la misma hora van juntos) */
function gcalSemanal(e,grp){const [hh,mm]=grp.hora.split(':').map(Number);const dur=Number(grp.dur)||60;
  const hoy=today();let first=null;const ahora=new Date();for(let k=0;k<8&&!first;k++){const d=new Date(hoy);d.setDate(d.getDate()+k);const wd=((d.getDay()+6)%7)+1;const t=new Date(d);t.setHours(hh,mm,0,0);if(grp.dias.includes(wd)&&t>ahora)first=d}
  const ini=new Date(first);ini.setHours(hh,mm,0,0);const fin=new Date(ini.getTime()+dur*60000);
  const f=d=>`${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  const det=[`Entrenamiento de ${name(e)}`,e.estimulos?`${e.estimulos} estímulos por semana`:'',e.telefono?'Tel: '+e.telefono:''].filter(Boolean).join('\n');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Entrenamiento · '+name(e))}&dates=${f(ini)}/${f(fin)}&ctz=America/Argentina/Buenos_Aires&recur=${encodeURIComponent('RRULE:FREQ=WEEKLY;BYDAY='+grp.dias.map(d=>dsem(d)[3]).join(','))}&details=${encodeURIComponent(det)}&location=${encodeURIComponent(GYM_LBL[e.gym]||e.gym||'')}`}
function horGrupos(hs){const g={};(hs||[]).filter(h=>h.dia&&/^\d{1,2}:\d{2}$/.test(h.hora||'')).forEach(h=>{const k=h.hora+'|'+(Number(h.dur)||60);(g[k]=g[k]||{hora:h.hora,dur:Number(h.dur)||60,dias:[]}).dias.push(Number(h.dia))});
  return Object.values(g).map(x=>({...x,dias:[...new Set(x.dias)].sort()})).sort((a,b)=>a.dias[0]-b.dias[0]||a.hora.localeCompare(b.hora))}
const horTxt=hs=>horGrupos(hs).map(g=>`${g.dias.map(d=>dsem(d)[2]).join(', ')} ${g.hora}`).join(' · ');
function horariosHTML(e){const ed=S.horEdit&&S.horEdit.id===e.id;const hs=ed?S.horEdit.hs:(e.horarios||[]);
  if(ed)return `<div class="card pad hor"><div class="kpi" style="padding:0"><div class="lbl">Días y horarios de entrenamiento</div></div>
    <div class="hor-rows">${hs.map((h,i)=>`<div class="hor-r" data-hrow="${i}"><label>Día<select data-hd>${DSEM.map(([n,l])=>`<option value="${n}" ${Number(h.dia)===n?'selected':''}>${l}</option>`).join('')}</select></label><label>Hora<input type="time" data-hh value="${esc(h.hora||'')}"></label><label>Duración<select data-hm>${[45,60,75,90,120].map(m=>`<option value="${m}" ${(Number(h.dur)||60)===m?'selected':''}>${m} min</option>`).join('')}</select></label><button type="button" class="x-sm" data-hdel="${i}" aria-label="Quitar">Quitar</button></div>`).join('')}</div>
    <div class="actions"><button type="button" class="btn" data-hadd="1">+ Agregar día</button><button type="button" class="btn pri" data-hsave="${esc(e.id)}">Guardar horarios</button><button type="button" class="btn" data-hcancel="1">Cancelar</button></div></div>`;
  const gs=horGrupos(hs);
  return `<div class="card pad hor"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div class="kpi" style="padding:0"><div class="lbl">Días y horarios de entrenamiento</div></div><button type="button" class="btn" style="padding:5px 10px;font-size:13px" data-hedit="${esc(e.id)}">${gs.length?'Cambiar':'Cargar horarios'}</button></div>
    ${gs.length?`<ul class="hor-l">${gs.map(g=>`<li><b>${g.dias.map(d=>dsem(d)[1]).join(', ')}</b><span>${g.hora} hs · ${g.dur} min</span></li>`).join('')}</ul>
      <p class="hint" style="margin:8px 0 6px">Creá los entrenamientos como eventos semanales en tu Google Calendar (uno por horario):</p>
      <div class="actions">${gs.map(g=>`<a class="btn gcal" target="_blank" rel="noopener" href="${esc(gcalSemanal(e,g))}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Crear ${esc(g.dias.map(d=>dsem(d)[2]).join(' y '))} ${g.hora}</a>`).join('')}</div>
      <p class="hint" style="margin-top:6px">Si después cambiás un horario, borrá o editá el evento viejo en Google Calendar: la app no lo modifica sola.</p>`:'<p class="hint" style="margin:6px 0 0">Cargá qué días y a qué hora entrena para verlo en “Hoy entrenan” y crear los eventos en Google Calendar.</p>'}</div>`}
function gcalFichaHTML(e){const a=activaDe(e.id),c=colaDe(e.id)[0];const tel=e.telefono?'Tel: '+e.telefono:'';const out=[];
  if(e.proxVenc&&isAct(e)&&!sinCuota(e))out.push(gcalBtn('Vencimiento de cuota · '+fmtShort(e.proxVenc),'Vence cuota · '+name(e),e.proxVenc,`Cuota de ${money(monto(e))} · ${GYM_LBL[e.gym]||e.gym||''}\n${tel}`));
  if(c&&c.fechaSugerida)out.push(gcalBtn('Entrega de rutina · '+fmtShort(c.fechaSugerida),'Entregar rutina · '+name(e),c.fechaSugerida,`${c.nombre||'Rutina'}\n${tel}`));
  if(a&&a.fechaEntrega){const f=new Date(parse(a.fechaEntrega));f.setDate(f.getDate()+(Number(a.duracionSemanas)||4)*7);out.push(gcalBtn('Fin de rutina · '+fmtShort(iso(f)),'Termina la rutina de '+name(e),iso(f),`${a.nombre||'Rutina'}: planificar la próxima.\n${tel}`))}
  return horariosHTML(e)+(out.length?`<div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Recordatorios en Google Calendar</div></div><p class="hint" style="margin:4px 0 8px">Se abre Google Calendar con el evento cargado: solo tocás Guardar.</p><div class="actions">${out.join('')}</div></div>`:'')}
/* ----- asistencia editable por el entrenador ----- */
function md5(str){const b=new TextEncoder().encode(str),n=((b.length+8>>6)+1)*16,w=new Array(n).fill(0);for(let i=0;i<b.length;i++)w[i>>2]|=b[i]<<(i%4*8);w[b.length>>2]|=0x80<<(b.length%4*8);w[n-2]=b.length*8;
  const K=[],S_=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];for(let i=0;i<64;i++)K[i]=Math.floor(Math.abs(Math.sin(i+1))*2**32)|0;
  let a0=0x67452301,b0=0xefcdab89|0,c0=0x98badcfe|0,d0=0x10325476;const rl=(x,c)=>x<<c|x>>>(32-c);
  for(let o=0;o<n;o+=16){let A=a0,B=b0,C=c0,D=d0;for(let i=0;i<64;i++){let F,g;if(i<16){F=B&C|~B&D;g=i}else if(i<32){F=D&B|~D&C;g=(5*i+1)%16}else if(i<48){F=B^C^D;g=(3*i+5)%16}else{F=C^(B|~D);g=7*i%16}
    const t=D;D=C;C=B;B=B+rl(A+F+K[i]+w[o+g]|0,S_[(i>>4)*4+i%4])|0;A=t}a0=a0+A|0;b0=b0+B|0;c0=c0+C|0;d0=d0+D|0}
  return [a0,b0,c0,d0].map(x=>{let h='';for(let i=0;i<4;i++)h+=((x>>>(i*8))&255).toString(16).padStart(2,'0');return h}).join('')}
const asisRid=(eid,item,f)=>md5(eid+'|'+item+'|'+f).slice(0,20);
function asisSemana(e){const off=S.asW||0,ini=addD(lunes(today()),7*off),fin=addD(ini,6),I=iso(ini),F=iso(fin);
  const R=rutDe(e.id).filter(r=>(r.estado==='activa'||r.estado==='finalizada')&&r.fechaEntrega&&r.fechaEntrega<=F&&(r.estado==='activa'||!r.fechaFin||r.fechaFin>=I)).sort((a,b)=>(b.fechaEntrega||'').localeCompare(a.fechaEntrega||''))[0]||null;
  const regs=S.regs.filter(r=>r.entrenadoId===e.id&&String(r.item||'').startsWith('asis:')&&r.fecha>=I&&r.fecha<=F);
  return {off,ini,fin,I,F,R,regs}}
function asisEdHTML(e){const W=asisSemana(e),{R}=W;const hoy=iso(today()),max=W.F<hoy?W.F:hoy;
  const nav=`<div class="ase-nav"><button type="button" class="ase-b" data-asw="-1" aria-label="Semana anterior">‹</button><b>Semana ${fmtShort(W.I)} – ${fmtShort(W.F)}${W.off===0?' · esta':''}</b><button type="button" class="ase-b" data-asw="1" aria-label="Semana siguiente" ${W.off>=0?'disabled':''}>›</button></div>`;
  if(!R)return `<div class="pad ase" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Corregir días hechos</div></div>${nav}<div class="hint">No tenía una rutina entregada esa semana.</div></div>`;
  const secs=R.secciones||[];const dur=Number(R.duracionSemanas)||4;
  let si=S.asSec;if(si==null||!secs[si]){si=secs.findIndex(s=>(s.dias||[]).some(d=>W.regs.some(r=>r.item==='asis:'+d.uid)));
    if(si<0){const wk=Math.max(0,Math.floor(days(W.ini,parse(R.fechaEntrega))/7));si=Math.min(secs.length-1,Math.floor(wk*secs.length/dur))}}
  const S0=secs[si]||{dias:[]};const uids=new Set((S0.dias||[]).map(d=>d.uid));
  const def=i=>{const x=iso(addD(W.ini,Math.min(6,i)));return W.off===0?hoy:x>max?max:x};
  const row=(uid,nm,i)=>{const r=W.regs.find(x=>x.item==='asis:'+uid);const m=String(nm||'Día '+(i+1)).match(/^(.*?)\s*[·\-–]\s*(.+)$/);
    return `<li class="ase-r"><button type="button" class="ase-tg${r?' on':''}" data-astog="${esc(uid)}" data-rid="${esc(R._id)}" data-nm="${esc(nm||'')}" aria-pressed="${!!r}" aria-label="${r?'Desmarcar':'Marcar'} ${esc(nm||'')}">${r?'✓':''}</button>
      <span class="ase-n"><b>${esc(m?m[1]:nm||'Día '+(i+1))}</b>${m?`<small>${esc(m[2])}</small>`:''}${r&&r.porAdmin?'<small>cargado por vos</small>':''}</span>
      <input type="date" class="ase-f${r?'':' off'}" data-asf="${esc(uid)}" data-rid="${esc(R._id)}" data-nm="${esc(nm||'')}" value="${r?r.fecha:def(i)}" min="${W.I}" max="${max}" aria-label="Fecha"></li>`};
  const extra=W.regs.filter(r=>!uids.has(r.item.slice(5)));const seen=new Set();
  return `<div class="pad ase" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Corregir días hechos</div></div>${nav}
    <div class="hint ase-rut">${esc(R.nombre||'Rutina')}${R.estado==='finalizada'?' · anterior':''}${secs.length>1?`<select class="ase-sec" data-assec="1" aria-label="Sección">${secs.map((s,i)=>`<option value="${i}" ${i===si?'selected':''}>${esc(s.titulo||'Sección '+(i+1))}</option>`).join('')}</select>`:''}</div>
    ${W.I>max?'<div class="hint">Esa semana todavía no empezó.</div>':`<ul class="ase-l">${(S0.dias||[]).map((d,i)=>row(d.uid,d.nombre,i)).join('')}${extra.filter(r=>!seen.has(r.item)&&seen.add(r.item)).map(r=>{const d=diaDe(r.rutinaId,r.item.slice(5));return row(r.item.slice(5),(d&&d.nombre)||r.nombre||'Otro día',0)}).join('')}</ul>
    <p class="hint" style="margin:6px 0 0">Tocá el cuadrado para marcar o desmarcar. Si lo hizo otro día, cambiá la fecha.</p>`}</div>`}
async function asisToggle(e,b){const uid=b.dataset.astog,W=asisSemana(e),r=W.regs.find(x=>x.item==='asis:'+uid);b.disabled=true;
  if(r){if(await write(()=>S.db.collection('registros').doc(r._id).delete())){S.regs=S.regs.filter(x=>x._id!==r._id);toast('Día desmarcado');renderSheet()}}
  else{const f=b.closest('li').querySelector('[data-asf]').value;if(!f){b.disabled=false;return toast('Elegí la fecha')}await asisPut(e,b.dataset.rid,uid,b.dataset.nm,f);toast('Día marcado · '+fmtShort(f))}
  b.disabled=false}
async function asisPut(e,rid,uid,nm,f){const item='asis:'+uid,id=asisRid(e.id,item,f);
  const d={entrenadoId:e.id,rutinaId:rid,item,fecha:f,kg:'',reps:'',cansancio:null,nota:'Asistió',ej:'',nombre:nm||'',ts:Date.now(),porAdmin:true};
  if(await write(()=>S.db.collection('registros').doc(id).set(d))){S.regs=S.regs.filter(x=>x._id!==id).concat({...d,_id:id});renderSheet();return true}return false}
async function asisFecha(e,inp){const uid=inp.dataset.asf,W=asisSemana(e),r=W.regs.find(x=>x.item==='asis:'+uid),f=inp.value;if(!r||!f||f===r.fecha)return;
  if(W.regs.some(x=>x!==r&&x.item===r.item&&x.fecha===f))return toast('Ya está marcado ese día');
  if(await asisPut(e,r.rutinaId||inp.dataset.rid,uid,r.nombre||inp.dataset.nm,f)){if(asisRid(e.id,r.item,f)!==r._id){await write(()=>S.db.collection('registros').doc(r._id).delete());S.regs=S.regs.filter(x=>x._id!==r._id);renderSheet()}toast('Fecha cambiada · '+fmtShort(f))}}
/* ----- bloque de rutinas en la ficha ----- */
function fichaRutinasHTML(e){
  const a=activaDe(e.id),c=colaDe(e.id),finT=rutDe(e.id).filter(r=>r.estado==='finalizada').sort((x,y)=>(y.fechaFin||'').localeCompare(x.fechaFin||'')||(y.fechaEntrega||'').localeCompare(x.fechaEntrega||'')),fin=S.finAll?finT:finT.slice(0,3);
  const url=portalUrl(e);
  const regs=S.regs.filter(r=>r.entrenadoId===e.id&&!especial(r)).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')||(y.ts||0)-(x.ts||0)).slice(0,10);
  const asis=S.regs.filter(r=>r.entrenadoId===e.id&&String(r.item||'').startsWith('asis:'));
  const semanas=[];for(let w=0;w<6;w++){const fin=new Date(today());fin.setDate(fin.getDate()-((fin.getDay()+6)%7)+6-7*w);const ini=new Date(fin);ini.setDate(ini.getDate()-6);
    const n=new Set(asis.filter(r=>r.fecha>=iso(ini)&&r.fecha<=iso(fin)).map(r=>r.fecha+r.item)).size;semanas.push({ini,n})}
  const asisHTML=`<div class="pad" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Asistencia (últimas 6 semanas)</div></div>
    <div class="asis-row">${semanas.slice().reverse().map(w=>`<div class="asis-w"><div class="asis-bar"><i style="height:${Math.min(1,w.n/Math.max(1,Number(e.estimulos)||3))*100}%"></i></div><b>${w.n}/${e.estimulos||'?'}</b><span>${fmtShort(iso(w.ini))}</span></div>`).join('')}</div></div>`;
  const itemName=uid=>{if(String(uid).startsWith('asis:'))return 'Asistencia';for(const r of rutDe(e.id))for(const s of r.secciones||[])for(const d of s.dias)for(const b of d.bloques)for(const i of b.items)if(i.uid===uid)return i.nombre;return 'Ejercicio'};
  const warn=r=>{const n=diasDe(r),est=Number(e.estimulos)||0;return n&&est&&n!==est?` <span class="pill p-warn">${n} días · paga ${est}</span>`:''};
  return `<div class="card">
    <div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b>Rutinas</b>
      <span class="actions">
        <button type="button" class="btn pri pm-t" popovertarget="pm-nueva">Nueva rutina</button><div id="pm-nueva" class="pmenu" popover="auto" aria-label="Nueva rutina">
          <button type="button" data-asignar="" data-para="${esc(e.id)}"><b>Desde plantilla</b><small>Elegí una de tus plantillas</small></button>
          ${a?`<button type="button" data-duprut="${esc(a._id)}"><b>Duplicar la actual</b><small>Parte de “${esc(a.nombre||'Rutina')}”</small></button>`:''}
          <button type="button" data-copiarde="${esc(e.id)}"><b>De otro entrenado</b><small>Copiá la rutina de alguien más</small></button>
          <button type="button" data-newrut="${esc(e.id)}"><b>Vacía</b><small>Empezá de cero</small></button></div>
        <button type="button" class="btn pm-t" popovertarget="pm-claude">Con Claude</button><div id="pm-claude" class="pmenu" popover="auto" aria-label="Con Claude">
          <button type="button" data-iaexp="${esc(e.id)}"><b>Copiar para Claude</b><small>Pedido con su rutina y registros, sin nombre</small></button>
          <button type="button" data-iaimp="${esc(e.id)}"><b>Importar de Claude</b><small>Pegá la rutina que armó Claude</small></button></div></span></div>
    <ul class="alist">
      ${a?`<li><span class="nm" style="white-space:normal"><span class="pill p-ok">Activa</span> <b>${esc(a.nombre||'Rutina')}</b>${warn(a)}${faltaPill(a)}<br><span class="hint">Entregada ${fmtD(a.fechaEntrega)} · semana ${semanaActual(a)+1} de ${a.duracionSemanas||'?'}</span></span><span class="actions" style="flex-wrap:nowrap"><button class="btn ic-b" data-pdf="${esc(a._id)}" title="Descargar PDF" aria-label="Descargar PDF">PDF</button><button class="btn ic-b" data-verrut="${esc(a._id)}" title="Ver como la ve el entrenado" aria-label="Ver rutina">Ver</button><button class="btn pri" data-editrut="${esc(a._id)}">Abrir</button></span></li>`:'<li><span class="nm hint">Sin rutina activa en la app. Creala con “Nueva rutina”.</span></li>'}
      ${c.map(r=>`<li><span class="nm" style="white-space:normal"><span class="pill p-warn">En cola</span> <b>${esc(r.nombre||'Rutina')}</b>${warn(r)}${faltaPill(r)}<br><span class="hint">Entrega sugerida ${fmtD(r.fechaSugerida)}${r.pospuesta?.motivo?' · '+esc(r.pospuesta.motivo):''}</span></span><span class="actions" style="flex-wrap:nowrap"><button class="wa" data-entregar="${esc(r._id)}">Entregar</button><button class="btn" style="padding:5px 8px;font-size:13px" data-posponer="${esc(r._id)}">Posponer</button><button class="btn" style="padding:5px 8px;font-size:13px" data-pdf="${esc(r._id)}">PDF</button><button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Abrir</button></span></li>`).join('')}
      ${finT.length?`<li class="rv-sep"><b>Rutinas anteriores</b><span class="hint">${finT.length}</span></li>`:''}
      ${fin.map(r=>`<li><span class="nm" style="white-space:normal"><span class="pill p-mute">Finalizada</span> ${esc(r.nombre||'Rutina')}<br><span class="hint">${fmtD(r.fechaEntrega)} al ${fmtD(r.fechaFin)}</span></span><span class="actions" style="flex-wrap:nowrap"><button class="btn" style="padding:5px 8px;font-size:13px" data-pdf="${esc(r._id)}">PDF</button><button class="btn" style="padding:5px 8px;font-size:13px" data-verrut="${esc(r._id)}">Ver</button></span></li>`).join('')}
      ${finT.length>3?`<li><button class="lnk-f" type="button" data-finall="1">${S.finAll?'Ver menos':'Ver todas ('+finT.length+')'}</button></li>`:''}
    </ul>
    <div class="pad" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Link personal del entrenado</div></div>
      ${url?`<input id="portal-url" readonly value="${esc(url)}" style="width:100%;margin:6px 0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);font-size:12px"><div class="actions"><button class="btn" id="portal-copy" type="button">Copiar link</button><a class="btn" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(url)}">Abrir como entrenado</a><button class="btn" data-mode="wa" data-kindsel="link">Enviar por WhatsApp</button></div>`:`<p class="hint" style="margin:6px 0">Todavía no tiene link.</p><button class="btn" id="portal-gen" type="button">Crear link</button>`}
    </div>
    ${asisHTML}
    ${asisEdHTML(e)}
    ${cargaFichaHTML(e,a)}
    ${cambiosHTML(e)}
    ${limpiarHTML(e)}
  </div>
  ${gcalFichaHTML(e)}
  ${(()=>{const ms=mesesDe(e);const def=ms.includes(mesShift(curMes(),-1))?mesShift(curMes(),-1):ms[0];const vs=ms.find(k=>k<def)||ms.find(k=>k!==def)||'';
    return `<div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Hoja resumen en PDF (a color)</div></div><p class="hint" style="margin:4px 0 8px">Asistencia, fuerza, carga y bienestar con gráficos y una explicación de cada dato. No incluye pagos.</p>
    <div class="actions" style="align-items:center"><select id="rep-tipo" class="search" style="flex:0 1 220px"><option value="mes">Resumen del mes</option><option value="comp">Comparativa entre dos meses</option></select>
    <select id="rep-mes" class="search" style="flex:0 1 170px">${ms.map(k=>`<option value="${k}" ${k===def?'selected':''}>${mesLbl(k)}</option>`).join('')}</select>
    <span id="rep-vsw" hidden style="display:flex;gap:6px;align-items:center">vs <select id="rep-vs" class="search" style="flex:0 1 170px">${ms.map(k=>`<option value="${k}" ${k===vs?'selected':''}>${mesLbl(k)}</option>`).join('')}</select></span>
    <button class="btn pri" type="button" id="rep-go">Descargar</button></div></div>`})()}
  ${testsFichaHTML(e)}
  <div class="card"><div class="pad" style="padding-bottom:4px"><b>Marcas (RM)</b><p class="hint">Los kg de los ejercicios con % se calculan con estas marcas, redondeando a ${S.cfg.redondeo||2.5} kg. Los grises se calculan solos.</p></div>
    <form id="rmf" class="pad form cols3" style="padding-top:6px">${(S.cfg.rmDefs||[]).map(d=>{const own=(e.rm||{})[d.mov];const der=!own&&rmValue(e,d.mov);return `<label>${esc(titleCase(d.mov))}<input data-rm="${esc(d.mov)}" type="number" min="0" step="0.5" value="${esc(own??'')}" placeholder="${der?String(+der.toFixed(1)):''}"></label>`}).join('')}
      <div class="full actions"><button class="btn" type="submit">Guardar marcas</button></div></form></div>`;
}
function cargaFichaHTML(e,a){
  const regs=S.regs.filter(r=>r.entrenadoId===e.id);
  const hayC=regs.some(r=>r.tipo==='carga'),hayB=regs.some(r=>r.tipo==='bien');
  if(!hayC&&!hayB&&!(a&&(a.controlCarga||a.bienestar)))return '';
  let h='';
  if(hayC||a?.controlCarga){
    const cd=cargaDias(e.id);const ws=semanasDe(new Date(today().getTime()-35*864e5),today()).slice(-6).map(([x,y])=>{let v=0;for(const k in cd)if(k>=iso(x)&&k<=iso(y))v+=cd[k];return {ini:x,v:Math.round(v)}});
    const mx=Math.max(1,...ws.map(w=>w.v));const ac=acwr(e.id);
    h+=`<div class="pad" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="lbl">Carga semanal (minutos × esfuerzo)</div><span class="pill ${acwrPill(ac.ratio)}">Aguda/crónica: ${ac.ratio==null?'—':ac.ratio.toFixed(2)} · ${acwrTxt(ac.ratio)}</span></div>
      ${hayC?`<div class="asis-row">${ws.map(w=>`<div class="asis-w"><div class="asis-bar"><i style="height:${w.v/mx*100}%;background:var(--accent)"></i></div><b>${w.v}</b><span>${fmtShort(iso(w.ini))}</span></div>`).join('')}</div>${regListaHTML(e,'carga')}`:'<p class="hint">Todavía no anotó ninguna sesión.</p>'}</div>`;
  }
  if(hayB||a?.bienestar){
    const bl=regs.filter(r=>r.tipo==='bien').sort((x,y)=>y.fecha.localeCompare(x.fecha)).slice(0,5);
    h+=`<div class="pad" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Bienestar antes de entrenar</div></div>
      ${bl.length?(S.regVer?.[e.id+'|bien']?regListaHTML(e,'bien'):`<ul class="alist" style="margin:4px -16px 0">${bl.map(r=>{const st=estadoBien(e.id,r.fecha);return `<li><span class="nm">${fmtShort(r.fecha)}</span><span class="meta">${bienTxt(r.datos)}</span>${st?`<span class="pill ${EST[st.k][1]}">${EST[st.k][0]}</span>`:''}</li>`}).join('')}</ul>${regListaHTML(e,'bien')}`):'<p class="hint">Todavía no respondió el cuestionario.</p>'}
      ${a?.ajusteWellness?(()=>{const fal=[];(a.secciones||[]).forEach(s2=>s2.dias.forEach(d=>d.bloques.forEach(b=>b.items.forEach(i=>{if(i.pct&&i.rm&&kgItem(i,e).falta&&!fal.includes(i.rm))fal.push(i.rm)}))));const sinPct=[];(a.secciones||[]).forEach(s2=>s2.dias.forEach(d=>d.bloques.forEach(b=>{if(b.modo!=='timer')b.items.forEach(i=>{if(String(i.nombre||'').trim()&&!i.pct&&i.kg&&!sinPct.includes(i.nombre))sinPct.push(i.nombre)})})));
        return `<div class="aj-info"><b>Ajuste de cargas por wellness: activado</b><span>Moderado −5% · Bajo −10% y una serie menos. Se ajustan los ejercicios con %RM; los circuitos por tiempo suman descanso o restan una vuelta.</span>${fal.length?`<span class="aj-falta">Faltan marcas para ajustar: <b>${fal.map(esc).join(', ')}</b>. Cargalas en "Marcas RM".</span>`:''}${sinPct.length?`<span class="hint">Con kg fijo (no se ajustan): ${sinPct.slice(0,6).map(esc).join(', ')}${sinPct.length>6?'…':''}</span>`:''}</div>`})():''}</div>`;
  }
  return h;
}
/* ----- corregir o borrar registros de carga y bienestar (y limpiar pruebas) ----- */
document.head.insertAdjacentHTML('beforeend',`<style id="rg-css">/* ---- corregir registros de carga y bienestar / borrar pruebas ---- */
.rg-tg{font-size:13px;margin-top:8px;display:inline-block}
.rg-l{list-style:none;margin:6px 0 0;padding:0}
.rg-r{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);flex-wrap:wrap}
.rg-r:first-child{border-top:0}
.rg-d{min-width:46px;font-weight:700;font-size:14px;display:flex;flex-direction:column;line-height:1.2}
.rg-d small{font-weight:500;font-size:11px;color:var(--muted)}
.rg-t{flex:1;min-width:140px;font-size:13.5px;color:var(--muted)}
.rg-t b{color:var(--ink)}
.rg-a{display:flex;gap:6px;margin-left:auto}
.rg-r.ed{background:var(--surface-2);border-radius:8px;padding:10px;border-top:0;margin:4px 0}
.rg-f{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;width:100%}
.rg-f label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.rg-f input,.rg-f select{font:inherit;font-size:14px;padding:6px 8px;border:1px solid var(--line);border-radius:7px;background:var(--surface);color:var(--ink);text-transform:none}
.rg-f input[type=number]{width:84px}
.rg-f input[type=date]{width:140px}
.rg-pie{display:flex;justify-content:space-between;gap:10px;margin-top:6px;font-size:13px}
.rg-pie .lnk:last-child{margin-left:auto}
.kpi-btn{display:block;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;transition:border-color .15s}
.kpi-btn:hover{border-color:var(--bad)}
.kpi-btn.on{border-color:var(--bad);box-shadow:inset 0 0 0 1px var(--bad)}
.kpi-btn u{text-decoration-color:var(--line);text-underline-offset:3px}
.kpi-car{display:inline-block;transition:transform .15s}.kpi-btn.on .kpi-car{transform:rotate(180deg)}
.falta-l{margin-top:12px;border-color:var(--bad)}
.falta-l .alist li{flex-wrap:wrap}
.falta-l .nm{white-space:normal}
.fl-acc{display:flex;gap:6px;align-items:center}</style>`);
function regArm(btn,txt){if(btn.dataset.armed==='1')return true;btn.dataset.armed='1';btn.dataset.txt=btn.textContent;btn.textContent=txt||'¿Seguro?';btn.classList.add('armed');
  setTimeout(()=>{if(btn.isConnected&&btn.dataset.armed==='1'&&!btn.disabled){btn.dataset.armed='';btn.textContent=btn.dataset.txt;btn.classList.remove('armed')}},4000);return false}
function regListaHTML(e,tipo){const k=e.id+'|'+tipo,ver=!!S.regVer?.[k];
  const lbl=tipo==='carga'?'sesiones':'respuestas';
  if(!ver)return `<button type="button" class="lnk rg-tg" data-regver="${esc(k)}">Corregir o borrar ${lbl}</button>`;
  const l=S.regs.filter(r=>r.entrenadoId===e.id&&r.tipo===tipo).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')||(y.ts||0)-(x.ts||0));
  const todo=S.regVer[k]==='todo',L=todo?l:l.slice(0,12);
  return `<ul class="rg-l">${L.map(r=>regRowHTML(e,r)).join('')}</ul>
    <div class="rg-pie">${l.length>12?`<button type="button" class="lnk" data-regtodo="${esc(k)}">${todo?'Ver menos':'Ver las '+l.length}</button>`:''}<button type="button" class="lnk" data-regver="${esc(k)}">Listo</button></div>`}
function regRowHTML(e,r){const d=r.datos||{};
  if(S.regEd!==r._id){const txt=r.tipo==='carga'?`${esc(d.min??'—')} min · esfuerzo ${esc(d.rpe??'—')}/10 · <b>${Math.round((Number(d.min)||0)*(Number(d.rpe)||0))}</b>`:esc(bienTxt(d))||'—';
    return `<li class="rg-r"><span class="rg-d">${fmtShort(r.fecha)}${r.editAdmin?'<small>corregido</small>':''}</span><span class="rg-t">${txt}</span><span class="rg-a"><button type="button" class="btn sm" data-reged="${esc(r._id)}">Editar</button><button type="button" class="btn sm danger" data-regdel="${esc(r._id)}">Borrar</button></span></li>`}
  const v=bienVals(d);
  const campos=r.tipo==='carga'
    ?`<label>Minutos<input type="number" inputmode="numeric" min="1" max="600" name="min" value="${esc(d.min??'')}"></label><label>Esfuerzo 1-10<input type="number" inputmode="numeric" min="1" max="10" name="rpe" value="${esc(d.rpe??'')}"></label>`
    :BK.map(([k,l])=>`<label>${l}<select name="${k}"><option value="">—</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${v[k]===n?'selected':''}>${n}</option>`).join('')}</select></label>`).join('');
  return `<li class="rg-r ed"><div class="rg-f" data-regbox="${esc(r._id)}"><label>Fecha<input type="date" name="fecha" value="${esc(r.fecha)}" max="${iso(today())}"></label>${campos}
    <span class="rg-a"><button type="button" class="btn sm pri" data-regsave="${esc(r._id)}">Guardar</button><button type="button" class="btn sm" data-regcancel="1">Cancelar</button></span></div></li>`}
async function regGuardar(e,btn){const box=btn.closest('[data-regbox]'),id=box.dataset.regbox,r=S.regs.find(x=>x._id===id);if(!r)return;
  const g=n=>box.querySelector(`[name="${n}"]`)?.value??'';const f=g('fecha');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(f))return toast('Elegí la fecha');if(f>iso(today()))return toast('La fecha no puede ser futura');
  let datos={...(r.datos||{})};
  if(r.tipo==='carga'){const min=Math.round(Number(g('min'))),rpe=Math.round(Number(g('rpe')));
    if(!(min>=1&&min<=600))return toast('Minutos: entre 1 y 600');if(!(rpe>=1&&rpe<=10))return toast('Esfuerzo: de 1 a 10');datos={...datos,min,rpe}}
  else{delete datos.cuerpo;['estado','prom','base'].forEach(k=>delete datos[k]);let n=0;
    BK.forEach(([k])=>{const x=Number(g(k));if(x>=1&&x<=5){datos[k]=x;n++}else delete datos[k]});if(!n)return toast('Completá al menos una respuesta');
    const d0=new Date(parse(f));d0.setDate(d0.getDate()-28);const ini=iso(d0);
    const st=bienEstado(datos,S.regs.filter(x=>x._id!==id&&x.entrenadoId===e.id&&x.tipo==='bien'&&x.fecha<f&&x.fecha>=ini).map(x=>x.datos));
    if(st){datos.estado=st.k;datos.prom=st.m;datos.base=st.base}}
  const nid=f===r.fecha?id:asisRid(e.id,r.item,f);
  if(nid!==id&&S.regs.some(x=>x._id===nid))return toast('Ya hay un registro así ese día: borrá uno de los dos');
  const {_id,...base}=r,d={...base,fecha:f,datos,ts:Date.now(),editAdmin:true};btn.disabled=true;
  if(!await write(()=>S.db.collection('registros').doc(nid).set(d))){btn.disabled=false;return}
  S.regs=S.regs.filter(x=>x._id!==nid).concat({...d,_id:nid});
  if(nid!==id&&await write(()=>S.db.collection('registros').doc(id).delete()))S.regs=S.regs.filter(x=>x._id!==id);
  S.regEd=null;toast('Registro corregido');renderSheet()}
async function regBorrar(btn){if(!regArm(btn,'¿Borrar?'))return;const id=btn.dataset.regdel;btn.disabled=true;
  if(await write(()=>S.db.collection('registros').doc(id).delete())){S.regs=S.regs.filter(x=>x._id!==id);if(S.regEd===id)S.regEd=null;toast('Registro borrado');renderSheet()}else btn.disabled=false}
function limpiarHTML(e){const regs=S.regs.filter(r=>r.entrenadoId===e.id);if(!regs.length)return '';
  const ver=S.limpVer===e.id;
  if(!ver)return `<div class="pad" style="border-top:1px solid var(--line)"><button type="button" class="lnk rg-tg" data-limpver="${esc(e.id)}">Borrar registros de prueba o de una rutina</button></div>`;
  const ids=[...new Set(regs.map(r=>r.rutinaId||''))];
  const G=ids.map(rid=>{const r=rid&&S.rutinas.find(x=>x._id===rid),l=regs.filter(x=>(x.rutinaId||'')===rid),fs=l.map(x=>x.fecha).filter(Boolean).sort();
    const n=t=>l.filter(x=>t==='asis'?String(x.item||'').startsWith('asis:'):t==='ej'?!especial(x):x.tipo===t).length;
    return {rid,r,l,desde:fs[0],hasta:fs[fs.length-1],c:[['asis','día de asistencia','días de asistencia'],['carga','sesión de carga','sesiones de carga'],['bien','respuesta de bienestar','respuestas de bienestar'],['ej','registro de kg','registros de kg']].map(([t,a,b])=>[n(t),a,b]).filter(([x])=>x)}})
    .sort((a,b)=>(b.hasta||'').localeCompare(a.hasta||''));
  const est=r=>!r?'<span class="pill p-mute">Rutina borrada</span>':r.estado==='activa'?'<span class="pill p-ok">Activa</span>':r.estado==='finalizada'?'<span class="pill p-mute">Finalizada</span>':`<span class="pill p-mute">${esc(r.estado||'')}</span>`;
  return `<div class="pad" style="border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:14px">Borrar registros de prueba</b><button type="button" class="lnk" data-limpver="">Cerrar</button></div>
    <p class="hint" style="margin:2px 0 8px">Borra todo lo que anotó (o marcaste vos) con esa rutina: asistencia, kg, carga y bienestar. Desaparece de los gráficos, la carga aguda/crónica y los PDF. No se puede deshacer.</p>
    <ul class="rg-l">${G.map(g=>`<li class="rg-r"><span class="rg-t" style="white-space:normal">${est(g.r)} <b>${esc(g.r?.nombre||'Sin rutina')}</b><br><small class="hint">${g.desde?fmtShort(g.desde)+(g.hasta!==g.desde?' al '+fmtShort(g.hasta):''):''} · ${g.c.map(([x,a,b])=>plural(x,a,b)).join(' · ')}</small></span>
      <span class="rg-a"><button type="button" class="btn sm danger" data-limpiar="${esc(g.rid)}" data-n="${g.l.length}">Borrar ${g.l.length}</button></span></li>`).join('')}</ul></div>`}
async function limpiarRut(e,btn){const n=btn.dataset.n;if(!regArm(btn,`Tocá otra vez: borrar ${n}`))return;
  const rid=btn.dataset.limpiar,l=S.regs.filter(r=>r.entrenadoId===e.id&&(r.rutinaId||'')===rid);btn.disabled=true;btn.textContent='Borrando…';const ok=new Set();
  for(let i=0;i<l.length;i+=10)await Promise.all(l.slice(i,i+10).map(r=>S.db.collection('registros').doc(r._id).delete().then(()=>ok.add(r._id),()=>{})));
  S.regs=S.regs.filter(x=>!ok.has(x._id));S.regEd=null;
  toast(ok.size===l.length?`Listo: ${ok.size} registros borrados`:`Se borraron ${ok.size} de ${l.length}. Probá de nuevo.`);renderSheet()}
function bindFichaRutinas(e){
  const rg=$('#rep-go');if(rg){const tp=$('#rep-tipo');tp.addEventListener('change',()=>{$('#rep-vsw').hidden=tp.value!=='comp'});
    rg.addEventListener('click',()=>descargarReportes([e.id],$('#rep-mes').value,tp.value==='comp'?$('#rep-vs').value:null))}
  const cp=$('#portal-copy');if(cp)cp.addEventListener('click',()=>{const u=$('#portal-url').value;const p=navigator.clipboard?.writeText(u);if(p)p.then(()=>toast('Link copiado'),()=>{$('#portal-url').select()});else $('#portal-url').select()});
  const gen=$('#portal-gen');if(gen)gen.addEventListener('click',async()=>{if(await ensureToken(e)){toast('Link creado');renderSheet()}});
  const rmf=$('#rmf');if(rmf)rmf.addEventListener('submit',async ev=>{ev.preventDefault();const rm={};rmf.querySelectorAll('[data-rm]').forEach(i=>{const v=Number(i.value);if(v>0)rm[i.dataset.rm]=v});
    if(await write(()=>S.db.collection('entrenados').doc(e.id).update({rm})))toast('Marcas guardadas')});
}

/* ----- entregar / posponer ----- */
async function entregar(rid,btn){
  const r=S.rutinas.find(x=>x._id===rid);if(!r)return;
  const f=faltantes(r);
  if(f.length&&btn&&btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.classList.add('danger');btn.textContent='Sin terminar: tocá de nuevo para entregar igual';toast('Falta completar: '+f.slice(0,2).map(x=>x.lugar+' ('+x.txt+')').join(' · '));return}
  const e=S.ents[r.entrenadoId];
  const t=iso(today());
  for(const a of rutDe(r.entrenadoId).filter(x=>x.estado==='activa'&&!x.equipo))await write(()=>S.db.collection('rutinas').doc(a._id).update({estado:'finalizada',fechaFin:t}));
  if(!await write(()=>S.db.collection('rutinas').doc(rid).update({estado:'activa',fechaEntrega:t})))return;
  await ensureToken(e);
  await write(()=>S.db.collection('entrenados').doc(e.id).update({ultRutina:t,modalidad:'Periodizada'}));
  await addHist(e.id,'Rutina',`Entregada: ${r.nombre||'Rutina'}`);
  toast('Rutina entregada');
  openSheet(e.id,'wa','rutina');
}
function posponerHTML(r){
  const e=S.ents[r.entrenadoId];
  const opt=n=>{const d=parse(r.fechaSugerida)||today();const x=new Date(Math.max(d,today()));x.setDate(x.getDate()+n);return iso(x)};
  return `<form id="ppf" class="form card pad">
    <p class="hint full">${esc(name(e))} sigue con su rutina actual. La entrega de “${esc(r.nombre||'Rutina')}” se mueve a la fecha que elijas.</p>
    <div class="full actions">${[[7,'1 semana'],[14,'2 semanas'],[21,'3 semanas']].map(([n,l])=>`<button class="chip" type="button" data-pp="${opt(n)}">${l}</button>`).join('')}</div>
    <label>Nueva fecha<input id="pp-fecha" type="date" value="${opt(7)}" required></label>
    <label>Motivo (opcional)<input id="pp-mot" placeholder="Ej: lesión, viene faltando, sigue progresando"></label>
    <div class="full actions"><button class="btn pri" type="submit">Posponer</button><button class="btn" type="button" data-close>Cancelar</button></div></form>`;
}
function bindPosponer(r){
  $('#ppf').addEventListener('click',ev=>{const b=ev.target.closest('[data-pp]');if(b)$('#pp-fecha').value=b.dataset.pp});
  $('#ppf').addEventListener('submit',async ev=>{ev.preventDefault();const f=$('#pp-fecha').value,m=$('#pp-mot').value.trim();
    if(await write(()=>S.db.collection('rutinas').doc(r._id).update({fechaSugerida:f,pospuesta:{fecha:iso(today()),motivo:m}}))){
      await addHist(r.entrenadoId,'Rutina',`Entrega de ${r.nombre||'rutina'} pospuesta al ${fmtD(f)}${m?': '+m:''}`);toast('Entrega pospuesta');closeSheet()}});
}

/* ----- asignar plantilla ----- */
function asignarHTML(arg){
  const pls=Object.entries(S.plantillas);
  const pid=arg.pid&&S.plantillas[arg.pid]?arg.pid:'';
  const p=pid?S.plantillas[pid]:null;
  const grupos=[...new Set(Object.values(S.ents).map(e=>e.grupo).filter(Boolean))].sort();
  const sel=arg.sel||new Set();
  const q=keyN(arg.q||'');
  const list=Object.values(S.ents).filter(isAct).filter(e=>sel.has(e.id)||!q||keyN(e.nombre).includes(q)||keyN(e.grupo).includes(q)).sort((a,b)=>(b.grupo||'').localeCompare(a.grupo||'')||name(a).localeCompare(name(b),'es'));
  const nd=p?diasDe(p):0;
  return `<form id="asf" class="form">
    <label class="full">Plantilla<select id="as-p"><option value="" ${!pid?'selected':''}>Plantilla vacía</option>${pls.map(([id,x])=>`<option value="${esc(id)}" ${id===pid?'selected':''}>${esc(x.nombre)}</option>`).join('')}</select></label>
    <label>Nombre de la rutina<input id="as-nom" value="${esc(arg.nom??(p?p.nombre:'Rutina'))}"></label>
    <label>Entrega sugerida<input id="as-f" type="date" value="${esc(arg.f||iso(today()))}"></label>
    ${p?`<p class="hint full">${plural((p.secciones||[]).length,'sección','secciones')} · ${nd} días. A cada entrenado le llegan solo las secciones de su posición (o todas si no tiene). Si paga menos estímulos que días, se arma una rotación semanal automática.</p>`:`<p class="hint full">Cada entrenado recibe una rutina en blanco con tantos días como estímulos paga, lista para completar desde Entregas.</p>`}
    ${grupos.length?`<div class="full actions">${grupos.map(g=>`<button class="chip" type="button" data-grp="${esc(g)}">Todo ${esc(g)}</button>`).join('')}</div>`:''}
    <input id="as-q" class="full search" placeholder="Buscar entrenado" value="${esc(arg.q||'')}" autocomplete="off">
    <div class="full card" style="max-height:340px;overflow:auto"><ul class="alist">${list.map(e=>`<li><label style="display:flex;flex-direction:row;gap:10px;align-items:center;flex:1;text-transform:none;letter-spacing:0;font-size:15px;color:var(--ink);font-weight:500"><input type="checkbox" data-sel="${esc(e.id)}" ${sel.has(e.id)?'checked':''} style="width:auto">${esc(name(e))}</label><span class="meta">${e.grupo?esc(e.grupo)+' · ':''}${e.posicion?esc(e.posicion)+' · ':''}${e.estimulos}×</span></li>`).join('')}</ul></div>
    <div class="full actions"><button class="btn pri" type="submit">Poner en cola (${sel.size})</button><button class="btn" type="button" data-close>Cancelar</button></div>
  </form>`;
}
function bindAsignar(arg){
  const f=$('#asf');
  const keep=()=>{arg.nom=$('#as-nom').value;arg.f=$('#as-f').value};
  $('#as-p').addEventListener('change',()=>{arg.pid=$('#as-p').value;arg.nom=undefined;arg.f=$('#as-f').value;renderSheet()});
  $('#as-q').addEventListener('input',()=>{keep();arg.q=$('#as-q').value;const p=$('#as-q').selectionStart;renderSheet();const n=$('#as-q');n.focus();n.setSelectionRange(p,p)});
  f.addEventListener('change',ev=>{const c=ev.target.closest('[data-sel]');if(c){c.checked?arg.sel.add(c.dataset.sel):arg.sel.delete(c.dataset.sel);keep();f.querySelector('button[type=submit]').textContent=`Poner en cola (${arg.sel.size})`}});
  f.addEventListener('click',ev=>{const g=ev.target.closest('[data-grp]');if(g){Object.values(S.ents).filter(e=>isAct(e)&&e.grupo===g.dataset.grp).forEach(e=>arg.sel.add(e.id));keep();renderSheet()}});
  f.addEventListener('submit',async ev=>{ev.preventDefault();keep();
    const pv=$('#as-p').value;const p=pv?S.plantillas[pv]:{nombre:'Rutina',secciones:null,duracionSemanas:4};if(!arg.sel.size){toast('Elegí al menos un entrenado');return}
    let n=0;
    for(const id of arg.sel){
      const e=S.ents[id];
      if(!p.secciones){const doc={entrenadoId:id,nombre:arg.nom||'Rutina',estado:'cola',fechaSugerida:arg.f||iso(today()),duracionSemanas:4,secciones:[newSeccion(Number(e.estimulos)||3)],plantillaId:'',notas:'',controlCarga:false,bienestar:false,creada:Date.now()};
        if(await write(()=>S.db.collection('rutinas').add(doc)))n++;continue}
      const secs=clone(p.secciones||[]).filter(s=>!s.posicion||!e.posicion||keyN(s.posicion)===keyN(e.posicion));
      const doc={entrenadoId:id,nombre:arg.nom||p.nombre,estado:'cola',fechaSugerida:arg.f||iso(today()),duracionSemanas:p.duracionSemanas||4,
        secciones:secs.length?secs:clone(p.secciones||[]),plantillaId:pv,notas:p.notas||'',controlCarga:!!p.controlCarga,bienestar:!!p.bienestar,creada:Date.now()};
      if(p.distribucion&&p.distribucion.length)doc.distribucion=clone(p.distribucion);else{const rot=rotacion(diasDe(doc),Number(e.estimulos),doc.duracionSemanas);if(rot)doc.distribucion=rot}
      if(await write(()=>S.db.collection('rutinas').add(doc)))n++;
    }
    toast(`${plural(n,'rutina puesta','rutinas puestas')} en cola`);closeSheet();
  });
}

/* ----- PDF para imprimir ----- */
function pdfDe(r){const e=S.ents[r.entrenadoId];return {name:RutinaPDF.fileName(e,r),data:RutinaPDF.build(r,e,it=>kgItem(it,e).txt)}}
function descargarPDFs(ids){
  const rs=ids.map(id=>S.rutinas.find(x=>x._id===id)).filter(r=>r&&S.ents[r.entrenadoId]);
  if(!rs.length){toast('Elegí al menos una rutina');return}
  try{
    if(rs.length===1){const f=pdfDe(rs[0]);RutinaPDF.download(f.data,f.name,'application/pdf');toast('PDF descargado');return}
    const files=[];const used={};
    for(const r of rs){const f=pdfDe(r);let n=f.name;if(used[n]){used[n]++;n=n.replace(/\.pdf$/,` (${used[n]}).pdf`)}else used[n]=1;files.push({name:n,data:f.data})}
    RutinaPDF.download(RutinaPDF.zip(files),`Rutinas para imprimir ${fmtD(iso(today())).replace(/\//g,'-')}.zip`,'application/zip');
    toast(`${rs.length} PDF descargados en un .zip`);
  }catch(err){console.error(err);toast('No se pudo generar el PDF')}
}
function imprimirHTML(){
  const P=S.pr=S.pr||{sel:new Set(),f:'activa',g:'',q:'',modo:'rutinas',selR:new Set(),mes:null};
  P.selR=P.selR||new Set();P.modo=P.modo||'rutinas';
  const modos=`<div class="chips" style="margin-bottom:10px">${[['rutinas','Rutinas'],['reportes','Hojas resumen']].map(([k,l])=>`<button class="chip" data-prmodo="${k}" aria-pressed="${P.modo===k}">${l}</button>`).join('')}</div>`;
  if(P.modo==='reportes')return modos+reportesHTML(P);
  const grupos=[...new Set(Object.values(S.ents).map(e=>e.grupo).filter(Boolean))].sort();
  const q=keyN(P.q);
  const list=S.rutinas.filter(r=>(r.estado==='activa'||r.estado==='cola')&&S.ents[r.entrenadoId]&&isAct(S.ents[r.entrenadoId]))
    .filter(r=>P.f==='todas'||r.estado===P.f).filter(r=>!P.g||S.ents[r.entrenadoId].grupo===P.g)
    .filter(r=>!q||keyN(S.ents[r.entrenadoId].nombre).includes(q)||keyN(r.nombre).includes(q))
    .sort((a,b)=>name(S.ents[a.entrenadoId]).localeCompare(name(S.ents[b.entrenadoId]),'es'));
  S._prList=list.map(r=>r._id);
  const n=[...P.sel].filter(id=>S.rutinas.some(r=>r._id===id)).length;
  return modos+`<p class="hint" style="margin:0 0 10px">Cada rutina sale en un PDF propio, en hoja A4, sin videos y con el teléfono del entrenado. Si elegís varias, se descargan juntas en un .zip.</p>
  <div class="toolbar"><input id="pr-q" class="search" type="search" placeholder="Buscar entrenado o rutina" value="${esc(P.q)}" autocomplete="off">
    <div class="chips">${[['activa','Activas'],['cola','En cola'],['todas','Todas']].map(([k,l])=>`<button class="chip" data-prf="${k}" aria-pressed="${P.f===k}">${l}</button>`).join('')}</div>
    ${grupos.length?`<select id="pr-g" class="search" style="flex:0 1 200px"><option value="">Todos los grupos</option>${grupos.map(g=>`<option ${g===P.g?'selected':''}>${esc(g)}</option>`).join('')}</select>`:''}</div>
  <div class="actions" style="margin-bottom:10px;align-items:center"><button class="btn" data-prall="1">Seleccionar las ${list.length}</button><button class="btn" data-prnone="1">Ninguna</button><button class="btn pri" data-prgo="1" ${n?'':'disabled'} style="margin-left:auto">Descargar PDF (${n})</button></div>
  <div class="card">${list.length?`<ul class="alist">${list.map(r=>{const e=S.ents[r.entrenadoId];return `<li><label style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;cursor:pointer"><input type="checkbox" data-prsel="${esc(r._id)}" ${P.sel.has(r._id)?'checked':''}><span style="min-width:0"><b>${esc(name(e))}</b> <span class="pill ${r.estado==='activa'?'p-ok':'p-warn'}">${r.estado==='activa'?'Activa':'En cola'}</span><br><span class="hint">${esc(r.nombre||'Rutina')} · ${diasDe(r)} días${e.grupo?' · '+esc(e.grupo):''}</span></span></label><button class="btn" style="padding:5px 8px;font-size:13px" data-pdf="${esc(r._id)}">PDF</button></li>`}).join('')}</ul>`:'<div class="empty">No hay rutinas con ese filtro.</div>'}</div>`;
}
function reportesHTML(P){
  const ms=[...new Set([...mesesList(),...S.regs.map(r=>(r.fecha||'').slice(0,7)).filter(Boolean)])].filter(k=>k<=curMes()).sort().reverse();if(!P.mes||!ms.includes(P.mes))P.mes=ms.find(k=>k<curMes())||ms[0];
  P.tipo=P.tipo||'mes';if(!P.vs||P.vs===P.mes)P.vs=ms.find(k=>k<P.mes)||ms.find(k=>k!==P.mes)||'';
  const grupos=[...new Set(Object.values(S.ents).map(e=>e.grupo).filter(Boolean))].sort();const q=keyN(P.q);
  const list=Object.values(S.ents).filter(isAct).filter(e=>!P.g||e.grupo===P.g).filter(e=>!q||keyN(e.nombre).includes(q)).sort((a,b)=>name(a).localeCompare(name(b),'es'));
  S._prList=list.map(e=>e.id);const n=P.selR.size;
  const act=e=>{const r=S.regs.filter(x=>x.entrenadoId===e.id&&x.fecha&&x.fecha.startsWith(P.mes));return {a:new Set(r.filter(x=>String(x.item).startsWith('asis:')).map(x=>x.fecha+x.item)).size,k:r.filter(x=>!especial(x)&&parseFloat(x.kg)>0).length}};
  return `<p class="hint" style="margin:0 0 10px">Una hoja A4 a color por entrenado con asistencia, fuerza, carga y bienestar, cada dato con su explicación. No incluye pagos. Si elegís varios, se descargan juntos en un .zip.</p>
  <div class="chips" style="margin-bottom:10px">${[['mes','Resumen del mes'],['comp','Comparativa entre dos meses']].map(([k,l])=>`<button class="chip" data-prtipo="${k}" aria-pressed="${P.tipo===k}">${l}</button>`).join('')}</div>
  <div class="toolbar"><input id="pr-q" class="search" type="search" placeholder="Buscar entrenado" value="${esc(P.q)}" autocomplete="off">
    <select id="pr-mes" class="search" style="flex:0 1 200px">${ms.map(k=>`<option value="${k}" ${k===P.mes?'selected':''}>${mesLbl(k)}</option>`).join('')}</select>
    ${P.tipo==='comp'?`<span style="display:flex;gap:6px;align-items:center">vs <select id="pr-vs" class="search" style="flex:0 1 200px">${ms.filter(k=>k!==P.mes).map(k=>`<option value="${k}" ${k===P.vs?'selected':''}>${mesLbl(k)}</option>`).join('')}</select></span>`:''}
    ${grupos.length?`<select id="pr-g" class="search" style="flex:0 1 200px"><option value="">Todos los grupos</option>${grupos.map(g=>`<option ${g===P.g?'selected':''}>${esc(g)}</option>`).join('')}</select>`:''}</div>
  <div class="actions" style="margin-bottom:10px;align-items:center"><button class="btn" data-prall="1">Seleccionar los ${list.length}</button><button class="btn" data-prnone="1">Ninguno</button><button class="btn pri" data-prgo="1" ${n?'':'disabled'} style="margin-left:auto">Descargar hojas (${n})</button></div>
  <div class="card">${list.length?`<ul class="alist">${list.map(e=>{const x=act(e);return `<li><label style="display:flex;gap:10px;align-items:center;flex:1;min-width:0;cursor:pointer"><input type="checkbox" data-prsel="${esc(e.id)}" ${P.selR.has(e.id)?'checked':''}><span style="min-width:0"><b>${esc(name(e))}</b><br><span class="hint">${x.a} entrenamientos marcados · ${x.k} cargas de kg${e.grupo?' · '+esc(e.grupo):''}</span></span></label></li>`}).join('')}</ul>`:'<div class="empty">No hay entrenados con ese filtro.</div>'}</div>`;
}
function bindImprimir(){
  const P=S.pr,el=$('#v-rutinas');
  const q=$('#pr-q');q.addEventListener('input',()=>{P.q=q.value;const c=q.selectionStart;renderRutinas();const n=$('#pr-q');n.focus();n.setSelectionRange(c,c)});
  const g=$('#pr-g');if(g)g.addEventListener('change',()=>{P.g=g.value;renderRutinas()});
  const sel=()=>P.modo==='reportes'?P.selR:P.sel;
  const pm=$('#pr-mes');if(pm)pm.addEventListener('change',()=>{P.mes=pm.value;renderRutinas()});
  const pv=$('#pr-vs');if(pv)pv.addEventListener('change',()=>{P.vs=pv.value});
  el.onchange=ev=>{const c=ev.target.closest('[data-prsel]');if(!c)return;c.checked?sel().add(c.dataset.prsel):sel().delete(c.dataset.prsel);const b=el.querySelector('[data-prgo]');const n=sel().size;b.textContent=P.modo==='reportes'?`Descargar hojas (${n})`:`Descargar PDF (${n})`;b.disabled=!n};
  el.onclick=ev=>{let b;
    if(b=ev.target.closest('[data-prtipo]')){P.tipo=b.dataset.prtipo;renderRutinas()}
    else if(b=ev.target.closest('[data-prmodo]')){P.modo=b.dataset.prmodo;P.q='';renderRutinas()}
    else if(b=ev.target.closest('[data-prf]')){P.f=b.dataset.prf;renderRutinas()}
    else if(ev.target.closest('[data-prall]')){(S._prList||[]).forEach(id=>sel().add(id));renderRutinas()}
    else if(ev.target.closest('[data-prnone]')){sel().clear();renderRutinas()}
    else if(ev.target.closest('[data-prgo]')){P.modo==='reportes'?descargarReportes([...P.selR],P.mes,P.tipo==='comp'?P.vs:null):descargarPDFs([...P.sel])}};
}

/* ----- copiar rutina de otro entrenado ----- */
function reuid(secs){const c=clone(secs||[]);c.forEach(s=>{s.uid=ruid();(s.dias||[]).forEach(d=>{d.uid=ruid();(d.bloques||[]).forEach(b=>{b.uid=ruid();(b.items||[]).forEach(i=>i.uid=ruid())})})});return c}
function copiarHTML(arg){
  const dest=S.ents[arg.para];const q=keyN(arg.q||'');
  const ord={activa:0,cola:1,finalizada:2};
  const list=S.rutinas.filter(r=>r.entrenadoId!==arg.para&&S.ents[r.entrenadoId])
    .filter(r=>!q||keyN(S.ents[r.entrenadoId].nombre).includes(q)||keyN(r.nombre).includes(q))
    .sort((a,b)=>(ord[a.estado]??3)-(ord[b.estado]??3)||(b.fechaEntrega||b.fechaSugerida||'').localeCompare(a.fechaEntrega||a.fechaSugerida||''))
    .slice(0,80);
  const lbl={activa:['Activa','p-ok'],cola:['En cola','p-warn'],finalizada:['Finalizada','p-mute']};
  return `<p class="hint">Elegí la rutina que querés copiar para <b>${esc(name(dest))}</b>. Se crea una copia nueva en su cola: la rutina original no se modifica.</p>
  <input id="cp-q" class="search" placeholder="Buscar por entrenado o nombre de rutina" value="${esc(arg.q||'')}" autocomplete="off">
  <div class="card">${list.length?`<ul class="alist">${list.map(r=>{const e=S.ents[r.entrenadoId];const l=lbl[r.estado]||[r.estado,'p-mute'];return `<li><span class="nm" style="white-space:normal"><b>${esc(name(e))}</b> <span class="pill ${l[1]}">${l[0]}</span><br><span class="hint">${esc(r.nombre||'Rutina')} · ${diasDe(r)} días · ${plural((r.secciones||[]).length,'sección','secciones')}${r.fechaEntrega?' · '+fmtShort(r.fechaEntrega):''}</span></span><button class="btn pri" style="padding:5px 10px;font-size:13px" data-usar="${esc(r._id)}">Usar esta</button></li>`}).join('')}</ul>`:`<div class="empty">${S.rutinas.length?'No hay rutinas que coincidan.':'Todavía no hay rutinas de otros entrenados.'}</div>`}</div>
  <div class="actions"><button class="btn" type="button" data-close>Cancelar</button></div>`;
}
function bindCopiar(arg){
  const ov=$('#overlay');
  ov.onclick=ev=>{
    if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    const u=ev.target.closest('[data-usar]');if(!u)return;
    const src=S.rutinas.find(x=>x._id===u.dataset.usar);const dest=S.ents[arg.para];if(!src||!dest)return;
    const d={entrenadoId:dest.id,nombre:src.nombre||'Rutina',estado:'cola',fechaSugerida:iso(today()),duracionSemanas:src.duracionSemanas||4,
      secciones:reuid(src.secciones),notas:src.notas||'',controlCarga:!!src.controlCarga,bienestar:!!src.bienestar,copiadaDe:{entrenadoId:src.entrenadoId,rutinaId:src._id},creada:Date.now()};
    openEditor('rutinas',null,d);
    toast('Copia lista para editar. Guardá para ponerla en la cola de '+firstName(dest));
  };
  const q=$('#cp-q');q.addEventListener('input',()=>{arg.q=q.value;const p=q.selectionStart;renderSheet();const n=$('#cp-q');n.focus();n.setSelectionRange(p,p)});
}



/* ----- ver rutinas anteriores (lo indicado y lo que anotó el entrenado) ----- */
function rutVistaHTML(r,e,compact){
  const regs=S.regs.filter(x=>x.rutinaId===r._id&&x.entrenadoId===r.entrenadoId);
  const porItem={};regs.filter(x=>!especial(x)).forEach(x=>{(porItem[x.item]=porItem[x.item]||[]).push(x)});
  const asisN=uid=>new Set(regs.filter(x=>x.item==='asis:'+uid).map(x=>x.fecha)).size;
  const fmtKg=v=>String(v).replace('.',',');
  const dias=(r.secciones||[]).flatMap((s,si)=>(s.dias||[]).map(d=>({s,si,d})));
  const multi=(r.secciones||[]).length>1;
  const per=r.fechaEntrega?`${fmtD(r.fechaEntrega)}${r.fechaFin?' al '+fmtD(r.fechaFin):r.estado==='activa'?' · en curso':''}`:'Sin entregar';
  let h=compact?'':`<div class="card pad rv-h"><div class="actions" style="justify-content:space-between;align-items:center"><span><span class="pill ${r.estado==='activa'?'p-ok':r.estado==='cola'?'p-warn':'p-mute'}">${{activa:'Activa',cola:'En cola',finalizada:'Finalizada'}[r.estado]||r.estado}</span> <b>${esc(r.nombre||'Rutina')}</b></span><span class="hint">${per} · ${r.duracionSemanas||'?'} semanas</span></div>
    ${r.notas?`<p class="rv-notas">${esc(r.notas)}</p>`:''}
    <div class="actions"><button class="btn" type="button" data-pdf="${esc(r._id)}">PDF</button><button class="btn" type="button" data-duprut="${esc(r._id)}">Usar como base para una nueva</button><button class="btn" type="button" data-rvia="${esc(r._id)}">Copiar para Claude</button>${r.estado!=='finalizada'?`<button class="btn" type="button" data-editrut="${esc(r._id)}">Abrir en el editor</button>`:''}</div>
    <p class="hint" style="margin:0">En verde, lo que anotó el entrenado. “Tildado” = lo hizo con lo indicado.</p></div>`;
  h+=dias.map(({s,d})=>{const n=asisN(d.uid);
    return `<div class="card rv-dia"><div class="rv-dh"><b>${multi?esc(s.titulo||'')+' · ':''}${esc(d.nombre||'Día')}</b>${r.estado!=='cola'?`<span class="pill ${n?'p-ok':'p-mute'}">${n?plural(n,'vez hecho','veces hecho'):'Sin marcar'}</span>`:''}</div>
      ${(d.bloques||[]).map(b=>{const its=(b.items||[]).filter(i=>!itemVacio(i));if(!its.length)return '';const tm=b.modo==='timer',ds=b.modo==='dist';
        return `<div class="rv-bl"><div class="rv-bn">${esc(b.nombre||'')}<span>${ds?esc(distBlk(b)):tm?`⏱ ${esc(b.trabajo||40)}" / ${esc(b.descanso||20)}" × ${esc(b.vueltas||3)} vueltas`:(b.series?esc(b.series)+' series':'')}</span></div>
        ${its.map(it=>{const k=kgItem(it,e);const pres=ds?[esc(distTxt(it))]:[tm?'':esc(it.reps||''),it.pct?`${esc(it.pct)}%${k.txt?' = '+fmtKg(k.txt)+' kg':''}`:(it.kg?fmtKg(it.kg)+' '+uniDe(it):'')].filter(Boolean).join(' · ');
          const rs=(porItem[it.uid]||[]);const conKg=rs.filter(x=>numKg(x.kg)>0);const best=conKg.reduce((m,x)=>!m||numKg(x.kg)>numKg(m.kg)?x:m,null);
          const hecho=best?`<span class="rv-done">${fmtKg(best.kg)} kg${best.reps?' × '+esc(best.reps):''}${conKg.length>1?` <i>(${conKg.length} registros)</i>`:''}</span>`:rs.length?'<span class="rv-done">Tildado</span>':'';
          return `<div class="rv-it"><span class="rv-n">${esc(it.nombre)}${it.notas?`<i>${esc(it.notas)}</i>`:''}</span><span class="rv-p">${pres}</span>${hecho}</div>`}).join('')}</div>`}).join('')}</div>`}).join('');
  return h;
}
function rutAnterior(R,eid){return rutDe(eid).filter(r=>r._id!==S.edit?.id&&(r.estado==='finalizada'||r.estado==='activa')).sort((a,b)=>(b.fechaEntrega||'').localeCompare(a.fechaEntrega||''))[0]||null}
/* ----- asistente con Claude: copiar para Claude / importar rutina ----- */
function copyTxt(t){const fb=()=>{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(x){}ta.remove();return ok};
  const p=navigator.clipboard?.writeText(t);if(p)return p.then(()=>true,()=>fb());return Promise.resolve(fb())}
function rutLimpia(R){
  const num=v=>v==null||v===''?undefined:Number(v);
  return {entrena:'rutina',v:1,nombre:R.nombre||'',duracionSemanas:Number(R.duracionSemanas)||4,notas:R.notas||'',
    opciones:{bienestar:!!R.bienestar,ajusteWellness:!!R.ajusteWellness,controlCarga:!!R.controlCarga},
    secciones:(R.secciones||[]).map(s=>({titulo:s.titulo||'',...(s.posicion?{posicion:s.posicion}:{}),dias:(s.dias||[]).map(d=>({nombre:d.nombre||'',bloques:(d.bloques||[]).map(b=>{
      const o={nombre:b.nombre||'',series:String(b.series??'')};
      if(b.modo==='timer'){o.modo='timer';o.trabajo=num(b.trabajo)??40;o.descanso=num(b.descanso)??20;o.vueltas=num(b.vueltas)??3;o.pausa=num(b.pausa)??0}
      if(b.modo==='dist'){o.modo='dist';if(String(b.pausaSeries||'').trim())o.pausaSeries=String(b.pausaSeries)}
      if(b.modo==='test')o.modo='test';
      o.items=(b.items||[]).filter(i=>!itemVacio(i)).map(i=>{const x={nombre:i.nombre||''};(b.modo==='dist'?['metros','reps','tiempo','pausa','notas']:['reps','kg','pct','rm','notas','unidad']).forEach(k=>{if(String(i[k]??'').trim())x[k]=String(i[k])});return x});
      return o})}))}))}
}
function iaTexto(e,R){
  const id=e.id,nom=String(e.nombre||'').trim(),partes=nom.split(/\s+/).filter(x=>x.length>2);
  const anon=t=>{let x=String(t||'');if(nom)x=x.split(nom).join(id);partes.forEach(p=>{x=x.replace(new RegExp('\\b'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),id)});return x};
  const hoy=iso(today()),d=n=>{const x=new Date(today());x.setDate(x.getDate()-n);return iso(x)};
  const L=[];
  L.push('PEDIDO DE RUTINA · entrená. (seguí la Guía metodológica del proyecto)');
  L.push(`ID: ${id} · Perfil: ${e.perfil||'sin definir'} · Nivel: ${e.nivel||'sin definir'}`);
  L.push(`Objetivo: ${anon(e.objetivo)||'sin definir'}`);
  L.push(`Estímulos por semana: ${e.estimulos||'?'} · Plan: ${e.plan||'—'}${e.grupo?' · Grupo: '+anon(e.grupo):''}${e.posicion?' · Posición: '+e.posicion:''}`);
  L.push(`Fecha: ${hoy}${e.inicio?' · Entrena desde: '+e.inicio:''}`);
  const rms=movs().map(m=>{const v=rmValue(e,m);return v?`${m} ${String(v).replace('.',',')} kg`:''}).filter(Boolean);
  L.push('RM: '+(rms.length?rms.join('; '):'sin cargar'));
  if(String(e.obs||'').trim())L.push('Observaciones: '+anon(e.obs).replace(/\s+/g,' '));
  const hs=S.hist.filter(h=>h.entrenadoId===id&&(h.fecha||'')>=d(180)&&!/^(Pago|Estado|Otro)$/.test(h.tipo||'')).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).slice(0,15);
  if(hs.length){L.push('Historial (últimos 6 meses):');hs.forEach(h=>L.push(`- ${h.fecha} · ${h.tipo}: ${anon(h.detalle)}`))}
  const asis=new Set(S.regs.filter(r=>r.entrenadoId===id&&String(r.item||'').startsWith('asis:')&&r.fecha>=d(28)).map(r=>r.fecha+r.item)).size;
  L.push(`Asistencia últimas 4 semanas: ${asis} de ${(Number(e.estimulos)||0)*4||'?'}`);
  const bs=S.regs.filter(r=>r.entrenadoId===id&&r.tipo==='bien'&&r.fecha>=d(28)).map(r=>estadoBien(id,r.fecha)?.k).filter(Boolean);
  if(bs.length){const c=k=>bs.filter(x=>x===k).length;L.push(`Wellness últimas 4 semanas: verde ${c('verde')}, amarillo ${c('amarillo')}, rojo ${c('rojo')}`)}
  if(R){
    const ini=R.fechaEntrega||d(35),g=kgPorEj(e,ini,hoy),best=o=>Object.values(o).filter(x=>!x.plan).reduce((m,x)=>!m||x.kg>m.kg?x:m,null);
    const rows=Object.values(g).map(x=>{const b=best(x.p);return b?`- ${x.nombre}: mejor ${String(b.kg).replace('.',',')} kg${b.reps?' × '+b.reps:''}`:''}).filter(Boolean);
    if(rows.length){L.push(`Cargas anotadas desde ${ini}:`);L.push(...rows)}
    L.push('');L.push(`Rutina ${R.estado==='activa'?'actual':R.estado==='cola'?'en cola':'anterior'} (formato de importación):`);
    L.push('```json');L.push(JSON.stringify(rutLimpia({...R,nombre:anon(R.nombre),notas:anon(R.notas)})));L.push('```');
  }else L.push('','Sin rutina previa en la app.');
  L.push('','Pedido: (escribí acá qué querés para la próxima rutina)');
  return L.join('\n');
}
function iaRutBase(id){return activaDe(id)||colaDe(id).slice(-1)[0]||rutDe(id).filter(r=>r.estado==='finalizada').sort((a,b)=>(b.fechaFin||'').localeCompare(a.fechaFin||''))[0]||null}
function iaCopiar(e,R){copyTxt(iaTexto(e,R)).then(ok=>toast(ok?'Copiado: pegalo en el proyecto de Claude':'No se pudo copiar'))}
function iaImportar(txt,R){
  const a=txt.indexOf('{'),z=txt.lastIndexOf('}');if(a<0||z<a)throw new Error('No encontré el bloque de la rutina. Copiá todo el bloque de código que te dio Claude.');
  let j;try{j=JSON.parse(txt.slice(a,z+1))}catch(x){throw new Error('El bloque está incompleto o tiene un error. Pedile a Claude que lo vuelva a generar.')}
  if(!Array.isArray(j.secciones)||!j.secciones.length)throw new Error('El bloque no trae secciones con días.');
  const idx=ejByName(),mv={};movs().forEach(m=>mv[keyN(m)]=m);
  const sinEj=new Set(),sinRm=new Set();let nEj=0;const str=v=>v==null?'':String(v);
  const secs=j.secciones.map((s,si)=>({uid:ruid(),titulo:str(s.titulo)||'Semana '+(si+1),posicion:str(s.posicion),dias:(s.dias||[]).map((d,di)=>({uid:ruid(),nombre:str(d.nombre)||'Día '+(di+1),bloques:(d.bloques||[]).map(b=>{
    const o={uid:ruid(),nombre:str(b.nombre)||'BLOQUE',series:str(b.series)};
    if(b.modo==='timer'){o.modo='timer';['trabajo','descanso','vueltas','pausa'].forEach(k=>{if(b[k]!=null)o[k]=str(b[k])})}
    const ds=b.modo==='dist'||b.modo==='distancias';if(ds){o.modo='dist';if(b.pausaSeries!=null)o.pausaSeries=str(b.pausaSeries)}
    o.items=(b.items||[]).map(i=>{const it=newItem();const nm=str(i.nombre||i.ej).trim();const id=idx[keyN(nm)]||'';
      it.nombre=id?S.ejs[id].nombre:nm;it.ej=id;if(nm&&!id)sinEj.add(nm);if(nm)nEj++;
      ['reps','kg','pct','notas'].forEach(k=>it[k]=str(i[k]).replace(/%$/,''));if(i.unidad&&UNIS.some(u=>u[0]===i.unidad))it.unidad=i.unidad;else if(id&&S.ejs[id].unidad)it.unidad=S.ejs[id].unidad;
      if(ds){['metros','tiempo','pausa'].forEach(k=>{if(i[k]!=null)it[k]=k==='metros'?str(i[k]).replace(/\s*m$/i,''):str(i[k])});it.kg='';it.pct=''}
      if(i.rm){const m=mv[keyN(i.rm)];if(m)it.rm=m;else sinRm.add(str(i.rm))}
      if(it.pct&&!it.rm&&id)it.rm=S.ejs[id].rm||'';
      return it});
    if(!o.items.length)o.items=[newItem()];return o})}))}));
  if(!secs.some(s=>s.dias.length))throw new Error('El bloque no trae días.');
  R.secciones=secs;if(str(j.nombre).trim())R.nombre=str(j.nombre).trim();if(j.notas!=null)R.notas=str(j.notas);
  if(Number(j.duracionSemanas))R.duracionSemanas=Number(j.duracionSemanas);
  const op=j.opciones||{};['bienestar','ajusteWellness','controlCarga'].forEach(k=>{if(k in op)R[k]=!!op[k]});if(R.ajusteWellness)R.bienestar=true;
  if(R.distribucion)delete R.distribucion;
  return {dias:secs[0].dias.length,secs:secs.length,nEj,sinEj:[...sinEj],sinRm:[...sinRm]};
}
function impHTML(E,isRut,e){
  const m=E.impRes;
  return `<div class="card pad imp-box">${E.imp?`<b>Importar rutina de Claude</b><p class="hint">Pegá el bloque que te devolvió Claude. Reemplaza los días de esta rutina; queda como borrador hasta que la guardes y la entregues vos.</p>
    <textarea id="imp-txt" rows="7" placeholder='{"entrena": "rutina", ...}'></textarea>${E.impErr?`<p class="imp-err">${esc(E.impErr)}</p>`:''}
    <div class="actions"><button class="btn pri" type="button" data-act="impGo">Cargar en el editor</button><button class="btn" type="button" data-act="impX">Cancelar</button></div>`
  :`<b>Rutina importada de Claude</b><p class="hint">${m.secs>1?m.secs+' secciones · ':''}${m.dias} días · ${m.nEj} ejercicios.${isRut&&e&&Number(e.estimulos)&&m.dias!==Number(e.estimulos)?` Ojo: paga ${e.estimulos} estímulos.`:''} Revisala y tocá Guardar.</p>
    ${m.sinEj.length?`<p class="imp-warn"><b>No están en tu biblioteca (sin video):</b> ${m.sinEj.map(esc).join(' · ')}</p>`:''}
    ${m.sinRm.length?`<p class="imp-warn"><b>Marcas de RM que no existen en Ajustes:</b> ${m.sinRm.map(esc).join(' · ')}. Elegí la marca en esos ejercicios.</p>`:''}
    <div class="actions"><button class="btn" type="button" data-act="impOk">Entendido</button></div>`}</div>`;
}
/* ----- editor de rutinas y plantillas ----- */
function newSeccion(n){return {uid:ruid(),titulo:'Semana 1',posicion:'',dias:Array.from({length:n||3},(_,i)=>newDia(i))}}
function newDia(i){return {uid:ruid(),nombre:'Día '+(i+1),bloques:(S.cfg.bloques||['FUERZA 1']).map(b=>({uid:ruid(),nombre:b,series:'3',items:[newItem()]}))}}
function newItem(){return {uid:ruid(),ej:'',nombre:'',reps:'',kg:'',pct:'',rm:'',notas:''}}
function openEditor(col,id,data){S.edit={col,id,data:clone(data),sec:0,dirty:false};openSheet('__rut','edit')}
function editorHTML(){
  const E=S.edit,R=E.data,isRut=E.col==='rutinas',e=isRut?S.ents[R.entrenadoId]:null;
  R.secciones=R.secciones||[];if(!R.secciones.length)R.secciones.push(newSeccion(e?Number(e.estimulos)||3:3));
  if(E.sec>=R.secciones.length)E.sec=R.secciones.length-1;
  const s=R.secciones[E.sec],P=E.sec;
  const nd=diasDe(R),est=e?Number(e.estimulos):0;
  const estLbl={cola:'En cola',activa:'Activa',finalizada:'Finalizada',borrador:'Borrador'};
  const ro=isRut&&R.estado==='finalizada';
  const inp=(path,f,v,ph,w)=>`<input data-p="${path}" data-f="${f}" value="${esc(v??'')}" placeholder="${ph||''}" ${w?`style="width:${w}"`:''} ${ro?'readonly':''}>`;
  const items=(d,b,bl)=>bl.items.map((it,i)=>{const path=`${P},${d},${b},${i}`;const k=isRut?kgItem(it,e):null;const has=it.ej&&S.ejs[it.ej];
    const tm=bl.modo==='timer',ds=bl.modo==='dist';const vac=itemVacio(it),fEj=!vac&&!String(it.nombre||'').trim(),fRe=!tm&&!vac&&!fEj&&!String((ds?it.metros:it.reps)||'').trim();
    const acts=ro?'':`<span class="it-a"><button type="button" data-act="up" data-p="${path}" aria-label="Subir">↑</button><button type="button" data-act="down" data-p="${path}" aria-label="Bajar">↓</button><button type="button" data-act="delItem" data-p="${path}" aria-label="Quitar">✕</button></span>`;
    if(bl.modo==='test')return `<div class="it it-tst"><div class="it-ej"><b>${esc(it.nombre)}</b></div><span class="hint">${esc(it.notas||'')}</span>${acts}</div>`;
    if(ds){const pv=distTxt(it);return `<div class="it it-ds${fEj||fRe?' it-falta':''}">
      <div class="it-ej ac-wrap"><input data-ac="1" autocomplete="off" class="${fEj?'falta':''}" data-p="${path}" data-f="nombre" value="${esc(it.nombre)}" placeholder="${fEj?'Falta el ejercicio':'Ej: Pique lanzado'}" ${ro?'readonly':''}>${it.nombre&&has&&S.ejs[it.ej].video?`<a class="vid" target="_blank" rel="noopener" href="${esc(S.ejs[it.ej].video)}" title="Ver video">▶</a>`:''}</div>
      <label class="${fRe?'falta-l':''}">Metros${inp(path,'metros',it.metros,fRe?'Falta':'30')}</label>
      <label>Reps${inp(path,'reps',it.reps,'6')}</label>
      <label>En (seg)${inp(path,'tiempo',it.tiempo,'opcional')}</label>
      <label>Pausa${inp(path,'pausa',it.pausa,'opcional')}</label>
      <label class="it-n">Notas${inp(path,'notas',it.notas,'Máx. velocidad')}</label>
      ${acts}
      <div class="it-pv" data-pv="${path}">${pv?'Se ve: <b>'+esc(pv)+'</b>':'Ej: 30 m · 6 reps · en 4.5" · pausa 1\'30"'}</div>
    </div>`}
    return `<div class="it${fEj||fRe?' it-falta':''}${tm?' it-tm':''}">
      <div class="it-ej ac-wrap"><input data-ac="1" autocomplete="off" class="${fEj?'falta':''}" data-p="${path}" data-f="nombre" value="${esc(it.nombre)}" placeholder="${fEj?'Falta el ejercicio':'Ejercicio'}" ${ro?'readonly':''}>${it.nombre?(has?(S.ejs[it.ej].video?`<a class="vid" target="_blank" rel="noopener" href="${esc(S.ejs[it.ej].video)}" title="Ver video">▶</a>`:''):`<button type="button" class="miss" data-addej="${esc(it.nombre)}" title="No está en la biblioteca">+ video</button>`):''}</div>
      ${tm?'':`<label class="${fRe?'falta-l':''}">Reps${fRe?`<input data-p="${path}" data-f="reps" value="" placeholder="Falta" class="falta" ${ro?'readonly':''}>`:inp(path,'reps',it.reps,'10')}</label>`}
      <label class="u-l"><select class="u-sel" data-p="${path}" data-f="unidad" aria-label="Unidad" ${ro?'disabled':''}>${UNIS.map(([k,l])=>`<option value="${k}" ${uniDe(it)===k?'selected':''}>${l}</option>`).join('')}</select>${inp(path,'kg',it.kg,it.pct?'auto':'')}</label>
      <label>%RM${inp(path,'pct',it.pct,'')}</label>
      ${it.pct?`<label>Marca<select data-p="${path}" data-f="rm" ${ro?'disabled':''}><option value="">—</option>${movs().map(m=>`<option ${m===it.rm?'selected':''}>${esc(m)}</option>`).join('')}</select></label>`:''}
      <label class="it-n">Notas${inp(path,'notas',it.notas,'Tempo, RPE…')}</label>
      ${k&&it.pct?`<span class="pill ${k.falta?'p-warn':'p-ok'}" style="align-self:end">${k.falta?'Falta RM':'= '+k.txt+' kg'}</span>`:''}
      ${acts}
      ${isRut&&e&&it.uid&&!ro?entBadge(it,path,e,tm):''}
    </div>`}).join('');
  const fal=faltantes(R),falDia=(si,di)=>fal.find(x=>x.si===si&&x.di===di);
  const prev=isRut&&e&&!ro?rutAnterior(R,e.id):null;
  const iaBar=ro?'':`<div class="full actions ia-bar"><span class="ia-l">Con Claude</span><button class="btn" type="button" data-act="imp">Importar rutina</button>${isRut&&e?'<button class="btn" type="button" data-act="iaexp">Copiar para Claude</button>':''}${prev?`<button class="btn" type="button" data-act="prev" aria-pressed="${!!E.prev}">${E.prev?'Ocultar':'Ver'} rutina anterior</button>`:''}</div>`;
  const prevHTML=prev&&E.prev?`<div class="card pad rv-prev"><div class="actions" style="justify-content:space-between"><b>Anterior: ${esc(prev.nombre||'Rutina')}</b><span class="hint">${prev.fechaEntrega?fmtD(prev.fechaEntrega):''}${prev.fechaFin?' al '+fmtD(prev.fechaFin):prev.estado==='activa'?' · activa':''}</span></div>${rutVistaHTML(prev,e,true)}</div>`:'';
  return `<datalist id="dl-bl">${(S.cfg.bloques||[]).map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
  ${E.imp||E.impRes?impHTML(E,isRut,e):''}
  ${prevHTML}
  <div class="form card pad" id="ed-head">
    ${iaBar}
    ${fal.length?`<div class="full falta-box"><b>Faltan completar ${plural(fal.length,'día','días')}</b>${fal.map(x=>`<span>${esc(x.lugar)}: ${esc(x.txt)}</span>`).join('')}</div>`:''}
    ${isRut?`<div class="full actions">${e?`<b>${esc(name(e))}</b>`:''}<span class="pill ${R.estado==='activa'?'p-ok':R.estado==='cola'?'p-warn':'p-mute'}">${estLbl[R.estado]||R.estado}</span>${est&&nd&&est!==nd?`<span class="pill p-warn">${nd} días · paga ${est} estímulos</span>`:''}${R.distribucion?'<span class="pill p-lv">Con rotación semanal</span>':''}</div>`:''}
    <label class="full">Nombre<input data-h="nombre" value="${esc(R.nombre||'')}" ${ro?'readonly':''}></label>
    ${isRut?`<label>Entrega sugerida<input type="date" data-h="fechaSugerida" value="${esc(R.fechaSugerida||'')}" ${ro||R.estado!=='cola'?'readonly':''}></label>`:`<label>Tipo<select data-h="tipo"><option value="individual" ${R.tipo!=='equipo'?'selected':''}>Individual</option><option value="equipo" ${R.tipo==='equipo'?'selected':''}>Equipo</option></select></label>`}
    <label>Duración (semanas)<input type="number" min="1" max="16" data-h="duracionSemanas" value="${esc(R.duracionSemanas||4)}" ${ro?'readonly':''}></label>
    <div class="full plan-box"><b>Opciones del link del entrenado</b><p class="hint">Solo aparecen en esta rutina si las activás.</p>
      <label class="plan-on"><input type="checkbox" data-opt="controlCarga" ${R.controlCarga?'checked':''} ${ro?'disabled':''}> <span><b>Control de carga:</b> al marcar el día hecho, anota cuántos minutos duró y qué tan dura fue (1 a 10). También sale una fila para anotarlo en el PDF.</span></label>
      <label class="plan-on"><input type="checkbox" data-opt="bienestar" ${R.bienestar?'checked':''} ${ro?'disabled':''}> <span><b>Wellness obligatorio:</b> antes de ver la rutina responde 5 preguntas (sueño, energía, dolor, estrés y ánimo, de 1 a 5).</span></label>
      <label class="plan-on"><input type="checkbox" data-opt="ajusteWellness" ${R.ajusteWellness?'checked':''} ${ro?'disabled':''}> <span><b>Ajustar cargas según el wellness:</b> moderado −5%, bajo −10% y una serie menos (ejercicios con %RM). En circuitos, más descanso o una vuelta menos. Activa también el wellness.</span></label></div>
    <div class="full plan-box"><b>Indicaciones para el entrenado</b><p class="hint">Aparecen arriba de todo en su link y en el PDF, como lista. Escribí una por renglón.</p>
      <textarea data-h="notas" rows="3" placeholder="Ej:&#10;Entrada en calor 10': movilidad de cadera y hombros&#10;Nada al fallo: cortá la serie si cae la velocidad" ${ro?'readonly':''}>${esc(R.notas||'')}</textarea>
      ${planHTML(R,e,ro)}</div>
  </div>
  <div class="chips">${R.secciones.map((x,i)=>`<button class="chip" type="button" data-sec="${i}" aria-pressed="${i===E.sec}">${esc(x.titulo||'Sección '+(i+1))}${x.posicion?' · '+esc(x.posicion):''}${fal.some(f=>f.si===i)?' <span class="dot-bad" title="Sin terminar"></span>':''}</button>`).join('')}${ro?'':'<button class="chip" type="button" data-act="addSec">+ Sección</button>'}</div>
  <div class="form card pad">
    <label>Título de la sección<input data-p="${P}" data-f="titulo" value="${esc(s.titulo||'')}" placeholder="Semana 1 y 3" ${ro?'readonly':''}></label>
    <label>Posición (equipos)<select data-p="${P}" data-f="posicion" ${ro?'disabled':''}><option value="">Todas</option>${(S.cfg.posiciones||[]).map(x=>`<option ${keyN(x)===keyN(s.posicion)?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
    ${ro?'':`<div class="full actions"><button class="btn" type="button" data-act="dupSec">Duplicar sección</button><button class="btn" type="button" data-act="addDia">+ Día</button><button class="btn" type="button" data-act="clearSec">Vaciar sección</button>${R.secciones.length>1?'<button class="btn danger" type="button" data-act="delSec">Quitar sección</button>':''}</div>`}
  </div>
  ${s.dias.map((dia,d)=>`<div class="card dia${falDia(P,d)?' dia-falta':''}"><div class="dia-h"><input class="dia-n" data-p="${P},${d}" data-f="nombre" value="${esc(dia.nombre)}" ${ro?'readonly':''}>${falDia(P,d)?`<span class="pill p-bad">${esc(falDia(P,d).txt)}</span>`:'<span class="pill p-ok">Completo</span>'}${dia.bloques.length>1?(()=>{const all=dia.bloques.every((bl,b)=>E.pleg&&E.pleg[bl.uid||`${P},${d},${b}`]);return `<button type="button" class="btn" data-act="${all?'despDia':'plegDia'}" data-p="${P},${d}">${all?'Expandir bloques':'Minimizar bloques'}</button>`})():''}${ro?'':`<button type="button" class="btn" data-act="addBloque" data-p="${P},${d}">+ Bloque</button><button type="button" class="btn" data-act="addTest" data-p="${P},${d}">+ Test</button><button type="button" class="btn" data-act="clearDia" data-p="${P},${d}">Vaciar día</button><button type="button" class="btn danger" data-act="delDia" data-p="${P},${d}">Quitar día</button>`}</div>${!ro&&E.testPick===`${P},${d}`?testPickHTML(`${P},${d}`):''}
    ${dia.bloques.map((bl,b)=>{const bk=bl.uid||`${P},${d},${b}`,pl=!!(E.pleg&&E.pleg[bk]);const noms=bl.items.filter(i=>String(i.nombre||'').trim()).map(i=>i.nombre);const nb=dia.bloques.length;return `<div class="bl${bl.items.every(itemVacio)?' bl-vacio':''}${pl?' plegado':''}${bl.modo==='dist'?' bl-ds':''}" data-bi="${b}"><div class="bl-h">${ro||nb<2?'':`<span class="bl-grip" data-grip="${P},${d},${b}" title="Arrastrar para mover" aria-hidden="true"><svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor"><circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/></svg></span>`}<button type="button" class="bl-tg" data-act="pleg" data-k="${esc(bk)}" aria-expanded="${!pl}" title="${pl?'Expandir bloque':'Minimizar bloque'}">${pl?'▸':'▾'}</button><input list="dl-bl" class="bl-n" data-p="${P},${d},${b}" data-f="nombre" value="${esc(bl.nombre)}" ${ro?'readonly':''}><label>Modalidad<select data-p="${P},${d},${b}" data-f="modo" ${ro?'disabled':''}><option value="">Por series</option><option value="timer" ${bl.modo==='timer'?'selected':''}>Circuito por tiempo ⏱</option><option value="dist" ${bl.modo==='dist'?'selected':''}>Distancias (metros)</option></select></label>${bl.modo==='dist'?`<label>Series<input data-p="${P},${d},${b}" data-f="series" value="${esc(bl.series??'')}" placeholder="1" style="width:56px" ${ro?'readonly':''}></label><label>Pausa series<input data-p="${P},${d},${b}" data-f="pausaSeries" value="${esc(bl.pausaSeries??'')}" placeholder="3'" style="width:70px" ${ro?'readonly':''}></label>`:bl.modo==='timer'?`<label>Trabajo (seg)<input data-p="${P},${d},${b}" data-f="trabajo" value="${esc(bl.trabajo??'40')}" inputmode="numeric" style="width:64px" ${ro?'readonly':''}></label><label>Descanso (seg)<input data-p="${P},${d},${b}" data-f="descanso" value="${esc(bl.descanso??'20')}" inputmode="numeric" style="width:64px" ${ro?'readonly':''}></label><label>Vueltas<input data-p="${P},${d},${b}" data-f="vueltas" value="${esc(bl.vueltas??'3')}" inputmode="numeric" style="width:56px" ${ro?'readonly':''}></label><label>Pausa entre vueltas<input data-p="${P},${d},${b}" data-f="pausa" value="${esc(bl.pausa??'60')}" inputmode="numeric" style="width:64px" ${ro?'readonly':''}></label>`:`<label>Series<input data-p="${P},${d},${b}" data-f="series" value="${esc(bl.series)}" style="width:56px" ${ro?'readonly':''}></label>`}${pl?`<span class="bl-res">${noms.length?plural(noms.length,'ejercicio','ejercicios')+': '+esc(noms.join(', ')):'Sin ejercicios'}${bl.modo==='dist'&&distTot(bl)?' · '+distMil(distTot(bl))+' m':''}</span>`:''}${ro||nb<2?'':`<span class="bl-mv"><button type="button" data-act="blUp" data-p="${P},${d},${b}" aria-label="Subir bloque" title="Subir bloque" ${b===0?'disabled':''}>↑</button><button type="button" data-act="blDown" data-p="${P},${d},${b}" aria-label="Bajar bloque" title="Bajar bloque" ${b===nb-1?'disabled':''}>↓</button></span>`}${ro?'':`<button type="button" class="x-sm" data-act="delBloque" data-p="${P},${d},${b}" aria-label="Quitar bloque">Quitar</button>`}</div>
      ${pl?'':items(d,b,bl)}${pl||bl.modo!=='test'?'':'<p class="hint">Bloque de test: el protocolo se edita en Equipos → Protocolos de test y se vuelve a entregar.</p>'}${ro||pl||bl.modo==='test'?'':`<button type="button" class="add-it" data-act="addItem" data-p="${P},${d},${b}">+ Ejercicio</button>`}</div>`}).join('')}
  </div>`).join('')}
  <div class="actions sticky-save">${ro?'':`<button class="btn pri" type="button" data-act="save">Guardar</button>`}
    ${isRut&&R.estado==='cola'&&E.id?`<button class="wa" type="button" data-entregar="${esc(E.id)}">Entregar ahora</button>`:''}
    ${!isRut&&E.id?`<button class="btn" type="button" data-act="dupPlant">Duplicar plantilla</button>`:''}
    ${isRut?`<button class="btn" type="button" data-act="toPlant">Guardar como plantilla</button>`:''}
    ${E.id?`<button class="btn danger" type="button" data-act="del" style="margin-left:auto">Eliminar</button>`:''}
    <button class="btn" type="button" data-close>Cerrar</button></div>`;
}
function planNorm(R,e){
  if(!R.distribucion)return;
  const n=Math.max(1,Number(R.duracionSemanas)||4),nd=Math.max(1,(R.secciones?.[0]?.dias||[]).length);
  R.distribucion=R.distribucion.map(w=>(w||[]).filter(x=>x<nd));
  if(R.distribucion.length>n)R.distribucion=R.distribucion.slice(0,n);
  if(R.distribucion.length<n){const base=rotacion(nd,Number(e?.estimulos)||nd,n)||Array.from({length:n},()=>Array.from({length:nd},(_,i)=>i));for(let i=R.distribucion.length;i<n;i++)R.distribucion.push(base[i])}
}
function planHTML(R,e,ro){
  planNorm(R,e);
  const dias=(R.secciones?.[0]?.dias||[]),est=Number(e?.estimulos)||0,on=!!R.distribucion;
  let h=`<div class="plan-h"><b>Qué día hacer cada semana</b><label class="plan-on"><input type="checkbox" data-planon ${on?'checked':''} ${ro?'disabled':''}> Mostrar al entrenado</label>${on&&!ro&&est?`<button type="button" class="x-sm" data-act="planSug">Sugerir para ${est} por semana</button>`:''}</div>`;
  if(!on)return h+`<p class="hint">Activalo si el entrenado no hace todos los días cada semana${est&&dias.length>est?` (paga ${est} y la rutina tiene ${dias.length} días)`:''}.</p>`;
  h+=`<div class="tbl-wrap"><table class="plan-t"><thead><tr><th></th>${dias.map(d=>`<th>${esc(d.nombre)}</th>`).join('')}<th></th></tr></thead><tbody>${R.distribucion.map((w,i)=>`<tr><td><b>Sem ${i+1}</b></td>${dias.map((d,j)=>`<td><input type="checkbox" data-plan="${i},${j}" ${w.includes(j)?'checked':''} ${ro?'disabled':''} aria-label="Semana ${i+1}, ${esc(d.nombre)}"></td>`).join('')}<td>${est&&w.length!==est?`<span class="pill p-warn">${w.length} de ${est}</span>`:''}</td></tr>`).join('')}</tbody></table></div>`;
  return h;
}
function moverBloque(arr,i,j){const [x]=arr.splice(i,1);arr.splice(j,0,x);S.edit.dirty=true;
  /* que el bloque movido mantenga su estado minimizado: las claves sin uid dependen de la posición */
  arr.forEach(bl=>{if(!bl.uid)bl.uid=ruid()})}
function blDrag(ev){const g=ev.target.closest('[data-grip]');if(!g||ev.button>0)return;ev.preventDefault();
  const E=S.edit,R=E.data,a=g.dataset.grip.split(',').map(Number),arr=getPath(R,a.slice(0,2).join(',')).bloques,from=a[2];
  const el=g.closest('.bl'),dia=el.parentElement,sh=el.closest('.sheet'),bls=[...dia.querySelectorAll(':scope>.bl')];
  const y0=ev.clientY,r0=el.getBoundingClientRect();let to=from,raf=0,lastY=y0;
  const mk=document.createElement('div');mk.className='bl-drop';mk.textContent='Soltá acá';mk.style.height=Math.min(56,r0.height)+'px';
  el.classList.add('bl-drag');document.body.classList.add('dragging');g.setPointerCapture&&g.setPointerCapture(ev.pointerId);
  const place=()=>{const others=bls.filter(x=>x!==el);let t=0;for(const o of others){const r=o.getBoundingClientRect();if(lastY>r.top+r.height/2)t++}to=t;
    const ref=others[t]||null;if(ref)dia.insertBefore(mk,ref);else{const last=others[others.length-1];last.after(mk)}};
  const scroll=()=>{if(!sh)return;const r=sh.getBoundingClientRect();if(lastY<r.top+70)sh.scrollTop-=12;else if(lastY>r.bottom-70)sh.scrollTop+=12;raf=requestAnimationFrame(scroll)};raf=requestAnimationFrame(scroll);
  const mv=e=>{lastY=e.clientY;el.style.transform=`translateY(${e.clientY-y0}px)`;place()};
  const up=()=>{cancelAnimationFrame(raf);g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);g.removeEventListener('pointercancel',up);
    document.body.classList.remove('dragging');el.classList.remove('bl-drag');el.style.transform='';mk.remove();
    if(to!==from){moverBloque(arr,from,to);rerenderEditor();toast('Bloque movido. Guardá para confirmar')}};
  g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);place()}
function getPath(R,p){const a=p.split(',').map(Number);let o=R.secciones[a[0]];if(a.length>1)o=o.dias[a[1]];if(a.length>2)o=o.bloques[a[2]];if(a.length>3)o=o.items[a[3]];return o}
function rerenderEditor(){
  const sh=$('.sheet');const st=sh?sh.scrollTop:0;const ae=document.activeElement;let sel=null,c0=null,c1=null;
  if(ae&&sh&&sh.contains(ae)){if(ae.dataset.p!=null&&ae.dataset.f)sel=`[data-p="${ae.dataset.p}"][data-f="${ae.dataset.f}"]`;else if(ae.dataset.h)sel=`[data-h="${ae.dataset.h}"]`;try{c0=ae.selectionStart;c1=ae.selectionEnd}catch(e){}}
  renderSheet();const n=$('.sheet');if(n)n.scrollTop=st;
  if(sel){const el=document.querySelector('#overlay '+sel);if(el){el.focus({preventScroll:true});try{if(c0!=null)el.setSelectionRange(c0,c1)}catch(e){}}}
}
function bindEditor(){
  const ov=$('#overlay'),E=S.edit,R=E.data;
  ov.onclick=async ev=>{
    if(ev.target===ov||ev.target.closest('[data-close]')){if(E.dirty&&!ov.dataset.warned){ov.dataset.warned=1;toast('Hay cambios sin guardar. Tocá Cerrar de nuevo para descartarlos');return}delete ov.dataset.warned;closeSheet();return}
    const sec=ev.target.closest('[data-sec]');if(sec){E.sec=Number(sec.dataset.sec);rerenderEditor();return}
    const ae=ev.target.closest('[data-addej]');if(ae){openEjSheet(null,{nombre:ae.dataset.addej},true);return}
    const en=ev.target.closest('[data-entregar]');if(en){if(E.dirty&&en.dataset.armed!=='1')await saveEditor(true);entregar(en.dataset.entregar,en);return}
    const b=ev.target.closest('[data-act]');if(!b)return;
    const act=b.dataset.act,p=b.dataset.p;
    const S0=R.secciones[E.sec];
    if(act==='save'){saveEditor();return}
    if(act==='imp'){E.imp=true;E.impRes=null;E.impErr='';rerenderEditor();setTimeout(()=>{const t=$('#imp-txt');if(t){t.focus();t.scrollIntoView({block:'center'})}},30);return}
    if(act==='prev'){E.prev=!E.prev;rerenderEditor();return}
    if(act==='impX'){E.imp=false;E.impErr='';rerenderEditor();return}
    if(act==='impOk'){E.impRes=null;rerenderEditor();return}
    if(act==='iaexp'){const en=S.ents[R.entrenadoId];if(en)iaCopiar(en,{...R,estado:R.estado||'cola'});return}
    if(act==='impGo'){const t=$('#imp-txt').value;try{const res=iaImportar(t,R);E.imp=false;E.impErr='';E.impRes=res;E.sec=0;E.pleg={};E.dirty=true;toast('Rutina cargada: revisala y guardá')}catch(x){E.impErr=x.message}rerenderEditor();return}
    if(act==='planSug'){const en=S.ents[R.entrenadoId];const nd=(R.secciones?.[0]?.dias||[]).length;R.distribucion=rotacion(nd,Number(en?.estimulos)||nd,R.duracionSemanas)||Array.from({length:R.duracionSemanas||4},()=>Array.from({length:nd},(_,i)=>i));E.dirty=true;rerenderEditor();return}
    if(act==='del'){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Tocá de nuevo para eliminar';return}
      if(await write(()=>S.db.collection(E.col).doc(E.id).delete())){toast('Eliminada');closeSheet()}return}
    if(act==='toPlant'){const en=S.ents[R.entrenadoId];const d={nombre:(R.nombre||'Rutina')+(en?' (de '+firstName(en)+')':''),tipo:'individual',duracionSemanas:R.duracionSemanas||4,notas:R.notas||'',controlCarga:!!R.controlCarga,bienestar:!!R.bienestar,
        secciones:reuid(R.secciones).map(s=>({...s,dias:s.dias.map(dd=>({...dd,bloques:dd.bloques.map(bb=>({...bb,items:bb.items.filter(i=>(i.nombre||'').trim())}))}))}))};
      if(await write(()=>S.db.collection('plantillas').add(d)))toast('Guardada en Plantillas como “'+d.nombre+'”');return}
    if(act==='dupPlant'){const d=clone(R);d.nombre=(d.nombre||'')+' (copia)';if(await write(()=>S.db.collection('plantillas').add(d))){toast('Plantilla duplicada');closeSheet()}return}
    if(act==='usarEnt'){const it=getPath(R,p);if(b.dataset.kg){it.kg=b.dataset.kg;it.pct=''}if(b.dataset.reps)it.reps=b.dataset.reps;E.dirty=true;rerenderEditor();toast('Listo: la rutina ahora usa lo que hizo el entrenado. Guardá para confirmar.');return}
    if(act==='pleg'){E.pleg=E.pleg||{};E.pleg[b.dataset.k]=!E.pleg[b.dataset.k];rerenderEditor();return}
    if(act==='plegDia'||act==='despDia'){E.pleg=E.pleg||{};const a=p.split(',').map(Number);getPath(R,p).bloques.forEach((bl,i)=>{E.pleg[bl.uid||`${a[0]},${a[1]},${i}`]=act==='plegDia'});rerenderEditor();return}
    if(act==='clearDia'||act==='clearSec'){
      if(!b.classList.contains('armed')){b.classList.add('armed','danger');b.textContent=act==='clearDia'?'Tocá de nuevo para vaciar el día':'Tocá de nuevo para vaciar toda la sección';setTimeout(()=>{if(b.isConnected){b.classList.remove('armed','danger');b.textContent=act==='clearDia'?'Vaciar día':'Vaciar sección'}},4000);return}
      const dias=act==='clearDia'?[getPath(R,p)]:S0.dias;
      dias.forEach(d=>d.bloques.forEach(bl=>{bl.items=[newItem()]}));
      E.dirty=true;rerenderEditor();toast(act==='clearDia'?'Día vaciado. Guardá para confirmar':'Sección vaciada. Guardá para confirmar');return}
    E.dirty=true;
    if(act==='addSec'){R.secciones.push(newSeccion(Math.max(1,S0?.dias.length||3)));R.secciones.at(-1).titulo='Sección '+R.secciones.length;E.sec=R.secciones.length-1}
    else if(act==='dupSec'){const c=clone(S0);c.uid=ruid();c.titulo=(c.titulo||'')+' (copia)';c.dias.forEach(d=>{d.uid=ruid();d.bloques.forEach(b=>{b.uid=ruid();b.items.forEach(i=>i.uid=ruid())})});R.secciones.splice(E.sec+1,0,c);E.sec++}
    else if(act==='delSec'){R.secciones.splice(E.sec,1);E.sec=Math.max(0,E.sec-1)}
    else if(act==='addDia'){S0.dias.push(newDia(S0.dias.length))}
    else if(act==='delDia'){const a=p.split(',').map(Number);S0.dias.splice(a[1],1)}
    else if(act==='addBloque'){getPath(R,p).bloques.push({uid:ruid(),nombre:'BLOQUE',series:'3',items:[newItem()]})}
    else if(act==='addTest'){E.testPick=E.testPick===p?null:p}
    else if(act==='testCancel'){E.testPick=null}
    else if(act==='testOk'){const ids=[...document.querySelectorAll('#overlay [data-tpk]:checked')].map(x=>x.value);const m=document.getElementById('tpk-msg');if(!ids.length){if(m)m.textContent='Elegí al menos un test.';E.dirty=true;return}
      const nota=(document.getElementById('tpk-nota')||{}).value||'';const tb=protBloque({test:{p:ids,nota:nota.trim()}},E.col==='rutinas'?S.ents[R.entrenadoId]:null);if(tb){const dia=getPath(R,p);dia.bloques=dia.bloques.filter(x=>x.modo==='test'||(!document.getElementById('tpk-solo')?.checked&&!x.items.every(itemVacio)));dia.bloques.unshift(tb);if(!/test/i.test(dia.nombre||''))dia.nombre=(dia.nombre||'Día')+' · Test'}E.testPick=null;toast(plural(ids.length,'test agregado','tests agregados')+'. Guardá para confirmar.')}
    else if(act==='blUp'||act==='blDown'){const a=p.split(',').map(Number);const arr=getPath(R,a.slice(0,2).join(',')).bloques;const i=a[2],j=act==='blUp'?i-1:i+1;if(j<0||j>=arr.length)return;moverBloque(arr,i,j)}
    else if(act==='delBloque'){const a=p.split(',').map(Number);getPath(R,a.slice(0,2).join(',')).bloques.splice(a[2],1)}
    else if(act==='addItem'){getPath(R,p).items.push(newItem())}
    else if(['delItem','up','down'].includes(act)){const a=p.split(',').map(Number);const arr=getPath(R,a.slice(0,3).join(',')).items;const i=a[3];
      if(act==='delItem')arr.splice(i,1);else{const j=act==='up'?i-1:i+1;if(j>=0&&j<arr.length)[arr[i],arr[j]]=[arr[j],arr[i]]}}
    rerenderEditor();
  };
  const AC={el:null,list:[],i:-1,inp:null};
  const acClose=()=>{if(AC.el)AC.el.remove();AC.el=null;AC.list=[];AC.i=-1;AC.inp=null};
  const acPick=(id)=>{const inp=AC.inp;if(!inp)return;const o=getPath(R,inp.dataset.p);const x=S.ejs[id];o.nombre=x.nombre;o.ej=id;if(x.unidad)o.unidad=x.unidad;if(o.pct&&!o.rm)o.rm=x.rm||'';E.dirty=true;acClose();rerenderEditor();
    const n=document.querySelector(`[data-p="${inp.dataset.p}"][data-f="reps"]`);if(n)n.focus()};
  const acShow=inp=>{
    const q=keyN(inp.value);acClose();if(!q)return;
    const all=Object.entries(S.ejs).map(([id,x])=>({id,x,k:keyN(x.nombre)}));
    const starts=all.filter(a=>a.k.startsWith(q)),inc=all.filter(a=>!a.k.startsWith(q)&&a.k.includes(q));
    AC.list=[...starts,...inc].slice(0,8);AC.inp=inp;if(!AC.list.length)return;AC.i=0;
    const el=document.createElement('div');el.className='ac-pop';el.setAttribute('role','listbox');
    el.innerHTML=AC.list.map((a,i)=>{const n=a.x.nombre,p=a.k.indexOf(q);const hl=p>=0?esc(n.slice(0,p))+'<mark>'+esc(n.slice(p,p+q.length))+'</mark>'+esc(n.slice(p+q.length)):esc(n);
      return `<div class="ac-op${i===0?' on':''}" role="option" data-acid="${esc(a.id)}"><span>${hl}</span>${a.x.video?'<small>▶ video</small>':'<small class="nv">sin video</small>'}</div>`}).join('');
    inp.closest('.ac-wrap').appendChild(el);AC.el=el;
    el.addEventListener('mousedown',ev=>{const o=ev.target.closest('[data-acid]');if(o){ev.preventDefault();acPick(o.dataset.acid)}});
  };
  const acMove=d=>{if(!AC.el)return;AC.i=(AC.i+d+AC.list.length)%AC.list.length;AC.el.querySelectorAll('.ac-op').forEach((o,i)=>o.classList.toggle('on',i===AC.i));AC.el.querySelector('.ac-op.on')?.scrollIntoView({block:'nearest'})};
  const navTo=(el)=>{if(!el)return false;el.focus();try{if(el.select)el.select()}catch(e){}el.scrollIntoView({block:'nearest'});return true};
  const navMove=(t,key)=>{
    const row=t.closest('.it');if(!row)return false;
    const fields=r=>[...r.querySelectorAll('input[data-p][data-f],select[data-p][data-f]')];
    const fs=fields(row),i=fs.indexOf(t);
    if(key==='ArrowRight')return navTo(fs[i+1]);
    if(key==='ArrowLeft')return navTo(fs[i-1]);
    const rows=[...document.querySelectorAll('#overlay .it')];const ri=rows.indexOf(row);const nr=rows[ri+(key==='ArrowUp'?-1:1)];if(!nr)return false;
    const nf=fields(nr);return navTo(nf.find(x=>x.dataset.f===t.dataset.f)||nf[Math.min(i,nf.length-1)]);
  };
  ov.onkeydown=ev=>{
    const t=ev.target;
    if(!(t.matches('[data-ac]')&&AC.el)){
      if(!t.matches('.it input[data-p],.it select[data-p]')||ev.altKey||ev.ctrlKey||ev.metaKey||ev.shiftKey)return;
      const k=ev.key;let go=false;
      if(k==='ArrowUp'||k==='ArrowDown'){if(t.tagName==='SELECT')return;go=true}
      else if(k==='Enter'){if(t.tagName==='SELECT')return;go='ArrowDown'}
      else if(k==='ArrowRight'||k==='ArrowLeft'){
        if(t.tagName==='SELECT')go=true;else{const v=t.value||'';const s0=t.selectionStart,s1=t.selectionEnd;const all=s0===0&&s1===v.length;
          go=all||(k==='ArrowRight'?s1===v.length:s0===0)}}
      if(go&&navMove(t,go===true?k:go))ev.preventDefault();
      return;
    }
    if(ev.key==='ArrowDown'){ev.preventDefault();acMove(1)}
    else if(ev.key==='ArrowUp'){ev.preventDefault();acMove(-1)}
    else if(ev.key==='Enter'||ev.key==='Tab'){if(AC.i>=0){ev.preventDefault();acPick(AC.list[AC.i].id)}}
    else if(ev.key==='Escape'){acClose()}
  };
  ov.addEventListener('focusout',ev=>{if(ev.target.matches&&ev.target.matches('[data-ac]'))setTimeout(()=>{if(document.activeElement!==AC.inp)acClose()},150)});
  ov.onpointerdown=blDrag;
  ov.oninput=ev=>{
    if(ev.target.matches('[data-ac]')){acShow(ev.target)}
    const h=ev.target.closest('[data-h]');if(h){R[h.dataset.h]=h.dataset.h==='duracionSemanas'?Number(h.value)||4:h.value;E.dirty=true;return}
    const t=ev.target.closest('[data-p][data-f]');if(!t)return;
    const o=getPath(R,t.dataset.p);o[t.dataset.f]=t.value;E.dirty=true;
    if(['metros','reps','tiempo','pausa'].includes(t.dataset.f)){const pv=ov.querySelector(`[data-pv="${t.dataset.p}"]`);if(pv){const x=distTxt(o);pv.innerHTML=x?'Se ve: <b>'+esc(x)+'</b>':''}}
  };
  ov.onchange=ev=>{
    const en=S.ents[R.entrenadoId];
    if(ev.target.matches('[data-opt]')){const o=ev.target.dataset.opt;R[o]=ev.target.checked;if(o==='ajusteWellness'&&R[o])R.bienestar=true;if(o==='bienestar'&&!R[o])R.ajusteWellness=false;E.dirty=true;if(o==='ajusteWellness'||o==='bienestar')rerenderEditor();return}
    if(ev.target.matches('[data-planon]')){const nd=(R.secciones?.[0]?.dias||[]).length;R.distribucion=ev.target.checked?(rotacion(nd,Number(en?.estimulos)||nd,R.duracionSemanas)||Array.from({length:R.duracionSemanas||4},()=>Array.from({length:nd},(_,i)=>i))):null;E.dirty=true;rerenderEditor();return}
    const pl=ev.target.closest('[data-plan]');if(pl){const [w,d]=pl.dataset.plan.split(',').map(Number);const a=new Set(R.distribucion[w]);pl.checked?a.add(d):a.delete(d);R.distribucion[w]=[...a].sort((x,y)=>x-y);E.dirty=true;rerenderEditor();return}
    if(ev.target.matches('[data-h=duracionSemanas]')){rerenderEditor();return}
    const t=ev.target.closest('[data-p][data-f]');if(!t)return;
    const o=getPath(R,t.dataset.p),f=t.dataset.f;
    const later=()=>setTimeout(rerenderEditor,0);
    if(f==='nombre'&&'ej' in o){const id=ejByName()[keyN(o.nombre)]||'';o.ej=id;if(id){o.nombre=S.ejs[id].nombre;if(S.ejs[id].unidad)o.unidad=S.ejs[id].unidad}if(o.pct&&!o.rm&&id)o.rm=S.ejs[id].rm||'';later()}
    else if(f==='pct'){if(o.pct&&!o.rm&&o.ej)o.rm=S.ejs[o.ej]?.rm||'';later()}
    else if(f==='posicion'||f==='titulo'||f==='rm'||f==='reps'||f==='modo')later();
  };
}
async function saveEditor(silent){
  const E=S.edit,R=E.data;
  R.secciones.forEach(s=>s.dias.forEach(d=>d.bloques.forEach(b=>{b.items=b.items.filter(i=>!itemVacio(i))})));
  if(R.distribucion){planNorm(R,S.ents[R.entrenadoId]);if(!R.distribucion.some(w=>w.length))R.distribucion=null}
  let ok;
  if(E.id)ok=await write(()=>S.db.collection(E.col).doc(E.id).set(R));
  else{try{const ref=await S.db.collection(E.col).add(R);E.id=ref.id;ok=true}catch(err){toast('No se pudo guardar');ok=false}}
  if(ok){E.dirty=false;if(!silent){const f=faltantes(R);toast(f.length?`Guardado. Faltan completar ${plural(f.length,'día','días')}`:'Guardado');rerenderEditor()}}
  return ok;
}

/* ----- biblioteca: alta/edición ----- */
function openEjSheet(id,pre,fromEditor){S.ejEdit={id,data:id?clone(S.ejs[id]):{nombre:'',video:'',rm:'',...(pre||{})},back:fromEditor?{...S.edit}:null};openSheet('__ej','edit')}
function ejHTML(){
  const x=S.ejEdit.data;
  return `<form id="ejf" class="form card pad">
    <label class="full">Nombre del ejercicio<input id="ej-n" required value="${esc(x.nombre)}"></label>
    <label class="full">Link del video (YouTube)<input id="ej-v" type="url" value="${esc(x.video)}" placeholder="https://youtube.com/shorts/..."></label>
    <label>Se mide en<select id="ej-u">${UNIS.map(([k,l])=>`<option value="${k}" ${(x.unidad||(UNI_RE.test(x.nombre||'')?'cm':'kg'))===k?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Marca RM para calcular kg con %<select id="ej-rm"><option value="">Ninguna</option>${movs().map(m=>`<option ${m===x.rm?'selected':''}>${esc(m)}</option>`).join('')}</select></label>
    <div class="full actions"><button class="btn pri" type="submit">${S.ejEdit.id?'Guardar':'Agregar a la biblioteca'}</button>${S.ejEdit.id?'<button class="btn danger" type="button" id="ej-del">Eliminar</button>':''}<button class="btn" type="button" data-close>Cancelar</button></div></form>`;
}
function bindEj(){
  const ov=$('#overlay');
  const back=()=>{if(S.ejEdit.back){S.edit=S.ejEdit.back;openSheet('__rut','edit')}else closeSheet()};
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))back()};
  ov.oninput=null;ov.onchange=null;
  $('#ejf').addEventListener('submit',async ev=>{ev.preventDefault();
    const d={nombre:$('#ej-n').value.trim(),video:$('#ej-v').value.trim(),rm:$('#ej-rm').value};const u=$('#ej-u').value;if(u&&u!=='kg')d.unidad=u;
    const dup=ejByName()[keyN(d.nombre)];if(dup&&dup!==S.ejEdit.id){toast('Ya existe un ejercicio con ese nombre');return}
    let id=S.ejEdit.id;
    if(!id){id=keyN(d.nombre).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||ruid();if(S.ejs[id])id+='-'+ruid().slice(0,4)}
    if(await write(()=>S.db.collection('ejercicios').doc(id).set(d))){
      toast('Biblioteca actualizada');
      if(S.ejEdit.back){S.ejs[id]=d;S.ejsV++;const R=S.ejEdit.back.data;R.secciones.forEach(s=>s.dias.forEach(dd=>dd.bloques.forEach(b=>b.items.forEach(i=>{if(!i.ej&&keyN(i.nombre)===keyN(d.nombre)){i.ej=id;i.nombre=d.nombre}}))))}
      back()}
  });
  const del=$('#ej-del');if(del)del.addEventListener('click',async()=>{if(!del.classList.contains('armed')){del.classList.add('armed');del.textContent='Tocá de nuevo para eliminar';return}
    if(await write(()=>S.db.collection('ejercicios').doc(S.ejEdit.id).delete())){toast('Ejercicio eliminado');closeSheet()}});
}


/* ---------- CALENDARIO ---------- */
const EV_TIPOS=[['evaluacion','Evaluación'],['clase','Clase / entrenamiento'],['reunion','Reunión'],['personal','Personal'],['otro','Otro']];
const CAL_F=[['ent','Entrenamientos'],['pago','Cuotas'],['rut','Rutinas'],['ev','Mis eventos']];
function calSt(){if(!S.cal)S.cal={vista:innerWidth<760?'dia':'semana',ref:iso(today()),f:{ent:true,pago:true,rut:true,ev:true},gym:''};return S.cal}
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const lunes=d=>addD(d,-((d.getDay()+6)%7));
const hm=t=>{const [h,m]=String(t||'0:0').split(':').map(Number);return h*60+(m||0)};
const hhmm=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const MES_C=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function calRango(){const c=calSt(),r=parse(c.ref);if(c.vista==='dia')return [r,r];if(c.vista==='semana'){const a=lunes(r);return [a,addD(a,6)]}
  const a=lunes(new Date(r.getFullYear(),r.getMonth(),1));return [a,addD(a,41)]}
function calEventos(desde,hasta){
  const c=calSt(),out=[],D=[];for(let d=new Date(desde);d<=hasta;d=addD(d,1))D.push(new Date(d));
  const okG=e=>!c.gym||gymOf(e)===c.gym;
  const enR=s=>s&&s>=iso(desde)&&s<=iso(hasta);
  const asis=new Set(S.regs.filter(r=>String(r.item||'').startsWith('asis:')).map(r=>r.entrenadoId+'|'+r.fecha));
  const act=Object.values(S.ents).filter(e=>isAct(e)&&okG(e));
  if(c.f.ent)act.forEach(e=>(e.horarios||[]).forEach(h=>{if(!/^\d{1,2}:\d{2}$/.test(h.hora||''))return;D.forEach(d=>{if(((d.getDay()+6)%7)+1!==Number(h.dia))return;const f=iso(d);
    if(e.inicio&&f<e.inicio)return;out.push({k:'ent',id:'ent|'+e.id+'|'+f+'|'+h.hora,fecha:f,ini:hm(h.hora),dur:Number(h.dur)||60,tit:name(e),sub:GYM_LBL[gymOf(e)],eid:e.id,c:{LEVEL:'--ok',CROSSFORCE:'--cf',ONLINE:'--online'}[gymOf(e)],hecho:asis.has(e.id+'|'+f)})})}));
  if(c.f.pago)act.filter(e=>gymOf(e)!=='CROSSFORCE'&&!sinCuota(e)).forEach(e=>{if(enR(e.proxVenc)){const q=pagoInfo(e);out.push({k:'pago',id:'pago|'+e.id,fecha:e.proxVenc,tit:'Cuota · '+name(e),sub:money(monto(e))+' · '+q.txt,eid:e.id,ok:q.k==='ok'})}});
  if(c.f.rut)act.forEach(e=>{const a=activaDe(e.id);if(a&&a.fechaEntrega){const fin=iso(addD(parse(a.fechaEntrega),(Number(a.duracionSemanas)||4)*7));if(enR(fin))out.push({k:'rut',id:'rut|'+a._id,fecha:fin,tit:'Termina rutina · '+name(e),sub:a.nombre||'',eid:e.id,rid:a._id})}
    colaDe(e.id).forEach(r=>{if(enR(r.fechaSugerida))out.push({k:'rut',id:'cola|'+r._id,fecha:r.fechaSugerida,tit:'Entregar rutina · '+name(e),sub:r.nombre||'',eid:e.id,rid:r._id})})});
  if(c.f.ev)S.evs.forEach(v=>{const en=v.eid&&S.ents[v.eid];if(c.gym&&en&&gymOf(en)!==c.gym)return;
    const push=f=>out.push({k:'ev',id:'ev|'+v._id+'|'+f,fecha:f,ini:v.hora?hm(v.hora):null,dur:Number(v.dur)||60,tit:v.titulo||'Evento',sub:[EV_TIPOS.find(t=>t[0]===v.tipo)?.[1],en?name(en):''].filter(Boolean).join(' · '),eid:v.eid||'',evId:v._id,tipo:v.tipo});
    if(v.rep==='semanal'){const b=parse(v.fecha);if(!b)return;D.forEach(d=>{const f=iso(d);if(f>=v.fecha&&(!v.hasta||f<=v.hasta)&&d.getDay()===b.getDay()&&!(v.excl||[]).includes(f))push(f)})}else if(enR(v.fecha))push(v.fecha)});
  return out.sort((a,b)=>(a.fecha.localeCompare(b.fecha))||((a.ini??-1)-(b.ini??-1))||a.tit.localeCompare(b.tit,'es'));
}
function calChip(ev,corto){const cls={ent:'ce-ent',pago:'ce-pago',rut:'ce-rut',ev:'ce-ev'}[ev.k];
  return `<button type="button" class="ce ${cls}${ev.hecho?' ce-ok':''}${ev.ok?' ce-paid':''}" data-cev="${esc(ev.id)}" ${ev.c?`style="--c:var(${ev.c})"`:''} title="${esc(ev.tit+(ev.sub?' · '+ev.sub:''))}">${ev.ini!=null&&ev.k!=='ent'||ev.ini!=null&&corto?`<b>${hhmm(ev.ini)}</b> `:''}${ev.hecho?'✓ ':''}${esc(ev.tit)}</button>`}
function calLanes(evs){const s=[...evs].sort((a,b)=>a.ini-b.ini||b.dur-a.dur);let grp=[],end=-1;const out=[];
  const flush=()=>{const lanes=[];grp.forEach(e=>{let i=lanes.findIndex(x=>x<=e.ini);if(i<0){i=lanes.length;lanes.push(0)}lanes[i]=e.ini+e.dur;e.lane=i});grp.forEach(e=>e.lanes=lanes.length);out.push(...grp);grp=[]};
  s.forEach(e=>{if(e.ini>=end&&grp.length)flush();grp.push(e);end=Math.max(end,e.ini+e.dur)});if(grp.length)flush();return out}
function calSemanaHTML(dias,evs){
  const timed=evs.filter(e=>e.ini!=null),allday=evs.filter(e=>e.ini==null);
  let h0=7*60,h1=22*60;timed.forEach(e=>{h0=Math.min(h0,Math.floor(e.ini/60)*60);h1=Math.max(h1,Math.ceil((e.ini+e.dur)/60)*60)});
  const PX=0.8,hoy=iso(today()),now=new Date(),nowM=now.getHours()*60+now.getMinutes();
  const horas=[];for(let m=h0;m<h1;m+=60)horas.push(m);
  return `<div class="cal-week ${dias.length===1?'cal-1':''}" style="--cols:${dias.length}">
    <div class="cw-head"><span></span>${dias.map(d=>{const f=iso(d);return `<button type="button" class="cw-d ${f===hoy?'hoy':''}" data-cday="${f}"><span>${dsem(((d.getDay()+6)%7)+1)[2]}</span><b>${d.getDate()}</b></button>`}).join('')}</div>
    <div class="cw-all"><span class="cw-lab">todo el día</span>${dias.map(d=>{const f=iso(d),L=allday.filter(e=>e.fecha===f).sort((x,y)=>(x.ok?1:0)-(y.ok?1:0));return `<div class="cw-ac">${L.slice(0,3).map(e=>calChip(e)).join('')}${L.length>3?`<button type="button" class="cm-mas" data-cday="${f}">+${L.length-3} más</button>`:''}</div>`}).join('')}</div>
    <div class="cw-body"><div class="cw-hrs">${horas.map(m=>`<span style="height:${60*PX}px">${hhmm(m)}</span>`).join('')}</div>
      ${dias.map(d=>{const f=iso(d),L=calLanes(timed.filter(e=>e.fecha===f));
        return `<div class="cw-col ${f===hoy?'hoy':''}" data-cslot="${f}" data-h0="${h0}" style="height:${(h1-h0)*PX}px;background-size:100% ${60*PX}px">
          ${f===hoy&&nowM>=h0&&nowM<=h1?`<i class="cw-now" style="top:${(nowM-h0)*PX}px"></i>`:''}
          ${L.map(e=>`<button type="button" class="cw-ev ce-${e.k}${e.hecho?' ce-ok':''}" data-cev="${esc(e.id)}" style="top:${(e.ini-h0)*PX}px;height:${Math.max(18,e.dur*PX-2)}px;left:calc(${e.lane/e.lanes*100}% + 2px);width:calc(${100/e.lanes}% - 4px);${e.c?`--c:var(${e.c})`:''}"><b>${e.hecho?'✓ ':''}${esc(e.tit)}</b><span>${hhmm(e.ini)}${e.dur*PX>34?' · '+esc(e.sub||''):''}</span></button>`).join('')}</div>`}).join('')}
    </div></div>`}
function calMesHTML(evs){const c=calSt(),r=parse(c.ref),[a]=calRango(),hoy=iso(today());
  return `<div class="cal-month"><div class="cm-h">${DSEM.map(d=>`<span>${d[2]}</span>`).join('')}</div><div class="cm-g">${Array.from({length:42},(_,i)=>{const d=addD(a,i),f=iso(d),L=evs.filter(e=>e.fecha===f),fuera=d.getMonth()!==r.getMonth();
    const ent=L.filter(e=>e.k==='ent'),otros=L.filter(e=>e.k!=='ent').sort((x,y)=>(x.ok?1:0)-(y.ok?1:0));
    return `<div class="cm-c ${fuera?'fuera':''} ${f===hoy?'hoy':''}" data-cday="${f}"><span class="cm-n">${d.getDate()}</span>
      ${otros.slice(0,3).map(e=>calChip(e,true)).join('')}${otros.length>3?`<span class="cm-mas">+${otros.length-3} más</span>`:''}
      ${ent.length?`<span class="cm-ent">${plural(ent.length,'entrenamiento','entrenamientos')}</span>`:''}</div>`}).join('')}</div></div>`}
function calDiaHTML(d,evs){const f=iso(d),L=evs.filter(e=>e.fecha===f),all=L.filter(e=>e.ini==null),t=L.filter(e=>e.ini!=null);
  return `<div class="cal-day"><div class="cd-h"><b>${dsem(((d.getDay()+6)%7)+1)[1]} ${d.getDate()} de ${MESES_N[d.getMonth()].toLowerCase()}</b><span class="hint">${plural(t.filter(e=>e.k==='ent').length,'entrenamiento','entrenamientos')}</span></div>
    ${all.length?`<div class="cd-all">${all.map(e=>calChip(e)).join('')}</div>`:''}
    ${t.length?`<ul class="cd-l">${t.map(e=>`<li><button type="button" class="cd-it ce-${e.k}${e.hecho?' ce-ok':''}" data-cev="${esc(e.id)}" ${e.c?`style="--c:var(${e.c})"`:''}><span class="cd-t">${hhmm(e.ini)}<i>${hhmm(e.ini+e.dur)}</i></span><span class="cd-b"><b>${e.hecho?'✓ ':''}${esc(e.tit)}</b><span>${esc(e.sub||'')}</span></span></button></li>`).join('')}</ul>`:all.length?'':'<div class="empty">Nada agendado para este día.</div>'}
    <div class="actions" style="padding:12px 16px"><button class="btn" type="button" data-cnew="${f}">+ Evento este día</button></div></div>`}
function renderCalendario(){
  const el=$('#v-calendario'),c=calSt(),[a,b]=calRango(),evs=calEventos(a,b),r=parse(c.ref);
  const tit=c.vista==='mes'?`${MESES_N[r.getMonth()]} ${r.getFullYear()}`:c.vista==='dia'?`${pad(r.getDate())} ${MES_C[r.getMonth()]} ${r.getFullYear()}`:(a.getMonth()===b.getMonth()?`${a.getDate()} – ${b.getDate()} ${MES_C[b.getMonth()]} ${b.getFullYear()}`:`${a.getDate()} ${MES_C[a.getMonth()]} – ${b.getDate()} ${MES_C[b.getMonth()]} ${b.getFullYear()}`);
  const dias=[];for(let d=new Date(a);d<=b;d=addD(d,1))dias.push(new Date(d));
  el.innerHTML=`<div class="cal-bar">
    <div class="cal-nav"><button class="btn" type="button" data-cmov="-1" aria-label="Anterior">‹</button><button class="btn" type="button" data-cmov="0">Hoy</button><button class="btn" type="button" data-cmov="1" aria-label="Siguiente">›</button><h2 class="cal-t">${tit}</h2></div>
    <div class="cal-act"><div class="seg">${[['dia','Día'],['semana','Semana'],['mes','Mes']].map(([k,l])=>`<button type="button" data-cvista="${k}" aria-pressed="${c.vista===k}">${l}</button>`).join('')}</div>
      <button class="btn pri" type="button" data-cnew="${c.vista==='dia'?c.ref:''}">+ Evento</button><button class="btn gcal" type="button" data-cexp="1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Pasar a Google Calendar</button></div></div>
  <div class="cal-fil chips">${CAL_F.map(([k,l])=>`<button class="chip cf-${k}" type="button" data-cf="${k}" aria-pressed="${!!c.f[k]}">${l}</button>`).join('')}
    <select data-cgym aria-label="Gimnasio"><option value="">Todos los gimnasios</option>${GYMS.map(g=>`<option value="${g}" ${c.gym===g?'selected':''}>${GYM_LBL[g]}</option>`).join('')}</select></div>
  <div class="card cal-card">${c.vista==='mes'?calMesHTML(evs):c.vista==='dia'?calDiaHTML(r,evs):calSemanaHTML(dias,evs)}</div>
  <p class="hint">Los entrenamientos salen de los horarios cargados en cada ficha (✓ = marcó asistencia). Tocá un espacio vacío de la semana para crear un evento a esa hora.</p>`;
  if(c.vista==='semana'&&!S.calScrolled){S.calScrolled=1;const cw=el.querySelector('.cw-body');if(cw){const first=el.querySelector('.cw-ev');if(first)cw.scrollTop=Math.max(0,first.offsetTop-24)}}
}
function calBuscar(id){const [a,b]=calRango();return calEventos(addD(a,-1),addD(b,1)).find(e=>e.id===id)}
function calNav(n){const c=calSt(),r=parse(c.ref);if(n===0)c.ref=iso(today());else if(c.vista==='dia')c.ref=iso(addD(r,n));else if(c.vista==='semana')c.ref=iso(addD(r,7*n));else c.ref=iso(new Date(r.getFullYear(),r.getMonth()+n,1));renderCalendario()}
function gcalEvUrl(ev){const fmt=(f,m)=>f.replace(/-/g,'')+(m==null?'':'T'+pad(Math.floor(m/60))+pad(m%60)+'00');
  const dates=ev.ini==null?`${fmt(ev.fecha)}/${fmt(iso(addD(parse(ev.fecha),1)))}`:`${fmt(ev.fecha,ev.ini)}/${fmt(ev.fecha,ev.ini+ev.dur)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.k==='ent'?'Entrenamiento · '+ev.tit:ev.tit)}&dates=${dates}&ctz=America/Argentina/Buenos_Aires&details=${encodeURIComponent(ev.sub||'')}`}
function cevHTML(ev){const e=ev.eid&&S.ents[ev.eid];const v=ev.evId&&S.evs.find(x=>x._id===ev.evId);
  const cuando=`${fmtD(ev.fecha)}${ev.ini!=null?` · ${hhmm(ev.ini)} a ${hhmm(ev.ini+ev.dur)}`:' · todo el día'}`;
  const tipo={ent:'Entrenamiento',pago:'Vencimiento de cuota',rut:ev.id.startsWith('cola')?'Rutina para entregar':'Fin de rutina',ev:'Evento'}[ev.k];
  let g='';if(e&&ev.k==='ent'){const gr=horGrupos(e.horarios).find(x=>x.hora===hhmm(ev.ini));if(gr)g=gcalSemanal(e,gr)}
  return `<div class="card pad cev"><span class="pill ${ev.k==='pago'?'p-warn':ev.k==='rut'?'p-ok':ev.k==='ent'?'p-mute':'p-gymc'}">${tipo}</span>
    <h3 style="margin:8px 0 2px">${esc(ev.tit)}</h3><p class="hint" style="margin:0">${cuando}${ev.sub?' · '+esc(ev.sub):''}</p>
    ${ev.k==='ent'?`<p style="margin:10px 0 0">${ev.hecho?'<span class="pill p-ok">✓ Marcó asistencia</span>':ev.fecha<=iso(today())?'<span class="pill p-mute">Sin asistencia marcada</span>':''}</p>`:''}
    ${v&&v.notas?`<p style="margin:10px 0 0">${esc(v.notas)}</p>`:''}
    <div class="actions" style="margin-top:14px">
      ${e?`<button class="btn" type="button" data-open="${esc(e.id)}">Ver ficha</button>`:''}
      ${e&&ev.k==='pago'?msgBtn(e,'pago','Avisar'):''}
      ${ev.rid?`<button class="btn" type="button" data-verrut="${esc(ev.rid)}">Ver rutina</button>`:''}
      ${v?`<button class="btn" type="button" data-cedit="${esc(v._id)}">Editar</button>`:''}
      <a class="btn gcal" target="_blank" rel="noopener" href="${esc(g||gcalEvUrl(ev))}">${g?'Google Calendar (todas las semanas)':'Agregar a Google Calendar'}</a>
    </div></div>`}
function evFormHTML(v){const ents=Object.values(S.ents).filter(isAct).sort((a,b)=>name(a).localeCompare(name(b),'es'));
  return `<form class="form card pad" id="evf">
    <label class="full">Título<input id="ev-t" required value="${esc(v.titulo||'')}" placeholder="Ej: Evaluación CMJ · Reunión con LEVEL"></label>
    <label>Tipo<select id="ev-tipo">${EV_TIPOS.map(([k,l])=>`<option value="${k}" ${v.tipo===k?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Entrenado (opcional)<select id="ev-e"><option value="">—</option>${ents.map(e=>`<option value="${esc(e.id)}" ${v.eid===e.id?'selected':''}>${esc(name(e))}</option>`).join('')}</select></label>
    <label>Fecha<input id="ev-f" type="date" required value="${esc(v.fecha||iso(today()))}"></label>
    <label>Hora (vacío = todo el día)<input id="ev-h" type="time" value="${esc(v.hora||'')}"></label>
    <label>Duración<select id="ev-d">${[30,45,60,75,90,120,180].map(m=>`<option value="${m}" ${(Number(v.dur)||60)===m?'selected':''}>${m<60?m+' min':m%60?Math.floor(m/60)+' h '+m%60:m/60+' h'}</option>`).join('')}</select></label>
    <label>Repetir<select id="ev-r"><option value="no">No se repite</option><option value="semanal" ${v.rep==='semanal'?'selected':''}>Todas las semanas</option></select></label>
    <label>Hasta (si se repite)<input id="ev-hasta" type="date" value="${esc(v.hasta||'')}"></label>
    <label class="full">Notas<textarea id="ev-n" rows="2">${esc(v.notas||'')}</textarea></label>
    <div class="full actions"><button class="btn pri" type="submit">Guardar</button>${v._id?`<button class="btn" type="button" data-evdel="${esc(v._id)}">${S.evArm===v._id?'Confirmar borrado':'Borrar'}</button>`:''}<button class="btn" type="button" data-close>Cancelar</button></div></form>`}
function icsTxt(op){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//entrena//CRM//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:entrená.','X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
    'BEGIN:VTIMEZONE','TZID:America/Argentina/Buenos_Aires','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:-0300','TZOFFSETTO:-0300','TZNAME:-03','END:STANDARD','END:VTIMEZONE'];
  const tx=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const st=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');const TZ=';TZID=America/Argentina/Buenos_Aires:';
  const dt=(f,m)=>f.replace(/-/g,'')+'T'+pad(Math.floor(m/60))+pad(m%60)+'00';
  const ev=(uid,sum,desc,loc,a)=>{L.push('BEGIN:VEVENT','UID:'+uid+'@entrena.app','DTSTAMP:'+st,...a,'SUMMARY:'+tx(sum));if(desc)L.push('DESCRIPTION:'+tx(desc));if(loc)L.push('LOCATION:'+tx(loc));L.push('END:VEVENT')};
  const hoy=today(),hasta=addD(hoy,Number(op.dias)||60),act=Object.values(S.ents).filter(isAct);let n=0;
  if(op.ent)act.forEach(e=>horGrupos(e.horarios).forEach(g=>{let first=null;for(let k=0;k<7&&!first;k++){const d=addD(hoy,k);if(g.dias.includes(((d.getDay()+6)%7)+1))first=d}if(!first)return;const f=iso(first),m=hm(g.hora);
    ev(`ent-${e.id}-${g.hora.replace(':','')}-${g.dias.join('')}`,'Entrenamiento · '+name(e),[`${e.estimulos||''} estímulos por semana`,e.telefono?'Tel: '+e.telefono:''].filter(Boolean).join('\n'),GYM_LBL[gymOf(e)],['DTSTART'+TZ+dt(f,m),'DTEND'+TZ+dt(f,m+g.dur),'RRULE:FREQ=WEEKLY;BYDAY='+g.dias.map(d=>dsem(d)[3]).join(',')]);n++}));
  const allday=(uid,sum,desc,f)=>{ev(uid,sum,desc,'',['DTSTART;VALUE=DATE:'+f.replace(/-/g,''),'DTEND;VALUE=DATE:'+iso(addD(parse(f),1)).replace(/-/g,'')]);n++};
  if(op.pago)act.filter(e=>gymOf(e)!=='CROSSFORCE'&&!sinCuota(e)).forEach(e=>{const p=parse(e.proxVenc);if(p&&p>=hoy&&p<=hasta)allday(`pago-${e.id}-${e.proxVenc}`,'Vence cuota · '+name(e),money(monto(e)),e.proxVenc)});
  if(op.rut)act.forEach(e=>{const a=activaDe(e.id);if(a&&a.fechaEntrega){const fin=addD(parse(a.fechaEntrega),(Number(a.duracionSemanas)||4)*7);if(fin>=hoy&&fin<=hasta)allday(`rut-${a._id}`,'Termina rutina · '+name(e),a.nombre||'',iso(fin))}});
  if(op.ev)S.evs.forEach(v=>{if(!v.fecha)return;const en=v.eid&&S.ents[v.eid];const desc=[en?name(en):'',v.notas||''].filter(Boolean).join('\n');
    const a=v.hora?['DTSTART'+TZ+dt(v.fecha,hm(v.hora)),'DTEND'+TZ+dt(v.fecha,hm(v.hora)+(Number(v.dur)||60))]:['DTSTART;VALUE=DATE:'+v.fecha.replace(/-/g,''),'DTEND;VALUE=DATE:'+iso(addD(parse(v.fecha),1)).replace(/-/g,'')];
    if(v.rep==='semanal')a.push('RRULE:FREQ=WEEKLY'+(v.hasta?';UNTIL='+v.hasta.replace(/-/g,'')+(v.hora?'T235959Z':''):''));ev('ev-'+v._id,v.titulo||'Evento',desc,'',a);n++});
  L.push('END:VCALENDAR');
  const fold=l=>{const o=[];let s=l;while(s.length>72){o.push(s.slice(0,72));s=' '+s.slice(72)}o.push(s);return o.join('\r\n')};
  return {txt:L.map(fold).join('\r\n'),n}}
function expHTML(){const o=S.calExp;return `<div class="card pad">
  <p style="margin-top:0">Se descarga un archivo con tus eventos para importarlo en Google Calendar. Quedan como una copia: si después cambiás algo en la app, volvés a exportar.</p>
  <div class="chips" style="flex-direction:column;align-items:flex-start;gap:8px">
    ${[['ent','Horarios de entrenamiento (se repiten todas las semanas)'],['pago','Vencimientos de cuotas'],['rut','Fin de rutinas'],['ev','Mis eventos']].map(([k,l])=>`<label class="plan-on"><input type="checkbox" data-ex="${k}" ${o[k]?'checked':''}> ${l}</label>`).join('')}
    <label>Cuotas y rutinas de los próximos <select data-exd>${[30,60,90].map(d=>`<option ${Number(o.dias)===d?'selected':''}>${d}</option>`).join('')}</select> días</label></div>
  <div class="actions" style="margin-top:14px"><button class="btn pri" type="button" data-exgo="1">Descargar archivo (.ics)</button></div>
  <ol class="hint" style="margin:14px 0 0;padding-left:18px;line-height:1.6"><li>En la compu, abrí Google Calendar → ⚙ Configuración → <b>Importar y exportar</b>.</li><li>Elegí el archivo <b>entrena.ics</b> y el calendario donde lo querés (te conviene crear uno llamado “entrená.”, así lo podés borrar y volver a importar entero).</li><li>Tocá <b>Importar</b>. En el celular aparece solo.</li></ol>
  <p class="hint">Para un solo evento, tocalo en el calendario y usá “Agregar a Google Calendar”.</p></div>`}

/* ---------- navegación ---------- */
const VIEWS=['panel','lista','calendario','rutinas','equipos','ajustes'];
/* Transición suave entre vistas con la View Transitions API; sin soporte, el cambio es inmediato como antes */
function conTransicion(fn){if(!document.startViewTransition){fn();return}try{document.startViewTransition(fn)}catch(_){fn()}}
/* Varios cambios de datos que llegan juntos (al guardar se actualizan 2 o 3 colecciones) se dibujan una sola vez por cuadro */
let _rq=0;function pedirRender(){if(_rq)return;_rq=requestAnimationFrame(()=>{_rq=0;render()})}
function show(v){
  if(!VIEWS.includes(v))v='panel';S.view=v;
  VIEWS.forEach(k=>$('#v-'+k).hidden=k!==v);
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===v?'page':'false'));
  $('#fab').hidden=v!=='panel'&&v!=='lista';
  render();window.scrollTo(0,0);
}
function render(){const y=scrollY,v=$('#v-'+S.view);conservar(v,render0);if(Math.abs(scrollY-y)>2)scrollTo(0,y)}
function render0(){
  if(S.view==='panel')renderPanel();else if(S.view==='lista')renderLista();else if(S.view==='calendario')renderCalendario();else if(S.view==='rutinas')renderRutinas();else if(S.view==='equipos')renderEquipos();else if(!document.querySelector('#v-ajustes input:focus'))renderAjustes();
  if(openId&&openId!=='__bulk'&&sheetMode==='ver')renderSheet();
}
document.querySelector('nav.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){if(location.hash!=='#'+b.dataset.view)location.hash=b.dataset.view;else show(b.dataset.view)}});
window.addEventListener('hashchange',()=>conTransicion(()=>show(location.hash.slice(1))));
(function(){const el=$('#v-calendario');if(!el)return;
  el.addEventListener('click',e=>{const c=calSt();const g=k=>e.target.closest('['+k+']');let b;
    if(b=g('data-cmov')){calNav(Number(b.dataset.cmov));return}
    if(b=g('data-cvista')){c.vista=b.dataset.cvista;S.calScrolled=0;renderCalendario();return}
    if(b=g('data-cf')){c.f[b.dataset.cf]=!c.f[b.dataset.cf];renderCalendario();return}
    if(b=g('data-cev')){openSheet('__cev','ver',b.dataset.cev);return}
    if(b=g('data-cnew')){openSheet('__evf','edit',{fecha:b.dataset.cnew||c.ref,tipo:'evaluacion',dur:60});return}
    if(b=g('data-cexp')){openSheet('__cexp','ver');return}
    if(b=g('data-cday')){if(c.vista==='dia')return;c.ref=b.dataset.cday;c.vista='dia';renderCalendario();return}
    if(b=g('data-cslot')){const r=b.getBoundingClientRect(),m=Number(b.dataset.h0)+Math.floor((e.clientY-r.top)/0.8/30)*30;openSheet('__evf','edit',{fecha:b.dataset.cslot,hora:hhmm(m),tipo:'evaluacion',dur:60});return}});
  el.addEventListener('change',e=>{const s=e.target.closest('[data-cgym]');if(s){calSt().gym=s.value;renderCalendario()}});
})();
function horLeer(){if(!S.horEdit)return;document.querySelectorAll('[data-hrow]').forEach(r=>{const h=S.horEdit.hs[Number(r.dataset.hrow)];if(!h)return;h.dia=Number(r.querySelector('[data-hd]').value);h.hora=r.querySelector('[data-hh]').value;h.dur=Number(r.querySelector('[data-hm]').value)})}
function handleRut(e){
  const g=k=>e.target.closest('['+k+']');let b;
  if(b=g('data-entregar')){entregar(b.dataset.entregar,b);return true}
  if(b=g('data-posponer')){openSheet('__posp','edit',b.dataset.posponer);return true}
  if(b=g('data-editrut')){const r=S.rutinas.find(x=>x._id===b.dataset.editrut);if(r){const{_id,...d}=r;openEditor('rutinas',_id,d)}return true}
  if(b=g('data-verrut')){openSheet('__rv','ver',b.dataset.verrut);return true}
  if(b=g('data-finall')){S.finAll=!S.finAll;renderSheet();return true}
  if(b=g('data-iaexp')){const e2=S.ents[b.dataset.iaexp];if(e2)iaCopiar(e2,iaRutBase(e2.id));return true}
  if(b=g('data-iaimp')){const e2=S.ents[b.dataset.iaimp];openEditor('rutinas',null,{entrenadoId:e2.id,nombre:'Rutina '+mesLbl(curMes()),estado:'cola',fechaSugerida:iso(today()),duracionSemanas:4,secciones:[newSeccion(Number(e2.estimulos)||3)],creada:Date.now()});S.edit.imp=true;rerenderEditor();setTimeout(()=>$('#imp-txt')?.focus(),30);return true}
  if(b=g('data-newrut')){const e2=S.ents[b.dataset.newrut];openEditor('rutinas',null,{entrenadoId:e2.id,nombre:'Rutina '+mesLbl(curMes()),estado:'cola',fechaSugerida:iso(today()),duracionSemanas:4,secciones:[newSeccion(Number(e2.estimulos)||3)],creada:Date.now()});return true}
  if(b=g('data-duprut')){const r=S.rutinas.find(x=>x._id===b.dataset.duprut);if(r){const{_id,...d}=clone(r);Object.assign(d,{estado:'cola',fechaSugerida:iso(today()),fechaEntrega:'',fechaFin:'',pospuesta:null,nombre:(d.nombre||'Rutina')+' (nueva)',creada:Date.now()});openEditor('rutinas',null,d)}return true}
  if(b=g('data-copiarde')){openSheet('__copiar','edit',{para:b.dataset.copiarde,q:''});return true}
  if(b=g('data-asignar')){const sel=new Set();if(b.dataset.para)sel.add(b.dataset.para);openSheet('__asig','edit',{pid:b.dataset.asignar||'',sel});return true}
  if(b=g('data-editplant')){openEditor('plantillas',b.dataset.editplant,S.plantillas[b.dataset.editplant]);return true}
  if(b=g('data-newplant')){openEditor('plantillas',null,{nombre:'Nueva plantilla',tipo:'individual',duracionSemanas:4,secciones:[newSeccion(3)]});return true}
  if(b=g('data-editej')){openEjSheet(b.dataset.editej);return true}
  if(b=g('data-newej')){openEjSheet(null,{nombre:S.bq||''});return true}
  if(b=g('data-pdf')){descargarPDFs([b.dataset.pdf]);return true}
  if(b=g('data-rsub')){S.rsub=b.dataset.rsub;renderRutinas();return true}
  if(b=g('data-evista')){S.evista=b.dataset.evista;renderRutinas();return true}
  if(b=g('data-epago')){S.ePago=b.dataset.epago;renderRutinas();return true}
  if(b=g('data-lppago')){S.lpPago=b.dataset.lppago;renderRutinas();return true}
  if(b=g('data-lpgym')){S.lpGym=b.dataset.lpgym;renderRutinas();return true}
  if(b=g('data-lpplan')){S.lpPlan=b.dataset.lpplan;renderRutinas();return true}
  if(b=g('data-hedit')){const e2=S.ents[b.dataset.hedit];S.horEdit={id:e2.id,hs:clone(e2.horarios||[])};if(!S.horEdit.hs.length)S.horEdit.hs=[{dia:1,hora:'08:00',dur:60}];renderSheet();return true}
  if(b=g('data-hadd')){horLeer();const u=S.horEdit.hs[S.horEdit.hs.length-1];S.horEdit.hs.push({dia:u?Math.min(7,Number(u.dia)+2):1,hora:u?.hora||'08:00',dur:u?.dur||60});renderSheet();return true}
  if(b=g('data-hdel')){horLeer();S.horEdit.hs.splice(Number(b.dataset.hdel),1);renderSheet();return true}
  if(b=g('data-hcancel')){S.horEdit=null;renderSheet();return true}
  if(b=g('data-hsave')){horLeer();const hs=S.horEdit.hs.filter(h=>h.dia&&/^\d{1,2}:\d{2}$/.test(h.hora||'')).map(h=>({dia:Number(h.dia),hora:h.hora,dur:Number(h.dur)||60}));const id=b.dataset.hsave;
    write(()=>S.db.collection('entrenados').doc(id).update({horarios:hs})).then(ok=>{if(ok){S.ents[id].horarios=hs;S.horEdit=null;toast('Horarios guardados');renderSheet()}});return true}
  if(b=g('data-vercambios')){S.verCambios=b.dataset.vercambios||null;renderSheet();return true}
  if(b=g('data-goto')){location.hash=b.dataset.goto;return true}
  return false;
}
document.addEventListener('click',e=>{
  if(e.target.closest('#overlay')&&['__rut','__ej','__asig','__posp','__copiar','__formas'].includes(openId))return;
  if(handleRut(e))return;
  if(e.target.closest('#overlay'))return;
  const m=e.target.closest('[data-msg]');if(m){openSheet(m.dataset.msg,'wa',m.dataset.kind);return}
  const b=e.target.closest('[data-bulk]');if(b){startBulk(b.dataset.bulk);return}
  const fz=e.target.closest('[data-formas]');if(fz){openSheet('__formas','ver',{mes:S.mes,f:fz.dataset.formas});return}
  const mc=e.target.closest('[data-mes]');if(mc){S.mes=mc.dataset.mes;renderPanel();window.scrollTo(0,0);return}
  const pv=e.target.closest('[data-pv]');if(pv){S.pv=pv.dataset.pv;render();return}
  const fv=e.target.closest('[data-falta]');if(fv){S.faltaVer=!S.faltaVer;render();if(S.faltaVer)setTimeout(()=>document.getElementById('falta-l')?.scrollIntoView({behavior:'smooth',block:'nearest'}),60);return}
  const cb=e.target.closest('[data-cobrar]');if(cb){openSheet(cb.dataset.cobrar,'pago');return}
  const pt=e.target.closest('[data-ptab]');if(pt){S.ptab=pt.dataset.ptab;try{localStorage.setItem('entrena.ptab',S.ptab)}catch(_){}conTransicion(()=>{render();scrollTo({top:0})});return}
  const lq=e.target.closest('[data-liq]');if(lq){const l=S.liqs.find(x=>x._id===lq.dataset.liq);if(l){S.lq={id:l._id,mes:l.mes,fecha:l.fecha,monto:l.monto,forma:l.forma||'efectivo',filas:(l.filas||[]).map(f=>({...f})),archivo:l.archivo||'',msg:''};openSheet('__liq','ver')}return}
  const ln=e.target.closest('[data-liqnew]');if(ln){S.lq=liqNueva();if(/^\d{4}-\d{2}$/.test(ln.dataset.liqnew))S.lq.mes=ln.dataset.liqnew;openSheet('__liq','ver');return}
  const rn=e.target.closest('[data-rend]');if(rn){S.rend={};openSheet('__rend','ver',rn.dataset.rend);return}
  const ci=e.target.closest('[data-cerrar]');if(ci){if(ci.dataset.armed!=='1'){ci.dataset.armed='1';ci.textContent='Confirmar cierre';return}cerrarMes(ci.dataset.cerrar);return}
  const o=e.target.closest('[data-open]');if(o)openSheet(o.dataset.open);
});
/* encabezado: inicial de la cuenta; el email y "Salir" quedan en el menú */
(()=>{const um=$('#user-mail'),ui=$('#user-ini');if(!um||!ui)return;const f=()=>{ui.textContent=(um.textContent.trim()[0]||'·').toUpperCase()};f();new MutationObserver(f).observe(um,{childList:true,characterData:true,subtree:true})})();
/* menús desplegables: se cierran al elegir una opción o al tocar afuera */
/* Menús desplegables con la Popover API (popover="auto"): el navegador los pone por encima de todo,
   los cierra al tocar afuera o con Esc y devuelve el foco al botón. Al elegir una opción se cierran. */
document.addEventListener('click',ev=>{const it=ev.target.closest('.pmenu button');if(!it)return;const pm=it.closest('.pmenu');
  setTimeout(()=>{if(POP){try{pm.hidePopover()}catch(_){}}else pm.classList.remove('open')},0)});
/* Navegadores sin popover: los mismos botones abren y cierran el panel con una clase */
if(!POP){document.documentElement.classList.add('no-pop');
  document.addEventListener('click',ev=>{const t=ev.target.closest('[popovertarget]');const all=[...document.querySelectorAll('.pmenu.open')];
    if(t){const pm=document.getElementById(t.getAttribute('popovertarget'));all.forEach(x=>{if(x!==pm)x.classList.remove('open')});if(pm){pm.classList.toggle('open');t.setAttribute('aria-expanded',pm.classList.contains('open'))}return}
    all.forEach(x=>{if(!x.contains(ev.target))x.classList.remove('open')})})}
$('#fab').addEventListener('click',()=>openSheet('__new','editar'));
/* el botón "+ Nuevo entrenado" se achica a un círculo al bajar, para no tapar contenido */
/* ---------- EQUIPO PRO · Etapa 1: plantel y tests ---------- */
/* Tests físicos con historial (colección «tests») y equipos con su plantel (colección «equipos»).
   La VAM y el sprint son la base de los ritmos; el 1RM sigue guardándose en la ficha (e.rm) para que las rutinas lo usen como siempre. */
const TCAMPOS=[
  {k:'vam',l:'VAM',u:'m/s',d:2,min:2,max:7,step:'0.01',mejor:1},
  {k:'cmj',l:'CMJ',u:'cm',d:1,min:5,max:100,step:'0.5',mejor:1},
  {k:'abk',l:'Abalakov',u:'cm',d:1,min:5,max:110,step:'0.5',mejor:1},
  {k:'t10',l:'10 m',u:'s',d:2,min:1,max:4,step:'0.01',mejor:-1},
  {k:'t20',l:'20 m',u:'s',d:2,min:2,max:6,step:'0.01',mejor:-1},
  {k:'t30',l:'30 m',u:'s',d:2,min:3,max:8,step:'0.01',mejor:-1},
  {k:'peso',l:'Peso',u:'kg',d:1,min:30,max:200,step:'0.1',mejor:0}
];
const nfx=(n,d=0)=>Number(n).toLocaleString('es-AR',{minimumFractionDigits:d,maximumFractionDigits:d});
const testsDe=id=>(S.tests||[]).filter(t=>t.entrenadoId===id).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')||(b.ts||0)-(a.ts||0));
/* último valor cargado de cada campo (un test puede no tener todos los campos) */
function ultimoTest(id){const ts=testsDe(id),u={};TCAMPOS.forEach(c=>{const t=ts.find(x=>x[c.k]!=null&&x[c.k]!=='');if(t)u[c.k]={v:Number(t[c.k]),f:t.fecha}});
  const y=ts.find(x=>x.yoyo);if(y)u.yoyo={v:y.yoyo,f:y.fecha};u.fecha=ts[0]?.fecha||null;return u}
function deltaTest(id,c,t){const ts=testsDe(id),i=ts.indexOf(t),p=ts.slice(i+1).find(x=>x[c.k]!=null&&x[c.k]!=='');
  if(!p||t[c.k]==null||t[c.k]==='')return '';const dv=Number(t[c.k])-Number(p[c.k]);if(Math.abs(dv)<1e-9)return '<span class="t-d">= anterior</span>';
  const bien=c.mejor===0?null:Math.sign(dv)===c.mejor;return `<span class="t-d ${bien==null?'':bien?'up':'down'}">${dv>0?'▲':'▼'} ${nfx(Math.abs(dv),c.d)}</span>`}
const semanasDesde=f=>f?Math.floor(days(today(),parse(f))/7):null;
const eqDe=id=>(S.equipos||[]).filter(q=>(q.jugadores||[]).includes(id));

function testsFichaHTML(e){
  const ts=testsDe(e.id),u=ultimoTest(e.id),eqs=eqDe(e.id);
  const head=`<div class="pad" style="padding-bottom:4px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><b>Tests físicos</b>${eqs.length?` ${eqs.map(q=>`<span class="pill p-mute">${esc(q.nombre)}</span>`).join(' ')}`:''}<p class="hint">VAM, saltos y sprint con su historial. La VAM y el sprint marcan los ritmos de carrera; el 1RM, los kilos.</p></div><button class="btn" type="button" data-tnew="${esc(e.id)}">Cargar test</button></div>`;
  if(!ts.length)return `<div class="card">${head}<div class="empty">Todavía no tiene tests cargados.</div></div>`;
  const last=ts[0],sem=semanasDesde(u.fecha);
  const vam=u.vam?u.vam.v:null;
  return `<div class="card">${head}
    <div class="t-grid">${TCAMPOS.filter(c=>u[c.k]).map(c=>`<div class="t-v"><span class="l">${c.l}</span><b>${nfx(u[c.k].v,c.d)}<small> ${c.u}</small></b>${u[c.k].f===last.fecha?deltaTest(e.id,c,last):`<span class="t-d">${fmtShort(u[c.k].f)}</span>`}</div>`).join('')}
      ${u.yoyo?`<div class="t-v"><span class="l">Yo-Yo IR1</span><b>${esc(u.yoyo.v)}</b><span class="t-d">${fmtShort(u.yoyo.f)}</span></div>`:''}</div>
    ${vam?`<p class="hint pad" style="padding-top:0">VAM ${nfx(vam*3.6,1)} km/h · 1000 m al 100 % en ${(()=>{const s=1000/vam;return Math.floor(s/60)+':'+String(Math.round(s%60)).padStart(2,'0')})()} · último test ${fmtD(u.fecha)}${sem!=null&&sem>=8?` <span class="pill p-warn">hace ${sem} semanas</span>`:''}</p>`:''}
    <ul class="timeline">${ts.slice(0,6).map(t=>`<li><span class="d">${fmtD(t.fecha)}</span><span class="t">${TCAMPOS.filter(c=>t[c.k]!=null&&t[c.k]!=='').map(c=>`${c.l} ${nfx(t[c.k],c.d)}`).join(' · ')||'—'}${t.yoyo?' · Yo-Yo '+esc(t.yoyo):''}${t.notas?` <span class="hint" style="display:inline">· ${esc(t.notas)}</span>`:''}</span><button class="del" type="button" data-tedit="${esc(t._id)}" aria-label="Editar test del ${fmtD(t.fecha)}">Editar</button></li>`).join('')}</ul></div>`}

function testFormHTML(a){
  const e=S.ents[a.eid]||{},t=a.id?(S.tests||[]).find(x=>x._id===a.id)||{}:{},rm=e.rm||{};
  const v=k=>t[k]!=null?t[k]:'';
  return `<form id="tf" class="form pad" novalidate>
    <p class="hint full">${esc(name(e))}${a.id?' · editando el test del '+fmtD(t.fecha):''}. Cargá solo lo que se midió; lo demás puede quedar vacío.</p>
    <label>Fecha<input id="tf-fecha" type="date" required value="${esc(t.fecha||iso(today()))}"></label>
    <label>Yo-Yo IR1 (nivel)<input id="tf-yoyo" placeholder="Ej: 15:1" value="${esc(v('yoyo'))}"></label>
    ${TCAMPOS.map(c=>`<label>${c.l} (${c.u})<input id="tf-${c.k}" type="number" inputmode="decimal" min="${c.min}" max="${c.max}" step="${c.step}" value="${esc(v(c.k))}"></label>`).join('')}
    <label class="full">Notas<input id="tf-notas" placeholder="Ej: cancha de parquet, después de entrar en calor 15 min" value="${esc(v('notas'))}"></label>
    ${(S.cfg.rmDefs||[]).some(d=>!d.base)?`<fieldset class="full tf-rm"><legend>Marcas (1RM) medidas en este test</legend><div class="form cols3">${(S.cfg.rmDefs||[]).filter(d=>!d.base).map(d=>`<label>${esc(titleCase(d.mov))}<input data-trm="${esc(d.mov)}" type="number" min="0" step="0.5" inputmode="decimal" value="${esc((t.rm||{})[d.mov]??'')}" placeholder="${esc(rm[d.mov]??'')}"></label>`).join('')}</div>
      <label class="av-g"><input type="checkbox" id="tf-upd" checked> Actualizar las marcas de la ficha con estos valores</label></fieldset>`:''}
    <p class="hint full" id="tf-msg" role="alert"></p>
    <div class="full actions">${a.id?`<button class="btn danger" type="button" data-tdel="${esc(a.id)}">${S.tArm===a.id?'Tocá de nuevo para borrar':'Borrar test'}</button>`:''}<span style="flex:1"></span><button class="btn" type="button" data-tback>Cancelar</button><button class="btn pri" type="submit">Guardar test</button></div>
  </form>`}
function leerTest(){
  const d={fecha:$('#tf-fecha').value,yoyo:$('#tf-yoyo').value.trim(),notas:$('#tf-notas').value.trim()},rm={};let bad='';
  TCAMPOS.forEach(c=>{const el=$('#tf-'+c.k),x=el.value.trim();if(x==='')return;const n=Number(x.replace(',','.'));if(!isFinite(n)||n<c.min||n>c.max){bad=bad||`${c.l}: tiene que estar entre ${c.min} y ${c.max} ${c.u}.`;return}d[c.k]=n});
  document.querySelectorAll('[data-trm]').forEach(i=>{const n=Number(i.value);if(i.value!==''&&n>0)rm[i.dataset.trm]=n});
  if(!d.fecha)bad='Elegí la fecha del test.';
  if(!bad&&d.t10&&d.t20&&d.t10>=d.t20)bad='El tiempo de 10 m tiene que ser menor que el de 20 m.';
  if(!bad&&d.t20&&d.t30&&d.t20>=d.t30)bad='El tiempo de 20 m tiene que ser menor que el de 30 m.';
  if(!bad&&!TCAMPOS.some(c=>d[c.k]!=null)&&!d.yoyo&&!Object.keys(rm).length)bad='Cargá al menos un valor.';
  if(Object.keys(rm).length)d.rm=rm;
  return {d,bad}}
function bindTest(a){const ov=$('#overlay');
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    if(ev.target.closest('[data-tback]')){S.tArm=null;openSheet(a.eid);return}
    const dl=ev.target.closest('[data-tdel]');if(dl){if(S.tArm!==a.id){S.tArm=a.id;renderSheet();return}S.tArm=null;
      if(await write(()=>S.db.collection('tests').doc(a.id).delete())){toast('Test borrado');openSheet(a.eid)}}};
  $('#tf').onsubmit=async ev=>{ev.preventDefault();const {d,bad}=leerTest();const msg=$('#tf-msg');if(bad){msg.textContent=bad;return}
    const e=S.ents[a.eid];const doc={...d,entrenadoId:a.eid,ts:a.id?((S.tests||[]).find(x=>x._id===a.id)||{}).ts||Date.now():Date.now()};
    const ok=a.id?await write(()=>S.db.collection('tests').doc(a.id).set(doc)):await write(()=>S.db.collection('tests').add(doc));if(!ok)return;
    const up=$('#tf-upd');if(d.rm&&up&&up.checked)await write(()=>S.db.collection('entrenados').doc(a.eid).update({rm:{...(e.rm||{}),...d.rm}}));
    if(!a.id)await addHist(a.eid,'Evaluación física','Test: '+[TCAMPOS.filter(c=>d[c.k]!=null).map(c=>`${c.l} ${nfx(d[c.k],c.d)} ${c.u}`).join(' · '),d.yoyo?'Yo-Yo '+d.yoyo:'',d.rm?Object.entries(d.rm).map(([k,v])=>`${titleCase(k)} ${v} kg`).join(' · '):''].filter(Boolean).join(' · '),d.fecha);
    toast(a.id?'Test actualizado':'Test guardado');openSheet(a.eid)}}

/* ----- vista Equipos ----- */
function renderEquipos(){
  const el=$('#v-equipos');if(!el)return;
  const eqs=(S.equipos||[]).slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  if(!eqs.find(q=>q._id===S.eqSel))S.eqSel=eqs[0]?._id||null;
  const q=eqs.find(x=>x._id===S.eqSel);
  const top=`<div class="eq-top"><div><h2 class="eq-h">Equipos</h2><p class="hint">Plantel, tests, temporada y dosis de cada equipo. Cada jugador recibe en su link los tiempos y kilos calculados con sus tests.</p></div><div class="actions"><button class="btn" type="button" data-guia="inicio">Guía</button><button class="btn" type="button" data-protos>Protocolos de test</button><button class="btn" type="button" data-epform>Fórmulas</button><button class="btn pri" type="button" data-eqnew>Nuevo equipo</button></div></div>`;
  if(!eqs.length){el.innerHTML=top+`<div class="card pad eq-empty"><b>Todavía no hay equipos.</b><p class="hint">Creá uno (por ejemplo «AFALP Primera»), sumá a los jugadores que ya son entrenados de la app y cargá sus tests: VAM, saltos, sprint y 1RM.</p><div><button class="btn pri" type="button" data-eqnew>Crear el primer equipo</button></div></div>`;return}
  const mov=(S.cfg.rmDefs||[]).filter(d=>!d.base).slice(0,4).map(d=>d.mov);
  const js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).sort((a,b)=>(a.posicion||'~').localeCompare(b.posicion||'~')||name(a).localeCompare(name(b)));
  const U=Object.fromEntries(js.map(e=>[e.id,ultimoTest(e.id)]));
  const prom=k=>{const v=js.map(e=>U[e.id][k]?.v).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  const sinTest=js.filter(e=>!U[e.id].fecha).length,viejos=js.filter(e=>{const s=semanasDesde(U[e.id].fecha);return s!=null&&s>=8}).length;
  const cell=(e,c)=>{const x=U[e.id][c.k];return x?`<td class="num">${nfx(x.v,c.d)}</td>`:'<td class="num muted">—</td>'};
  el.innerHTML=top+`${eqs.length>1?`<div class="chips eq-chips">${eqs.map(x=>`<button class="chip" type="button" data-eqsel="${esc(x._id)}" aria-pressed="${x._id===q._id}">${esc(x.nombre)}</button>`).join('')}</div>`:''}
  <div class="card"><div class="pad eq-head"><div><h3>${esc(q.nombre)}</h3><p class="hint">${esc([q.deporte,q.categoria].filter(Boolean).join(' · ')||'Equipo')} · ${plural(js.length,'jugador','jugadores')}</p></div>
    <div class="actions"><button class="btn" type="button" data-eqedit="${esc(q._id)}">Editar equipo y plantel</button>${js.length?`<button class="btn pri" type="button" data-eqlote="${esc(q._id)}">Cargar tests del plantel</button>`:''}</div></div>
    ${js.length?`<div class="eq-kpis"><div><b>${prom('vam')!=null?nfx(prom('vam'),2):'—'}</b><span>VAM media (m/s)</span></div><div><b>${prom('t30')!=null?nfx(prom('t30'),2):'—'}</b><span>30 m medio (s)</span></div><div><b>${prom('cmj')!=null?nfx(prom('cmj'),1):'—'}</b><span>CMJ medio (cm)</span></div><div><b>${sinTest+viejos}</b><span>${sinTest?plural(sinTest,'sin test','sin test'):'sin tests pendientes'}${viejos?` · ${viejos} con más de 8 semanas`:''}</span></div></div>
    <div class="tbl-wrap"><table class="eq-t"><thead><tr><th>Jugador</th><th>Posición</th><th>Último test</th>${TCAMPOS.filter(c=>c.k!=='peso').map(c=>`<th class="num">${c.l} <small>${c.u}</small></th>`).join('')}${mov.map(m=>`<th class="num">${esc(titleCase(m))} <small>kg</small></th>`).join('')}<th></th></tr></thead>
    <tbody>${js.map(e=>{const s=semanasDesde(U[e.id].fecha);return `<tr><td><button class="lnk" type="button" data-open="${esc(e.id)}">${esc(name(e))}</button></td><td>${esc(e.posicion||'—')}</td>
      <td>${U[e.id].fecha?`${fmtShort(U[e.id].fecha)}${s>=8?' <span class="pill p-warn">'+s+' sem</span>':''}`:'<span class="pill p-mute">Sin test</span>'}</td>
      ${TCAMPOS.filter(c=>c.k!=='peso').map(c=>cell(e,c)).join('')}${mov.map(m=>{const v=(e.rm||{})[m]??rmValue(e,m);return `<td class="num">${v?nfx(v,v%1?1:0):'<span class="muted">—</span>'}</td>`}).join('')}
      <td><button class="btn sm" type="button" data-tnew="${esc(e.id)}">Test</button></td></tr>`}).join('')}</tbody></table></div>`
    :`<div class="empty">El equipo no tiene jugadores. Tocá «Editar equipo y plantel» para sumar entrenados.</div>`}</div>${temporadaHTML(q)}${epControlHTML(q,tempDe(q._id))}`;
  /* la primera vez, el tablero se corre hasta la semana actual */
  const tp=tempDe(q._id);S.tpVisto=S.tpVisto||{};if(tp&&!S.tpVisto[tp._id]){const h=el.querySelector('.tp-season .wk.hoy'),sc=el.querySelector('.tp-scroll');if(h&&sc){S.tpVisto[tp._id]=1;requestAnimationFrame(()=>{sc.scrollLeft=Math.max(0,h.offsetLeft-96-sc.clientWidth/3)})}}
}
function equipoFormHTML(a){const q=a.id?(S.equipos||[]).find(x=>x._id===a.id)||{}:{};const sel=new Set(a.sel||q.jugadores||[]);
  const ents=Object.values(S.ents).filter(e=>estado(e)!=='Baja'||sel.has(e.id)).sort((x,y)=>name(x).localeCompare(name(y)));const fq=(a.q||'').toLowerCase();
  return `<form id="eqf" class="form pad">
    <label class="full">Nombre del equipo<input id="eq-n" required placeholder="Ej: AFALP Primera" value="${esc(a.n??q.nombre??'')}"></label>
    <label>Deporte<input id="eq-d" placeholder="Ej: Handball" value="${esc(a.d??q.deporte??'Handball')}"></label>
    <label>Categoría<input id="eq-c" placeholder="Ej: Liga de Honor Plata" value="${esc(a.c??q.categoria??'')}"></label>
    <div class="full"><div class="eq-pick-h"><b>Plantel</b> <span class="hint" style="display:inline" id="eq-cnt" aria-live="polite">${plural(sel.size,'elegido','elegidos')}</span><input id="eq-q" class="search" type="search" placeholder="Buscar entrenado" value="${esc(a.q||'')}" autocomplete="off"></div>
      <div class="eq-pick">${ents.filter(e=>!fq||(e.nombre||'').toLowerCase().includes(fq)||sel.has(e.id)).map(e=>`<label class="av-g"><input type="checkbox" data-eqj="${esc(e.id)}" ${sel.has(e.id)?'checked':''}> ${esc(name(e))} <span class="hint" style="display:inline">${esc(e.posicion||gymOf(e)||'')}</span></label>`).join('')||'<p class="hint">No hay entrenados con ese nombre.</p>'}</div>
      <p class="hint">La posición de cada jugador se edita en su ficha (Editar → Posición).</p></div>
    <p class="hint full" id="eq-msg" role="alert"></p>
    <div class="full actions">${a.id?`<button class="btn danger" type="button" data-eqdel>${S.eqArm===a.id?'Tocá de nuevo para borrar':'Borrar equipo'}</button>`:''}<span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>`}
function bindEquipo(a){const ov=$('#overlay');
  const leer=()=>{a.n=$('#eq-n').value;a.d=$('#eq-d').value;a.c=$('#eq-c').value;a.sel=[...ov.querySelectorAll('[data-eqj]:checked')].map(i=>i.dataset.eqj).concat((a.sel||[]).filter(id=>!ov.querySelector(`[data-eqj="${CSS.escape(id)}"]`)))};
  ov.oninput=ev=>{if(ev.target.id==='eq-q'){leer();a.q=ev.target.value;renderSheet()}};
  ov.onchange=ev=>{if(ev.target.dataset.eqj!=null){leer();const c=$('#eq-cnt');if(c)c.textContent=plural(new Set(a.sel).size,'elegido','elegidos')}};
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){S.eqArm=null;closeSheet();return}
    if(ev.target.closest('[data-eqdel]')){if(S.eqArm!==a.id){S.eqArm=a.id;leer();renderSheet();return}S.eqArm=null;if(await write(()=>S.db.collection('equipos').doc(a.id).delete())){toast('Equipo borrado');closeSheet()}}};
  $('#eqf').onsubmit=async ev=>{ev.preventDefault();leer();const n=(a.n||'').trim();if(!n){$('#eq-msg').textContent='Poné un nombre al equipo.';return}
    const prev=a.id?(S.equipos||[]).find(x=>x._id===a.id)||{}:{};const doc={...prev,nombre:n,deporte:(a.d||'').trim(),categoria:(a.c||'').trim(),jugadores:[...new Set(a.sel||[])],ts:prev.ts||Date.now()};delete doc._id;
    let ok;if(a.id)ok=await write(()=>S.db.collection('equipos').doc(a.id).set(doc));else{try{const r=await S.db.collection('equipos').add(doc);S.eqSel=r.id;ok=true}catch(_){toast('No se pudo guardar');ok=false}}
    if(ok){toast(a.id?'Equipo actualizado':'Equipo creado');closeSheet()}}}
/* carga de tests de todo el plantel en una sola pantalla (día de evaluación) */
const LOTE=['vam','cmj','abk','t10','t20','t30'];
function loteHTML(a){const q=(S.equipos||[]).find(x=>x._id===a.eq)||{};const js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).sort((x,y)=>name(x).localeCompare(name(y)));const C=TCAMPOS.filter(c=>LOTE.includes(c.k));
  return `<form id="lf" class="pad" novalidate><div class="form"><label>Fecha del test<input id="lf-fecha" type="date" required value="${esc(a.fecha||iso(today()))}"></label><p class="hint" style="align-self:end">Completá solo lo que se midió. Se guarda un test por jugador con al menos un valor.</p></div>
    <div class="tbl-wrap" style="margin-top:12px"><table class="eq-t lote"><thead><tr><th>Jugador</th>${C.map(c=>`<th>${c.l} <small>${c.u}</small></th>`).join('')}</tr></thead>
    <tbody>${js.map(e=>`<tr><td>${esc(name(e))}</td>${C.map(c=>`<td><input type="number" inputmode="decimal" data-lj="${esc(e.id)}" data-lk="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" aria-label="${esc(c.l+' de '+name(e))}" value="${esc(((a.v||{})[e.id]||{})[c.k]??'')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="hint" id="lf-msg" role="alert" style="margin-top:8px"></p>
    <div class="actions" style="margin-top:8px"><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Guardar tests</button></div></form>`}
function bindLote(a){const ov=$('#overlay');
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};
  $('#lf').onsubmit=async ev=>{ev.preventDefault();const f=$('#lf-fecha').value,msg=$('#lf-msg');if(!f){msg.textContent='Elegí la fecha del test.';return}
    const by={};let bad='';ov.querySelectorAll('[data-lj]').forEach(i=>{if(i.value==='')return;const c=TCAMPOS.find(x=>x.k===i.dataset.lk),n=Number(i.value);if(!isFinite(n)||n<c.min||n>c.max){bad=bad||`${name(S.ents[i.dataset.lj])} · ${c.l}: entre ${c.min} y ${c.max} ${c.u}.`;i.focus();return}(by[i.dataset.lj]=by[i.dataset.lj]||{})[c.k]=n});
    if(!bad)for(const[id,d]of Object.entries(by)){if(d.t10&&d.t20&&d.t10>=d.t20||d.t20&&d.t30&&d.t20>=d.t30){bad=`${name(S.ents[id])}: los tiempos tienen que crecer de 10 a 30 m.`;break}}
    if(bad){msg.textContent=bad;return}const ids=Object.keys(by);if(!ids.length){msg.textContent='No cargaste ningún valor.';return}
    let n=0;for(const id of ids){const d=by[id];if(await write(()=>S.db.collection('tests').add({...d,fecha:f,entrenadoId:id,ts:Date.now()}))){n++;await addHist(id,'Evaluación física','Test: '+TCAMPOS.filter(c=>d[c.k]!=null).map(c=>`${c.l} ${nfx(d[c.k],c.d)} ${c.u}`).join(' · '),f)}}
    toast(plural(n,'test guardado','tests guardados'));closeSheet()}}
document.addEventListener('click',ev=>{const t=ev.target.closest&&ev.target.closest('[data-tnew],[data-tedit],[data-eqnew],[data-eqedit],[data-eqsel],[data-eqlote]');if(!t)return;const D=t.dataset;
  if(D.tnew!=null){S.tArm=null;openSheet('__test','ver',{eid:D.tnew});return}
  if(D.tedit!=null){const x=(S.tests||[]).find(y=>y._id===D.tedit);if(x){S.tArm=null;openSheet('__test','ver',{eid:x.entrenadoId,id:x._id})}return}
  if(D.eqnew!=null){S.eqArm=null;openSheet('__equipo','ver',{});return}
  if(D.eqedit!=null){S.eqArm=null;openSheet('__equipo','ver',{id:D.eqedit});return}
  if(D.eqsel!=null){S.eqSel=D.eqsel;render();return}
  if(D.eqlote!=null){openSheet('__tlote','ver',{eq:D.eqlote});return}});
/* ---------- EQUIPO PRO · Etapa 2: temporada (macrociclo) ---------- */
/* Colección «temporadas»: {equipoId, nombre, inicio (lunes de la semana 1), partido, semanas:[{per, meso, tipo, rel, comp, test, days:[{q, met[]}]}]}.
   Las fechas y los meses salen solos de «inicio». La dosis de cada sesión llega en la etapa 3. */
const T_TIPOS={INTRODUCTORIO:'Introductorio',CARGA:'Carga',CHOQUE:'Choque',REGENERATIVO:'Regenerativo',TRANSICION:'Transición'};
const T_PERS=['PREPARATORIO','COMPETITIVO 1','TRANSITORIO 1','COMPETITIVO 2','TRANSITORIO 2'];
const T_RELS=['1:4','2:3','3:2','4:1'];
const T_DIAS=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const T_Q={R:'Resistencia',F:'Fuerza',V:'Velocidad'};
/* métodos de la planilla: abreviatura → [nombre, cualidad, objetivo] */
const T_MET={'CE':['Continuo extensivo','R','Eficiencia aeróbica'],'CI':['Continuo intensivo','R','Capacidad aeróbica'],'CV1':['Continuo variable I','R','Eficiencia aeróbica'],'CV2':['Continuo variable II','R','Capacidad aeróbica'],
 'IE-IL':['Interválico extensivo, pausa larga','R','Capacidad aeróbica'],'IE-IM':['Interválico extensivo, pausa media','R','Potencia aeróbica'],'II-IC':['Interválico intensivo, pausa corta','R','Potencia aeróbica'],'II-IEC':['Interválico intensivo, pausa extra corta','R','Potencia aeróbica'],
 'Rep-IL':['Repeticiones, pausa larga','R','Potencia aeróbica'],'Rep-IM':['Repeticiones, pausa media','R','Potencia láctica'],'Rep-IC':['Repeticiones, pausa corta','R','Potencia aláctica'],
 'Rep III':['Repeticiones III','F','Acondicionamiento músculo-tendinoso'],'Rep II':['Repeticiones II','F','Fuerza máxima e hipertrofia'],'Rep I':['Repeticiones I','F','Fuerza máxima e hipertrofia'],'I Máx':['Intensidades máximas','F','Coordinación intramuscular y fuerza máxima'],'I Máx II':['Intensidades máximas II','F','Coordinación intramuscular y fuerza máxima'],'Pirámide':['Pirámide','F','Fuerza máxima e hipertrofia'],'Contraste':['Contraste','F','Fuerza máxima y explosiva'],'Concéntrico':['Concéntrico puro','F','Activación nerviosa y fuerza explosiva'],'Pliometría':['Pliometría','F','Fuerza explosiva y reactividad'],
 'FS':['Velocidad máxima (lanzada)','V','Potencia aláctica'],'RCM':['Aceleración (repeticiones cortas máximas)','V','Potencia aláctica'],'SEV':['Salidas a estímulos variables','V','Potencia aláctica'],'RSA':['Resistencia a la velocidad (RSA)','V','Capacidad aláctica']};
/* nombres tal como aparecen en la hoja MACRO → abreviatura */
const T_XL={'continuo extensivo':'CE','continuo intensivo':'CI','continuo variable i':'CV1','continuo variable ii':'CV2','interv ext c/ i largo':'IE-IL','interv ext c/ i medios':'IE-IM','interv intensivos c/ i cortos':'II-IC','interv intensivos c/ ie cortos':'II-IEC',
 'repeticiones c/ i largos':'Rep-IL','repeticiones c/ i medios':'Rep-IM','repeticiones c/ i cortos':'Rep-IC','repeticiones i':'Rep I','repeticiones ii':'Rep II','repeticiones iii':'Rep III','intensidades maximas':'I Máx','intensidades máximas':'I Máx','intensidades máximas ii':'I Máx II','intensidades maximas ii':'I Máx II',
 'piramide':'Pirámide','pirámide':'Pirámide','contrastes':'Contraste','concéntrico puro':'Concéntrico','concentrico puro':'Concéntrico','pliométrico':'Pliometría','pliometrico':'Pliometría','velocidad máxima (fs)':'FS','velocidad maxima (fs)':'FS','aceleración (rcm)':'RCM','aceleracion (rcm)':'RCM','velocidad de reaccion (sev)':'SEV','velocidad de reacción (sev)':'SEV','resistencia a la velocidad (rsa)':'RSA'};
/* plantilla: la hoja MACRO del TP final (42 semanas de handball) */
const T_TP=[["PREPARATORIO",1,"INTRODUCTORIO","1:4","PRETEMPORADA",0,[["R",["CE","IE-IL"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""]],[]],["RF",["IE-IM","II-IC","Rep III"],[["IE-IM",1,6,400,80.0,"2'30\"",""],["II-IC",3,3,200,85.0,"3'","10'"]],[["Rep III","SENTADILLA",4,10,60.0,"2'","2'"],["Rep III","REMO CON BARRA",4,10,60.0,"2'","2'"],["Rep III","CARGADA",3,6,60.0,"2'","2'"]]],["RV",["CE","IE-IL","RCM","RSA"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""],["RCM",2,3,30,95.0,"2'","5'"],["RSA",2,5,20,90.0,"30\"","5'"]],[]],["RF",["IE-IM","II-IC","Rep III"],[["IE-IM",1,6,400,80.0,"2'30\"",""],["II-IC",3,3,200,85.0,"3'","10'"]],[["Rep III","PRESS BANCO PLANO",4,10,60.0,"2'","2'"],["Rep III","PESO MUERTO",4,10,60.0,"2'","2'"],["Rep III","CARGADA",3,6,60.0,"2'","2'"]]],["R",["CE","IE-IL"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""]],[]]]],["PREPARATORIO",1,"INTRODUCTORIO","2:3","PRETEMPORADA",0,[["R",["CE","IE-IL"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""]],[]],["RF",["IE-IM","II-IC","Rep III","Contraste"],[["IE-IM",1,6,400,80.0,"2'30\"",""],["II-IC",3,3,200,85.0,"3'","10'"]],[["Rep III","SENTADILLA",4,12,60.0,"2'","2'"],["Rep III","REMO CON BARRA",4,10,60.0,"2'","2'"],["Contraste","CARGADA",3,6,85.0,"3'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["CE","IE-IL","RCM"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""],["RCM",2,3,30,95.0,"2'","5'"]],[]],["RF",["IE-IM","II-IC","Rep III","Contraste"],[["IE-IM",1,6,400,80.0,"2'30\"",""],["II-IC",3,3,200,85.0,"3'","10'"]],[["Rep III","PRESS BANCO PLANO",4,10,60.0,"2'","2'"],["Rep III","PESO MUERTO",4,10,60.0,"2'","2'"],["Contraste","CARGADA",3,6,85.0,"2'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["CE","IE-IL","RCM","RSA"],[["CE",1,1,4000,60.0,"",""],["IE-IL",1,4,1000,75.0,"4'",""],["RCM",2,3,30,95.0,"2'","5'"],["RSA",2,5,20,90.0,"30\"","5'"]],[]]]],["PREPARATORIO",1,"CARGA","3:2","PRETEMPORADA",0,[["R",["IE-IL","Rep-IC"],[["IE-IL",1,4,3000,75.0,"4'",""],["Rep-IC",1,4,50,105.0,"5'",""]],[]],["RF",["CE","IE-IM","Rep II","Rep III","Contraste"],[["CE",1,1,4000,65.0,"",""],["IE-IM",1,6,400,85.0,"2'30\"",""]],[["Rep II","SENTADILLA",5,10,70.0,"2'","2'"],["Rep III","REMO CON BARRA",4,10,60.0,"2'","2'"],["Contraste","CARGADA",3,6,90.0,"2'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["IE-IL","Rep-IC","RCM","RSA"],[["IE-IL",1,4,3000,75.0,"4'",""],["Rep-IC",1,4,50,105.0,"5'",""],["RCM",2,4,10,95.0,"2'","5'"],["RSA",2,5,30,90.0,"30\"","5'"]],[]],["RF",["CE","IE-IM","Rep II","Rep III","Contraste"],[["CE",1,1,4000,65.0,"",""],["IE-IM",1,6,400,85.0,"2'30\"",""]],[["Rep II","PRESS BANCO PLANO",3,8,70.0,"2'","2'"],["Rep III","PESO MUERTO",4,10,60.0,"2'","2'"],["Contraste","CARGADA",3,6,90.0,"2'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["IE-IL","Rep-IC","RCM"],[["IE-IL",1,4,3000,75.0,"4'",""],["Rep-IC",1,4,50,105.0,"5'",""],["RCM",2,3,20,95.0,"2'","5'"]],[]]]],["PREPARATORIO",1,"CHOQUE","4:1","PRETEMPORADA",0,[["RV",["IE-IL","RSA"],[["IE-IL",1,4,2000,85.0,"4'",""],["RSA",2,5,50,90.0,"30\"","5'"]],[]],["RF",["IE-IM","Rep-IC","I Máx","Contraste"],[["IE-IM",1,4,400,80.0,"2'30\"",""],["Rep-IC",1,4,50,110.0,"5'",""]],[["I Máx","SENTADILLA",4,3,90.0,"3'","2'"],["I Máx","REMO CON BARRA",4,2,90.0,"3'","2'"],["Contraste","CARGADA",3,6,90.0,"2'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["IE-IL","RCM"],[["IE-IL",1,4,2000,85.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["IE-IM","Rep-IC","I Máx","Contraste"],[["IE-IM",1,4,400,80.0,"2'30\"",""],["Rep-IC",1,4,50,110.0,"5'",""]],[["I Máx","PRESS BANCO PLANO",4,2,90.0,"3'","2'"],["I Máx","PESO MUERTO",4,2,90.0,"3'","2'"],["Contraste","CARGADA",3,6,90.0,"2'","2'"],["Contraste","CARGADA",3,6,40.0,"3'",""]]],["RV",["IE-IL","SEV","RSA"],[["IE-IL",1,4,2000,85.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"],["RSA",2,5,50,90.0,"30\"","5'"]],[]]]],["PREPARATORIO",1,"CARGA","3:2","PRETEMPORADA",0,[["RV",["CI","IE-IL","RSA"],[["CI",1,1,5200,85.0,"",""],["IE-IL",2,4,1000,80.0,"2'","4'"],["RSA",2,5,50,90.0,"30\"","5'"]],[]],["RF",["IE-IM","Rep-IM","Rep I","I Máx"],[["IE-IM",1,4,600,80.0,"4'",""],["Rep-IM",1,3,200,95.0,"6'",""]],[["Rep I","SENTADILLA",3,5,85.0,"2'","2'"],["Rep I","REMO CON BARRA",3,5,85.0,"2'","2'"],["I Máx","CARGADA",4,2,90.0,"3'","2'"]]],["RV",["CI","IE-IL","RSA"],[["CI",1,1,5200,85.0,"",""],["IE-IL",1,4,1000,80.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["IE-IM","Rep-IM","Rep I","I Máx"],[["IE-IM",1,4,600,80.0,"4'",""],["Rep-IM",1,3,200,95.0,"6'",""]],[["Rep I","PRESS BANCO PLANO",3,5,85.0,"2'","2'"],["Rep I","PESO MUERTO",3,5,85.0,"2'","2'"],["I Máx","CARGADA",4,2,90.0,"3'","2'"]]],["RV",["CI","IE-IL","SEV"],[["CI",1,1,5200,80.0,"",""],["IE-IL",1,4,1000,80.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["PREPARATORIO",2,"REGENERATIVO","2:3","PRETEMPORADA",1,[["RV",["CE","IE-IM","RSA"],[["CE",1,1,3000,60.0,"",""],["IE-IM",1,6,400,85.0,"3'",""],["RSA",2,5,50,90.0,"30\"","5'"]],[]],["RF",["IE-IM","Rep-IM","Rep I","I Máx"],[["Rep-IM",1,3,200,95.0,"5'",""],["IE-IM",1,6,400,85.0,"3'",""]],[["Rep I","SENTADILLA",3,5,80.0,"2'","2'"],["Rep I","REMO CON BARRA",3,5,80.0,"2'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CE","IE-IM","RSA"],[["CE",1,1,3000,60.0,"",""],["IE-IM",1,6,400,85.0,"3'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["CE","Rep-IM","Rep I","I Máx"],[["CE",1,1,3000,60.0,"",""],["Rep-IM",1,3,200,95.0,"5'",""]],[["Rep I","PRESS BANCO PLANO",3,5,80.0,"2'","2'"],["Rep I","PESO MUERTO",3,5,80.0,"2'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CE","IE-IL","SEV"],[["CE",1,1,3000,60.0,"",""],["IE-IL",1,4,1000,85.0,"3'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",2,"CARGA","2:3","FECHA 1",0,[["R",["CE","IE-IL"],[["CE",1,1,3000,75.0,"",""],["IE-IL",2,1,1000,85.0,"","2'"]],[]],["RF",["II-IC","Rep-IM","I Máx","Contraste"],[["II-IC",3,3,200,85.0,"2'","10'"],["Rep-IM",1,4,400,90.0,"4'",""]],[["Contraste","SENTADILLA",3,6,90.0,"1'","2'"],["Contraste","SENTADILLA",3,6,50.0,"1'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CE","IE-IL","RCM"],[["CE",1,1,3000,75.0,"",""],["IE-IL",2,1,1000,85.0,"","2'"],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["II-IC","Rep-IM","I Máx","Contraste"],[["II-IC",3,3,200,85.0,"2'","10'"],["Rep-IM",1,4,400,90.0,"4'",""]],[["Contraste","PESO MUERTO",3,6,80.0,"2'","2'"],["Contraste","PESO MUERTO",3,6,50.0,"2'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CE","IE-IL","SEV"],[["CE",1,1,3000,75.0,"",""],["IE-IL",2,1,1000,85.0,"","2'"],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",2,"CARGA","2:3","FECHA 2",0,[["R",["CI","Rep-IM"],[["CE",1,1,3000,75.0,"",""],["Rep-IM",1,4,400,90.0,"4'",""]],[]],["RF",["II-IC","Rep-IL","I Máx","Contraste"],[["II-IC",3,3,200,85.0,"2'","10'"],["Rep-IL",1,2,400,90.0,"6'",""]],[["Contraste","SENTADILLA",3,6,90.0,"1'","2'"],["Contraste","SENTADILLA",3,6,50.0,"1'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CI","Rep-IM","RCM"],[["CE",1,1,3000,75.0,"",""],["Rep-IM",1,4,400,90.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["II-IC","Rep-IL","I Máx","Contraste"],[["II-IC",3,3,200,85.0,"2'","10'"],["Rep-IL",1,2,400,90.0,"6'",""]],[["Contraste","PESO MUERTO",3,6,90.0,"2'","2'"],["Contraste","PESO MUERTO",3,6,50.0,"2'","2'"],["I Máx","CARGADA",3,1,90.0,"3'","2'"]]],["RV",["CI","Rep-IM","SEV"],[["CE",1,1,3000,75.0,"",""],["Rep-IM",1,4,400,90.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",2,"CHOQUE","4:1","LIBRE",0,[["R",["CI","IE-IL"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""]],[]],["F",["IE-IM","Rep-IC","I Máx II","Contraste"],[["Rep-IC",1,4,100,100.0,"5'",""],["IE-IM",1,6,400,85.0,"2'30\"",""]],[["Contraste","SENTADILLA",3,6,90.0,"1'","2'"],["Contraste","SENTADILLA",3,6,40.0,"1'","2'"],["I Máx II","CARGADA",4,3,90.0,"3'","2'"],["I Máx II","REMO CON BARRA",4,5,85.0,"3'",""]]],["R",["CI","IE-IL"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""]],[]],["F",["IE-IM","Rep-IC","I Máx II","Contraste"],[["Rep-IC",1,4,100,100.0,"5'",""],["IE-IM",1,6,400,85.0,"2'30\"",""]],[["Contraste","PESO MUERTO",3,6,90.0,"2'","2'"],["Contraste","PESO MUERTO",3,6,40.0,"2'","2'"],["I Máx II","CARGADA",4,3,90.0,"3'","2'"],["I Máx II","PRESS BANCO PLANO",4,5,85.0,"3'",""]]],["V",["CI","IE-IL","SEV"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",3,"REGENERATIVO","2:3","FECHA 3",0,[["R",["CI","IE-IL"],[["CI",1,1,3000,75.0,"",""],["IE-IL",1,4,1000,80.0,"4'",""]],[]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"],[["II-IC",3,3,200,80.0,"2'","10'"],["Rep-IL",1,2,400,90.0,"6'",""]],[["Pirámide","SENTADILLA",7,5,80.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,85.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,85.0,"3'",""]]],["RV",["CI","IE-IL","RCM"],[["CI",1,1,3000,75.0,"",""],["IE-IL",1,4,1000,80.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"],[["II-IC",3,3,200,80.0,"2'","10'"],["Rep-IL",1,2,400,90.0,"6'",""]],[["Pirámide","PESO MUERTO",7,3,80.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,85.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,85.0,"3'",""]]],["RV",["CI","IE-IL","SEV"],[["CI",1,1,3000,75.0,"",""],["IE-IL",1,4,1000,80.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",3,"CARGA","3:2","FECHA 4",0,[["R",["CI","IE-IL"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""]],[]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"],[["II-IC",3,3,200,100.0,"2'","10'"],["Rep-IL",1,2,400,95.0,"6'",""]],[["Pirámide","SENTADILLA",7,5,85.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,87.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,87.0,"3'",""]]],["RV",["CI","IE-IL","RCM"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"],[["II-IC",2,3,200,100.0,"2'","10'"],["Rep-IL",1,4,400,95.0,"4'",""]],[["Pirámide","PESO MUERTO",7,3,85.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,87.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,87.0,"3'",""]]],["RV",["CI","IE-IL","SEV"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",3,"CARGA","2:3","FECHA 5",0,[["R",["CI","IE-IL"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""]],[]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"],[["II-IC",3,3,200,95.0,"2'","10'"],["Rep-IL",1,2,400,90.0,"6'",""]],[["Pirámide","SENTADILLA",7,5,85.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,87.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,87.0,"3'",""]]],["RV",["CI","IE-IL","RCM"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"],[["II-IC",2,3,200,100.0,"2'","10'"],["Rep-IL",1,4,400,95.0,"4'",""]],[["Pirámide","PESO MUERTO",7,3,85.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,3,87.0,"3'","2'"],["I Máx","REMO CON BARRA",4,3,87.0,"3'",""]]],["RV",["CI","IE-IL","SEV"],[["CI",1,1,3000,85.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",3,"CHOQUE","4:1","FECHA 6",1,[["R",["CI","IE-IL"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""]],[]],["RF",["IE-IM","Rep-IC","I Máx","Pirámide"],[["IE-IM",1,8,400,90.0,"2'30\"",""],["Rep-IC",1,4,100,105.0,"5'",""]],[["Pirámide","SENTADILLA",7,5,95.0,"3'","2'"],["I Máx","REMO CON BARRA",4,1,100.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,1,100.0,"3'",""]]],["RV",["CI","IE-IL","RCM"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["RCM",2,4,10,95.0,"2'","5'"]],[]],["RF",["IE-IM","Rep-IC","I Máx","Pliometría"],[["II-IC",2,3,200,100.0,"2'","10'"],["Rep-IL",1,4,400,95.0,"4'",""]],[["Pirámide","PESO MUERTO",7,3,95.0,"3'","2'"],["I Máx","PRESS BANCO PLANO",4,1,100.0,"3'","2'"],["I Máx","REMO CON BARRA",4,1,100.0,"3'",""]]],["RV",["CI","IE-IL","SEV"],[["CI",1,1,3000,95.0,"",""],["IE-IL",1,4,1000,85.0,"4'",""],["SEV",3,5,10,100.0,"2'","hasta recuperar"]],[]]]],["COMPETITIVO 1",4,"REGENERATIVO","2:3","FECHA 7",0,[["R",["CI","IE-IL"]],["RF",["CI","IE-IM","I Máx","Pirámide"]],["RV",["CI","IE-IL","RCM"]],["RF",["CI","Rep-IM","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",4,"CARGA","3:2","FECHA 8",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",4,"CARGA","2:3","FECHA 9",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",4,"CHOQUE","3:2","FECHA 10",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Pirámide"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",5,"REGENERATIVO","1:4","FECHA 11",0,[["R",["CI","IE-IL"]],["RF",["CI","IE-IM","Rep III","Pirámide"]],["RV",["CI","IE-IL","RCM"]],["RF",["CI","Rep-IM","Rep III","Pirámide"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",5,"CARGA","2:3","FECHA 12",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep II","I Máx II"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Rep II","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",5,"CHOQUE","4:1","LIBRE",0,[["R",["CI","IE-IL"]],["F",["IE-IM","Rep-IC","Rep I","Rep III"]],["R",["CI","IE-IL"]],["F",["IE-IM","Rep-IC","Rep I","Rep III"]],["",["CI","IE-IL"]]]],["COMPETITIVO 1",5,"CARGA","2:3","FECHA 13",0,[["R",["CI","Rep-IM"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","Rep-IM","RCM"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","Rep-IM","SEV"]]]],["COMPETITIVO 1",5,"CARGA","3:2","FECHA 14",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","IE-IL","RSA"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 1",5,"CARGA","2:3","FECHA 15",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","IE-IL","RSA"]],["RF",["II-IC","Rep-IL","Rep I","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["TRANSITORIO 1",6,"TRANSICION","1:4","RESC INV.",0,[["R",["CI","IE-IL"]],["F",["CI","IE-IM","Rep III","Pirámide"]],["R",["CI","II-IEC"]],["F",["CI","Rep-IM","Rep III","Pirámide"]],["V",["CI","IE-IL","RSA"]]]],["TRANSITORIO 1",6,"CARGA","2:3","RESC INV.",1,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep III","I Máx II"]],["RV",["CI","IE-IL","RSA"]],["RF",["II-IC","Rep-IL","Rep III","I Máx II"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",6,"CARGA","3:2","FECHA 1",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",6,"CHOQUE","4:1","FECHA 2",0,[["R",["CI","IE-IL"]],["RF",["IE-IM","Rep-IC","Rep II","Concéntrico"]],["RV",["CI","IE-IL","RCM"]],["RF",["IE-IM","Rep-IC","Rep II","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",7,"REGENERATIVO","2:3","FECHA 3",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","IE-IM","RCM"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","II-IEC","SEV"]]]],["COMPETITIVO 2",7,"CARGA","3:2","FECHA 4",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Rep II","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",7,"CARGA","2:3","FECHA 5",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Contraste"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Contraste"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",7,"CHOQUE","4:1","FECHA 6",0,[["R",["CI","IE-IL"]],["RF",["IE-IM","Rep-IC","I Máx","Pliometría"]],["RV",["CI","IE-IL","RCM"]],["RF",["IE-IM","Rep-IC","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",8,"REGENERATIVO","2:3","FECHA 7",0,[["R",["CI","Rep-IL"]],["RF",["CI","IE-IM","I Máx","Pliometría"]],["RV",["CI","Rep-IC","RCM"]],["RF",["CI","Rep-IM","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",8,"CARGA","3:2","FECHA 8",1,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",8,"CARGA","2:3","FECHA 9",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","I Máx","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",8,"CHOQUE","4:1","FECHA 10",0,[["R",["CI","IE-IL"]],["RF",["IE-IM","Rep-IC","Contraste","Concéntrico"]],["RV",["CI","IE-IL","RCM"]],["RF",["IE-IM","Rep-IC","Contraste","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",9,"REGENERATIVO","1:4","FECHA 11",0,[["R",["CI","Rep-IC"]],["RF",["CI","IE-IM","Contraste","Concéntrico"]],["RV",["CI","Rep-IM","RCM"]],["RF",["CI","Rep-IM","Contraste","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",9,"CARGA","3:2","FECHA 12",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Contraste","Concéntrico"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Contraste","Concéntrico"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",9,"CHOQUE","4:1","LIBRE",0,[["R",["CI","Rep-IM"]],["F",["IE-IM","Rep-IC","Contraste","Concéntrico"]],["R",["CI","IE-IL"]],["F",["IE-IM","Rep-IC","Contraste","Concéntrico"]],["",["CI","IE-IL"]]]],["COMPETITIVO 2",9,"CARGA","2:3","FECHA 13",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",10,"CARGA","2:3","FECHA 14",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["COMPETITIVO 2",10,"CARGA","2:3","FECHA 15",0,[["R",["CI","IE-IL"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL","RCM"]],["RF",["II-IC","Rep-IL","Contraste","Pliometría"]],["RV",["CI","IE-IL","SEV"]]]],["TRANSITORIO 2",10,"TRANSICION","1:4","FIN DEL TORNEO",0,[["V",["CI","SEV"]],["F",["CI","IE-IM","Rep III","Pirámide"]],["R",["CI"]],["F",["CI","Rep III","Pirámide"]],["R",["CI","IE-IM"]]]]];
const tpSemanas=()=>T_TP.map(([per,meso,tipo,rel,comp,test,days])=>({per,meso,tipo,rel,comp,test:!!test,days:days.map(([q,met,run,str])=>({q,met:[...met],run:(run||[]).map(([m,s,r,d,p,pr,ps])=>({m,s,r,d,p,pr,ps})),str:(str||[]).map(([m,e,s,r,p,pr,ps])=>({m,e:epMov(e),s,r,p,pr,ps}))}))}));
const tempDe=eqId=>(S.temps||[]).filter(t=>t.equipoId===eqId).sort((a,b)=>(b.inicio||'').localeCompare(a.inicio||''))[0]||null;
const tLun=(t,i)=>{const d=parse(t.inicio);d.setDate(d.getDate()+7*i);return d};
const MESES_C=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
function tSemHoy(t){const k=Math.floor(days(today(),parse(t.inicio))/7);return k>=0&&k<t.semanas.length?k:null}
const tNum=c=>(String(c).match(/\d+/)||[''])[0];
const tCompL=c=>!c?'—':/^PRETEMP/i.test(c)?'Pret.':/^FECHA/i.test(c)?'F'+tNum(c):/^LIBRE/i.test(c)?'Libre':/^RESC|RECESO/i.test(c)?'Receso':/^FIN/i.test(c)?'Fin':c.slice(0,6);
const tCompLong=c=>!c?'Sin competencia':/^PRETEMP/i.test(c)?'Pretemporada':/^FECHA/i.test(c)?'Fecha '+tNum(c)+' de liga':/^LIBRE/i.test(c)?'Fecha libre':/^RESC|RECESO/i.test(c)?'Receso de invierno':/^FIN/i.test(c)?'Fin del torneo':c;
const tCap=s=>s?s.charAt(0)+s.slice(1).toLowerCase():'';
/* rivales de la semana: w.partidos [{fecha,dia,hora,condicion,rival,cancha}] o, si no hay, lo que sigue a «·» en la competencia («@ X» visitante, «VS X» local) */
const T_DS=['dom','lun','mar','mié','jue','vie','sáb'];
function tRivs(w){if(Array.isArray(w.partidos)&&w.partidos.length)return w.partidos.map(p=>({...p,vis:/^vis/i.test(p.condicion||'')}));
  if(!/^FECHA/i.test(w.comp||'')||!/·/.test(w.comp))return [];
  return w.comp.split('·').slice(1).join('·').replace(/·?\s*DOBLE FECHA/i,'').split('+').map(x=>x.trim()).filter(Boolean).map(x=>{const vis=/^@/.test(x);const r=x.replace(/^(@|VS\.?)\s*/i,'').replace(/\s*\((LUN|MAR|MI[ÉE]|JUE|VIE|S[ÁA]B|DOM)\)\s*$/i,'');return {rival:r.toLowerCase().replace(/(^|\s)\S/g,m=>m.toUpperCase()),vis}})}
const tRivTxt=p=>(p.vis?'@ ':'vs ')+p.rival;
/* nombre de los días: «Lunes…Viernes» o «Día 1…Día 5» (el entrenado los acomoda). w.dias ('sem'|'num') pisa a t.dias */
const tNumD=(t,w)=>w&&w.dias?w.dias==='num':!!(t&&t.dias==='num');
const T_DL=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
/* días por semana: predeterminado de la temporada (t.ndias, 5 si no hay) o el propio del mesociclo (t.mesoDias[meso]). Con nombres de la semana, n días caen en: */
const T_WD={1:[2],2:[1,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]};
const tWd=n=>T_WD[Math.min(7,Math.max(1,n||5))];
const tNdDef=t=>Math.min(7,Math.max(1,Number(t&&t.ndias)||5));
const tNd=(t,w)=>{const m=t&&t.mesoDias&&w&&t.mesoDias[w.meso];return m?Math.min(7,Math.max(1,Number(m))):tNdDef(t)};
const tDiaLleno=d=>d&&(d.q||(d.met||[]).length||(d.run||[]).length||(d.str||[]).length||d.test);
/* deja la semana con n días; los que sobran y tienen algo quedan guardados en w.extra y vuelven si se suben los días */
function tFit(w,n){const all=[...(w.days||[]),...(w.extra||[])],x={...w,days:all.slice(0,n)};while(x.days.length<n)x.days.push({q:'',met:[]});const r=all.slice(n);if(r.some(tDiaLleno))x.extra=r;else delete x.extra;return x}
const tAjustar=t=>t.semanas.map(w=>tFit(w,tNd(t,w)));
const tDiaNom=(t,w,k)=>tNumD(t,w)?'Día '+(k+1):T_DL[tWd((w.days||[]).length)[k]];
/* partidos de la semana i con wd (0 = lunes … 6 = domingo); sin w.partidos usa el día de partido de la temporada */
function tPartidos(t,i,w0){const w=w0||t.semanas[i];if(!w)return [];const R=tRivs(w);
  const cd=R.filter(p=>p.dia).map(p=>({...p,wd:(parse(p.dia).getDay()+6)%7})).sort((x,y)=>x.dia.localeCompare(y.dia));
  if(cd.length)return cd;
  if(!/^FECHA/i.test(w.comp||''))return [];
  const wd=(t.partido||'Sábado')==='Domingo'?6:5,d=tLun(t,i);d.setDate(d.getDate()+wd);
  return [{...(R[0]||{}),fecha:R[0]&&R[0].fecha||tNum(w.comp),dia:iso(d),wd}]}
const tPtDia=p=>T_DS[parse(p.dia).getDay()]+' '+fmtShort(p.dia);
const tPtTxt=p=>[p.fecha?'Fecha '+p.fecha:'',p.rival?tRivTxt(p):'',p.hora||'',p.cancha||''].filter(Boolean).join(' · ');
const tPtCls=p=>p.rival?(p.vis?' vis':' loc'):'';
const tRivLong=p=>`${p.fecha?'Fecha '+p.fecha+' · ':''}${p.vis?'Visitante en cancha de':'Local contra'} ${p.rival}${p.dia?' · '+T_DS[parse(p.dia).getDay()]+' '+fmtShort(p.dia):''}${p.hora?' '+p.hora:''}${p.cancha?' · '+p.cancha:''}`;
function lunesProx(){const d=today();const k=(8-d.getDay())%7;d.setDate(d.getDate()+k);return iso(d)}

function temporadaHTML(q){const t=tempDe(q._id);
  if(!t)return `<div class="card pad tp-empty"><div><b>Temporada</b><p class="hint">Todavía no tiene temporada. Armala desde la plantilla temporada promedio handball, importando un Excel o en blanco.</p></div><button class="btn pri" type="button" data-tpnew="${esc(q._id)}">Crear temporada</button></div>`;
  const W=t.semanas,hoy=tSemHoy(t);
  const spans=f=>{const o=[];W.forEach((w,i)=>{const v=f(w,i);if(o.length&&o[o.length-1].v===v)o[o.length-1].n++;else o.push({v,n:1})});return o};
  let g='<div class="lab">Período</div>'+spans(w=>w.per).map(s=>`<div class="span per" style="grid-column:span ${s.n}" title="${esc(s.v)}">${esc(s.n>2?tCap(s.v):s.v.slice(0,5)+'.')}</div>`).join('');
  g+='<div class="rowline"></div><div class="lab">Mes</div>'+spans((w,i)=>MESES_C[tLun(t,i).getMonth()]).map(s=>`<div class="span" style="grid-column:span ${s.n}">${esc(s.n>1?s.v:s.v.slice(0,3))}</div>`).join('');
  g+='<div class="rowline"></div><div class="lab">Mesociclo</div>'+spans(w=>w.meso).map(s=>`<div class="span" style="grid-column:span ${s.n}">${s.n>1?'Meso ':'M'}${esc(s.v)}</div>`).join('');
  g+='<div class="rowline"></div><div class="lab">Semana</div>'+W.map((w,i)=>`<button type="button" class="wk t-${esc(w.tipo)}${i===hoy?' hoy':''}" data-tpsem="${esc(t._id)}:${i}" aria-label="Semana ${i+1}, ${fmtShort(iso(tLun(t,i)))}: ${T_TIPOS[w.tipo]||w.tipo} ${esc(w.rel)}, ${esc(tCompLong(w.comp))}${w.test?', semana de test':''}${i===hoy?', semana actual':''}">${w.test?'<span class="tst">T</span>':''}<span class="bar" style="height:${(parseInt(w.rel,10)||1)*15}px"></span><span class="n">${i+1}</span></button>`).join('');
  g+='<div class="rowline"></div><div class="lab">Competencia</div>'+W.map(w=>`<div class="comp ${/^FECHA/i.test(w.comp)?'f':''}" title="${esc(tCompLong(w.comp))}">${esc(tCompL(w.comp))}${tRivs(w).length>1?'<i class="x2">×2</i>':''}</div>`).join('');
  if(W.some(w=>tRivs(w).length))g+='<div class="rowline"></div><div class="lab">Rival</div>'+W.map(w=>{const R=tRivs(w);return `<div class="riv" title="${esc(R.map(tRivLong).join('\n'))}">${R.map(p=>`<span class="${p.vis?'vis':'loc'}">${esc(tRivTxt(p))}</span>`).join('')}</div>`}).join('');
  const prox=(f,desde)=>{for(let i=desde;i<W.length;i++)if(f(W[i]))return i;return -1};
  const d0=hoy??(days(today(),parse(t.inicio))<0?0:W.length),pf=prox(w=>/^FECHA/i.test(w.comp),d0),pt=prox(w=>w.test,d0);
  const cur=hoy!=null?W[hoy]:null;
  const fin=iso(tLun(t,W.length-1));
  return `<div class="card tp-card"><div class="pad tp-h"><div><b>Temporada ${esc(t.nombre||'')}</b> <button class="g-q" type="button" data-guia="temporada" aria-label="Ayuda sobre la temporada">?</button><p class="hint">${plural(W.length,'semana','semanas')} · del ${fmtD(t.inicio)} al ${fmtD(fin)} · partido el ${esc((t.partido||'Sábado').toLowerCase())}</p></div>
    <div class="actions"><button class="btn pri" type="button" data-tpent="${esc(t._id)}">Entregar al plantel</button><button class="btn" type="button" data-tppdf="${esc(t._id)}">PDF del plantel</button><button class="btn" type="button" data-tptab="${esc(t._id)}">Editar tabla</button><button class="btn" type="button" data-tpcfg="${esc(t._id)}">Ajustes</button></div></div>
    <div class="eq-kpis"><div><b>${hoy!=null?'S'+(hoy+1):'—'}</b><span>${cur?`${T_TIPOS[cur.tipo]||cur.tipo} ${esc(cur.rel)} · ${esc(tCap(cur.per))}`:days(today(),parse(t.inicio))<0?'empieza el '+fmtD(t.inicio):'temporada terminada'}</span></div>
      <div><b>${pf>=0?tCompL(W[pf].comp):'—'}</b><span>${pf>=0?(tRivs(W[pf]).length?esc(tRivs(W[pf]).map(p=>tRivTxt(p)+(p.dia?' ('+T_DS[parse(p.dia).getDay()]+' '+fmtShort(p.dia)+(p.hora?' '+p.hora:'')+')':'')).join(' y '))+' · semana '+(pf+1):'próxima fecha · semana '+(pf+1)+' ('+fmtShort(iso(tLun(t,pf)))+')'):'sin fechas por delante'}</span></div>
      <div><b>${pt>=0?'S'+(pt+1):'—'}</b><span>${pt>=0?'próximo test · '+fmtShort(iso(tLun(t,pt))):'sin tests por delante'}</span></div>
      <div><b>${W.reduce((n,w)=>n+(/^FECHA/i.test(w.comp)?Math.max(1,tRivs(w).length):0),0)}</b><span>fechas de liga · ${W.filter(w=>w.test).length} tests</span></div></div>
    <div class="tp-legend">${Object.entries(T_TIPOS).map(([k,v])=>`<span><i class="sw t-${k}"></i>${v}</span>`).join('')}<span>Altura = nivel de carga</span><span><b class="tst-l">T</b> test</span><span><i class="sw hoy-l"></i>semana actual</span>${W.some(w=>tRivs(w).length)?'<span><i class="sw loc-l"></i>Local</span><span><i class="sw vis-l"></i>Visitante</span>':''}</div>
    <div class="tp-scroll" data-keep-scroll><div class="tp-season" style="--n:${W.length}">${g}</div></div>${epChartsHTML(t)}</div>`}

/* --- leer la hoja MACRO de un Excel --- */
function macroDesdeAOA(aoa){
  const txt=v=>v==null?'':String(v).trim(),low=v=>txt(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ');
  const fila=re=>aoa.findIndex(r=>r&&r.slice(0,5).some(c=>re.test(low(c))));
  const rN=fila(/^n.? ?microciclo/),rT=fila(/^tipo microciclo/),rP=fila(/^periodo$/),rMe=fila(/^mesociclos?$/),rC=fila(/^competencia/);
  if(rN<0||rT<0)throw new Error('No encontré las filas «N° Microciclo» y «Tipo Microciclo». ¿Es la hoja MACRO?');
  const cols=[];(aoa[rN]||[]).forEach((v,c,row)=>{if(c>3&&typeof v==='number'&&v>0&&row[c-1]!==v)cols.push(c)});
  if(!cols.length)throw new Error('No encontré los números de microciclo.');
  const ff=(r,c)=>{if(r<0)return '';for(let k=c;k>=4;k--){const v=aoa[r]&&aoa[r][k];if(v!=null&&txt(v)!=='')return txt(v)}return ''};
  const rRel=rT+1;
  const qRows={},mRows={};let rTest=-1;
  aoa.forEach((r,i)=>{if(!r||i<=rT)return;const b=low(r[1]),c=low(r[2]);
    if(b==='test'||c==='test')rTest=i;
    if(['resistencia','fuerza','velocidad'].includes(c))qRows[i]=c==='resistencia'?'R':c==='fuerza'?'F':'V';
    else if(T_XL[c])mRows[i]=T_XL[c]});
  const tipoN=s=>{const x=low(s).replace(/ó/g,'o');return x.startsWith('intro')?'INTRODUCTORIO':x.startsWith('carga')?'CARGA':x.startsWith('choq')?'CHOQUE':x.startsWith('regen')?'REGENERATIVO':x.startsWith('trans')?'TRANSICION':'CARGA'};
  const perN=s=>{const x=low(s);return x.startsWith('prep')?'PREPARATORIO':x.startsWith('comp')?(x.includes('2')?'COMPETITIVO 2':'COMPETITIVO 1'):x.startsWith('tr')?(x.includes('2')?'TRANSITORIO 2':'TRANSITORIO 1'):txt(s).toUpperCase()};
  return cols.map((c0,i)=>{const c1=(cols[i+1]||c0+5)-1;const days=[];
    for(let c=c0;c<=Math.min(c1,c0+4);c++){const q=Object.entries(qRows).filter(([r])=>txt(aoa[r]&&aoa[r][c])).map(([,v])=>v);
      const met=[...new Set(Object.entries(mRows).filter(([r])=>txt(aoa[r]&&aoa[r][c])).map(([,v])=>v))];days.push({q:['R','F','V'].filter(x=>q.includes(x)).join(''),met})}
    while(days.length<5)days.push({q:'',met:[]});
    let test=false;if(rTest>=0)for(let c=c0;c<=c1;c++)if(txt(aoa[rTest][c]))test=true;
    const rel=txt(aoa[rRel]&&aoa[rRel][c0]);
    return {per:perN(ff(rP,c0)),meso:Number(ff(rMe,c0))||1,tipo:tipoN(txt(aoa[rT][c0])),rel:T_RELS.includes(rel)?rel:'2:3',comp:txt(aoa[rC]&&aoa[rC][c0]).toUpperCase(),test,days}})}
const tResumen=W=>`${plural(W.length,'semana','semanas')} · ${[...new Set(W.map(w=>w.per))].length} períodos · ${[...new Set(W.map(w=>w.meso))].length} mesociclos · ${W.filter(w=>/^FECHA/i.test(w.comp)).length} fechas · ${W.filter(w=>w.test).length} tests`;

/* --- hoja: crear temporada --- */
function tpNewHTML(a){
  return `<form id="tpf" class="form pad">
    <label class="full">Nombre<input id="tp-n" value="${esc(a.n??String(today().getFullYear()))}" placeholder="Ej: 2027"></label>
    <label>Lunes de la semana 1<input id="tp-ini" type="date" required value="${esc(a.ini||lunesProx())}"></label>
    <label>Días por semana<select id="tp-nd">${[1,2,3,4,5,6,7].map(n=>`<option ${n===(Number(a.nd)||5)?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>Día de partido<select id="tp-par">${['Sábado','Domingo'].map(d=>`<option ${d===(a.par||'Sábado')?'selected':''}>${d}</option>`).join('')}</select></label>
    <fieldset class="full tf-rm"><legend>Punto de partida</legend>
      <label class="tp-opt"><input type="radio" name="tp-src" value="tp" ${a.src!=='xl'&&a.src!=='vac'?'checked':''}><span><b>Plantilla temporada promedio handball</b><small>42 semanas, 2 torneos de 15 fechas, con la dosis de las primeras 13 semanas</small></span></label>
      <label class="tp-opt"><input type="radio" name="tp-src" value="xl" ${a.src==='xl'?'checked':''}><span><b>Importar desde un Excel</b><small>Plan de la hoja MACRO y dosis de MICROCICLOS y PESAS</small></span></label>
      ${a.src==='xl'?`<div class="tp-xl"><label class="btn" style="cursor:pointer">Elegir Excel<input id="tp-file" type="file" accept=".xlsx" hidden></label><span class="hint">${a.xl?`<b>${esc(a.arch)}</b> · ${esc(xlResumen(a.xl))}`:a.err?`<span style="color:var(--bad)">${esc(a.err)}</span>`:'Elegí el archivo. Si trae la hoja DIAGNÓSTICO, la podés cargar como test de un jugador.'}</span></div>
      ${a.xl&&a.xl.diag?(()=>{const q=(S.equipos||[]).find(x=>x._id===a.eq)||{},js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean);return js.length?`<label class="tp-sub">Cargar el diagnóstico (VAM ${a.xl.diag.vam?nfx(a.xl.diag.vam,2):'—'}) como test de <select id="tp-dj"><option value="">(no cargar)</option>${js.map(e=>`<option value="${esc(e.id)}" ${a.dj===e.id?'selected':''}>${esc(name(e))}</option>`).join('')}</select></label>`:''})():''}`:''}
      <label class="tp-opt"><input type="radio" name="tp-src" value="vac" ${a.src==='vac'?'checked':''}><span><b>En blanco</b><small>Armás todo desde cero</small></span></label>
      ${a.src==='vac'?`<label class="tp-sub">Cantidad de semanas <input id="tp-nsem" type="number" min="4" max="60" value="${esc(a.nsem||42)}"></label>`:''}
    </fieldset>
    <p class="hint full">Las fechas de cada semana salen del lunes de inicio. Después se edita todo: tipo, relación de carga, competencia, tests, cualidades y métodos de cada día.</p>
    <p class="hint full" id="tp-msg" role="alert"></p>
    <div class="full actions"><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Crear temporada</button></div></form>`}
function bindTpNew(a){const ov=$('#overlay');
  const leer=()=>{a.n=$('#tp-n').value;a.ini=$('#tp-ini').value;a.par=$('#tp-par').value;a.nd=$('#tp-nd').value;a.nsem=$('#tp-nsem')?$('#tp-nsem').value:(a.nsem||42);a.src=(ov.querySelector('[name=tp-src]:checked')||{}).value||'tp'};
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};
  ov.onchange=async ev=>{if(ev.target.name==='tp-src'){leer();renderSheet();return}
    if(ev.target.id==='tp-file'){leer();const f=ev.target.files[0];if(!f)return;a.arch=f.name;a.prev=null;a.err='';
      try{a.xl=await leerPlanilla(await f.arrayBuffer());a.prev=a.xl.W}catch(x){a.err=x.message||'No pude leer el Excel.';a.xl=null}renderSheet()}
    if(ev.target.id==='tp-dj')a.dj=ev.target.value};
  $('#tpf').onsubmit=async ev=>{ev.preventDefault();leer();const msg=$('#tp-msg');
    if(!a.ini){msg.textContent='Elegí el lunes de la semana 1.';return}
    if(parse(a.ini).getDay()!==1){msg.textContent='La semana 1 tiene que empezar un lunes.';return}
    let W;if(a.src==='xl'){if(!a.prev){msg.textContent='Elegí el Excel con la hoja MACRO.';return}W=a.prev}
    else if(a.src==='vac'){const n=Math.min(60,Math.max(4,Number(a.nsem)||42));W=Array.from({length:n},(_,i)=>({per:'PREPARATORIO',meso:Math.floor(i/4)+1,tipo:'CARGA',rel:'2:3',comp:'',test:false,days:T_DIAS.map(()=>({q:'',met:[]}))}))}
    else W=tpSemanas();
    const nd=Math.min(7,Math.max(1,Number(a.nd)||5));W=W.map(w=>tFit(w,nd));
    const doc={equipoId:a.eq,nombre:(a.n||'').trim(),inicio:a.ini,partido:a.par||'Sábado',ndias:nd,semanas:W,origen:a.src==='xl'?'Excel: '+a.arch:a.src==='vac'?'En blanco':'Plantilla temporada promedio handball',ts:Date.now()};
    const dj=a.src==='xl'&&$('#tp-dj')?$('#tp-dj').value:'';
    if(await write(()=>S.db.collection('temporadas').add(doc))){if(dj)await cargarDiag(dj,a.xl.diag);toast('Temporada creada'+(dj?' y diagnóstico cargado':''));closeSheet()}}}

/* --- hoja: editar una semana --- */
function tpSemHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid);const w=a.w;const i=a.i;
  const metOpts=q=>Object.entries(T_MET).filter(([,m])=>m[1]===q);
  return `<form id="tsf" class="pad">
    <div class="tp-sn"><button class="btn" type="button" data-tsstep="-1" ${i===0?'disabled':''} aria-label="Semana anterior">‹</button><b>Semana ${i+1}</b><span class="hint">${fmtD(iso(tLun(t,i)))} al ${fmtD(iso(new Date(tLun(t,i).getTime()+6*864e5)))}</span><button class="btn" type="button" data-tsstep="1" ${i===t.semanas.length-1?'disabled':''} aria-label="Semana siguiente">›</button></div>${tRivs(w).length?`<div class="tp-rivs">${tRivs(w).map(p=>`<span class="${p.vis?'vis':'loc'}">${esc(tRivLong(p))}</span>`).join('')}</div>`:''}
    <div class="form cols3" style="margin-top:12px">
      <label>Tipo<select id="ts-tipo">${Object.entries(T_TIPOS).map(([k,v])=>`<option value="${k}" ${k===w.tipo?'selected':''}>${v}</option>`).join('')}</select></label>
      <label>Relación de carga<select id="ts-rel">${T_RELS.map(r=>`<option ${r===w.rel?'selected':''}>${r}</option>`).join('')}</select></label>
      <label>Competencia<input id="ts-comp" list="ts-comp-l" value="${esc(w.comp)}" placeholder="Ej: FECHA 3, LIBRE"><datalist id="ts-comp-l"><option value="PRETEMPORADA"><option value="LIBRE"><option value="RECESO"><option value="FIN DEL TORNEO">${Array.from({length:15},(_,k)=>`<option value="FECHA ${k+1}">`).join('')}</datalist></label>
      <label>Período<select id="ts-per">${T_PERS.map(p=>`<option value="${p}" ${p===w.per?'selected':''}>${tCap(p)}</option>`).join('')}</select></label>
      <label>Mesociclo<input id="ts-meso" type="number" min="1" step="1" value="${esc(w.meso)}"></label>
      <label class="av-g" style="align-self:end"><input type="checkbox" id="ts-test" ${w.test?'checked':''}> Semana de test</label>
      <label>Nombre de los días<select id="ts-dias"><option value="" ${!w.dias?'selected':''}>Como la temporada (${t.dias==='num'?'Día 1, Día 2…':'lunes a viernes'})</option><option value="sem" ${w.dias==='sem'?'selected':''}>Lunes a viernes</option><option value="num" ${w.dias==='num'?'selected':''}>Día 1, Día 2… (los acomoda el entrenado)</option></select></label>
      <label>Días por semana · mesociclo ${esc(w.meso)}<select id="ts-nd"><option value="">Como la temporada (${tNdDef(t)})</option>${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${String(a.nd!==undefined?a.nd:((t.mesoDias||{})[w.meso]||''))===String(n)?'selected':''}>${n}</option>`).join('')}</select></label>
    </div>${(w.extra||[]).length?`<p class="hint">Hay ${plural(w.extra.length,'día guardado','días guardados')} fuera de esta semana (con contenido). Vuelven si subís la cantidad de días.</p>`:''}${w.test?`<div class="ts-tbar"><span class="hint">Semana de test: elegí qué días son de test y qué protocolos van. El jugador los ve paso a paso, antes de la dosis del día.</span><span class="actions"><button class="btn sm" type="button" data-tssug>Usar el orden sugerido</button><button class="btn sm" type="button" data-protsem>Editar protocolos</button></span></div>`:''}${epSemTopHTML(a)}
    <div class="tp-days">${w.days.map((d,k)=>{const pk=tNumD(t,w)?[]:tPartidos(t,i,w).filter(p=>p.wd===tWd(w.days.length)[k]);return `<div class="tp-day${pk.length?' con-pt'+tPtCls(pk[0]):''}"><div class="tp-day-h"><b>${tDiaNom(t,w,k)}</b>${pk.length?'<span class="pt-tag">Partido</span>':''}${['R','F','V'].map(q=>`<button type="button" class="qt ${q}" data-tsq="${k}:${q}" aria-pressed="${d.q.includes(q)}">${T_Q[q]}</button>`).join('')}${w.test&&!d.test?`<button type="button" class="qt T" data-tston="${k}">+ Test</button>`:''}</div>${pk.map(p=>`<p class="pt-line">${esc(tPtTxt(p))}</p>`).join('')}${w.test&&d.test?tsTestHTML(d,k):''}
      <div class="tp-mets">${d.met.map(m=>`<span class="mchip q${(T_MET[m]||[])[1]||''}" title="${esc((T_MET[m]||[m])[0]+' · '+((T_MET[m]||[])[2]||''))}">${esc(m)}<button type="button" data-tsdel="${k}:${esc(m)}" aria-label="Quitar ${esc(m)}">×</button></span>`).join('')||'<span class="hint">Sin métodos</span>'}
        <select class="mini" data-tsadd="${k}" aria-label="Agregar método el ${tDiaNom(t,w,k)}"><option value="">+ método</option>${['R','F','V'].map(q=>`<optgroup label="${T_Q[q]}">${metOpts(q).filter(([m])=>!d.met.includes(m)).map(([m,x])=>`<option value="${esc(m)}">${esc(m)} · ${esc(x[0])}</option>`).join('')}</optgroup>`).join('')}</select></div>
      ${d.met.some(m=>T_MET[m]&&!d.q.includes(T_MET[m][1]))?'<p class="hint tp-warn">Hay métodos de una cualidad que el día no tiene marcada.</p>':''}${epDosisHTML(a,k)}</div>`}).join('')}${tPartidos(t,i,w).filter(p=>tNumD(t,w)||!tWd(w.days.length).includes(p.wd)).map(p=>`<div class="tp-day tp-match${tPtCls(p)}"><div class="tp-day-h"><b>${tNumD(t,w)?esc(tCap(tPtDia(p))):T_DL[p.wd]+' '+fmtShort(p.dia)}</b><span class="pt-tag">Partido</span></div><p class="pt-line">${esc(tPtTxt(p)||'Partido')}</p></div>`).join('')}</div>
    <p class="hint" id="ts-msg" role="alert"></p>
    <div class="actions" style="margin-top:10px"><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Guardar semana</button></div></form>`}
function bindTpSem(a){const ov=$('#overlay');
  const leer=()=>{const w=a.w;w.tipo=$('#ts-tipo').value;w.rel=$('#ts-rel').value;w.comp=$('#ts-comp').value.trim().toUpperCase();w.per=$('#ts-per').value;w.meso=Number($('#ts-meso').value)||w.meso;w.test=$('#ts-test').checked;{const dv=$('#ts-dias')?$('#ts-dias').value:'';if(dv)w.dias=dv;else delete w.dias}ov.querySelectorAll('[data-tsnota]').forEach(x=>{const d=w.days[+x.dataset.tsnota];if(d&&d.test)d.test.nota=x.value.trim()})};
  ov.onchange=ev=>{if(ev.target.dataset.ds){leer();epDsCambio(a,ev.target);a.dirty=true;renderSheet();return}
    if(ev.target.id==='ts-test'||ev.target.id==='ts-dias'){leer();a.dirty=true;renderSheet();return}
    if(ev.target.id==='ts-nd'){leer();const t=(S.temps||[]).find(x=>x._id===a.tid);a.nd=Number(ev.target.value)||'';a.w=tFit(a.w,a.nd||tNdDef(t));a.dirty=true;renderSheet();return}
    if(ev.target.dataset.tspadd!=null&&ev.target.value){leer();const d=a.w.days[+ev.target.dataset.tspadd];d.test.p=[...(d.test.p||[]),ev.target.value];a.dirty=true;renderSheet();return}
    if(ev.target.dataset.tsnota!=null){leer();a.dirty=true;return}
    if(ev.target.dataset.tssolo!=null){leer();const d=a.w.days[+ev.target.dataset.tssolo];if(ev.target.checked)delete d.test.solo;else d.test.solo=false;a.dirty=true;return}if(ev.target.dataset.dspj!=null){leer();a.pj=ev.target.value;renderSheet();return}
    const s=ev.target.closest('[data-tsadd]');if(s&&s.value){leer();const d=a.w.days[+s.dataset.tsadd];d.met.push(s.value);const q=T_MET[s.value][1];if(!d.q.includes(q))d.q=['R','F','V'].filter(x=>x===q||d.q.includes(x)).join('');a.dirty=true;renderSheet()}};
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    if(ev.target.closest('[data-dsadd],[data-dsfill],[data-dsdel],[data-dsgen]')){leer();if(epDsClick(a,ev)){a.dirty=true;renderSheet()}return}
    const st=ev.target.closest('[data-tsstep]');if(st){leer();if(a.dirty||JSON.stringify(a.w)!==a.orig){if(!await guardarSem(a))return}const t=(S.temps||[]).find(x=>x._id===a.tid);const i=a.i+Number(st.dataset.tsstep);openSheet('__tpsem','ver',semArg(t,i,a.pj));return}
    const qb=ev.target.closest('[data-tsq]');if(qb){leer();const[k,q]=qb.dataset.tsq.split(':');const d=a.w.days[+k];d.q=d.q.includes(q)?d.q.replace(q,''):['R','F','V'].filter(x=>x===q||d.q.includes(x)).join('');a.dirty=true;renderSheet();return}
    let tb;
    if(tb=ev.target.closest('[data-tston]')){leer();a.w.days[+tb.dataset.tston].test={p:[],nota:''};a.dirty=true;renderSheet();return}
    if(tb=ev.target.closest('[data-tstoff]')){leer();delete a.w.days[+tb.dataset.tstoff].test;a.dirty=true;renderSheet();return}
    if(tb=ev.target.closest('[data-tsmv]')){leer();const[k,j,d]=tb.dataset.tsmv.split(':').map(Number);const P=a.w.days[k].test.p;[P[j],P[j+d]]=[P[j+d],P[j]];a.dirty=true;renderSheet();return}
    if(tb=ev.target.closest('[data-tsprm]')){leer();const[k,j]=tb.dataset.tsprm.split(':').map(Number);a.w.days[k].test.p.splice(j,1);a.dirty=true;renderSheet();return}
    if(ev.target.closest('[data-tssug]')){leer();Object.entries(PROT_SUG).forEach(([k,ids])=>{const d=a.w.days[+k];if(!d)return;d.test={p:ids.filter(protDe),nota:(d.test&&d.test.nota)||''}});a.dirty=true;renderSheet();return}
    if(ev.target.closest('[data-protsem]')){leer();if(a.dirty||JSON.stringify(a.w)!==a.orig){if(!await guardarSem(a))return}openSheet('__prot','ver',{back:{tid:a.tid,i:a.i,pj:a.pj}});return}
    const dl=ev.target.closest('[data-tsdel]');if(dl){leer();const[k,m]=dl.dataset.tsdel.split(':');a.w.days[+k].met=a.w.days[+k].met.filter(x=>x!==m);a.dirty=true;renderSheet()}};
  $('#tsf').onsubmit=async ev=>{ev.preventDefault();leer();if(await guardarSem(a)){toast('Semana '+(a.i+1)+' guardada');closeSheet()}}}
const semArg=(t,i,pj)=>({tid:t._id,pj,i,w:JSON.parse(JSON.stringify(t.semanas[i])),orig:JSON.stringify(t.semanas[i])});
async function guardarSem(a){const t=(S.temps||[]).find(x=>x._id===a.tid);if(!t)return false;const W=t.semanas.slice();W[a.i]=a.w;
  const {_id,...doc}=t;const nt={...doc,semanas:W};if(a.nd!==undefined){const md={...(t.mesoDias||{})};if(a.nd)md[a.w.meso]=a.nd;else delete md[a.w.meso];nt.mesoDias=md}
  nt.semanas=tAjustar(nt);return write(()=>S.db.collection('temporadas').doc(a.tid).set(nt))}

/* --- hoja: tabla de toda la temporada --- */
function tpTabHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid);const W=a.W;
  return `<form id="ttf" class="pad"><p class="hint">Editá varias semanas a la vez. Los métodos de cada día se editan tocando la semana en el tablero.</p>
    <div class="tbl-wrap" style="margin-top:10px;max-height:62vh"><table class="eq-t tp-tab"><thead><tr><th>Sem.</th><th>Lunes</th><th>Período</th><th>Meso</th><th>Tipo</th><th>Relación</th><th>Competencia</th><th>Test</th></tr></thead><tbody>
    ${W.map((w,i)=>`<tr class="t-${esc(w.tipo)}"><td><b>${i+1}</b></td><td>${fmtShort(iso(tLun(t,i)))}</td>
      <td><select data-tt="${i}:per" aria-label="Período semana ${i+1}">${T_PERS.map(p=>`<option value="${p}" ${p===w.per?'selected':''}>${tCap(p)}</option>`).join('')}</select></td>
      <td><input data-tt="${i}:meso" type="number" min="1" step="1" value="${esc(w.meso)}" aria-label="Mesociclo semana ${i+1}" style="width:58px"></td>
      <td><span class="dot"></span><select data-tt="${i}:tipo" aria-label="Tipo semana ${i+1}">${Object.entries(T_TIPOS).map(([k,v])=>`<option value="${k}" ${k===w.tipo?'selected':''}>${v}</option>`).join('')}</select></td>
      <td><select data-tt="${i}:rel" aria-label="Relación semana ${i+1}">${T_RELS.map(r=>`<option ${r===w.rel?'selected':''}>${r}</option>`).join('')}</select></td>
      <td><input data-tt="${i}:comp" list="ts-comp-l2" value="${esc(w.comp)}" aria-label="Competencia semana ${i+1}" style="width:130px"></td>
      <td><input data-tt="${i}:test" type="checkbox" ${w.test?'checked':''} aria-label="Test semana ${i+1}"></td></tr>`).join('')}</tbody></table></div>
    <datalist id="ts-comp-l2"><option value="PRETEMPORADA"><option value="LIBRE"><option value="RECESO"><option value="FIN DEL TORNEO">${Array.from({length:15},(_,k)=>`<option value="FECHA ${k+1}">`).join('')}</datalist>
    <div class="actions" style="margin-top:10px"><button class="btn" type="button" data-ttadd>+ Agregar semana al final</button>${W.length>4?`<button class="btn" type="button" data-ttrm>Quitar la última</button>`:''}<span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Guardar cambios</button></div></form>`}
function bindTpTab(a){const ov=$('#overlay');
  ov.onchange=ev=>{const x=ev.target.closest('[data-tt]');if(!x)return;const[i,k]=x.dataset.tt.split(':');const w=a.W[+i];
    w[k]=k==='test'?x.checked:k==='meso'?(Number(x.value)||w.meso):k==='comp'?x.value.trim().toUpperCase():x.value;if(k==='tipo')x.closest('tr').className='t-'+x.value};
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    if(ev.target.closest('[data-ttadd]')){const l=a.W[a.W.length-1];{const t=(S.temps||[]).find(x=>x._id===a.tid);a.W.push(tFit({per:l.per,meso:l.meso,tipo:'CARGA',rel:'2:3',comp:'',test:false,days:[]},tNd(t,l)))}renderSheet();return}
    if(ev.target.closest('[data-ttrm]')){a.W.pop();renderSheet()}};
  $('#ttf').onsubmit=async ev=>{ev.preventDefault();const t=(S.temps||[]).find(x=>x._id===a.tid);const {_id,...doc}=t;
    if(await write(()=>S.db.collection('temporadas').doc(a.tid).set({...doc,semanas:tAjustar({...doc,semanas:a.W})}))){toast('Temporada guardada');closeSheet()}}}

/* --- hoja: ajustes de la temporada --- */
function tpCfgHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid);
  return `<form id="tcf" class="form pad">
    <label class="full">Nombre<input id="tc-n" value="${esc(t.nombre||'')}"></label>
    <label>Lunes de la semana 1<input id="tc-ini" type="date" required value="${esc(t.inicio)}"></label>
    <label>Días por semana (predeterminado)<select id="tc-nd">${[1,2,3,4,5,6,7].map(n=>`<option ${n===tNdDef(t)?'selected':''}>${n}</option>`).join('')}</select></label>
    ${Object.keys(t.mesoDias||{}).length?`<label class="av-g full"><input type="checkbox" id="tc-ndr"> Volver al predeterminado los mesociclos con cantidad propia (${Object.entries(t.mesoDias).map(([m,n])=>'meso '+m+': '+n).join(', ')})</label>`:''}
    <label>Nombre de los días<select id="tc-dias"><option value="sem" ${t.dias!=='num'?'selected':''}>Lunes a viernes</option><option value="num" ${t.dias==='num'?'selected':''}>Día 1, Día 2… (los acomoda el entrenado)</option></select></label>
    <label>Día de partido<select id="tc-par">${['Sábado','Domingo'].map(d=>`<option ${d===(t.partido||'Sábado')?'selected':''}>${d}</option>`).join('')}</select></label>
    <p class="hint full">Origen: ${esc(t.origen||'—')}${t.actualizado?' · actualizada el '+fmtD(t.actualizado):''}. Si movés el inicio, todas las semanas se corren con él.</p>
    <div class="full"><button class="btn" type="button" data-tpsync="${esc(t._id)}">Actualizar desde Excel</button> <span class="hint" style="display:inline">Trae los cambios de la planilla (plan y dosis) sin tocar el inicio ni el plantel.</span></div>
    <p class="hint full" id="tc-msg" role="alert"></p>
    <div class="full actions"><button class="btn danger" type="button" data-tcdel>${S.tcArm===t._id?'Tocá de nuevo para borrar la temporada':'Borrar temporada'}</button><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Guardar</button></div></form>`}
function bindTpCfg(a){const ov=$('#overlay');
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){S.tcArm=null;closeSheet();return}
    if(ev.target.closest('[data-tcdel]')){if(S.tcArm!==a.tid){S.tcArm=a.tid;renderSheet();return}S.tcArm=null;if(await write(()=>S.db.collection('temporadas').doc(a.tid).delete())){toast('Temporada borrada');closeSheet()}}};
  $('#tcf').onsubmit=async ev=>{ev.preventDefault();const ini=$('#tc-ini').value;if(!ini||parse(ini).getDay()!==1){$('#tc-msg').textContent='La semana 1 tiene que empezar un lunes.';return}
    const t=(S.temps||[]).find(x=>x._id===a.tid);const {_id,...doc}=t;
    if(await write(()=>S.db.collection('temporadas').doc(a.tid).set((()=>{const nt={...doc,nombre:$('#tc-n').value.trim(),inicio:ini,partido:$('#tc-par').value,dias:$('#tc-dias').value,ndias:Number($('#tc-nd').value)||5};if($('#tc-ndr')&&$('#tc-ndr').checked)nt.mesoDias={};nt.semanas=tAjustar(nt);return nt})()))){toast('Temporada actualizada');closeSheet()}}}

document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-tpnew],[data-tpsem],[data-tptab],[data-tpcfg]');if(!b)return;const D=b.dataset;
  if(D.tpnew!=null){openSheet('__tpnew','ver',{eq:D.tpnew});return}
  if(D.tpsem!=null){const[tid,i]=D.tpsem.split(':');const t=(S.temps||[]).find(x=>x._id===tid);if(t)openSheet('__tpsem','ver',semArg(t,+i));return}
  if(D.tptab!=null){const t=(S.temps||[]).find(x=>x._id===D.tptab);if(t)openSheet('__tptab','ver',{tid:t._id,W:JSON.parse(JSON.stringify(t.semanas))});return}
  if(D.tpcfg!=null){S.tcArm=null;openSheet('__tpcfg','ver',{tid:D.tpcfg});return}});
/* ---------- EQUIPO PRO · Etapas 3 y 4: dosis, entrega al plantel, fórmulas y control de carga ---------- */
/* Biblioteca de métodos: cualidad (q), base de cálculo (b: vam | sprint | rm | none), dosis base (def), rango y para qué sirve */
/* ---------- REFERENCIAS BIBLIOGRÁFICAS (APA 7) ---------- */
/* c: cita corta en el texto · a: referencia completa (HTML con cursivas) · ok:false = datos de edición a confirmar con el ejemplar */
const REFS={
 bangsbo2008:{c:'Bangsbo et al. (2008)',a:'Bangsbo, J., Iaia, F. M., & Krustrup, P. (2008). The Yo-Yo intermittent recovery test: A useful tool for evaluation of physical performance in intermittent sports. <i>Sports Medicine, 38</i>(1), 37–51. https://doi.org/10.2165/00007256-200838010-00004'},
 billat2001:{c:'Billat (2001)',a:'Billat, L. V. (2001). Interval training for performance: A scientific and empirical practice. Special recommendations for middle- and long-distance running. Part I: Aerobic interval training. <i>Sports Medicine, 31</i>(1), 13–31. https://doi.org/10.2165/00007256-200131010-00002'},
 bishop2011:{c:'Bishop et al. (2011)',a:'Bishop, D., Girard, O., & Mendez-Villanueva, A. (2011). Repeated-sprint ability – Part II: Recommendations for training. <i>Sports Medicine, 41</i>(9), 741–756. https://doi.org/10.2165/11590560-000000000-00000'},
 bompa2009:{c:'Bompa y Haff (2009)',a:'Bompa, T. O., & Haff, G. G. (2009). <i>Periodization: Theory and methodology of training</i> (5th ed.). Human Kinetics.'},
 bosco1983:{c:'Bosco et al. (1983)',a:'Bosco, C., Luhtanen, P., & Komi, P. V. (1983). A simple method for measurement of mechanical power in jumping. <i>European Journal of Applied Physiology and Occupational Physiology, 50</i>(2), 273–282. https://doi.org/10.1007/BF00422166'},
 buchheit2013:{c:'Buchheit y Laursen (2013)',a:'Buchheit, M., & Laursen, P. B. (2013). High-intensity interval training, solutions to the programming puzzle: Part I: Cardiopulmonary emphasis. <i>Sports Medicine, 43</i>(5), 313–338. https://doi.org/10.1007/s40279-013-0029-x'},
 ehlenz1990:{c:'Ehlenz et al. (1990)',a:'Ehlenz, H., Grosser, M., & Zimmermann, E. (1990). <i>Entrenamiento de la fuerza</i>. Martínez Roca.',ok:false},
 foster2001:{c:'Foster et al. (2001)',a:'Foster, C., Florhaug, J. A., Franklin, J., Gottschall, L., Hrovatin, L. A., Parker, S., Doleshal, P., & Dodge, C. (2001). A new approach to monitoring exercise training. <i>Journal of Strength and Conditioning Research, 15</i>(1), 109–115.'},
 gabbett2016:{c:'Gabbett (2016)',a:'Gabbett, T. J. (2016). The training—injury prevention paradox: Should athletes be training smarter and harder? <i>British Journal of Sports Medicine, 50</i>(5), 273–280. https://doi.org/10.1136/bjsports-2015-095788'},
 gb1995:{c:'González Badillo y Gorostiaga (1995)',a:'González Badillo, J. J., & Gorostiaga Ayestarán, E. (1995). <i>Fundamentos del entrenamiento de la fuerza: Aplicación al alto rendimiento deportivo</i>. INDE.'},
 gb2002:{c:'González Badillo y Ribas (2002)',a:'González Badillo, J. J., & Ribas Serna, J. (2002). <i>Bases de la programación del entrenamiento de fuerza</i>. INDE.'},
 hulin2014:{c:'Hulin et al. (2014)',a:'Hulin, B. T., Gabbett, T. J., Blanch, P., Chapman, P., Bailey, D., & Orchard, J. W. (2014). Spikes in acute workload are associated with increased injury risk in elite cricket fast bowlers. <i>British Journal of Sports Medicine, 48</i>(8), 708–712. https://doi.org/10.1136/bjsports-2013-092524'},
 leger1980:{c:'Léger y Boucher (1980)',a:'Léger, L., & Boucher, R. (1980). An indirect continuous running multistage field test: The Université de Montréal track test. <i>Canadian Journal of Applied Sport Sciences, 5</i>(2), 77–84.'},
 matveev1977:{c:'Matveev (1977)',a:'Matveev, L. P. (1977). <i>La periodización del entrenamiento deportivo</i>. INEF.',ok:false},
 tillin2009:{c:'Tillin y Bishop (2009)',a:'Tillin, N. A., & Bishop, D. (2009). Factors modulating post-activation potentiation and its effect on performance of subsequent explosive activities. <i>Sports Medicine, 39</i>(2), 147–166. https://doi.org/10.2165/00007256-200939020-00004'},
 verkho2006:{c:'Verkhoshansky (2006)',a:'Verkhoshansky, Y. (2006). <i>Todo sobre el método pliométrico</i>. Paidotribo.',ok:false},
 weineck2005:{c:'Weineck (2005)',a:'Weineck, J. (2005). <i>Entrenamiento total</i>. Paidotribo.'},
 zintl1991:{c:'Zintl (1991)',a:'Zintl, F. (1991). <i>Entrenamiento de la resistencia: Fundamentos, métodos y dirección del entrenamiento</i>. Martínez Roca.',ok:false}
};
/* fuentes de cada método de la biblioteca */
const EP_REF={'CE':['zintl1991','weineck2005'],'CI':['zintl1991','weineck2005'],'CV1':['zintl1991','weineck2005'],'CV2':['zintl1991','weineck2005'],
 'IE-IL':['zintl1991','billat2001'],'IE-IM':['zintl1991','billat2001'],'II-IC':['zintl1991','billat2001'],'II-IEC':['billat2001','buchheit2013'],
 'Rep-IL':['zintl1991'],'Rep-IM':['zintl1991'],'Rep-IC':['zintl1991'],
 'FS':['weineck2005'],'RCM':['weineck2005'],'SEV':['weineck2005'],'RSA':['bishop2011'],
 'Rep III':['ehlenz1990','gb1995'],'Rep II':['ehlenz1990','gb1995'],'Rep I':['ehlenz1990','gb1995'],'I Máx':['ehlenz1990','gb1995'],'I Máx II':['ehlenz1990','gb1995'],'Pirámide':['ehlenz1990','gb1995'],
 'Contraste':['gb1995','tillin2009'],'Concéntrico':['gb1995'],'Pliometría':['verkho2006']};
/* fuentes de las fórmulas y de los tests */
const EP_FREF={tRes:['leger1980','billat2001'],ritmo:['leger1980','billat2001'],tSpr:[],vol:['zintl1991'],kg:['gb1995','gb2002'],imr:['gb1995']};
const T_REF={vam:['leger1980','billat2001'],cmj:['bosco1983'],abk:['bosco1983'],yoyo:['bangsbo2008'],rm:['gb2002']};
const citas=ks=>(ks||[]).filter(k=>REFS[k]).map(k=>REFS[k].c).join('; ');
const refPlano=k=>REFS[k].a.replace(/<[^>]+>/g,'');
function biblioHTML(){const ks=Object.keys(REFS).sort((a,b)=>refPlano(a).localeCompare(refPlano(b),'es'));
  return `<p>Referencias en formato APA 7, ordenadas por autor. <button class="btn sm" type="button" data-bibcopy>Copiar todas</button> <span class="hint" id="bib-msg" role="status" style="display:inline"></span></p>
    <ol class="g-bib">${ks.map(k=>`<li>${REFS[k].a.replace(/(https:\/\/doi\.org\/\S+)/,'<a href="$1" target="_blank" rel="noopener">$1</a>')}${REFS[k].ok===false?' <span class="pill p-warn">edición a confirmar con el ejemplar</span>':''}</li>`).join('')}</ol>
    <p class="hint">Los cálculos de tiempo por tramo, volumen, kilos e intensidad media son aritmética directa: se cita el concepto en que se basan (prescripción por % de VAM, % de 1RM). El tiempo de sprint como % del test propio no tiene un autor específico: es una adaptación de la app.</p>`}
document.addEventListener('click',async ev=>{const b=ev.target.closest&&ev.target.closest('[data-bibcopy]');if(!b)return;
  const t=Object.keys(REFS).sort((a,c)=>refPlano(a).localeCompare(refPlano(c),'es')).map(refPlano).join('\n\n');const m=document.getElementById('bib-msg');
  try{await navigator.clipboard.writeText(t);if(m)m.textContent='Copiadas al portapapeles.'}catch(_){if(m)m.textContent='No se pudo copiar: seleccioná la lista y copiala a mano.'}});
const EP_LIB={
 'CE':{n:'Continuo extensivo',q:'R',b:'vam',o:'Eficiencia aeróbica',def:{s:1,r:1,d:4000,p:60,pr:'',ps:''},rg:'20–40 min al 60–70 % VAM'},
 'CI':{n:'Continuo intensivo',q:'R',b:'vam',o:'Capacidad aeróbica',def:{s:1,r:1,d:3000,p:85,pr:'',ps:''},rg:'10–25 min al 80–90 % VAM'},
 'CV1':{n:'Continuo variable I',q:'R',b:'vam',o:'Eficiencia aeróbica',def:{s:1,r:1,d:4000,p:70,pr:'',ps:''},rg:'Cambios de ritmo entre 60 y 80 % VAM'},
 'CV2':{n:'Continuo variable II',q:'R',b:'vam',o:'Capacidad aeróbica',def:{s:1,r:1,d:4000,p:80,pr:'',ps:''},rg:'Cambios de ritmo entre 70 y 90 % VAM'},
 'IE-IL':{n:'Interválico extensivo, pausa larga',q:'R',b:'vam',o:'Capacidad aeróbica',def:{s:1,r:4,d:1000,p:75,pr:"4'",ps:''},rg:'1000–3000 m al 75–85 % · pausa 2–4 min'},
 'IE-IM':{n:'Interválico extensivo, pausa media',q:'R',b:'vam',o:'Potencia aeróbica',def:{s:1,r:6,d:400,p:80,pr:'2\'30"',ps:''},rg:'300–600 m al 80–90 % · pausa 2–3 min'},
 'II-IC':{n:'Interválico intensivo, pausa corta',q:'R',b:'vam',o:'Potencia aeróbica',def:{s:3,r:3,d:200,p:85,pr:"2'",ps:"10'"},rg:'100–200 m al 85–100 % · pausa 1–2 min'},
 'II-IEC':{n:'Interválico intensivo, pausa extra corta',q:'R',b:'vam',o:'Potencia aeróbica',def:{s:3,r:6,d:100,p:100,pr:'30"',ps:"5'"},rg:'Intermitentes de 15–30 s al 100–120 % VAM'},
 'Rep-IL':{n:'Repeticiones, pausa larga',q:'R',b:'vam',o:'Potencia aeróbica',def:{s:1,r:2,d:400,p:90,pr:"6'",ps:''},rg:'400–600 m al 90–95 % · pausa 4–6 min'},
 'Rep-IM':{n:'Repeticiones, pausa media',q:'R',b:'vam',o:'Potencia láctica',def:{s:1,r:3,d:200,p:95,pr:"5'",ps:''},rg:'150–300 m al 95–100 % · pausa 5–8 min'},
 'Rep-IC':{n:'Repeticiones, pausa corta',q:'R',b:'vam',o:'Potencia aláctica',def:{s:1,r:4,d:50,p:105,pr:"5'",ps:''},rg:'50–100 m al 100–110 % VAM · pausa 3–5 min'},
 'FS':{n:'Velocidad máxima (lanzada)',q:'V',b:'sprint',o:'Potencia aláctica',def:{s:2,r:3,d:30,p:100,pr:"3'",ps:"5'"},rg:'20–30 m lanzados al 100 %'},
 'RCM':{n:'Aceleración (repeticiones cortas máximas)',q:'V',b:'sprint',o:'Potencia aláctica',def:{s:2,r:4,d:10,p:95,pr:"2'",ps:"5'"},rg:'10–30 m desde parado al 95–100 %'},
 'SEV':{n:'Salidas a estímulos variables',q:'V',b:'sprint',o:'Potencia aláctica',def:{s:3,r:5,d:10,p:100,pr:"2'",ps:'hasta recuperar'},rg:'Reacción a un estímulo + 5–10 m'},
 'RSA':{n:'Resistencia a la velocidad (RSA)',q:'V',b:'sprint',o:'Capacidad aláctica',def:{s:2,r:5,d:30,p:90,pr:'30"',ps:"5'"},rg:'5–6 sprints de 20–30 m con 20–30 s de pausa'},
 'Rep III':{n:'Repeticiones III',q:'F',b:'rm',o:'Acondicionamiento músculo-tendinoso',def:{e:'SENTADILLA',s:4,r:10,p:60,pr:"2'",ps:"2'"},rg:'3–4 × 10–15 al 50–65 %'},
 'Rep II':{n:'Repeticiones II',q:'F',b:'rm',o:'Fuerza máxima e hipertrofia',def:{e:'SENTADILLA',s:4,r:8,p:70,pr:"2'",ps:"2'"},rg:'3–5 × 8–10 al 70–75 %'},
 'Rep I':{n:'Repeticiones I',q:'F',b:'rm',o:'Fuerza máxima e hipertrofia',def:{e:'SENTADILLA',s:3,r:5,p:85,pr:"3'",ps:"2'"},rg:'3–5 × 5–6 al 80–85 %'},
 'I Máx':{n:'Intensidades máximas',q:'F',b:'rm',o:'Coordinación intramuscular y fuerza máxima',def:{e:'SENTADILLA',s:4,r:3,p:90,pr:"3'",ps:"2'"},rg:'3–5 × 1–3 al 90–95 %'},
 'I Máx II':{n:'Intensidades máximas II',q:'F',b:'rm',o:'Coordinación intramuscular y fuerza máxima',def:{e:'SENTADILLA',s:4,r:1,p:95,pr:"4'",ps:"2'"},rg:'3–5 × 1–2 al 95–100 %'},
 'Pirámide':{n:'Pirámide',q:'F',b:'rm',o:'Fuerza máxima e hipertrofia',def:{e:'SENTADILLA',s:5,r:5,p:80,pr:"3'",ps:"2'"},rg:'Una fila por escalón (por ejemplo 70-75-80-85 %)'},
 'Contraste':{n:'Contraste',q:'F',b:'rm',o:'Fuerza máxima y explosiva',def:{e:'SENTADILLA',s:3,r:6,p:85,pr:"2'",ps:"2'"},rg:'Serie pesada (85–90 %) + serie liviana (30–50 %)'},
 'Concéntrico':{n:'Concéntrico puro',q:'F',b:'rm',o:'Activación nerviosa y fuerza explosiva',def:{e:'SENTADILLA',s:4,r:4,p:60,pr:"2'",ps:"2'"},rg:'3–5 × 3–5 al 50–70 %, solo la subida'},
 'Pliometría':{n:'Pliometría',q:'F',b:'none',o:'Fuerza explosiva y reactividad',def:{e:'Saltos',s:4,r:6,p:0,pr:"2'",ps:''},rg:'3–5 × 5–8 contactos'}
};
/* nombres de ejercicio del Excel → marca (RM) de la app */
const EP_SIN={'PRESS BANCO PLANO':['PRESS BANCO PLANO','BANCO PLANO','PRESS BANCO','BANCO'],'CARGADA':['CARGADA','CLEAN','POWER CLEAN','CARGADA DE POTENCIA'],'REMO CON BARRA':['REMO CON BARRA','REMO'],'SENTADILLA':['SENTADILLA','SENTADILLA TRASERA'],'PESO MUERTO':['PESO MUERTO']};
function epMov(nm){const movs=(S.cfg.rmDefs||[]).map(d=>d.mov),N=String(nm||'').toUpperCase().trim();if(movs.includes(N))return N;for(const c of (EP_SIN[N]||[]))if(movs.includes(c))return c;return N}

/* ----- fórmulas editables (etapa 4) con un evaluador acotado: números, variables, + - * / ^ y algunas funciones ----- */
const EP_FDEF={
 tRes:{n:'Tiempo por tramo (resistencia)',u:'s',expr:'dist / (vam * pct / 100)',vars:{dist:'distancia del tramo (m)',vam:'VAM del jugador (m/s)',pct:'% de VAM'},
   ctl:[{v:{dist:1000,vam:3.4,pct:100},e:294.1,src:'Tabla VAM: 1000 m al 100 %'},{v:{dist:400,vam:3.4,pct:80},e:147.1,src:'Tabla VAM: 400 m al 80 %'},{v:{dist:3000,vam:3.4,pct:75},e:1176.5,src:'3000 m al 75 % (19:36)'}],tol:0.6,
   w:'Tiempo = distancia ÷ velocidad. La velocidad de trabajo es la VAM por el % elegido: misma consigna, ritmo de cada uno.'},
 ritmo:{n:'Ritmo por kilómetro',u:'s',expr:'1000 / (vam * pct / 100)',vars:{vam:'VAM del jugador (m/s)',pct:'% de VAM'},
   ctl:[{v:{vam:3.4,pct:100},e:294.1,src:'1000 m al 100 %'},{v:{vam:3.4,pct:60},e:490.2,src:'1000 m al 60 %'}],tol:0.6,w:'El mismo cálculo para 1000 m. En los continuos sirve más que el tiempo total.'},
 tSpr:{n:'Tiempo de sprint',u:'s',expr:'tref / (pct / 100)',vars:{tref:'tiempo del test para esa distancia (s)',pct:'% de la velocidad del test'},
   ctl:[{v:{tref:4.4,pct:100},e:4.4,src:'Test de 30 m al 100 %'},{v:{tref:1.9,pct:95},e:2.0,src:'10 m al 95 %'},{v:{tref:7.333,pct:90},e:8.15,src:'50 m al 90 %'}],tol:0.06,
   w:'En sprints cortos la referencia es el test de 10, 20 y 30 m: se interpola entre esos puntos y más allá de 30 m se extiende en proporción.'},
 vol:{n:'Volumen',u:'m',expr:'series * reps * dist',vars:{series:'series',reps:'repeticiones',dist:'distancia (m)'},
   ctl:[{v:{series:1,reps:4,dist:1000},e:4000,src:'4 × 1000 m'},{v:{series:2,reps:5,dist:30},e:300,src:'2 × 5 × 30 m'}],tol:0.01,w:'Metros totales: junto con la intensidad describe la carga.'}
};
const EP_FUN={round:Math.round,min:Math.min,max:Math.max,abs:Math.abs,floor:Math.floor,ceil:Math.ceil,sqrt:Math.sqrt};
function epParse(src){
  const tk=[];const re=/\s*(?:(\d+(?:[.,]\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(\*\*|[-+*/^(),]))/y;let i=0;
  while(i<src.length){re.lastIndex=i;const m=re.exec(src);if(!m||m.index!==i){if(/^\s*$/.test(src.slice(i)))break;throw new Error('Carácter no válido cerca de «'+src.slice(i,i+6).trim()+'»')}
    i=re.lastIndex;if(m[1])tk.push({t:'n',v:parseFloat(m[1].replace(',','.'))});else if(m[2])tk.push({t:'i',v:m[2]});else tk.push({t:'o',v:m[3]==='**'?'^':m[3]})}
  let p=0;const pk=()=>tk[p],eat=v=>{if(!tk[p]||tk[p].v!==v)throw new Error('Falta «'+v+'»');p++};
  const E=()=>{let a=T();while(pk()&&(pk().v==='+'||pk().v==='-')){const o=tk[p++].v;a={o,a,b:T()}}return a};
  const T=()=>{let a=U();while(pk()&&(pk().v==='*'||pk().v==='/')){const o=tk[p++].v;a={o,a,b:U()}}return a};
  const U=()=>{if(pk()&&pk().v==='-'){p++;return {o:'neg',a:U()}}const a=A();if(pk()&&pk().v==='^'){p++;return {o:'^',a,b:U()}}return a};
  const A=()=>{const x=tk[p++];if(!x)throw new Error('La fórmula termina antes de tiempo');if(x.t==='n')return {n:x.v};
    if(x.t==='i'){if(pk()&&pk().v==='('){if(!EP_FUN[x.v])throw new Error('Función desconocida: '+x.v);p++;const args=[];if(pk()&&pk().v!==')'){args.push(E());while(pk()&&pk().v===','){p++;args.push(E())}}eat(')');return {f:x.v,args}}return {v:x.v}}
    if(x.v==='('){const e=E();eat(')');return e}throw new Error('Símbolo inesperado: '+x.v)};
  const ast=E();if(p<tk.length)throw new Error('Sobra «'+tk[p].v+'»');return ast}
const epVars=(a,o=new Set())=>{if(a.v)o.add(a.v);if(a.a)epVars(a.a,o);if(a.b)epVars(a.b,o);if(a.args)a.args.forEach(x=>epVars(x,o));return o};
function epEv(a,env){if('n' in a)return a.n;if(a.v)return env[a.v];if(a.f)return EP_FUN[a.f](...a.args.map(x=>epEv(x,env)));const x=epEv(a.a,env);if(a.o==='neg')return -x;const y=epEv(a.b,env);return a.o==='+'?x+y:a.o==='-'?x-y:a.o==='*'?x*y:a.o==='/'?x/y:Math.pow(x,y)}
const epExpr=k=>((S.cfgRaw||{}).epFormulas||{})[k]||EP_FDEF[k].expr;
const _epC={};function epF(k,env){const x=epExpr(k);if(!_epC[k]||_epC[k].x!==x){let a;try{a=epParse(x)}catch(_){a=epParse(EP_FDEF[k].expr)}_epC[k]={x,a}}const r=epEv(_epC[k].a,env);return isFinite(r)?r:NaN}

/* ----- cálculos por jugador ----- */
function epPerfil(e){const u=ultimoTest(e.id);return {vam:u.vam?.v,t10:u.t10?.v,t20:u.t20?.v,t30:u.t30?.v}}
function epTref(P,d){if(!P.t10||!P.t20||!P.t30)return NaN;const pts=[[0,0],[10,P.t10],[20,P.t20],[30,P.t30]];if(d>=30)return d*P.t30/30;for(let i=1;i<4;i++)if(d<=pts[i][0]){const[a,ta]=pts[i-1],[b,tb]=pts[i];return ta+(tb-ta)*(d-a)/(b-a)}return NaN}
function epRun(it,P){const L=EP_LIB[it.m]||{b:'vam'},vol=epF('vol',{series:+it.s,reps:+it.r,dist:+it.d});let t=NaN,rit=NaN,falta='';
  if(L.b==='sprint'){const tr=epTref(P||{},+it.d);if(isFinite(tr))t=epF('tSpr',{tref:tr,pct:+it.p});else falta='test de sprint'}
  else if(P&&P.vam){t=epF('tRes',{dist:+it.d,vam:P.vam,pct:+it.p});rit=epF('ritmo',{vam:P.vam,pct:+it.p})}else falta='VAM';
  return {vol,t,rit,falta,cont:+it.s===1&&+it.r===1}}
function epKg(it,e){const L=EP_LIB[it.m]||{};if(L.b==='none'||!e)return NaN;const rv=rmValue(e,it.e);return rv?mround(rv*Number(it.p)/100,S.cfg.redondeo):NaN}
const epT=s=>{if(!isFinite(s))return '—';if(s<60)return (Math.round(s*10)/10).toString().replace('.',',')+' s';const m=Math.floor(s/60),r=Math.round(s-m*60);return r===60?(m+1)+':00':m+':'+String(r).padStart(2,'0')};
const epTRut=s=>{if(!isFinite(s))return '';if(s<60)return (Math.round(s*10)/10)+'"';const m=Math.floor(s/60),r=Math.round(s-m*60);return r===60?(m+1)+':00':m+':'+String(r).padStart(2,'0')};
/* totales que no dependen del jugador: metros, % medio de carrera, repeticiones de fuerza y % medio de 1RM */
function epDia(d){let v=0,vi=0,rp=0,ri=0;(d.run||[]).forEach(it=>{const x=epF('vol',{series:+it.s,reps:+it.r,dist:+it.d});if(isFinite(x)){v+=x;vi+=x*it.p}});(d.str||[]).forEach(it=>{if((EP_LIB[it.m]||{}).b==='none')return;const n=it.s*it.r;rp+=n;ri+=n*it.p});return {v,im:v?vi/v:0,rp,ip:rp?ri/rp:0}}
function epSem(w){let v=0,vi=0,rp=0,ri=0,n=0;(w.days||[]).forEach(d=>{const x=epDia(d);v+=x.v;vi+=x.v*x.im;rp+=x.rp;ri+=x.rp*x.ip;n+=(d.run||[]).length+(d.str||[]).length});return {v,im:v?vi/v:0,rp,ip:rp?ri/rp:0,n}}
const epConDosis=w=>(w.days||[]).some(d=>(d.run||[]).length||(d.str||[]).length);
function epAvisos(t,i,w){const out=[];if(!epConDosis(w))return out;const x=epSem(w);let j=i-1;while(j>=0&&!epConDosis(t.semanas[j]))j--;
  if(j>=0){const p=epSem(t.semanas[j]);if(p.v&&x.v>p.v*1.25)out.push(['w',`El volumen de carrera sube ${Math.round((x.v/p.v-1)*100)} % respecto de la semana ${j+1}.`]);
    if(w.tipo==='CHOQUE'&&x.im&&p.im&&x.im<p.im)out.push(['w',`Es choque pero la intensidad media (${nfx(x.im,1)} %) queda por debajo de la semana ${j+1} (${nfx(p.im,1)} %).`]);
    if(w.tipo==='REGENERATIVO'&&x.v>p.v)out.push(['w',`Es regenerativa pero tiene más metros que la semana ${j+1}.`])}
  w.days.forEach((d,k)=>{(d.run||[]).forEach(it=>{const L=EP_LIB[it.m];if(L&&L.b==='vam'&&it.p>120)out.push(['b',`${tDiaNom(t,w,k)}: ${L.n} al ${it.p} % de VAM.`]);if(L&&L.b==='sprint'&&it.p>100)out.push(['b',`${tDiaNom(t,w,k)}: un sprint no puede pasar el 100 % del test.`])});
    (d.str||[]).forEach(it=>{if(it.p>100)out.push(['b',`${tDiaNom(t,w,k)}: ${titleCase(it.e)} al ${it.p} % de 1RM.`])});
    const dose=new Set([...(d.run||[]),...(d.str||[])].map(x=>x.m)),miss=d.met.filter(m=>!dose.has(m)),extra=[...dose].filter(m=>!d.met.includes(m));
    if(miss.length&&dose.size)out.push(['w',`${tDiaNom(t,w,k)}: planificado sin dosis → ${miss.join(', ')}.`]);if(extra.length)out.push(['w',`${tDiaNom(t,w,k)}: con dosis pero sin planificar → ${extra.join(', ')}.`])});
  return out}

/* ----- gráficos de la temporada (carga planificada) ----- */
function epChart(W,bk,lk,lMin,lMax,bFmt,titulo){
  const L=46,R=36,T=14,B=26,Wd=760-L-R,H=170-T-B,n=W.length,slot=Wd/n,bw=Math.max(4,Math.min(18,slot*.62));
  const vals=W.map(w=>w.x[bk]||0),mx=Math.max(1,...vals),p10=Math.pow(10,Math.floor(Math.log10(mx))),step=mx/p10>5?2*p10:mx/p10>2?p10:p10/2,bMax=Math.ceil(mx/step)*step;
  const yb=v=>T+H-v/bMax*H,yl=v=>T+H-(Math.min(lMax,Math.max(lMin,v))-lMin)/(lMax-lMin)*H;let s='';
  for(let v=0;v<=bMax+1e-9;v+=step)s+=`<line x1="${L}" x2="${L+Wd}" y1="${yb(v)}" y2="${yb(v)}" class="ep-gl"/><text x="${L-5}" y="${yb(v)+4}" text-anchor="end">${bFmt(v)}</text>`;
  for(let k=0;k<=4;k++){const v=lMin+k*(lMax-lMin)/4;s+=`<text x="${L+Wd+5}" y="${yl(v)+4}">${Math.round(v)}%</text>`}
  W.forEach((w,i)=>{const v=w.x[bk];if(v)s+=`<rect class="t-${w.tipo}" style="fill:var(--tc)" x="${L+slot*i+(slot-bw)/2}" y="${yb(v)}" width="${bw}" height="${T+H-yb(v)}" rx="2"><title>Semana ${i+1}: ${bFmt(v,1)}</title></rect>`;if(n<=16||i%3===0)s+=`<text x="${L+slot*i+slot/2}" y="${T+H+14}" text-anchor="middle">${i+1}</text>`});
  const segs=[];let sg=[];W.forEach((w,i)=>{if(w.x[lk]){sg.push(`${L+slot*i+slot/2},${yl(w.x[lk])}`)}else if(sg.length){segs.push(sg);sg=[]}});if(sg.length)segs.push(sg);
  s+=segs.map(x=>`<polyline points="${x.join(' ')}" class="ep-ln"/>`).join('')+W.map((w,i)=>w.x[lk]?`<circle cx="${L+slot*i+slot/2}" cy="${yl(w.x[lk])}" r="2.6" class="ep-pt"><title>Semana ${i+1}: ${nfx(w.x[lk],1)} %</title></circle>`:'').join('');
  return `<div class="ep-ch"><b>${titulo}</b><svg viewBox="0 0 760 170" role="img" aria-label="${esc(titulo)}">${s}</svg></div>`}
function epChartsHTML(t){const W=t.semanas.map(w=>({tipo:w.tipo,x:epSem(w)}));if(!W.some(w=>w.x.n))return `<p class="hint pad">Todavía no hay dosis cargadas. Tocá una semana y agregá la dosis de cada sesión para ver acá la carga planificada.</p>`;
  return `<div class="ep-chs">${epChart(W,'v','im',40,100,(v,x)=>x?distMil(v)+' m':v?Math.round(v/1000)+'k':'0','Carrera y velocidad · metros (barras) e intensidad media % VAM (línea)')}${epChart(W,'rp','ip',40,100,(v,x)=>x?v+' reps':String(v),'Fuerza · repeticiones (barras) e intensidad media % 1RM (línea)')}</div>`}

/* ----- dosis dentro de la hoja de la semana ----- */
function epJug(a){const q=(S.equipos||[]).find(x=>x._id===((S.temps||[]).find(t=>t._id===a.tid)||{}).equipoId);const js=(q?.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).sort((x,y)=>name(x).localeCompare(name(y)));
  if(!js.find(e=>e.id===a.pj))a.pj=(js.find(e=>epPerfil(e).vam)||js[0]||{}).id;return {js,e:S.ents[a.pj]}}
function epDosisHTML(a,k){const d=a.w.days[k];d.run=d.run||[];d.str=d.str||[];const {e}=epJug(a),P=e?epPerfil(e):null;
  const movs=(S.cfg.rmDefs||[]).map(x=>x.mov);
  const mOpts=(q,cur)=>Object.entries(EP_LIB).filter(([,L])=>q==='F'?L.q==='F':L.q!=='F').map(([m,L])=>`<option value="${esc(m)}" ${m===cur?'selected':''}>${esc(m)} · ${esc(L.n)}</option>`).join('');
  const inp=(id,ds,v,w,t='number',x='')=>`<input id="${id}" data-ds="${ds}" ${t==='number'?'type="number" inputmode="decimal" step="any"':''} value="${esc(v??'')}" style="width:${w}px" ${x}>`;
  const run=d.run.map((it,j)=>{const c=epRun(it,P),id=`ds-${k}-r-${j}`,b=`${k}:run:${j}`;return `<tr><td class="ep-q ${(EP_LIB[it.m]||{q:'R'}).q}"></td><td><select id="${id}-m" data-ds="${b}:m">${mOpts('R',it.m)}</select></td><td>${inp(id+'-s',b+':s',it.s,48,'number','min="1"')}</td><td>${inp(id+'-r',b+':r',it.r,48,'number','min="1"')}</td><td>${inp(id+'-d',b+':d',it.d,70,'number','min="1"')}</td><td>${inp(id+'-p',b+':p',it.p,52,'number','min="1"')}</td><td>${inp(id+'-pr',b+':pr',it.pr,62,'text')}</td><td>${inp(id+'-ps',b+':ps',it.ps,62,'text')}</td>
    <td class="num"><b>${c.falta?'<span class="pill p-warn">sin '+c.falta+'</span>':epT(c.t)}</b>${!c.falta?`<small>${c.cont?'total':'por tramo'}${isFinite(c.rit)?' · '+epT(c.rit)+'/km':''}</small>`:''}</td><td class="num">${distMil(c.vol)} m</td><td><button type="button" class="ep-x" data-dsdel="${b}" aria-label="Quitar fila">×</button></td></tr>`}).join('');
  const str=d.str.map((it,j)=>{const id=`ds-${k}-f-${j}`,b=`${k}:str:${j}`,none=(EP_LIB[it.m]||{}).b==='none',kg=epKg(it,e);
    const eo=none?inp(id+'-e',b+':e',it.e,110,'text'):`<select id="${id}-e" data-ds="${b}:e">${[...new Set([...movs,it.e])].map(m=>`<option value="${esc(m)}" ${m===it.e?'selected':''}>${esc(titleCase(m))}</option>`).join('')}</select>`;
    return `<tr><td class="ep-q F"></td><td><select id="${id}-m" data-ds="${b}:m">${mOpts('F',it.m)}</select></td><td>${eo}</td><td>${inp(id+'-s',b+':s',it.s,48,'number','min="1"')}</td><td>${inp(id+'-r',b+':r',it.r,48,'number','min="1"')}</td><td>${none?'—':inp(id+'-p',b+':p',it.p,52,'number','min="0" max="110"')}</td><td>${inp(id+'-pr',b+':pr',it.pr,62,'text')}</td>
    <td class="num"><b>${none?'—':isFinite(kg)?nfx(kg,kg%1?1:0)+' kg':'<span class="pill p-warn">sin 1RM</span>'}</b></td><td class="num">${!none&&isFinite(kg)?distMil(it.s*it.r*kg)+' kg':'—'}</td><td><button type="button" class="ep-x" data-dsdel="${b}" aria-label="Quitar fila">×</button></td></tr>`}).join('');
  const x=epDia(d),falta=d.met.filter(m=>![...d.run,...d.str].some(y=>y.m===m));
  return `<div class="ep-dose">${run?`<div class="tbl-wrap"><table class="ep-t"><thead><tr><th></th><th>Carrera / velocidad</th><th>Series</th><th>Reps</th><th>Metros</th><th>%</th><th>Pausa</th><th>Entre series</th><th class="num">Tiempo</th><th class="num">Volumen</th><th></th></tr></thead><tbody>${run}</tbody></table></div>`:''}
    ${str?`<div class="tbl-wrap"><table class="ep-t"><thead><tr><th></th><th>Fuerza</th><th>Ejercicio</th><th>Series</th><th>Reps</th><th>% 1RM</th><th>Pausa</th><th class="num">Kilos</th><th class="num">Tonelaje</th><th></th></tr></thead><tbody>${str}</tbody></table></div>`:''}
    <div class="ep-dose-f"><button class="btn sm" type="button" data-dsadd="${k}:run">+ Carrera / velocidad</button><button class="btn sm" type="button" data-dsadd="${k}:str">+ Fuerza</button>${falta.length?`<button class="btn sm" type="button" data-dsfill="${k}">Completar desde el plan (${falta.length})</button>`:''}<span class="hint" style="margin-left:auto">${x.v?distMil(x.v)+' m · '+nfx(x.im,1)+' % medio':''}${x.v&&x.rp?' · ':''}${x.rp?x.rp+' reps · '+nfx(x.ip,1)+' % 1RM':''}</span></div>${(()=>{const ms=[...new Set([...d.run,...d.str].map(y=>y.m))].filter(m=>citas(EP_REF[m]));return ms.length?`<p class="hint g-ref ep-src">Fuente: ${ms.map(m=>`<b>${esc(m)}</b> ${esc(citas(EP_REF[m]))}`).join(' · ')}</p>`:''})()}</div>`}
function epSemTopHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid),{js,e}=epJug(a),x=epSem(a.w),av=epAvisos(t,a.i,a.w);
  const src=t.semanas.map((w,i)=>[i,w]).filter(([i,w])=>i!==a.i&&epConDosis(w));const sug=(()=>{for(let i=a.i-1;i>=0;i--)if(epConDosis(t.semanas[i])&&t.semanas[i].tipo===a.w.tipo)return i;return src.length?src[src.length-1][0]:-1})();
  const P=e?epPerfil(e):{};
  return `<div class="ep-top"><label class="ep-pj">Calcular para<select id="ds-pj" data-dspj>${js.map(j=>`<option value="${esc(j.id)}" ${j.id===a.pj?'selected':''}>${esc(name(j))}${epPerfil(j).vam?'':' (sin VAM)'}</option>`).join('')||'<option value="">Sin jugadores</option>'}</select></label>
    <span class="hint">${e?(P.vam?`VAM ${nfx(P.vam,2)} m/s`:'sin VAM')+' · '+(P.t30?`30 m ${nfx(P.t30,2)} s`:'sin sprint'):'Sumá jugadores al equipo para ver los tiempos y kilos.'}</span></div>
    <div class="eq-kpis ep-k"><div><b>${distMil(x.v)}</b><span>metros de carrera</span></div><div><b>${x.v?nfx(x.im,1)+' %':'—'}</b><span>intensidad media (VAM)</span></div><div><b>${x.rp||'—'}</b><span>repeticiones de fuerza</span></div><div><b>${x.rp?nfx(x.ip,1)+' %':'—'}</b><span>% medio de 1RM</span></div></div>
    ${av.length?`<div class="ep-av">${av.map(([c,m])=>`<p class="pill ${c==='b'?'p-bad':'p-warn'}">${esc(m)}</p>`).join('')}</div>`:''}
    ${src.length?`<div class="ep-gen"><b>Generador</b><label>Copiar de<select id="ds-gsrc">${src.map(([i,w])=>`<option value="${i}" ${i===sug?'selected':''}>Semana ${i+1} · ${T_TIPOS[w.tipo]||w.tipo}</option>`).join('')}</select></label><label>Intensidad ± puntos<input id="ds-gi" type="number" step="1" value="0" style="width:70px"></label><label>Volumen ± %<input id="ds-gv" type="number" step="5" value="0" style="width:70px"></label><button class="btn sm" type="button" data-dsgen>${epConDosis(a.w)?'Reemplazar dosis':'Generar dosis'}</button></div>`:''}`}
/* lee los cambios de la dosis y aplica las acciones (se llama desde la hoja de la semana) */
function epDsCambio(a,el){const[k,kind,j,f]=el.dataset.ds.split(':');const it=a.w.days[+k][kind][+j];
  if(f==='m'){it.m=el.value;const L=EP_LIB[el.value];if(L&&L.b==='none'){it.e=L.def.e;it.p=0}else if(kind==='str'&&L&&!(S.cfg.rmDefs||[]).some(d=>d.mov===it.e))it.e=epMov(L.def.e);const d=a.w.days[+k];if(!d.met.includes(it.m))d.met.push(it.m);const q=(L||{}).q;if(q&&!d.q.includes(q))d.q=['R','F','V'].filter(x=>x===q||d.q.includes(x)).join('');return}
  it[f]=['s','r','d','p'].includes(f)?(el.value===''?0:Number(el.value)):el.value}
function epDsClick(a,ev){
  const ad=ev.target.closest('[data-dsadd]');if(ad){const[k,kind]=ad.dataset.dsadd.split(':');const d=a.w.days[+k];d.run=d.run||[];d.str=d.str||[];
    const m=d.met.find(x=>EP_LIB[x]&&(kind==='str'?EP_LIB[x].q==='F':EP_LIB[x].q!=='F')&&!d[kind].some(y=>y.m===x))||(kind==='str'?'Rep I':'IE-IL');const def={...EP_LIB[m].def};if(kind==='str')def.e=epMov(def.e);
    d[kind].push({m,...def});if(!d.met.includes(m))d.met.push(m);const q=EP_LIB[m].q;if(!d.q.includes(q))d.q=['R','F','V'].filter(x=>x===q||d.q.includes(x)).join('');return true}
  const fl=ev.target.closest('[data-dsfill]');if(fl){const d=a.w.days[+fl.dataset.dsfill];d.run=d.run||[];d.str=d.str||[];d.met.filter(m=>EP_LIB[m]&&![...d.run,...d.str].some(y=>y.m===m)).forEach(m=>{const def={...EP_LIB[m].def};if(EP_LIB[m].q==='F'){def.e=epMov(def.e);d.str.push({m,...def})}else d.run.push({m,...def})});return true}
  const dl=ev.target.closest('[data-dsdel]');if(dl){const[k,kind,j]=dl.dataset.dsdel.split(':');a.w.days[+k][kind].splice(+j,1);return true}
  if(ev.target.closest('[data-dsgen]')){const t=(S.temps||[]).find(x=>x._id===a.tid),src=t.semanas[+$('#ds-gsrc').value],di=Number($('#ds-gi').value)||0,dv=Number($('#ds-gv').value)||0;
    a.w.days=a.w.days.map((d,k)=>{const s=src.days[k]||{};return {...d,met:[...new Set([...(d.met||[]),...((s.run||[]).concat(s.str||[])).map(x=>x.m)])],
      run:(s.run||[]).map(it=>{const x={...it};x.p=Math.max(1,x.p+di);if(dv){if(x.s===1&&x.r===1)x.d=Math.max(100,Math.round(x.d*(1+dv/100)/100)*100);else x.r=Math.max(1,Math.round(x.r*(1+dv/100)))}return x}),
      str:(s.str||[]).map(it=>{const x={...it};if((EP_LIB[x.m]||{}).b!=='none')x.p=Math.min(100,Math.max(1,x.p+di));if(dv)x.r=Math.max(1,Math.round(x.r*(1+dv/100)));return x})}});
    toast('Dosis copiada de la semana '+(t.semanas.indexOf(src)+1));return true}
  return false}

/* ----- entregar al plantel: una rutina por jugador con sus tiempos y kilos ----- */
function epRutina(t,q,e,a,b,opc){const P=epPerfil(e);const secs=[],dist=[];
  for(let i=a;i<=b;i++){const w=t.semanas[i];const dias=[];
    w.days.forEach((d,k)=>{const bl=[];
      (d.run||[]).forEach(it=>{const L=EP_LIB[it.m]||{n:it.m},c=epRun(it,P);
        bl.push({uid:ruid(),nombre:(L.n||it.m).toUpperCase(),modo:'dist',series:String(it.s||1),...(it.s>1&&it.ps?{pausaSeries:String(it.ps)}:{}),
          items:[{uid:ruid(),nombre:L.n||it.m,metros:String(it.d),reps:String(it.r),...(c.falta?{}:{tiempo:epTRut(c.t)}),...(it.pr?{pausa:String(it.pr)}:{}),...(c.falta?{notas:`Al ${it.p} % de tu ${c.falta==='VAM'?'VAM':'test de sprint'}: falta tu test para calcular el tiempo.`}:c.cont&&isFinite(c.rit)?{notas:'Ritmo '+epT(c.rit)+' por km'}:{})}]})});
      let cur=null;(d.str||[]).forEach(it=>{const L=EP_LIB[it.m]||{n:it.m};if(!cur||cur._m!==it.m||cur.series!==String(it.s)){cur={uid:ruid(),nombre:(L.n||it.m).toUpperCase(),series:String(it.s),items:[],_m:it.m};bl.push(cur)}
        cur.items.push({uid:ruid(),nombre:titleCase(it.e),reps:String(it.r),...(L.b==='none'?{}:{pct:String(it.p),rm:it.e}),...(it.pr?{notas:'Pausa '+it.pr+(it.ps?' · entre ejercicios '+it.ps:'')}:{})})});
      bl.forEach(x=>delete x._m);const tb=w.test&&d.test?protBloque(d,e):null;if(tb){if(d.test.solo!==false)bl.length=0;bl.unshift(tb)}
      if(bl.length)dias.push({uid:ruid(),nombre:`Día ${dias.length+1}${tNumD(t,w)?'':' · '+T_DL[tWd(w.days.length)[k]]}${tb?' · Test':''}`,bloques:bl})});
    secs.push({uid:ruid(),titulo:`Semana ${i+1} · ${T_TIPOS[w.tipo]||w.tipo} ${w.rel}${w.comp?' · '+tCompLong(w.comp):''}${tPartidos(t,i).map(p=>' · Partido '+tPtDia(p)+(p.hora?' '+p.hora:'')+(p.rival?' '+tRivTxt(p):'')).join('')}`,posicion:e.posicion||'',dias});dist.push(dias.map((_,j)=>j))}
  return {entrenadoId:e.id,nombre:`${q.nombre} · ${a===b?'Semana '+(a+1):'Semanas '+(a+1)+' a '+(b+1)}`,estado:'activa',fechaEntrega:iso(tLun(t,a)),duracionSemanas:b-a+1,secciones:secs,distribucion:dist,
    controlCarga:!!opc.carga,bienestar:!!opc.bien,equipo:{eq:q._id,tid:t._id,desde:a,hasta:b,ts:Date.now()},
    notas:`Plan del equipo ${q.nombre}. Los tiempos se calcularon con tu VAM${P.vam?' ('+nfx(P.vam,2)+' m/s)':''} y tu test de sprint; los kilos, con tus marcas.`}}
function tpEntHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid),q=(S.equipos||[]).find(x=>x._id===t.equipoId)||{};const js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).sort((x,y)=>name(x).localeCompare(name(y)));
  const W=t.semanas;const sel=a.sel||js.map(e=>e.id);
  const opt=v=>W.map((w,i)=>`<option value="${i}" ${i===v?'selected':''}>Semana ${i+1} · ${fmtShort(iso(tLun(t,i)))} · ${T_TIPOS[w.tipo]||w.tipo}${epConDosis(w)?'':' (sin dosis)'}</option>`).join('');
  const conTest=w=>w.test&&w.days.some(d=>d.test&&(d.test.p||[]).length);const sinD=[];for(let i=a.a;i<=a.b;i++)if(!epConDosis(W[i])&&!conTest(W[i]))sinD.push(i+1);
  const ej=js.find(e=>sel.includes(e.id));let prev='';if(ej){const P=epPerfil(ej);for(let i=a.a;i<=a.b&&!prev;i++)for(const d of W[i].days){const it=(d.run||[])[0];if(it){const c=epRun(it,P);prev=`${name(ej)} · semana ${i+1}: ${it.s>1?it.s+' × ':''}${it.r} × ${distMil(it.d)} m ${c.falta?'(sin '+c.falta+')':'en '+epT(c.t)+(c.cont?' total':' cada tramo')}`;break}}}
  return `<form id="tef" class="pad"><p class="hint">Se arma una rutina para cada jugador con las semanas elegidas: los tiempos de carrera y sprint salen de sus tests y los kilos de sus marcas. La ven en su link de siempre, una semana por vez, con tildes, temporizador y registro. A quien ya tiene su propia rutina le podés <b>sumar</b> el plan (en su link elige entre «Mi rutina» y «Plan del equipo») o <b>reemplazarla</b> (queda en su historial).</p>
    <div class="form" style="margin-top:12px"><label>Desde<select id="te-a">${opt(a.a)}</select></label><label>Hasta<select id="te-b">${opt(a.b)}</select></label></div>
    ${sinD.length?`<p class="pill p-warn" style="margin-top:8px">Sin dosis: ${sinD.map(n=>'S'+n).join(', ')}. Esas semanas llegan vacías.</p>`:''}
    <fieldset class="tf-rm" style="margin-top:12px"><legend>Jugadores</legend><div class="eq-pick" style="max-height:220px">${js.map(e=>{const P=epPerfil(e),ac=rutDe(e.id).find(r=>r.estado==='activa');return `<label class="av-g"><input type="checkbox" data-tej="${esc(e.id)}" ${sel.includes(e.id)?'checked':''}> ${esc(name(e))} ${P.vam?'':'<span class="pill p-warn">sin VAM</span>'}</label>${ac&&!ac.equipo?`<select class="te-modo" data-tem="${esc(e.id)}" aria-label="Qué hacer con la rutina de ${esc(name(e))}"><option value="sumar" ${(a.modo||{})[e.id]!=='reemplazar'?'selected':''}>Sumar: ve su rutina y el plan</option><option value="reemplazar" ${(a.modo||{})[e.id]==='reemplazar'?'selected':''}>Reemplazar su rutina</option></select>`:''}`}).join('')||'<p class="hint">El equipo no tiene jugadores.</p>'}</div></fieldset>
    <div class="form" style="margin-top:10px"><label class="av-g"><input type="checkbox" id="te-carga" ${a.carga!==false?'checked':''}> Pedir minutos y esfuerzo (RPE) al terminar cada sesión</label><label class="av-g"><input type="checkbox" id="te-bien" ${a.bien!==false?'checked':''}> Pedir el bienestar antes de entrenar</label></div>
    ${prev?`<p class="hint" style="margin-top:8px">Ejemplo: ${esc(prev)}</p>`:''}
    <p class="hint" id="te-msg" role="alert"></p>
    <div class="actions" style="margin-top:10px"><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit">Entregar a ${plural(sel.length,'jugador','jugadores')}</button></div></form>`}
function bindTpEnt(a){const ov=$('#overlay');
  const leer=()=>{a.a=Number($('#te-a').value);a.b=Number($('#te-b').value);a.sel=[...ov.querySelectorAll('[data-tej]:checked')].map(i=>i.dataset.tej);a.carga=$('#te-carga').checked;a.bien=$('#te-bien').checked;a.modo={...(a.modo||{})};ov.querySelectorAll('[data-tem]').forEach(x=>a.modo[x.dataset.tem]=x.value)};
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};
  ov.onchange=ev=>{if(ev.target.matches('#te-a,#te-b,[data-tej]')){leer();if(a.b<a.a)a.b=a.a;renderSheet()}else if(ev.target.matches('[data-tem]'))leer()};
  $('#tef').onsubmit=async ev=>{ev.preventDefault();leer();const msg=$('#te-msg');if(!a.sel.length){msg.textContent='Elegí al menos un jugador.';return}if(a.b<a.a){msg.textContent='«Hasta» no puede ser antes que «Desde».';return}
    const t=(S.temps||[]).find(x=>x._id===a.tid),q=(S.equipos||[]).find(x=>x._id===t.equipoId),hoy=iso(today());let n=0;
    const btn=ev.submitter;if(btn){btn.disabled=true;btn.textContent='Entregando…'}
    for(const id of a.sel){const e=S.ents[id];if(!e)continue;const doc=epRutina(t,q,e,a.a,a.b,{carga:a.carga,bien:a.bien});
      const prev=rutDe(id).find(r=>r.equipo&&r.equipo.tid===t._id&&r.equipo.desde===a.a);
      /* el plan anterior de este equipo siempre se cierra; la rutina propia del jugador solo si elegiste «Reemplazar» */
      const reemplazar=(a.modo||{})[id]==='reemplazar';
      for(const r of rutDe(id).filter(r=>r.estado==='activa'&&r!==prev&&(r.equipo?r.equipo.eq===q._id:reemplazar)))await write(()=>S.db.collection('rutinas').doc(r._id).update({estado:'finalizada',fechaFin:hoy}));
      const ok=prev?await write(()=>S.db.collection('rutinas').doc(prev._id).set(doc)):await write(()=>S.db.collection('rutinas').add(doc));
      if(ok){n++;await ensureToken(e);await write(()=>S.db.collection('entrenados').doc(id).update({ultRutina:hoy,modalidad:'Periodizada'}));await addHist(id,'Rutina',`Plan del equipo ${q.nombre}: ${doc.nombre.split(' · ')[1]}`)}}
    toast(plural(n,'rutina entregada','rutinas entregadas'));closeSheet()}}
/* PDF de las rutinas del plantel que vienen de esta temporada */
function epPDFs(tid){const rs=S.rutinas.filter(r=>r.estado==='activa'&&r.equipo&&r.equipo.tid===tid&&S.ents[r.entrenadoId]);if(!rs.length){toast('Todavía no entregaste semanas al plantel');return}
  const files=rs.map(pdfDe);if(files.length===1){RutinaPDF.download(files[0].data,files[0].name,'application/pdf');toast('PDF descargado');return}
  RutinaPDF.download(RutinaPDF.zip(files),`Plan del equipo ${fmtD(iso(today())).replace(/\//g,'-')}.zip`,'application/zip');toast(plural(files.length,'PDF descargado','PDF descargados en un .zip'))}

/* ----- control de carga: planificada contra real (minutos × esfuerzo que anota cada jugador) ----- */
function epControlHTML(q,t){const js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).sort((x,y)=>name(x).localeCompare(name(y)));if(!t||!js.length)return '';
  const hoy=tSemHoy(t);const fin=hoy!=null?hoy:(days(today(),parse(t.inicio))<0?-1:t.semanas.length-1);if(fin<0)return '';
  const ini=Math.max(0,fin-5),idx=[];for(let i=ini;i<=fin;i++)idx.push(i);
  const real=e=>{const cd=cargaDias(e.id);return idx.map(i=>{const a=iso(tLun(t,i)),b=iso(new Date(tLun(t,i).getTime()+6*864e5));let v=0;for(const k in cd)if(k>=a&&k<=b)v+=cd[k];return Math.round(v)})};
  const R=Object.fromEntries(js.map(e=>[e.id,real(e)]));const prom=idx.map((_,j)=>{const v=js.map(e=>R[e.id][j]).filter(x=>x>0);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0});
  const hay=prom.some(Boolean);
  const avisos=[];for(let j=1;j<idx.length;j++){const p0=parseInt(t.semanas[idx[j-1]].rel,10),p1=parseInt(t.semanas[idx[j]].rel,10);if(prom[j-1]&&prom[j]){if(p1>p0&&prom[j]<prom[j-1]*0.85)avisos.push(`Semana ${idx[j]+1}: el plan sube (${t.semanas[idx[j]].rel}) pero la carga real del equipo bajó ${Math.round((1-prom[j]/prom[j-1])*100)} %.`);if(p1<p0&&prom[j]>prom[j-1]*1.15)avisos.push(`Semana ${idx[j]+1}: el plan baja (${t.semanas[idx[j]].rel}) pero la carga real subió ${Math.round((prom[j]/prom[j-1]-1)*100)} %.`)}}
  return `<div class="card tp-card"><div class="pad"><b>Control de carga · planificada contra real</b> <button class="g-q" type="button" data-guia="control" aria-label="Ayuda sobre el control de carga">?</button><p class="hint">Lo real es lo que anota cada jugador al terminar la sesión (minutos × esfuerzo de 1 a 10). La relación aguda/crónica avisa si alguien sube demasiado rápido.</p></div>
    ${hay?'':'<p class="hint pad" style="padding-top:0">Todavía no hay registros. Aparecen cuando los jugadores anotan sus sesiones en el link (se activa al entregar las semanas).</p>'}
    <div class="tbl-wrap"><table class="eq-t ep-ctl"><thead><tr><th>Jugador</th>${idx.map(i=>`<th class="num">S${i+1}<br><small>${fmtShort(iso(tLun(t,i)))}</small></th>`).join('')}<th class="num">Aguda/crónica</th></tr></thead><tbody>
      <tr class="ep-plan"><td><b>Plan</b></td>${idx.map(i=>{const w=t.semanas[i],x=epSem(w);return `<td class="num t-${w.tipo}"><span class="dot" style="background:var(--tc)"></span>${esc(w.rel)}<br><small>${x.v?distMil(x.v)+' m':(T_TIPOS[w.tipo]||'')}</small></td>`}).join('')}<td></td></tr>
      ${js.map(e=>{const r=R[e.id],av=r.filter(Boolean),m=av.length?av.reduce((a,b)=>a+b,0)/av.length:0,ac=acwr(e.id);return `<tr><td><button class="lnk" type="button" data-open="${esc(e.id)}">${esc(name(e))}</button></td>${r.map(v=>`<td class="num">${v?`<span class="ep-real ${m&&v>m*1.3?'hi':m&&v<m*0.7?'lo':''}">${distMil(v)}</span>`:'<span class="muted">—</span>'}</td>`).join('')}<td class="num"><span class="pill ${acwrPill(ac.ratio)}">${ac.ratio==null?'—':nfx(ac.ratio,2)}</span></td></tr>`}).join('')}
      <tr class="ep-prom"><td><b>Promedio del equipo</b></td>${prom.map(v=>`<td class="num"><b>${v?distMil(v):'—'}</b></td>`).join('')}<td></td></tr></tbody></table></div>
    ${avisos.length?`<div class="ep-av pad">${avisos.map(m=>`<p class="pill p-warn">${esc(m)}</p>`).join('')}</div>`:''}</div>`}

/* ----- fórmulas con doble verificación (etapa 4) ----- */
function epFormHTML(a){const fr=(S.cfgRaw||{}).epFormulas||{},hist=((S.cfgRaw||{}).epFormHist||[]).slice().reverse();
  return `<div class="pad ep-form"><p class="hint">Son las cuentas que usan las semanas del equipo para calcular tiempos y metros. Cada cambio pasa dos verificaciones: primero se prueba contra casos con resultado conocido y se mide cuántas filas cambian; después lo confirmás con un motivo. Las semanas ya entregadas no cambian hasta que las vuelvas a entregar. Los kilos se calculan como en el resto de la app (1RM × % redondeado a ${nfx(S.cfg.redondeo,1)} kg, se cambia en Ajustes).</p>
  ${Object.entries(EP_FDEF).map(([k,d])=>{const mod=!!fr[k]&&fr[k]!==d.expr,ed=a.k===k;return `<div class="card ep-fc"><div class="pad ep-fc-h"><b>${esc(d.n)}</b> <span class="pill ${mod?'p-warn':'p-mute'}">${mod?'modificada':'original'}</span><code class="ep-code">${esc(epExpr(k))}</code></div>
    <div class="pad" style="padding-top:0"><p class="hint">${esc(d.w)} Variables: ${Object.entries(d.vars).map(([v,x])=>`<code>${v}</code> ${esc(x)}`).join(' · ')}.</p><p class="hint g-ref">Base teórica: ${esc(citas(EP_FREF[k]))||'adaptación de la app (sin autor específico)'}.</p>
    ${ed?epEditorHTML(a,k):`<div class="actions" style="margin-top:6px"><button class="btn sm" type="button" data-fe="${k}">Editar</button>${mod?`<button class="btn sm" type="button" data-fo="${k}">Volver a la original</button>`:''}</div>`}</div></div>`}).join('')}
  <div class="card pad"><b>Historial</b>${hist.length?`<ul class="timeline" style="margin:6px -16px 0">${hist.map(h=>`<li><span class="d">${esc(h.cuando)}</span><span class="t"><b>${esc((EP_FDEF[h.k]||{}).n||h.k)}</b>: <code>${esc(h.antes)}</code> → <code>${esc(h.despues)}</code><br><span class="hint" style="display:inline">${esc(h.motivo)}${h.fallos?` · aplicada con ${h.fallos} control${h.fallos>1?'es':''} fallido${h.fallos>1?'s':''}`:''}</span></span></li>`).join('')}</ul>`:'<p class="hint">Sin cambios: se usan las fórmulas originales.</p>'}</div></div>`}
function epEditorHTML(a,k){const d=EP_FDEF[k],r=a.r;
  return `<div class="ep-ed"><div class="ep-steps"><span class="${!r?'on':'ok'}">1 · Escribir</span><span class="${r&&!r.err?'on':''}">2 · Verificar</span><span>3 · Confirmar</span></div>
    <label class="fl">Fórmula<textarea id="fe-x" spellcheck="false" rows="2">${esc(a.x)}</textarea></label><p class="hint">Funciones: round, min, max, abs, floor, ceil, sqrt.</p>
    <div class="actions"><button class="btn pri sm" type="button" data-fv="${k}">Verificar</button><button class="btn sm" type="button" data-fc>Cancelar</button></div>
    ${r?r.err?`<p class="pill p-bad">${esc(r.err)}</p>`:`<div class="tbl-wrap" style="margin-top:8px"><table class="eq-t"><thead><tr><th>Caso de control</th><th class="num">Actual</th><th class="num">Nueva</th><th class="num">Esperado</th><th></th></tr></thead><tbody>${r.rows.map(x=>`<tr><td>${esc(x.src)}</td><td class="num">${nfx(x.cur,2)}</td><td class="num">${nfx(x.nw,2)}</td><td class="num">${nfx(x.e,2)}</td><td class="${x.ok?'ep-ok':'ep-no'}">${x.ok?'✓ coincide':'✕ no coincide'}</td></tr>`).join('')}</tbody></table></div>
      <p class="pill ${r.fails?'p-bad':'p-ok'}" style="margin-top:8px">${r.fails?`${r.fails} de ${r.rows.length} casos no dan lo esperado.`:'Verificación 1 OK: da lo esperado en todos los casos.'} Cambia ${plural(r.aff,'fila','filas')} de las temporadas${r.aff?` (hasta ${nfx(r.maxd,1)} %)`:''}.</p>
      <div class="form" style="margin-top:8px">${r.fails?`<label class="av-g full"><input type="checkbox" id="fe-ack"> Entiendo que no coincide con los controles y quiero aplicarla igual.</label>`:''}<label class="full">Motivo del cambio (queda en el historial)<input id="fe-why" placeholder="Ej: usar el ritmo de la pista de 400 m"></label>
      <div class="full actions"><button class="btn pri" type="button" data-fa="${k}">Aplicar cambio</button></div></div>`:''}</div>`}
function epVerificar(k,x){const d=EP_FDEF[k];let ast;try{ast=epParse(x)}catch(e){return {err:e.message}}
  const unk=[...epVars(ast)].filter(v=>!(v in d.vars));if(unk.length)return {err:'Variable desconocida: '+unk.join(', ')+'. Usá: '+Object.keys(d.vars).join(', ')+'.'};
  const rows=d.ctl.map(c=>{const nw=epEv(ast,c.v),cur=epF(k,c.v);return {src:c.src,cur,nw,e:c.e,ok:isFinite(nw)&&Math.abs(nw-c.e)<=d.tol}});
  let aff=0,maxd=0;(S.temps||[]).forEach(t=>{const q=(S.equipos||[]).find(z=>z._id===t.equipoId);const Ps=(q?.jugadores||[]).map(id=>S.ents[id]).filter(Boolean).map(epPerfil);
    t.semanas.forEach(w=>w.days.forEach(dd=>(dd.run||[]).forEach(it=>{const L=EP_LIB[it.m]||{};const envs=[];
      if(k==='vol')envs.push({series:+it.s,reps:+it.r,dist:+it.d});else Ps.forEach(P=>{if(k==='tRes'&&L.b==='vam'&&P.vam)envs.push({dist:+it.d,vam:P.vam,pct:+it.p});if(k==='ritmo'&&L.b==='vam'&&P.vam)envs.push({vam:P.vam,pct:+it.p});if(k==='tSpr'&&L.b==='sprint'){const tr=epTref(P,+it.d);if(isFinite(tr))envs.push({tref:tr,pct:+it.p})}});
      envs.forEach(env=>{const o=epF(k,env),n=epEv(ast,env);if(Math.abs(o-n)>1e-9){aff++;if(o)maxd=Math.max(maxd,Math.abs(n-o)/Math.abs(o)*100)}})})))});
  return {rows,fails:rows.filter(z=>!z.ok).length,aff,maxd}}
function bindEpForm(a){const ov=$('#overlay');
  const guardar=async(k,x,motivo,fallos)=>{const raw=S.cfgRaw||{},fr={...(raw.epFormulas||{})};const antes=epExpr(k);if(x===EP_FDEF[k].expr)delete fr[k];else fr[k]=x;
    const h=[...(raw.epFormHist||[]),{k,antes,despues:x,motivo,fallos,cuando:new Date().toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}].slice(-50);
    if(await write(()=>S.db.doc('config/general').set({...raw,epFormulas:fr,epFormHist:h}))){S.cfgRaw={...raw,epFormulas:fr,epFormHist:h};return true}return false};
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    const e=ev.target.closest('[data-fe]');if(e){a.k=e.dataset.fe;a.x=epExpr(a.k);a.r=null;renderSheet();const t=$('#fe-x');t&&t.focus();return}
    if(ev.target.closest('[data-fc]')){a.k=null;a.r=null;renderSheet();return}
    const v=ev.target.closest('[data-fv]');if(v){a.x=$('#fe-x').value.trim();a.r=epVerificar(a.k,a.x);renderSheet();return}
    const ap=ev.target.closest('[data-fa]');if(ap){const why=$('#fe-why').value.trim(),ack=$('#fe-ack');if(!why){toast('Escribí el motivo del cambio');$('#fe-why').focus();return}
      if(a.r.fails&&!(ack&&ack.checked)){toast('Confirmá que querés aplicarla aunque no coincida');return}
      if(await guardar(a.k,a.x,why,a.r.fails)){toast('Fórmula actualizada');a.k=null;a.r=null;renderSheet()}return}
    const o=ev.target.closest('[data-fo]');if(o){if(await guardar(o.dataset.fo,EP_FDEF[o.dataset.fo].expr,'Vuelta a la fórmula original',0)){toast('Fórmula original restaurada');renderSheet()}}}}
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-tpent],[data-tppdf],[data-epform],[data-protos]');if(!b)return;const D=b.dataset;
  if(D.protos!=null){openSheet('__prot','ver',{});return}
  if(D.tpent!=null){const t=(S.temps||[]).find(x=>x._id===D.tpent);if(!t)return;const h=tSemHoy(t);let a0=h??0;if(days(today(),parse(t.inicio))<0)a0=0;const m=t.semanas[a0].meso;let b0=a0;while(b0+1<t.semanas.length&&t.semanas[b0+1].meso===m)b0++;openSheet('__tpent','ver',{tid:t._id,a:a0,b:b0});return}
  if(D.tppdf!=null){epPDFs(D.tppdf);return}
  if(D.epform!=null){openSheet('__epform','ver',{})}});
/* ---------- EQUIPO PRO · protocolos de test (editables) ---------- */
/* {id, n nombre, c qué registra (campo de TCAMPOS, 'spr', 'yoyo' o ''), u unidad si c='', int intentos, pau pausa, mat material, pasos[], inv[] no vale si, nota} */
const PROT_C=[['','Nada (solo instrucciones)'],['peso','Peso (kg)'],['cmj','CMJ (cm)'],['abk','Abalakov (cm)'],['spr','Sprint 10/20/30 m (s)'],['t10','Sprint 10 m (s)'],['t20','Sprint 20 m (s)'],['t30','Sprint 30 m (s)'],['vam','VAM (m/s)'],['yoyo','Yo-Yo IR1 (nivel)'],['otro','Otro valor (lo anotás en la nota del test)']];
const PROT_DEF=[
 {id:'calor',n:'Entrada en calor general',c:'',int:'',pau:'',mat:'Conos',pasos:['5 min de trote suave.','Movilidad de cadera, tobillo y hombro.','Skipping, talones y desplazamientos laterales: 2 × 15 m de cada uno.','3 aceleraciones de 20 m al 60, 80 y 90 %.','3 saltos al 70 %.'],inv:[],nota:'Para un día con varios tests: hacela una vez al principio y después solo la parte específica de cada prueba.'},
 {id:'peso',n:'Peso corporal',c:'peso',int:'1',pau:'',mat:'Balanza',calor:[],pasos:['Sin zapatillas y con ropa liviana.','Antes de tomar agua o comer.'],inv:[],nota:''},
 {id:'cmj',n:'CMJ',c:'cmj',int:'3',pau:'1 min',mat:'Plataforma o app de salto',calor:["5 min de trote suave o bici.", "Movilidad de cadera y tobillo.", "2 × 10 sentadillas sin peso.", "3 CMJ de práctica al 50, 70 y 90 %.", "2 min de pausa antes del primer intento."],pasos:['Manos en la cintura todo el salto.','Bajá rápido hasta donde te salga natural y saltá lo más alto posible.','Piernas estiradas en el aire. Caé en el mismo lugar.'],inv:['Sacaste las manos de la cintura.','Flexionaste las rodillas en el aire.'],nota:'Se anota el mejor intento.'},
 {id:'abk',n:'Abalakov',c:'abk',int:'3',pau:'1 min',mat:'Plataforma o app de salto',calor:["5 min de trote suave o bici.", "Movilidad de cadera, tobillo y hombro.", "2 × 10 sentadillas sin peso con braceo.", "3 saltos de práctica con brazos al 50, 70 y 90 %.", "2 min de pausa antes del primer intento."],pasos:['Igual que el CMJ, pero con impulso libre de brazos.','Llevá los brazos arriba con fuerza al despegar.'],inv:['Flexionaste las rodillas en el aire.'],nota:'Se anota el mejor intento.'},
 {id:'unil',n:'CMJ unilaterales (vertical, horizontal y lateral)',c:'otro',int:'3 por pierna',pau:'45 s',mat:'Plataforma o app de salto, cinta métrica',calor:["5 min de trote suave o bici.", "Movilidad de cadera, rodilla y tobillo.", "2 × 8 sentadillas búlgaras sin peso por pierna.", "2 saltos de práctica a una pierna por dirección y por pierna, al 70 %.", "2 min de pausa antes del primer intento."],pasos:['Vertical: apoyo en una pierna, manos en la cintura, saltá lo más alto posible.','Horizontal: desde una pierna, saltá lo más lejos posible hacia adelante. Se mide de la punta del pie al talón más cercano.','Lateral: desde una pierna, saltá hacia el costado de esa pierna.','Alterná derecha e izquierda.'],inv:['Perdiste el equilibrio al caer.'],nota:'Se anota el mejor de cada pierna. Ajustá estas consignas al protocolo que uses.'},
 {id:'spr',n:'Sprint 10/20/30 m',c:'spr',int:'3',pau:'3 min caminando',mat:'Fotocélulas o cronómetro, conos',calor:["5 min de trote suave.", "Movilidad dinámica de cadera y tobillo.", "Skipping, talones y zancadas: 2 × 15 m de cada uno.", "3 aceleraciones de 20 a 30 m al 60, 80 y 90 %.", "2 a 3 min de pausa antes del primer intento."],pasos:['Parado, un pie adelante, la punta 50 cm detrás de la línea.','Arrancá cuando quieras, sin balanceo previo.','A fondo hasta pasar los 30 m. No frenes antes.'],inv:['Te balanceaste antes de salir.'],nota:'Se anota el mejor tiempo de cada parcial.'},
 {id:'tt',n:'Prueba T',c:'otro',int:'3',pau:'3 min',mat:'4 conos, cronómetro',calor:["5 min de trote suave.", "Movilidad dinámica de cadera y tobillo.", "Desplazamientos laterales y de espaldas: 2 × 10 m de cada uno.", "1 recorrido de la T al 50 % y otro al 75 %.", "2 min de pausa antes del primer intento."],pasos:['De A a B de frente (9,14 m). Tocá el cono.','Lateral a C (4,57 m). Tocá.','Lateral a D (9,14 m). Tocá.','Lateral a B. Tocá.','De espaldas hasta A.'],inv:['Cruzaste los pies.','No tocaste un cono.'],nota:'Se anota el mejor intento.'},
 {id:'rm',n:'1RM',c:'',int:'3 a 5',pau:'3 a 5 min',mat:'Barra, discos, ayudante',calor:["5 min de bici o remo suave.", "Movilidad de las articulaciones que usa el ejercicio.", "1 serie de 10 con la barra sola."],pasos:['8 a 10 repeticiones livianas (50 % de tu marca anterior). Pausa 1 min.','3 a 5 repeticiones al 70 %. Pausa 2 min.','1 a 2 repeticiones al 85–90 %. Pausa 3 min.','Intentos de 1 repetición: subí 5 a 10 % en tren superior y 10 a 20 % en tren inferior.'],inv:['Se rompió la técnica.','Necesitaste ayuda para terminar.'],nota:'Siempre con ayudante. Las marcas nuevas las carga tu entrenador.'},
 {id:'vam',n:'VAM · prueba de Montreal (UM-TT)',c:'vam',int:'1',pau:'',mat:'Pista de 400 m, conos cada 50 m, audio',calor:["10 min de trote a ritmo cómodo.", "Movilidad dinámica de cadera y tobillo.", "2 progresivos de 80 m.", "3 min de pausa antes de arrancar."],pasos:['Corré siguiendo la señal sonora: arranca a 8 km/h y sube 1 km/h cada 2 min.','Tenés que pasar cada cono con la señal.','Seguí hasta que no puedas sostener el ritmo.'],inv:['No llegaste al cono 2 veces seguidas: ahí termina.'],nota:'Se anota la velocidad de la última etapa completa.'},
 {id:'yoyo',n:'Yo-Yo IR1',c:'yoyo',int:'1',pau:'',mat:'Conos a 20 m y a 5 m, audio',calor:["5 min de trote suave.", "Movilidad dinámica de cadera y tobillo.", "2 idas y vueltas de 20 m al ritmo del primer nivel.", "2 cambios de dirección progresivos.", "3 min de pausa antes de arrancar."],pasos:['Corré ida y vuelta 2 × 20 m al ritmo del audio.','10 s de recuperación caminando 2 × 5 m.','Seguí mientras llegues a la línea con la señal.'],inv:['No llegaste a la línea 2 veces: ahí termina.'],nota:'Se anota el último nivel completo (ej: 15:1).'}];
/* orden sugerido para la semana de test: lo que menos cansa primero; 1RM y resistencia en días separados */
const PROT_SUG={0:['calor','peso','cmj','abk','spr','tt'],2:['calor','rm'],4:['calor','vam']};
const protos=()=>Array.isArray((S.cfgRaw||{}).protocolos)?S.cfgRaw.protocolos.map(p=>{if(p.calor!==undefined)return p;const d=PROT_DEF.find(x=>x.id===p.id);return {...p,calor:d&&d.calor?d.calor.slice():[]}}):PROT_DEF;
const protDe=id=>protos().find(p=>p.id===id);
const intTxt=x=>!x?'':/intento/i.test(x)?x:/^\d+$/.test(x)?x+(x==='1'?' intento':' intentos'):/^\d+\s*(a|-|o)\s*\d+$/.test(x)?x+' intentos':'intentos: '+x;
const protMeta=p=>[intTxt(p.int),p.pau?'pausa '+p.pau:''].filter(Boolean).join(' · ');
function protPrev(p,e){if(!e)return '';const u=ultimoTest(e.id),f=x=>x&&x.f?' ('+fmtShort(x.f)+')':'';
  if(p.c==='spr'){if(!u.t10&&!u.t20&&!u.t30)return '';return ['t10','t20','t30'].map(k=>u[k]?nfx(u[k].v,2):'—').join(' / ')+' s'+f(u.t30||u.t20||u.t10)}
  if(p.c==='yoyo')return u.yoyo?u.yoyo.v+f(u.yoyo):'';
  const c=TCAMPOS.find(x=>x.k===p.c);return c&&u[c.k]?nfx(u[c.k].v,c.d)+' '+c.u+f(u[c.k]):''}
const protEj=c=>({spr:'1,90 / 3,22 / 4,40 s',vam:'3,40 m/s',peso:'92,0 kg',yoyo:'15:1',abk:'47,5 cm',t10:'1,90 s',t20:'3,22 s',t30:'4,40 s'})[c]||'41,2 cm';
const protUsos=id=>(S.temps||[]).reduce((n,t)=>n+t.semanas.reduce((m,w)=>m+(w.test?w.days.filter(d=>d.test&&(d.test.p||[]).includes(id)).length:0),0),0);
async function guardarProtos(L){const raw=S.cfgRaw||{};if(await write(()=>S.db.doc('config/general').set({...raw,protocolos:L}))){S.cfgRaw={...raw,protocolos:L};return true}return false}
/* vista previa: igual a como lo ve el jugador */
function protVistaHTML(p,prev){return `<div class="pr-v"><div class="pr-vh"><b>${esc(p.n||'Sin nombre')}</b>${protMeta(p)?`<span>${esc(protMeta(p))}</span>`:''}</div>
  ${p.c&&p.c!=='otro'?`<span class="pr-prev">${prev?'Marca anterior: '+esc(prev):'Primera vez: sin marca anterior'}</span>`:''}
  ${p.mat?`<p class="pr-mat">Material: ${esc(p.mat)}</p>`:''}
  ${(p.calor||[]).length?`<p class="pr-sh">Entrada en calor</p><ol>${p.calor.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}
  ${(p.pasos||[]).length?`<p class="pr-sh">${(p.calor||[]).length?'Evaluación':'Cómo se hace'}</p><ol>${p.pasos.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}
  ${(p.inv||[]).length?`<p class="pr-inv"><b>No vale si:</b> ${p.inv.map(esc).join(' ')}</p>`:''}
  ${p.nota?`<p class="pr-nota">${esc(p.nota)}</p>`:''}</div>`}
function protFormHTML(a){const L=protos();
  if(a.ed!=null){const p=a.p;const lines=x=>(x||[]).join('\n');
    return `<form id="prf" class="pad pr-ed"><div class="form">
      <label class="full">Nombre del test<input id="pr-n" required maxlength="80" value="${esc(p.n)}" placeholder="CMJ"></label>
      <label>Qué se registra<select id="pr-c">${PROT_C.map(([k,l])=>`<option value="${k}" ${k===(p.c||'')?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
      <label>Intentos<input id="pr-int" maxlength="30" value="${esc(p.int)}" placeholder="3"></label>
      <label>Pausa entre intentos<input id="pr-pau" maxlength="40" value="${esc(p.pau)}" placeholder="1 min"></label>
      <label>Material<input id="pr-mat" maxlength="120" value="${esc(p.mat)}" placeholder="Conos, cronómetro"></label>
      <label class="full">Entrada en calor de este test (uno por renglón, opcional)<textarea id="pr-calor" rows="5" placeholder="5 min de trote suave.">${esc(lines(p.calor))}</textarea></label>
      <label class="full">Protocolo de evaluación (uno por renglón)<textarea id="pr-pasos" rows="6" required placeholder="Manos en la cintura todo el salto.">${esc(lines(p.pasos))}</textarea></label>
      <label class="full">No vale si… (uno por renglón, opcional)<textarea id="pr-inv" rows="3" placeholder="Sacaste las manos de la cintura.">${esc(lines(p.inv))}</textarea></label>
      <label class="full">Nota para el jugador (opcional)<textarea id="pr-nota" rows="2" placeholder="Se anota el mejor intento.">${esc(p.nota)}</textarea></label></div>
      <p class="hint" style="margin-top:12px"><b>Así lo ve el jugador</b>${p.c&&p.c!=='otro'?' (con una marca de ejemplo)':''}:</p><div id="pr-prev">${protVistaHTML(p,protEj(p.c))}</div>
      <p class="hint" id="pr-msg" role="alert"></p>
      <div class="actions sticky-save"><button class="btn" type="button" data-prback>Volver a la lista</button><span style="flex:1"></span><button class="btn pri" type="submit">Guardar protocolo</button></div></form>`}
  return `<div class="pad pr-list"><p class="hint">Armá cada test como quieras: su entrada en calor, el protocolo de evaluación, intentos, pausas y cuándo no vale el intento. Cada test se puede usar solo o junto con otros: en la semana de test de un equipo, o con «+ Test» en cualquier día de una rutina individual. El jugador lo ve paso a paso en su link.</p>
    ${a.back?`<button class="btn" type="button" data-prsem style="margin-top:10px">‹ Volver a la semana ${a.back.i+1}</button>`:''}
    <ul class="pr-ul">${L.map((p,i)=>{const n=protUsos(p.id);return `<li><div class="pr-li"><b>${esc(p.n)}</b><span class="hint">${esc([protMeta(p),(PROT_C.find(c=>c[0]===(p.c||''))||[])[1],n?'en '+plural(n,'día de test','días de test'):''].filter(Boolean).join(' · '))}</span></div>
      <span class="pr-ac"><button class="x-sm" type="button" data-prmv="${i}:-1" ${i?'':'disabled'} aria-label="Subir ${esc(p.n)}">↑</button><button class="x-sm" type="button" data-prmv="${i}:1" ${i<L.length-1?'':'disabled'} aria-label="Bajar ${esc(p.n)}">↓</button><button class="btn sm" type="button" data-pred="${i}">Editar</button><button class="btn sm" type="button" data-prdup="${i}">Duplicar</button><button class="btn sm danger" type="button" data-prdel="${i}" aria-label="Borrar ${esc(p.n)}">Borrar</button></span></li>`}).join('')||'<li class="hint">No hay protocolos.</li>'}</ul>
    <p class="hint" id="pr-msg" role="alert"></p>
    <div class="actions" style="margin-top:12px"><button class="btn pri" type="button" data-prnew>+ Nuevo protocolo</button>${PROT_DEF.some(d=>!L.find(p=>p.id===d.id))?'<button class="btn" type="button" data-prfill>Agregar los ejemplos que falten</button>':''}<span style="flex:1"></span><button class="btn" type="button" data-close>Cerrar</button></div></div>`}
function bindProt(a){const ov=$('#overlay');
  const leerP=()=>{const ls=id=>$(id).value.split('\n').map(x=>x.trim()).filter(Boolean);const p=a.p;p.n=$('#pr-n').value.trim();p.c=$('#pr-c').value;p.int=$('#pr-int').value.trim();p.pau=$('#pr-pau').value.trim();p.mat=$('#pr-mat').value.trim();p.calor=ls('#pr-calor');p.pasos=ls('#pr-pasos');p.inv=ls('#pr-inv');p.nota=$('#pr-nota').value.trim()};
  if(a.ed!=null){$('#prf').oninput=()=>{leerP();$('#pr-prev').innerHTML=protVistaHTML(a.p,protEj(a.p.c))};$('#prf').onchange=ev=>{if(ev.target.id==='pr-c'){leerP();$('#pr-prev').innerHTML=protVistaHTML(a.p,protEj(a.p.c))}};
    $('#prf').onsubmit=async ev=>{ev.preventDefault();leerP();const msg=$('#pr-msg');if(!a.p.n){msg.textContent='Falta el nombre del test.';$('#pr-n').focus();return}if(!a.p.pasos.length){msg.textContent='Escribí al menos un paso del protocolo de evaluación.';$('#pr-pasos').focus();return}
      const L=protos().slice();if(a.ed<0)L.push(a.p);else L[a.ed]=a.p;if(await guardarProtos(L)){toast('Protocolo guardado');a.ed=null;a.p=null;renderSheet()}}}
  ov.onclick=async ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    const t=ev.target;let b;
    if(t.closest('[data-prback]')){a.ed=null;a.p=null;renderSheet();return}
    if(t.closest('[data-prsem]')){const tp=(S.temps||[]).find(x=>x._id===a.back.tid);if(tp)openSheet('__tpsem','ver',semArg(tp,a.back.i,a.back.pj));else closeSheet();return}
    if(t.closest('[data-prnew]')){a.ed=-1;a.p={id:'p'+Date.now().toString(36),n:'',c:'',int:'3',pau:'',mat:'',calor:[],pasos:[],inv:[],nota:''};renderSheet();return}
    if(b=t.closest('[data-pred]')){a.ed=+b.dataset.pred;a.p=JSON.parse(JSON.stringify(protos()[a.ed]));renderSheet();return}
    if(b=t.closest('[data-prdup]')){const L=protos().slice(),i=+b.dataset.prdup,c={...JSON.parse(JSON.stringify(L[i])),id:'p'+Date.now().toString(36),n:L[i].n+' (copia)'};L.splice(i+1,0,c);if(await guardarProtos(L)){a.ed=i+1;a.p=JSON.parse(JSON.stringify(c));renderSheet()}return}
    if(b=t.closest('[data-prmv]')){const[i,d]=b.dataset.prmv.split(':').map(Number);const L=protos().slice();[L[i],L[i+d]]=[L[i+d],L[i]];if(await guardarProtos(L))renderSheet();return}
    if(b=t.closest('[data-prdel]')){const i=+b.dataset.prdel,L=protos().slice(),n=protUsos(L[i].id);
      if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent=n?`Se usa en ${n} ${n===1?'día':'días'}: ¿borrar?`:'¿Seguro?';return}
      L.splice(i,1);if(await guardarProtos(L)){toast('Protocolo borrado');renderSheet()}return}
    if(t.closest('[data-prfill]')){const L=protos().slice();PROT_DEF.forEach(d=>{if(!L.find(p=>p.id===d.id))L.push(JSON.parse(JSON.stringify(d)))});if(await guardarProtos(L)){toast('Ejemplos agregados');renderSheet()}}}}
/* elegir tests para un día de una rutina individual (editor) */
function testPickHTML(p){const L=protos();return `<div class="tpk"><b>Agregar tests a este día</b><p class="hint">Marcá los que vas a usar, en el orden de la lista (después los podés mover). Cada uno lleva su entrada en calor y su protocolo de evaluación. Los protocolos se editan en Equipos → Protocolos de test.</p>
  <div class="tpk-l">${L.map(x=>`<label class="tpk-o"><input type="checkbox" data-tpk value="${esc(x.id)}"><span><b>${esc(x.n)}</b><small>${esc([protMeta(x),(x.calor||[]).length?'con entrada en calor':''].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div>
  <label class="tpk-n">Nota del día (opcional)<input id="tpk-nota" maxlength="160" placeholder="Sin pesas el día anterior. Traé las zapatillas de siempre."></label>
  <label class="ts-solo"><input type="checkbox" id="tpk-solo"> Ese día solo se testea: sacar los otros bloques del día</label>
  <p class="hint" id="tpk-msg" role="alert"></p>
  <div class="actions"><button class="btn pri" type="button" data-act="testOk" data-p="${p}">Agregar al día</button><button class="btn" type="button" data-act="testCancel" data-p="${p}">Cancelar</button></div></div>`}
document.addEventListener('change',ev=>{if(ev.target.matches&&ev.target.matches('[data-tpk]')){const m=document.getElementById('tpk-msg');if(m)m.textContent=''}});
/* bloque de test que recibe el jugador (el protocolo viaja copiado: cambiarlo después no toca planes ya entregados) */
function protBloque(d,e){const its=(d.test.p||[]).map(protDe).filter(Boolean).map(p=>{const prev=p.c&&p.c!=='otro'?protPrev(p,e):'';
    const mide=e&&p.c&&p.c!=='otro';
    return {uid:ruid(),nombre:p.n,test:{c:p.c||'',int:p.int||'',pau:p.pau||'',mat:p.mat||'',calor:p.calor||[],pasos:p.pasos||[],inv:p.inv||[],nota:p.nota||''},...(mide?{prev:prev||'Primera vez'}:{}),
      notas:[protMeta(p),mide?(prev?'marca anterior: '+prev:'primera vez'):''].filter(Boolean).join(' · ')}});
  return its.length?{uid:ruid(),nombre:'TEST',modo:'test',series:'',...(d.test.nota?{nota:d.test.nota}:{}),items:its}:null}
/* panel del día de test dentro de la hoja de la semana */
function tsTestHTML(d,k){const L=protos(),p=(d.test&&d.test.p)||[];
  return `<div class="ts-test"><div class="ts-th"><b>Día de test</b><button class="btn sm" type="button" data-tstoff="${k}">Quitar el test de este día</button></div>
    <ol class="ts-tl">${p.map((id,j)=>{const x=protDe(id);return `<li><span>${x?esc(x.n):'<i>Protocolo borrado</i>'}${x&&protMeta(x)?` <small>${esc(protMeta(x))}</small>`:''}</span><span class="pr-ac"><button class="x-sm" type="button" data-tsmv="${k}:${j}:-1" ${j?'':'disabled'} aria-label="Subir">↑</button><button class="x-sm" type="button" data-tsmv="${k}:${j}:1" ${j<p.length-1?'':'disabled'} aria-label="Bajar">↓</button><button class="x-sm" type="button" data-tsprm="${k}:${j}" aria-label="Quitar">✕</button></span></li>`}).join('')||'<li class="hint">Todavía no elegiste protocolos.</li>'}</ol>
    <div class="ts-tf"><select class="mini" data-tspadd="${k}" aria-label="Agregar protocolo, día ${k+1}"><option value="">+ protocolo</option>${L.filter(x=>!p.includes(x.id)).map(x=>`<option value="${esc(x.id)}">${esc(x.n)}</option>`).join('')}</select>
      <label class="ts-solo"><input type="checkbox" data-tssolo="${k}" ${d.test&&d.test.solo===false?'':'checked'}> Ese día solo test (no se entrega la dosis)</label>
      <input class="ts-nota" data-tsnota="${k}" maxlength="160" value="${esc((d.test&&d.test.nota)||'')}" placeholder="Nota del día (ej: sin pesas desde el sábado)" aria-label="Nota del día de test"></div></div>`}
/* ---------- EQUIPO PRO · importar la planilla completa (MACRO + MICROCICLOS + PESAS + DIAGNÓSTICO) ---------- */
const XL_RUN={'continuo extensivo':'CE','continuo intensivo':'CI','continuo variable i':'CV1','continuo variable ii':'CV2','interv ext c/ i largo':'IE-IL','interv ext c/ i medios':'IE-IM','interv intensivos c/ i cortos':'II-IC','interv intensivos c/ ie cortos':'II-IEC','repeticiones c/ i largos':'Rep-IL','repeticiones c/ i medios':'Rep-IM','repeticiones c/ i cortos':'Rep-IC','repeticiones cortas maximas':'RCM','rsa':'RSA','salidas a estimulos variables':'SEV','velocidad maxima':'FS','velocidad maxima (fs)':'FS'};
const XL_STR={'rep iii':'Rep III','rep ii':'Rep II','rep i':'Rep I','i max':'I Máx','i max 2':'I Máx II','i max ii':'I Máx II','piramide':'Pirámide','contraste':'Contraste','contrastes':'Contraste','concentrico':'Concéntrico','concentrico puro':'Concéntrico','pliometria':'Pliometría','pliometrico':'Pliometría'};
const xlLow=v=>v==null?'':String(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ');
const xlNum=v=>typeof v==='number'?v:(v==null||v==='')?NaN:Number(String(v).replace(',','.').replace(/[^\d.\-]/g,''));
/* pausa: número de Excel (fracción de día), «04:00», «0:02:30» o «SNC FRESC.» → 4' · 2'30" · hasta recuperar */
function xlPausa(v){if(v==null||v==='')return '';let s;
  if(typeof v==='number'){if(!v)return '';s=v<1?Math.round(v*86400):v}
  else{const t=String(v).trim();if(/snc/i.test(t))return 'hasta recuperar';if(/^0([.,]0)?$/.test(t)||/^none$/i.test(t))return '';const p=t.split(':').map(x=>Number(x)||0);if(p.length<2)return t;s=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1]}
  const m=Math.floor(s/60),ss=Math.round(s%60);if(!m&&!ss)return '';return (m?m+"'":'')+(ss?ss+'"':'')}
const xlNumSem=(a,b)=>{const m=/(\d+)/.exec(String(a||''));return m?Number(m[1]):Number(b)||0};
/* MICROCICLOS → {semana: [5 días de carrera/velocidad]} */
function microDesdeAOA(aoa){const out={},DC=[3,14,25,36,47];
  aoa.forEach((row,r)=>{if(!row||!/^microciclo/i.test(String(row[3]||'').trim()))return;const n=xlNumSem(row[3],row[4]);if(!n)return;
    let h=-1;for(let k=r;k<r+6;k++)if(aoa[k]&&xlLow(aoa[k][3])==='metodo'){h=k;break}if(h<0)return;
    let t=-1;for(let k=h+1;k<h+40;k++)if(aoa[k]&&/^v\.? ?total/i.test(String(aoa[k][8]||'').trim())){t=k;break}if(t<0)return;
    out[n]=DC.map(c=>{const it=[];for(let k=h+1;k<t;k++){const x=aoa[k]||[];const m=XL_RUN[xlLow(x[c])],d=xlNum(x[c+3]);if(!m||!isFinite(d))continue;
      it.push({m,s:xlNum(x[c+1])||1,r:xlNum(x[c+2])||1,d,p:xlNum(x[c+4])||0,pr:xlPausa(x[c+7]),ps:xlPausa(x[c+8])})}return it})});
  return out}
/* PESAS → {semana: {díaIndex: [fuerza]}} (martes y jueves en la planilla del TP; el día sale del rótulo «DIA:») */
function pesasDesdeAOA(aoa){const out={},DI={lunes:0,martes:1,miercoles:2,jueves:3,viernes:4};
  aoa.forEach((row,r)=>{if(!row||!/^microciclo/i.test(String(row[1]||'').trim()))return;const n=xlNumSem(row[1],row[2]);if(!n)return;
    let h=-1;for(let k=r;k<r+6;k++)if(aoa[k]&&xlLow(aoa[k][1])==='metodo'){h=k;break}if(h<0)return;
    let t=-1;for(let k=h+1;k<h+30;k++)if(aoa[k]&&xlLow(aoa[k][4])==='total'){t=k;break}if(t<0)return;
    const sem=out[n]=out[n]||{};
    [[1,1],[16,3]].forEach(([c0,def])=>{const lab=xlLow((aoa[r+1]||[])[c0]).replace(/^dia:?\s*/,'');const di=DI[lab]??def;const it=[];
      for(let k=h+1;k<t;k++){const x=aoa[k]||[];const m=XL_STR[xlLow(x[c0])],e=String(x[c0+1]||'').trim(),s=xlNum(x[c0+2]);if(!m||!e||!isFinite(s))continue;
        it.push({m,e,s,r:xlNum(x[c0+3])||1,p:xlNum(x[c0+6])||0,pr:xlPausa(x[c0+7]),ps:xlPausa(x[c0+8])})}
      if(it.length)sem[di]=(sem[di]||[]).concat(it)})});
  return out}
/* DIAGNÓSTICO → test + 1RM */
function diagDesdeAOA(aoa){const d={rm:{}},lab=r=>xlLow(r&&r[1]);let enRM=false;
  aoa.forEach(r=>{if(!r)return;const l=lab(r),v=r[2];
    if(/^movimi/.test(l)){enRM=true;return}if(enRM&&(!l||/^test/.test(l))){enRM=false}
    if(enRM&&typeof r[1]==='string'&&!/^test/.test(l)&&isFinite(xlNum(v))){d.rm[String(r[1]).trim().toUpperCase()]=xlNum(v);return}
    if(l==='vam'){const n=xlNum(v);if(isFinite(n))d.vam=n}else if(/^yo-?yo/.test(l))d.yoyo=String(v||'').trim();
    else if(l==='cmj'){const n=xlNum(v);if(isFinite(n))d.cmj=n}else if(/^abalakov|^abk/.test(l)){const n=xlNum(v);if(isFinite(n))d.abk=n}
    else if(/^peso:/.test(l)){const n=xlNum(l.replace('peso:',''));if(isFinite(n))d.peso=n}
    else if(typeof r[1]==='number'&&isFinite(xlNum(v))&&[10,20,30].includes(r[1]))d['t'+r[1]]=xlNum(v)});
  if(!Object.keys(d.rm).length)delete d.rm;return d}
/* lee todo el libro: devuelve semanas con plan y dosis, más el diagnóstico si está */
async function leerPlanilla(buf){
  const macro=await leerXLSX(buf,/^macro$/i);const W=macroDesdeAOA(macro);
  let mic={},pes={},diag=null,hojas=['MACRO'];
  try{const a=await leerXLSX(buf,/^microciclos?$/i,{estricta:true,sinComb:true});if(a){mic=microDesdeAOA(a);hojas.push('MICROCICLOS')}}catch(_){}
  try{const a=await leerXLSX(buf,/^pesas$/i,{estricta:true,sinComb:true});if(a){pes=pesasDesdeAOA(a);hojas.push('PESAS')}}catch(_){}
  try{const a=await leerXLSX(buf,/^diagn/i,{estricta:true,sinComb:true});if(a){diag=diagDesdeAOA(a);if(!Object.keys(diag).length)diag=null;else hojas.push('DIAGNÓSTICO')}}catch(_){}
  W.forEach((w,i)=>{const n=i+1;w.days.forEach((d,k)=>{d.run=(mic[n]&&mic[n][k])||[];d.str=((pes[n]||{})[k]||[]).map(x=>({...x,e:epMov(x.e)}))})});
  return {W,diag,hojas}}
const xlResumen=x=>{const W=x.W,dos=W.filter(epConDosis).length,ej=W.reduce((a,w)=>a+w.days.reduce((b,d)=>b+d.run.length+d.str.length,0),0);
  return `${tResumen(W)} · ${dos} semanas con dosis (${ej} ejercicios) · hojas leídas: ${x.hojas.join(', ')}`};
/* diferencias entre la temporada actual y lo que trae el Excel (para «Actualizar desde Excel») */
function xlDiff(t,W,mantener){const res={plan:0,dosis:0,nuevas:Math.max(0,W.length-t.semanas.length),quitadas:Math.max(0,t.semanas.length-W.length),mant:0};
  const out=W.map((w,i)=>{const o=t.semanas[i];if(!o)return w;const pl=o.per!==w.per||o.meso!==w.meso||o.tipo!==w.tipo||o.rel!==w.rel||o.comp!==w.comp||!!o.test!==!!w.test||JSON.stringify(o.days.map(d=>[d.q,d.met]))!==JSON.stringify(w.days.map(d=>[d.q,d.met]));
    let nw=w;if(mantener&&!epConDosis(w)&&epConDosis(o)){nw={...w,days:w.days.map((d,k)=>({...d,run:(o.days[k]||{}).run||[],str:(o.days[k]||{}).str||[]}))};res.mant++}
    if(o.days.some(d=>d.test))nw={...nw,days:nw.days.map((d,k)=>o.days[k]&&o.days[k].test?{...d,test:o.days[k].test}:d)};
    const ds=JSON.stringify(o.days.map(d=>[d.run||[],d.str||[]]))!==JSON.stringify(nw.days.map(d=>[d.run||[],d.str||[]]));if(pl)res.plan++;if(ds)res.dosis++;return nw});
  return {out,res}}
function tpSyncHTML(a){const t=(S.temps||[]).find(x=>x._id===a.tid);const q=(S.equipos||[]).find(x=>x._id===t.equipoId)||{};const js=(q.jugadores||[]).map(id=>S.ents[id]).filter(Boolean);
  let prev='';if(a.x){const {res}=xlDiff(t,a.x.W,a.mant!==false);prev=`<div class="tp-sum"><b>${esc(a.arch)}</b><span>${esc(xlResumen(a.x))}</span><span>Cambios: ${plural(res.plan,'semana con cambios de plan','semanas con cambios de plan')} · ${plural(res.dosis,'semana con cambios de dosis','semanas con cambios de dosis')}${res.nuevas?` · ${plural(res.nuevas,'semana nueva','semanas nuevas')}`:''}${res.quitadas?` · se quitan ${plural(res.quitadas,'semana','semanas')}`:''}${res.mant?` · se conservan las dosis de la app en ${plural(res.mant,'semana','semanas')} vacías en el Excel`:''}</span></div>`}
  return `<form id="tsyf" class="pad"><p class="hint">Cargá la versión actualizada del Excel: la temporada toma el plan de la hoja MACRO y las dosis de MICROCICLOS y PESAS. Se mantienen el lunes de inicio, el día de partido y el plantel. Antes de aplicar ves cuántas semanas cambian.</p>
    <div class="tp-xl" style="padding-left:0;margin-top:10px"><label class="btn" style="cursor:pointer">Elegir Excel<input id="tsy-file" type="file" accept=".xlsx" hidden></label>${a.err?`<span class="hint" style="color:var(--bad)">${esc(a.err)}</span>`:''}</div>
    ${prev}
    <label class="av-g" style="margin-top:10px"><input type="checkbox" id="tsy-mant" ${a.mant!==false?'checked':''}> Conservar las dosis cargadas en la app en las semanas que el Excel trae vacías</label>
    ${a.x&&a.x.diag&&js.length?`<label class="av-g" style="margin-top:6px">Cargar el diagnóstico del Excel como test de <select id="tsy-dj"><option value="">(no cargar)</option>${js.map(e=>`<option value="${esc(e.id)}">${esc(name(e))}</option>`).join('')}</select></label>`:''}
    <p class="hint" id="tsy-msg" role="alert"></p>
    <div class="actions" style="margin-top:10px"><span style="flex:1"></span><button class="btn" type="button" data-close>Cancelar</button><button class="btn pri" type="submit" ${a.x?'':'disabled'}>Actualizar temporada</button></div></form>`}
async function cargarDiag(eid,dg,fecha){const e=S.ents[eid];if(!e||!dg)return;const doc={entrenadoId:eid,fecha:fecha||iso(today()),ts:Date.now(),notas:'Importado del Excel (Diagnóstico)'};
  ['vam','cmj','abk','t10','t20','t30','peso','yoyo'].forEach(k=>{if(dg[k]!=null&&dg[k]!=='')doc[k]=dg[k]});
  if(dg.rm){doc.rm={};Object.entries(dg.rm).forEach(([k,v])=>doc.rm[epMov(k)]=v)}
  if(await write(()=>S.db.collection('tests').add(doc))){if(doc.rm)await write(()=>S.db.collection('entrenados').doc(eid).update({rm:{...(e.rm||{}),...doc.rm}}));await addHist(eid,'Evaluación física','Diagnóstico importado del Excel'+(doc.vam?' · VAM '+nfx(doc.vam,2)+' m/s':''),doc.fecha)}}
function bindTpSync(a){const ov=$('#overlay');
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};
  ov.onchange=async ev=>{if(ev.target.id==='tsy-mant'){a.mant=ev.target.checked;renderSheet();return}
    if(ev.target.id==='tsy-file'){const f=ev.target.files[0];if(!f)return;a.arch=f.name;a.x=null;a.err='';try{a.x=await leerPlanilla(await f.arrayBuffer())}catch(x){a.err=x.message||'No pude leer el Excel.'}renderSheet()}};
  $('#tsyf').onsubmit=async ev=>{ev.preventDefault();if(!a.x)return;const t=(S.temps||[]).find(x=>x._id===a.tid);const {out}=xlDiff(t,a.x.W,a.mant!==false);const {_id,...doc}=t;
    const dj=$('#tsy-dj')?.value;
    if(await write(()=>S.db.collection('temporadas').doc(a.tid).set({...doc,semanas:tAjustar({...doc,semanas:out}),origen:'Excel: '+a.arch,actualizado:iso(today())}))){if(dj)await cargarDiag(dj,a.x.diag);toast('Temporada actualizada desde el Excel');closeSheet()}}}
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-tpsync]');if(b){openSheet('__tpsync','ver',{tid:b.dataset.tpsync})}});
/* ---------- GUÍA DEL ENTRENADOR (dentro de la app) ---------- */
/* Secciones desplegables con buscador. Las tablas de referencia (métodos, fórmulas, umbrales) se arman con los datos reales de la app. */
const G_TIPOS=[['INTRODUCTORIO','Introductorio','Arranque o vuelta: carga baja para adaptar.'],['CARGA','Carga','Acumula volumen e intensidad de forma progresiva.'],['CHOQUE','Choque','La semana más exigente del mesociclo. Ideal en fechas libres.'],['REGENERATIVO','Regenerativo','Baja la carga para recuperar y que aparezca la adaptación.'],['TRANSICION','Transición','Receso o fin de torneo: mantener sin cargar.']];
function guiaSecciones(){
  const acwrMax=nfx(S.cfg.alertas?.acwr??1.5,1),red=nfx(S.cfg.redondeo||2.5,1);
  const lib=q=>Object.entries(EP_LIB).filter(([,L])=>L.q===q).map(([k,L])=>`<tr><td><b>${esc(k)}</b></td><td>${esc(L.n)}</td><td>${esc(L.o)}</td><td>${esc(L.rg)}</td><td>${L.b==='vam'?'% VAM':L.b==='sprint'?'% del test de sprint':L.b==='rm'?'% 1RM':'—'}</td><td class="g-ref">${esc(citas(EP_REF[k]))||'—'}</td></tr>`).join('');
  const libT=(q,t)=>`<h4>${t}</h4><div class="tbl-wrap"><table class="eq-t g-t"><thead><tr><th>Abrev.</th><th>Método</th><th>Objetivo</th><th>Dosis orientativa</th><th>Se calcula con</th><th>Fuente</th></tr></thead><tbody>${lib(q)}</tbody></table></div>`;
  return [
  {id:'inicio',t:'Recorrido rápido de Equipo Pro',h:`
    <p>Equipo Pro planifica la temporada de un equipo y le entrega a cada jugador sus tiempos y kilos calculados con sus propios tests. El orden de uso es este:</p>
    <ol class="g-pasos">
      <li><b>Equipo.</b> En Equipos → <b>Nuevo equipo</b>: nombre y jugadores (tienen que existir como entrenados).</li>
      <li><b>Tests.</b> <b>Cargar tests del plantel</b> (todos juntos) o <b>Test</b> en la fila de un jugador. Sin VAM no hay tiempos de carrera; sin sprint, no hay tiempos de velocidad; sin 1RM, no hay kilos.</li>
      <li><b>Temporada.</b> <b>Crear temporada</b>: lunes de la semana 1, día de partido y punto de partida (plantilla promedio de handball, tu Excel o en blanco).</li>
      <li><b>Semanas.</b> Tocás una barra del tablero y ajustás tipo, competencia, métodos y la dosis de cada día.</li>
      <li><b>Entrega.</b> <b>Entregar al plantel</b>: elegís semanas y jugadores. Cada uno lo ve en su link de siempre.</li>
      <li><b>Control.</b> Mirás <b>Control de carga</b> para comparar lo planificado con lo que anotó cada jugador.</li>
    </ol>
    <p class="hint">Rutina semanal sugerida: el domingo o lunes revisás la semana y sus avisos; si cambió algo, volvés a entregar. En semanas de test cargás los tests y volvés a entregar las semanas que siguen.</p>`},
  {id:'equipos',t:'Equipos y plantel',h:`
    <ul><li><b>Crear y editar:</b> nombre, deporte, categoría y jugadores. Un entrenado puede estar en más de un equipo.</li>
    <li><b>Posición:</b> se carga en la ficha del jugador (Editar → Posición) y aparece sola en el plantel.</li>
    <li><b>Tabla del plantel:</b> último test, VAM, saltos, sprint y los 1RM principales. La etiqueta <span class="pill p-warn">8 sem</span> avisa que el último test tiene 8 semanas o más.</li>
    <li><b>Promedios del equipo:</b> VAM, 30 m y CMJ medios, y cuántos jugadores no tienen test o lo tienen vencido.</li>
    <li><b>Borrar un equipo</b> no borra a los jugadores ni sus tests: solo el agrupamiento.</li></ul>`},
  {id:'tests',t:'Tests físicos',h:`
    <div class="tbl-wrap"><table class="eq-t g-t"><thead><tr><th>Test</th><th>Unidad</th><th>Rango aceptado</th><th>Para qué se usa</th><th>Fuente</th></tr></thead><tbody>
      ${TCAMPOS.map(c=>`<tr><td><b>${c.l}</b></td><td>${c.u}</td><td>${c.min} a ${c.max}</td><td>${{vam:'Ritmos de toda la resistencia (% VAM).',cmj:'Control de fuerza explosiva vertical.',abk:'CMJ con brazos: coordinación y potencia.',t10:'Aceleración y base de los sprints cortos.',t20:'Interpolación de sprints entre 10 y 30 m.',t30:'Velocidad: RSA, salidas y sprints largos.',peso:'Seguimiento del jugador.'}[c.k]||''}</td><td class="g-ref">${esc(citas(T_REF[c.k]))||'—'}</td></tr>`).join('')}
      <tr><td><b>Yo-Yo IR1</b></td><td>nivel</td><td>texto (ej. 15:1)</td><td>Registro de la capacidad intermitente.</td><td class="g-ref">${esc(citas(T_REF.yoyo))}</td></tr>
      <tr><td><b>1RM</b></td><td>kg</td><td>por ejercicio</td><td>Kilos de todos los ejercicios con % de 1RM (redondeo ${red} kg).</td><td class="g-ref">${esc(citas(T_REF.rm))}</td></tr></tbody></table></div>
    <ul><li><b>Lote:</b> «Cargar tests del plantel» guarda un test por jugador con al menos un valor. Lo vacío no se guarda.</li>
    <li><b>Controles:</b> valores fuera de rango y tiempos que no crecen de 10 a 30 m no se guardan.</li>
    <li><b>Historial:</b> en la ficha, «Tests físicos» muestra los últimos valores con ▲▼ contra el test anterior (en sprint, bajar el tiempo es mejorar) y cada test se puede editar o borrar.</li>
    <li><b>1RM en un test:</b> si cargás marcas, se actualizan las de la ficha y todas las rutinas con % recalculan los kilos.</li></ul>`},
  {id:'protocolos',t:'Protocolos de test y día de test',h:`
    <p>Cada test tiene un protocolo que armás vos: el jugador lo ve paso a paso en su link el día de test, con su marca anterior al lado.</p>
    <ol class="g-pasos">
      <li><b>Armar los protocolos.</b> Equipos → <b>Protocolos de test</b>. Cada uno tiene nombre, qué se registra, intentos, pausa, material, <b>su propia entrada en calor</b>, el <b>protocolo de evaluación</b>, cuándo no vale el intento y una nota. Así cada test sirve solo o combinado con otros. Abajo ves cómo lo va a ver el jugador mientras escribís. Vienen ${PROT_DEF.length} ejemplos para editar, duplicar o borrar.</li>
      <li><b>Marcar la semana de test.</b> En la hoja de la semana tildás <b>Semana de test</b>.</li>
      <li><b>Elegir los días.</b> En cada día tocás <b>+ Test</b> y sumás protocolos en el orden en que se hacen (con ↑ ↓). <b>Usar el orden sugerido</b> arma lunes, miércoles y viernes de una vez. La nota del día le llega al jugador arriba de todo.</li>
      <li><b>Entregar.</b> Al entregar el plan, ese día abre con el bloque TEST. Con <b>Ese día solo test</b> tildado (viene así) no se entrega la dosis de ese día; si lo destildás, la dosis va después del test.</li>
      <li><b>Para un entrenado individual.</b> En el editor de su rutina, en el día que quieras, tocá <b>+ Test</b>, marcá los tests y <b>Agregar al día</b>. La marca anterior sale de sus tests cargados en la ficha.</li>
      <li><b>Cargar los resultados.</b> Los cargás vos con <b>Cargar tests del plantel</b>. En la entrega siguiente la marca anterior ya es la nueva.</li>
    </ol>
    <h4>Orden sugerido de la semana</h4>
    <ul><li><b>Lunes:</b> entrada en calor, peso, CMJ, Abalakov, sprint y Prueba T. Lo explosivo se mide descansado, de lo que menos cansa a lo que más.</li>
    <li><b>Miércoles:</b> entrada en calor y 1RM, lejos del sprint.</li>
    <li><b>Viernes:</b> entrada en calor y VAM o Yo-Yo, que es lo que más agota.</li></ul>
    <p class="hint">Para que dos tests se puedan comparar: misma hora, misma superficie, mismo calzado, misma entrada en calor y sin entrenamiento pesado las 48 horas previas. El protocolo se copia en el plan al entregarlo: si después lo cambiás, volvé a entregar esa semana para que el jugador vea la versión nueva.</p>`},
  {id:'temporada',t:'Temporada (macrociclo)',h:`
    <ul><li><b>Crear:</b> lunes de la semana 1 (tiene que ser lunes), día de partido y punto de partida:
      <ul><li><b>Plantilla temporada promedio handball:</b> 42 semanas, 2 torneos de 15 fechas, con la dosis de las primeras 13 semanas.</li><li><b>Importar desde un Excel:</b> ver «Planilla Excel».</li><li><b>En blanco:</b> la cantidad de semanas que elijas.</li></ul></li>
    <li><b>Tablero:</b> período, mes (sale de las fechas), mesociclo, una barra por semana y la competencia. El color es el tipo de semana y la altura, el nivel de carga. La semana actual se resalta.</li>
    <li><b>Editar tabla:</b> todas las semanas juntas; agregar o quitar semanas al final.</li>
    <li><b>Ajustes:</b> nombre, inicio (todas las semanas se corren con él), día de partido, actualizar desde Excel y borrar.</li></ul>
    <h4>Tipos de semana</h4><div class="g-tipos">${G_TIPOS.map(([k,n,d])=>`<div class="t-${k}"><i class="sw"></i><b>${n}</b><span>${d}</span></div>`).join('')}</div>
    <h4>Relación de carga</h4><p>Reparte las 5 sesiones entre carga alta y baja: <b>1:4</b> (muy suave), <b>2:3</b>, <b>3:2</b>, <b>4:1</b> (muy exigente). Es la altura de la barra. Siempre suma 5.</p>
    <h4>Competencia</h4><p>Escribí <b>FECHA 3</b>, <b>LIBRE</b>, <b>PRETEMPORADA</b>, <b>RECESO</b> o <b>FIN DEL TORNEO</b>. Las fechas cuentan para «próxima fecha» y los totales.</p>
    <p class="g-ref">Base teórica: períodos, mesociclos y microciclos según ${citas(['matveev1977','bompa2009'])}.</p>`},
  {id:'excel',t:'Planilla Excel (importar y actualizar)',h:`
    <p>La app lee el mismo formato de la planilla del TP. Busca las hojas por nombre:</p>
    <div class="tbl-wrap"><table class="eq-t g-t"><thead><tr><th>Hoja</th><th>Qué lee</th><th>Cómo la reconoce</th></tr></thead><tbody>
      <tr><td><b>MACRO</b></td><td>Período, mes, mesociclo, tipo, relación, competencia, test, cualidades y métodos de cada día</td><td>Filas «N° Microciclo», «Tipo Microciclo», «Competencia», «Periodo», «Mesociclos»; una «x» por día en cada método</td></tr>
      <tr><td><b>MICROCICLOS</b></td><td>Carrera y velocidad: método, series, reps, distancia, %, pausas</td><td>Bloques «MICROCICLO: n» con encabezado «METODO» y fila «V. total»; 5 días por bloque</td></tr>
      <tr><td><b>PESAS</b></td><td>Fuerza: método, ejercicio, series, reps, %, pausas</td><td>Bloques «MICROCICLO: n» con «Metodo» y «Total»; el día sale del rótulo «DIA:»</td></tr>
      <tr><td><b>DIAGNÓSTICO</b></td><td>VAM, Yo-Yo, CMJ, Abalakov, peso, sprint 10/20/30 m y 1RM</td><td>Rótulos de la columna B; los 1RM debajo de «MOVIMIENTO»</td></tr></tbody></table></div>
    <ul><li><b>Celdas combinadas</b> (por ejemplo «PRETEMPORADA» en 6 semanas) se copian a todas las semanas del rango.</li>
    <li><b>Ejercicios:</b> se asocian a tus marcas por nombre (Press banco plano → Banco plano, Cargada → Clean, etc.). Si no hay coincidencia, el kilo queda «sin 1RM».</li>
    <li><b>Actualizar desde Excel</b> (Ajustes de la temporada): muestra cuántas semanas cambian en plan y dosis antes de aplicar. No toca el inicio, el partido ni el plantel. Con la casilla marcada, conserva las dosis armadas en la app para las semanas que en el Excel están vacías.</li>
    <li><b>Diagnóstico:</b> al importar podés cargarlo como test de un jugador del equipo.</li></ul>`},
  {id:'semana',t:'Semanas y dosis',h:`
    <ul><li><b>Calcular para:</b> elegís un jugador del plantel y la tabla muestra sus tiempos y kilos. Si le falta un test, lo marca.</li>
    <li><b>Cualidades del día:</b> Resistencia, Fuerza y Velocidad. Si un método no coincide con las cualidades marcadas, avisa.</li>
    <li><b>Métodos planificados:</b> las etiquetas del día (de la hoja MACRO). <b>Completar desde el plan</b> trae la dosis base de cada método sin dosis.</li>
    <li><b>Dosis de carrera y velocidad:</b> series × reps × metros al %, pausa entre reps y entre series. Tiempo por tramo (o total y ritmo por km en los continuos) y volumen.</li>
    <li><b>Dosis de fuerza:</b> ejercicio (tus marcas RM), series × reps al % de 1RM, pausa. Kilos y tonelaje.</li>
    <li><b>Generador:</b> copia la dosis de otra semana con ± puntos de intensidad y ± % de volumen (en continuos cambia los metros; en el resto, las repeticiones).</li>
    <li><b>Flechas ‹ ›:</b> pasan de semana y guardan lo que cambiaste.</li></ul>
    <h4>Avisos</h4><ul>
      <li><span class="pill p-warn">Volumen</span> los metros suben más de 25 % contra la semana anterior con dosis.</li>
      <li><span class="pill p-warn">Choque flojo</span> semana de choque con intensidad media menor que la anterior.</li>
      <li><span class="pill p-warn">Regenerativa</span> con más metros que la semana anterior.</li>
      <li><span class="pill p-bad">Porcentaje</span> más de 120 % de VAM, más de 100 % del sprint o más de 100 % de 1RM.</li>
      <li><span class="pill p-warn">Plan y dosis</span> método planificado sin dosis, o dosis de un método que no estaba planificado.</li></ul>
    <h4>Gráficos de la temporada</h4><p>Debajo del tablero: metros por semana con la intensidad media (% VAM), y repeticiones de fuerza con el % medio de 1RM. No dependen del jugador.</p>`},
  {id:'entrega',t:'Entregar al plantel y lo que ve el jugador',h:`
    <ul><li><b>Semanas:</b> por defecto, el mesociclo actual. Podés elegir cualquier rango.</li>
    <li><b>Jugadores:</b> todos tildados. Los que no tienen VAM se marcan: sus tiempos llegan vacíos con una nota.</li>
    <li><b>Si ya tiene su rutina:</b> <b>Sumar</b> (ve las dos y elige arriba «Mi rutina personal» o «Plan del equipo») o <b>Reemplazar</b> (su rutina pasa a finalizada y queda en el historial).</li>
    <li><b>Re-entregar:</b> el plan anterior del mismo equipo se cierra solo. Volvé a entregar si cambiaste un test de VAM o sprint, una fórmula o una dosis: <b>los tiempos quedan fijos al entregar</b>. Los kilos se recalculan solos con el 1RM.</li>
    <li><b>Opciones:</b> pedir minutos y esfuerzo al terminar cada sesión (control de carga) y el bienestar antes de entrenar.</li></ul>
    <h4>En el link del jugador</h4><ul>
      <li>Ve la semana que corresponde por fecha y se le abre el día de hoy.</li>
      <li>Carrera y sprint: tramos con su tiempo objetivo, ritmo por km, pausas y temporizador. Fuerza: reps × kilos calculados con su marca.</li>
      <li>Fila <b>«Antes»</b>: lo planificado y lo que anotó en las semanas anteriores para ese mismo ejercicio y día, con ▲▼ contra hoy.</li>
      <li>Tilda lo hecho, anota kilos reales y, al terminar, minutos y esfuerzo.</li></ul>
    <p><b>PDF del plantel</b> descarga en un .zip el PDF de cada jugador con su plan.</p>`},
  {id:'control',t:'Control de carga',h:`
    <ul><li><b>Carga real</b> = minutos de la sesión × esfuerzo de 1 a 10 (RPE) que anota el jugador. Se suma por semana.</li>
    <li><b>Fila Plan:</b> tipo, relación y metros planificados de cada una de las últimas 6 semanas.</li>
    <li><b>Colores por jugador:</b> <span class="ep-real hi">rojo</span> más de 30 % sobre su promedio; <span class="ep-real lo">naranja</span> más de 30 % por debajo.</li>
    <li><b>Aguda/crónica</b> (últimos 7 días contra el promedio semanal de los últimos 28; necesita 3 semanas de registros): <span class="pill p-ok">0,8 a 1,3</span> bien · <span class="pill p-warn">fuera de ese rango</span> atención · <span class="pill p-bad">más de ${acwrMax}</span> riesgo (se cambia en Ajustes → alertas).</li>
    <li><b>Avisos del equipo:</b> si el plan sube y la carga real del equipo baja más de 15 %, o al revés.</li></ul>
    <p class="g-ref">Base teórica: carga real por RPE de la sesión, ${citas(['foster2001'])}; relación aguda/crónica, ${citas(['hulin2014','gabbett2016'])}. Los umbrales de 0,8 a 1,3 son orientativos y la propia literatura los discute: usalos como alerta, no como regla.</p>`},
  {id:'formulas',t:'Fórmulas y doble verificación',h:`
    <div class="tbl-wrap"><table class="eq-t g-t"><thead><tr><th>Cálculo</th><th>Fórmula en uso</th><th>Para qué</th><th>Base teórica</th></tr></thead><tbody>
      ${Object.entries(EP_FDEF).map(([k,d])=>`<tr><td><b>${esc(d.n)}</b></td><td><code class="ep-code">${esc(epExpr(k))}</code>${epExpr(k)!==d.expr?' <span class="pill p-warn">modificada</span>':''}</td><td>${esc(d.w)}</td><td class="g-ref">${esc(citas(EP_FREF[k]))||'Adaptación de la app'}</td></tr>`).join('')}
      <tr><td><b>Kilos</b></td><td><code class="ep-code">1RM × % ÷ 100, redondeado a ${red} kg</code></td><td>Igual en toda la app. El redondeo se cambia en Ajustes.</td><td class="g-ref">${esc(citas(EP_FREF.kg))}</td></tr>
      <tr><td><b>Intensidad media</b></td><td><code class="ep-code">Σ(metros × %) ÷ Σ metros</code></td><td>Pesa más lo que más metros tiene.</td><td class="g-ref">${esc(citas(EP_FREF.vol))}</td></tr>
      <tr><td><b>IMR (fuerza)</b></td><td><code class="ep-code">Σ(tonelaje × %) ÷ Σ tonelaje</code></td><td>Intensidad media relativa de la semana de fuerza.</td><td class="g-ref">${esc(citas(EP_FREF.imr))}</td></tr></tbody></table></div>
    <ul><li><b>Sprint:</b> entre 0 y 30 m se interpola con los tiempos de 10, 20 y 30 m; más allá de 30 m se extiende en proporción.</li>
    <li><b>Editar</b> (botón Fórmulas, arriba en Equipos): 1) escribís la fórmula; 2) la app la prueba contra casos con resultado conocido y cuenta cuántas filas cambian; 3) confirmás con un motivo. Si falló un control, además tenés que aceptarlo.</li>
    <li><b>Historial:</b> cada cambio queda con fecha, antes, después y motivo. Siempre se puede volver a la original.</li>
    <li><b>Seguridad:</b> solo números, variables, + − × ÷ ^ y round, min, max, abs, floor, ceil, sqrt. No se puede escribir código.</li></ul>`},
  {id:'referencias',t:'Referencias y glosario',h:`
    <dl class="g-dl">
      <dt>VAM</dt><dd>Velocidad aeróbica máxima (m/s). El % de VAM individualiza el ritmo: misma consigna, distinto tiempo. <span class="g-ref">(${citas(['leger1980', 'billat2001'])})</span></dd>
      <dt>1RM</dt><dd>Máximo peso para una repetición. El % de 1RM da los kilos de cada jugador. <span class="g-ref">(${citas(['gb2002'])})</span></dd>
      <dt>Intensidad media</dt><dd>Promedio del % ponderado por metros (carrera) o repeticiones (fuerza).</dd>
      <dt>IMR</dt><dd>Intensidad media relativa de la fuerza, ponderada por tonelaje. <span class="g-ref">(${citas(['gb1995'])})</span></dd>
      <dt>Tonelaje</dt><dd>Series × reps × kilos.</dd>
      <dt>Mesociclo</dt><dd>Bloque de 3 a 6 semanas, casi siempre en ola regenerativo → carga → carga → choque. <span class="g-ref">(${citas(['matveev1977', 'bompa2009'])})</span></dd>
      <dt>Microciclo</dt><dd>Una semana: 5 sesiones de lunes a viernes.</dd>
      <dt>RPE</dt><dd>Esfuerzo percibido de 1 a 10 al terminar la sesión. <span class="g-ref">(${citas(['foster2001'])})</span></dd>
      <dt>Aguda/crónica</dt><dd>Carga de los últimos 7 días contra el promedio semanal de los últimos 28 días. <span class="g-ref">(${citas(['hulin2014', 'gabbett2016'])})</span></dd></dl>
    ${libT('R','Métodos de resistencia')}${libT('V','Métodos de velocidad')}${libT('F','Métodos de fuerza')}
    <p class="hint">La clasificación de métodos sigue a los autores de la columna Fuente; cada cátedra puede usar otra nomenclatura. La lista completa está en <b>Bibliografía</b>.</p>`},
  {id:'bibliografia',t:'Bibliografía (APA 7)',h:biblioHTML()},
  {id:'app',t:'El resto de la app (resumen)',h:`
    <ul><li><b>Panel:</b> pestañas Hoy (lo que hay que atender) y Finanzas (cobros y reparto).</li>
    <li><b>Entrenados:</b> lista con filtros; la ficha tiene datos, rutinas, tests, marcas, carga, bienestar e historial.</li>
    <li><b>Calendario:</b> entrenamientos, entregas y vencimientos de rutinas, pagos y eventos.</li>
    <li><b>Rutinas:</b> plantillas, entregas y listado; armado de rutinas individuales.</li>
    <li><b>Equipos:</b> todo lo de esta guía.</li>
    <li><b>Ajustes:</b> URL de la app, posiciones, bloques, redondeo de kilos, marcas RM y umbrales de alertas.</li></ul>`},
  {id:'faq',t:'Preguntas frecuentes',h:`
    <dl class="g-dl">
      <dt>El jugador ve tiempos vacíos.</dt><dd>No tenía VAM o test de sprint al entregar. Cargá el test y volvé a entregar esas semanas.</dd>
      <dt>Cambié la VAM y el link sigue igual.</dt><dd>Los tiempos se fijan al entregar: volvé a entregar. Los kilos sí se actualizan solos.</dd>
      <dt>Un ejercicio dice «sin 1RM».</dt><dd>El ejercicio no coincide con una marca del jugador. Cargá el 1RM en su ficha o elegí otro ejercicio en la dosis.</dd>
      <dt>¿Se borra la rutina del jugador al entregar?</dt><dd>Solo si elegís «Reemplazar». Con «Sumar» ve las dos.</dd>
      <dt>Actualicé el Excel, ¿pierdo lo que hice en la app?</dt><dd>Lo que cambió en el Excel se aplica. Con la casilla marcada, las dosis de semanas vacías en el Excel se conservan. Antes de aplicar ves el resumen de cambios.</dd>
      <dt>¿Cómo arranco una temporada nueva?</dt><dd>Creá otra temporada para el equipo (por ejemplo «2027»): la app muestra siempre la más reciente.</dd></dl>`}
  ]}
function guiaHTML(a){const q=(a.q||'').trim().toLowerCase(),secs=guiaSecciones();const txt=h=>h.replace(/<[^>]+>/g,' ').toLowerCase();
  const vis=secs.filter(s=>!q||s.t.toLowerCase().includes(q)||txt(s.h).includes(q));
  return `<div class="pad guia"><div class="g-top"><input id="g-q" type="search" placeholder="Buscar en la guía (ej: VAM, Excel, reemplazar)" value="${esc(a.q||'')}" autocomplete="off" aria-label="Buscar en la guía"></div>
    <nav class="g-toc" aria-label="Secciones">${secs.map(s=>`<button type="button" data-gsec="${s.id}" class="${vis.includes(s)?'':'off'}">${esc(s.t)}</button>`).join('')}</nav>
    ${vis.length?vis.map(s=>`<details class="card g-sec" id="g-${s.id}" ${q||a.sec===s.id||(!a.sec&&s.id==='inicio')?'open':''}><summary>${esc(s.t)}</summary><div class="g-b">${s.h}</div></details>`).join(''):'<p class="hint">No hay nada con esa palabra. Probá con otra.</p>'}</div>`}
function bindGuia(a){const ov=$('#overlay');
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]')){closeSheet();return}
    const b=ev.target.closest('[data-gsec]');if(b){a.sec=b.dataset.gsec;a.q='';renderSheet();requestAnimationFrame(()=>{const d=document.getElementById('g-'+a.sec);if(d){d.open=true;d.scrollIntoView({block:'start'})}})}};
  ov.oninput=ev=>{if(ev.target.id==='g-q'){a.q=ev.target.value;a.sec=null;renderSheet()}}}
document.addEventListener('click',ev=>{const b=ev.target.closest&&ev.target.closest('[data-guia]');if(!b)return;const um=document.getElementById('umenu');if(um&&um.hidePopover)try{um.hidePopover()}catch(_){}openSheet('__guia','ver',{sec:b.dataset.guia||'inicio'})});
(()=>{let y0=scrollY,raf=0;addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const y=scrollY,f=$('#fab');if(!f)return;
  const nearEnd=innerHeight+y>=document.documentElement.scrollHeight-140;f.classList.toggle('min',y>80&&(y>y0||nearEnd));f.classList.toggle('lift',nearEnd);y0=y})},{passive:true})})();
/* Esc lo maneja el <dialog> nativo */
show(location.hash.slice(1)||'panel');

/* ---------- datos ---------- */
(async()=>{
  const db=await window.DBReady;
  S.db=db;
  const got={e:false,h:false,p:false,m:false,r:false,j:false,t:false,g:false};
  const done=()=>{if(Object.values(got).every(Boolean)){S.loaded=true;window.splashOff&&window.splashOff()}if(S.loaded)pedirRender();else render()};
  const onErr=()=>banner('Se perdió la conexión con la base de datos. Recargá la página.');
  db.collection('entrenados').onSnapshot(s=>{const m={};s.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id}});S.ents=m;got.e=true;done()},onErr);
  db.collection('historial').onSnapshot(s=>{S.hist=s.docs.map(d=>({...d.data(),_id:d.id}));got.h=true;done()},onErr);
  db.collection('pagos').onSnapshot(s=>{S.pagos=s.docs.map(d=>({...d.data(),_id:d.id}));got.p=true;done()},onErr);
  db.collection('meses').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.meses=m;got.m=true;done()},onErr);
  db.collection('rutinas').onSnapshot(s=>{S.rutinas=s.docs.map(d=>({...d.data(),_id:d.id}));got.r=true;done()},onErr);
  db.collection('ejercicios').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.ejs=m;S.ejsV++;got.j=true;done()},onErr);
  db.collection('plantillas').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.plantillas=m;got.t=true;done()},onErr);
  db.collection('equipos').onSnapshot(s=>{S.equipos=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('temporadas').onSnapshot(s=>{S.temps=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('tests').onSnapshot(s=>{S.tests=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('eventos').onSnapshot(s=>{S.evs=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('liquidaciones').onSnapshot(s=>{S.liqs=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('rendiciones').onSnapshot(s=>{S.rends=s.docs.map(d=>({...d.data(),_id:d.id}));pedirRender()},()=>{});
  db.collection('registros').onSnapshot(s=>{S.regs=s.docs.map(d=>({...d.data(),_id:d.id}));got.g=true;done()},onErr);
  db.doc('config/general').onSnapshot(s=>{S.cfgRaw=s.exists?s.data():{};S.cfg=normCfg(s.exists?s.data():null);pedirRender()},onErr);
})();
document.addEventListener('change',async ev=>{const sel=ev.target.closest&&ev.target.closest('[data-avpago]');if(!sel)return;const id=sel.dataset.avpago,v=sel.value;
  if(await write(()=>S.db.collection('entrenados').doc(id).update({avisoPago:v}))){if(S.ents[id])S.ents[id].avisoPago=v;toast(v==='no'?'No verá avisos de cuota':v==='si'?'Verá los avisos de cuota':'Avisos según su gimnasio')}});
})();
