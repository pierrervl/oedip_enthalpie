/* OEDIP — graphique journalier besoin / consommation (totaux DJU annuels) */
const MONTH_X=[0,31,59,90,120,151,181,212,243,273,304,334];
const MONTH_LBL=["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];

function renderDjuChart(r, opts){
  opts=opts||{};
  const wrap=opts.wrap||$("djuChartWrap");
  if(!wrap) return;
  const meta=opts.meta!==undefined?opts.meta:$("djuChartMeta");
  const hint=opts.hint!==undefined?opts.hint:$("djuChartHint");
  const legApp=opts.legApp!==undefined?opts.legApp:$("djuChartAppointLeg");
  const days=r.integ?.daily||[];
  if(!days.length){
    wrap.innerHTML='<div class="empty">Aucune donnée — renseignez le projet et une gamme PAC.</div>';
    if(meta) meta.textContent="—";
    if(hint) hint.textContent="";
    return;
  }
  let svg=wrap.querySelector("svg");
  if(!svg){
    wrap.innerHTML='<svg role="img" aria-label="Besoin et consommation par jour sur l\'année"></svg>';
    svg=wrap.querySelector("svg");
  }
  const W=Math.max(720, wrap.clientWidth||900);
  const H=320;
  const pad={l:58,r:58,t:28,b:52};
  const plotW=W-pad.l-pad.r, plotH=H-pad.t-pad.b;
  const n=days.length;
  const maxDay=Math.max(...days.map(d=>Math.max(d.kwhBesoin||0,d.kwhElec||0)),0.1);
  const totalB=r.besoin||0, totalE=r.elec||0;

  const xAt=i=>pad.l+(i/(n-1))*plotW;
  const yDay=v=>pad.t+plotH-(v/maxDay)*plotH;
  const yCum=v=>pad.t+plotH-(v/Math.max(totalB,totalE,1))*plotH;

  const linePts=(key,yFn)=>days.map((d,i)=>`${xAt(i).toFixed(1)},${yFn(d[key]).toFixed(1)}`).join(" ");
  const areaBesoin=days.map((d,i)=>`${xAt(i).toFixed(1)},${yDay(d.kwhBesoin).toFixed(1)}`).join(" ");
  const areaElec=days.map((d,i)=>`${xAt(i).toFixed(1)},${yDay(d.kwhElec).toFixed(1)}`).join(" ");
  const baseY=(pad.t+plotH).toFixed(1);
  const pathBesoin=`M ${xAt(0).toFixed(1)},${baseY} L ${areaBesoin} L ${xAt(n-1).toFixed(1)},${baseY} Z`;
  const pathElec=`M ${xAt(0).toFixed(1)},${baseY} L ${areaElec} L ${xAt(n-1).toFixed(1)},${baseY} Z`;

  const cumBesoin=linePts("cumBesoin",d=>yCum(d));
  const cumElec=linePts("cumElec",d=>yCum(d));

  const C=OEDIP_PALETTE;
  let grid="";
  const yTicks=5;
  for(let i=0;i<=yTicks;i++){
    const v=maxDay*i/yTicks;
    const y=yDay(v);
    grid+=`<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${(W-pad.r).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${C.line}" stroke-dasharray="3 4"/>`;
    grid+=`<text x="${(pad.l-6).toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${C.inkSoft}" font-size="9">${fmt(v,1)}</text>`;
  }
  for(let i=0;i<=yTicks;i++){
    const v=Math.max(totalB,totalE)*i/yTicks;
    const y=yCum(v);
    grid+=`<text x="${(W-pad.r+4).toFixed(1)}" y="${(y+3).toFixed(1)}" fill="${C.inkSoft}" font-size="9">${fmt(v,0)}</text>`;
  }

  let monthTicks="";
  MONTH_X.forEach((doy,i)=>{
    const x=xAt(Math.min(doy,n-1));
    monthTicks+=`<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${(pad.t+plotH).toFixed(1)}" stroke="${C.line}" opacity=".6"/>`;
    monthTicks+=`<text x="${x.toFixed(1)}" y="${(H-22).toFixed(1)}" text-anchor="middle" fill="${C.inkSoft}" font-size="10">${MONTH_LBL[i]}</text>`;
  });

  svg.setAttribute("viewBox",`0 0 ${W} ${H}`);
  svg.innerHTML=`
    <text x="${pad.l}" y="16" fill="${C.ink}" font-size="11" font-family="IBM Plex Sans,sans-serif">kWh / jour</text>
    <text x="${(W-pad.r).toFixed(1)}" y="16" text-anchor="end" fill="${C.inkSoft}" font-size="10">cumul annuel (kWh)</text>
    ${grid}
    ${monthTicks}
    <path d="${pathBesoin}" fill="${C.heat}" fill-opacity=".22"/>
    <path d="${pathElec}" fill="${C.geo}" fill-opacity=".28"/>
    <polyline points="${areaBesoin}" fill="none" stroke="${C.heat}" stroke-width="1.8"/>
    <polyline points="${areaElec}" fill="none" stroke="${C.geo}" stroke-width="1.8"/>
    <polyline points="${cumBesoin}" fill="none" stroke="${C.heat}" stroke-width="1.2" stroke-dasharray="4 3" stroke-opacity=".7"/>
    <polyline points="${cumElec}" fill="none" stroke="${C.geo}" stroke-width="1.2" stroke-dasharray="4 3" stroke-opacity=".7"/>
    <text x="${(pad.l+plotW/2).toFixed(1)}" y="${(H-4).toFixed(1)}" text-anchor="middle" fill="${C.ink}" font-size="11" font-family="IBM Plex Sans,sans-serif">Jour de l'année (365 j)</text>
    <text x="14" y="${(pad.t+plotH/2).toFixed(1)}" transform="rotate(-90 14 ${(pad.t+plotH/2).toFixed(1)})" text-anchor="middle" fill="${C.inkSoft}" font-size="10">kWh / jour</text>`;

  const copFmt=fmt(r.integ.cop||r.cop,2);
  const djuY=r.djuAnnee??state.reglages?.djuAnnee??2025, djuB=r.djuBase??state.reglages?.djuBase??17;
  const djuLbl=typeof djuRefLabel==="function"?djuRefLabel(djuY):djuY;
  if(meta) meta.textContent=`Total ${fmt(totalB,0)} kWh besoin · ${fmt(totalE,0)} kWh élec · ${fmt(r.dju,0)} DJU (${djuLbl}, ${djuB}°C) · COP ${copFmt}`;
  const hasApp=(r.appoint||0)>0;
  if(legApp) legApp.style.display=hasApp?"inline-flex":"none";
  if(hint){
    hint.textContent=`Répartition sur 365 jours à partir des totaux annuels intégrés (${fmt(r.dju,0)} DJU, ${typeof djuRefLabel==="function"?djuRefLabel(djuY):djuY}, base ${djuB}°C). `
      +`La somme des barres journalières = ${fmt(totalB,0)} kWh de besoin chauffage et ${fmt(totalE,0)} kWh de consommation électrique PAC sur l'année (SCOP ${fmt(r.scop,2)}). `
      +(hasApp?`Appoint annuel : ${fmt(r.appoint,0)} kWh. `:"")
      +`Courbes pleines : énergie du jour ; pointillés : cumul depuis le 1ᵉʳ janvier.`;
  }
}

let djuChartResizeT;
window.addEventListener("resize",()=>{
  clearTimeout(djuChartResizeT);
  djuChartResizeT=setTimeout(()=>{
    if(LAST.besoin!=null){
      renderDjuChart(LAST);
      if($("notePrintCharts")?.checked&&typeof syncNotePrintAnnex==="function") syncNotePrintAnnex();
    }
  }, 120);
});

function syncNotePrintCharts(){
  const wrap=$("noteChartWrap");
  if(!wrap||!LAST) return;
  renderDjuChart(LAST,{
    wrap,
    meta: $("noteChartMeta"),
    hint: $("noteChartHint"),
    legApp: $("noteChartAppointLeg")
  });
}
