/* ===== Rutinas en PDF (A4, una hoja por rutina) — sin librerías externas ===== */
const RutinaPDF=(function(){
const HW=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const HBW=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

const W=595.28,H=841.89,M=28;
const SPECIAL={'€':128,'‚':130,'„':132,'…':133,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'™':153};
function enc(s){let o='';for(const ch of String(s??'')){let c=ch.codePointAt(0);if(SPECIAL[ch])c=SPECIAL[ch];else if(c>255||(c>=127&&c<160))c=63;
  const x=String.fromCharCode(c);o+=x==='('||x===')'||x==='\\'?'\\'+x:x}return o}
function tw(s,size,bold){const t=bold?HBW:HW;let w=0;for(const ch of String(s??'')){let c=ch.codePointAt(0);if(SPECIAL[ch])c=SPECIAL[ch];else if(c>255)c=63;w+=t[c]||556}return w*size/1000}
function fit(s,maxW,size,bold,minSize){s=String(s??'');let z=size;while(z>minSize&&tw(s,z,bold)>maxW)z-=0.25;
  if(tw(s,z,bold)<=maxW)return {s,z};let t=s;while(t.length>1&&tw(t+'…',z,bold)>maxW)t=t.slice(0,-1);return {s:t+'…',z}}
function wrap(s,maxW,size,bold){const words=String(s??'').split(/\s+/).filter(Boolean),lines=[];let cur='';
  for(const w of words){const t=cur?cur+' '+w:w;if(tw(t,size,bold)<=maxW)cur=t;else{if(cur)lines.push(cur);cur=w}}if(cur)lines.push(cur);return lines}
const hex=c=>{c=c.replace('#','');return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255)};
const col=(c,f)=>{if(c==null)return '';if(typeof c==='string')c=hex(c);if(Array.isArray(c))return c.map(v=>v.toFixed(3)).join(' ')+(f?' rg ':' RG ');return c.toFixed(2)+(f?' g ':' G ')};
function Page(){const ops=[];const y=v=>(H-v).toFixed(2);
  return {ops,
    text(x,top,s,size,bold,gray){ops.push(`BT /${bold?'F2':'F1'} ${size.toFixed(2)} Tf ${col(gray??0,true)}${x.toFixed(2)} ${y(top)} Td (${enc(s)}) Tj ET`)},
    rect(x,top,w,h,fill,stroke,lw){ops.push(`${(lw??0.5).toFixed(2)} w ${col(fill,true)}${col(stroke,false)}${x.toFixed(2)} ${y(top+h)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill!=null&&stroke!=null?'B':fill!=null?'f':'S'}`)},
    line(x1,t1,x2,t2,lw,gray){ops.push(`${lw.toFixed(2)} w ${col(gray??0,false)}${x1.toFixed(2)} ${y(t1)} m ${x2.toFixed(2)} ${y(t2)} l S`)},
    poly(pts,fill,stroke,lw,close){if(!pts.length)return;ops.push(`${(lw??0.5).toFixed(2)} w 1 J 1 j ${col(fill,true)}${col(stroke,false)}${pts.map((p,i)=>`${p[0].toFixed(2)} ${y(p[1])} ${i?'l':'m'}`).join(' ')} ${close===false?'':'h '}${fill!=null&&stroke!=null?'B':fill!=null?'f':'S'}`)},
    arc(cx,cy,r0,r1,a0,a1,fill){const n=Math.max(6,Math.ceil(Math.abs(a1-a0)/0.08));const pts=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push([cx+r1*Math.cos(a),cy+r1*Math.sin(a)])}
      for(let i=n;i>=0;i--){const a=a0+(a1-a0)*i/n;pts.push([cx+r0*Math.cos(a),cy+r0*Math.sin(a)])}this.poly(pts,fill,null)}}}
// marca entrená. alineada a la derecha en xr
function marca(p,xr,top,sz){const fs=sz*0.85,w1=tw('entrená',fs,true),w2=tw('.',fs,true);const x0=xr-(sz+4+w1+w2);
  p.rect(x0,top,sz,sz,'#C8F23A',null);p.text(x0+sz*0.16,top+sz*0.8,'e',sz*1.02,true,'#0C0F0E');
  const cx=x0+sz*0.82,cy=top+sz*0.73,r=sz*0.11,c=[];for(let i=0;i<20;i++){const a=i/20*Math.PI*2;c.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}p.poly(c,'#FFFFFF','#0C0F0E',Math.max(0.4,sz*0.04));
  p.text(x0+sz+4,top+sz*0.82,'entrená',fs,true,'#0C0F0E');p.text(x0+sz+4+w1,top+sz*0.82,'.',fs,true,'#6E8A12');return x0}
function pdfBytes(pages,title){
  const objs=[];const add=s=>{objs.push(s);return objs.length};
  const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pagesId=objs.length+1;objs.push(null);
  const kids=[];
  for(const p of pages){const c=p.ops.join('\n');const cid=add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cid} 0 R >>`))}
  objs[pagesId-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const info=add(`<< /Title (${enc(title)}) /Producer (CRM Entrenados) >>`);
  const cat=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offs=[];
  objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
  const x=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('');
  out+=`trailer\n<< /Size ${objs.length+1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${x}\n%%EOF`;
  const b=new Uint8Array(out.length);for(let i=0;i<out.length;i++)b[i]=out.charCodeAt(i)&255;return b;
}
function fmtTel(t){const d=String(t||'').replace(/\D/g,'');if(/^549\d{10}$/.test(d)){const r=d.slice(3);const a=r.startsWith('11')?2:(r.length-8);return `+54 9 ${r.slice(0,a)} ${r.slice(a,r.length-4)}-${r.slice(-4)}`}return t||''}
const fmtD=s=>{if(!s)return '';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`};
const tc=s=>String(s||'').toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());

/* r: rutina, e: entrenado, kgFn(item)->texto */
function build(r,e,kgFn){
  const secs=(r.secciones||[]).map(s=>({...s,dias:(s.dias||[]).map(d=>({...d,bloques:(d.bloques||[]).map(b=>({...b,items:(b.items||[]).filter(i=>(i.nombre||'').trim())})).filter(b=>b.items.length)})).filter(d=>d.bloques.length)})).filter(s=>s.dias.length);
  const sem=Math.min(Math.max(Number(r.duracionSemanas)||4,1),6);
  const nd=Math.max(0,...secs.map(s=>s.dias.length));
  const pages=[];
  const CW=W-2*M;
  const colsW=[0.34,0.08,0.09,0.19].map(f=>f*CW);const sW=(CW-colsW.reduce((a,b)=>a+b,0))/sem;
  const colX=[M];colsW.forEach(w=>colX.push(colX.at(-1)+w));for(let i=1;i<sem;i++)colX.push(colX.at(-1)+sW);colX.push(M+CW);
  function header(p,secTitle){
    let t=M;
    p.text(M,t+16,fit(tc(e.nombre),CW*0.62,19,true,12).s,fit(tc(e.nombre),CW*0.62,19,true,12).z,true);
    const tel=fmtTel(e.telefono);const right=[tel?'Tel: '+tel:'',[r.fechaEntrega||r.fechaSugerida?'Desde el '+fmtD(r.fechaEntrega||r.fechaSugerida):'',`${sem} semanas · ${nd} días`+(e.estimulos?` · ${e.estimulos} por semana`:'')].filter(Boolean).join(' · ')];
    right.forEach((s,i)=>{if(!s)return;const z=8.3;p.text(M+CW-tw(s,z,i===0),t+9+i*11,s,z,i===0,i===0?0:0.25)});
    const rn=fit(r.nombre||'Rutina',CW*0.62,10.5,true,8);p.text(M,t+30,rn.s,rn.z,true,0.15);
    t+=37;p.line(M,t,M+CW,t,1.8,0);t+=7;
    // indicaciones
    const notes=(r.notas||'').trim();const dist=r.distribucion&&r.distribucion.length?r.distribucion:null;
    if(notes||dist){
      const z=8.2;const lines=notes?wrap(notes,CW-16,z,false).slice(0,3):[];
      const distTxt=dist?dist.map((w,i)=>`Sem ${i+1}: ${w.map(x=>(secs[0]?.dias[x]?.nombre)||('Día '+(x+1))).join(' y ')}`):[];
      const distLines=[];let cur='';for(const d of distTxt){const tt=cur?cur+'     '+d:d;if(tw(tt,z,false)<=CW-16)cur=tt;else{distLines.push(cur);cur=d}}if(cur)distLines.push(cur);
      const h=8+lines.length*10.5+(dist?11+distLines.length*10.5:0)+2;
      p.rect(M,t,CW,h,0.95,0.6,0.6);p.rect(M,t,2.5,h,0,null);
      let yy=t+11;lines.forEach(l=>{p.text(M+9,yy,l,z,false);yy+=10.5});
      if(dist){if(lines.length)yy+=2;p.text(M+9,yy,'Qué día hacer cada semana',z,true);yy+=10.5;distLines.forEach(l=>{p.text(M+9,yy,l,z,false);yy+=10.5})}
      t+=h+5;
    }
    p.text(M,t+7,'En las columnas S1, S2… anotá los kg que usaste cada semana.',7.4,false,0.35);t+=12;
    if(secTitle){p.text(M,t+10,secTitle.toUpperCase(),11,true);t+=13;p.line(M,t,M+CW,t,0.6,0);t+=4}
    return t;
  }
  const FOOT=18;
  function footer(p,n,total){
    const s='Cansancio (RPE): 1–3 muy fácil · 4–5 moderado · 6–7 difícil pero controlado · 8 muy difícil (quedan 2 reps) · 9 casi al máximo · 10 máximo';
    p.line(M,H-M-FOOT+4,M+CW,H-M-FOOT+4,0.5,0.6);const xm=marca(p,M+CW,H-M-FOOT+6,10);const hj=total>1?`Hoja ${n} de ${total}`:'';
    if(hj)p.text(xm-10-tw(hj,6.8,false),H-M-FOOT+13,hj,6.8,false,0.3);const f=fit(s,xm-M-(hj?tw(hj,6.8,false)+24:14),6.8,false,5);p.text(M,H-M-FOOT+13,f.s,f.z,false,0.3);
  }
  function drawDays(p,top,dias,rowH,fz){
    let t=top;const DH=Math.max(12,rowH*1.15),CH=Math.max(9,rowH*0.8),BH=Math.max(8.5,rowH*0.82);
    for(const d of dias){
      p.rect(M,t,CW,DH,0,null);p.text(M+5,t+DH*0.72,(d.nombre||'').toUpperCase(),Math.min(10.5,DH*0.68),true,1);t+=DH;
      p.rect(M,t,CW,CH,0.88,null);const hz=Math.min(6.6,CH*0.62);
      ['EJERCICIO','REPS','KG','NOTAS'].concat(Array.from({length:sem},(_,i)=>'S'+(i+1))).forEach((h,i)=>{const x=i<4?colX[i]+3:colX[i]+(colX[i+1]-colX[i]-tw(h,hz,true))/2;p.text(x,t+CH*0.7,h,hz,true,0.2)});
      t+=CH;
      for(const b of d.bloques){
        p.rect(M,t,CW,BH,0.94,null);const bz=Math.min(7.2,BH*0.68);const bn=(b.nombre||'').toUpperCase();p.text(M+3,t+BH*0.72,bn,bz,true,0.1);
        const bt=b.modo==='timer'?`· POR TIEMPO: ${b.trabajo||40}" trabajo / ${b.descanso||20}" descanso · ${b.vueltas||3} vueltas${Number(b.pausa)?` · ${b.pausa}" entre vueltas`:''}`:(b.series?`· ${b.series} series`:'');
        if(bt)p.text(M+6+tw(bn,bz,true),t+BH*0.72,bt,bz*0.95,false,0.3);
        p.line(M,t+BH,M+CW,t+BH,0.35,0.6);t+=BH;
        for(const it of b.items){
          const k=kgFn(it);const pad=3;
          const c0=fit(it.nombre,colsW[0]-2*pad,fz,false,Math.max(5.6,fz-1.8));p.text(colX[0]+pad,t+rowH*0.66,c0.s,c0.z,false);
          const c1=fit(b.modo==='timer'?'':it.reps,colsW[1]-2*pad,fz,false,5.5);p.text(colX[1]+pad,t+rowH*0.66,c1.s,c1.z,false);
          if(k){const kz=fz;const kt=fit(k,colsW[2]-2*pad-(it.pct?tw(it.pct+'%',fz*0.72,false)+2:0),kz,true,5.5);p.text(colX[2]+pad,t+rowH*0.66,kt.s,kt.z,true);
            if(it.pct)p.text(colX[2]+pad+tw(kt.s,kt.z,true)+2,t+rowH*0.66,it.pct+'%',fz*0.72,false,0.4)}
          else if(it.pct)p.text(colX[2]+pad,t+rowH*0.66,it.pct+'%',fz*0.85,false,0.3);
          const c3=fit(it.notas,colsW[3]-2*pad,fz*0.9,false,5.2);p.text(colX[3]+pad,t+rowH*0.66,c3.s,c3.z,false,0.25);
          p.line(M,t+rowH,M+CW,t+rowH,0.35,0.6);t+=rowH;
        }
      }
      if(r.controlCarga){p.rect(M,t,CW,rowH,0.97,null);const cz=Math.min(fz,7.4);p.text(colX[0]+3,t+rowH*0.66,'Sesión: minutos / esfuerzo (1 a 10)',cz,true,0.15);p.text(colX[3]+3,t+rowH*0.66,'ej: 60 / 7',cz*0.9,false,0.45);p.line(M,t+rowH,M+CW,t+rowH,0.35,0.6);t+=rowH}
      // verticales de la tabla del día
      const top0=t-(d.bloques.reduce((a,b)=>a+BH+b.items.length*rowH,0))-CH-(r.controlCarga?rowH:0);
      colX.forEach((x,i)=>{if(i===0||i===colX.length-1)p.line(x,top0,x,t,0.6,0.35);else{
        let yy=top0;p.line(x,yy,x,yy+CH,0.35,0.6);yy+=CH;for(const b of d.bloques){yy+=BH;p.line(x,yy,x,yy+b.items.length*rowH,0.35,0.6);yy+=b.items.length*rowH}
        if(r.controlCarga&&i>=4)p.line(x,yy,x,yy+rowH,0.35,0.6)}});
      p.line(M,t,M+CW,t,0.6,0.35);
      t+=6;
    }
    return t;
  }
  // una hoja por sección; si no entra, la sección sigue en otra hoja
  const plan=[];
  for(const s of secs){
    const title=secs.length>1?(s.titulo||''):'';
    let rest=[...s.dias];
    while(rest.length){
      const p=Page();const top=header(p,title);const avail=H-M-FOOT-top;
      // cuántos días entran con fila mínima 10.5
      let take=rest.length;
      const need=(ds,rh)=>ds.reduce((a,d)=>a+Math.max(12,rh*1.15)+Math.max(9,rh*0.8)+6+(r.controlCarga?rh:0)+d.bloques.reduce((x,b)=>x+Math.max(8.5,rh*0.82)+b.items.length*rh,0),0);
      while(take>1&&need(rest.slice(0,take),10.5)>avail)take--;
      const ds=rest.slice(0,take);rest=rest.slice(take);
      let rh=16;while(rh>8&&need(ds,rh)>avail)rh-=0.25;
      const fz=Math.max(6,Math.min(8.6,rh*0.56));
      drawDays(p,top,ds,rh,fz);
      plan.push(p);
    }
  }
  if(!plan.length){const p=Page();header(p,'');p.text(M,200,'Esta rutina no tiene ejercicios cargados.',10,false);plan.push(p)}
  plan.forEach((p,i)=>footer(p,i+1,plan.length));
  return pdfBytes(plan,`${tc(e.nombre)} - ${r.nombre||'Rutina'}`);
}
/* ZIP sin compresión */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zip(files){
  const te=new TextEncoder();const parts=[];const central=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  const now=new Date();const dt=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1)),dd=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate());
  for(const f of files){const name=te.encode(f.name);const c=crc32(f.data);
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(dt),...u16(dd),...u32(c),...u32(f.data.length),...u32(f.data.length),...u16(name.length),...u16(0)]);
    parts.push(lh,name,f.data);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dt),...u16(dd),...u32(c),...u32(f.data.length),...u32(f.data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);
    off+=lh.length+name.length+f.data.length}
  const cs=central.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cs),...u32(off),...u16(0)]);
  const all=[...parts,...central,end];const tot=all.reduce((a,b)=>a+b.length,0);const out=new Uint8Array(tot);let p=0;for(const a of all){out.set(a,p);p+=a.length}return out;
}
/* ===== Hoja resumen a color (1 período o comparativa de 2) ===== */
function resumen(e,D){
  const C={navy:'#17306E',ink:'#16202B',muted:'#5F6B7A',line:'#D5DBE5',soft:'#F2F5FA',p1:'#A9B7D3',p2:'#2148B8',ok:'#1E9E5A',okS:'#E3F4EA',warn:'#E0A100',bad:'#D64545',badS:'#FBE4E4',white:'#FFFFFF',pie:['#7CC4A0','#F2C14E','#EE8B3A','#D64545'],sc:['#E46A6A','#F09A5A','#F2C94C','#7DC37A']};
  const p=Page();const CW=W-2*M;const P=D.periodos,two=P.length===2;const col=i=>two?(i?C.p2:C.p1):C.p2;
  const T=(x,y,s,z,b,c)=>p.text(x,y,String(s),z,b,c??C.ink);const TR=(x,y,s,z,b,c)=>T(x-tw(String(s),z,b),y,s,z,b,c);const TC=(x,y,s,z,b,c)=>T(x-tw(String(s),z,b)/2,y,s,z,b,c);
  const circ=(cx,cy,r)=>{const o=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return o};
  const card=(x,y,w,h,t,desc)=>{p.rect(x,y,w,h,C.white,C.line,0.8);T(x+12,y+17,t.toUpperCase(),8.2,true,C.navy);if(!desc)return 0;const L=wrap(desc,w-24,6.9,false);L.forEach((l,i)=>T(x+12,y+28+i*8.4,l,6.9,false,C.muted));return L.length*8.4};
  const fmtK=v=>v>=1000?(v/1000).toFixed(1)+'k':String(Math.round(v));
  const badge=(x,y,dl,suf)=>{const up=dl>=0;const t=(up?'+':'-')+Math.abs(dl)+suf;const bw=tw(t,8,true)+20;p.rect(x-bw,y,bw,13,up?C.okS:C.badS,null);const ax=x-bw+6,ay=y+9.5;
    if(up)p.poly([[ax,ay],[ax+6,ay],[ax+3,ay-5]],C.ok);else p.poly([[ax,ay-5],[ax+6,ay-5],[ax+3,ay]],C.bad);T(ax+9,ay,t,8,true,up?C.ok:C.bad)};
  // encabezado
  p.rect(0,0,W,76,C.navy,null);
  const nm=fit(tc(e.nombre).toUpperCase(),CW-170,22,true,13);T(M,32,nm.s,nm.z,true,C.white);
  T(M,49,D.titulo,11.5,true,'#C9D6F5');const sb=fit(D.sub,CW-170,8.4,false,6);T(M,64,sb.s,sb.z,false,'#AFC0E8');
  if(two)P.forEach((q,i)=>{const x=W-M-150+i*80;p.rect(x,26,10,10,col(i),'#FFFFFF',0.8);const f=fit(q.corto,62,9,true,6);T(x+15,35,f.s,f.z,true,C.white)});
  const tel=fmtTel(e.telefono);if(tel)TR(W-M,two?60:35,'Tel: '+tel,8.2,true,'#C9D6F5');
  let y=88;const L=P[P.length-1],F=P[0];
  // KPIs
  const kw=(CW-30)/4;
  const kp=[
    ['Entrenamientos',String(L.hechos),L.meta?`de ${L.meta}`:'',two?`${F.corto}: ${F.hechos}`:'marcados en el link',two?L.hechos-F.hechos:null,''],
    ['Fuerza promedio',D.fuerzaPct==null?'—':`${D.fuerzaPct>=0?'+':''}${D.fuerzaPct}%`,'',D.kg.length?`kg máximos · ${D.kg.length} ejercicios`:'sin kg anotados',null,''],
    ['Carga del mes',L.carga?fmtK(L.carga):'—',L.carga?'min × esfuerzo':'',two?`${F.corto}: ${F.carga?fmtK(F.carga):'—'}`:(L.sesiones?`${L.sesiones} sesiones anotadas`:'sin sesiones anotadas'),two&&F.carga&&L.carga?Math.round((L.carga-F.carga)/F.carga*100):null,'%'],
    ['Bienestar',L.bien.n?String(L.bien.tot):'—',L.bien.n?'de 15':'',two?`${F.corto}: ${F.bien.n?F.bien.tot:'—'}`:(L.bien.n?`${L.bien.n} respuestas`:'sin respuestas'),two&&F.bien.n&&L.bien.n?+(L.bien.tot-F.bien.tot).toFixed(1):null,'']];
  kp.forEach(([l,v,u,s2,dl,suf],i)=>{const x=M+i*(kw+10);p.rect(x,y,kw,58,C.white,C.line,0.8);T(x+12,y+15,l.toUpperCase(),7.4,true,C.muted);T(x+12,y+38,v,20,true);if(u)T(x+14+tw(v,20,true),y+38,u,8,false,C.muted);
    const f=fit(s2,kw-(dl!=null?78:24),7.6,false,5.5);T(x+12,y+51,f.s,f.z,false,C.muted);if(dl!=null)badge(x+kw-10,y+41,dl,suf)});
  y+=68;
  // asistencia
  const ah=146;const d1=card(M,y,190,ah,'Cumplimiento del mes','Días que marcaste como hechos sobre los que te tocaban en el mes. La constancia es lo que más influye en tus resultados.');
  const d2=card(M+200,y,CW-200,ah,'Entrenamientos por semana','Cuántos días entrenaste cada semana. La línea verde es tu meta según tu plan: sostenerla es lo que te hace progresar.');
  P.forEach((q,i)=>{const R=27,r=19,cx=two?M+52+i*86:M+95,cy=y+32+d1+R+2;const f=q.meta?Math.min(1,q.hechos/q.meta):0;
    p.arc(cx,cy,r,R,0,Math.PI*2,C.soft);if(f>0)p.arc(cx,cy,r,R,-Math.PI/2,-Math.PI/2+Math.PI*2*f,col(i));
    TC(cx,cy+5,q.meta?Math.round(q.hechos/q.meta*100)+'%':'—',12.5,true);TC(cx,y+ah-18,q.corto,8.4,true,C.muted);TC(cx,y+ah-8,`${q.hechos} de ${q.meta||'?'}`,7.6,false,C.muted)});
  {const x0=M+222,bw=CW-200-44,top=y+34+d2,hh=ah-34-d2-24;const n=Math.max(...P.map(q=>q.semanas.length));const gw=bw/Math.max(1,n);
   const mx=Math.max(D.metaSem||0,...P.flatMap(q=>q.semanas.map(s=>s.v)),1)+1;
   for(let v=0;v<=mx;v++){const yy=top+hh-v/mx*hh;p.line(x0,yy,x0+bw,yy,0.4,C.line);TR(x0-5,yy+3,v,7,false,C.muted)}
   if(D.metaSem){const gy=top+hh-D.metaSem/mx*hh;p.line(x0,gy,x0+bw,gy,1,C.ok);TR(x0+bw,gy-4,'Meta '+D.metaSem,7.4,true,C.ok)}
   for(let i=0;i<n;i++){const b=two?gw*0.3:gw*0.5,gx=x0+i*gw+(gw-(two?2*b+3:b))/2;P.forEach((q,j)=>{const v=q.semanas[i]?.v;if(v==null)return;const hx=gx+(two?j*(b+3):0);const h=v/mx*hh;if(h>0)p.rect(hx,top+hh-h,b,h,col(j),null);TC(hx+b/2,top+hh-h-3,v,7.6,true,two&&!j?C.muted:C.ink)});
     TC(x0+i*gw+gw/2,top+hh+13,two?'Semana '+(i+1):(P[0].semanas[i]?.lbl||''),7.4,false,C.muted)}}
  y+=ah+10;
  // fuerza
  if(D.kg.length){const rows=D.kg.slice(0,8);const kh=44+rows.length*19;
    const d3=card(M,y,CW,kh,two?'Progreso de fuerza · kg máximo de cada mes':'Progreso de fuerza en el mes',two?'El kg más alto (con sus reps) de cada ejercicio en cada mes. Cuenta los kg de tu rutina los días que tildaste el ejercicio o marcaste el día como hecho, y los que cambiaste vos. Si sube, tu fuerza está mejorando.':'Tu primer día del mes contra el mejor que hiciste (kg × reps). Cuenta los kg de tu rutina los días que tildaste el ejercicio o marcaste el día como hecho, y los que cambiaste vos. Si sube, tu fuerza está mejorando.');
    const x0=M+130,bw=CW-130-130,mx=Math.max(...rows.map(k=>Math.max(k.a,k.b)))*1.05;let yy=y+30+d3;
    if(!two){[[D.kgLbls[0],C.p1],[D.kgLbls[1],C.p2]].forEach(([l,c],i)=>{const lx=M+CW-230+i*112;p.rect(lx,y+10,8,8,c,null);T(lx+11,y+17,l,7.2,false,C.muted)})}
    const xr=r=>r?' × '+String(r).slice(0,10):'';
    rows.forEach(k=>{const n=fit(k.nombre,115,8.8,true,6);T(M+12,yy+12,n.s,n.z,true);
      p.rect(x0,yy+1,bw*k.a/mx,7,C.p1,null);T(x0+bw*k.a/mx+4,yy+7.5,k.a+' kg'+xr(k.ar),7,false,C.muted);
      p.rect(x0,yy+9.5,bw*k.b/mx,8,C.p2,null);T(x0+bw*k.b/mx+4,yy+16.5,k.b+' kg'+xr(k.br),7.4,true);
      const d=+(k.b-k.a).toFixed(1);const t=(d>0?'+':'')+d+' kg';const w2=tw(t,8.4,true)+12;p.rect(M+CW-12-w2,yy+2,w2,15,d>0?C.okS:d<0?C.badS:C.soft,null);T(M+CW-6-w2,yy+13,t,8.4,true,d>0?C.ok:d<0?C.bad:C.muted);yy+=19});
    y+=kh+10}
  // carga + rpe
  const hayC=D.carga.length&&D.carga.some(c=>c.v);
  if(hayC){const ch=164;
    const d4=card(M,y,CW*0.6,ch,'Carga semanal (minutos × esfuerzo)','Minutos de la sesión × qué tan dura fue (1 a 10), sumado por semana. Subir de a poco mejora tu rendimiento; un salto brusco aumenta el riesgo de lesión.');
    const d5=card(M+CW*0.6+10,y,CW*0.4-10,ch,'Esfuerzo de las sesiones','Cómo calificaste cada sesión al terminarla. Alternar sesiones duras y suaves te permite recuperarte y rendir más.');
    const x0=M+40,bw=CW*0.6-56,top=y+36+d4,hh=ch-36-d4-34,n=D.carga.length,gw=bw/n;const mx=Math.max(...D.carga.map(c=>c.v))*1.15||1;
    const st=mx>3000?1000:500;for(let v=0;v<=mx;v+=st){const yy=top+hh-v/mx*hh;p.line(x0,yy,x0+bw,yy,0.4,C.line);TR(x0-4,yy+3,v?fmtK(v):'0',7,false,C.muted)}
    D.carga.forEach((c,i)=>{const a=c.acwr;const cc=a==null?C.p1:a>D.umbral?C.bad:a>1.3?C.warn:a<0.8?C.p1:C.ok;const h=c.v/mx*hh,bx=x0+i*gw+gw*0.15,b=gw*0.7;if(h>0)p.rect(bx,top+hh-h,b,h,cc,null);
      TC(bx+b/2,top+hh-h-3,c.v?fmtK(c.v):'0',6.8,true);TC(bx+b/2,top+hh+11,c.lbl,6.4,false,C.muted);
      if(two&&i>0&&D.carga[i-1].p!==c.p){const sx=x0+i*gw-1;p.line(sx,top-4,sx,top+hh,0.8,C.muted);T(sx+3,top+4,P[c.p].corto,7,true,C.muted);TR(sx-3,top+4,P[D.carga[i-1].p].corto,7,true,C.muted)}});
    const ly=y+ch-12;[['Adecuada',C.ok],['En aumento',C.warn],['Muy alta',C.bad],['Baja o sin historial',C.p1]].forEach(([l,c],i)=>{const lx=x0+[0,62,128,190][i];p.rect(lx,ly-7,8,8,c,null);T(lx+12,ly,l,7.2,false,C.muted)});
    const area=M+CW*0.6+10,aw=CW*0.4-10,lbls=['Suave (1-4)','Moderada (5-6)','Dura (7-8)','Máxima (9-10)'];
    if(two){P.forEach((q,i)=>{const R=27,r=16,cx=area+44+i*80,cy=y+36+d5+R+4;const tot=q.rpe.reduce((a,b)=>a+b,0);let a=-Math.PI/2;
        if(tot)q.rpe.forEach((v,k)=>{const da=v/tot*Math.PI*2;if(da>0)p.arc(cx,cy,r,R,a,a+da,C.pie[k]);a+=da});else p.arc(cx,cy,r,R,0,Math.PI*2,C.soft);
        TC(cx,cy+4,tot,10.5,true);TC(cx,cy+R+11,q.corto,7.6,true,C.muted)});
      lbls.forEach((l,k)=>{const lx=area+12+(k%2)*(aw/2-6),ly2=y+ch-24+Math.floor(k/2)*11;p.rect(lx,ly2-7,8,8,C.pie[k],null);T(lx+11,ly2,l,6.8,false,C.muted)})}
    else{const q=P[0],R=40,r=23,cx=area+58,cy=y+34+d5+(ch-34-d5)/2;const tot=q.rpe.reduce((a,b)=>a+b,0);let a=-Math.PI/2;
      if(tot)q.rpe.forEach((v,k)=>{const da=v/tot*Math.PI*2;if(da>0)p.arc(cx,cy,r,R,a,a+da,C.pie[k]);a+=da});else p.arc(cx,cy,r,R,0,Math.PI*2,C.soft);
      TC(cx,cy+2,tot,14,true);TC(cx,cy+12,'sesiones',6.8,false,C.muted);
      lbls.forEach((l,k)=>{const lx=cx+R+12,ly2=cy-30+k*20;p.rect(lx,ly2-8,9,9,C.pie[k],null);T(lx+13,ly2,l,7.8,true);T(lx+13,ly2+9,`${q.rpe[k]} · ${tot?Math.round(q.rpe[k]/tot*100):0}%`,7.2,false,C.muted)})}
    y+=ch+10}
  // bienestar
  if(P.some(q=>q.bien.n)){const wh=Math.min(150,H-M-24-y);
    const d6=card(M,y,CW,wh,'Bienestar mensual (promedio, escala de 1 a 5)','Promedio de lo que respondés antes de entrenar. Dormir mal, llegar dolorido o estresado baja tu rendimiento: con este dato ajustamos la carga de cada día.');
    const x0=M+108,bw=CW*0.40,seg=bw/4;
    [['sueno','Sueño'],['cuerpo','Cuerpo / dolor'],['animo','Ánimo / estrés']].forEach(([k,l],i)=>{const yy=y+40+d6+i*25;T(M+12,yy+4,l,8.8,true);
      for(let s2=0;s2<4;s2++)p.rect(x0+s2*seg,yy-3,seg-2,8,C.sc[s2],null);[1,2,3,4,5].forEach(n=>TC(x0+(n-1)*seg,yy+14,n,6.4,false,C.muted));
      const pos=v=>x0+(v-1)*seg;const vals=P.map(q=>q.bien.n?q.bien[k]:null);
      vals.forEach((v,j)=>{if(v==null)return;if(two&&!j)p.poly(circ(pos(v),yy+1,5.5),C.white,C.p1,2);else p.poly(circ(pos(v),yy+1,5.5),C.p2,C.white,1.5)});
      if(two&&vals[0]!=null&&vals[1]!=null){const d=+(vals[1]-vals[0]).toFixed(1);T(x0+bw+14,yy+4,`${vals[0]}  >  ${vals[1]}`,8.6,true);T(x0+bw+66,yy+4,(d>=0?'+':'')+d,8.6,true,d>=0?C.ok:C.bad)}
      else{const v=vals.filter(x=>x!=null).pop();if(v!=null)T(x0+bw+14,yy+4,v+' de 5',8.6,true)}});
    if(two){const ly=y+wh-10;p.poly(circ(M+16,ly-3,4),C.white,C.p1,1.6);T(M+24,ly,F.corto,7.4,false,C.muted);p.poly(circ(M+90,ly-3,4),C.p2,null);T(M+98,ly,L.corto,7.4,false,C.muted)}
    const all=P.flatMap((q,i)=>q.bienSem.map(v=>({v,i}))).filter(x=>x.v!=null);
    if(all.length>1){const tx=x0+bw+110,tw0=M+CW-14-tx,top=y+42+d6,hh=wh-42-d6-34;T(tx,top-2,'Total semanal (de 15)',7.2,true,C.muted);
      const lo=Math.max(3,Math.floor(Math.min(...all.map(a=>a.v))-1)),hi=15;const X=i=>tx+8+i*(tw0-8)/(all.length-1),Y=v=>top+8+hh-(v-lo)/(hi-lo)*hh;
      [lo,Math.round((lo+hi)/2),hi].forEach(v=>{p.line(tx+8,Y(v),tx+tw0,Y(v),0.4,C.line);TR(tx+5,Y(v)+2.5,v,6.4,false,C.muted)});
      P.forEach((q,j)=>{const pts=[];all.forEach((a,i)=>{if(a.i===j)pts.push([X(i),Y(a.v)])});if(pts.length>1)p.poly(pts,null,col(j),1.8,false);pts.forEach(pt=>p.poly(circ(pt[0],pt[1],2.3),col(j),null))})}
    y+=wh+10}
  if(y<H-M-60&&D.vacio)T(M,y+14,D.vacio,8.4,false,C.muted);
  p.line(M,H-M-10,M+CW,H-M-10,0.5,C.line);marca(p,M+CW,H-M-8,10);T(M,H-M,`Generado el ${D.generado} · Los datos de asistencia, kg, carga y bienestar los anota el entrenado en su link personal.`,6.8,false,C.muted);
  return pdfBytes([p],D.titulo+' - '+tc(e.nombre));
}
/* ===== Reporte mensual ===== */
function reporte(e,d){
  const p=Page();const CW=W-2*M;let t=M;
  const nm=fit(tc(e.nombre),CW*0.62,19,true,12);p.text(M,t+16,nm.s,nm.z,true);
  const tel=fmtTel(e.telefono);if(tel)p.text(M+CW-tw('Tel: '+tel,8.3,true),t+9,'Tel: '+tel,8.3,true);
  const sub=[e.grupo,d.rutina?('Rutina: '+d.rutina):''].filter(Boolean).join(' · ');if(sub){const f=fit(sub,CW*0.36,8.3,false,6);p.text(M+CW-tw(f.s,f.z,false),t+20,f.s,f.z,false,0.25)}
  p.text(M,t+31,'Reporte de '+d.mesLbl,11,true,0.15);t+=37;p.line(M,t,M+CW,t,1.8,0);t+=10;
  // KPIs
  const k=d.kpis;const kw=(CW-(k.length-1)*8)/k.length;
  k.forEach((x,i)=>{const X=M+i*(kw+8);p.rect(X,t,kw,52,0.95,0.7,0.6);p.text(X+8,t+13,x.lbl.toUpperCase(),6.8,true,0.35);const v=fit(x.val,kw-16,17,true,10);p.text(X+8,t+33,v.s,v.z,true);const s2=fit(x.sub||'',kw-16,7.6,false,5.5);p.text(X+8,t+45,s2.s,s2.z,false,0.3)});
  t+=64;
  const title=(s)=>{p.text(M,t+10,s.toUpperCase(),10.5,true);t+=14;p.line(M,t,M+CW,t,0.6,0);t+=8};
  const bars=(items,max,goal,unit)=>{ // items [{lbl,v}]
    const H0=70,bw=Math.min(46,(CW-20)/Math.max(1,items.length)-10);const step=(CW-20)/Math.max(1,items.length);
    if(goal){const gy=t+H0-(Math.min(1,goal/max))*H0;p.line(M+6,gy,M+CW-6,gy,0.6,0.55);p.text(M+CW-tw('Meta '+goal,6.8,false),gy-3,'Meta '+goal,6.8,false,0.4)}
    items.forEach((it,i)=>{const X=M+10+i*step+(step-bw)/2;const h=max?Math.max(1,(it.v/max)*H0):1;p.rect(X,t,bw,H0,0.95,null);p.rect(X,t+H0-h,bw,h,goal&&it.v>=goal?0.3:0.45,null);
      const vs=String(it.v)+(unit||'');p.text(X+(bw-tw(vs,8,true))/2,t+H0+10,vs,8,true);p.text(X+(bw-tw(it.lbl,6.8,false))/2,t+H0+19,it.lbl,6.8,false,0.4)});
    t+=H0+28;
  };
  title('Asistencia por semana');
  if(d.asis.marcados){bars(d.asis.semanas,Math.max(d.asis.meta,...d.asis.semanas.map(x=>x.v),1),d.asis.meta)}
  else{p.text(M,t+8,'No marcó entrenamientos en su link este mes.',8.6,false,0.35);t+=20}
  title('Progreso de kg');
  if(d.kg.length){
    const cols=[0.38,0.1,0.1,0.1,0.12,0.2].map(f=>f*CW);const cx=[M];cols.forEach(c=>cx.push(cx.at(-1)+c));
    const hd=['Ejercicio','Inicio','Último','Máximo','Cambio','Evolución'];p.rect(M,t,CW,13,0.88,null);hd.forEach((h,i)=>p.text(cx[i]+4,t+9.5,h.toUpperCase(),6.8,true,0.2));t+=13;
    const rh=17;
    for(const x of d.kg.slice(0,16)){
      const n=fit(x.nombre,cols[0]-8,8.4,false,6);p.text(cx[0]+4,t+11.5,n.s,n.z,false);
      p.text(cx[1]+4,t+11.5,x.ini+' kg',8.4,false,0.25);p.text(cx[2]+4,t+11.5,x.ult+' kg',8.4,true);p.text(cx[3]+4,t+11.5,x.max+' kg',8.4,false,0.25);
      const dl=(x.delta>0?'+':'')+x.delta+' kg';p.text(cx[4]+4,t+11.5,dl,8.4,true,x.delta>0?0:0.35);
      const P=x.pts;if(P.length>1){const lo=Math.min(...P),hi=Math.max(...P)||1,w=cols[5]-12,X0=cx[5]+6;const yv=v=>t+rh-4-((v-lo)/((hi-lo)||1))*(rh-8);
        for(let i=1;i<P.length;i++)p.line(X0+(i-1)*w/(P.length-1),yv(P[i-1]),X0+i*w/(P.length-1),yv(P[i]),1.1,0.15)}
      p.line(M,t+rh,M+CW,t+rh,0.35,0.7);t+=rh}
    t+=8;
  }else{p.text(M,t+8,'No anotó kg en su link este mes.',8.6,false,0.35);t+=20}
  if(d.carga&&d.carga.semanas.some(x=>x.v)){title('Carga de entrenamiento (minutos × esfuerzo)');bars(d.carga.semanas,Math.max(...d.carga.semanas.map(x=>x.v),1),0,'');
    if(d.carga.acwr!=null){p.text(M,t,`Relación carga aguda / crónica al cierre del mes: ${d.carga.acwr}  (${d.carga.acwrTxt})`,8.4,false,0.2);t+=14}}
  if(d.bien&&d.bien.n){title('Bienestar antes de entrenar (promedio de 1 a 5)');
    [['Sueño',d.bien.sueno],['Cuerpo / dolor',d.bien.cuerpo],['Ánimo / estrés',d.bien.animo]].forEach(([l,v])=>{p.text(M,t+9,l,8.6,false);const X=M+110,bw=CW-170;p.rect(X,t+1,bw,10,0.93,null);p.rect(X,t+1,bw*(v/5),10,0.4,null);p.text(X+bw+8,t+9.5,String(v),8.6,true);t+=15});
    p.text(M,t+6,`${d.bien.n} ${d.bien.n===1?'respuesta':'respuestas'} en el mes.`,7.6,false,0.4);t+=16}
  p.line(M,H-M-14,M+CW,H-M-14,0.5,0.6);p.text(M,H-M-4,'Generado el '+d.generado+' · Los datos de asistencia, kg, carga y bienestar los anota el entrenado en su link personal.',6.8,false,0.4);
  return pdfBytes([p],`Reporte ${d.mesLbl} - ${tc(e.nombre)}`);
}
function reporteName(e,mesLbl){return ('Reporte '+mesLbl+' - '+tc(e.nombre)).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()+'.pdf'}
function fileName(e,r){return (tc(e.nombre)+' - '+(r.nombre||'Rutina')).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)+'.pdf'}
function download(bytes,name,type){const blob=new Blob([bytes],{type});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1500)}
return {build,zip,fileName,download,fmtTel,reporte,reporteName,resumen,_k:{Page,pdfBytes,tw,fit,wrap,W,H,M,fmtTel,tc}};
})();
