/* entrená. · Copiar equipo para Claude
   Pedido grupal: la rutina del equipo con sus secciones por posición + los jugadores elegidos
   (solo ID, sin nombres) + el contexto competitivo. Archivo independiente: se carga después
   de app.js, lee la base con window.DBReady y no modifica nada de la app.
   Botones: Rutinas → Plantillas (“Copiar equipo para Claude” y “Para Claude” en cada plantilla)
   y Rutinas → Entregas (al lado de “Asignar plantilla…”). */
(function(){
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const parse=s=>{if(!s)return null;const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)};
  const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
  const addD=(s,n)=>{const d=parse(s)||today();d.setDate(d.getDate()+n);return iso(d)};
  const days=(a,b)=>Math.round((parse(a)-parse(b))/864e5);
  const keyN=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const titleCase=s=>String(s||'').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
  const nm=e=>titleCase(e.nombre);
  const isAct=e=>(e.estado==='Inactivo'?'Baja':(e.estado||'Activo'))==='Activo';
  const plural=(n,a,b)=>n+' '+(n===1?a:b);
  const num=v=>String(+(+v).toFixed(1)).replace('.',',');
  const PREF='entrena.equipoClaude';
  const CTX_DEF='Quedan 2 partidos del año en los próximos 15 días. Si no ganamos, descendemos. Prioridad: llegar frescos y explosivos a cada partido, mantener la fuerza sin sumar fatiga ni riesgo de lesión.';
  let DB=null,D=null,A=null;

  function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)}
  function copyTxt(t){const fb=()=>{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0;top:0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(x){}ta.remove();return ok};
    const p=navigator.clipboard?.writeText(t);if(p)return p.then(()=>true,()=>fb());return Promise.resolve(fb())}
  const prefs=()=>{try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{}}catch(x){return {}}};
  const guardarPrefs=()=>{try{localStorage.setItem(PREF,JSON.stringify({ctx:A.ctx,partidos:A.partidos,sem:A.sem,dias:A.dias,g:A.g,base:A.base}))}catch(x){}};

  /* ---------- datos ---------- */
  async function cargar(){
    if(!DB)DB=await window.DBReady;
    const cols=['entrenados','rutinas','plantillas','registros','historial'];
    const [en,ru,pl,rg,hi]=await Promise.all(cols.map(c=>DB.collection(c).get()));
    const cs=await DB.doc('config/general').get();const cfg=(cs.exists&&cs.data())||{};
    const ents={};en.docs.forEach(d=>ents[d.id]={...d.data(),id:d.id});
    const plant={};pl.docs.forEach(d=>plant[d.id]=d.data());
    const lst=s=>s.docs.map(d=>({...d.data(),_id:d.id}));
    D={ents,rutinas:lst(ru),plantillas:plant,regs:lst(rg),hist:lst(hi),
      posiciones:Array.isArray(cfg.posiciones)?cfg.posiciones:['Extremo','Pivote','Armador','Arquero'],
      rmDefs:Array.isArray(cfg.rmDefs)?cfg.rmDefs:[]};
    D.items={};D.rutinas.forEach(r=>(r.secciones||[]).forEach(s=>(s.dias||[]).forEach(d=>(d.bloques||[]).forEach(b=>(b.items||[]).forEach(i=>{if(i.uid)D.items[i.uid]=i.nombre})))));
  }
  const rutDe=id=>D.rutinas.filter(r=>r.entrenadoId===id);
  const ultimaDe=id=>{const R=rutDe(id);
    return R.filter(r=>r.estado==='activa').sort((a,b)=>(b.fechaEntrega||'').localeCompare(a.fechaEntrega||''))[0]
      ||R.filter(r=>r.estado==='finalizada').sort((a,b)=>(b.fechaFin||'').localeCompare(a.fechaFin||''))[0]
      ||R.filter(r=>r.estado==='cola').sort((a,b)=>(b.fechaSugerida||'').localeCompare(a.fechaSugerida||''))[0]||null};
  function rmValue(e,mov,depth=0){if(!e||!mov||depth>5)return null;const v=Number((e.rm||{})[mov]);if(v>0)return v;
    const d=D.rmDefs.find(x=>x.mov===mov);if(d&&d.base){const b=rmValue(e,d.base,depth+1);return b?b*Number(d.factor||1):null}return null}
  const especial=r=>/^(asis|carga|bien):/.test(String(r.item||''));
  const posIdx=p=>{const i=D.posiciones.findIndex(x=>keyN(x)===keyN(p));return i<0?99:i};
  const ordenPos=arr=>[...arr].sort((a,b)=>(!a)-(!b)||posIdx(a)-posIdx(b)||a.localeCompare(b));
  const posCanon=p=>D.posiciones.find(x=>keyN(x)===keyN(p))||p||'';
  function mejoresCargas(id,desde){const g={};
    D.regs.filter(r=>r.entrenadoId===id&&!especial(r)&&(r.fecha||'')>=desde).forEach(r=>{const kg=parseFloat(String(r.kg||'').replace(',','.'));if(!(kg>0))return;
      const n=r.nombre||D.items[r.item]||'';if(!n)return;const k=keyN(n);if(!g[k]||kg>g[k].kg)g[k]={n,kg,reps:String(r.reps||'').trim()}});
    return Object.values(g).sort((a,b)=>b.kg-a.kg)}
  const asistencia=(id,desde)=>new Set(D.regs.filter(r=>r.entrenadoId===id&&String(r.item||'').startsWith('asis:')&&(r.fecha||'')>=desde).map(r=>r.fecha+r.item)).size;
  function wellness(id,desde){let s=0,n=0,bajos=0;
    D.regs.filter(r=>r.entrenadoId===id&&r.tipo==='bien'&&(r.fecha||'')>=desde).forEach(r=>{const x=r.datos||{};
      const v=['sueno','fatiga','dolor','estres','animo'].map(k=>Number(x[k]||(k==='dolor'?x.cuerpo:0))).filter(Boolean);if(!v.length)return;
      s+=v.reduce((a,b)=>a+b,0)/v.length;n++;if(Math.min(...v)<=2)bajos++});
    return n?{n,prom:s/n,bajos}:null}
  function carga(id){const m={};D.regs.filter(r=>r.entrenadoId===id&&r.tipo==='carga').forEach(r=>{const v=(Number(r.datos?.min)||0)*(Number(r.datos?.rpe)||0);if(v)m[r.fecha]=(m[r.fecha]||0)+v});
    const ks=Object.keys(m).sort();if(!ks.length)return null;const hoy=iso(today());let ag=0,cr=0;
    for(let i=0;i<28;i++){const v=m[addD(hoy,-i)]||0;if(i<7)ag+=v;cr+=v}const c=cr/4;
    return {ag:Math.round(ag),r:c>0&&days(hoy,ks[0])>=21?ag/c:null}}
  function anonimizador(ents){const pares=[];
    ents.forEach(e=>{const n=String(e.nombre||'').trim();if(!n)return;pares.push([n,e.id]);n.split(/\s+/).filter(x=>x.length>2).forEach(p=>pares.push([p,e.id]))});
    pares.sort((a,b)=>b[0].length-a[0].length);const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return t=>{let x=String(t||'');pares.forEach(([n,id])=>{x=x.replace(new RegExp('(^|[^\\p{L}])'+rx(n)+'(?=$|[^\\p{L}])','giu'),'$1'+id)});return x}}
  const itemVacio=i=>!['nombre','reps','kg','pct','notas'].some(k=>String(i[k]??'').trim());
  function limpia(R){const n=v=>v==null||v===''?undefined:Number(v);
    return {entrena:'rutina',v:1,tipo:'equipo',nombre:R.nombre||'',duracionSemanas:Number(R.duracionSemanas)||4,notas:R.notas||'',
      opciones:{bienestar:!!R.bienestar,ajusteWellness:!!R.ajusteWellness,controlCarga:!!R.controlCarga},
      secciones:(R.secciones||[]).map(s=>({titulo:s.titulo||'',posicion:s.posicion||'',dias:(s.dias||[]).map(d=>({nombre:d.nombre||'',bloques:(d.bloques||[]).map(b=>{
        const o={nombre:b.nombre||'',series:String(b.series??'')};
        if(b.modo==='timer'){o.modo='timer';o.trabajo=n(b.trabajo)??40;o.descanso=n(b.descanso)??20;o.vueltas=n(b.vueltas)??3;o.pausa=n(b.pausa)??0}
        o.items=(b.items||[]).filter(i=>!itemVacio(i)).map(i=>{const x={nombre:i.nombre||''};['reps','kg','pct','rm','notas'].forEach(k=>{if(String(i[k]??'').trim())x[k]=String(i[k])});return x});
        return o})}))}))}}

  /* base: una plantilla, o la última rutina de cada posición entre los elegidos */
  function base(ents){
    if(A.base.startsWith('p:')){const p=D.plantillas[A.base.slice(2)];return p?{...p,origen:'plantilla “'+(p.nombre||'Plantilla')+'”'}:null}
    const porPos={};ents.forEach(e=>{const r=ultimaDe(e.id);if(!r)return;const k=posCanon(e.posicion);const c=porPos[k];
      if(!c||(r.fechaEntrega||r.fechaSugerida||'')>(c.fechaEntrega||c.fechaSugerida||''))porPos[k]=r});
    const ks=ordenPos(Object.keys(porPos));if(!ks.length)return null;const secs=[];
    ks.forEach(k=>(porPos[k].secciones||[]).filter(s=>!k||!s.posicion||keyN(s.posicion)===keyN(k)).forEach(s=>secs.push({...s,posicion:s.posicion?posCanon(s.posicion):k})));
    const r0=porPos[ks.find(k=>k)||ks[0]];
    return {...r0,secciones:secs,origen:'última rutina de cada posición ('+ks.map(k=>k||'sin posición').join(', ')+')'}}

  /* ---------- texto para Claude ---------- */
  function texto(){
    const ents=[...A.sel].map(id=>D.ents[id]).filter(Boolean),anon=anonimizador(ents),B=base(ents);
    const hoy=iso(today()),d28=addD(hoy,-28),d60=addD(hoy,-60),marcas=D.rmDefs.map(x=>x.mov).filter(Boolean);
    const L=[];
    L.push('PEDIDO DE RUTINA DE EQUIPO · entrená. (seguí la Guía metodológica y la Guía de pedidos de equipo del proyecto)');
    L.push(`Grupo: ${anon(A.g)||'—'} · Fecha: ${hoy} · ${plural(ents.length,'jugador','jugadores')}`);
    L.push('Posiciones válidas (en "posicion" usá estos nombres exactos): '+D.posiciones.join(', '));
    L.push('','CONTEXTO: '+(anon(A.ctx).replace(/\s+/g,' ').trim()||'—'));
    const ps=A.partidos.filter(Boolean).sort();
    if(ps.length)L.push('Partidos: '+ps.map((f,i)=>{const n=days(f,hoy);return `${i+1}) ${f} (${n>0?'en '+n+' días':n===0?'hoy':'hace '+(-n)+' días'})`}).join(' · '));
    if(String(A.dias||'').trim())L.push('Días de entrenamiento del equipo: '+anon(A.dias).trim());
    L.push(`Duración de la rutina: ${A.sem} ${Number(A.sem)===1?'semana':'semanas'}`);
    L.push('Marcas RM: '+(marcas.join(', ')||'ninguna'));
    L.push('','JUGADORES (sin nombres, solo ID)');
    const G={};ents.forEach(e=>{const k=posCanon(e.posicion);(G[k]=G[k]||[]).push(e)});
    ordenPos(Object.keys(G)).forEach(k=>{
      L.push('',`== ${k?k.toUpperCase():'SIN POSICIÓN (recibe todas las secciones)'} · ${G[k].length} ==`);
      G[k].sort((x,y)=>x.id.localeCompare(y.id)).forEach(e=>{
        const rms=marcas.map(m=>{const v=rmValue(e,m);return v?`${m} ${num(v)} kg`:''}).filter(Boolean);
        const as=asistencia(e.id,d28),w=wellness(e.id,d28),c=carga(e.id),est=Number(e.estimulos)||0;
        L.push(`- ${e.id} · ${e.nivel||'nivel sin definir'} · ${est||'?'}×/sem · RM: ${rms.join('; ')||'sin cargar'}`);
        L.push(`  Asistencia 4 sem: ${as}/${est*4||'?'}`+(w?` · Wellness 4 sem: prom. ${num(w.prom)}/5, ${w.bajos} de ${w.n} días con algún ítem ≤2`:'')+(c?` · Carga 7 d: ${c.ag} UA${c.r!=null?`, aguda/crónica ${num(c.r)}`:''}`:''));
        D.hist.filter(h=>h.entrenadoId===e.id&&(h.fecha||'')>=d60&&/^(Lesión|Ausencia|Evaluación física|Meta)$/.test(h.tipo||''))
          .sort((x,y)=>(y.fecha||'').localeCompare(x.fecha||'')).slice(0,4).forEach(h=>L.push(`  ${h.fecha} · ${h.tipo}: ${anon(h.detalle)}`));
        if(String(e.obs||'').trim())L.push('  Obs.: '+anon(e.obs).replace(/\s+/g,' '));
        const r=ultimaDe(e.id),cg=mejoresCargas(e.id,r?.fechaEntrega||addD(hoy,-35)).slice(0,6);
        if(cg.length)L.push('  Mejores cargas anotadas: '+cg.map(x=>`${x.n} ${num(x.kg)} kg${x.reps?' × '+x.reps:''}`).join('; '));
      })});
    L.push('',`RUTINA ANTERIOR DEL EQUIPO · ${B?anon(B.origen):'—'} (formato de importación):`);
    if(B){L.push('```json');L.push(JSON.stringify(limpia({...B,nombre:anon(B.nombre),notas:anon(B.notas)})));L.push('```')}else L.push('Sin rutina base.');
    L.push('','Pedido: armá la rutina nueva del equipo siguiendo la anterior, con las secciones de cada posición, adaptada al contexto y a los partidos. (agregá acá lo que quieras)');
    return L.join('\n');
  }

  /* ---------- hoja ---------- */
  function html(){
    const grupos=[...new Set(Object.values(D.ents).filter(isAct).map(e=>e.grupo).filter(Boolean))].sort();
    const q=keyN(A.q);
    const list=Object.values(D.ents).filter(isAct).filter(e=>A.sel.has(e.id)||((!A.g||e.grupo===A.g)&&(!q||keyN(e.nombre).includes(q))))
      .sort((a,b)=>(A.sel.has(b.id)-A.sel.has(a.id))||posIdx(a.posicion||'~')-posIdx(b.posicion||'~')||nm(a).localeCompare(nm(b),'es'));
    const ents=[...A.sel].map(id=>D.ents[id]).filter(Boolean),B=base(ents);
    const cnt={};ents.forEach(e=>{const k=posCanon(e.posicion)||'Sin posición';cnt[k]=(cnt[k]||0)+1});
    const bPos=B?[...new Set((B.secciones||[]).map(s=>s.posicion||''))]:[];
    const faltan=B?Object.keys(cnt).filter(k=>k!=='Sin posición'&&!bPos.some(p=>!p||keyN(p)===keyN(k))):[];
    const pls=Object.entries(D.plantillas).sort((a,b)=>((b[1].tipo==='equipo')-(a[1].tipo==='equipo'))||(a[1].nombre||'').localeCompare(b[1].nombre||''));
    const secLbl=B?(B.secciones||[]).map(s=>esc((s.titulo||'Sección')+(s.posicion?' · '+s.posicion:''))).join(' / '):'';
    return `<form id="iq-f" class="form">
    <p class="hint full" style="margin:0">Copia en un solo texto la rutina del equipo con sus secciones por posición, los datos de cada jugador elegido (sin nombres, solo ID) y el contexto. Lo pegás en el proyecto de Claude y te devuelve la plantilla nueva.</p>
    <label class="full">Rutina base<select id="iq-base"><option value="act" ${A.base==='act'?'selected':''}>Última rutina de cada posición (de los jugadores elegidos)</option>${pls.map(([id,p])=>`<option value="p:${esc(id)}" ${A.base==='p:'+id?'selected':''}>${p.tipo==='equipo'?'Equipo · ':''}${esc(p.nombre||'Plantilla')}</option>`).join('')}</select></label>
    <div class="full card pad" style="font-size:14px;line-height:1.5">${B?`<span class="pill p-ok">Base</span> ${esc(B.origen)}<br><span class="hint">${secLbl}</span>`:`<span class="pill p-bad">Sin base</span> Ninguno de los elegidos tiene rutina en la app. Elegí una plantilla.`}${faltan.length?`<br><span class="pill p-warn">Sin sección en la base</span> ${faltan.map(esc).join(', ')}: Claude la arma de cero.`:''}${cnt['Sin posición']?`<br><span class="pill p-warn">Sin posición</span> ${plural(cnt['Sin posición'],'jugador','jugadores')}: cargá la posición en su ficha o recibe todas las secciones.`:''}</div>
    <label class="full">Contexto del equipo<textarea id="iq-ctx" rows="3">${esc(A.ctx)}</textarea></label>
    ${A.partidos.map((f,i)=>`<label>Partido ${i+1}<input type="date" data-iqp="${i}" value="${esc(f)}"></label>`).join('')}
    <div class="full actions" style="margin-top:-4px"><button class="btn" type="button" data-iq="addp" style="padding:5px 10px;font-size:13px">+ Partido</button></div>
    <label>Duración de la rutina (semanas)<input id="iq-sem" type="number" min="1" max="8" value="${esc(A.sem)}"></label>
    <label>Días de entrenamiento del equipo (opcional)<input id="iq-dias" value="${esc(A.dias)}" placeholder="Ej: lun y mié gimnasio · mar y jue cancha"></label>
    <div class="full"><span class="lbl-s">Jugadores</span><div class="chips">${grupos.map(g=>`<button class="chip" type="button" data-iqg="${esc(g)}" aria-pressed="${A.g===g}">Todo ${esc(g)}</button>`).join('')}<button class="chip" type="button" data-iq="todos" aria-pressed="${!A.g}">Ver todos</button><button class="chip" type="button" data-iq="none">Ninguno</button></div></div>
    <input id="iq-q" class="full search" type="search" placeholder="Buscar jugador" value="${esc(A.q)}" autocomplete="off">
    <div class="full card iq-list" style="max-height:320px;overflow:auto">${list.length?`<ul class="alist">${list.map(e=>`<li><label style="display:flex;flex-direction:row;gap:10px;align-items:center;flex:1;text-transform:none;letter-spacing:0;font-size:15px;color:var(--ink);font-weight:500"><input type="checkbox" data-iqs="${esc(e.id)}" ${A.sel.has(e.id)?'checked':''} style="width:auto">${esc(nm(e))}</label><span class="meta">${e.posicion?`<span class="pill p-lv">${esc(posCanon(e.posicion))}</span>`:'<span class="pill p-warn">Sin posición</span>'} ${esc(e.estimulos||'?')}×</span></li>`).join('')}</ul>`:'<div class="empty">No hay entrenados activos con ese filtro.</div>'}</div>
    <p class="hint full" style="margin:0">${Object.keys(cnt).length?ordenPos(Object.keys(cnt).filter(k=>k!=='Sin posición')).concat(cnt['Sin posición']?['Sin posición']:[]).map(k=>`${esc(k)} ${cnt[k]}`).join(' · '):'Ningún jugador elegido.'}</p>
    <div class="full actions"><button class="btn pri" type="submit">Copiar para Claude (${A.sel.size})</button><button class="btn" type="button" data-iq="close">Cancelar</button></div>
    <p class="hint full" style="margin:0">Después: pegá el texto en el proyecto de Claude. Con el bloque que te devuelve: Plantillas → Nueva plantilla → Importar rutina → Guardar, y Asignar → “Todo ${esc(A.g||'el grupo')}”. A cada jugador le llega solo la sección de su posición.</p>
    </form>`;
  }
  function overlay(){let ov=$('#iq-ov');if(ov)return ov;
    ov=document.createElement('div');ov.id='iq-ov';ov.className='overlay';ov.hidden=true;ov.style.display='none';document.body.appendChild(ov);
    ov.addEventListener('click',ev=>{if(ev.target===ov){cerrar();return}const b=ev.target.closest('[data-iq],[data-iqg]');if(!b||!D)return;leer();
      if(b.dataset.iqg!=null){A.g=b.dataset.iqg;Object.values(D.ents).filter(e=>isAct(e)&&e.grupo===A.g).forEach(e=>A.sel.add(e.id));render();return}
      const k=b.dataset.iq;if(k==='close')cerrar();else if(k==='none'){A.sel.clear();render()}else if(k==='todos'){A.g='';render()}else if(k==='addp'){A.partidos.push('');render()}});
    ov.addEventListener('change',ev=>{if(!D)return;const c=ev.target.closest('[data-iqs]');if(c){leer();c.checked?A.sel.add(c.dataset.iqs):A.sel.delete(c.dataset.iqs);render();return}
      if(ev.target.id==='iq-base'){leer();A.base=ev.target.value;render()}});
    ov.addEventListener('input',ev=>{if(ev.target.id!=='iq-q')return;leer();const p=ev.target.selectionStart;render();const n=$('#iq-q');if(n){n.focus();n.setSelectionRange(p,p)}});
    ov.addEventListener('submit',ev=>{ev.preventDefault();leer();
      if(!A.sel.size){toast('Elegí al menos un jugador');return}
      if(!base([...A.sel].map(id=>D.ents[id]).filter(Boolean))){toast('No hay rutina base: elegí una plantilla');return}
      guardarPrefs();copyTxt(texto()).then(ok=>{toast(ok?'Copiado: pegalo en el proyecto de Claude':'No se pudo copiar');if(ok)cerrar()})});
    return ov}
  function leer(){if(!$('#iq-f'))return;A.ctx=$('#iq-ctx').value;A.sem=Math.max(1,Math.min(8,Number($('#iq-sem').value)||2));A.dias=$('#iq-dias').value;A.q=$('#iq-q').value;
    document.querySelectorAll('[data-iqp]').forEach(x=>A.partidos[Number(x.dataset.iqp)]=x.value)}
  function render(){const ov=overlay();const sh=ov.querySelector('.sheet'),st=sh?sh.scrollTop:0,ls=ov.querySelector('.iq-list')?.scrollTop||0;
    ov.innerHTML=`<div class="sheet wide" role="dialog" aria-modal="true" aria-label="Copiar equipo para Claude"><div class="sheet-h"><h3>Copiar equipo para Claude</h3><button class="x" type="button" data-iq="close" aria-label="Cerrar">×</button></div><div class="sheet-b">${D?html():'<div class="empty">Cargando…</div>'}</div></div>`;
    ov.hidden=false;ov.style.display='';document.body.style.overflow='hidden';const n=ov.querySelector('.sheet');if(n)n.scrollTop=st;const l=ov.querySelector('.iq-list');if(l)l.scrollTop=ls}
  function cerrar(){const ov=$('#iq-ov');if(!ov)return;ov.hidden=true;ov.style.display='none';ov.innerHTML='';if($('#overlay')?.hidden!==false)document.body.style.overflow=''}
  async function abrir(pid){
    const p=prefs();A={base:pid?'p:'+pid:(p.base||'act'),g:'',sel:new Set(),q:'',ctx:p.ctx??CTX_DEF,partidos:Array.isArray(p.partidos)&&p.partidos.length?p.partidos:['',''],sem:p.sem||2,dias:p.dias||''};
    D=null;render();
    try{await cargar()}catch(x){console.error(x);cerrar();toast('No se pudieron leer los datos. Probá de nuevo.');return}
    if(A.base.startsWith('p:')&&!D.plantillas[A.base.slice(2)])A.base='act';
    const grupos=[...new Set(Object.values(D.ents).filter(isAct).map(e=>e.grupo).filter(Boolean))];
    A.g=p.g&&grupos.includes(p.g)?p.g:(grupos.find(g=>/hand|afalp/i.test(g))||'');
    if(A.g)Object.values(D.ents).filter(e=>isAct(e)&&e.grupo===A.g).forEach(e=>A.sel.add(e.id));
    render();
  }

  /* ---------- botones en Rutinas ---------- */
  const mk=(txt,pid,small)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.iqopen=pid||'';b.textContent=txt;if(small)b.style.cssText='padding:5px 8px;font-size:13px';return b};
  function inyectar(){const v=$('#v-rutinas');if(!v)return;
    const np=v.querySelector('[data-newplant]');if(np&&!np.parentElement.querySelector('[data-iqopen]'))np.after(mk('Copiar equipo para Claude'));
    const as=v.querySelector('.btn.pri[data-asignar=""]');if(as&&!as.parentElement.querySelector('[data-iqopen]'))as.after(mk('Copiar equipo para Claude'));
    v.querySelectorAll('[data-editplant]').forEach(x=>{const wrap=x.parentElement;if(wrap&&!wrap.querySelector('[data-iqopen]'))x.before(mk('Para Claude',x.dataset.editplant,true))})}
  document.addEventListener('click',ev=>{const b=ev.target.closest('[data-iqopen]');if(!b)return;ev.preventDefault();ev.stopPropagation();abrir(b.dataset.iqopen)},true);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&$('#iq-ov')&&!$('#iq-ov').hidden)cerrar()});
  const v=$('#v-rutinas');if(v){new MutationObserver(inyectar).observe(v,{childList:true,subtree:true});inyectar()}
})();
