/* OEDIP — dossier & import/export — ne pas modifier l'ordre de chargement dans oedip.html */
/* ---------- DOSSIER DE TRAVAIL · IMPORT / EXPORT ---------- */
const WS_PREFIX={project:"oedip_projet",machines:"oedip_machines"};
const WS_IDB="oedip-workspace-v1";
const FS_SUPPORTED=typeof window.showDirectoryPicker==="function";
let workspaceDirHandle=null, workspaceDirName="", lastExportHash=null, workspaceBooting=true;
let autosaveTimer=null, lastSavedFile="", currentStudyFile="", currentStudyHandle=null, currentStudyName="";
let currentStudyCloudId="", _studiesCache=[], _studiesCloudCache=[], _newStudyModalMode="create";

function wsPad2(n){ return String(n).padStart(2,"0"); }
function wsTimestampFilename(kind,d){
  d=d||new Date();
  const jj=wsPad2(d.getDate()), mm=wsPad2(d.getMonth()+1), aa=wsPad2(d.getFullYear()%100);
  const hh=wsPad2(d.getHours()), mi=wsPad2(d.getMinutes());
  const base=kind==="db"?WS_PREFIX.machines:WS_PREFIX.project;
  return `${base}_${jj}-${mm}-${aa}_${hh}-${mi}.json`;
}
function wsFmtFileDate(ts){
  const d=new Date(ts);
  return `${wsPad2(d.getDate())}/${wsPad2(d.getMonth()+1)}/${wsPad2(d.getFullYear()%100)} à ${wsPad2(d.getHours())}:${wsPad2(d.getMinutes())}`;
}
function wsMatchesKind(name,kind){
  const prefix=kind==="db"?WS_PREFIX.machines:WS_PREFIX.project;
  return name.endsWith(".json")&&(name===`${prefix}.json`||name.startsWith(`${prefix}_`));
}
async function listWsFiles(dir,kind){
  const out=[];
  for await(const entry of dir.values()){
    if(entry.kind!=="file"||!wsMatchesKind(entry.name,kind)) continue;
    const file=await entry.getFile();
    out.push({name:entry.name,lastModified:file.lastModified,handle:entry});
  }
  out.sort((a,b)=>b.lastModified-a.lastModified);
  return out;
}
async function readLatestFromDir(dir,kind){
  const files=await listWsFiles(dir,kind);
  if(!files.length) throw new Error("Aucun fichier "+(kind==="db"?WS_PREFIX.machines:WS_PREFIX.project)+"*.json dans le dossier");
  const latest=files[0];
  const data=JSON.parse(await (await latest.handle.getFile()).text());
  return {data,name:latest.name,lastModified:latest.lastModified,files};
}

function wsSlugify(s){
  return (s||"")
    .normalize("NFD").replace(/\p{M}/gu,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,60)||"etude";
}
async function wsFileExists(dir,name){
  try{ await dir.getFileHandle(name); return true; }catch(e){ return false; }
}
async function wsNewStudyFilename(name,dir){
  if(!name) return wsTimestampFilename("project");
  const slug=wsSlugify(name);
  let fname=`${WS_PREFIX.project}_${slug}.json`, n=1;
  if(!dir) return fname;
  while(await wsFileExists(dir,fname)&&fname!==currentStudyFile){
    n++;
    fname=`${WS_PREFIX.project}_${slug}-${n}.json`;
  }
  return fname;
}

function buildProjectExport(){
  readForm(); readPrix();
  const obj={type:"oedip-project",version:2,date:new Date().toISOString(),meta:state.meta,reglages:state.reglages,prix:state.prix,pci:state.pci,co2:state.co2,
    data:{isolationTypes:state.isolationTypes,emetteurs:state.emetteurs,captages:state.captages,departements:state.departements,gammes:state.gammes,machines:state.machines,performances:cleanPerformancesForExport(state.performances),composants:state.composants,outils:state.outils||{},frigoLayoutPresets:state.frigoLayoutPresets||[],hydroLayoutPresets:state.hydroLayoutPresets||[],notePrintPresets:state.notePrintPresets||[],procedureCatalogs:state.procedureCatalogs||[]},
    projet};
  if(currentStudyName) obj.etudeNom=currentStudyName;
  return obj;
}
function buildDbExport(){
  return {type:"oedip-db",version:2,date:new Date().toISOString(),
    gammes:state.gammes,machines:state.machines,performances:cleanPerformancesForExport(state.performances),
    composants:state.composants,outils:state.outils||{},frigoLayoutPresets:state.frigoLayoutPresets||[],hydroLayoutPresets:state.hydroLayoutPresets||[],
    procedureCatalogs:state.procedureCatalogs||[],
    isolationTypes:state.isolationTypes,emetteurs:state.emetteurs,captages:state.captages,departements:state.departements};
}
function stateFingerprint(){ let h=5381; const s=JSON.stringify(buildProjectExport());
  for(let i=0;i<s.length;i++) h=((h<<5)+h)^s.charCodeAt(i); return (h>>>0).toString(36); }
function isDirty(){ return lastExportHash===null||stateFingerprint()!==lastExportHash; }
function markSaved(){ lastExportHash=stateFingerprint(); try{localStorage.setItem("oedip_last_export_hash",lastExportHash);}catch(e){} updateWsStatus(); }
function markDirty(){
  if(workspaceBooting) return;
  updateWsStatus();
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(()=>{ try{localStorage.setItem("oedip_autosave",JSON.stringify(buildProjectExport()));}catch(e){} },600);
}
function updateWsStatus(){
  const el=$("wsStatus"); if(!el) return;
  const dirty=isDirty();
  el.textContent=dirty?"● Non enregistré":"● Enregistré";
  el.className="ver mono noprint "+(dirty?"ws-warn":"ws-ok");
  const savedHint=currentStudyCloudId
    ?("\nCloud : "+(currentStudyName||"étude"))
    :(lastSavedFile?"\nDernier fichier : "+lastSavedFile:"");
  el.title=dirty
    ?("Modifications non enregistrées"+(sbCloudActive()?" — Enregistrer (⤒) pour synchroniser le cloud":""))
    :("Synchronisé"+savedHint);
}
function studyDisplayLabelFromClient(c){
  if(!c) return "";
  if(c.ref&&c.nom) return c.ref+" — "+c.nom;
  return c.ref||c.nom||"";
}
function studyDisplayLabelFromProjet(){
  return studyDisplayLabelFromClient(projet&&projet.client)||"";
}
function persistCurrentStudyFile(name){
  try{
    if(name) localStorage.setItem("oedip_current_study_file",name);
    else localStorage.removeItem("oedip_current_study_file");
  }catch(e){}
}
function persistCurrentStudyCloudId(id){
  try{
    if(id) localStorage.setItem("oedip_current_study_cloud_id",id);
    else localStorage.removeItem("oedip_current_study_cloud_id");
  }catch(e){}
}
function wsCloudSaveError(e){
  const msg=e.message||String(e);
  const hint=msg.includes("studies")||msg.includes("schema cache")
    ? "\n\n→ Tables cloud absentes : npm run supabase:push\n   ou Dashboard Supabase → SQL Editor → supabase/migrations/"
    : "";
  alert("Enregistrement cloud impossible.\n"+msg+hint);
}
function autosaveAvailable(){
  try{ return !!localStorage.getItem("oedip_autosave"); }catch(e){ return false; }
}
function autosaveDiffersFromCurrent(){
  try{
    const raw=localStorage.getItem("oedip_autosave");
    if(!raw) return false;
    let h=5381;
    for(let i=0;i<raw.length;i++) h=((h<<5)+h)^raw.charCodeAt(i);
    return (h>>>0).toString(36)!==stateFingerprint();
  }catch(e){ return false; }
}
function updateStudyUI(){
  const el=$("wsStudyLabel"); if(!el) return;
  const label=currentStudyName||studyDisplayLabelFromProjet()||(currentStudyFile?currentStudyFile.replace(/^oedip_projet_?/,"").replace(/\.json$/,"").replace(/-/g," "):"Nouvelle étude");
  el.textContent=label;
  if(currentStudyCloudId) el.title=`Étude : ${label}\nCloud Supabase`;
  else if(currentStudyFile) el.title=`Étude : ${label}\nFichier : ${currentStudyFile}`;
  else el.title=`Étude : ${label}\n(non enregistrée)`;
}

async function loadStudyFromDir(dir,filename){
  try{
    const fh=await dir.getFileHandle(filename);
    const data=JSON.parse(await (await fh.getFile()).text());
    applyImport(data,"project",{silent:true});
    currentStudyFile=filename;
    currentStudyHandle=fh;
    currentStudyCloudId=""; persistCurrentStudyCloudId("");
    lastSavedFile=filename;
    try{localStorage.setItem("oedip_last_saved_file",filename);}catch(e){}
    persistCurrentStudyFile(filename);
    updateFolderUI(); updateStudyUI();
    return true;
  }catch(e){ return false; }
}
async function openStudyEntry(entry){
  const data=JSON.parse(await (await entry.handle.getFile()).text());
  applyImport(data,"project",{silent:true});
  currentStudyFile=entry.name;
  currentStudyHandle=entry.handle;
  currentStudyCloudId="";
  persistCurrentStudyCloudId("");
  lastSavedFile=entry.name;
  try{localStorage.setItem("oedip_last_saved_file",entry.name);}catch(e){}
  persistCurrentStudyFile(entry.name);
  markSaved(); updateStudyUI(); updateFolderUI();
  toast("Ouvert · "+(studyDisplayLabelFromProjet()||entry.name));
}

async function openStudyFromCloud(row){
  const data=await sbFetchStudy(row.id);
  applyImport(data.payload,"project",{silent:true});
  currentStudyCloudId=row.id;
  persistCurrentStudyCloudId(row.id);
  currentStudyName=data.name||row.name||"";
  currentStudyFile=""; currentStudyHandle=null;
  persistCurrentStudyFile("");
  markSaved(); updateStudyUI(); updateFolderUI();
  toast("Ouvert · "+(currentStudyName||data.name));
}

async function loadStudyFromCloud(id){
  try{
    const data=await sbFetchStudy(id);
    applyImport(data.payload,"project",{silent:true});
    currentStudyCloudId=id;
    persistCurrentStudyCloudId(id);
    currentStudyName=data.name||"";
    currentStudyFile=""; currentStudyHandle=null;
    updateFolderUI(); updateStudyUI();
    return true;
  }catch(e){ return false; }
}

async function renderStudiesList(){
  const list=$("studiesList"); if(!list) return;
  list.innerHTML='<div class="hint">Chargement…</div>';
  let cloudHtml="", localHtml="";
  if(sbCloudActive()){
    try{
      _studiesCloudCache=await sbListStudies(80);
      if(_studiesCloudCache.length){
        cloudHtml=`<div class="studies-section-label">☁ Cloud Supabase</div>`+_studiesCloudCache.map((row,i)=>{
          const c=row.payload?.projet?.client||{};
          const label=row.name||studyDisplayLabelFromClient(c)||"Étude";
          const sub=[c.ville,c.ref&&c.nom?null:c.nom].filter(Boolean).join(" · ");
          const active=row.id===currentStudyCloudId?" studies-item-active":"";
          return `<button type="button" class="studies-item${active}" data-cloud-idx="${i}">
            <span class="studies-item-title">${escHtml(label)}</span>
            ${sub?`<span class="studies-item-sub">${escHtml(sub)}</span>`:""}
            <span class="studies-item-meta mono">${wsFmtFileDate(new Date(row.updated_at).getTime())}</span>
          </button>`;
        }).join("");
      } else {
        cloudHtml='<div class="hint">Aucune étude dans le cloud. Enregistrez (⤒) pour créer la première.</div>';
      }
    }catch(e){
      cloudHtml=`<div class="hint">Cloud indisponible : ${escHtml(e.message||String(e))}</div>`;
    }
  } else {
    cloudHtml=`<div class="hint">Connectez-vous (☁ Cloud) pour enregistrer et retrouver vos études en ligne.</div>`;
  }
  if(!workspaceDirHandle||!await ensureDirPermission(workspaceDirHandle,false)){
    list.innerHTML=cloudHtml+`<div class="studies-section-label" style="margin-top:14px">📁 Fichiers locaux</div>
      <div class="hint">Liez un dossier de travail (📁) pour lister vos études JSON, ou choisissez un fichier.</div>
      <button type="button" class="btn-soft" style="margin-top:10px" id="studiesPickFile">⤓ Choisir un fichier…</button>`;
    $("studiesPickFile").onclick=()=>{ fileImport("project"); closeStudiesModal(); };
    list.querySelectorAll("[data-cloud-idx]").forEach(btn=>{
      btn.onclick=async()=>{
        const row=_studiesCloudCache[+btn.dataset.cloudIdx];
        if(!row) return;
        if(isDirty()&&!confirm("Modifications non enregistrées. Ouvrir une autre étude ?")) return;
        await openStudyFromCloud(row);
        closeStudiesModal();
      };
    });
    return;
  }
  const files=await listWsFiles(workspaceDirHandle,"project");
  if(!files.length&&!cloudHtml.includes("studies-item")){
    list.innerHTML=cloudHtml+'<div class="hint" style="margin-top:12px">Aucune étude locale. Renseignez votre projet puis cliquez <b>Enregistrer</b>.</div>';
    bindStudiesCloudClicks();
    return;
  }
  _studiesCache=files.slice(0,80);
  const items=await Promise.all(_studiesCache.map(async f=>{
    let label="", sub="";
    try{
      const obj=JSON.parse(await (await f.handle.getFile()).text());
      const c=obj.projet&&obj.projet.client||{};
      label=obj.etudeNom||studyDisplayLabelFromClient(c)||f.name.replace(/^oedip_projet_/,"").replace(/\.json$/,"").replace(/-/g," ");
      sub=[c.ville,c.ref&&c.nom?null:c.nom].filter(Boolean).join(" · ");
    }catch(e){ label=f.name; }
    return {f,label,sub};
  }));
  localHtml=`<div class="studies-section-label" style="margin-top:14px">📁 Dossier local</div>`+items.map(({f,label,sub},i)=>{
    const active=f.name===currentStudyFile?" studies-item-active":"";
    return `<button type="button" class="studies-item${active}" data-idx="${i}">
      <span class="studies-item-title">${escHtml(label)}</span>
      ${sub?`<span class="studies-item-sub">${escHtml(sub)}</span>`:""}
      <span class="studies-item-meta mono">${escHtml(f.name)} · ${wsFmtFileDate(f.lastModified)}</span>
    </button>`;
  }).join("");
  list.innerHTML=cloudHtml+localHtml;
  bindStudiesCloudClicks();
  list.querySelectorAll(".studies-item[data-idx]").forEach(btn=>{
    btn.onclick=async()=>{
      const entry=_studiesCache[+btn.dataset.idx];
      if(!entry) return;
      if(isDirty()&&!confirm("Modifications non enregistrées. Ouvrir une autre étude ?")) return;
      await openStudyEntry(entry);
      closeStudiesModal();
    };
  });
}
function bindStudiesCloudClicks(){
  $("studiesList")?.querySelectorAll("[data-cloud-idx]").forEach(btn=>{
    btn.onclick=async()=>{
      const row=_studiesCloudCache[+btn.dataset.cloudIdx];
      if(!row) return;
      if(isDirty()&&!confirm("Modifications non enregistrées. Ouvrir une autre étude ?")) return;
      await openStudyFromCloud(row);
      closeStudiesModal();
    };
  });
}
function showStudiesModal(){
  $("modalStudies")?.classList.add("show");
  renderStudiesList();
}
function closeStudiesModal(){ $("modalStudies")?.classList.remove("show"); }

function showNewStudyModal(mode){
  _newStudyModalMode=mode||"create";
  const m=$("modalNewStudy"), inp=$("newStudyName"), title=$("newStudyModalTitle"), btn=$("newStudyConfirmBtn");
  if(!m||!inp) return;
  if(title) title.textContent=mode==="save"?"Nommer l'étude":"Nouvelle étude";
  if(btn) btn.textContent=mode==="save"?"Enregistrer":"Créer";
  inp.value=mode==="save"?(currentStudyName||studyDisplayLabelFromProjet()||""):"";
  m.classList.add("show");
  setTimeout(()=>{ inp.focus(); if(mode!=="create") inp.select(); }, 50);
}
function closeNewStudyModal(){ $("modalNewStudy")?.classList.remove("show"); }

function startNewStudyWithName(name){
  applyBundledDefaultProjectSync();
  currentStudyFile=""; currentStudyHandle=null;
  currentStudyCloudId=""; persistCurrentStudyCloudId("");
  currentStudyName=name;
  persistCurrentStudyFile("");
  fillSelects(); fillDbPerfSelects(); writeForm(); recalc(); renderGammes(); syncDeptFromCp(true);
  markSaved(); updateStudyUI();
  toast("Étude « "+name+" »");
}
async function confirmNewStudy(){
  const name=($("newStudyName")?.value||"").trim();
  if(!name){ alert("Indiquez un nom pour l'étude."); $("newStudyName")?.focus(); return; }
  closeNewStudyModal();
  if(_newStudyModalMode==="create") startNewStudyWithName(name);
  else{
    currentStudyName=name;
    updateStudyUI();
    await exportProject({skipNamePrompt:true});
  }
}

function newStudy(){
  if(isDirty()&&!confirm("Modifications non enregistrées. Démarrer une nouvelle étude sans enregistrer ?")) return;
  showNewStudyModal("create");
}
function restoreAutosave(){
  try{
    const raw=localStorage.getItem("oedip_autosave");
    if(!raw) return false;
    const obj=JSON.parse(raw);
    applyImport(obj,"project",{silent:true});
    currentStudyFile=""; currentStudyHandle=null;
    currentStudyName=obj.etudeNom||"";
    persistCurrentStudyFile("");
    markDirty(); updateStudyUI();
    toast("Session restaurée — enregistrez dans le dossier");
    closeStartupModal();
    return true;
  }catch(e){ return false; }
}

function updateFolderUI(){
  const s=$("wsFolderShort"); if(s) s.textContent=workspaceDirName?workspaceDirName.slice(0,14)+(workspaceDirName.length>14?"…":""):"Dossier";
  const b=$("btnFolder");
  if(b) b.title=workspaceDirName
    ?`Dossier : ${workspaceDirName}${lastSavedFile?"\nDernier enregistrement : "+lastSavedFile:""}`
    :"Choisir le dossier de travail (fichiers oedip_*.json horodatés)";
}

function idbOpen(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(WS_IDB,1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
async function idbGet(key){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction("kv","readonly"), g=tx.objectStore("kv").get(key);
    g.onsuccess=()=>res(g.result); g.onerror=()=>rej(g.error);
  });
}
async function idbSet(key,val){
  const db=await idbOpen();
  return new Promise((res,rej)=>{
    const tx=db.transaction("kv","readwrite"), g=tx.objectStore("kv").put(val,key);
    g.onsuccess=()=>res(); g.onerror=()=>rej(g.error);
  });
}
async function saveDirHandle(handle){ await idbSet("dirHandle",handle); workspaceDirHandle=handle; workspaceDirName=handle.name; updateFolderUI(); }
async function loadDirHandle(){
  try{ const h=await idbGet("dirHandle"); if(h&&typeof h.queryPermission==="function") return h; }catch(e){}
  return null;
}
async function ensureDirPermission(handle,write){
  if(!handle) return false;
  const mode=write?"readwrite":"read";
  let p=await handle.queryPermission({mode});
  if(p==="granted") return true;
  if(p==="prompt"){ p=await handle.requestPermission({mode}); return p==="granted"; }
  return false;
}
async function readFileFromDir(dir,name){
  const fh=await dir.getFileHandle(name);
  const file=await fh.getFile();
  return JSON.parse(await file.text());
}
async function writeFileToDir(dir,name,obj){
  const fh=await dir.getFileHandle(name,{create:true});
  const w=await fh.createWritable();
  await w.write(JSON.stringify(obj,null,2));
  await w.close();
}
function download(obj,name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}

async function exportProject(opts){
  opts=opts||{};
  if(!opts.skipNamePrompt&&!currentStudyFile&&!currentStudyCloudId&&!currentStudyName){
    showNewStudyModal("save");
    return;
  }
  const obj=buildProjectExport();
  const studyName=currentStudyName||studyDisplayLabelFromProjet()||"Étude";
  if(sbCloudActive()){
    try{
      const saved=await sbSaveStudy({ id:currentStudyCloudId||undefined, name:studyName, payload:obj });
      currentStudyCloudId=saved.id;
      persistCurrentStudyCloudId(saved.id);
      currentStudyName=studyName;
      updateStudyUI(); markSaved();
      toast("Enregistré dans le cloud · "+saved.name);
    }catch(e){
      wsCloudSaveError(e);
      return;
    }
  }
  const fname=currentStudyFile||await wsNewStudyFilename(currentStudyName,workspaceDirHandle);
  if(workspaceDirHandle&&await ensureDirPermission(workspaceDirHandle,true)){
    await writeFileToDir(workspaceDirHandle,fname,obj);
    currentStudyFile=fname;
    try{ currentStudyHandle=await workspaceDirHandle.getFileHandle(fname); }catch(e){ currentStudyHandle=null; }
    lastSavedFile=fname;
    try{localStorage.setItem("oedip_last_saved_file",fname);}catch(e){}
    persistCurrentStudyFile(fname);
    updateFolderUI(); updateStudyUI();
    if(!sbCloudActive()) markSaved();
    toast(sbCloudActive()?"Copie locale · "+fname:(currentStudyName?"Enregistré · "+currentStudyName:"Enregistré · "+fname));
    return;
  }
  if(sbCloudActive()) return;
  download(obj,fname);
  currentStudyFile=fname; currentStudyHandle=null;
  lastSavedFile=fname;
  persistCurrentStudyFile(fname);
  markSaved(); updateStudyUI();
  toast(FS_SUPPORTED?"Téléchargé · "+fname+" — liez un dossier 📁 pour retrouver vos études":"Projet téléchargé · "+fname);
}
async function exportDB(){
  const obj=buildDbExport();
  if(sbCloudActive()){
    try{
      await sbSaveMachineLibrary(obj);
      toast("Base machines enregistrée dans le cloud");
    }catch(e){
      wsCloudSaveError(e);
      return;
    }
  }
  const fname=wsTimestampFilename("db");
  if(workspaceDirHandle&&await ensureDirPermission(workspaceDirHandle,true)){
    await writeFileToDir(workspaceDirHandle,fname,obj);
    toast(sbCloudActive()?"Copie locale · "+fname:"Base enregistrée · "+fname);
    return;
  }
  if(sbCloudActive()) return;
  download(obj,fname);
  toast("Base machines téléchargée · "+fname);
}

async function importWorkspace(kind,opts){
  opts=opts||{};
  if(kind==="project"&&!opts.silent){
    showStudiesModal();
    return false;
  }
  if(kind==="db"&&sbCloudActive()&&!opts.silent){
    try{
      const row=await sbLoadDefaultMachineLibrary();
      if(row?.payload){
        applyImport(row.payload,"db");
        toast("Base machines importée depuis le cloud · "+wsFmtFileDate(new Date(row.updated_at).getTime()));
        return true;
      }
    }catch(e){}
  }
  if(workspaceDirHandle&&await ensureDirPermission(workspaceDirHandle,false)){
    try{
      const remembered=localStorage.getItem("oedip_current_study_file");
      if(remembered){
        const ok=await loadStudyFromDir(workspaceDirHandle,remembered);
        if(ok){
          if(kind!=="db") markSaved();
          if(!opts.silent||opts.notify) toast("Ouvert · "+remembered);
          return true;
        }
      }
      const latest=await readLatestFromDir(workspaceDirHandle,kind);
      if(!opts.silent&&latest.files.length>1){
        const label=kind==="db"?"base machines":"projet";
        if(!confirm(`Importer le ${label} le plus récent ?\n\n${latest.name}\n${wsFmtFileDate(latest.lastModified)}\n\n(${latest.files.length} versions dans le dossier)`)) return false;
      }
      applyImport(latest.data,kind==="db"?"db":"project");
      if(kind!=="db"){
        currentStudyFile=latest.name;
        currentStudyHandle=latest.files[0]?.handle||null;
        persistCurrentStudyFile(latest.name);
        lastSavedFile=latest.name;
        updateStudyUI();
        markSaved();
      }
      if(!opts.silent||opts.notify) toast("Importé · "+latest.name+" · "+wsFmtFileDate(latest.lastModified));
      return true;
    }catch(e){
      if(!opts.silent) alert("Import impossible depuis le dossier.\n"+e.message);
      return false;
    }
  }
  if(!opts.silent) fileImport(kind);
  return false;
}

function fileImport(kind){
  const inp=document.createElement("input"); inp.type="file"; inp.accept=".json,application/json";
  inp.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{
      applyImport(JSON.parse(rd.result),kind);
      if(kind==="project"){
        currentStudyFile=f.name; currentStudyHandle=null;
        currentStudyCloudId=""; persistCurrentStudyCloudId("");
        persistCurrentStudyFile(f.name);
        lastSavedFile=f.name;
        updateStudyUI();
        markSaved();
      }
    }catch(err){ alert("JSON invalide : "+err.message);} };
    rd.readAsText(f);
  };
  inp.click();
}

function applyGammePackImport(obj){
  const gam=obj.gamme;
  if(!gam||gam.code==null){ alert("Pack gamme invalide (gamme.code manquant)."); return; }
  const code=+gam.code;
  const gi=state.gammes.findIndex(g=>+g.code===code);
  const entry={...gam, code, sources:gam.sources||PERF_SRC.slice(), departs:gam.departs||PERF_DEP.slice()};
  if(gi>=0) state.gammes[gi]=entry; else state.gammes.push(entry);
  (obj.machines||[]).forEach(m=>{
    const {general,composantsLiens,...rest}=m;
    const row={...rest, gammeCode:code};
    if(general) row.general=general;
    if(composantsLiens) row.composantsLiens=composantsLiens;
    const i=state.machines.findIndex(x=>x.pac===row.pac);
    if(i>=0) state.machines[i]=row; else state.machines.push(row);
  });
  Object.keys(obj.performances||{}).forEach(pac=>{
    state.performances[pac]=obj.performances[pac];
  });
  (obj.machines||[]).forEach(m=>{
    if(m.general&&m.pac) applyMachineGeneralToPerf(m.pac,m.general);
  });
  if(obj.composants){
    const c=state.composants;
    Object.keys(obj.composants).forEach(type=>{
      if(!c[type]) c[type]=[];
      (obj.composants[type]||[]).forEach(item=>{
        const ref=item.ref||item.modele||item.id;
        const j=c[type].findIndex(x=>(x.ref||x.modele)===ref);
        if(j>=0) c[type][j]={...c[type][j],...item}; else c[type].push(item);
      });
    });
  }
  ensureDepartements(); ensureComposants(); if(typeof ensureOutils==="function") ensureOutils(); migratePerformances(); normalizeGammes(); normalizeEmetteurs();
  fillSelects(); fillDbPerfSelects(); writeForm(); renderGammes(); syncDeptFromCp(true); markDirty();
  toast("Gamme « "+(gam.nom||code)+" » importée ("+(obj.machines||[]).length+" machines)");
}
function importGammePack(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept=".json,application/json";
  inp.onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const obj=JSON.parse(rd.result);
      if(obj.type!=="oedip-gamme-pack"){ alert("Fichier attendu : type « oedip-gamme-pack » (ex. gpac-r410-pack.json)."); return; }
      applyGammePackImport(obj);
    }catch(err){ alert("JSON invalide : "+err.message);} };
    rd.readAsText(f);
  };
  inp.click();
}

function applyImport(obj,kind,opts){
  opts=opts||{};
  if(obj.type==="oedip-gamme-pack"){ applyGammePackImport(obj); return; }
  if(kind==="db"||obj.type==="oedip-db"||obj.type==="geoselect-db"){
    ["gammes","machines","performances","composants","outils","frigoLayoutPresets","hydroLayoutPresets","isolationTypes","emetteurs","captages"].forEach(k=>{if(obj[k])state[k]=obj[k];});
    if(obj.departements) state.departements=mergeDepartements(obj.departements);
    else ensureDepartements();
    ensureComposants(); if(typeof ensureOutils==="function") ensureOutils(); migratePerformances(); normalizeGammes(); normalizeEmetteurs(); fillSelects(); fillDbPerfSelects(); writeForm(); renderGammes(); syncDeptFromCp(true); markDirty(); toast("Base machines importée"); return;
  }
  if(obj.meta)state.meta=obj.meta; if(obj.reglages)state.reglages={...state.reglages,...obj.reglages}; if(obj.prix)state.prix=obj.prix;
  if(obj.pci)state.pci=obj.pci; if(obj.co2)state.co2=obj.co2;
  if(obj.data){
    ["isolationTypes","emetteurs","captages","gammes","machines","performances","composants","outils","frigoLayoutPresets","hydroLayoutPresets","notePrintPresets","procedureCatalogs"].forEach(k=>{if(obj.data[k])state[k]=obj.data[k];});
  }
  if(obj.data&&obj.data.departements) state.departements=mergeDepartements(obj.data.departements);
  if(obj.projet){
    projet=obj.projet;
    if(projet.batiment){ delete projet.batiment.tbaseMode; delete projet.batiment.tbase; }
    if(typeof ensureProjetHydraulique==="function") ensureProjetHydraulique(projet);
    if(typeof normalizeZonesChauffage==="function") normalizeZonesChauffage(projet);
  }
  if(obj.meta&&obj.meta.outil) state.meta.outil=obj.meta.outil;
  if(!opts.keepStudyName) currentStudyName=obj.etudeNom||"";
  ensureDepartements(); ensureComposants(); if(typeof ensureOutils==="function") ensureOutils(); migratePerformances(); normalizeGammes(); normalizeEmetteurs(); fillSelects(); fillDbPerfSelects(); writeForm(); recalc(); renderGammes(); syncDeptFromCp(true);
  $("verLabel").textContent=`${state.meta.outil||"OEDIP"} ${state.meta.version} · ${state.meta.millesime||""}`;
  updateStudyUI();
  if(!opts.silent) toast("Projet importé");
}

async function loadBundledDefaultProject(){
  if(typeof OEDIP_DEFAULT_PROJECT!=="undefined"){
    applyImport(OEDIP_DEFAULT_PROJECT,"project",{silent:true});
    return true;
  }
  try{
    const r=await fetch("data/oedip-default-project.json",{cache:"no-cache"});
    if(!r.ok) return false;
    applyImport(await r.json(),"project",{silent:true});
    return true;
  }catch(e){ return false; }
}

function applyBundledDefaultProjectSync(){
  if(typeof OEDIP_DEFAULT_PROJECT==="undefined") return false;
  applyImport(OEDIP_DEFAULT_PROJECT,"project",{silent:true});
  return true;
}

async function pickWorkspaceFolder(){
  if(!FS_SUPPORTED){ alert("Votre navigateur ne permet pas de mémoriser un dossier.\nUtilisez Chrome ou Edge, ou importez/exportez les fichiers oedip_*.json manuellement."); fileImport("project"); return; }
  try{
    const handle=await window.showDirectoryPicker({mode:"readwrite"});
    await saveDirHandle(handle);
    const ok=await importWorkspace("project",{silent:true,notify:true});
    if(ok) markSaved();
    else toast("Dossier « "+handle.name+" » — enregistrez (⤒) pour créer votre première étude");
    closeStartupModal();
  }catch(e){ if(e.name!=="AbortError") alert(e.message); }
}

function showStartupModal(mode){
  const m=$("modalStartup"), msg=$("startupMsg");
  const cont=$("startupContinue"), mach=$("startupImportMach"), restore=$("startupRestoreAutosave");
  if(!m) return;
  if(mode==="imported"){ closeStartupModal(); return; }
  if(mode==="no_fs"){
    msg.textContent="Liez un dossier de travail pour enregistrer vos études et y revenir facilement, ou continuez avec le projet par défaut.";
  } else if(mode==="no_file"){
    msg.textContent="Dossier « "+workspaceDirName+" » lié, mais aucune étude enregistrée. Renseignez le projet puis cliquez Enregistrer.";
  } else if(mode==="restore"){
    msg.textContent="Une session non enregistrée a été détectée. Souhaitez-vous la restaurer ou continuer avec le projet chargé ?";
  } else {
    msg.textContent="Choisissez votre dossier de travail pour retrouver vos études à chaque ouverture.";
  }
  if(restore) restore.style.display=autosaveDiffersFromCurrent()?"block":"none";
  cont.style.display="block";
  mach.style.display=FS_SUPPORTED?"block":"none";
  m.classList.add("show");
}
function closeStartupModal(){ $("modalStartup")?.classList.remove("show"); }

async function bootstrapWorkspace(){
  workspaceBooting=true;
  try{ lastSavedFile=localStorage.getItem("oedip_last_saved_file")||""; }catch(e){}
  try{ currentStudyFile=localStorage.getItem("oedip_current_study_file")||""; }catch(e){}
  try{ currentStudyCloudId=localStorage.getItem("oedip_current_study_cloud_id")||""; }catch(e){}
  applyBundledDefaultProjectSync();
  currentStudyFile=""; currentStudyHandle=null;
  if(sbCloudActive()&&currentStudyCloudId){
    if(await loadStudyFromCloud(currentStudyCloudId)){
      markSaved(); workspaceBooting=false; return true;
    }
    persistCurrentStudyCloudId(""); currentStudyCloudId="";
  }
  const handle=await loadDirHandle();
  if(handle&&FS_SUPPORTED){
    workspaceDirHandle=handle; workspaceDirName=handle.name; updateFolderUI();
    if(await ensureDirPermission(handle,false)){
      const remembered=localStorage.getItem("oedip_current_study_file");
      if(remembered&&await loadStudyFromDir(handle,remembered)){
        markSaved(); workspaceBooting=false; return true;
      }
      const ok=await importWorkspace("project",{silent:true,notify:true});
      if(ok){ markSaved(); workspaceBooting=false; return true; }
    }
  }
  markSaved();
  workspaceBooting=false;
  return true;
}

window.addEventListener("beforeunload",e=>{
  if(isDirty()){ e.preventDefault(); e.returnValue="Modifications non enregistrées dans le dossier. Enregistrez (⤒) avant de fermer."; }
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==="s"){ e.preventDefault(); exportProject(); }
});

/* ---------- toast ---------- */
let toastT; function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }

/* ---------- INIT ---------- */
bindSeg('seg_littoral',v=>{projet.batiment.littoral=+v;syncDeptFromCp(true);recalc();});
bindSeg('seg_isomode',v=>{projet.batiment.isoMode=v;toggleGroups();recalc();});
bindSeg('seg_pdirect',v=>{projet.besoin.pDirectMode=+v;toggleGroups();recalc();});
bindSeg('seg_ecs',v=>{projet.ecs.present=+v;toggleGroups();recalc();});
bindSeg('seg_tension',v=>{projet.source.tension=+v;recalc();});
bindSeg('seg_rev',v=>{projet.source.reversible=+v;recalc();});
$('modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
$('modalGamme').addEventListener('click',e=>{ if(e.target.id==='modalGamme') closeGammeModal(); });

$("startupPickFolder").onclick=()=>pickWorkspaceFolder();
$("startupStudies").onclick=()=>{ closeStartupModal(); showStudiesModal(); };
$("startupRestoreAutosave").onclick=()=>restoreAutosave();
$("startupImportMach").onclick=async()=>{ await importWorkspace("db"); };
$("startupContinue").onclick=()=>{ closeStartupModal(); toast("Liez un dossier 📁 pour enregistrer vos études"); };
$("modalStartup").addEventListener("click",e=>{ if(e.target.id==="modalStartup") closeStartupModal(); });
$("modalStudies").addEventListener("click",e=>{ if(e.target.id==="modalStudies") closeStudiesModal(); });
$("modalNewStudy").addEventListener("click",e=>{ if(e.target.id==="modalNewStudy") closeNewStudyModal(); });
$("newStudyName")?.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); confirmNewStudy(); } });

document.body.addEventListener("input",markDirty,true);
document.body.addEventListener("change",markDirty,true);

if(typeof ensureProjetHydraulique==="function") ensureProjetHydraulique(projet);
async function onSbAuthChanged(){
  if(sbCloudActive()){
    try{
      const remembered=localStorage.getItem("oedip_current_study_cloud_id");
      if(remembered&&await loadStudyFromCloud(remembered)){
        markSaved(); updateStudyUI();
        toast("Étude cloud rechargée");
        return;
      }
    }catch(e){}
  }
  updateWsStatus();
}

async function bootApp(){
  if(typeof sbBootstrapAuth==="function") await sbBootstrapAuth();
  await bootstrapWorkspace();
  fillSelects(); fillDbPerfSelects(); writeForm(); recalc(); renderGammes(); syncDeptFromCp(true);
  $("verLabel").textContent=`${state.meta.outil} ${state.meta.version} · ${state.meta.millesime||""}`;
  updateWsStatus();
  updateStudyUI();
  if(autosaveDiffersFromCurrent()) showStartupModal("restore");
  else if(!workspaceDirHandle&&FS_SUPPORTED) showStartupModal("no_fs");
}
bootApp();

