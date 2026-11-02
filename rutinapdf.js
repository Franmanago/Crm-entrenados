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
function Page(){const ops=[];const y=v=>(H-v).toFixed(2);
  return {ops,
    text(x,top,s,size,bold,gray){ops.push(`BT /${bold?'F2':'F1'} ${size.toFixed(2)} Tf ${(gray??0).toFixed(2)} g ${x.toFixed(2)} ${y(top)} Td (${enc(s)}) Tj ET`)},
    rect(x,top,w,h,fill,stroke,lw){ops.push(`${(lw??0.5).toFixed(2)} w ${fill!=null?fill.toFixed(2)+' g ':''}${stroke!=null?stroke.toFixed(2)+' G ':''}${x.toFixed(2)} ${y(top+h)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill!=null&&stroke!=null?'B':fill!=null?'f':'S'}`)},
    line(x1,t1,x2,t2,lw,gray){ops.push(`${lw.toFixed(2)} w ${(gray??0).toFixed(2)} G ${x1.toFixed(2)} ${y(t1)} m ${x2.toFixed(2)} ${y(t2)} l S`)}}}
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
    p.line(M,H-M-FOOT+4,M+CW,H-M-FOOT+4,0.5,0.6);const f=fit(s,CW-50,6.8,false,5.5);p.text(M,H-M-FOOT+13,f.s,f.z,false,0.3);
    if(total>1)p.text(M+CW-tw(`Hoja ${n} de ${total}`,6.8,false),H-M-FOOT+13,`Hoja ${n} de ${total}`,6.8,false,0.3);
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
        if(b.series)p.text(M+6+tw(bn,bz,true),t+BH*0.72,`· ${b.series} series`,bz*0.95,false,0.3);
        p.line(M,t+BH,M+CW,t+BH,0.35,0.6);t+=BH;
        for(const it of b.items){
          const k=kgFn(it);const pad=3;
          const c0=fit(it.nombre,colsW[0]-2*pad,fz,false,Math.max(5.6,fz-1.8));p.text(colX[0]+pad,t+rowH*0.66,c0.s,c0.z,false);
          const c1=fit(it.reps,colsW[1]-2*pad,fz,false,5.5);p.text(colX[1]+pad,t+rowH*0.66,c1.s,c1.z,false);
          if(k){const kz=fz;const kt=fit(k,colsW[2]-2*pad-(it.pct?tw(it.pct+'%',fz*0.72,false)+2:0),kz,true,5.5);p.text(colX[2]+pad,t+rowH*0.66,kt.s,kt.z,true);
            if(it.pct)p.text(colX[2]+pad+tw(kt.s,kt.z,true)+2,t+rowH*0.66,it.pct+'%',fz*0.72,false,0.4)}
          else if(it.pct)p.text(colX[2]+pad,t+rowH*0.66,it.pct+'%',fz*0.85,false,0.3);
          const c3=fit(it.notas,colsW[3]-2*pad,fz*0.9,false,5.2);p.text(colX[3]+pad,t+rowH*0.66,c3.s,c3.z,false,0.25);
          p.line(M,t+rowH,M+CW,t+rowH,0.35,0.6);t+=rowH;
        }
      }
      // verticales de la tabla del día
      const top0=t-(d.bloques.reduce((a,b)=>a+BH+b.items.length*rowH,0))-CH;
      colX.forEach((x,i)=>{if(i===0||i===colX.length-1)p.line(x,top0,x,t,0.6,0.35);else{
        let yy=top0;p.line(x,yy,x,yy+CH,0.35,0.6);yy+=CH;for(const b of d.bloques){yy+=BH;p.line(x,yy,x,yy+b.items.length*rowH,0.35,0.6);yy+=b.items.length*rowH}}});
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
      const need=(ds,rh)=>ds.reduce((a,d)=>a+Math.max(12,rh*1.15)+Math.max(9,rh*0.8)+6+d.bloques.reduce((x,b)=>x+Math.max(8.5,rh*0.82)+b.items.length*rh,0),0);
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
function fileName(e,r){return (tc(e.nombre)+' - '+(r.nombre||'Rutina')).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90)+'.pdf'}
function download(bytes,name,type){const blob=new Blob([bytes],{type});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},1500)}
return {build,zip,fileName,download,fmtTel};
})();
