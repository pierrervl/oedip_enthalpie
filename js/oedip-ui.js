/* OEDIP — interface — ne pas modifier l'ordre de chargement dans oedip.html */
/* ---------- 4. UI ---------- */
const fmt=(n,d=0)=> (n==null||isNaN(n)||n==='')?"—":Number(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d});
const num=v=>{ v=parseFloat(String(v).replace(',','.')); return isNaN(v)?null:v; };
const escAttr=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");

function fillDjuYearSelect(){
  const sel=$('b_djuAnnee');
  if(!sel) return;
  const years=typeof OEDIP_DJU_YEARS!=="undefined"?OEDIP_DJU_YEARS:[];
  if(!sel.dataset.ready){
    sel.innerHTML=`<option value="moyenne">Moyenne 1990–2025 (recommandé)</option>`
      +years.slice().reverse().map(y=>`<option value="${y}">${y}</option>`).join('');
    sel.dataset.ready="1";
  }
  const ref=state.reglages?.djuAnnee??OEDIP_DJU_DEFAULT_REF??"moyenne";
  sel.value=String(ref);
}
function fillSelects(){
  normalizeGammes();
  normalizeEmetteurs();
  const opt=g=>(`${g.nom} · ${fonctionLabel(g.fonction)}`);
  $('s_gamme').innerHTML=state.gammes.map((g,i)=>`<option value="${i}">${opt(g)}</option>`).join('');
  $('dbGamme').innerHTML=state.gammes.map((g,i)=>`<option value="${i}">${g.nom} (code ${g.code}) — ${fonctionLabel(g.fonction)}</option>`).join('');
  fillDjuYearSelect();
  $('b_dept').innerHTML=state.departements.map(d=>`<option value="${d.code}">${d.code} · ${d.nom}</option>`).join('');
  $('b_isotype').innerHTML=state.isolationTypes.map((t,i)=>`<option value="${i}">${t.nom} (G=${t.g})</option>`).join('');
  $('s_capt').innerHTML=state.captages.map((c,i)=>`<option value="${i}">${c.nom}</option>`).join('');
  renderZonesChauffUI();
}
function emetteurSelectOptions(selectedIdx){
  return state.emetteurs
    .map((x,i)=>({x,i}))
    .filter(({x})=>!x.absent)
    .map(({x,i})=>`<option value="${i}"${i===selectedIdx?' selected':''}>${emetteurOptionLabel(x)}</option>`)
    .join('');
}
function readZoneVolMode(block, idx){
  const i=idx??+block?.dataset?.idx;
  const z=projet?.besoin?.zones?.[i];
  if(z?.volMode==='vol'||z?.volMode==='surf') return z.volMode;
  const on=block?.querySelector('.zone-volmode button.on');
  return on?.dataset?.v==='vol'?'vol':'surf';
}
function readZonesFromDom(){
  const bs=projet.besoin;
  const list=$('zones_chauff_list');
  if(!list) return;
  const zones=[];
  list.querySelectorAll('.zone-chauff-block').forEach((block,i)=>{
    const idx=+block.dataset.idx;
    const ii=Number.isFinite(idx)?idx:i;
    const volMode=readZoneVolMode(block,ii);
    zones.push({
      nom:(block.querySelector('.zone-nom')?.value||'').trim()||`Zone ${ii+1}`,
      volMode,
      surfaceM2:+(block.querySelector('.zone-surf')?.value||0),
      hauteur:+(block.querySelector('.zone-h')?.value||2.5),
      volumeM3:+(block.querySelector('.zone-vol-direct')?.value||0),
      emIdx:+(block.querySelector('.zone-em')?.value??3),
      nbEmetteurs:+(block.querySelector('.zone-nb')?.value||0)
    });
  });
  bs.zones=zones;
  if(projet.batiment&&typeof zonesVolumeM3==='function') projet.batiment.vol=zonesVolumeM3(zones);
}
function renderZonesChauffUI(){
  const list=$('zones_chauff_list');
  if(!list) return;
  ensureProjetHydraulique(projet);
  const zones=projet.besoin.zones||[];
  list.innerHTML=zones.map((z,i)=>{
    const em=state.emetteurs[z.emIdx];
    const vis=typeof hydroZoneFieldVisibility==='function'?hydroZoneFieldVisibility(em):{nb:true};
    const nom=typeof zoneDisplayName==='function'?zoneDisplayName(z,i):`Zone ${i+1}`;
    const volMode=z.volMode==='vol'?'vol':'surf';
    const vol=typeof zoneVolumeM3==='function'?zoneVolumeM3(z):0;
    const nomVal=escAttr(z.nom??'');
    const volDirect=volMode==='vol'?vol:(z.volumeM3||0);
    return `<div class="zone-chauff-block" data-idx="${i}">
      <div class="zone-chauff-head">
        <span class="zone-chauff-title">${escHtml(nom)}</span>
        <button type="button" class="btn-soft" style="color:var(--bad);padding:2px 8px;font-size:11px" onclick="removeZoneChauff(${i})" title="Supprimer">×</button>
      </div>
      <div class="row">
        <label>Nom de la zone</label>
        <input type="text" class="zone-nom" value="${nomVal}" placeholder="ex. RDC, Salon…" oninput="onZoneNomInput(${i})" style="grid-column:2/4">
      </div>
      <div class="row">
        <label>Saisie volume</label>
        <div class="seg zone-volmode" style="grid-column:2/4">
          <button type="button" data-v="surf" class="${volMode==='surf'?'on':''}" onclick="onZoneVolModeChange(${i},'surf')">Surface × hauteur</button>
          <button type="button" data-v="vol" class="${volMode==='vol'?'on':''}" onclick="onZoneVolModeChange(${i},'vol')">Volume direct</button>
        </div>
      </div>
      <div class="zone-fields-surf" style="display:${volMode==='surf'?'block':'none'}">
        <div class="row">
          <label>Surface</label>
          <input type="number" class="zone-surf" value="${z.surfaceM2??0}" min="0" step="1" oninput="recalc()">
          <span class="unit">m²</span>
        </div>
        <div class="row">
          <label>Hauteur sous plafond</label>
          <input type="number" class="zone-h" value="${z.hauteur??2.5}" min="0" step="0.1" oninput="recalc()">
          <span class="unit">m</span>
        </div>
        <div class="row">
          <label>Volume zone</label>
          <input class="mono zone-vol-readonly" value="${fmt(vol,1)}" readonly>
          <span class="unit">m³</span>
        </div>
      </div>
      <div class="zone-fields-vol" style="display:${volMode==='vol'?'block':'none'}">
        <div class="row">
          <label>Volume</label>
          <input type="number" class="zone-vol-direct" value="${volDirect||0}" min="0" step="0.1" oninput="recalc()">
          <span class="unit">m³</span>
        </div>
      </div>
      <div class="row zone-chauff-em">
        <label>Émetteur</label>
        <select class="zone-em" onchange="onZoneChauffChange()" style="grid-column:2/4">${emetteurSelectOptions(z.emIdx)}</select>
      </div>
      <div class="row zone-field-nb" style="display:${vis.nb?'grid':'none'}">
        <label>Nombre d'unités</label>
        <input type="number" class="zone-nb" value="${z.nbEmetteurs??0}" min="0" step="1" oninput="recalc()">
        <span class="unit">u</span>
      </div>
    </div>`;
  }).join('');
  updateZonesChauffSummary();
}
function onZoneVolModeChange(idx,mode){
  readZonesFromDom();
  const z=projet.besoin.zones[idx];
  if(!z) return;
  if(mode==='vol'){
    z.volumeM3=typeof zoneVolumeM3==='function'?zoneVolumeM3({...z,volMode:'surf'}):z.surfaceM2*z.hauteur;
  } else {
    const h=+(z.hauteur||2.5)||2.5;
    z.surfaceM2=h>0?(z.volumeM3||0)/h:0;
  }
  z.volMode=mode;
  updateZoneVolModeFields();
  recalc();
}
function updateZoneVolModeFields(){
  const list=$('zones_chauff_list');
  if(!list) return;
  list.querySelectorAll('.zone-chauff-block').forEach(block=>{
    const idx=+block.dataset.idx;
    const z=projet.besoin.zones[idx];
    if(!z) return;
    const mode=z.volMode==='vol'?'vol':'surf';
    const surf=block.querySelector('.zone-fields-surf');
    const vol=block.querySelector('.zone-fields-vol');
    if(surf) surf.style.display=mode==='surf'?'block':'none';
    if(vol) vol.style.display=mode==='vol'?'block':'none';
    block.querySelectorAll('.zone-volmode button').forEach(b=>b.classList.toggle('on',b.dataset.v===mode));
    const volDirect=block.querySelector('.zone-vol-direct');
    if(volDirect&&mode==='vol') volDirect.value=z.volumeM3??0;
    const volRead=block.querySelector('.zone-vol-readonly');
    if(volRead&&mode==='surf'){
      const s=+(block.querySelector('.zone-surf')?.value||0);
      const h=+(block.querySelector('.zone-h')?.value||0);
      volRead.value=fmt(s*h,1);
    }
  });
}
function onZoneNomInput(idx){
  const list=$('zones_chauff_list');
  const block=list?.querySelector(`.zone-chauff-block[data-idx="${idx}"]`);
  const title=block?.querySelector('.zone-chauff-title');
  const nom=block?.querySelector('.zone-nom')?.value?.trim();
  if(title) title.textContent=nom||`Zone ${idx+1}`;
  recalc();
}
function updateZoneChauffFieldVisibility(){
  const list=$('zones_chauff_list');
  if(!list) return;
  list.querySelectorAll('.zone-chauff-block').forEach(block=>{
    const em=state.emetteurs[+block.querySelector('.zone-em')?.value];
    const vis=typeof hydroZoneFieldVisibility==='function'?hydroZoneFieldVisibility(em):{nb:true};
    const nb=block.querySelector('.zone-field-nb');
    if(nb) nb.style.display=vis.nb?'grid':'none';
  });
}
function updateZonesChauffSummary(){
  const el=$('zones_chauff_summary');
  if(!el) return;
  const zones=projet.besoin.zones||[];
  const surf=typeof zonesSurfaceM2==='function'?zonesSurfaceM2(zones):0;
  const vol=typeof zonesVolumeM3==='function'?zonesVolumeM3(zones):0;
  if(!zones.length){ el.textContent='Aucune zone — ajoutez au moins une zone.'; return; }
  el.textContent=`${zones.length} zone(s) · ${fmt(surf,0)} m² · volume total ${fmt(vol,1)} m³`;
}
function listUpdateZoneVolumes(){
  const list=$('zones_chauff_list');
  if(!list) return;
  list.querySelectorAll('.zone-chauff-block').forEach(block=>{
    if(readZoneVolMode(block)!=='surf') return;
    const surf=+(block.querySelector('.zone-surf')?.value||0);
    const h=+(block.querySelector('.zone-h')?.value||0);
    const volIn=block.querySelector('.zone-vol-readonly');
    if(volIn) volIn.value=fmt(surf*h,1);
  });
}
function onZoneChauffChange(){ readZonesFromDom(); updateZoneChauffFieldVisibility(); recalc(); }
function addZoneChauff(){
  readForm();
  ensureProjetHydraulique(projet);
  const n=(projet.besoin.zones?.length||0)+1;
  const z=typeof defaultZoneChauff==='function'?defaultZoneChauff(3,`Zone ${n}`):{nom:`Zone ${n}`,surfaceM2:0,hauteur:2.5,emIdx:3,nbEmetteurs:0};
  projet.besoin.zones.push(z);
  renderZonesChauffUI();
  recalc();
}
function removeZoneChauff(idx){
  readForm();
  ensureProjetHydraulique(projet);
  projet.besoin.zones.splice(idx,1);
  renderZonesChauffUI();
  recalc();
}
function onGammeChange(){ const g=state.gammes[+$('s_gamme').value];
  if(!g) return;
  $('s_source').innerHTML=g.sources.map((s,i)=>`<option value="${i}">${s}</option>`).join('');
  const info=$('s_gammeInfo');
  const gwp=gammeGwp(g);
  if(g.desc||g.fonction||g.fluide){ info.style.display='block';
    const fl=g.fluide==="custom"?(g.fluideLabel||"Autre")+` (PRP ${fmt(gwp,0)})`:refrigerantLabel(g.fluide)+(gwp!=null?` · PRP ${fmt(gwp,0)}`:'');
    info.innerHTML=`<b>${fonctionLabel(g.fonction)}</b> · <b>${fl}</b>${g.desc?' — '+g.desc:''}`; } else info.style.display='none';
  projet.source.gamme=+$('s_gamme').value; projet.source.regimeSource=0; recalc(); }
function bindSeg(id,cb){ const el=$(id); el.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{el.querySelectorAll('button').forEach(b=>b.classList.remove('on'));btn.classList.add('on');cb(btn.dataset.v);}); }
function setSeg(id,v){ $(id).querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==String(v))); }

function readForm(){
  const c=projet.client,b=projet.batiment,bs=projet.besoin,e=projet.ecs;
  c.ref=$('p_ref').value;c.type=$('p_type').value;c.nom=$('p_nom').value;c.adr=$('p_adr').value;c.cp=$('p_cp').value;c.ville=$('p_ville').value;c.installateur=$('p_inst').value;c.referent=$('p_referent').value;
  b.dept=$('b_dept').value;b.alt=+$('b_alt').value;b.tint=+$('b_tint').value;b.isoType=+$('b_isotype').value;b.gman=+$('b_gman').value;
  bs.pDir=+$('b_pdir').value;bs.rdt=+$('b_rdt').value;bs.surp=+$('b_surp').value;
  readZonesFromDom();
  const hy=ensureProjetHydraulique(projet);
  if(hy.pdcEchangeurAuto===false&&$('b_hydro_pdc_ech')) hy.pdcEchangeurKpa=+$('b_hydro_pdc_ech').value||0;
  if($('b_hydro_pdc_coll')) hy.pdcCollecteurBoucleKpa=+$('b_hydro_pdc_coll').value||0;
  e.nb=+$('e_nb').value;e.volPers=+$('e_vol').value;
  projet.source.gamme=+$('s_gamme').value;projet.source.regimeSource=+$('s_source').value;projet.source.captage=+$('s_capt').value;
  if(typeof readInstallForm==='function') readInstallForm();
}
function writeForm(){
  const c=projet.client,b=projet.batiment,bs=projet.besoin,e=projet.ecs,s=projet.source;
  $('p_ref').value=c.ref;$('p_type').value=c.type;$('p_nom').value=c.nom;$('p_adr').value=c.adr;$('p_cp').value=c.cp;$('p_ville').value=c.ville;$('p_inst').value=c.installateur;$('p_referent').value=c.referent;
  $('b_dept').value=b.dept;$('b_alt').value=b.alt;$('b_tint').value=b.tint;$('b_isotype').value=b.isoType;$('b_gman').value=b.gman;
  $('b_pdir').value=bs.pDir;$('b_rdt').value=bs.rdt;$('b_surp').value=bs.surp;
  const hy=ensureProjetHydraulique(projet);
  if($('b_hydro_pdc_ech')) $('b_hydro_pdc_ech').value=hy.pdcEchangeurKpa??0;
  if($('b_hydro_pdc_coll')) $('b_hydro_pdc_coll').value=hy.pdcCollecteurBoucleKpa??3;
  updatePdcEchangeurAutoUi();
  $('e_nb').value=e.nb;$('e_vol').value=e.volPers;
  $('s_gamme').value=s.gamme;onGammeChange();$('s_source').value=s.regimeSource;$('s_capt').value=s.captage;
  renderZonesChauffUI();
  setSeg('seg_littoral',b.littoral);setSeg('seg_isomode',b.isoMode);setSeg('seg_pdirect',bs.pDirectMode);setSeg('seg_ecs',e.present);setSeg('seg_tension',s.tension);setSeg('seg_rev',s.reversible);
  // prix
  const p=state.prix; $('c_pelec').value=p.elec;$('c_pfuel').value=p.fuelL;$('c_rfuel').value=p.rdtFuel;$('c_pgaz').value=p.gazKwh;$('c_rgaz').value=p.rdtGaz;$('c_pgran').value=p.granKg;$('c_rgran').value=p.rdtGran;$('c_pbuche').value=p.bucheKwh;$('c_rbuche').value=p.rdtBuche;
  toggleGroups();
}
function toggleGroups(){
  $('grp_isoauto').style.display=projet.batiment.isoMode==="auto"?"grid":"none";
  $('grp_isoman').style.display=projet.batiment.isoMode==="manuel"?"grid":"none";
  $('grp_pdirect').style.display=projet.besoin.pDirectMode==1?"grid":"none";
  $('grp_ecs').style.display=projet.ecs.present==1?"block":"none";
}
function onDjuAnneeChange(){
  const v=$('b_djuAnnee').value;
  state.reglages.djuAnnee=v==="moyenne"?"moyenne":+v;
  state.departements=refreshDjuOnDepartements(state.departements);
  fillSelects();
  $('b_dept').value=projet.batiment.dept;
  onDeptChange();
}
function onDeptChange(){ syncDeptFromCp(true); recalc(); }
function syncDeptFromCp(fromDeptOnly){
  const d=findDeptByCode($('b_dept').value);
  if(d){
    projet.batiment.dept=d.code;
    const dj=resolveProjectDju(d.code);
    const alt=+$('b_alt').value||0, litt=projet.batiment.littoral;
    const altC=alt>200?Math.floor(alt/200):0;
    let hint=`${d.code} · ${d.nom} — ${fmt(dj.dju,0)} DJU (${djuRefLabel(dj.djuAnnee)}, base ${dj.djuBase}°C) · T° réf. ${d.tbase}°C`;
    if(altC) hint+=` · −${altC}°C altitude`;
    if(litt==1) hint+=` · +1°C littoral`;
    if($('b_deptHint')) $('b_deptHint').textContent=hint;
  }
  if(fromDeptOnly) return;
  const code=deptFromPostalCode($('p_cp').value);
  const dcp=findDeptByCode(code);
  if(dcp&&dcp.code!==$('b_dept').value){
    projet.batiment.dept=dcp.code;
    $('b_dept').value=dcp.code;
    onDeptChange();
  }
}
function onPdcEchangeurInput(){
  const hy=ensureProjetHydraulique(projet);
  hy.pdcEchangeurAuto=false;
  hy.pdcEchangeurKpa=+$('b_hydro_pdc_ech').value||0;
  updatePdcEchangeurAutoUi();
  recalc();
}
function resetPdcEchangeurAuto(){
  const hy=ensureProjetHydraulique(projet);
  hy.pdcEchangeurAuto=true;
  hy.pdcEchangeurKpa=0;
  updatePdcEchangeurAutoUi();
  recalc();
}
function updatePdcEchangeurAutoUi(){
  const hy=ensureProjetHydraulique(projet);
  const inp=$('b_hydro_pdc_ech');
  const btn=$('b_hydro_pdc_ech_auto');
  const hint=$('b_hydro_pdc_ech_hint');
  if(inp) inp.classList.toggle('mono-auto', hy.pdcEchangeurAuto!==false);
  if(btn) btn.style.display=hy.pdcEchangeurAuto===false?'inline-block':'none';
  if(hint){
    if(hy.pdcEchangeurAuto===false) hint.textContent='Saisie manuelle';
    else if(hy.pdcEchangeurPac) hint.textContent=`Auto · B26 de ${hy.pdcEchangeurPac}`;
    else hint.textContent='Auto · machine présélectionnée';
  }
}
function recalc(){
  readForm(); const r=compute();
  if(typeof syncProjetPdcEchangeurFromHydro==='function') syncProjetPdcEchangeurFromHydro(projet,r.hydro);
  updatePdcEchangeurAutoUi();
  $('b_volret').value=fmt(r.V,1);
  $('b_gret').value=fmt(r.G,2);
  listUpdateZoneVolumes();
  $('b_tbase_ref').value=fmt(r.TbaseRef,0);
  $('b_tbase').value=fmt(r.Tbase,0);
  $('e_ballon').value=fmt(Engine.volumeBallon(projet.ecs),0);
  $('r_dep').innerHTML=`${fmt(r.dep*1000,0)} <small>W</small>`;
  $('r_ecs').innerHTML=`${fmt(r.pECS,2)} <small>kW</small>`;
  $('r_pinst').innerHTML=`${fmt(r.pInst,1)} <small>kW</small>`;
  $('r_besoin').innerHTML=`${fmt(r.besoin,0)} <small>kWh</small>`;
  $('r_cop').textContent=fmt(r.scop,2);
  $('r_conso').innerHTML=`${fmt(r.elec,0)} <small>kWh</small>`;
  const rEm=$('r_emetteur'); if(rEm) rEm.textContent=r.emetteurLabel||'—';
  const rReg=$('r_regime'); if(rReg) rReg.textContent=r.regimeEmitter?`${r.regimeEmitter}°C → perf ${r.depRegime}`:'—';
  const rCopPt=$('r_cop_pt'); if(rCopPt) rCopPt.textContent=r.cop!=null?fmt(r.cop,2):'—';
  $('r_heures').innerHTML=`${fmt(r.heures,0)} <small>h</small>`;
  $('r_eco').innerHTML=`${fmt(r.economie,1)} <small>%</small>`;
  const djEl=$('r_djuMeta');
  if(djEl) djEl.textContent=`${fmt(r.dju,0)} DJU · ${djuRefLabel(r.djuAnnee)} · base ${r.djuBase??17}°C`;
  updateZonesChauffSummary();
  const hb=$('hydro_breakdown'); if(hb&&typeof renderHydrauliqueBreakdown==='function') hb.innerHTML=renderHydrauliqueBreakdown(r.hydro);
  const rhq=$('r_hydro_q'), rhp=$('r_hydro_pdc'), rhh=$('r_hydro_hmt');
  if(r.hydro?.active){
    if(rhq) rhq.innerHTML=`${fmt(r.hydro.debitM3h,2)} <small>m³/h</small>`;
    if(rhp) rhp.innerHTML=`${fmt(r.hydro.pdcTotalKpa,1)} <small>kPa</small>`;
    if(rhh) rhh.innerHTML=`${fmt(r.hydro.hmtM,2)} <small>m</small>`;
  } else {
    if(rhq) rhq.textContent='—';
    if(rhp) rhp.textContent='—';
    if(rhh) rhh.textContent='—';
  }
  renderDjuChart(r);
}

/* ---------- TAB 1 : gammes & base machines ---------- */
function renderGammes(){
  normalizeGammes();
  $('gammesCount').textContent=`${state.gammes.length} gamme(s)`;
  $('gammesList').innerHTML=state.gammes.map((g,i)=>{
    const nb=state.machines.filter(m=>m.gammeCode===g.code).length;
    return `<div class="gcard">
      <h4>${g.nom}</h4>
      <div class="fnrow"><span class="badge fn">${fonctionLabel(g.fonction)}</span><span class="badge">${g.fluide==="custom"?(g.fluideLabel||"Autre"):refrigerantLabel(g.fluide)}${gammeGwp(g)!=null?' · PRP '+fmt(gammeGwp(g),0):''}</span><span class="badge mono">code ${g.code}</span><span class="badge">${nb} machine(s)</span></div>
      <div class="gdesc">${g.desc||'<em>Aucune description</em>'}</div>
      <div class="gmeta">${g.sources.length} régime(s) source · ${g.departs.length} régime(s) départ</div>
      <div class="gacts">
        <button class="btn-soft" onclick="openGammeModal(${i})">Modifier</button>
        <button class="btn-soft" onclick="delGamme(${i})" style="color:var(--bad)">Supprimer</button>
      </div></div>`;
  }).join('') || `<div class="empty" style="grid-column:1/-1">Aucune gamme — ajoutez-en une pour commencer.</div>`;
  fillSelects();
  const idx=+$('dbGamme').value;
  if(idx>=state.gammes.length) $('dbGamme').value=0;
  dbGammeChanged();
}
let GEDIT=null;
function openGammeModal(idx){
  normalizeGammes();
  GEDIT=idx!=null?idx:null;
  const g=GEDIT!=null?state.gammes[GEDIT]:{nom:"",code:nextGammeCode(),fonction:"geothermie",fluide:"R407C",sources:PERF_SRC.slice(),departs:PERF_DEP.slice(),desc:""};
  $('gModalTitle').textContent=GEDIT!=null?`Modifier · ${g.nom}`:"Nouvelle gamme";
  const fnOpts=FONCTIONS.map(f=>`<option value="${f.id}"${g.fonction===f.id?' selected':''}>${f.label}</option>`).join('');
  const fluOpts=REFRIGERANTS.map(r=>`<option value="${r.id}"${g.fluide===r.id?' selected':''}>${r.label}${r.gwp!=null?' (PRP '+r.gwp+')':''}</option>`).join('');
  const depChk=PERF_DEP.map(d=>`<label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" class="g-dep" value="${d}"${g.departs.includes(d)?' checked':''}> ${d}</label>`).join('');
  $('gModalBody').innerHTML=`
    <div class="fgrid" style="margin-bottom:12px">
      <div class="f"><label>Nom de la gamme</label><input id="g_nom" value="${g.nom||''}"></div>
      <div class="f"><label>Code (identifiant machines)</label><input class="mono" type="number" id="g_code" value="${g.code||''}"></div>
      <div class="f"><label>Fonction / technologie</label><select id="g_fonction">${fnOpts}</select></div>
      <div class="f"><label>Fluide frigorigène</label><select id="g_fluide" onchange="toggleGammeGwpCustom()">${fluOpts}</select></div>
      <div class="f" id="g_fluideCustomWrap" style="display:${g.fluide==='custom'?'flex':'none'}"><label>Libellé fluide</label><input id="g_fluideLabel" value="${g.fluideLabel||''}"></div>
      <div class="f" id="g_gwpCustomWrap" style="display:${g.fluide==='custom'?'flex':'none'}"><label>PRP / GWP (kg CO₂eq/kg)</label><input class="mono" type="number" id="g_gwpCustom" value="${g.gwpCustom??''}"></div>
    </div>
    <div class="hint" id="g_fluideHint" style="margin-bottom:12px"></div>
    <div class="f" style="margin-bottom:12px"><label>Description</label>
      <textarea id="g_desc" rows="3" style="width:100%;resize:vertical;font-family:var(--sans);font-size:13px;padding:8px;border:1px solid var(--line-strong);border-radius:5px">${g.desc||''}</textarea></div>
    <div class="subhead">Régimes de source (un par ligne)</div>
    <textarea id="g_sources" rows="4" class="mono" style="width:100%;font-size:12px;padding:8px;border:1px solid var(--line-strong);border-radius:5px">${(g.sources||[]).join('\n')}</textarea>
    <div class="subhead" style="margin-top:14px">Régimes de départ affichés dans le catalogue</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">${depChk}</div>
    <div class="hint" style="margin-top:12px">Le <b>code</b> relie chaque machine à cette gamme. Le <b>fluide</b> et son PRP (potentiel de réchauffement planétaire) servent au calcul GWP : charge machine (kg) × PRP = kg CO₂eq.</div>`;
  $('modalGamme').classList.add('show');
  toggleGammeGwpCustom();
}
function toggleGammeGwpCustom(){
  const custom=$('g_fluide')&&$('g_fluide').value==='custom';
  if($('g_fluideCustomWrap')) $('g_fluideCustomWrap').style.display=custom?'flex':'none';
  if($('g_gwpCustomWrap')) $('g_gwpCustomWrap').style.display=custom?'flex':'none';
  const sel=$('g_fluide')?$('g_fluide').value:null;
  const r=REFRIGERANTS.find(x=>x.id===sel);
  if($('g_fluideHint')) $('g_fluideHint').textContent=custom
    ? "Saisissez le nom commercial du fluide et son PRP (valeur réglementaire ou fiche fabricant)."
    : (r&&r.gwp!=null? `PRP retenu pour le calcul : ${r.gwp} kg CO₂eq par kg de fluide (${r.label}).` : "");
}
function closeGammeModal(){ $('modalGamme').classList.remove('show'); GEDIT=null; }
function saveGammeModal(){
  const nom=$('g_nom').value.trim(), code=+$('g_code').value, fonction=$('g_fonction').value;
  const fluide=$('g_fluide').value, fluideLabel=$('g_fluideLabel')?$('g_fluideLabel').value.trim():'';
  const gwpCustom=$('g_gwpCustom')?num($('g_gwpCustom').value):null;
  const desc=$('g_desc').value.trim();
  const sources=$('g_sources').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const departs=[...document.querySelectorAll('.g-dep:checked')].map(el=>el.value);
  if(!nom){ alert("Indiquez un nom de gamme."); return; }
  if(!code||code<1){ alert("Code invalide."); return; }
  if(!sources.length){ alert("Ajoutez au moins un régime de source."); return; }
  if(!departs.length){ alert("Cochez au moins un régime de départ."); return; }
  if(fluide==="custom"&&(gwpCustom==null||gwpCustom<0)){ alert("Indiquez un PRP / GWP valide pour le fluide personnalisé."); return; }
  const dup=state.gammes.findIndex((g,i)=>g.code===code&&i!==GEDIT);
  if(dup>=0){ alert("Ce code est déjà utilisé par la gamme « "+state.gammes[dup].nom+" »."); return; }
  const old=GEDIT!=null?state.gammes[GEDIT]:null;
  const entry={nom,code,fonction,fluide,desc,sources,departs};
  if(fluide==="custom"){ entry.fluideLabel=fluideLabel||"Autre"; entry.gwpCustom=gwpCustom; }
  else { delete entry.fluideLabel; delete entry.gwpCustom; }
  if(GEDIT!=null){
    if(old&&old.code!==code){
      const nb=state.machines.filter(m=>m.gammeCode===old.code).length;
      if(nb&&!confirm(`Mettre à jour le code ${old.code} → ${code} pour ${nb} machine(s) ?`)) return;
      state.machines.forEach(m=>{ if(m.gammeCode===old.code) m.gammeCode=code; });
    }
    state.gammes[GEDIT]=entry;
  } else state.gammes.push(entry);
  closeGammeModal(); renderGammes(); toast("Gamme enregistrée");
}
function delGamme(i){
  const g=state.gammes[i], nb=state.machines.filter(m=>m.gammeCode===g.code).length;
  if(nb&&!confirm(`Supprimer la gamme « ${g.nom} » et ses ${nb} machine(s) ?`)) return;
  if(!nb&&!confirm(`Supprimer la gamme « ${g.nom} » ?`)) return;
  const removed=state.machines.filter(m=>m.gammeCode===g.code).map(m=>m.pac);
  state.machines=state.machines.filter(m=>m.gammeCode!==g.code);
  removed.forEach(pac=>{ if(state.performances[pac]) delete state.performances[pac]; });
  state.gammes.splice(i,1);
  renderGammes(); toast("Gamme supprimée");
}
function fillDbPerfSelects(){
  $("dbSrc").innerHTML=PERF_SRC.map(s=>`<option value="${s}">${s}</option>`).join("");
  $("dbDep").innerHTML=PERF_DEP.map(d=>`<option value="${d}">${d}</option>`).join("");
}
function dbGammeChanged(){ fillDbPerfSelects(); renderDB(); }
function renderDB(){
  const g=state.gammes[+$("dbGamme").value];
  if(!g) return;
  const src=$("dbSrc").value||PERF_SRC[0], dep=$("dbDep").value||PERF_DEP[1];
  const list=state.machines.filter(m=>m.gammeCode===g.code);
  $("dbCount").textContent=`${list.length} machine(s) · ${g.nom} · entrée ${src} → sortie ${dep}`;
  const gwpGam=gammeGwp(g);
  let h=`<thead><tr><th>PAC</th><th>Tens.</th><th>Comp.</th><th>Rév.</th><th class="num">Charge<br><span style="font-weight:400;font-size:9px">kg · tCO₂eq</span></th>
    <th class="num">P chaud<br><span style="font-weight:400;font-size:9px">${src} → ${dep}</span></th><th class="num">COP</th><th>Édition</th></tr></thead><tbody>`;
  list.forEach(m=>{
    const gi=state.machines.indexOf(m);
    const f=getFiche(state.performances,m.pac,src,dep)||{};
    const tens=m.tension===0?"230V":m.tension===1?"400V":"Ind.";
    const imp=calcGwpImpact(m);
    const filled=PERF_SRC.reduce((n,s)=>n+PERF_DEP.filter(d=>{const x=getFiche(state.performances,m.pac,s,d);return x&&x.chaud>0;}).length,0);
    h+=`<tr><td><input value="${m.pac}" onchange="editM(${gi},'pac',this.value)"></td>
      <td><select onchange="editM(${gi},'tension',+this.value)"><option value="2"${m.tension===2?" selected":""}>Ind.</option><option value="0"${m.tension===0?" selected":""}>230V</option><option value="1"${m.tension===1?" selected":""}>400V</option></select></td>
      <td><span class="badge${m.nbComp>=2?" m":""}">${m.nbComp}</span></td><td>${m.reversible?"✔":"—"}</td>
      <td class="num" style="white-space:nowrap"><input class="num" style="width:42px;text-align:right" value="${m.chargeFluide??""}" onchange="editM(${gi},'chargeFluide',num(this.value))">
        <span style="font-size:10px;color:var(--geo);display:block">${imp?fmt(imp.co2eqT,2)+" t":gwpGam?"—":"?"}</span></td>
      <td class="num"><input class="num" style="width:52px;text-align:right" value="${f.chaud||""}" onchange="editPageQuick('${m.pac}','${src}','${dep}','chaud',this.value)"></td>
      <td class="num" style="color:var(--geo)">${f.cop?Number(f.cop).toFixed(2):"—"}</td>
      <td style="white-space:nowrap"><span class="machine-actions"><span class="seg" title="Fiches thermo ou description générale">
        <button type="button" class="edit" onclick="openMachine('${escAttr(m.pac)}','${src}','${dep}','perf')">✎ ${filled}/9</button>
        <button type="button" class="edit" onclick="openMachine('${escAttr(m.pac)}','${src}','${dep}','general')">Général</button>
        <button type="button" class="edit" onclick="openMachine('${escAttr(m.pac)}','${src}','${dep}','composants-frigo')">Frigo</button>
        <button type="button" class="edit" onclick="openMachine('${escAttr(m.pac)}','${src}','${dep}','composants-hydro')">Hyd.</button>
      </span></span> <button class="x" onclick="delMachine(${gi})">✕</button></td></tr>`;
  });
  $("dbTable").innerHTML=h+`</tbody>`;
}
function editM(i,k,v){
  state.machines[i][k]=k==="chargeFluide"?num(v):v;
  renderDB();
}
function ensurePage(pac,src,dep){
  initMachinePages(pac);
  const k=pageKey(src,dep);
  if(!state.performances[pac][k]) state.performances[pac][k]=mkPage({});
  return state.performances[pac][k];
}
function editPageQuick(pac,src,dep,k,v){
  const f=ensurePage(pac,src,dep); f[k]=num(v)||0; syncCop(f); renderDB();
}

/* ---- fiche machine complète (modal) ---- */
const SR_FIELDS=[
  ["sr_pFrigo","P frigo sous-ref.","kW"],["sr_debitInj","Débit injection","g/s"],["sr_pressInj","Pression inj.","bara"],
  ["sr_tRosee","T° rosée intermédiaire","°C"],["sr_tVapeur","T° sortie vapeur","°C"],["sr_tLiq1","T° liquide L1","°C"],["sr_tLiq2","T° liquide L2","°C"]
];
let MOPEN=null;
function ficheInp(k,f){ return `<input class="mono" value="${f[k]??''}" onchange="editFiche('${k}',this.value)">`; }
function ficheCell(k,lbl,u,f){ return `<div class="fiche-cell"><div class="f"><label>${lbl} <span class="u">${u}</span></label>${ficheInp(k,f)}</div></div>`; }
function fluideDebitLabel(gam){
  if(!gam||gam.fluide==="custom") return "Débit fluide (g/s)";
  return "Débit "+(gam.fluide||"R407C");
}
function renderFicheThermo(f,gam,src){
  const fl=fluideDebitLabel(gam);
  let h=`<div class="fiche-layout">`;
  h+=`<div class="fiche-block b-puiss"><div class="fb-head">Puissances</div><div class="fiche-puiss-cop">
    <div class="fiche-row c4">
      ${ficheCell("chaud","Chaud","kW",f)}${ficheCell("froid","Froid","kW",f)}
      ${ficheCell("absorbee","Absorbée (élec)","kW",f)}${ficheCell("intensite","Intensité (élec)","A",f)}
    </div>
    <div class="fiche-cop"><span class="cop-lbl">COP</span>${ficheInp("cop",f)}</div>
  </div></div>`;
  h+=`<div class="fiche-block b-press"><div class="fb-head">Pressions</div><div class="fiche-row c2">
    ${ficheCell("hp","HP","barg",f)}${ficheCell("bp","BP","barg",f)}
  </div></div>`;
  h+=`<div class="fiche-block b-frigo"><div class="fb-head">${fl}</div><div class="fiche-row c2" style="max-width:360px">
    ${ficheCell("debitR407C",fl,"g/s",f)}
  </div></div>`;
  h+=`<div class="fiche-block b-frigo"><div class="fb-head">Débits &amp; pertes de charge</div><div class="fiche-debits">
    <div class="fiche-side b-froid"><div class="fiche-side-hd">Côté froid (évaporation)</div>
      <div class="fiche-row c2">${ficheCell("froidM3H","Froid","m³/h",f)}${ficheCell("pdcEvapF","Pdc évap.","mce",f)}</div>
      <div class="fiche-row c2">${ficheCell("pdcTuyF","Pdc tuyauterie","mce",f)}${ficheCell("pdcTotF","Pdc totale","mce",f)}</div>
    </div>
    <div class="fiche-side b-chaud"><div class="fiche-side-hd">Côté chaud (condensation)</div>
      <div class="fiche-row c2">${ficheCell("chaudM3H","Chaud","m³/h",f)}${ficheCell("pdcCondC","Pdc cond.","mce",f)}</div>
      <div class="fiche-row c2">${ficheCell("pdcTuyC","Pdc tuyauterie","mce",f)}${ficheCell("pdcTotC","Pdc totale","mce",f)}</div>
    </div>
  </div></div>`;
  h+=`<div class="fiche-block b-capt"><div class="fb-head">Capteur géothermique</div><div class="fiche-row c3">
    ${ficheCell("capteurHoriz","Surface horizontale","m²",f)}${ficheCell("capteurVert","Vertical","m² / ml",f)}
    ${ficheCell("capteurM2","Surface (legacy)","m²",f)}</div>
    <div class="fiche-row c2">${ficheCell("capteurMl","Longueur capteur","ml",f)}${ficheCell("pCaptSpec","P capteur spécifique","W/ml",f)}</div>
  </div></div>`;
  h+=`<div class="fiche-block b-tech"><div class="fb-head">Électrique &amp; hydraulique</div><div class="fiche-row c4">
    ${ficheCell("iMax230","Intensité max 230V","A",f)}${ficheCell("iMax400","Intensité max 400V","A",f)}
    ${ficheCell("diamCoude","Ø int. coude","mm",f)}${ficheCell("diamLyre","Ø int. lyre","mm",f)}
  </div></div>`;
  h+=`<div class="fiche-block b-tech"><div class="fb-head">Rendements saisonniers (EtaS)</div><div class="fiche-row c2">
    ${ficheCell("etaS30","EtaS 30/35","%",f)}${ficheCell("etaS50","EtaS 47/55","%",f)}
  </div></div>`;
  h+=`</div>`;
  return h;
}
function renderPerfMatrix(pac,curSrc,curDep){
  let h=`<div class="subhead" style="margin:0 0 8px">Points de fonctionnement — cliquer pour ouvrir la fiche</div><div class="perf-matrix">
    <div class="perf-mh"></div>${PERF_DEP.map(d=>`<div class="perf-mh">Sortie ${d}</div>`).join("")}`;
  PERF_SRC.forEach(s=>{
    h+=`<div class="perf-mh row">Entrée ${s}</div>`;
    PERF_DEP.forEach(d=>{
      const f=getFiche(state.performances,pac,s,d);
      const has=f&&f.chaud>0, on=s===curSrc&&d===curDep;
      const lbl=has?`${fmt(f.chaud,1)} kW`:"—";
      h+=`<button type="button" class="perf-cell${has?" has":""}${on?" on":""}" onclick="openMachinePage('${pac.replace(/'/g,"\\'")}','${s}','${d}')" title="${s} → ${d}">${lbl}<br><span style="font-size:9px;opacity:.85">${has&&f.cop?Number(f.cop).toFixed(2)+" COP":""}</span></button>`;
    });
  });
  return h+`</div>`;
}
function openMachinePage(pac,src,dep){ openMachine(pac,src,dep,"perf"); }
function setMachineTabUi(tab){
  const el=$("machineModalTabs");
  if(!el) return;
  el.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
}
function switchMachineTab(tab){
  if(!MOPEN) return;
  MOPEN.tab=tab;
  renderMachineModal();
}
const GENERAL_FIELDS=[
  {section:"Dimensions",block:"dimensions",fields:[
    ["poidsKg","Poids net","kg",1],["hauteurMm","Hauteur","mm",0],["largeurMm","Largeur","mm",0],["profondeurMm","Profondeur","mm",0]
  ]},
  {section:"Acoustique",block:"acoustique",fields:[
    ["puissanceAcoustiqueDb","Puissance acoustique","dB",0]
  ]},
  {section:"Hydraulique",block:"hydraulique",fields:[
    ["connexion","Connexion hydraulique","",2],["debitCaptageM3h","Débit captage","m³/h",1],["pdcCaptageKpa","Pdc captage","kPa",1],
    ["debitChauffageM3h","Débit chauffage","m³/h",1],["pdcChauffageKpa","Pdc chauffage","kPa",1]
  ]},
  {section:"ECS",block:"ecs",fields:[
    ["ballonL","Volume ballon","L",0],["ballon","Réf. ballon","",2]
  ]},
  {section:"Raccordement électrique",block:"electrique",fields:[
    ["tension","Tension","",2],["cableAlimentation","Câble d'alimentation","",2],["protection","Protection électrique","",2],
    ["appointElectriqueKw","Appoint électrique","kW",1]
  ]}
];
function generalInp(path,val,type){
  const t=type===1?' type="number" step="0.01"':'';
  const v=val==null?"":String(val).replace(/"/g,"&quot;");
  return `<input class="mono"${t} value="${v}" onchange="editGeneral('${path}',this.value)">`;
}
function renderMachineGeneral(pac){
  const m=machineByPac(pac), g=ensureMachineGeneral(m);
  if(!g) return `<p class="hint">Machine introuvable.</p>`;
  let h=`<p class="hint" style="margin:0 0 12px">Description générale — indépendante des conditions entrée/sortie. Les débits et Pdc sont recopiés sur les 9 fiches thermodynamiques.</p>`;
  GENERAL_FIELDS.forEach(sec=>{
    h+=`<div class="fiche-block b-tech"><div class="fb-head">${sec.section}</div><div class="fgrid" style="padding:12px 14px">`;
    sec.fields.forEach(([key,lbl,u,type])=>{
      const path=`${sec.block}.${key}`, val=g[sec.block][key];
      const span=type===2?' style="grid-column:1/-1"':'';
      h+=`<div class="f"${span}><label>${lbl}${u?` <span class="u">${u}</span>`:""}</label>${generalInp(path,val,type)}</div>`;
    });
    h+=`</div></div>`;
  });
  return h;
}
function editMachineCompLink(pac,role,compId){
  setMachineCompLink(pac,role,compId||null);
  if(MOPEN&&MOPEN.pac===pac&&(MOPEN.tab==="composants-frigo"||MOPEN.tab==="composants-hydro")) renderMachineModal();
}
function editFrigoTuyau(pac,pipeId,field,value){
  const m=machineByPac(pac);
  if(!m) return;
  const t=ensureFrigoTuyaux(m);
  if(!t[pipeId]) t[pipeId]={};
  const n=num(value);
  if(n==null) delete t[pipeId][field];
  else t[pipeId][field]=n;
  if(!Object.keys(t[pipeId]).length) delete t[pipeId];
}
function renderMachinePerf(pac,src,dep){
  initMachinePages(pac);
  const f=ensurePage(pac,src,dep);
  const m=machineByPac(pac), gam=gammeByCode(m&&m.gammeCode), imp=calcGwpImpact(m);
  let h=renderPerfMatrix(pac,src,dep);
  h+=`<div class="fiche-block b-frigo" style="margin-bottom:14px"><div class="fb-head">Fluide frigorigène &amp; GWP</div>
    <div style="padding:12px 14px">
      <div class="fgrid" style="margin-bottom:10px">
        <div class="f"><label>Fluide (gamme)</label><input readonly value="${gam?(gam.fluide==="custom"?(gam.fluideLabel||"Autre"):refrigerantLabel(gam.fluide)):"—"}"></div>
        <div class="f"><label>PRP / GWP</label><input class="mono" readonly value="${gammeGwp(gam)!=null?gammeGwp(gam)+" kg CO₂eq/kg":""}"></div>
        <div class="f"><label>Charge fluide <span class="u">kg</span></label><input class="mono" type="number" step="0.01" value="${m&&m.chargeFluide!=null?m.chargeFluide:""}" onchange="editMachineCharge(${JSON.stringify(pac)},this.value)"></div>
      </div>${gwpHtml(imp)}</div></div>`;
  h+=renderFicheThermo(f,gam,src);
  h+=`<div class="fiche-block b-tech"><div class="fb-head">Sous-refroidisseur (option)</div><div class="fgrid" style="padding:12px 14px">`;
  SR_FIELDS.forEach(([k,lbl,u])=>{ h+=`<div class="f"><label>${lbl} <span class="u">${u}</span></label>${ficheInp(k,f)}</div>`; });
  h+=`</div></div>`;
  return h;
}
function renderMachineModal(){
  if(!MOPEN) return;
  const {pac,src,dep,tab}=MOPEN;
  setMachineTabUi(tab);
  if(tab==="general") $("mTitle").textContent=`${pac} · Description générale`;
  else if(tab==="composants-frigo") $("mTitle").textContent=`${pac} · Composants frigorifiques`;
  else if(tab==="composants-hydro") $("mTitle").textContent=`${pac} · Composants hydrauliques`;
  else $("mTitle").textContent=`${pac} · ${src} → ${dep}`;
  $("modal").querySelector(".card").classList.toggle("fiche-wide",tab==="perf"||tab==="composants-frigo"||tab==="composants-hydro");
  if(tab==="general") $("mBody").innerHTML=renderMachineGeneral(pac);
  else if(tab==="composants-frigo"){ $("mBody").innerHTML=renderMachineFrigo(pac); initFrigoDrag(pac); }
  else if(tab==="composants-hydro"){ $("mBody").innerHTML=renderMachineHydro(pac); initHydroDrag(pac); }
  else $("mBody").innerHTML=renderMachinePerf(pac,src,dep);
}
function openMachine(pac,src,dep,tab){
  src=normSrc(src||$("dbSrc").value||PERF_SRC[0]);
  dep=normDep(dep||$("dbDep").value||PERF_DEP[1]);
  tab=tab||"perf";
  MOPEN={pac,src,dep,tab};
  renderMachineModal();
  $("modal").classList.add("show");
}
function editGeneral(path,v){
  if(!MOPEN) return;
  const m=machineByPac(MOPEN.pac);
  const g=ensureMachineGeneral(m);
  if(!g) return;
  const parts=path.split(".");
  let o=g;
  for(let i=0;i<parts.length-1;i++) o=o[parts[i]];
  const key=parts[parts.length-1];
  const numKeys=new Set(["poidsKg","hauteurMm","largeurMm","profondeurMm","puissanceAcoustiqueDb","debitCaptageM3h","pdcCaptageKpa","debitChauffageM3h","pdcChauffageKpa","ballonL","appointElectriqueKw"]);
  o[key]=numKeys.has(key)?num(v):String(v).trim()||null;
  if(key==="ballonL"&&o[key]!=null) o.ballon=(o.ballon&&!/L/i.test(o.ballon)?o.ballon:o[key]+"L");
  applyMachineGeneralToPerf(MOPEN.pac,g);
  if(MOPEN.tab==="perf") renderMachineModal();
}
function closeModal(){
  $("modal").classList.remove("show");
  $("modal").querySelector(".card")?.classList.remove("fiche-wide");
  renderDB(); recalc();
}
function editFiche(k,v){
  if(!MOPEN||MOPEN.tab!=="perf") return;
  const f=ensurePage(MOPEN.pac,MOPEN.src,MOPEN.dep);
  f[k]=num(v);
  if(k==="chaud"||k==="absorbee"||k==="cop") syncCop(f);
}
function editMachineCharge(pac,v){
  const m=machineByPac(pac); if(m) m.chargeFluide=num(v);
  if(MOPEN&&MOPEN.pac===pac) renderMachineModal();
}
function addMachine(){
  const g=state.gammes[+$("dbGamme").value];
  const nom="Nouvelle PAC "+(state.machines.length+1);
  const m={pac:nom,gammeCode:g.code,tension:2,nbComp:1,ref:0,reversible:1,composantsLiens:{},frigoTuyaux:{},frigoLayout:{},frigoElements:FRIGO_ALL_KEYS.slice(),hydroLayout:{},hydroElements:HYDRO_DEFAULT_ELEMENTS.slice()};
  ensureMachineGeneral(m);
  state.machines.push(m);
  initMachinePages(nom); renderDB(); toast("Machine ajoutée — 9 fiches + fiche générale");
}
function delMachine(i){ if(confirm("Supprimer "+state.machines[i].pac+" ?")){ state.machines.splice(i,1); renderDB(); } }

/* ---------- TAB 3 : sélection ---------- */
function runSelection(){
  recalc(); const r=LAST,s=projet.source;
  $('res_cible').textContent=fmt(r.pInst,1);
  $('res_regime').textContent=`${r.src} → ${r.depRegime} · COP ${fmt(r.cop,2)} · émetteur ${r.regimeEmitter}°C`;
  $('res_biv').textContent = r.Tbiv!=null? `${fmt(r.Tbiv,0)} °C` : "couvert";
  if(!r.gamme){
    $('res_ctx').textContent="Aucune gamme — ajoutez-en une dans l'onglet Base machines";
    $('cards_mono').innerHTML=$('cards_multi').innerHTML='<div class="empty">Sélectionnez ou créez une gamme de PAC.</div>';
    return;
  }
  $('res_ctx').textContent=`${r.gamme.nom} (${fonctionLabel(r.gamme.fonction)}) · ${tLabel(s.tension)} · ${s.reversible?'réversible':'chaud seul'}`;
  const sel=Engine.selection(state.machines,state.performances,r.gamme.code,s.tension,s.reversible,r.src,r.depRegime,r.pInst);
  $('cards_mono').innerHTML=cards(sel.mono,r); $('cards_multi').innerHTML=cards(sel.multi,r);
}
function tLabel(t){ return t===0?"mono 230V":t===1?"tri 400V":"tension indiff."; }
function cards(arr,r){
  if(!arr||!arr.length) return `<div class="empty">Aucune machine de cette catégorie ne correspond aux paramètres.</div>`;
  const capt=state.captages[projet.source.captage];
  return arr.map((m,i)=>{ const cov=m.couverture, over=cov>=100, reco=i===0&&over;
    const f=getFiche(state.performances,m.pac,r.src,r.depRegime);
    let lcapt=null;
    if(f&&f.capteurVert) lcapt=Math.round(f.capteurVert*(r.pInst/m.pCalo)); // longueur ajustée au besoin
    else if(capt.mlParKw>0&&m.cop) lcapt=Math.round((m.pCalo-m.pCalo/m.cop)*capt.mlParKw);
    return `<div class="mcard${reco?' reco':''}">${reco?'<span class="reco-flag">Recommandée</span>':''}
      <div class="top"><h4>${m.pac}</h4><div class="sub">${m.nbComp} compresseur(s) · ${tLabel(m.tension)}</div></div>
      <div class="body">
        <div class="mline"><span>Puissance calorifique</span><b>${fmt(m.pCalo,2)} kW</b></div>
        <div class="mline"><span>COP au régime</span><b>${m.cop?m.cop.toFixed(2):'—'}</b></div>
        ${f&&f.hp?`<div class="mline"><span>Pressions HP / BP</span><b>${fmt(f.hp,1)} / ${fmt(f.bp,1)}</b></div>`:''}
        ${(()=>{const imp=calcGwpImpact(m); return imp?`<div class="mline"><span>GWP (${imp.fluide})</span><b>${fmt(imp.charge,2)} kg · ${fmt(imp.co2eqT,2)} tCO₂eq</b></div>`:'';})()}
        <div class="mline"><span>Besoin à couvrir</span><b>${fmt(r.pInst,1)} kW</b></div>
        ${lcapt!=null?`<div class="mline"><span>Capteur (${capt.nom.toLowerCase()})</span><b>${lcapt} ${capt.mlParKw>0&&!f?.capteurVert?'ml':'ml'}</b></div>`:''}
        <div class="cov"><i class="${over?'':'over'}" style="width:${Math.min(100,cov)}%"></i></div>
        <div class="mline" style="border:none"><span>Couverture</span><b style="color:${over?'var(--ok)':'var(--bad)'}">${fmt(cov,0)} %</b></div>
        <button class="btn-soft noprint" style="width:100%;margin-top:8px" onclick="chooseForNote('${m.pac}')">Retenir pour la note →</button>
      </div></div>`; }).join('');
}
let chosen=null;
function chooseForNote(pac){ const r=LAST; const m=Engine.selection(state.machines,state.performances,r.gamme.code,projet.source.tension,projet.source.reversible,r.src,r.depRegime,r.pInst);
  const all=[...m.mono,...m.multi].find(x=>x.pac===pac)||{pac,pCalo:Engine.pCalo(state.performances,pac,r.src,r.depRegime),cop:Engine.copReg(state.performances,pac,r.src,r.depRegime),nbComp:1};
  chosen=all; renderNote(); goTab('note'); recalc(); toast(pac+" retenue"); }

/* ---------- TAB 4 : comparaison énergies ---------- */
function readPrix(){ const p=state.prix;
  if(!$('c_pelec')) return;
  p.elec=+$('c_pelec').value;p.fuelL=+$('c_pfuel').value;p.rdtFuel=+$('c_rfuel').value;p.gazKwh=+$('c_pgaz').value;p.rdtGaz=+$('c_rgaz').value;p.granKg=+$('c_pgran').value;p.rdtGran=+$('c_rgran').value;p.bucheKwh=+$('c_pbuche').value;p.rdtBuche=+$('c_rbuche').value;
}
function buildCompareData(r){
  const p=state.prix, pci=state.pci, co2=state.co2, besoin=r.besoin;
  const sol=[
    {nom:`PAC géothermique`, pac:true, kwhUtileToCost: besoin/(r.scop||3.5)*p.elec, co2: besoin/(r.scop||3.5)*co2.pac},
    {nom:`Convecteurs élec.`, kwhUtileToCost: besoin/1.0*p.elec, co2: besoin*co2.joule},
    {nom:`Chaudière fioul`, kwhUtileToCost: (besoin/(p.rdtFuel/100))/pci.fuelL*p.fuelL, co2: besoin/(p.rdtFuel/100)*co2.fuel},
    {nom:`Chaudière gaz nat.`, kwhUtileToCost: besoin/(p.rdtGaz/100)*p.gazKwh, co2: besoin/(p.rdtGaz/100)*co2.gaz},
    {nom:`Chaudière granulés`, kwhUtileToCost: (besoin/(p.rdtGran/100))/pci.granKg*p.granKg, co2: besoin/(p.rdtGran/100)*co2.gran},
    {nom:`Chaudière bûches`, kwhUtileToCost: besoin/(p.rdtBuche/100)*p.bucheKwh, co2: besoin/(p.rdtBuche/100)*co2.buche}
  ];
  return {sol, besoin, scop:r.scop, p, maxC:Math.max(...sol.map(s=>s.kwhUtileToCost)), maxCo2:Math.max(...sol.map(s=>s.co2))};
}
function renderCompareBarsHtml(sol,maxC){
  return sol.map(s=>`<div class="barrow"><span class="lbl">${s.nom}</span>
    <div class="bar ${s.pac?'pac':''}" style="width:${Math.max(8,s.kwhUtileToCost/maxC*100)}%;background:${s.pac?OEDIP_BAR_GEO:OEDIP_BAR_HEAT}">${fmt(s.kwhUtileToCost,0)} €</div>
    <span class="cost">${fmt(s.kwhUtileToCost,0)} €/an</span></div>`).join('')
    +`<div class="hint" style="margin-top:10px">La PAC est prise comme référence : économie de <b>${fmt((1-sol[0].kwhUtileToCost/sol[2].kwhUtileToCost)*100,0)} %</b> vs fioul, <b>${fmt((1-sol[0].kwhUtileToCost/sol[3].kwhUtileToCost)*100,0)} %</b> vs gaz, <b>${fmt((1-sol[0].kwhUtileToCost/sol[1].kwhUtileToCost)*100,0)} %</b> vs convecteurs.</div>`;
}
function renderCompareCo2Html(sol,maxCo2){
  return sol.map(s=>`<div class="barrow"><span class="lbl">${s.nom}</span>
    <div class="bar ${s.pac?'pac':''}" style="width:${Math.max(8,s.co2/maxCo2*100)}%;background:${s.pac?OEDIP_BAR_GEO:OEDIP_BAR_GRAY}">${fmt(s.co2/1000,0)} kg</div>
    <span class="cost">${fmt(s.co2/1000,0)} kg/an</span></div>`).join('');
}
function renderCompareInto(targets,r){
  readPrix();
  r=r||compute();
  const {sol,besoin,scop,p,maxC,maxCo2}=buildCompareData(r);
  if(targets.besoin) targets.besoin.textContent=`besoin ${fmt(besoin,0)} kWh/an · SCOP PAC ${fmt(scop,2)}`;
  if(targets.bars) targets.bars.innerHTML=renderCompareBarsHtml(sol,maxC);
  if(targets.co2) targets.co2.innerHTML=renderCompareCo2Html(sol,maxCo2);
  if(targets.hint) targets.hint.textContent=`Hypothèses : élec ${fmt(p.elec,3)} €/kWh · fioul ${fmt(p.fuelL,2)} €/L (${fmt(p.rdtFuel,0)} %) · gaz ${fmt(p.gazKwh,3)} €/kWh (${fmt(p.rdtGaz,0)} %) · granulés ${fmt(p.granKg,2)} €/kg (${fmt(p.rdtGran,0)} %) · bûches ${fmt(p.bucheKwh,3)} €/kWh (${fmt(p.rdtBuche,0)} %). PCI : fioul 9,97 kWh/L · granulés 4,8 kWh/kg.`;
}
function renderCompare(){
  renderCompareInto({besoin:$('cmp_besoin'), bars:$('cmp_bars'), co2:$('cmp_co2')});
}
function syncNotePrintCompare(){
  renderCompareInto({
    besoin:$('noteCmpBesoin'),
    bars:$('noteCmpBars'),
    co2:$('noteCmpCo2'),
    hint:$('noteCmpHint')
  }, LAST);
}
function syncNotePrintAnnex(){
  syncNotePrintCharts();
  syncNotePrintCompare();
}

/* ---------- TAB 5 : note ---------- */
function ensureNoteLines(){
  if(!projet.noteLines||typeof projet.noteLines!=="object") projet.noteLines={};
}
function noteLineOn(id,def=true){
  ensureNoteLines();
  if(projet.noteLines[id]===undefined) projet.noteLines[id]=def;
  return !!projet.noteLines[id];
}
function noteRow(id,k,u,v){
  const on=noteLineOn(id);
  const sid=escAttr(id);
  return `<div class="drow note-row${on?"":" note-row-off"}" data-note-id="${sid}">
    <label class="note-row-chk noprint" title="Inclure à l'impression"><input type="checkbox"${on?" checked":""} onchange="toggleNoteLine('${sid}',this.checked)"></label>
    <span class="note-lbl">${escHtml(k)}</span><span class="u">${escHtml(u||"")}</span><span class="val">${escHtml(v==null?"—":String(v))}</span></div>`;
}
function noteHl(id,k,v){
  const on=noteLineOn(id);
  const sid=escAttr(id);
  return `<div class="hl note-row${on?"":" note-row-off"}" data-note-id="${sid}">
    <label class="note-row-chk noprint" title="Inclure à l'impression"><input type="checkbox"${on?" checked":""} onchange="toggleNoteLine('${sid}',this.checked)"></label>
    <span><b>${escHtml(k)}</b></span><span class="v">${escHtml(v==null?"—":String(v))}</span></div>`;
}
function noteFoot(id,text){
  const on=noteLineOn(id);
  const sid=escAttr(id);
  return `<div class="foot note-row${on?"":" note-row-off"}" data-note-id="${sid}">
    <label class="note-row-chk noprint" style="display:inline-flex;margin-right:8px;vertical-align:middle" title="Inclure à l'impression"><input type="checkbox"${on?" checked":""} onchange="toggleNoteLine('${sid}',this.checked)"></label>${escHtml(text)}</div>`;
}
function toggleNoteLine(id,on){
  ensureNoteLines();
  projet.noteLines[id]=!!on;
  document.querySelectorAll(`[data-note-id="${CSS.escape(id)}"]`).forEach(el=>el.classList.toggle("note-row-off",!on));
  markDirty();
}
function setAllNoteLines(on){
  ensureNoteLines();
  document.querySelectorAll("#doc .note-row[data-note-id]").forEach(el=>{
    const id=el.dataset.noteId;
    if(!id) return;
    projet.noteLines[id]=!!on;
    el.classList.toggle("note-row-off",!on);
    const inp=el.querySelector('input[type="checkbox"]');
    if(inp) inp.checked=!!on;
  });
  markDirty();
}

function ensureNotePrintPresets(){
  if(!state.notePrintPresets||!Array.isArray(state.notePrintPresets)) state.notePrintPresets=[];
}
function captureNotePrintConfig(){
  ensureNoteLines();
  return {
    noteLines:{...projet.noteLines},
    includeAnnex:!!$('notePrintCharts')?.checked
  };
}
function applyNotePrintConfig(cfg,opts){
  opts=opts||{};
  if(!cfg) return;
  ensureNoteLines();
  if(cfg.noteLines) projet.noteLines={...cfg.noteLines};
  if(cfg.includeAnnex!=null){
    projet.notePrintIncludeAnnex=!!cfg.includeAnnex;
    const cb=$('notePrintCharts');
    if(cb) cb.checked=!!cfg.includeAnnex;
    $('docPrintCharts')?.classList.toggle('print-include',!!cfg.includeAnnex);
  }
  if($('doc')?.innerHTML) applyNoteLinesToDom();
  else if(opts.rerender!==false) renderNote();
  if(cfg.includeAnnex) syncNotePrintAnnex();
  if(!opts.silent) toast("Config d'impression appliquée");
  if(!opts.skipDirty) markDirty();
}
function applyNoteLinesToDom(){
  document.querySelectorAll("#doc .note-row[data-note-id]").forEach(el=>{
    const id=el.dataset.noteId;
    if(!id) return;
    const on=noteLineOn(id);
    el.classList.toggle("note-row-off",!on);
    const inp=el.querySelector('input[type="checkbox"]');
    if(inp) inp.checked=on;
  });
}
function fillNotePrintPresetSelect(){
  const sel=$('notePrintPresetSel');
  if(!sel) return;
  ensureNotePrintPresets();
  const cur=projet.notePrintPresetId||"";
  sel.innerHTML='<option value="">Config d\'impression…</option>'
    +state.notePrintPresets.map(p=>`<option value="${escAttr(p.id)}"${p.id===cur?" selected":""}>${escHtml(p.name)}</option>`).join("");
}
async function saveNotePrintPreset(){
  const name=prompt("Nom de la configuration d'impression :");
  if(!name||!name.trim()) return;
  ensureNotePrintPresets();
  const cfg={id:"np_"+Date.now().toString(36), name:name.trim(), ...captureNotePrintConfig(), savedAt:new Date().toISOString()};
  const i=state.notePrintPresets.findIndex(p=>p.name.toLowerCase()===cfg.name.toLowerCase());
  if(i>=0){
    if(!confirm(`Remplacer la config « ${cfg.name} » ?`)) return;
    cfg.id=state.notePrintPresets[i].id;
    state.notePrintPresets[i]=cfg;
  } else state.notePrintPresets.push(cfg);
  projet.notePrintPresetId=cfg.id;
  fillNotePrintPresetSelect();
  markDirty();
  const cloudOk=typeof syncNotePrintPresetsToCloud==="function"?await syncNotePrintPresetsToCloud():false;
  toast("Config enregistrée · "+cfg.name+(cloudOk?" · profil cloud":""));
}
function loadNotePrintPreset(id){
  if(!id){
    projet.notePrintPresetId="";
    fillNotePrintPresetSelect();
    return;
  }
  ensureNotePrintPresets();
  const p=state.notePrintPresets.find(x=>x.id===id);
  if(!p) return;
  projet.notePrintPresetId=id;
  applyNotePrintConfig(p,{skipDirty:false});
  fillNotePrintPresetSelect();
}
async function deleteNotePrintPreset(){
  const sel=$('notePrintPresetSel');
  const id=sel?.value;
  if(!id){ alert("Sélectionnez une config à supprimer."); return; }
  ensureNotePrintPresets();
  const p=state.notePrintPresets.find(x=>x.id===id);
  if(!p||!confirm(`Supprimer la config « ${p.name} » ?`)) return;
  state.notePrintPresets=state.notePrintPresets.filter(x=>x.id!==id);
  if(projet.notePrintPresetId===id) projet.notePrintPresetId="";
  fillNotePrintPresetSelect();
  markDirty();
  const cloudOk=typeof syncNotePrintPresetsToCloud==="function"?await syncNotePrintPresetsToCloud():false;
  toast("Config supprimée"+(cloudOk?" · profil cloud":""));
}

function renderNote(){
  recalc(); const r=LAST,c=projet.client,b=projet.batiment,bs=projet.besoin,e=projet.ecs,s=projet.source;
  const d=state.departements.find(x=>x.code===b.dept)||{};
  ensureProjetHydraulique(projet);
  ensureNoteLines();
  const zoneRows=(bs.zones||[]).map((z,i)=>{
    const em=state.emetteurs[z.emIdx];
    const lbl=typeof zoneChauffDetailLabel==='function'?zoneChauffDetailLabel(z,em):emetteurOptionLabel(em);
    const nom=typeof zoneDisplayName==='function'?zoneDisplayName(z):'Zone';
    return noteRow("zone."+i,nom,"-",lbl);
  }).join('');
  const fnGam=r.gamme.fonction?fonctionLabel(r.gamme.fonction):"géothermie";
  let h=`<div class="dhead"><div class="spark"></div><div><h2>Note de dimensionnement</h2><div class="note">OEDIP — ${fnGam}${r.gamme.desc?(' · '+r.gamme.desc):''}</div></div>
    <div class="meta">${state.meta.outil} ${state.meta.version}<br>Réf : ${c.ref||'—'}<br>${new Date().toLocaleDateString('fr-FR')}</div></div>
  <section><h3 class="dt">Opération &amp; client</h3>
    ${noteRow("client.ref","Référence chantier","",c.ref||'—')}${noteRow("client.type","Type de chantier","",c.type||'—')}${noteRow("client.nom","Client","",c.nom||'—')}
    ${noteRow("client.adresse","Adresse","",(c.adr||'')+' '+(c.cp||'')+' '+(c.ville||''))}${noteRow("client.installateur","Installateur","",c.installateur||'—')}${noteRow("client.referent","Référent","",c.referent||'—')}</section>
  <section><h3 class="dt">Données d'entrée de l'étude</h3>
    ${noteRow("input.cp","Code postal","",c.cp||"—")}${noteRow("input.dept","Département","-",d.code+" · "+d.nom)}${noteRow("input.alt","Altitude","m",fmt(b.alt,0))}${noteRow("input.tbaseRef","T° base département (réf.)","°C",fmt(r.TbaseRef,0))}${noteRow("input.tbase","Température de base retenue","°C",fmt(r.Tbase,0))}
    ${noteRow("input.vol","Volume chauffé","m³",fmt(r.V,0))}${noteRow("input.tint","Température intérieure","°C",fmt(b.tint,0))}${noteRow("input.g","Coefficient G","W/m³.°C",fmt(r.G,2))}
    ${zoneRows||noteRow("input.zones","Zones de chauffage","-","—")}
    ${noteRow("input.regimeEmitter","Régime émetteur retenu","°C",r.regimeEmitter?r.regimeEmitter+"°C":'—')}${noteRow("input.depRegime","Point perf catalogue","°C",r.depRegime)}${noteRow("input.copEmitter","COP au régime émetteur","-",fmt(r.cop,2))}
    ${r.hydro?.active?noteRow("hydro.debit","Débit chauffage estimé","m³/h",fmt(r.hydro.debitM3h,2))+noteRow("hydro.pdc","Pdc chauffage estimée","kPa",fmt(r.hydro.pdcTotalKpa,1))+noteRow("hydro.hmt","HMT estimée","m",fmt(r.hydro.hmtM,2)):''}
    ${noteRow("input.ecs","Eau chaude sanitaire","-",e.present?("Oui · "+e.nb+" pers · ballon "+fmt(Engine.volumeBallon(e),0)+" L"):"Non")}${noteRow("input.source","Type de source","-",r.src)}</section>
  <section><h3 class="dt">Besoins en puissance</h3>
    ${noteRow("power.dep","Déperditions thermiques à T base","W",fmt(r.dep*1000,0))}${noteRow("power.pECS","Puissance additionnelle ECS","W",fmt(r.pECS*1000,0))}${noteRow("power.surp","Surpuissance appliquée","%",fmt(bs.surp,0))}
    ${noteHl("power.pInst","Puissance à installer",fmt(r.pInst,1)+" kW")}</section>
  <section><h3 class="dt">Étude énergétique annuelle (DJU intégrés par tranches)</h3>
    ${noteRow("nrg.dju","DJU de référence (SDES base "+(state.reglages?.djuBase??17)+"°C, "+djuRefLabel(r.djuAnnee??state.reglages?.djuAnnee)+")","DJU",fmt(r.dju,0))}${noteRow("nrg.tnc","T° de non-chauffage","°C",fmt(state.reglages.tnc,1))}
    ${noteRow("nrg.heures","Heures de chauffage","h/an",fmt(r.heures,0))}${noteRow("nrg.tbiv","Point de bivalence",">°C", r.Tbiv!=null?fmt(r.Tbiv,0):"sans appoint")}
    ${noteRow("nrg.besoin","Besoin énergétique annuel","kWh/an",fmt(r.besoin,0))}${noteRow("nrg.appoint","Énergie d'appoint","kWh/an",fmt(r.appoint,0))}
    ${noteRow("nrg.scop","SCOP saisonnier","-",fmt(r.scop,2))}${noteRow("nrg.elec","Consommation électrique PAC","kWh/an",fmt(r.elec,0))}${noteRow("nrg.economie","Économie d'énergie","%",fmt(r.economie,1))}</section>`;
  if(chosen){ const capt=state.captages[s.captage]; const f=getFiche(state.performances,chosen.pac,r.src,r.depRegime);
    let lcapt = f&&f.capteurVert? Math.round(f.capteurVert*(r.pInst/chosen.pCalo)) : null;
    h+=`<section><h3 class="dt">Solution retenue</h3>
      ${noteRow("sol.pac","Modèle de PAC","-",chosen.pac)}${noteRow("sol.gamme","Gamme","-",r.gamme.nom)}${noteRow("sol.fonction","Fonction","-",fnGam)}${noteRow("sol.comp","Compresseurs","-",chosen.nbComp)}
      ${noteRow("sol.pCalo","Puissance calorifique au régime","kW",fmt(chosen.pCalo,2))}${noteRow("sol.cop","COP au régime","-",chosen.cop?fmt(chosen.cop,2):'—')}
      ${noteRow("sol.coverage","Taux de couverture","%",fmt(chosen.pCalo/r.pInst*100,0))}
      ${f&&f.hp?noteRow("sol.hp","Pressions HP / BP","barg",fmt(f.hp,1)+" / "+fmt(f.bp,1)):''}
      ${(()=>{const imp=calcGwpImpact(machineByPac(chosen.pac)); return imp?[
        noteRow("sol.fluide","Fluide frigorigène","-",imp.fluide),
        noteRow("sol.gwp","PRP (GWP)","kg CO₂eq/kg",fmt(imp.gwp,0)),
        noteRow("sol.charge","Charge fluide","kg",fmt(imp.charge,2)),
        noteRow("sol.co2eq","Impact GWP (fuite totale)","tCO₂eq",fmt(imp.co2eqT,3))
      ].join(''):'';})()}
      ${f&&f.debitR407C?noteRow("sol.debitR407C","Débit R407C","g/s",fmt(f.debitR407C,1)):''}
      ${f&&f.chaudM3H?noteRow("sol.chaudM3H","Débit hydraulique chaud","m³/h",fmt(f.chaudM3H,2)):''}
      ${lcapt?noteRow("sol.captage","Longueur de captage ("+capt.nom.toLowerCase()+")","ml",fmt(lcapt,0)):''}</section>`;
  } else { h+=`<section><h3 class="dt">Solution retenue</h3><div class="note">Aucune machine retenue — onglet « Résultats &amp; sélection », bouton « Retenir pour la note ».</div></section>`; }
  h+=noteFoot("note.foot",`Ces informations sont non contractuelles et données à titre indicatif. Besoin annuel calculé par intégration des DJU sur les tranches de température (base ${state.reglages.tnc}°C). — ${state.meta.outil} ${state.meta.version}`);
  $('doc').innerHTML=h;
  const annexCb=$('notePrintCharts');
  if(annexCb){
    if(projet.notePrintIncludeAnnex!=null) annexCb.checked=!!projet.notePrintIncludeAnnex;
    else projet.notePrintIncludeAnnex=annexCb.checked;
    $('docPrintCharts')?.classList.toggle('print-include',annexCb.checked);
  }
  fillNotePrintPresetSelect();
  const chartMeta=$('noteChartDocMeta');
  if(chartMeta) chartMeta.innerHTML=`Réf : ${c.ref||'—'}<br>${new Date().toLocaleDateString('fr-FR')}`;
  if($('notePrintCharts')?.checked) syncNotePrintAnnex();
}

function toggleNotePrintChartsPreview(){
  const on=$('notePrintCharts')?.checked;
  projet.notePrintIncludeAnnex=!!on;
  $('docPrintCharts')?.classList.toggle('print-include',!!on);
  if(on) syncNotePrintAnnex();
  markDirty();
}
function printNote(){
  const include=$('notePrintCharts')?.checked;
  const block=$('docPrintCharts');
  if(block){
    block.classList.toggle('print-include',!!include);
    if(include) syncNotePrintAnnex();
  }
  window.print();
}

/* ---------- NAV ---------- */
function goTab(t){ document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $('v-'+t).classList.add('active');
  if(t==='result')runSelection(); if(t==='note')renderNote(); if(t==='db')renderGammes(); if(t==='compare')renderCompare();
  if(t==='composants') initComposantsTab();
  if(t==='outils'&&typeof initOutilsTab==='function') initOutilsTab();
  if(t==='installation'&&typeof initInstallationTab==='function') initInstallationTab();
  if(t==='procedures'&&typeof initProceduresTab==='function') initProceduresTab();
  if(t==='projet') setTimeout(()=>renderDjuChart(LAST), 50);
  window.scrollTo(0,0); }
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

