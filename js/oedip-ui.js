/* OEDIP — interface — ne pas modifier l'ordre de chargement dans oedip.html */
/* ---------- 4. UI ---------- */
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
let formDomHydrated=false;
function resetFormDomHydration(){ formDomHydrated=false; }
function fillSelects(){
  if(formDomHydrated&&typeof readForm==="function"&&typeof projet!=="undefined") readForm();
  normalizeGammes();
  normalizeEmetteurs();
  const opt=g=>(`${g.nom} · ${fonctionLabel(g.fonction)}`);
  $('s_gamme').innerHTML=state.gammes.map((g,i)=>`<option value="${i}">${opt(g)}</option>`).join('');
  $('dbGamme').innerHTML=state.gammes.map((g,i)=>`<option value="${i}">${g.nom} (code ${g.code}) — ${fonctionLabel(g.fonction)}</option>`).join('');
  fillDjuYearSelect();
  $('b_dept').innerHTML=state.departements.map(d=>`<option value="${d.code}">${d.code} · ${d.nom}</option>`).join('');
  $('b_isotype').innerHTML=state.isolationTypes.map((t,i)=>`<option value="${i}">${t.nom} (G=${t.g})</option>`).join('');
  $('s_capt').innerHTML=state.captages.map((c,i)=>`<option value="${i}">${c.nom}</option>`).join('');
  restoreStudyFormSelects();
  renderZonesChauffUI();
}
function restoreStudyFormSelects(){
  if(typeof projet==="undefined") return;
  const b=projet.batiment, s=projet.source;
  if($('b_dept')&&b.dept) $('b_dept').value=b.dept;
  if($('b_isotype')!=null) $('b_isotype').value=b.isoType??0;
  if($('s_gamme')!=null&&s.gamme!=null){
    $('s_gamme').value=s.gamme;
    refreshGammeSourceUi(s.gamme, s.regimeSource);
  }
  if($('s_capt')!=null) $('s_capt').value=s.captage??0;
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
  const blocks=list.querySelectorAll('.zone-chauff-block');
  if(!blocks.length) return;
  const zones=[];
  blocks.forEach((block,i)=>{
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
      nbEmetteurs:+(block.querySelector('.zone-nb')?.value||0),
      radSizing:block.querySelector('.zone-rad-sizing')?.value||'',
      radPnomKw:+(block.querySelector('.zone-rad-pnom')?.value||0),
      radHeightMm:+(block.querySelector('.zone-rad-h')?.value||0),
      radWidthMm:+(block.querySelector('.zone-rad-w')?.value||0),
      radType:+(block.querySelector('.zone-rad-type')?.value||21)
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
    const vis=typeof hydroZoneFieldVisibility==='function'?hydroZoneFieldVisibility(em):{nb:true,rad:false};
    const nom=typeof zoneDisplayName==='function'?zoneDisplayName(z,i):`Zone ${i+1}`;
    const volMode=z.volMode==='vol'?'vol':'surf';
    const vol=typeof zoneVolumeM3==='function'?zoneVolumeM3(z):0;
    const nomVal=escAttr(z.nom??'');
    const volDirect=volMode==='vol'?vol:(z.volumeM3||0);
    const radMode=z.radSizing==='pnom'||z.radSizing==='dims'?z.radSizing:'';
    const radTypeOpts=typeof renderRadiatorTypeOptions==='function'?renderRadiatorTypeOptions(z.radType):'';
    const tint=projet?.batiment?.tint??20;
    const pnomPreview=radMode&&z.nbEmetteurs>0&&typeof radiatorPowerAtRegime==='function'
      ? radiatorPowerAtRegime(radiatorUnitPnomDt50Kw(z),em?.regime,tint)*(z.nbEmetteurs||0)
      : 0;
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
      <div class="zone-rad-fields" style="display:${vis.rad?'block':'none'}">
        <div class="row">
          <label>Dimensionnement rad.</label>
          <select class="zone-rad-sizing" onchange="onZoneRadSizingChange(${i})" style="grid-column:2/4">
            <option value=""${!radMode?' selected':''}>— Non renseigné —</option>
            <option value="dims"${radMode==='dims'?' selected':''}>Dimensions (H × L)</option>
            <option value="pnom"${radMode==='pnom'?' selected':''}>Puissance nominale @ ΔT50</option>
          </select>
        </div>
        <div class="zone-rad-dims" style="display:${radMode==='dims'?'block':'none'}">
          <div class="row">
            <label>Hauteur</label>
            <input type="number" class="zone-rad-h" value="${z.radHeightMm??600}" min="0" step="10" oninput="recalc()">
            <span class="unit">mm</span>
          </div>
          <div class="row">
            <label>Largeur</label>
            <input type="number" class="zone-rad-w" value="${z.radWidthMm??1000}" min="0" step="10" oninput="recalc()">
            <span class="unit">mm</span>
          </div>
          <div class="row">
            <label>Type panneau</label>
            <select class="zone-rad-type" onchange="recalc()" style="grid-column:2/4">${radTypeOpts}</select>
          </div>
        </div>
        <div class="zone-rad-pnom" style="display:${radMode==='pnom'?'block':'none'}">
          <div class="row">
            <label>P nom. / radiateur</label>
            <input type="number" class="zone-rad-pnom" value="${z.radPnomKw??0}" min="0" step="0.05" oninput="recalc()">
            <span class="unit">kW @ ΔT50</span>
          </div>
        </div>
        <p class="hint zone-rad-preview" style="margin:4px 0 0;font-size:11px">${pnomPreview>0?`→ ${fmt(pnomPreview,1)} kW transmissibles au régime retenu (${emetteurOptionLabel(em)})`:'Renseignez dimensions ou P nom. pour estimer la puissance max.'}</p>
      </div>
    </div>`;
  }).join('');
  updateZoneChauffFieldVisibility();
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
function onZoneRadSizingChange(idx){
  readZonesFromDom();
  const z=projet.besoin.zones[idx];
  if(!z) return;
  const block=$('zones_chauff_list')?.querySelector(`.zone-chauff-block[data-idx="${idx}"]`);
  const mode=block?.querySelector('.zone-rad-sizing')?.value||'';
  z.radSizing=mode==='pnom'||mode==='dims'?mode:'';
  updateZoneRadFieldVisibility();
  recalc();
}
function updateZoneRadFieldVisibility(){
  const list=$('zones_chauff_list');
  if(!list) return;
  list.querySelectorAll('.zone-chauff-block').forEach(block=>{
    const em=state.emetteurs[+block.querySelector('.zone-em')?.value];
    const vis=typeof hydroZoneFieldVisibility==='function'?hydroZoneFieldVisibility(em):{nb:true,rad:false};
    const radWrap=block.querySelector('.zone-rad-fields');
    if(radWrap) radWrap.style.display=vis.rad?'block':'none';
    const mode=block.querySelector('.zone-rad-sizing')?.value||'';
    const dims=block.querySelector('.zone-rad-dims');
    const pnom=block.querySelector('.zone-rad-pnom');
    if(dims) dims.style.display=mode==='dims'?'block':'none';
    if(pnom) pnom.style.display=mode==='pnom'?'block':'none';
  });
}
function updateZoneChauffFieldVisibility(){
  const list=$('zones_chauff_list');
  if(!list) return;
  list.querySelectorAll('.zone-chauff-block').forEach(block=>{
    const em=state.emetteurs[+block.querySelector('.zone-em')?.value];
    const vis=typeof hydroZoneFieldVisibility==='function'?hydroZoneFieldVisibility(em):{nb:true,rad:false};
    const nb=block.querySelector('.zone-field-nb');
    if(nb) nb.style.display=vis.nb?'grid':'none';
  });
  updateZoneRadFieldVisibility();
}
function updateZonesChauffSummary(){
  const el=$('zones_chauff_summary');
  if(!el) return;
  const zones=projet.besoin.zones||[];
  const surf=typeof zonesSurfaceM2==='function'?zonesSurfaceM2(zones):0;
  const vol=typeof zonesVolumeM3==='function'?zonesVolumeM3(zones):0;
  if(!zones.length){ el.textContent='Aucune zone — ajoutez au moins une zone.'; return; }
  const rad=typeof computeRadiatorTransmission==='function'?computeRadiatorTransmission(projet.besoin,projet,state.emetteurs):null;
  const radTxt=rad?.active?` · radiateurs ${fmt(rad.totalKw,1)} kW max`:'';
  el.textContent=`${zones.length} zone(s) · ${fmt(surf,0)} m² · volume total ${fmt(vol,1)} m³${radTxt}`;
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
function onGammeChange(){ const gi=+$('s_gamme').value;
  const g=state.gammes[gi];
  if(!g) return;
  projet.source.gamme=gi;
  projet.source.regimeSource=0;
  refreshGammeSourceUi(gi, 0);
  recalc(); }
function refreshGammeSourceUi(gammeIdx, regimeIdx){
  const g=state.gammes[gammeIdx];
  if(!g) return;
  const sel=$('s_source');
  if(sel){
    sel.innerHTML=g.sources.map((s,i)=>`<option value="${i}">${s}</option>`).join('');
    const ri=regimeIdx??0;
    if(ri>=0&&ri<g.sources.length) sel.value=ri;
  }
  const info=$('s_gammeInfo');
  const gwp=gammeGwp(g);
  if(!info) return;
  if(g.desc||g.fonction||g.fluide){
    info.style.display='block';
    const fl=g.fluide==="custom"?(g.fluideLabel||"Autre")+` (PRP ${fmt(gwp,0)})`:refrigerantLabel(g.fluide)+(gwp!=null?` · PRP ${fmt(gwp,0)}`:'');
    info.innerHTML=`<b>${fonctionLabel(g.fonction)}</b> · <b>${fl}</b>${g.desc?' — '+g.desc:''}`;
  } else info.style.display='none';
}
function bindSeg(id,cb){ const el=$(id); el.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{el.querySelectorAll('button').forEach(b=>b.classList.remove('on'));btn.classList.add('on');cb(btn.dataset.v);}); }
function setSeg(id,v){ $(id).querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==String(v))); }

function readForm(){
  if(!formDomHydrated) return;
  const c=projet.client,b=projet.batiment,bs=projet.besoin,e=projet.ecs;
  const g=id=>$(id);
  const sel=id=>{ const el=g(id); return el&&el.options.length?el.value:null; };
  if(g("p_ref")) c.ref=g("p_ref").value;
  if(g("p_type")) c.type=g("p_type").value;
  if(g("p_nom")) c.nom=g("p_nom").value;
  if(g("p_adr")) c.adr=g("p_adr").value;
  if(g("p_cp")) c.cp=g("p_cp").value;
  if(g("p_ville")) c.ville=g("p_ville").value;
  if(g("p_inst")) c.installateur=g("p_inst").value;
  if(g("p_referent")) c.referent=g("p_referent").value;
  if(sel("b_dept")!=null) b.dept=sel("b_dept");
  if(g("b_alt")) b.alt=+g("b_alt").value;
  if(g("b_tint")) b.tint=+g("b_tint").value;
  if(sel("b_isotype")!=null) b.isoType=+sel("b_isotype");
  if(g("b_gman")) b.gman=+g("b_gman").value;
  if(g("b_pdir")) bs.pDir=+g("b_pdir").value;
  if(g("b_rdt")) bs.rdt=+g("b_rdt").value;
  if(g("b_surp")) bs.surp=+g("b_surp").value;
  readZonesFromDom();
  const hy=ensureProjetHydraulique(projet);
  if(hy.pdcEchangeurAuto===false&&g("b_hydro_pdc_ech")) hy.pdcEchangeurKpa=+g("b_hydro_pdc_ech").value||0;
  if(g("b_hydro_pdc_coll")) hy.pdcCollecteurBoucleKpa=+g("b_hydro_pdc_coll").value||0;
  if(g("e_nb")) e.nb=+g("e_nb").value;
  if(g("e_vol")) e.volPers=+g("e_vol").value;
  if(sel("s_gamme")!=null) projet.source.gamme=+sel("s_gamme");
  if(sel("s_source")!=null) projet.source.regimeSource=+sel("s_source");
  if(sel("s_capt")!=null) projet.source.captage=+sel("s_capt");
  if(g("s_forage_wml")) projet.source.forageWml=+g("s_forage_wml").value||0;
  if(typeof readInstallForm==="function") readInstallForm();
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
  $('s_gamme').value=s.gamme;
  refreshGammeSourceUi(s.gamme, s.regimeSource);
  if($('s_source')) $('s_source').value=s.regimeSource;
  $('s_capt').value=s.captage;
  if($('s_forage_wml')) $('s_forage_wml').value=(typeof forageWmlValue==='function'?forageWmlValue():(s.forageWml||50));
  renderZonesChauffUI();
  setSeg('seg_littoral',b.littoral);setSeg('seg_isomode',b.isoMode);setSeg('seg_pdirect',bs.pDirectMode);setSeg('seg_ecs',e.present);setSeg('seg_tension',s.tension);setSeg('seg_rev',s.reversible);
  // prix
  const p=state.prix; $('c_pelec').value=p.elec;$('c_pfuel').value=p.fuelL;$('c_rfuel').value=p.rdtFuel;$('c_pgaz').value=p.gazKwh;$('c_rgaz').value=p.rdtGaz;$('c_pgran').value=p.granKg;$('c_rgran').value=p.rdtGran;$('c_pbuche').value=p.bucheKwh;$('c_rbuche').value=p.rdtBuche;
  toggleGroups();
  formDomHydrated=true;
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
  if(typeof projet!=="undefined"){
    if($('p_cp')) projet.client.cp=$('p_cp').value;
    if($('b_dept')) projet.batiment.dept=$('b_dept').value;
  }
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
function syncChosenMachine(r){
  if(!chosen?.pac) return;
  const raw=machineByPac(chosen.pac);
  if(!raw||!r.gamme||raw.gammeCode!==r.gamme.code){ chosen=null; return; }
  const pc=Engine.pCalo(state.performances,chosen.pac,r.src,r.depRegime);
  const cop=typeof resolveMachineCop==='function'
    ? resolveMachineCop(state.performances,chosen.pac,r.src,r.depRegime,r.depTemp,r.gamme)
    : Engine.copReg(state.performances,chosen.pac,r.src,r.depRegime);
  chosen={...raw,pac:chosen.pac,pCalo:pc,cop:cop||r.cop,couverture:pc&&r.pInst?pc/r.pInst*100:null};
}
function recalc(){
  readForm(); const r=compute();
  syncChosenMachine(r);
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
  const rCopLbl=$('r_cop_pt_lbl'); if(rCopLbl) rCopLbl.textContent=r.copFromMachine&&r.copPac
    ?`COP ${r.copPac} @ ${r.src} → ${r.regimeEmitter}°C`
    :`COP gamme @ ${r.src} → ${r.regimeEmitter}°C`;
  $('r_heures').innerHTML=`${fmt(r.heures,0)} <small>h</small>`;
  $('r_eco').innerHTML=`${fmt(r.economie,1)} <small>%</small>`;
  const djEl=$('r_djuMeta');
  if(djEl) djEl.textContent=`${fmt(r.dju,0)} DJU · ${djuRefLabel(r.djuAnnee)} · base ${r.djuBase??17}°C`;
  updateZonesChauffSummary();
  const hb=$('hydro_breakdown');
  if(hb){
    let hhtml=typeof renderHydrauliqueBreakdown==='function'?renderHydrauliqueBreakdown(r.hydro):'';
    if(typeof renderRadiatorTransmissionBreakdown==='function'&&r.radTransmission?.active){
      hhtml+=renderRadiatorTransmissionBreakdown(r.radTransmission,r.pInst);
    }
    hb.innerHTML=hhtml;
  }
  const rRad=$('r_rad_pmax');
  if(rRad){
    if(r.radTransmission?.active){
      const ok=r.pInst<=0||r.radTransmission.totalKw>=r.pInst;
      rRad.innerHTML=`${fmt(r.radTransmission.totalKw,1)} <small>kW</small>`;
      rRad.classList.toggle('warn-val',!ok);
    } else {
      rRad.innerHTML='—';
      rRad.classList.remove('warn-val');
    }
  }
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
        <button class="btn-soft" onclick="dupGamme(${i})">Dupliquer</button>
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
  closeGammeModal(); renderGammes();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
  toast("Gamme enregistrée");
}
function uniqueGammeName(base) {
  const root = String(base || "Gamme").trim() || "Gamme";
  if (!state.gammes.some((g) => g.nom === root)) return root;
  let n = 2;
  while (state.gammes.some((g) => g.nom === `${root} (copie${n > 2 ? " " + n : ""})`)) n++;
  return n === 2 ? `${root} (copie)` : `${root} (copie ${n})`;
}
function uniquePacName(base) {
  const root = String(base || "PAC").trim() || "PAC";
  if (!state.machines.some((m) => m.pac === root)) return root;
  let n = 2;
  while (state.machines.some((m) => m.pac === `${root} (copie${n > 2 ? " " + n : ""})`)) n++;
  return n === 2 ? `${root} (copie)` : `${root} (copie ${n})`;
}
function uniqueProcedureId(base) {
  const root = String(base || "proc").trim() || "proc";
  const ids = new Set();
  (state.procedureCatalogs || []).forEach((cat) => (cat.procedures || []).forEach((p) => ids.add(p.id)));
  if (!ids.has(root)) return root;
  let n = 2;
  while (ids.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}
/** Duplique une gamme, ses machines (fiches perf) et son catalogue procédures. */
function dupGamme(i) {
  normalizeGammes();
  const src = state.gammes[i];
  if (!src) return;
  const srcCode = +src.code;
  const newCode = nextGammeCode();
  const newGamme = JSON.parse(JSON.stringify(src));
  newGamme.nom = uniqueGammeName(src.nom);
  newGamme.code = newCode;
  state.gammes.push(newGamme);

  const pacMap = new Map();
  const srcMachines = state.machines.filter((m) => +m.gammeCode === srcCode);
  srcMachines.forEach((m) => {
    const newPac = uniquePacName(m.pac);
    pacMap.set(m.pac, newPac);
    const copy = JSON.parse(JSON.stringify(m));
    copy.pac = newPac;
    copy.gammeCode = newCode;
    if (typeof ensureMachineGeneral === "function") ensureMachineGeneral(copy);
    state.machines.push(copy);
    if (state.performances[m.pac]) {
      state.performances[newPac] = JSON.parse(JSON.stringify(state.performances[m.pac]));
    } else if (typeof initMachinePages === "function") initMachinePages(newPac);
  });

  const idMap = new Map();
  const procCat = typeof getProcedureCatalog === "function"
    ? getProcedureCatalog(srcCode)
    : (state.procedureCatalogs || []).find((c) => +c.gammeCode === srcCode);
  if (procCat?.procedures?.length) {
    const codes = typeof procedureCatalogGammeCodes === "function"
      ? procedureCatalogGammeCodes(procCat)
      : [+procCat.gammeCode];
    if (!codes.includes(newCode)) {
      procCat.gammeCodes = [...codes, newCode].sort((a, b) => a - b);
      if (typeof normalizeProcedureCatalog === "function") normalizeProcedureCatalog(procCat);
    }
  }

  if (idMap.size) {
    state.machines.forEach((m) => {
      if (+m.gammeCode !== newCode || !m.frigoProcDims) return;
      const next = {};
      Object.entries(m.frigoProcDims).forEach(([pid, val]) => {
        next[idMap.get(pid) || pid] = val;
      });
      m.frigoProcDims = next;
    });
  }

  renderGammes();
  const newIdx = state.gammes.findIndex((g) => +g.code === newCode);
  if (newIdx >= 0 && $("dbGamme")) $("dbGamme").value = String(newIdx);
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  toast(`Gamme dupliquée · ${newGamme.nom} · ${srcMachines.length} machine(s)`);
}
function delGamme(i){
  const g=state.gammes[i], nb=state.machines.filter(m=>m.gammeCode===g.code).length;
  if(nb&&!confirm(`Supprimer la gamme « ${g.nom} » et ses ${nb} machine(s) ?`)) return;
  if(!nb&&!confirm(`Supprimer la gamme « ${g.nom} » ?`)) return;
  const removed=state.machines.filter(m=>m.gammeCode===g.code).map(m=>m.pac);
  state.machines=state.machines.filter(m=>m.gammeCode!==g.code);
  removed.forEach(pac=>{ if(state.performances[pac]) delete state.performances[pac]; });
  state.gammes.splice(i,1);
  renderGammes();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
  toast("Gamme supprimée");
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
  if(typeof markCatalogDirty==="function") markCatalogDirty();
}
function ensurePage(pac,src,dep){
  initMachinePages(pac);
  const k=pageKey(src,dep);
  if(!state.performances[pac][k]) state.performances[pac][k]=mkPage({});
  return state.performances[pac][k];
}
function editPageQuick(pac,src,dep,k,v){
  const f=ensurePage(pac,src,dep);
  f[k]=num(v)||0;
  syncCop(f,machineByPac(pac));
  renderDB();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
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
function renderFicheElecPhase(f,machine){
  ensureFicheElecPhase(f,machine);
  const tri=ficheIsTriphase(f,machine);
  const pHint=tri?"P = √3 × 400 × I × cos φ":"P = 230 × I × cos φ";
  return `<div class="fiche-cell" style="grid-column:span 2"><div class="f"><label>Alimentation électrique</label>
    <div class="seg" style="margin-top:6px;max-width:280px">
      <button type="button" class="${tri?'':'on'}" onclick="editFicheElecPhase(0)">MONO 230 V</button>
      <button type="button" class="${tri?'on':''}" onclick="editFicheElecPhase(1)">TRI 400 V</button>
    </div>
    <div class="hint" style="font-size:11px;margin-top:6px">${pHint} · COP = P chaud / P élec</div>
  </div></div>`;
}
function renderFicheThermo(f,gam,src,machine){
  const fl=fluideDebitLabel(gam);
  let h=`<div class="fiche-layout">`;
  h+=`<div class="fiche-block b-puiss"><div class="fb-head">Puissances</div><div class="fiche-puiss-cop">
    <div class="fiche-row c4">
      ${ficheCell("chaud","Chaud","kW",f)}${ficheCell("froid","Froid","kW",f)}
      ${ficheCell("absorbee","Absorbée (élec)","kW",f)}${ficheCell("intensite","Intensité","A",f)}
    </div>
    <div class="fiche-row c4" style="margin-top:8px;align-items:end">
      ${ficheCell("cosPhi","cos φ","",f)}
      ${renderFicheElecPhase(f,machine)}
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
  syncCop(f,m);
  let h=renderPerfMatrix(pac,src,dep);
  h+=`<div class="fiche-block b-frigo" style="margin-bottom:14px"><div class="fb-head">Fluide frigorigène &amp; GWP</div>
    <div style="padding:12px 14px">
      <div class="fgrid" style="margin-bottom:10px">
        <div class="f"><label>Fluide (gamme)</label><input readonly value="${gam?(gam.fluide==="custom"?(gam.fluideLabel||"Autre"):refrigerantLabel(gam.fluide)):"—"}"></div>
        <div class="f"><label>PRP / GWP</label><input class="mono" readonly value="${gammeGwp(gam)!=null?gammeGwp(gam)+" kg CO₂eq/kg":""}"></div>
        <div class="f"><label>Charge fluide <span class="u">kg</span></label><input class="mono" type="number" step="0.01" value="${m&&m.chargeFluide!=null?m.chargeFluide:""}" onchange="editMachineCharge(${JSON.stringify(pac)},this.value)"></div>
      </div>${gwpHtml(imp)}</div></div>`;
  h+=renderFicheThermo(f,gam,src,m);
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
  if(typeof markCatalogDirty==="function") markCatalogDirty();
}
function closeModal(){
  const hadMachine=!!MOPEN;
  $("modal").classList.remove("show");
  $("modal").querySelector(".card")?.classList.remove("fiche-wide");
  MOPEN=null;
  renderDB(); recalc();
  if(hadMachine&&typeof markCatalogDirty==="function") markCatalogDirty();
}
function editFicheElecPhase(tri){
  if(!MOPEN||MOPEN.tab!=="perf") return;
  const f=ensurePage(MOPEN.pac,MOPEN.src,MOPEN.dep);
  const m=machineByPac(MOPEN.pac);
  f.elecTriphase=tri?1:0;
  f.tensionElec=tri?400:230;
  syncCop(f,m);
  renderMachineModal();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
}
function editFiche(k,v){
  if(!MOPEN||MOPEN.tab!=="perf") return;
  const f=ensurePage(MOPEN.pac,MOPEN.src,MOPEN.dep);
  const m=machineByPac(MOPEN.pac);
  const autoKeys=new Set(["chaud","froid","absorbee","intensite","cop","tensionElec","cosPhi","hp","bp","debitR407C","froidM3H","pdcEvapF","pdcTuyF","pdcTotF","chaudM3H","pdcCondC","pdcTuyC","pdcTotC","capteurM2","capteurMl","capteurHoriz","capteurVert","iMax230","iMax400","diamCoude","diamLyre","pCaptSpec","etaS30","etaS50"]);
  f[k]=autoKeys.has(k)?num(v):v;
  syncCop(f,m);
  if(["chaud","froid","absorbee","intensite","cop","cosPhi","elecTriphase"].includes(k)) renderMachineModal();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
}
function editMachineCharge(pac,v){
  const m=machineByPac(pac); if(m) m.chargeFluide=num(v);
  if(typeof markCatalogDirty==="function") markCatalogDirty();
  if(MOPEN&&MOPEN.pac===pac) renderMachineModal();
}
function addMachine(){
  const g=state.gammes[+$("dbGamme").value];
  const nom="Nouvelle PAC "+(state.machines.length+1);
  const m={pac:nom,gammeCode:g.code,tension:2,nbComp:1,ref:0,reversible:1,composantsLiens:{},frigoTuyaux:{},frigoLayout:{},frigoElements:FRIGO_ALL_KEYS.slice(),hydroLayout:{},hydroElements:HYDRO_DEFAULT_ELEMENTS.slice()};
  ensureMachineGeneral(m);
  state.machines.push(m);
  initMachinePages(nom); renderDB();
  if(typeof markCatalogDirty==="function") markCatalogDirty();
  toast("Machine ajoutée — 9 fiches + fiche générale");
}
function delMachine(i){ if(confirm("Supprimer "+state.machines[i].pac+" ?")){ state.machines.splice(i,1); renderDB(); if(typeof markCatalogDirty==="function") markCatalogDirty(); } }

/* ---------- TAB 3 : sélection ---------- */
function onSelectionCouvMinChange(){
  const el=$('res_couv_min');
  if(!el) return;
  const v=Math.max(50,Math.min(100,+(el.value)||70));
  el.value=v;
  if(!state.reglages) state.reglages={};
  state.reglages.selectionCouvMin=v;
  if(typeof markDirty==='function') markDirty();
  runSelection();
}
function runSelection(){
  recalc(); const r=LAST,s=projet.source;
  const couvMin=typeof selectionCouvMinPct==='function'?selectionCouvMinPct():70;
  const couvInp=$('res_couv_min');
  if(couvInp) couvInp.value=couvMin;
  $('res_cible').textContent=fmt(r.pInst,1);
  $('res_regime').textContent=`${r.src} → ${r.depRegime} · COP ${fmt(r.cop,2)} · émetteur ${r.regimeEmitter}°C`;
  $('res_biv').textContent = r.Tbiv!=null? `${fmt(r.Tbiv,0)} °C` : "couvert";
  if(!r.gamme){
    $('res_ctx').textContent="Aucune gamme — ajoutez-en une dans l'onglet Base machines";
    $('cards_mono').innerHTML=$('cards_multi').innerHTML='<div class="empty">Sélectionnez ou créez une gamme de PAC.</div>';
    return;
  }
  $('res_ctx').textContent=`${r.gamme.nom} (${fonctionLabel(r.gamme.fonction)}) · ${tLabel(s.tension)} · ${s.reversible?'réversible':'chaud seul'} · couv. ≥ ${couvMin} %`;
  const sel=Engine.selection(state.machines,state.performances,r.gamme.code,s.tension,s.reversible,r.src,r.depRegime,r.pInst,{couvMinPct:couvMin,depTemp:r.depTemp});
  $('cards_mono').innerHTML=cards(sel.mono,r,couvMin); $('cards_multi').innerHTML=cards(sel.multi,r,couvMin);
}
function tLabel(t){ return t===0?"mono 230V":t===1?"tri 400V":"tension indiff."; }
function cards(arr,r,couvMin){
  couvMin=couvMin??(typeof selectionCouvMinPct==='function'?selectionCouvMinPct():70);
  if(!arr||!arr.length) return `<div class="empty">Aucune machine entre ${couvMin} % et 150 % de couverture pour ces paramètres.</div>`;
  const capt=state.captages[projet.source.captage];
  const recoIdx=arr.findIndex(m=>m.couverture>=100);
  const recoAt=recoIdx>=0?recoIdx:arr.length-1;
  return arr.map((m,i)=>{ const cov=m.couverture, full=cov>=100, reco=i===recoAt;
    const f=getFiche(state.performances,m.pac,r.src,r.depRegime);
    let lcapt=null;
    if(f&&f.capteurVert) lcapt=Math.round(f.capteurVert*(r.pInst/m.pCalo));
    else if(capt.mlParKw>0&&m.cop) lcapt=Math.round((m.pCalo-m.pCalo/m.cop)*capt.mlParKw);
    const covColor=full?'var(--ok)':cov>=couvMin?'var(--heat)':'var(--bad)';
    const covHint=full?'':` <span class="hint" style="font-size:11px">(partielle · appoint)</span>`;
    return `<div class="mcard${reco?' reco':''}">${reco?`<span class="reco-flag">${full?'Recommandée':'Proche du besoin'}</span>`:''}
      <div class="top"><h4>${m.pac}</h4><div class="sub">${m.nbComp} compresseur(s) · ${tLabel(m.tension)}</div></div>
      <div class="body">
        <div class="mline"><span>Puissance calorifique</span><b>${fmt(m.pCalo,2)} kW</b></div>
        <div class="mline"><span>COP au régime</span><b>${m.cop?m.cop.toFixed(2):'—'}</b></div>
        ${f&&f.hp?`<div class="mline"><span>Pressions HP / BP</span><b>${fmt(f.hp,1)} / ${fmt(f.bp,1)}</b></div>`:''}
        ${(()=>{const imp=calcGwpImpact(m); return imp?`<div class="mline"><span>GWP (${imp.fluide})</span><b>${fmt(imp.charge,2)} kg · ${fmt(imp.co2eqT,2)} tCO₂eq</b></div>`:'';})()}
        <div class="mline"><span>Besoin à couvrir</span><b>${fmt(r.pInst,1)} kW</b></div>
        ${lcapt!=null?`<div class="mline"><span>Capteur (${capt.nom.toLowerCase()})</span><b>${lcapt} ${capt.mlParKw>0&&!f?.capteurVert?'ml':'ml'}</b></div>`:''}
        <div class="cov"><i class="${full?'':'over'}" style="width:${Math.min(150,cov)}%"></i></div>
        <div class="mline" style="border:none"><span>Couverture</span><b style="color:${covColor}">${fmt(cov,0)} %</b>${covHint}</div>
        <button class="btn-soft noprint" style="width:100%;margin-top:8px" onclick="chooseForNote('${escAttr(m.pac)}')">Retenir pour la note →</button>
      </div></div>`; }).join('');
}
let chosen=null;
function machineSelectionEntry(pac,r,couvMin){
  couvMin=couvMin??(typeof selectionCouvMinPct==='function'?selectionCouvMinPct():70);
  const s=projet.source;
  const sel=Engine.selection(state.machines,state.performances,r.gamme.code,s.tension,s.reversible,r.src,r.depRegime,r.pInst,{couvMinPct:couvMin,depTemp:r.depTemp});
  const found=[...sel.mono,...sel.multi].find(x=>x.pac===pac);
  if(found) return found;
  const raw=machineByPac(pac);
  if(!raw||raw.gammeCode!==r.gamme.code) return null;
  const matchT=mt=>mt===2||s.tension===2||mt===s.tension;
  if(!matchT(raw.tension)||raw.reversible<s.reversible) return null;
  const pc=Engine.pCalo(state.performances,pac,r.src,r.depRegime);
  if(!pc||pc<=0) return null;
  const cov=pc/r.pInst*100;
  if(cov<couvMin){
    toast(`Couverture ${fmt(cov,0)} % — sous le seuil ${couvMin} %`);
    return null;
  }
  const cop=typeof resolveMachineCop==='function'
    ? resolveMachineCop(state.performances,pac,r.src,r.depRegime,r.depTemp,r.gamme)
    : Engine.copReg(state.performances,pac,r.src,r.depRegime);
  return {...raw,pac,pCalo:pc,cop,couverture:cov};
}
function chooseForNote(pac){
  const r=LAST;
  const couvMin=typeof selectionCouvMinPct==='function'?selectionCouvMinPct():70;
  const all=machineSelectionEntry(pac,r,couvMin);
  if(!all) return;
  chosen=all;
  renderNote();
  goTab('note');
  recalc();
  toast(`${pac} retenue · couverture ${fmt(all.couverture,0)} %`);
}

/* ---------- TAB 4 : comparaison énergies ---------- */
function readPrix(){ const p=state.prix;
  if(!$('c_pelec')) return;
  p.elec=+$('c_pelec').value;p.fuelL=+$('c_pfuel').value;p.rdtFuel=+$('c_rfuel').value;p.gazKwh=+$('c_pgaz').value;p.rdtGaz=+$('c_rgaz').value;p.granKg=+$('c_pgran').value;p.rdtGran=+$('c_rgran').value;p.bucheKwh=+$('c_pbuche').value;p.rdtBuche=+$('c_rbuche').value;
}
function buildCompareData(r){
  const p=state.prix, pci=state.pci, co2=state.co2||{}, besoin=r.besoin;
  const sol=[
    {nom:`PAC géothermique`, pac:true, kwhUtileToCost: besoin/(r.scop||3.5)*p.elec, co2: besoin/(r.scop||3.5)*(co2.pac||0)},
    {nom:`Convecteurs élec.`, kwhUtileToCost: besoin/1.0*p.elec, co2: besoin*(co2.joule||0)},
    {nom:`Chaudière fioul`, kwhUtileToCost: (besoin/(p.rdtFuel/100))/pci.fuelL*p.fuelL, co2: besoin/(p.rdtFuel/100)*(co2.fuel||0)},
    {nom:`Chaudière gaz nat.`, kwhUtileToCost: besoin/(p.rdtGaz/100)*p.gazKwh, co2: besoin/(p.rdtGaz/100)*(co2.gaz||0)},
    {nom:`Chaudière granulés`, kwhUtileToCost: (besoin/(p.rdtGran/100))/pci.granKg*p.granKg, co2: besoin/(p.rdtGran/100)*(co2.gran||0)},
    {nom:`Chaudière bûches`, kwhUtileToCost: besoin/(p.rdtBuche/100)*p.bucheKwh, co2: besoin/(p.rdtBuche/100)*(co2.buche||0)}
  ];
  sol.forEach(s=>{
    s.kwhUtileToCost=Math.max(0,Number(s.kwhUtileToCost)||0);
    s.co2=Math.max(0,Number(s.co2)||0);
  });
  return {sol,besoin,scop:r.scop,p,maxC:Math.max(...sol.map(s=>s.kwhUtileToCost),1),maxCo2:Math.max(...sol.map(s=>s.co2),1)};
}
const COMPARE_BAR_NARROW_PCT=30;
const NOTE_COMPARE_BAR_NARROW_PCT=34;
const NOTE_CMP_PAC="#0E4D52";
const NOTE_CMP_OTHER="#3E8E9B";
const NOTE_SPARK_SVG=`<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.2" stroke="#fff" stroke-width="1.6"/><path d="M12 3v18" stroke="#fff" stroke-width="1.2" opacity=".5"/><path d="M6 9h5M6 9l2-2M6 9l2 2" stroke="#9fd6cf" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 15h-5m5 0l-2-2m2 2l-2 2" stroke="#ffd0b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function compareBarColor(entry){ return entry.pac?NOTE_CMP_PAC:NOTE_CMP_OTHER; }
function compareBarBg(entry){
  const c=compareBarColor(entry);
  return entry.pac?OEDIP_BAR_GEO:`linear-gradient(90deg,${c},${c}cc)`;
}
function compareBarRow(lbl,pct,barText,costText,isPac,bg){
  const w=Math.max(8,pct);
  const narrow=w<COMPARE_BAR_NARROW_PCT;
  return `<div class="barrow"><span class="lbl">${lbl}</span>
    <div class="bar-cell">
      <div class="bar ${isPac?"pac":""}${narrow?" bar-narrow":""}" style="width:${w}%;background:${bg}">${narrow?"":barText}</div>
      ${narrow?`<span class="bar-val-out">${barText}</span>`:""}
    </div>
    <span class="cost">${costText}</span></div>`;
}
function noteCompareBarRow(name,pct,label,isPac){
  const w=Math.max(4,pct);
  const inside=w>=NOTE_COMPARE_BAR_NARROW_PCT;
  const col=isPac?NOTE_CMP_PAC:NOTE_CMP_OTHER;
  return `<div class="note-cmp-row"><span class="blab">${escHtml(name)}</span>
    <div class="bar-cell">
      <div class="bar${inside?"":" bar-label-out"}" style="width:${w}%;background:${col}">${inside?escHtml(label):""}</div>
      ${inside?"":`<span class="bar-val-out" style="left:calc(${w}% + 6px)">${escHtml(label)}</span>`}
    </div></div>`;
}
function renderNoteCompareBarsHtml(sol,maxC){
  return sol.map(s=>noteCompareBarRow(
    s.nom,s.kwhUtileToCost/maxC*100,`${fmt(s.kwhUtileToCost,0)} €/an`,!!s.pac
  )).join("");
}
function renderNoteCompareCo2Html(sol,maxCo2){
  return sol.map(s=>noteCompareBarRow(
    s.nom,s.co2/maxCo2*100,`${fmt(s.co2/1e6,2)} t/an`,!!s.pac
  )).join("");
}
function renderCompareBarsHtml(sol,maxC){
  return sol.map(s=>compareBarRow(
    s.nom,
    s.kwhUtileToCost/maxC*100,
    `${fmt(s.kwhUtileToCost,0)} €`,
    `${fmt(s.kwhUtileToCost,0)} €/an`,
    !!s.pac,
    compareBarBg(s)
  )).join("")
    +`<div class="hint" style="margin-top:10px">La PAC est prise comme référence : économie de <b>${fmt((1-sol[0].kwhUtileToCost/sol[2].kwhUtileToCost)*100,0)} %</b> vs fioul, <b>${fmt((1-sol[0].kwhUtileToCost/sol[3].kwhUtileToCost)*100,0)} %</b> vs gaz, <b>${fmt((1-sol[0].kwhUtileToCost/sol[1].kwhUtileToCost)*100,0)} %</b> vs convecteurs.</div>`;
}
function renderCompareCo2Html(sol,maxCo2){
  return sol.map(s=>compareBarRow(
    s.nom,
    s.co2/maxCo2*100,
    `${fmt(s.co2/1e6,2)} t`,
    `${fmt(s.co2/1e6,2)} t/an`,
    !!s.pac,
    compareBarBg(s)
  )).join("");
}
function renderCompareInto(targets,r,opts){
  opts=opts||{};
  readPrix();
  r=r||compute();
  const {sol,besoin,scop,p,maxC,maxCo2}=buildCompareData(r);
  if(targets.besoin) targets.besoin.textContent=opts.noteStyle
    ?`besoin ${fmt(besoin,0)} kWh/an · SCOP PAC ${fmt(scop,2)}`
    :`besoin ${fmt(besoin,0)} kWh/an · SCOP PAC ${fmt(scop,2)}`;
  if(targets.bars) targets.bars.innerHTML=opts.noteStyle
    ?renderNoteCompareBarsHtml(sol,maxC):renderCompareBarsHtml(sol,maxC);
  if(targets.co2) targets.co2.innerHTML=opts.noteStyle
    ?renderNoteCompareCo2Html(sol,maxCo2):renderCompareCo2Html(sol,maxCo2);
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
  }, LAST, { noteStyle: true });
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
function noteRowChk(id,on){
  const sid=escAttr(id);
  return `<label class="note-row-chk noprint" title="Inclure à l'impression"><input type="checkbox"${on?" checked":""} onchange="toggleNoteLine('${sid}',this.checked)"></label>`;
}
function noteValHtml(u,v){
  if(v==null||v==="—") return "—";
  const s=String(v);
  if(!u||u==="-"||u==="") return escHtml(s);
  return `${escHtml(s)} <span class="u">${escHtml(u)}</span>`;
}
function noteRow(id,k,u,v,opts){
  opts=opts||{};
  const on=noteLineOn(id);
  const sid=escAttr(id);
  return `<div class="note-drow note-row${on?"":" note-row-off"}${opts.muted?" muted":""}${opts.wrap?" note-drow-wrap":""}" data-note-id="${sid}">
    ${noteRowChk(id,on)}<span class="lbl">${escHtml(k)}</span><span class="dots"></span><span class="val">${noteValHtml(u,v)}</span></div>`;
}
function noteSection(num,title,body,opts){
  opts=opts||{};
  return `<section class="block${opts.first?" note-block-first":""}"><div class="dt"><span class="num">${num}</span><h3>${title}</h3></div>${body}</section>`;
}
function noteReadout(id,label,value,unit,sub){
  const on=noteLineOn(id);
  const sid=escAttr(id);
  const parts=String(value??"—").trim().split(/\s+/);
  const num=parts[0]||"—";
  const u=unit||(parts[1]||"");
  return `<div class="readout note-row${on?"":" note-row-off"}" data-note-id="${sid}">
    ${noteRowChk(id,on)}<div class="ro-lbl">${escHtml(label)}${sub?`<small>${escHtml(sub)}</small>`:""}</div>
    <div class="ro-val">${escHtml(num)}${u?`<span class="u">${escHtml(u)}</span>`:""}</div></div>`;
}
function noteDocHead(opts){
  const icon=opts.showLogo&&opts.logoUrl
    ? `<div class="note-logo note-logo-img"><img src="${escAttr(opts.logoUrl)}" alt=""></div>`
    : `<div class="note-logo" aria-hidden="true">${NOTE_SPARK_SVG}</div>`;
  return `<header class="dhead">${icon}<div class="title">
    ${opts.eyebrow?`<div class="eyebrow">${escHtml(opts.eyebrow)}</div>`:""}
    <h1>${escHtml(opts.title||"Note de dimensionnement")}</h1>
    ${opts.company?`<div class="company">${escHtml(opts.company)}</div>`:""}
  </div><div class="meta">${opts.metaHtml||""}</div></header>`;
}
function notePageFoot(left,right){
  return `<div class="pagefoot"><span>${escHtml(left||"—")}</span><span>${escHtml(right||"")}</span></div>`;
}
function noteFoot(id,text){
  const on=noteLineOn(id);
  const sid=escAttr(id);
  return `<div class="foot note-row${on?"":" note-row-off"}" data-note-id="${sid}">${noteRowChk(id,on)}${escHtml(text)}</div>`;
}
function noteHl(id,k,v){
  return noteReadout(id,k,v,"", "Valeur retenue pour la sélection machine");
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
/** Entreprise utilisée pour la note courante : choix par étude sinon entreprise par défaut. */
function getNoteInstallerProfile(){
  const ni=projet.noteInstaller;
  if(ni&&ni.companyId&&Array.isArray(state.installerCompanies)){
    const c=state.installerCompanies.find(x=>x.id===ni.companyId);
    if(c) return c;
  }
  return typeof getInstallerProfile==="function"?getInstallerProfile():{};
}
function ensureProjetNoteInstaller(){
  if(!projet.noteInstaller||typeof projet.noteInstaller!=="object") projet.noteInstaller={};
  const ni=projet.noteInstaller;
  if(typeof ensureInstallerCompanies==="function") ensureInstallerCompanies();
  if(ni.companyId==null) ni.companyId=state.activeInstallerCompanyId||null;
  else if(Array.isArray(state.installerCompanies)&&state.installerCompanies.length&&!state.installerCompanies.some(c=>c.id===ni.companyId)){
    ni.companyId=state.activeInstallerCompanyId||null;
  }
  const ip=getNoteInstallerProfile();
  if(ni.showLogo==null) ni.showLogo=ip.showLogoOnNote!==false;
  if(ni.showCompany==null) ni.showCompany=ip.showCompanyOnNote!==false;
  return ni;
}
function syncNoteInstallerToolbar(){
  const ni=ensureProjetNoteInstaller();
  const lg=$("noteShowInstallerLogo");
  const co=$("noteShowInstallerCo");
  if(lg) lg.checked=!!ni.showLogo;
  if(co) co.checked=!!ni.showCompany;
  const sel=$("noteInstallerCompany");
  if(sel){
    const list=state.installerCompanies||[];
    sel.innerHTML=list.map((c,i)=>`<option value="${escAttr(c.id)}"${c.id===ni.companyId?" selected":""}>${escHtml((c.company&&c.company.trim())||`Entreprise ${i+1}`)}</option>`).join("");
  }
}
function onNoteInstallerCompanyChange(id){
  const ni=ensureProjetNoteInstaller();
  ni.companyId=id;
  markDirty();
  if($("doc")?.innerHTML) renderNote();
}
function toggleNoteInstallerDisplay(){
  const ni=ensureProjetNoteInstaller();
  ni.showLogo=!!$("noteShowInstallerLogo")?.checked;
  ni.showCompany=!!$("noteShowInstallerCo")?.checked;
  if($("doc")?.innerHTML) renderNote();
  else markDirty();
}
function noteInstallerSectionHtml(c,opts){
  opts=opts||{};
  const ip=getNoteInstallerProfile();
  const ni=ensureProjetNoteInstaller();
  if(!ni.showCompany) return "";
  const addr=[ip.adr,ip.cp,ip.ville].filter(Boolean).join(" ");
  let body="";
  if(ip.company) body+=noteRow("install.company","Raison sociale","",ip.company);
  if(addr) body+=noteRow("install.adresse","Adresse","",addr);
  if(ip.tel) body+=noteRow("install.tel","Téléphone","",ip.tel);
  if(ip.email) body+=noteRow("install.email","E-mail","",ip.email);
  if(ip.web) body+=noteRow("install.web","Site web","",ip.web);
  if(ip.siret) body+=noteRow("install.siret","SIRET","",ip.siret);
  if(c.referent) body+=noteRow("install.referent","Référent chantier","",c.referent);
  if(!body) return "";
  return noteSection("—","Installateur",body,opts);
}
function captureNotePrintConfig(){
  ensureNoteLines();
  ensureProjetNoteInstaller();
  return {
    noteLines:{...projet.noteLines},
    includeAnnex:!!$('notePrintCharts')?.checked,
    noteInstaller:{...projet.noteInstaller}
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
  if(cfg.noteInstaller) projet.noteInstaller={...cfg.noteInstaller};
  syncNoteInstallerToolbar();
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
  const fnGam=r.gamme?.fonction?fonctionLabel(r.gamme.fonction):"géothermie";
  const ni=ensureProjetNoteInstaller();
  const ip=getNoteInstallerProfile();
  const ref=c.ref||"—";
  const dateStr=new Date().toLocaleDateString("fr-FR");
  const pageFootCo=ip.company||c.installateur||state.meta.outil;
  const zoneRows=(bs.zones||[]).map((z,i)=>{
    const em=state.emetteurs[z.emIdx];
    const lbl=typeof zoneChauffDetailLabel==="function"?zoneChauffDetailLabel(z,em):emetteurOptionLabel(em);
    const nom=typeof zoneDisplayName==="function"?zoneDisplayName(z):"Zone";
    return noteRow("zone."+i,nom,"",lbl,{wrap:true});
  }).join("");
  const installSec=noteInstallerSectionHtml(c);
  const installClientLine=!installSec
    ?noteRow("client.installateur","Installateur","",c.installateur||"—",{muted:true})
      +noteRow("client.referent","Référent","",c.referent||"—")
    :"";
  const clientBody=
    noteRow("client.ref","Référence dossier","",c.ref||"—")
    +noteRow("client.type","Type de chantier","",c.type||"—")
    +noteRow("client.nom","Client","",c.nom||"—")
    +noteRow("client.adresse","Adresse","",(c.adr||"")+" "+(c.cp||"")+" "+(c.ville||"").trim()||"—")
    +installClientLine;
  const hydroRows=r.hydro?.active
    ?noteRow("hydro.debit","Débit chauffage estimé","m³/h",fmt(r.hydro.debitM3h,2))
      +noteRow("hydro.pdc","Pdc chauffage estimée","kPa",fmt(r.hydro.pdcTotalKpa,1))
      +noteRow("hydro.hmt","HMT estimée","m",fmt(r.hydro.hmtM,2)):"";
  const radRows=r.radTransmission?.active
    ?noteRow("power.radMax","Puissance transmissible radiateurs","kW",fmt(r.radTransmission.totalKw,1))
      +(r.pInst>0?noteRow("power.radMargin","Marge radiateurs / P installée","kW",fmt(r.radTransmission.totalKw-r.pInst,1)):""):"";
  const inputBody=
    noteRow("input.cp","Code postal / dépt.","",`${c.cp||"—"} · ${d.code||"—"}`)
    +noteRow("input.alt","Altitude","m",fmt(b.alt,0))
    +noteRow("input.tbase","T° base réf. / retenue","°C",`${fmt(r.TbaseRef,0)} / ${fmt(r.Tbase,0)}`)
    +noteRow("input.vol","Volume chauffé","m³",fmt(r.V,0))
    +noteRow("input.tint","Température intérieure","°C",fmt(b.tint,0))
    +noteRow("input.g","Coefficient G","W/m³·K",fmt(r.G,2))
    +(zoneRows||noteRow("input.zones","Zones de chauffage","—","—"))
    +noteRow("input.regimeEmitter","Régime émetteur retenu","°C",r.regimeEmitter?r.regimeEmitter+"°C":"—")
    +noteRow("input.depRegime","Point perf catalogue","°C",r.depRegime||"—")
    +noteRow("input.copEmitter","COP au régime émetteur","",fmt(r.cop,2))
    +hydroRows
    +radRows
    +noteRow("input.ecs","Eau chaude sanitaire","",e.present?`Oui · ${e.nb} pers · ballon ${fmt(Engine.volumeBallon(e),0)} L`:"Non")
    +noteRow("input.source","Type de source","",r.src||"—");
  const pInstShown=chosen?chosen.pCalo:r.pInst;
  const pInstSub=chosen?`${chosen.pac}`:"Valeur retenue pour la sélection machine";
  const besoinPwr=r.dep+r.pECS;
  const surpKw=pInstShown-besoinPwr;
  const surpPct=besoinPwr>0?(surpKw/besoinPwr)*100:0;
  const surpTxt=besoinPwr>0
    ?`${surpKw>=0?"+":""}${fmt(surpKw,1)} kW (${surpPct>=0?"+":""}${fmt(surpPct,0)} %)`
    :"—";
  const isGeoForage=/geo|hybride/i.test(r.gamme?.fonction||"");
  const copForage=(chosen&&chosen.cop)?chosen.cop:r.cop;
  const wMlForage=typeof forageWmlValue==="function"?forageWmlValue():50;
  const pExtrForage=(copForage>1&&pInstShown>0)?pInstShown*(1-1/copForage):null;
  const lForage=(pExtrForage>0&&wMlForage>0)?pExtrForage*1000/wMlForage:null;
  const forageRows=(isGeoForage&&lForage)
    ?noteRow("power.forageWml","Extraction sol retenue","W/ml",fmt(wMlForage,0))
      +noteRow("power.forageExtr","Puissance d'extraction sol","kW",fmt(pExtrForage,2))
      +noteRow("power.forage","Longueur de forage estimée","ml",fmt(lForage,0))
    :"";
  const powerBody=
    noteRow("power.dep","Déperditions (T base)","kW",fmt(r.dep,2))
    +noteRow("power.pECS","Puissance ECS","kW",fmt(r.pECS,2))
    +noteRow("power.surp","Surpuissance","",surpTxt)
    +noteReadout("power.pInst","Puissance installée",fmt(pInstShown,1),"kW",pInstSub)
    +forageRows;
  const nrgBody=
    noteRow("nrg.dju","DJU (intégrés par tranches)","",fmt(r.dju,0))
    +noteRow("nrg.tnc","T° de non-chauffage","°C",fmt(state.reglages.tnc,1))
    +noteRow("nrg.heures","Heures de chauffage","h/an",fmt(r.heures,0))
    +noteRow("nrg.tbiv","Point de bivalence","°C",r.Tbiv!=null?fmt(r.Tbiv,0):"sans appoint")
    +noteRow("nrg.besoin","Besoin énergétique annuel","kWh/an",fmt(r.besoin,0))
    +noteRow("nrg.appoint","Énergie d'appoint","kWh/an",fmt(r.appoint,0))
    +noteRow("nrg.scop","SCOP saisonnier","",fmt(r.scop,2))
    +noteRow("nrg.elec","Consommation électrique PAC","kWh/an",fmt(r.elec,0))
    +noteRow("nrg.economie","Économie d'énergie","%",fmt(r.economie,1));
  let solutionSec;
  if(chosen){
    const capt=state.captages[s.captage]; const f=getFiche(state.performances,chosen.pac,r.src,r.depRegime);
    const lcapt=f&&f.capteurVert?Math.round(f.capteurVert*(r.pInst/chosen.pCalo)):null;
    const imp=calcGwpImpact(machineByPac(chosen.pac));
    const solL=
      noteRow("sol.pac","Modèle PAC","",chosen.pac)
      +noteRow("sol.gamme","Gamme","",r.gamme.nom)
      +noteRow("sol.fonction","Fonction","",fnGam)
      +noteRow("sol.comp","Compresseurs","",chosen.nbComp)
      +noteRow("sol.pCalo","P. calorifique (régime)","kW",fmt(chosen.pCalo,2))
      +noteRow("sol.cop","COP (régime)","",chosen.cop!=null?fmt(chosen.cop,2):fmt(r.cop,2))
      +noteRow("sol.copCtx","Point perf.","",`${r.src} · émetteur ${r.regimeEmitter}°C`)
    const solR=
      noteRow("sol.coverage","Taux de couverture","%",fmt(chosen.pCalo/r.pInst*100,0))
      +(f&&f.hp?noteRow("sol.hp","Pressions HP / BP","barg",`${fmt(f.hp,1)} / ${fmt(f.bp,1)}`):"")
      +(imp?noteRow("sol.fluide","Fluide frigorigène","",imp.fluide)+noteRow("sol.gwp","GWP / charge","",`${fmt(imp.gwp,0)} · ${fmt(imp.charge,2)} kg`)+noteRow("sol.co2eq","Équivalent CO₂ (charge)","tCO₂eq",fmt(imp.co2eqT,3)):"")
      +(f&&f.debitR407C?noteRow("sol.debitR407C","Débit R407C","g/s",fmt(f.debitR407C,1)):"")
      +(f&&f.chaudM3H?noteRow("sol.chaudM3H","Débit hydraulique chaud","m³/h",fmt(f.chaudM3H,2)):"")
      +(lcapt?noteRow("sol.captage",`Captage (${capt.nom.toLowerCase()})`,"ml",fmt(lcapt,0)):"");
    solutionSec=noteSection("05","Solution retenue",
      `<div class="solution"><span class="badge"><span class="dot"></span>Machine sélectionnée</span><div class="note-cols note-cols-tight"><div class="note-col">${solL}</div><div class="note-col">${solR}</div></div></div>`);
  } else {
    solutionSec=noteSection("05","Solution retenue",
      `<div class="note-empty">Aucune machine retenue — onglet « Résultats &amp; sélection », bouton « Retenir pour la note ».</div>`);
  }
  const metaHtml=`${escHtml(state.meta.outil)} ${escHtml(state.meta.version)}<br>Réf : <b>${escHtml(ref)}</b><br>${escHtml(dateStr)}`;
  let h=`<div class="note-page">`;
  h+=noteDocHead({
    showLogo:!!ni.showLogo,
    logoUrl:ip.logoUrl,
    eyebrow:`Étude thermique · ${fnGam}`,
    title:"Note de dimensionnement",
    company:ip.company||c.installateur||"—",
    metaHtml
  });
  h+=`<div class="note-cols"><div class="note-col">`;
  h+=noteSection("01","Opération &amp; client",clientBody,{first:true});
  h+=noteSection("02","Données d'entrée de l'étude",inputBody);
  h+=`</div><div class="note-col">`;
  if(installSec) h+=noteInstallerSectionHtml(c,{first:true});
  h+=noteSection("03","Besoins en puissance",powerBody,{first:!installSec});
  h+=noteSection("04","Étude énergétique annuelle",nrgBody);
  h+=`</div></div>`;
  h+=solutionSec;
  h+=noteFoot("note.foot",`Note établie à titre indicatif sur la base des données communiquées et des hypothèses de l'étude (DJU intégrés par tranches de température, base ${state.reglages.tnc}°C). Document non contractuel. — ${state.meta.outil} ${state.meta.version}`);
  h+=notePageFoot(pageFootCo,`Réf. ${ref} — Page 1/2`);
  h+=`</div>`;
  $("doc").innerHTML=h;
  const annexCb=$("notePrintCharts");
  if(annexCb){
    if(projet.notePrintIncludeAnnex!=null) annexCb.checked=!!projet.notePrintIncludeAnnex;
    else projet.notePrintIncludeAnnex=annexCb.checked;
    $("docPrintCharts")?.classList.toggle("print-include",annexCb.checked);
  }
  fillNotePrintPresetSelect();
  syncNoteInstallerToolbar();
  const chartMeta=$("noteChartDocMeta");
  if(chartMeta) chartMeta.innerHTML=`Réf : <b>${escHtml(ref)}</b><br>${escHtml(dateStr)}`;
  const annexFoot=$("noteAnnexFoot");
  if(annexFoot) annexFoot.innerHTML=`<span>${escHtml(pageFootCo)}</span><span>Réf. ${escHtml(ref)} — Page 2/2</span>`;
  if($("notePrintCharts")?.checked) syncNotePrintAnnex();
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

/* ---------- TAB : Mon entreprise (multi-entreprises) ---------- */
let currentEntrepriseEditId=null;
function companyDisplayName(c,idx){
  return (c&&c.company&&c.company.trim())||`Entreprise ${idx+1}`;
}
function getEditedInstallerCompany(){
  if(typeof ensureInstallerCompanies==="function") ensureInstallerCompanies();
  let c=(state.installerCompanies||[]).find(x=>x.id===currentEntrepriseEditId);
  if(!c){ c=typeof getActiveInstallerCompany==="function"?getActiveInstallerCompany():(state.installerCompanies||[])[0]; currentEntrepriseEditId=c?.id||null; }
  return c||{};
}
function renderEntrepriseTab(){
  const root=$('v-entreprise');
  if(!root) return;
  if(typeof ensureInstallerCompanies==="function") ensureInstallerCompanies();
  const list=state.installerCompanies||[];
  const ip=getEditedInstallerCompany();
  const isActive=ip.id===state.activeInstallerCompanyId;
  const options=list.map((c,i)=>`<option value="${escAttr(c.id)}"${c.id===ip.id?" selected":""}>${escHtml(companyDisplayName(c,i))}${c.id===state.activeInstallerCompanyId?" ★":""}</option>`).join("");
  const logoPreview=ip.logoUrl
    ? `<img src="${escAttr(ip.logoUrl)}" alt="">`
    : `<span class="hint">Aucun logo</span>`;
  root.innerHTML=`<div class="panel inst-company-panel" style="max-width:720px;margin:0 auto">
    <div class="head"><h3>Mes entreprises</h3><span class="tag">Commercial · note de dimensionnement</span></div>
    <div class="body">
      <div class="hint">Enregistrez plusieurs sociétés (logo + coordonnées). L'entreprise marquée ★ <b>par défaut</b> est utilisée sur les nouvelles notes ; chaque étude peut choisir la sienne dans l'onglet Note. Données conservées sur ce poste et sur votre profil ☁ Cloud si connecté.</div>
      <div class="inst-company-pick">
        <div class="grow"><label class="subhead">Entreprise</label>
          <select id="instCompanySelect" onchange="onEntrepriseSelectChange(this.value)">${options}</select></div>
        <div class="inst-company-pick-btns">
          <button type="button" class="btn-soft" onclick="entrepriseAddNew()">+ Nouvelle</button>
          <button type="button" class="btn-ghost" onclick="entrepriseDeleteCurrent()"${list.length<=1?" disabled":""}>Supprimer</button>
        </div>
      </div>
      <div class="inst-company-default">
        ${isActive
          ? `<span class="inst-default-badge">★ Entreprise par défaut</span>`
          : `<button type="button" class="btn-ghost" onclick="entrepriseSetDefault()">★ Définir comme entreprise par défaut</button>`}
      </div>
      <div class="inst-company-grid">
        <div class="full"><label class="subhead">Raison sociale</label><input type="text" id="instCoName" value="${escHtml(ip.company||"")}" placeholder="SARL Chauffage Plus" oninput="entrepriseNameLive(this.value)"></div>
        <div class="full"><label class="subhead">Adresse</label><input type="text" id="instCoAdr" value="${escHtml(ip.adr||"")}" placeholder="12 rue des Artisans"></div>
        <div><label class="subhead">Code postal</label><input type="text" id="instCoCp" value="${escHtml(ip.cp||"")}" maxlength="5"></div>
        <div><label class="subhead">Ville</label><input type="text" id="instCoVille" value="${escHtml(ip.ville||"")}"></div>
        <div><label class="subhead">Téléphone</label><input type="text" id="instCoTel" value="${escHtml(ip.tel||"")}" placeholder="03 26 …"></div>
        <div><label class="subhead">E-mail</label><input type="email" id="instCoEmail" value="${escHtml(ip.email||"")}"></div>
        <div><label class="subhead">Site web</label><input type="text" id="instCoWeb" value="${escHtml(ip.web||"")}" placeholder="www.…"></div>
        <div><label class="subhead">SIRET</label><input type="text" id="instCoSiret" value="${escHtml(ip.siret||"")}"></div>
      </div>
      <div class="inst-logo-row">
        <div class="inst-logo-preview" id="instLogoPreview">${logoPreview}</div>
        <div>
          <label class="subhead">Logo</label>
          <div class="row-inline" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn-soft" onclick="$('instLogoFile')?.click()">Choisir une image</button>
            <button type="button" class="btn-ghost" onclick="clearInstallerLogo()">Retirer</button>
          </div>
          <input type="file" id="instLogoFile" accept="image/*" hidden onchange="onInstallerLogoFile(event)">
          <div class="full" style="margin-top:8px"><label class="subhead">ou URL</label><input type="text" id="instCoLogoUrl" class="mono" value="${escHtml(ip.logoUrl&&!String(ip.logoUrl).startsWith("data:")?ip.logoUrl:"")}" placeholder="img/logo.png ou https://…" oninput="previewInstallerLogoUrl()"></div>
          <p class="hint" style="margin:6px 0 0">PNG ou JPG · max. 400 Ko si import fichier.</p>
        </div>
      </div>
      <div class="inst-company-actions">
        <label class="inst-check"><input type="checkbox" id="instCoShowLogo" ${ip.showLogoOnNote!==false?"checked":""}> Afficher le logo sur la note</label>
        <label class="inst-check"><input type="checkbox" id="instCoShowCo" ${ip.showCompanyOnNote!==false?"checked":""}> Afficher les coordonnées sur la note</label>
      </div>
      <div class="inst-company-actions">
        <button type="button" class="btn-heat" onclick="saveInstallerProfileForm()">Enregistrer</button>
        <button type="button" class="btn-soft" onclick="applyInstallerToProject()">→ Reprendre la raison sociale dans le projet</button>
      </div>
    </div>
  </div>`;
}
function readInstallerProfileForm(){
  const ip=getEditedInstallerCompany();
  const g=(id)=>$(id);
  ip.company=g("instCoName")?.value?.trim()||"";
  ip.adr=g("instCoAdr")?.value?.trim()||"";
  ip.cp=g("instCoCp")?.value?.trim()||"";
  ip.ville=g("instCoVille")?.value?.trim()||"";
  ip.tel=g("instCoTel")?.value?.trim()||"";
  ip.email=g("instCoEmail")?.value?.trim()||"";
  ip.web=g("instCoWeb")?.value?.trim()||"";
  ip.siret=g("instCoSiret")?.value?.trim()||"";
  ip.showLogoOnNote=!!g("instCoShowLogo")?.checked;
  ip.showCompanyOnNote=!!g("instCoShowCo")?.checked;
  const urlIn=g("instCoLogoUrl")?.value?.trim();
  if(urlIn) ip.logoUrl=urlIn;
  return ip;
}
function entrepriseNameLive(val){
  const sel=$("instCompanySelect");
  if(!sel) return;
  const opt=sel.selectedOptions?.[0];
  if(opt){
    const idx=sel.selectedIndex;
    opt.textContent=((val&&val.trim())||`Entreprise ${idx+1}`)+(sel.value===state.activeInstallerCompanyId?" ★":"");
  }
}
function onEntrepriseSelectChange(id){
  readInstallerProfileForm();
  currentEntrepriseEditId=id;
  renderEntrepriseTab();
}
function entrepriseAddNew(){
  readInstallerProfileForm();
  const c=typeof addInstallerCompany==="function"?addInstallerCompany(false):null;
  if(c) currentEntrepriseEditId=c.id;
  renderEntrepriseTab();
  $("instCoName")?.focus();
}
function entrepriseDeleteCurrent(){
  const ip=getEditedInstallerCompany();
  if(!confirm(`Supprimer « ${ip.company||"cette entreprise"} » ?`)) return;
  if(typeof deleteInstallerCompany==="function"&&deleteInstallerCompany(ip.id)){
    currentEntrepriseEditId=state.activeInstallerCompanyId;
    if(typeof saveInstallerProfileLocal==="function") saveInstallerProfileLocal();
    if(typeof syncInstallerProfileToCloud==="function") syncInstallerProfileToCloud();
    renderEntrepriseTab();
    syncNoteInstallerToolbar();
    if(document.querySelector("#v-note.active")) renderNote();
    toast("Entreprise supprimée");
  } else {
    toast("Impossible de supprimer la dernière entreprise");
  }
}
function entrepriseSetDefault(){
  readInstallerProfileForm();
  const ip=getEditedInstallerCompany();
  if(typeof setActiveInstallerCompany==="function") setActiveInstallerCompany(ip.id);
  if(typeof saveInstallerProfileLocal==="function") saveInstallerProfileLocal();
  if(typeof syncInstallerProfileToCloud==="function") syncInstallerProfileToCloud();
  renderEntrepriseTab();
  toast("Entreprise par défaut définie");
}
function previewInstallerLogoUrl(){
  const url=$("instCoLogoUrl")?.value?.trim();
  const prev=$("instLogoPreview");
  if(!prev) return;
  if(url) prev.innerHTML=`<img src="${escAttr(url)}" alt="">`;
  else prev.innerHTML=`<span class="hint">Aucun logo</span>`;
}
function onInstallerLogoFile(ev){
  const file=ev.target?.files?.[0];
  if(!file) return;
  if(file.size>400*1024){
    alert("Image trop volumineuse (max. 400 Ko).");
    ev.target.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    const ip=getEditedInstallerCompany();
    ip.logoUrl=reader.result;
    const prev=$("instLogoPreview");
    if(prev) prev.innerHTML=`<img src="${escAttr(ip.logoUrl)}" alt="">`;
    const urlIn=$("instCoLogoUrl");
    if(urlIn) urlIn.value="";
    toast("Logo chargé — pensez à enregistrer");
  };
  reader.readAsDataURL(file);
  ev.target.value="";
}
function clearInstallerLogo(){
  const ip=getEditedInstallerCompany();
  ip.logoUrl="";
  const prev=$("instLogoPreview");
  if(prev) prev.innerHTML=`<span class="hint">Aucun logo</span>`;
  const urlIn=$("instCoLogoUrl");
  if(urlIn) urlIn.value="";
}
async function saveInstallerProfileForm(){
  readInstallerProfileForm();
  if(typeof saveInstallerProfileLocal==="function") saveInstallerProfileLocal();
  const cloudOk=typeof syncInstallerProfileToCloud==="function"?await syncInstallerProfileToCloud():false;
  renderEntrepriseTab();
  syncNoteInstallerToolbar();
  if(document.querySelector("#v-note.active")) renderNote();
  toast("Entreprise enregistrée"+(cloudOk?" · profil cloud":""));
}
function applyInstallerToProject(){
  readInstallerProfileForm();
  const ip=getEditedInstallerCompany();
  if(!ip.company){ toast("Renseignez la raison sociale"); return; }
  if(typeof projet!=="undefined"&&projet.client){
    projet.client.installateur=ip.company;
    const ni=ensureProjetNoteInstaller();
    if(ni) ni.companyId=ip.id;
    writeForm();
    markDirty();
  }
  toast(`Installateur : ${ip.company}`);
}
function initEntrepriseTab(){
  if(typeof ensureInstallerCompanies==="function") ensureInstallerCompanies();
  currentEntrepriseEditId=state.activeInstallerCompanyId;
  renderEntrepriseTab();
}

/* ---------- NAV ---------- */
function goTab(t){
  if(formDomHydrated&&typeof readForm==="function"&&typeof projet!=="undefined") readForm();
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $('v-'+t).classList.add('active');
  if(t==='result')runSelection(); if(t==='note')renderNote(); if(t==='db')renderGammes(); if(t==='compare')renderCompare();
  if(t==='composants') initComposantsTab();
  if(t==='outils'&&typeof initOutilsTab==='function') initOutilsTab();
  if(t==='installation'&&typeof initInstallationTab==='function') initInstallationTab();
  if(t==='entreprise') initEntrepriseTab();
  if(t==='procedures'&&typeof initProceduresTab==='function') initProceduresTab();
  if(t==='projet') setTimeout(()=>renderDjuChart(LAST), 50);
  window.scrollTo(0,0); }
document.querySelectorAll('nav.tabs button').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

