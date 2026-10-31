(function(){
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GYMS=['LEVEL','CROSSFORCE','ONLINE'];
const GYM_LBL={LEVEL:'LEVEL',CROSSFORCE:'CrossForce',ONLINE:'Online'};
const GYM_VAR={LEVEL:'--accent',CROSSFORCE:'--cf',ONLINE:'--online'};
const DEF_CFG={online:40000,gyms:{
  LEVEL:{pctFran:0.7,tarifas:{"1":51000,"2":60000,"3":69000,"4":75000,"5":89000}},
  CROSSFORCE:{pctFran:0.6,tarifas:{"1":55000,"2":62000,"3":70000,"4":77000,"5":84000}}}};
function normCfg(raw){
  const c=JSON.parse(JSON.stringify(DEF_CFG));
  if(!raw){c.rmDefs=[];c.redondeo=2.5;c.posiciones=['Extremo','Pivote','Armador','Arquero'];c.bloques=['ZONA MEDIA','FUERZA 1','FUERZA 2','FUERZA 3','PLAYITA'];c.appUrl='';return c}
  if(raw.online!=null)c.online=Number(raw.online)||0;
  if(raw.gyms){for(const g of ['LEVEL','CROSSFORCE'])if(raw.gyms[g])c.gyms[g]={...c.gyms[g],...raw.gyms[g]}}
  else{if(raw.tarifas)c.gyms.LEVEL.tarifas=raw.tarifas;if(raw.pctFran!=null)c.gyms.LEVEL.pctFran=raw.pctFran}
  c.rmDefs=Array.isArray(raw.rmDefs)?raw.rmDefs:[];c.redondeo=Number(raw.redondeo)||2.5;
  c.posiciones=Array.isArray(raw.posiciones)?raw.posiciones:['Extremo','Pivote','Armador','Arquero'];
  c.bloques=Array.isArray(raw.bloques)?raw.bloques:['ZONA MEDIA','FUERZA 1','FUERZA 2','FUERZA 3','PLAYITA'];
  c.appUrl=raw.appUrl||'';
  return c;
}
const S={ents:{},hist:[],pagos:[],meses:{},rutinas:[],ejs:{},ejsV:0,plantillas:{},regs:[],cfgRaw:{},mes:null,cfg:normCfg(),db:null,loaded:false,view:'panel',filter:'activos',q:''};
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
function monto(e){
  const g=gymOf(e);
  if(g==='ONLINE')return Number(S.cfg.online)||0;
  const base=Number(S.cfg.gyms[g].tarifas[String(e.estimulos)])||0;
  return Math.round(base*(1-(Number(e.promo)||0)));
}
function estadoPago(e){
  if(!isAct(e))return'—';
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
const TEMPLATES=[['pago','Recordatorio de vencimiento'],['vencido','Cuota pendiente'],['rutina','Rutina nueva'],['link','Link personal'],['vuelta','Invitar a volver'],['libre','Mensaje libre']];
function waText(e,kind){
  const n=firstName(e),m=money(monto(e)),v=fmtD(e.proxVenc);
  if(kind==='pago')return `Hola ${n}! Te recuerdo que tu cuota de ${m} vence el ${v}. Podés abonarla por transferencia o en el gimnasio. ¡Gracias!`;
  if(kind==='vencido')return `Hola ${n}, ¿cómo estás? Te escribo porque la cuota de ${m} figura pendiente${e.proxVenc?` (vencimiento ${v})`:''}. Avisame cuando puedas abonarla. ¡Gracias!`;
  if(kind==='rutina'){const u=portalUrl(e);return `Hola ${n}! Ya está lista tu rutina nueva 💪${u?`\nLa ves acá, con los videos y para anotar tus kg: ${u}`:''}`}
  if(kind==='link'){const u=portalUrl(e);return `Hola ${n}! Este es tu link personal para ver tu rutina con los videos y anotar los kg que vas usando: ${u||'(todavía sin link)'}\nGuardalo en favoritos 😉`}
  if(kind==='vuelta')return `Hola ${n}! ¿Cómo andás? Quería saber si tenés ganas de retomar los entrenamientos. Tengo lugar en los horarios de siempre, avisame y lo coordinamos.`;
  return `Hola ${n}! `;
}
const waUrl=(e,text)=>'https://api.whatsapp.com/send?phone='+phoneDigits(e)+'&text='+encodeURIComponent(text);
const waKind=e=>{if(!isAct(e))return'vuelta';const p=estadoPago(e);return p==='Vencido'||p==='Pendiente'?'vencido':'pago'};
const msgBtn=(e,kind,label)=>`<button class="wa" data-msg="${esc(e.id)}" data-kind="${kind}">${WA}${esc(label||'Avisar')}</button>`;

/* ---------- UI helpers ---------- */
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}
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
const liveRoster=()=>Object.values(S.ents).filter(isAct).map(e=>({id:e.id,nombre:e.nombre,gym:gymOf(e),monto:monto(e),pct:pctFran(gymOf(e))}));
function mesesList(){
  const s=new Set([curMes()]);
  Object.keys(S.meses).forEach(k=>s.add(k));
  S.pagos.forEach(p=>p.mes&&s.add(p.mes));
  return [...s].sort();
}
function monthData(M){
  const doc=S.meses[M];
  const roster=doc&&doc.plantel?doc.plantel:liveRoster();
  const pagos=S.pagos.filter(p=>p.mes===M);
  const paid=new Set(pagos.map(p=>p.entrenadoId));
  const G={};GYMS.forEach(g=>G[g]={n:0,f:0,c:0,p:0,ff:0,fc:0,fp:0});
  roster.forEach(r=>{const g=G[r.gym]||G.LEVEL;g.n++;g.f+=r.monto;g.ff+=r.monto*r.pct;if(!paid.has(r.id)){g.p+=r.monto;g.fp+=r.monto*r.pct}});
  pagos.forEach(p=>{const g=G[p.gym]||G.LEVEL;g.c+=Number(p.monto)||0;g.fc+=(Number(p.monto)||0)*(p.pctFran??1)});
  const T={n:0,f:0,c:0,p:0,ff:0,fc:0,fp:0};GYMS.forEach(g=>Object.keys(T).forEach(k=>T[k]+=G[g][k]));
  const pend=roster.filter(r=>!paid.has(r.id));
  return {M,roster,pagos,paid,G,T,pend,cerrado:!!(doc&&doc.cerrado)};
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
  const M=S.mes,isCur=M===curMes(),D=monthData(M);
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
  S._lists={deuda:urg.map(x=>x.e),prox};
  const li=(e,meta,kind)=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${meta}</span>${msgBtn(e,kind,'Avisar')}</li>`;
  const bulkBtn=(key,n)=>n>1?`<button class="btn" style="padding:5px 10px;font-size:13px" data-bulk="${key}">Avisar a los ${n}</button>`:'';
  const head=(t,key,n)=>`<div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b>${t}</b>${bulkBtn(key,n)}</div>`;
  const prev=mesShift(curMes(),-1),prevOpen=meses.includes(prev)&&!(S.meses[prev]&&S.meses[prev].cerrado);
  // historial de meses
  const hist=meses.map(monthData);
  const maxF=Math.max(...hist.map(h=>Math.max(h.T.ff,h.T.fc)),1);

  el.innerHTML=`
  ${prevOpen?`<div class="banner" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span>${mesLbl(prev)} terminó y todavía está abierto. Al cerrarlo se guarda quiénes estaban activos y cuánto pagaba cada uno.</span><button class="btn" data-cerrar="${prev}">Cerrar ${mesLbl(prev)}</button></div>`:''}
  <div class="chips" id="mesChips" style="margin-bottom:14px">${meses.map(k=>`<button class="chip" data-mes="${k}" aria-pressed="${k===M}">${mesLbl(k)}${S.meses[k]?.cerrado?' ✓':''}</button>`).join('')}</div>
  <h2 class="sec">${mesLbl(M)} ${D.cerrado?'<span class="pill p-mute">Cerrado</span>':isCur?'<span class="pill p-ok">En curso</span>':'<span class="pill p-warn">Abierto</span>'}</h2>
  <div class="kpis">
    <div class="card kpi hl"><div class="lbl">Tu ganancia cobrada</div><div class="val">${money(D.T.fc)}</div><div class="sub">de ${money(D.T.ff)} esperados</div></div>
    <div class="card kpi"><div class="lbl">Cobrado</div><div class="val">${money(D.T.c)}</div><div class="sub">${Math.round(pctCob*100)}% de ${money(D.T.f)}</div><div class="prog" style="margin-top:8px"><i style="width:${pctCob*100}%"></i></div></div>
    <div class="card kpi"><div class="lbl">Falta cobrar</div><div class="val" style="color:var(--bad)">${money(D.T.p)}</div><div class="sub">${plural(D.pend.length,'entrenado','entrenados')}</div></div>
    <div class="card kpi"><div class="lbl">Plantel del mes</div><div class="val">${D.T.n}</div><div class="sub">${GYMS.map(g=>D.G[g].n+' '+GYM_LBL[g]).join(' · ')}</div></div>
    ${isCur?`<div class="card kpi"><div class="lbl">Rutinas a revisar</div><div class="val" style="color:var(--warn)">${rut.length}</div><div class="sub">+30 días o a cambiar</div></div>`:''}
  </div>

  <h2 class="sec">Reparto de ${mesLbl(M)}</h2>
  <div class="grid2">
    <div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th></th><th>Esperado</th><th>Cobrado</th><th>Falta</th></tr></thead>
      <tbody>
        ${GYMS.map(g=>`<tr><td>Fran · ${GYM_LBL[g]} (${pct(pctFran(g))})</td><td>${money(D.G[g].ff)}</td><td>${money(D.G[g].fc)}</td><td>${money(D.G[g].fp)}</td></tr>`).join('')}
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

  <h2 class="sec">${isCur?'Para hacer hoy':'Cuotas de '+mesLbl(M)}</h2>
  <div class="grid2">
    <div class="card">${head(isCur?`Cobros de ${mesLbl(M)} · ${D.pagos.length} pagaron`:`Sin pagar en ${mesLbl(M)}`,'deuda',urg.length)}
      ${pendInfo.length?`<ul class="alist">${pendInfo.map(x=>x.e?`<li><button class="nm" data-open="${esc(x.e.id)}">${esc(name(x.e))}</button><span class="meta"><span class="pill ${x.cls}">${esc(x.tag)}</span> ${money(x.r.monto)}</span>${msgBtn(x.e,x.kind,'Avisar')}</li>`:`<li><span class="nm">${esc(titleCase(x.r.nombre))}</span><span class="meta">${money(x.r.monto)}</span></li>`).join('')}</ul>`:'<div class="empty">Todos pagaron este mes.</div>'}
    </div>
    ${isCur?`<div class="card">${head('Vencen en los próximos 7 días','prox',prox.length)}
      ${prox.length?`<ul class="alist">${prox.map(e=>li(e,`${fmtShort(e.proxVenc)} · ${diasVenc(e)===0?'hoy':diasVenc(e)+' d'}`,'pago')).join('')}</ul>`:'<div class="empty">No hay vencimientos esta semana.</div>'}
    </div>
    ${entregasCard()}
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Rutinas a revisar</b></div>
      ${rut.length?`<ul class="alist">${rut.map(e=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}</button><span class="meta">${diasRutina(e)!==null&&diasRutina(e)>30?diasRutina(e)+' días':esc(e.modalidad)}</span></li>`).join('')}</ul>`:'<div class="empty">Todas las rutinas están al día.</div>'}
    </div>
    <div class="card"><div class="pad" style="padding-bottom:6px"><b>Agenda de vencimientos · 30 días</b></div>
      ${agK.length?`<ul class="alist">${agK.map(k=>`<li><span class="nm" style="flex:0 0 64px;font-weight:600">${fmtShort(k)}</span><span class="meta" style="flex:1;white-space:normal">${ag[k].length} · ${ag[k].slice(0,4).map(e=>esc(firstName(e))).join(', ')}${ag[k].length>4?'…':''}</span><span class="meta">${money(ag[k].reduce((a,e)=>a+monto(e),0))}</span></li>`).join('')}</ul>`:'<div class="empty">Sin vencimientos próximos.</div>'}
    </div>`:`<div class="card"><div class="pad" style="padding-bottom:6px"><b>Pagos registrados · ${D.pagos.length}</b></div>
      ${D.pagos.length?`<ul class="alist">${D.pagos.slice().sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||'')).map(p=>`<li><span class="nm">${esc(titleCase(p.nombre||S.ents[p.entrenadoId]?.nombre||p.entrenadoId))}</span><span class="meta">${fmtShort(p.fecha)} · ${money(p.monto)}</span></li>`).join('')}</ul>`:'<div class="empty">Sin pagos registrados.</div>'}
    </div>`}
  </div>

  <h2 class="sec">Resumen por mes</h2>
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
}
async function cerrarMes(M){
  const d=monthData(M);
  if(await write(()=>S.db.doc('meses/'+M).set({mes:M,cerrado:true,fechaCierre:iso(today()),plantel:d.roster})))toast(mesLbl(M)+' cerrado');
}

/* ---------- LISTA ---------- */
const FILTERS=[['activos','Activos'],['LEVEL','LEVEL'],['CROSSFORCE','CrossForce'],['ONLINE','Online'],['deuda','Deben'],['rutina','Rutina a revisar'],['Suspendido','Suspendidos'],['Baja','Bajas']];
function renderLista(){
  const el=$('#v-lista');
  if(!el.dataset.built){
    el.innerHTML=`<div class="toolbar"><input id="q" class="search" type="search" placeholder="Buscar por nombre o teléfono" autocomplete="off"><div class="chips" id="chips">${FILTERS.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${k===S.filter}">${l}</button>`).join('')}</div></div><p class="count" id="cnt"></p><div class="card"><div class="rhead"><span>Entrenado</span><span>Plan</span><span>Mensualidad</span><span>Próx. venc.</span><span>Estado</span><span></span></div><div class="rows" id="rows"></div></div>`;
    el.dataset.built=1;
    $('#q').addEventListener('input',e=>{S.q=e.target.value.trim().toLowerCase();renderRows()});
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
  else if(f==='deuda')list=list.filter(e=>['Pendiente','Vencido'].includes(estadoPago(e)));
  else if(f==='rutina')list=list.filter(rutinaRevisar);
  else if(f==='Suspendido'||f==='Baja')list=list.filter(e=>estado(e)===f);
  if(S.q){const qd=S.q.replace(/\D/g,'');list=list.filter(e=>(e.nombre||'').toLowerCase().includes(S.q)||(qd&&phoneDigits(e).includes(qd)))}
  list.sort((a,b)=>name(a).localeCompare(name(b),'es'));
  $('#cnt').textContent=S.loaded?plural(list.length,'entrenado','entrenados'):'Cargando…';
  $('#rows').innerHTML=list.length?list.map(e=>{const p=estadoPago(e);const es=estado(e);return `<button class="row" data-open="${esc(e.id)}">
    <span class="c"><span class="n">${esc(name(e))}</span><br><span class="s">${gymTag(e)} ${esc(e.id)}</span></span>
    <span class="c h">${esc(e.plan||'—')}<br><span class="s">${esc(e.estimulos)}×/sem</span></span>
    <span class="c h">${money(monto(e))}${Number(e.promo)?`<br><span class="s">promo ${pct(e.promo)}</span>`:''}</span>
    <span class="c h">${es==='Activo'?fmtD(e.proxVenc)+(diasVenc(e)!==null?`<br><span class="s">${diasVenc(e)<0?'hace '+(-diasVenc(e))+' d':diasVenc(e)===0?'hoy':'en '+diasVenc(e)+' d'}</span>`:''):'—'}</span>
    <span class="c">${es==='Activo'?`<span class="pill ${pagoPill(p)}">${p}</span>`:`<span class="pill ${estPill(es)}">${es}</span>`}</span>
    <span class="c h"></span></button>`}).join(''):`<div class="empty">${S.loaded?'No hay entrenados con ese filtro.':'Cargando…'}</div>`;
}

/* ---------- AJUSTES ---------- */
function renderAjustes(){
  const c=S.cfg;
  const gymForm=g=>`<div class="card pad form" style="margin-bottom:12px">
    <div class="full"><span class="pill ${gymPill(g)}">${GYM_LBL[g]}</span></div>
    ${[1,2,3,4,5].map(n=>`<label>${n}× por semana<input id="t-${g}-${n}" type="number" min="0" step="500" value="${esc(c.gyms[g].tarifas[String(n)]??'')}"></label>`).join('')}
    <label>% para Fran<input id="p-${g}" type="number" min="0" max="100" step="1" value="${Math.round(c.gyms[g].pctFran*100)}"></label>
  </div>`;
  $('#v-ajustes').innerHTML=`<h2 class="sec">Tarifas y reparto por gimnasio</h2>
  <form id="cfgf">
    ${gymForm('LEVEL')}${gymForm('CROSSFORCE')}
    <div class="card pad form" style="margin-bottom:12px"><div class="full"><span class="pill p-on">Online</span></div>
      <label>Precio mensual<input id="tonl" type="number" min="0" step="500" value="${esc(c.online)}"></label><label>% para Fran<input value="100%" readonly></label></div>
    <p class="hint">Los valores son sin promo; las promos de 10% y 15% se descuentan sobre estos precios. Al guardar se recalcula todo el panel.</p>
    <div class="actions" style="margin-top:12px"><button class="btn pri" type="submit">Guardar ajustes</button></div>
  </form>
  <h2 class="sec">Rutinas</h2>
  <form id="cfgr" class="card pad form">
    <label class="full">Dirección de la app (para los links de los entrenados)<input id="c-url" value="${esc(c.appUrl)}" placeholder="Se completa sola: ${esc(location.origin+location.pathname.replace(/[^/]*$/,''))}"></label>
    <label>Posiciones (separadas por coma)<input id="c-pos" value="${esc((c.posiciones||[]).join(', '))}"></label>
    <label>Bloques sugeridos<input id="c-bl" value="${esc((c.bloques||[]).join(', '))}"></label>
    <label>Redondeo de kg<input id="c-red" type="number" step="0.25" min="0.25" value="${esc(c.redondeo)}"></label>
    <div class="full"><b style="font-size:14px">Marcas RM</b><p class="hint">Si una marca no está cargada se calcula desde otra (ej: Sentadilla frontal = 75% de Sentadilla).</p></div>
    <div class="full tbl-wrap"><table id="rmdefs"><thead><tr><th>Marca</th><th>Se calcula desde</th><th>Factor</th><th></th></tr></thead><tbody>
      ${(c.rmDefs||[]).map((d,i)=>`<tr><td><input data-rd="mov" value="${esc(d.mov)}"></td><td><select data-rd="base"><option value="">— (se carga)</option>${c.rmDefs.map(x=>`<option ${x.mov===d.base?'selected':''}>${esc(x.mov)}</option>`).join('')}</select></td><td><input data-rd="factor" type="number" step="0.01" value="${esc(d.factor??'')}" style="width:80px"></td><td><button type="button" class="x-sm" data-rddel="${i}">Quitar</button></td></tr>`).join('')}
    </tbody></table></div>
    <div class="full actions"><button class="btn" type="button" id="rd-add">+ Marca</button><button class="btn pri" type="submit">Guardar ajustes de rutinas</button></div>
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
  const readDefs=()=>[...document.querySelectorAll('#rmdefs tbody tr')].map(tr=>{const mov=tr.querySelector('[data-rd=mov]').value.trim().toUpperCase();const base=tr.querySelector('[data-rd=base]').value;const f=Number(tr.querySelector('[data-rd=factor]').value);return mov?{mov,...(base&&base!==mov?{base,factor:f||1}:{})}:null}).filter(Boolean);
  $('#rd-add').addEventListener('click',()=>{S.cfg.rmDefs=[...readDefs(),{mov:''}];renderAjustes()});
  $('#cfgr').addEventListener('click',ev=>{const b=ev.target.closest('[data-rddel]');if(b){const d=readDefs();d.splice(Number(b.dataset.rddel),1);S.cfg.rmDefs=d;renderAjustes()}});
  $('#cfgr').addEventListener('submit',async ev=>{ev.preventDefault();
    const split=v=>v.split(',').map(x=>x.trim()).filter(Boolean);
    const nc={appUrl:$('#c-url').value.trim(),posiciones:split($('#c-pos').value),bloques:split($('#c-bl').value).map(x=>x.toUpperCase()),redondeo:Number($('#c-red').value)||2.5,rmDefs:readDefs()};
    if(await write(()=>S.db.doc('config/general').set({...S.cfgRaw,...nc})))toast('Ajustes guardados');
  });
}

/* ---------- FICHA ---------- */
let openId=null,sheetMode='ver',sheetArg=null,bulk=null;
function openSheet(id,mode,arg){openId=id;sheetMode=mode||'ver';sheetArg=arg||null;renderSheet();$('#overlay').hidden=false;document.body.style.overflow='hidden'}
function closeSheet(){openId=null;bulk=null;$('#overlay').hidden=true;$('#overlay').innerHTML='';document.body.style.overflow=''}
function setMode(m,arg){sheetMode=m;sheetArg=arg||null;renderSheet()}
function renderSheet(){
  const ov=$('#overlay');
  ov.oninput=null;ov.onchange=null;
  if(openId==='__bulk'){ov.innerHTML=shell('Envío de mensajes',bulkHTML());bindBulk();return}
  if(openId==='__rut'){const R=S.edit.data;ov.innerHTML=shell(S.edit.col==='plantillas'?(S.edit.id?'Plantilla':'Nueva plantilla'):(R.nombre||'Rutina'),editorHTML());ov.querySelector('.sheet').classList.add('wide');bindEditor();return}
  if(openId==='__ej'){ov.innerHTML=shell(S.ejEdit.id?'Ejercicio':'Nuevo ejercicio',ejHTML());bindEj();return}
  if(openId==='__asig'){ov.innerHTML=shell('Asignar plantilla',asignarHTML(sheetArg));ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))closeSheet()};bindAsignar(sheetArg);return}
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
    ${es==='Activo'?`<button class="btn pri" data-mode="pago">Registrar pago</button><button class="btn" data-act="rutina">Renové la rutina hoy</button>`:''}
    <button class="btn" data-mode="wa">${WA.replace('<svg','<svg style="width:14px;height:14px;fill:var(--ok);vertical-align:-2px"')} Mensaje</button>
    <button class="btn" data-mode="editar">Editar</button>
  </div>
  <dl class="card facts" style="margin:0">
    <div><dt>ID</dt><dd>${esc(e.id)}</dd></div>
    <div><dt>Teléfono</dt><dd>${esc(e.telefono)}</dd></div>
    <div><dt>Plan</dt><dd>${esc(e.plan)} · ${esc(e.estimulos)}×/sem</dd></div>
    <div><dt>Mensualidad</dt><dd>${money(monto(e))}${Number(e.promo)?' (promo '+pct(e.promo)+')':''}</dd></div>
    <div><dt>Último pago</dt><dd>${fmtD(e.ultPago)}</dd></div>
    <div><dt>Próximo vencimiento</dt><dd>${fmtD(e.proxVenc)}${dv!==null&&es==='Activo'?` <span class="hint" style="display:inline">(${dv<0?'hace '+(-dv)+' d':dv===0?'hoy':'en '+dv+' d'})</span>`:''}</dd></div>
    <div><dt>Rutina</dt><dd>${esc(e.modalidad||'—')}</dd></div>
    <div><dt>Última rutina</dt><dd>${fmtD(e.ultRutina)}${dr!==null?` <span class="hint" style="display:inline">(${dr} d · ${periodo(e)})</span>`:''}</dd></div>
    <div><dt>Fecha de inicio</dt><dd>${fmtD(e.inicio)}</dd></div>
    <div><dt>Pago registrado</dt><dd>${esc(e.pagoRegistrado)}</dd></div>
  </dl>
  ${e.obs?`<div class="card pad"><div class="kpi" style="padding:0"><div class="lbl">Observaciones</div></div><div style="margin-top:4px;overflow-wrap:anywhere">${esc(e.obs)}</div></div>`:''}
  ${fichaRutinasHTML(e)}
  <div class="card">
    <div class="pad" style="padding-bottom:4px"><b>Pagos</b>${um.length?` <span class="pill p-bad">Adeuda ${um.map(mesLbl).join(', ')}</span>`:''}</div>
    ${ps.length?`<ul class="timeline">${ps.map(p=>`<li><span class="d">${fmtD(p.fecha)}</span><span class="t"><span class="pill p-ok">${mesLbl(p.mes)}</span> ${money(p.monto)}</span><button class="del" data-delp="${esc(p._id)}" aria-label="Borrar pago">Borrar</button></li>`).join('')}</ul>`:'<div class="empty">Sin pagos registrados en la app.</div>'}
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
  return `<form id="ef" class="form">
    <label class="full">Nombre completo<input id="f-nombre" required value="${esc(e.nombre)}"></label>
    <label>Teléfono<input id="f-tel" type="tel" required value="${esc(e.telefono)}" placeholder="+5491100000000"></label>
    <label>ID<input id="f-id" value="${esc(e.id)}" ${isNew?'':'readonly'}></label>
    <label>Gimnasio<select id="f-gym">${GYMS.map(g=>`<option value="${g}" ${gymOf(e)===g?'selected':''}>${GYM_LBL[g]}</option>`).join('')}</select></label>
    <label>Estado<select id="f-estado">${o(['Activo','Suspendido','Baja'],estado(e))}</select></label>
    <label>Plan<input id="f-plan" list="planes" value="${esc(e.plan)}"><datalist id="planes"><option>Deportivo</option><option>C. General</option><option>Hipertrofia</option><option>Fuerza</option><option>Salud</option></datalist></label>
    <label>Estímulos/sem<select id="f-est">${o([1,2,3,4,5],e.estimulos)}</select></label>
    <label>Promo<select id="f-promo">${[0,0.1,0.15].map(x=>`<option value="${x}" ${Number(e.promo)===x?'selected':''}>${pct(x)}</option>`).join('')}</select></label>
    <label>Mensualidad<input id="f-monto" readonly value="${money(monto(e))}"></label>
    <label>Último pago<input id="f-ultpago" type="date" value="${esc(e.ultPago||'')}"></label>
    <label>Próximo vencimiento<input id="f-venc" type="date" value="${esc(e.proxVenc||'')}"></label>
    <label>Pago registrado<select id="f-pago">${o(['Al día','Debe'],e.pagoRegistrado)}</select></label>
    <label>Modalidad rutina<select id="f-mod">${o(['Periodizada','Diaria','Cambiar','Planificar','Sin definir'],e.modalidad)}</select></label>
    <label>Última rutina<input id="f-rut" type="date" value="${esc(e.ultRutina||'')}"></label>
    <label>Fecha de inicio<input id="f-inicio" type="date" value="${esc(e.inicio||'')}"></label>
    <label>Grupo / equipo<input id="f-grupo" list="dl-grupos" value="${esc(e.grupo||'')}" placeholder="Ej: Handball AFALP"><datalist id="dl-grupos">${[...new Set(Object.values(S.ents).map(x=>x.grupo).filter(Boolean))].map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>
    <label>Posición<select id="f-pos"><option value="">—</option>${(S.cfg.posiciones||[]).map(p=>`<option ${p===e.posicion?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
    <label class="full">Observaciones<textarea id="f-obs">${esc(e.obs||'')}</textarea></label>
    <p class="hint full">La mensualidad se calcula sola según gimnasio, estímulos y promo (tarifas en Ajustes).</p>
    <div class="full actions"><button class="btn pri" type="submit">${isNew?'Crear entrenado':'Guardar cambios'}</button>${isNew?'':'<button class="btn" type="button" data-mode="ver">Cancelar</button><button class="btn danger" type="button" id="delbtn" style="margin-left:auto">Eliminar ficha</button>'}</div>
  </form>`;
}
function pagoHTML(e){
  const sug=(e.pagoRegistrado==='Debe'&&parse(e.proxVenc)&&parse(e.proxVenc)>=today())?e.proxVenc:addMonth(e.proxVenc||iso(today()));
  const um=unpaidMeses(e.id),cm=curMes();
  const opts=[...new Set([...um,mesShift(cm,-2),mesShift(cm,-1),cm,mesShift(cm,1)])].sort();
  const defM=um[0]||cm;
  return `<form id="pf" class="form card pad">
    <label class="full">Cuota del mes<select id="p-mes">${opts.map(k=>`<option value="${k}" ${k===defM?'selected':''}>${mesLbl(k)}${um.includes(k)&&k<cm?' · adeudada':''}</option>`).join('')}</select></label>
    <label>Fecha de pago<input id="p-fecha" type="date" value="${iso(today())}" required></label>
    <label>Monto abonado<input id="p-monto" type="number" min="0" step="100" value="${monto(e)}" required></label>
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
  bulk={ids:l.map(e=>e.id),i:0,sent:0,kind:key==='deuda'?'vencido':'pago',title:key==='deuda'?'Cobros pendientes':'Vencen esta semana'};
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
  };
  const ef=$('#ef');
  if(ef){
    const upd=()=>{const t={...e,gym:$('#f-gym').value,estimulos:Number($('#f-est').value),promo:Number($('#f-promo').value)};$('#f-monto').value=money(monto(t))};
    ['#f-gym','#f-est','#f-promo'].forEach(s=>$(s).addEventListener('change',upd));
    ef.addEventListener('submit',async ev=>{ev.preventDefault();
      const id=$('#f-id').value.trim().toUpperCase();
      if(isNew&&(!/^[A-Z0-9_-]{1,20}$/.test(id)||S.ents[id])){toast('Ese ID ya existe o no es válido');return}
      const tel=$('#f-tel').value.replace(/[^\d+]/g,'');
      const d={...(isNew?{}:e),id,nombre:$('#f-nombre').value.trim(),telefono:tel.startsWith('+')?tel:'+'+tel,gym:$('#f-gym').value,estado:$('#f-estado').value,plan:$('#f-plan').value.trim(),
        estimulos:Number($('#f-est').value),promo:Number($('#f-promo').value),ultPago:$('#f-ultpago').value,proxVenc:$('#f-venc').value,pagoRegistrado:$('#f-pago').value,
        modalidad:$('#f-mod').value,ultRutina:$('#f-rut').value,inicio:$('#f-inicio').value,obs:$('#f-obs').value.trim(),grupo:$('#f-grupo').value.trim(),posicion:$('#f-pos').value};
      delete d.montoOnline;
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
  if(pf)pf.addEventListener('submit',async ev=>{ev.preventDefault();
    const f=$('#p-fecha').value,v=$('#p-venc').value,m=Number($('#p-monto').value)||0,mes=$('#p-mes').value,g=gymOf(e);
    if(S.pagos.some(p=>p.entrenadoId===e.id&&p.mes===mes)&&!$('#pf').dataset.dup){$('#pf').dataset.dup=1;toast('Ya tiene un pago en '+mesLbl(mes)+'. Tocá Confirmar de nuevo para sumarlo igual');return}
    if(!await write(()=>S.db.collection('pagos').add({entrenadoId:e.id,nombre:e.nombre,gym:g,fecha:f,monto:m,mes,pctFran:pctFran(g),ts:Date.now()})))return;
    const rest=adeudados(e.id).filter(k=>k!==mes);
    if(await write(()=>S.db.collection('entrenados').doc(e.id).update({ultPago:f,proxVenc:v,pagoRegistrado:rest.length?'Debe':'Al día',ultMonto:m}))){
      await addHist(e.id,'Pago',`${money(m)} · cuota ${mesLbl(mes)} · próximo vencimiento ${fmtD(v)}`,f);
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
const rutDe=id=>S.rutinas.filter(r=>r.entrenadoId===id);
const activaDe=id=>rutDe(id).filter(r=>r.estado==='activa').sort((a,b)=>(b.fechaEntrega||'').localeCompare(a.fechaEntrega||''))[0];
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
function entregasCard(){
  const {listas}=entregasData();
  return `<div class="card"><div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px"><b>Rutinas para entregar</b><button class="btn" style="padding:5px 10px;font-size:13px" data-goto="rutinas">Ver tablero</button></div>
    ${listas.length?`<ul class="alist">${listas.slice(0,8).map(r=>`<li><button class="nm" data-open="${esc(r.entrenadoId)}">${esc(name(S.ents[r.entrenadoId]))}</button><span class="meta">${esc(r.nombre||'Rutina')}</span><button class="wa" data-entregar="${esc(r._id)}">Entregar</button></li>`).join('')}</ul>`:'<div class="empty">No hay rutinas listas para entregar.</div>'}</div>`;
}
const SUBS=[['entregas','Entregas'],['plantillas','Plantillas'],['biblioteca','Biblioteca de videos']];
function renderRutinas(){
  const el=$('#v-rutinas');
  if(!S.loaded){el.innerHTML='<div class="card empty">Cargando…</div>';return}
  S.rsub=S.rsub||'entregas';
  let body='';
  if(S.rsub==='entregas'){
    const {listas,espera,sinProx}=entregasData();
    const rowR=(r,btns)=>{const e=S.ents[r.entrenadoId];return `<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}<br><span class="hint">${esc(r.nombre||'Rutina')}${r.fechaSugerida?' · '+fmtShort(r.fechaSugerida):''}${r.pospuesta?.motivo?' · '+esc(r.pospuesta.motivo):''}</span></button>${btns}</li>`};
    body=`<div class="actions" style="margin-bottom:12px"><button class="btn pri" data-asignar="">Asignar plantilla a entrenados o grupo</button></div>
    <div class="grid3">
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>Para entregar</b> <span class="pill p-ok">${listas.length}</span><p class="hint">Llegó la fecha. Confirmá o posponé.</p></div>
        ${listas.length?`<ul class="alist">${listas.map(r=>rowR(r,`<span class="actions" style="flex-wrap:nowrap"><button class="wa" data-entregar="${esc(r._id)}">Entregar</button><button class="btn" style="padding:5px 8px;font-size:13px" data-posponer="${esc(r._id)}">Posponer</button></span>`)).join('')}</ul>`:'<div class="empty">Nada para entregar hoy.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>En espera</b> <span class="pill p-warn">${espera.length}</span><p class="hint">Planificadas para más adelante o pospuestas.</p></div>
        ${espera.length?`<ul class="alist">${espera.map(r=>rowR(r,`<button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Abrir</button>`)).join('')}</ul>`:'<div class="empty">Sin rutinas en espera.</div>'}</div>
      <div class="card"><div class="pad" style="padding-bottom:6px"><b>Sin próxima planificada</b> <span class="pill p-mute">${sinProx.length}</span><p class="hint">Ordenados por la rutina más vieja.</p></div>
        ${sinProx.length?`<ul class="alist">${sinProx.map(({e,a})=>`<li><button class="nm" data-open="${esc(e.id)}">${esc(name(e))}<br><span class="hint">${a?esc(a.nombre||'Rutina')+' · desde '+fmtShort(a.fechaEntrega):'Sin rutina en la app'+(e.ultRutina?' · últ. '+fmtShort(e.ultRutina):'')}</span></button><button class="btn" style="padding:5px 8px;font-size:13px" data-asignar="" data-para="${esc(e.id)}">Planificar</button></li>`).join('')}</ul>`:'<div class="empty">Todos tienen la próxima en cola.</div>'}</div>
    </div>`;
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
  const bq=$('#bq');if(bq){bq.addEventListener('input',()=>{S.bq=bq.value;const p=bq.selectionStart;renderRutinas();const n=$('#bq');n.focus();n.setSelectionRange(p,p)})}
}

/* ----- bloque de rutinas en la ficha ----- */
function fichaRutinasHTML(e){
  const a=activaDe(e.id),c=colaDe(e.id),fin=rutDe(e.id).filter(r=>r.estado==='finalizada').sort((x,y)=>(y.fechaFin||'').localeCompare(x.fechaFin||'')).slice(0,3);
  const url=portalUrl(e);
  const regs=S.regs.filter(r=>r.entrenadoId===e.id).sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')||(y.ts||0)-(x.ts||0)).slice(0,10);
  const itemName=uid=>{for(const r of rutDe(e.id))for(const s of r.secciones||[])for(const d of s.dias)for(const b of d.bloques)for(const i of b.items)if(i.uid===uid)return i.nombre;return 'Ejercicio'};
  const warn=r=>{const n=diasDe(r),est=Number(e.estimulos)||0;return n&&est&&n!==est?` <span class="pill p-warn">${n} días · paga ${est}</span>`:''};
  return `<div class="card">
    <div class="pad" style="padding-bottom:6px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b>Rutinas</b>
      <span class="actions"><button class="btn" style="padding:5px 10px;font-size:13px" data-asignar="" data-para="${esc(e.id)}">Desde plantilla</button><button class="btn" style="padding:5px 10px;font-size:13px" data-newrut="${esc(e.id)}">Vacía</button>${a?`<button class="btn" style="padding:5px 10px;font-size:13px" data-duprut="${esc(a._id)}">Duplicar actual</button>`:''}</span></div>
    <ul class="alist">
      ${a?`<li><span class="nm" style="white-space:normal"><span class="pill p-ok">Activa</span> <b>${esc(a.nombre||'Rutina')}</b>${warn(a)}<br><span class="hint">Entregada ${fmtD(a.fechaEntrega)} · semana ${semanaActual(a)+1} de ${a.duracionSemanas||'?'}</span></span><button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(a._id)}">Abrir</button></li>`:'<li><span class="nm hint">Sin rutina activa en la app.</span></li>'}
      ${c.map(r=>`<li><span class="nm" style="white-space:normal"><span class="pill p-warn">En cola</span> <b>${esc(r.nombre||'Rutina')}</b>${warn(r)}<br><span class="hint">Entrega sugerida ${fmtD(r.fechaSugerida)}${r.pospuesta?.motivo?' · '+esc(r.pospuesta.motivo):''}</span></span><span class="actions" style="flex-wrap:nowrap"><button class="wa" data-entregar="${esc(r._id)}">Entregar</button><button class="btn" style="padding:5px 8px;font-size:13px" data-posponer="${esc(r._id)}">Posponer</button><button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Abrir</button></span></li>`).join('')}
      ${fin.map(r=>`<li><span class="nm hint" style="white-space:normal"><span class="pill p-mute">Finalizada</span> ${esc(r.nombre||'Rutina')} · ${fmtShort(r.fechaEntrega)} a ${fmtShort(r.fechaFin)}</span><button class="btn" style="padding:5px 8px;font-size:13px" data-editrut="${esc(r._id)}">Ver</button></li>`).join('')}
    </ul>
    <div class="pad" style="border-top:1px solid var(--line)"><div class="kpi" style="padding:0"><div class="lbl">Link personal del entrenado</div></div>
      ${url?`<input id="portal-url" readonly value="${esc(url)}" style="width:100%;margin:6px 0;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);font-size:12px"><div class="actions"><button class="btn" id="portal-copy" type="button">Copiar link</button><a class="btn" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(url)}">Abrir como entrenado</a><button class="btn" data-mode="wa" data-kindsel="link">Enviar por WhatsApp</button></div>`:`<p class="hint" style="margin:6px 0">Todavía no tiene link.</p><button class="btn" id="portal-gen" type="button">Crear link</button>`}
    </div>
    ${regs.length?`<div class="pad" style="border-top:1px solid var(--line);padding-bottom:4px"><b style="font-size:14px">Últimas cargas anotadas por el entrenado</b></div><ul class="timeline">${regs.map(r=>`<li><span class="d">${fmtShort(r.fecha)}</span><span class="t">${esc(itemName(r.item))}: <b>${esc(r.kg||'—')}${r.kg?' kg':''}</b>${r.reps?' × '+esc(r.reps):''}${r.cansancio?` · cansancio ${r.cansancio}`:''}${r.nota?' · '+esc(r.nota):''}</span><span></span></li>`).join('')}</ul>`:''}
  </div>
  <div class="card"><div class="pad" style="padding-bottom:4px"><b>Marcas (RM)</b><p class="hint">Los kg de los ejercicios con % se calculan con estas marcas, redondeando a ${S.cfg.redondeo||2.5} kg. Los grises se calculan solos.</p></div>
    <form id="rmf" class="pad form cols3" style="padding-top:6px">${(S.cfg.rmDefs||[]).map(d=>{const own=(e.rm||{})[d.mov];const der=!own&&rmValue(e,d.mov);return `<label>${esc(titleCase(d.mov))}<input data-rm="${esc(d.mov)}" type="number" min="0" step="0.5" value="${esc(own??'')}" placeholder="${der?String(+der.toFixed(1)):''}"></label>`}).join('')}
      <div class="full actions"><button class="btn" type="submit">Guardar marcas</button></div></form></div>`;
}
function bindFichaRutinas(e){
  const cp=$('#portal-copy');if(cp)cp.addEventListener('click',()=>{const u=$('#portal-url').value;const p=navigator.clipboard?.writeText(u);if(p)p.then(()=>toast('Link copiado'),()=>{$('#portal-url').select()});else $('#portal-url').select()});
  const gen=$('#portal-gen');if(gen)gen.addEventListener('click',async()=>{if(await ensureToken(e)){toast('Link creado');renderSheet()}});
  const rmf=$('#rmf');if(rmf)rmf.addEventListener('submit',async ev=>{ev.preventDefault();const rm={};rmf.querySelectorAll('[data-rm]').forEach(i=>{const v=Number(i.value);if(v>0)rm[i.dataset.rm]=v});
    if(await write(()=>S.db.collection('entrenados').doc(e.id).update({rm})))toast('Marcas guardadas')});
}

/* ----- entregar / posponer ----- */
async function entregar(rid){
  const r=S.rutinas.find(x=>x._id===rid);if(!r)return;
  const e=S.ents[r.entrenadoId];
  const t=iso(today());
  for(const a of rutDe(r.entrenadoId).filter(x=>x.estado==='activa'))await write(()=>S.db.collection('rutinas').doc(a._id).update({estado:'finalizada',fechaFin:t}));
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
  const pid=arg.pid||pls[0]?.[0]||'';
  const p=S.plantillas[pid];
  const grupos=[...new Set(Object.values(S.ents).map(e=>e.grupo).filter(Boolean))].sort();
  const sel=arg.sel||new Set();
  const q=keyN(arg.q||'');
  const list=Object.values(S.ents).filter(isAct).filter(e=>sel.has(e.id)||!q||keyN(e.nombre).includes(q)||keyN(e.grupo).includes(q)).sort((a,b)=>(b.grupo||'').localeCompare(a.grupo||'')||name(a).localeCompare(name(b),'es'));
  const nd=p?diasDe(p):0;
  return `<form id="asf" class="form">
    <label class="full">Plantilla<select id="as-p">${pls.length?pls.map(([id,x])=>`<option value="${esc(id)}" ${id===pid?'selected':''}>${esc(x.nombre)}</option>`).join(''):'<option value="">No hay plantillas</option>'}</select></label>
    <label>Nombre de la rutina<input id="as-nom" value="${esc(arg.nom??(p?p.nombre:''))}"></label>
    <label>Entrega sugerida<input id="as-f" type="date" value="${esc(arg.f||iso(today()))}"></label>
    ${p?`<p class="hint full">${plural((p.secciones||[]).length,'sección','secciones')} · ${nd} días. A cada entrenado le llegan solo las secciones de su posición (o todas si no tiene). Si paga menos estímulos que días, se arma una rotación semanal automática.</p>`:''}
    ${grupos.length?`<div class="full actions">${grupos.map(g=>`<button class="chip" type="button" data-grp="${esc(g)}">Todo ${esc(g)}</button>`).join('')}</div>`:''}
    <input id="as-q" class="full search" placeholder="Buscar entrenado" value="${esc(arg.q||'')}" autocomplete="off">
    <div class="full card" style="max-height:340px;overflow:auto"><ul class="alist">${list.map(e=>`<li><label style="display:flex;gap:10px;align-items:center;flex:1;text-transform:none;letter-spacing:0;font-size:15px;color:var(--ink);font-weight:500"><input type="checkbox" data-sel="${esc(e.id)}" ${sel.has(e.id)?'checked':''} style="width:auto">${esc(name(e))}</label><span class="meta">${e.grupo?esc(e.grupo)+' · ':''}${e.posicion?esc(e.posicion)+' · ':''}${e.estimulos}×</span></li>`).join('')}</ul></div>
    <div class="full actions"><button class="btn pri" type="submit" ${p?'':'disabled'}>Poner en cola (${sel.size})</button><button class="btn" type="button" data-close>Cancelar</button></div>
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
    const p=S.plantillas[arg.pid||$('#as-p').value];if(!p||!arg.sel.size){toast('Elegí al menos un entrenado');return}
    let n=0;
    for(const id of arg.sel){
      const e=S.ents[id];
      const secs=clone(p.secciones||[]).filter(s=>!s.posicion||!e.posicion||keyN(s.posicion)===keyN(e.posicion));
      const doc={entrenadoId:id,nombre:arg.nom||p.nombre,estado:'cola',fechaSugerida:arg.f||iso(today()),duracionSemanas:p.duracionSemanas||4,
        secciones:secs.length?secs:clone(p.secciones||[]),plantillaId:arg.pid||'',notas:p.notas||'',creada:Date.now()};
      const rot=rotacion(diasDe(doc),Number(e.estimulos),doc.duracionSemanas);if(rot)doc.distribucion=rot;
      if(await write(()=>S.db.collection('rutinas').add(doc)))n++;
    }
    toast(`${plural(n,'rutina puesta','rutinas puestas')} en cola`);closeSheet();
  });
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
    return `<div class="it">
      <div class="it-ej"><input list="dl-ej" data-p="${path}" data-f="nombre" value="${esc(it.nombre)}" placeholder="Ejercicio" ${ro?'readonly':''}>${it.nombre?(has?(S.ejs[it.ej].video?`<a class="vid" target="_blank" rel="noopener" href="${esc(S.ejs[it.ej].video)}" title="Ver video">▶</a>`:''):`<button type="button" class="miss" data-addej="${esc(it.nombre)}" title="No está en la biblioteca">+ video</button>`):''}</div>
      <label>Reps${inp(path,'reps',it.reps,'10')}</label>
      <label>Kg${inp(path,'kg',it.kg,it.pct?'auto':'')}</label>
      <label>%RM${inp(path,'pct',it.pct,'')}</label>
      ${it.pct?`<label>Marca<select data-p="${path}" data-f="rm" ${ro?'disabled':''}><option value="">—</option>${movs().map(m=>`<option ${m===it.rm?'selected':''}>${esc(m)}</option>`).join('')}</select></label>`:''}
      <label class="it-n">Notas${inp(path,'notas',it.notas,'Tempo, RPE…')}</label>
      ${k&&it.pct?`<span class="pill ${k.falta?'p-warn':'p-ok'}" style="align-self:end">${k.falta?'Falta RM':'= '+k.txt+' kg'}</span>`:''}
      ${ro?'':`<span class="it-a"><button type="button" data-act="up" data-p="${path}" aria-label="Subir">↑</button><button type="button" data-act="down" data-p="${path}" aria-label="Bajar">↓</button><button type="button" data-act="delItem" data-p="${path}" aria-label="Quitar">✕</button></span>`}
    </div>`}).join('');
  return `<datalist id="dl-ej">${Object.values(S.ejs).map(x=>`<option value="${esc(x.nombre)}">`).join('')}</datalist><datalist id="dl-bl">${(S.cfg.bloques||[]).map(b=>`<option value="${esc(b)}">`).join('')}</datalist>
  <div class="form card pad" id="ed-head">
    ${isRut?`<div class="full actions">${e?`<b>${esc(name(e))}</b>`:''}<span class="pill ${R.estado==='activa'?'p-ok':R.estado==='cola'?'p-warn':'p-mute'}">${estLbl[R.estado]||R.estado}</span>${est&&nd&&est!==nd?`<span class="pill p-warn">${nd} días · paga ${est} estímulos</span>`:''}${R.distribucion?'<span class="pill p-lv">Con rotación semanal</span>':''}</div>`:''}
    <label class="full">Nombre<input data-h="nombre" value="${esc(R.nombre||'')}" ${ro?'readonly':''}></label>
    ${isRut?`<label>Entrega sugerida<input type="date" data-h="fechaSugerida" value="${esc(R.fechaSugerida||'')}" ${ro||R.estado!=='cola'?'readonly':''}></label>`:`<label>Tipo<select data-h="tipo"><option value="individual" ${R.tipo!=='equipo'?'selected':''}>Individual</option><option value="equipo" ${R.tipo==='equipo'?'selected':''}>Equipo</option></select></label>`}
    <label>Duración (semanas)<input type="number" min="1" max="16" data-h="duracionSemanas" value="${esc(R.duracionSemanas||4)}" ${ro?'readonly':''}></label>
    <label class="full">Notas para el entrenado<input data-h="notas" value="${esc(R.notas||'')}" placeholder="Ej: entrada en calor 10' antes" ${ro?'readonly':''}></label>
  </div>
  <div class="chips">${R.secciones.map((x,i)=>`<button class="chip" type="button" data-sec="${i}" aria-pressed="${i===E.sec}">${esc(x.titulo||'Sección '+(i+1))}${x.posicion?' · '+esc(x.posicion):''}</button>`).join('')}${ro?'':'<button class="chip" type="button" data-act="addSec">+ Sección</button>'}</div>
  <div class="form card pad">
    <label>Título de la sección<input data-p="${P}" data-f="titulo" value="${esc(s.titulo||'')}" placeholder="Semana 1 y 3" ${ro?'readonly':''}></label>
    <label>Posición (equipos)<select data-p="${P}" data-f="posicion" ${ro?'disabled':''}><option value="">Todas</option>${(S.cfg.posiciones||[]).map(x=>`<option ${keyN(x)===keyN(s.posicion)?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
    ${ro?'':`<div class="full actions"><button class="btn" type="button" data-act="dupSec">Duplicar sección</button><button class="btn" type="button" data-act="addDia">+ Día</button>${R.secciones.length>1?'<button class="btn danger" type="button" data-act="delSec">Quitar sección</button>':''}</div>`}
  </div>
  ${s.dias.map((dia,d)=>`<div class="card dia"><div class="dia-h"><input class="dia-n" data-p="${P},${d}" data-f="nombre" value="${esc(dia.nombre)}" ${ro?'readonly':''}>${ro?'':`<button type="button" class="btn" data-act="addBloque" data-p="${P},${d}">+ Bloque</button><button type="button" class="btn danger" data-act="delDia" data-p="${P},${d}">Quitar día</button>`}</div>
    ${dia.bloques.map((bl,b)=>`<div class="bl"><div class="bl-h"><input list="dl-bl" class="bl-n" data-p="${P},${d},${b}" data-f="nombre" value="${esc(bl.nombre)}" ${ro?'readonly':''}><label>Series<input data-p="${P},${d},${b}" data-f="series" value="${esc(bl.series)}" style="width:56px" ${ro?'readonly':''}></label>${ro?'':`<button type="button" class="x-sm" data-act="delBloque" data-p="${P},${d},${b}" aria-label="Quitar bloque">Quitar</button>`}</div>
      ${items(d,b,bl)}${ro?'':`<button type="button" class="add-it" data-act="addItem" data-p="${P},${d},${b}">+ Ejercicio</button>`}</div>`).join('')}
  </div>`).join('')}
  <div class="actions sticky-save">${ro?'':`<button class="btn pri" type="button" data-act="save">Guardar</button>`}
    ${isRut&&R.estado==='cola'&&E.id?`<button class="wa" type="button" data-entregar="${esc(E.id)}">Entregar ahora</button>`:''}
    ${!isRut&&E.id?`<button class="btn" type="button" data-act="dupPlant">Duplicar plantilla</button>`:''}
    ${E.id?`<button class="btn danger" type="button" data-act="del" style="margin-left:auto">Eliminar</button>`:''}
    <button class="btn" type="button" data-close>Cerrar</button></div>`;
}
function getPath(R,p){const a=p.split(',').map(Number);let o=R.secciones[a[0]];if(a.length>1)o=o.dias[a[1]];if(a.length>2)o=o.bloques[a[2]];if(a.length>3)o=o.items[a[3]];return o}
function rerenderEditor(){const sh=$('.sheet');const st=sh?sh.scrollTop:0;renderSheet();const n=$('.sheet');if(n)n.scrollTop=st}
function bindEditor(){
  const ov=$('#overlay'),E=S.edit,R=E.data;
  ov.onclick=async ev=>{
    if(ev.target===ov||ev.target.closest('[data-close]')){if(E.dirty&&!ov.dataset.warned){ov.dataset.warned=1;toast('Hay cambios sin guardar. Tocá Cerrar de nuevo para descartarlos');return}delete ov.dataset.warned;closeSheet();return}
    const sec=ev.target.closest('[data-sec]');if(sec){E.sec=Number(sec.dataset.sec);rerenderEditor();return}
    const ae=ev.target.closest('[data-addej]');if(ae){openEjSheet(null,{nombre:ae.dataset.addej},true);return}
    const en=ev.target.closest('[data-entregar]');if(en){if(E.dirty)await saveEditor(true);entregar(en.dataset.entregar);return}
    const b=ev.target.closest('[data-act]');if(!b)return;
    const act=b.dataset.act,p=b.dataset.p;
    const S0=R.secciones[E.sec];
    if(act==='save'){saveEditor();return}
    if(act==='del'){if(!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Tocá de nuevo para eliminar';return}
      if(await write(()=>S.db.collection(E.col).doc(E.id).delete())){toast('Eliminada');closeSheet()}return}
    if(act==='dupPlant'){const d=clone(R);d.nombre=(d.nombre||'')+' (copia)';if(await write(()=>S.db.collection('plantillas').add(d))){toast('Plantilla duplicada');closeSheet()}return}
    E.dirty=true;
    if(act==='addSec'){R.secciones.push(newSeccion(Math.max(1,S0?.dias.length||3)));R.secciones.at(-1).titulo='Sección '+R.secciones.length;E.sec=R.secciones.length-1}
    else if(act==='dupSec'){const c=clone(S0);c.uid=ruid();c.titulo=(c.titulo||'')+' (copia)';c.dias.forEach(d=>{d.uid=ruid();d.bloques.forEach(b=>{b.uid=ruid();b.items.forEach(i=>i.uid=ruid())})});R.secciones.splice(E.sec+1,0,c);E.sec++}
    else if(act==='delSec'){R.secciones.splice(E.sec,1);E.sec=Math.max(0,E.sec-1)}
    else if(act==='addDia'){S0.dias.push(newDia(S0.dias.length))}
    else if(act==='delDia'){const a=p.split(',').map(Number);S0.dias.splice(a[1],1)}
    else if(act==='addBloque'){getPath(R,p).bloques.push({uid:ruid(),nombre:'BLOQUE',series:'3',items:[newItem()]})}
    else if(act==='delBloque'){const a=p.split(',').map(Number);getPath(R,a.slice(0,2).join(',')).bloques.splice(a[2],1)}
    else if(act==='addItem'){getPath(R,p).items.push(newItem())}
    else if(['delItem','up','down'].includes(act)){const a=p.split(',').map(Number);const arr=getPath(R,a.slice(0,3).join(',')).items;const i=a[3];
      if(act==='delItem')arr.splice(i,1);else{const j=act==='up'?i-1:i+1;if(j>=0&&j<arr.length)[arr[i],arr[j]]=[arr[j],arr[i]]}}
    rerenderEditor();
  };
  ov.oninput=ev=>{
    const h=ev.target.closest('[data-h]');if(h){R[h.dataset.h]=h.dataset.h==='duracionSemanas'?Number(h.value)||4:h.value;E.dirty=true;return}
    const t=ev.target.closest('[data-p][data-f]');if(!t)return;
    const o=getPath(R,t.dataset.p);o[t.dataset.f]=t.value;E.dirty=true;
  };
  ov.onchange=ev=>{
    const t=ev.target.closest('[data-p][data-f]');if(!t)return;
    const o=getPath(R,t.dataset.p),f=t.dataset.f;
    if(f==='nombre'&&'ej' in o){const id=ejByName()[keyN(o.nombre)]||'';o.ej=id;if(id)o.nombre=S.ejs[id].nombre;if(o.pct&&!o.rm&&id)o.rm=S.ejs[id].rm||'';rerenderEditor()}
    else if(f==='pct'){if(o.pct&&!o.rm&&o.ej)o.rm=S.ejs[o.ej]?.rm||'';rerenderEditor()}
    else if(f==='posicion'||f==='titulo'||f==='rm')rerenderEditor();
  };
}
async function saveEditor(silent){
  const E=S.edit,R=E.data;
  R.secciones.forEach(s=>s.dias.forEach(d=>d.bloques.forEach(b=>{b.items=b.items.filter(i=>(i.nombre||'').trim())})));
  if(E.col==='rutinas'){const e=S.ents[R.entrenadoId];const rot=rotacion(diasDe(R),Number(e?.estimulos),R.duracionSemanas);if(rot)R.distribucion=rot;else delete R.distribucion}
  let ok;
  if(E.id)ok=await write(()=>S.db.collection(E.col).doc(E.id).set(R));
  else{try{const ref=await S.db.collection(E.col).add(R);E.id=ref.id;ok=true}catch(err){toast('No se pudo guardar');ok=false}}
  if(ok){E.dirty=false;if(!silent){toast('Guardado');rerenderEditor()}}
  return ok;
}

/* ----- biblioteca: alta/edición ----- */
function openEjSheet(id,pre,fromEditor){S.ejEdit={id,data:id?clone(S.ejs[id]):{nombre:'',video:'',rm:'',...(pre||{})},back:fromEditor?{...S.edit}:null};openSheet('__ej','edit')}
function ejHTML(){
  const x=S.ejEdit.data;
  return `<form id="ejf" class="form card pad">
    <label class="full">Nombre del ejercicio<input id="ej-n" required value="${esc(x.nombre)}"></label>
    <label class="full">Link del video (YouTube)<input id="ej-v" type="url" value="${esc(x.video)}" placeholder="https://youtube.com/shorts/..."></label>
    <label>Marca RM para calcular kg con %<select id="ej-rm"><option value="">Ninguna</option>${movs().map(m=>`<option ${m===x.rm?'selected':''}>${esc(m)}</option>`).join('')}</select></label>
    <div class="full actions"><button class="btn pri" type="submit">${S.ejEdit.id?'Guardar':'Agregar a la biblioteca'}</button>${S.ejEdit.id?'<button class="btn danger" type="button" id="ej-del">Eliminar</button>':''}<button class="btn" type="button" data-close>Cancelar</button></div></form>`;
}
function bindEj(){
  const ov=$('#overlay');
  const back=()=>{if(S.ejEdit.back){S.edit=S.ejEdit.back;openSheet('__rut','edit')}else closeSheet()};
  ov.onclick=ev=>{if(ev.target===ov||ev.target.closest('[data-close]'))back()};
  ov.oninput=null;ov.onchange=null;
  $('#ejf').addEventListener('submit',async ev=>{ev.preventDefault();
    const d={nombre:$('#ej-n').value.trim(),video:$('#ej-v').value.trim(),rm:$('#ej-rm').value};
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

/* ---------- navegación ---------- */
const VIEWS=['panel','lista','rutinas','ajustes'];
function show(v){
  if(!VIEWS.includes(v))v='panel';S.view=v;
  VIEWS.forEach(k=>$('#v-'+k).hidden=k!==v);
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.view===v?'page':'false'));
  $('#fab').hidden=v!=='panel'&&v!=='lista';
  render();window.scrollTo(0,0);
}
function render(){
  if(S.view==='panel')renderPanel();else if(S.view==='lista')renderLista();else if(S.view==='rutinas')renderRutinas();else if(!document.querySelector('#v-ajustes input:focus'))renderAjustes();
  if(openId&&openId!=='__bulk'&&sheetMode==='ver')renderSheet();
}
document.querySelector('nav.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){if(location.hash!=='#'+b.dataset.view)location.hash=b.dataset.view;else show(b.dataset.view)}});
window.addEventListener('hashchange',()=>show(location.hash.slice(1)));
function handleRut(e){
  const g=k=>e.target.closest('['+k+']');let b;
  if(b=g('data-entregar')){entregar(b.dataset.entregar);return true}
  if(b=g('data-posponer')){openSheet('__posp','edit',b.dataset.posponer);return true}
  if(b=g('data-editrut')){const r=S.rutinas.find(x=>x._id===b.dataset.editrut);if(r){const{_id,...d}=r;openEditor('rutinas',_id,d)}return true}
  if(b=g('data-newrut')){const e2=S.ents[b.dataset.newrut];openEditor('rutinas',null,{entrenadoId:e2.id,nombre:'Rutina '+mesLbl(curMes()),estado:'cola',fechaSugerida:iso(today()),duracionSemanas:4,secciones:[newSeccion(Number(e2.estimulos)||3)],creada:Date.now()});return true}
  if(b=g('data-duprut')){const r=S.rutinas.find(x=>x._id===b.dataset.duprut);if(r){const{_id,...d}=clone(r);Object.assign(d,{estado:'cola',fechaSugerida:iso(today()),fechaEntrega:'',fechaFin:'',pospuesta:null,nombre:(d.nombre||'Rutina')+' (nueva)',creada:Date.now()});openEditor('rutinas',null,d)}return true}
  if(b=g('data-asignar')){const sel=new Set();if(b.dataset.para)sel.add(b.dataset.para);openSheet('__asig','edit',{pid:b.dataset.asignar||'',sel});return true}
  if(b=g('data-editplant')){openEditor('plantillas',b.dataset.editplant,S.plantillas[b.dataset.editplant]);return true}
  if(b=g('data-newplant')){openEditor('plantillas',null,{nombre:'Nueva plantilla',tipo:'individual',duracionSemanas:4,secciones:[newSeccion(3)]});return true}
  if(b=g('data-editej')){openEjSheet(b.dataset.editej);return true}
  if(b=g('data-newej')){openEjSheet(null,{nombre:S.bq||''});return true}
  if(b=g('data-rsub')){S.rsub=b.dataset.rsub;renderRutinas();return true}
  if(b=g('data-goto')){location.hash=b.dataset.goto;return true}
  return false;
}
document.addEventListener('click',e=>{
  if(e.target.closest('#overlay')&&['__rut','__ej','__asig','__posp'].includes(openId))return;
  if(handleRut(e))return;
  if(e.target.closest('#overlay'))return;
  const m=e.target.closest('[data-msg]');if(m){openSheet(m.dataset.msg,'wa',m.dataset.kind);return}
  const b=e.target.closest('[data-bulk]');if(b){startBulk(b.dataset.bulk);return}
  const mc=e.target.closest('[data-mes]');if(mc){S.mes=mc.dataset.mes;renderPanel();window.scrollTo(0,0);return}
  const ci=e.target.closest('[data-cerrar]');if(ci){if(ci.dataset.armed!=='1'){ci.dataset.armed='1';ci.textContent='Confirmar cierre';return}cerrarMes(ci.dataset.cerrar);return}
  const o=e.target.closest('[data-open]');if(o)openSheet(o.dataset.open);
});
$('#fab').addEventListener('click',()=>openSheet('__new','editar'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openId)closeSheet()});
show(location.hash.slice(1)||'panel');

/* ---------- datos ---------- */
(async()=>{
  const db=await window.DBReady;
  S.db=db;
  const got={e:false,h:false,p:false,m:false,r:false,j:false,t:false,g:false};
  const done=()=>{if(Object.values(got).every(Boolean))S.loaded=true;render()};
  const onErr=()=>banner('Se perdió la conexión con la base de datos. Recargá la página.');
  db.collection('entrenados').onSnapshot(s=>{const m={};s.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id}});S.ents=m;got.e=true;done()},onErr);
  db.collection('historial').onSnapshot(s=>{S.hist=s.docs.map(d=>({...d.data(),_id:d.id}));got.h=true;done()},onErr);
  db.collection('pagos').onSnapshot(s=>{S.pagos=s.docs.map(d=>({...d.data(),_id:d.id}));got.p=true;done()},onErr);
  db.collection('meses').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.meses=m;got.m=true;done()},onErr);
  db.collection('rutinas').onSnapshot(s=>{S.rutinas=s.docs.map(d=>({...d.data(),_id:d.id}));got.r=true;done()},onErr);
  db.collection('ejercicios').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.ejs=m;S.ejsV++;got.j=true;done()},onErr);
  db.collection('plantillas').onSnapshot(s=>{const m={};s.docs.forEach(d=>m[d.id]=d.data());S.plantillas=m;got.t=true;done()},onErr);
  db.collection('registros').onSnapshot(s=>{S.regs=s.docs.map(d=>({...d.data(),_id:d.id}));got.g=true;done()},onErr);
  db.doc('config/general').onSnapshot(s=>{S.cfgRaw=s.exists?s.data():{};S.cfg=normCfg(s.exists?s.data():null);render()},onErr);
})();
})();
