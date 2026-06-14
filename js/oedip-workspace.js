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

function buildStudyExport() {
  readForm();
  readPrix();
  const obj = {
    type: "oedip-study",
    version: 3,
    date: new Date().toISOString(),
    reglages: state.reglages,
    prix: state.prix,
    pci: state.pci,
    co2: state.co2,
    projet,
  };
  if (currentStudyName) obj.etudeNom = currentStudyName;
  return obj;
}

/** @deprecated Alias — les enregistrements d'étude utilisent buildStudyExport. */
function buildProjectExport() {
  return buildStudyExport();
}

function buildDbExport() {
  return {
    type: "oedip-db",
    version: 2,
    date: new Date().toISOString(),
    gammes: state.gammes,
    machines: state.machines,
    performances: cleanPerformancesForExport(state.performances),
    composants: state.composants,
    outils: state.outils || {},
    frigoLayoutPresets: state.frigoLayoutPresets || [],
    hydroLayoutPresets: state.hydroLayoutPresets || [],
    procedureCatalogs: state.procedureCatalogs || [],
    isolationTypes: state.isolationTypes,
    emetteurs: state.emetteurs,
    captages: state.captages,
    departements: state.departements,
    meta: state.meta,
    reglages: state.reglages,
    prix: state.prix,
    pci: state.pci,
    co2: state.co2,
    notePrintPresets: state.notePrintPresets || [],
  };
}

async function loadNotePrintPresetsFromCloud() {
  if (typeof sbLoadProfilePreferences !== "function") return false;
  if (!(await sbCloudActiveAsync())) return false;
  try {
    const prefs = await sbLoadProfilePreferences();
    if (!Array.isArray(prefs?.notePrintPresets)) return false;
    state.notePrintPresets = prefs.notePrintPresets;
    if (typeof fillNotePrintPresetSelect === "function") fillNotePrintPresetSelect();
    return true;
  } catch (e) {
    console.warn("Chargement configs impression:", e.message);
    return false;
  }
}

async function syncNotePrintPresetsToCloud() {
  if (typeof sbSaveProfilePreferences !== "function") return false;
  if (!(await sbCloudActiveAsync())) return false;
  try {
    if (typeof ensureNotePrintPresets === "function") ensureNotePrintPresets();
    await sbSaveProfilePreferences({ notePrintPresets: state.notePrintPresets || [] });
    return true;
  } catch (e) {
    console.warn("Sync configs impression:", e.message);
    return false;
  }
}

const INSTALLER_PROFILE_LS = "oedip_installer_profile";

function defaultInstallerProfile() {
  return {
    company: "",
    adr: "",
    cp: "",
    ville: "",
    tel: "",
    email: "",
    web: "",
    siret: "",
    logoUrl: "",
    showLogoOnNote: true,
    showCompanyOnNote: true,
  };
}

function ensureInstallerProfile() {
  if (!state.installerProfile || typeof state.installerProfile !== "object") {
    state.installerProfile = defaultInstallerProfile();
  }
  return state.installerProfile;
}

function loadInstallerProfileFromLocal() {
  try {
    const raw = localStorage.getItem(INSTALLER_PROFILE_LS);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return false;
    state.installerProfile = { ...defaultInstallerProfile(), ...parsed };
    return true;
  } catch (e) {
    return false;
  }
}

function saveInstallerProfileLocal() {
  ensureInstallerProfile();
  try {
    localStorage.setItem(INSTALLER_PROFILE_LS, JSON.stringify(state.installerProfile));
    return true;
  } catch (e) {
    console.warn("Profil installateur local:", e.message);
    return false;
  }
}

async function loadInstallerProfileFromCloud() {
  if (typeof sbLoadProfilePreferences !== "function") return false;
  if (!(await sbCloudActiveAsync())) return false;
  try {
    const prefs = await sbLoadProfilePreferences();
    if (!prefs?.installerProfile || typeof prefs.installerProfile !== "object") return false;
    state.installerProfile = { ...defaultInstallerProfile(), ...prefs.installerProfile };
    saveInstallerProfileLocal();
    return true;
  } catch (e) {
    console.warn("Chargement profil installateur:", e.message);
    return false;
  }
}

async function syncInstallerProfileToCloud() {
  if (typeof sbSaveProfilePreferences !== "function") return false;
  if (!(await sbCloudActiveAsync())) return false;
  try {
    ensureInstallerProfile();
    await sbSaveProfilePreferences({ installerProfile: state.installerProfile });
    return true;
  } catch (e) {
    console.warn("Sync profil installateur:", e.message);
    return false;
  }
}

function getInstallerProfile() {
  return ensureInstallerProfile();
}

function isLegacyFullProjectExport(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (obj.type === "oedip-study") return false;
  if (obj.type === "oedip-db" || obj.type === "geoselect-db") return false;
  return !!(
    obj.data?.gammes?.length ||
    obj.data?.machines?.length ||
    obj.gammes?.length ||
    obj.machines?.length
  );
}

function studyPayloadFromImport(obj) {
  if (!obj) return null;
  return {
    type: "oedip-study",
    version: 3,
    date: obj.date,
    etudeNom: obj.etudeNom,
    reglages: obj.reglages,
    prix: obj.prix,
    pci: obj.pci,
    co2: obj.co2,
    projet: obj.projet,
  };
}

const CATALOG_STATE_KEYS = [
  "isolationTypes",
  "emetteurs",
  "captages",
  "gammes",
  "machines",
  "performances",
  "composants",
  "outils",
  "frigoLayoutPresets",
  "hydroLayoutPresets",
  "notePrintPresets",
  "procedureCatalogs",
];

function applyProjetPayload(p) {
  if (!p) return;
  projet = p;
  if (projet.batiment) {
    delete projet.batiment.tbaseMode;
    delete projet.batiment.tbase;
  }
  if (typeof ensureProjetHydraulique === "function") ensureProjetHydraulique(projet);
  if (typeof ensureProjetInstallation === "function") ensureProjetInstallation(projet);
  if (typeof normalizeZonesChauffage === "function") normalizeZonesChauffage(projet);
}

function finishCatalogLoad(opts) {
  opts = opts || {};
  ensureDepartements();
  ensureComposants();
  if (typeof ensureBundledComposants === "function") ensureBundledComposants();
  if (typeof ensureProcedureCatalogPhotos === "function") ensureProcedureCatalogPhotos();
  if (typeof ensureOutils === "function") ensureOutils();
  migratePerformances();
  normalizeGammes();
  normalizeEmetteurs();
  fillSelects();
  fillDbPerfSelects();
  if (!opts.skipForm) writeForm();
  renderGammes();
  syncDeptFromCp(true);
  if (state.meta) {
    $("verLabel").textContent = `${state.meta.outil || "OEDIP"} ${state.meta.version} · ${state.meta.millesime || ""}`;
  }
  if ($("v-composants")?.classList.contains("active") && typeof renderComposants === "function") {
    renderComposants();
  }
  if (!opts.silent) toast(opts.toast || "Catalogue chargé");
}

function finishStudyLoad(opts) {
  opts = opts || {};
  fillSelects();
  fillDbPerfSelects();
  writeForm();
  recalc();
  renderGammes();
  syncDeptFromCp(true);
  updateStudyUI();
  if (!opts.silent) toast(opts.toast || "Étude chargée");
}

function applyCatalogImport(obj, opts) {
  opts = opts || {};
  if (!obj) return;
  const flat = obj.type === "oedip-db" || obj.type === "geoselect-db";
  const data = flat ? obj : obj.data || {};

  if (obj.meta) state.meta = obj.meta;
  if (obj.reglages) state.reglages = { ...state.reglages, ...obj.reglages };
  if (obj.prix) state.prix = obj.prix;
  if (obj.pci) state.pci = obj.pci;
  if (obj.co2) state.co2 = obj.co2;

  CATALOG_STATE_KEYS.forEach((k) => {
    const v = flat ? obj[k] : data[k];
    if (v !== undefined) state[k] = v;
  });

  const dept = flat ? obj.departements : data.departements;
  if (dept) state.departements = mergeDepartements(dept);
  else ensureDepartements();

  if (opts.includeDemoProjet && obj.projet) applyProjetPayload(obj.projet);

  finishCatalogLoad({ ...opts, toast: opts.toast || (flat ? "Base machines importée" : "Catalogue chargé") });
  if (opts.markDirty !== false && flat) markDirty();
}

function applyStudyImport(obj, opts) {
  opts = opts || {};
  const study = obj?.type === "oedip-study" ? obj : studyPayloadFromImport(obj);
  if (!study?.projet) return false;

  if (study.reglages) state.reglages = { ...state.reglages, ...study.reglages };
  if (study.prix) state.prix = study.prix;
  if (study.pci) state.pci = study.pci;
  if (study.co2) state.co2 = study.co2;
  applyProjetPayload(study.projet);
  if (!opts.keepStudyName) currentStudyName = study.etudeNom || "";

  finishStudyLoad(opts);
  return true;
}

function stateFingerprint() {
  let h = 5381;
  const s = JSON.stringify(buildStudyExport());
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}
function isDirty(){ return lastExportHash===null||stateFingerprint()!==lastExportHash; }
function markSaved(){ lastExportHash=stateFingerprint(); try{localStorage.setItem("oedip_last_export_hash",lastExportHash);}catch(e){} updateWsStatus(); }
function markDirty(){
  if(workspaceBooting) return;
  updateWsStatus();
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(()=>{ try{localStorage.setItem("oedip_autosave",JSON.stringify(buildStudyExport()));}catch(e){} },600);
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
    applyImport(data,"project",{silent:true,studyOnly:true});
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
  applyImport(data,"project",{silent:true,studyOnly:true});
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
  applyImport(data.payload,"project",{silent:true,studyOnly:true});
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
    applyImport(data.payload,"project",{silent:true,studyOnly:true});
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
  if(await sbCloudActiveAsync()){
    try{
      _studiesCloudCache=await sbListStudies(80);
      if(_studiesCloudCache.length){
        cloudHtml=`<div class="studies-section-label">☁ Cloud Supabase (${_studiesCloudCache.length})</div>`+_studiesCloudCache.map((row,i)=>{
          const label=row.name||"Étude";
          const active=row.id===currentStudyCloudId?" studies-item-active":"";
          return `<button type="button" class="studies-item${active}" data-cloud-idx="${i}">
            <span class="studies-item-title">${escHtml(label)}</span>
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
      <div class="hint">Liez un dossier de travail (📁) pour lister vos études, ou utilisez <b>Fichier JSON</b> ci-dessus.</div>`;
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
  void renderStudiesList();
}
async function refreshStudiesModal(){
  if($("modalStudies")?.classList.contains("show")) await renderStudiesList();
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
async function hasDirPermission(handle,write){
  if(!handle) return false;
  try{
    return (await handle.queryPermission({mode:write?"readwrite":"read"}))==="granted";
  }catch(e){ return false; }
}
function catalogComposantCount(){
  if(typeof composantCount==="function"&&state.composants) return composantCount(state.composants);
  if(!state.composants||typeof state.composants!=="object") return 0;
  return Object.keys(state.composants).reduce((n,k)=>n+(state.composants[k]?.length||0),0);
}
async function ensureDefaultCatalogLoaded(){
  let ok=false;
  if(typeof loadReferenceCatalogFromCloud==="function"){
    try{ ok=await loadReferenceCatalogFromCloud(); }catch(e){ console.warn("Catalogue cloud:", e.message); }
  }
  const bundledN=typeof bundledComposantCount==="function"?bundledComposantCount():0;
  if(!ok||catalogComposantCount()===0||(bundledN>0&&catalogComposantCount()<bundledN)){
    if(!applyBundledDefaultCatalogSync()) ok=await loadBundledDefaultCatalog();
    else ok=true;
  }
  if(typeof ensureComposants==="function") ensureComposants();
  if(typeof ensureBundledComposants==="function") ensureBundledComposants();
  if(typeof ensureProcedureCatalogPhotos==="function") ensureProcedureCatalogPhotos();
  return ok||catalogComposantCount()>0;
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
  const obj=buildStudyExport();
  const studyName=currentStudyName||studyDisplayLabelFromProjet()||"Étude";
  let cloudSaved=false;
  const session=typeof sbEnsureSession==="function"?await sbEnsureSession():null;
  if(session){
    try{
      const saved=await sbSaveStudy({ id:currentStudyCloudId||undefined, name:studyName, payload:obj });
      if(!saved?.id) throw new Error("Réponse cloud invalide");
      currentStudyCloudId=saved.id;
      persistCurrentStudyCloudId(saved.id);
      currentStudyName=studyName;
      updateStudyUI(); markSaved();
      cloudSaved=true;
      try{ await sbSaveMachineLibrary(buildDbExport()); }catch(e2){ console.warn("Sync catalogue machines:", e2.message); }
      toast("Enregistré dans le cloud · "+saved.name);
      await refreshStudiesModal();
    }catch(e){
      wsCloudSaveError(e);
      return;
    }
  }else if($("btnSbAuth")?.classList.contains("sb-on")){
    toast("Session cloud expirée — reconnectez-vous via ☁ Cloud");
    showSbAuthModal();
    return;
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
    if(!cloudSaved) markSaved();
    toast(cloudSaved?"Copie locale · "+fname:(session?"Enregistré · "+studyName:"Enregistré localement · "+studyName+" (☁ Cloud déconnecté)"));
    return;
  }
  if(cloudSaved) return;
  download(obj,fname);
  currentStudyFile=fname; currentStudyHandle=null;
  lastSavedFile=fname;
  persistCurrentStudyFile(fname);
  markSaved(); updateStudyUI();
  toast(session?"Téléchargé · "+fname:"Téléchargé · "+fname+" — connectez ☁ Cloud pour sync en ligne");
}
async function exportDB(){
  const obj=buildDbExport();
  const session=typeof sbEnsureSession==="function"?await sbEnsureSession():null;
  if(session){
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
      applyImport(latest.data,kind==="db"?"db":"project",{studyOnly:kind!=="db"});
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
  if(!obj) return;
  if(obj.type==="oedip-gamme-pack"){ applyGammePackImport(obj); return; }

  if(kind==="db"||obj.type==="oedip-db"||obj.type==="geoselect-db"||obj.type==="oedip-catalog"){
    applyCatalogImport(obj,{...opts,markDirty:kind==="db"&&!opts.silent});
    return;
  }

  if(obj.type==="oedip-study"||opts.studyOnly){
    const legacy=obj.type!=="oedip-study"&&isLegacyFullProjectExport(obj);
    applyStudyImport(obj,{...opts,toast:legacy&&!opts.silent?"Étude chargée (ancien format)":undefined});
    return;
  }

  if(isLegacyFullProjectExport(obj)){
    applyCatalogImport(obj,{...opts,silent:true,skipForm:true,includeDemoProjet:false});
    applyStudyImport(studyPayloadFromImport(obj),{...opts,silent:true,keepStudyName:opts.keepStudyName});
    if(!opts.silent) toast("Projet importé (catalogue + étude)");
    return;
  }

  applyStudyImport(obj,opts);
}

function catalogObjectFromBundled(){
  if(typeof OEDIP_DEFAULT_CATALOG!=="undefined") return OEDIP_DEFAULT_CATALOG;
  if(typeof OEDIP_DEFAULT_PROJECT!=="undefined") return OEDIP_DEFAULT_PROJECT;
  return null;
}

async function loadBundledDefaultCatalog(){
  const bundled=catalogObjectFromBundled();
  if(bundled){
    applyCatalogImport(bundled,{silent:true});
    return true;
  }
  try{
    const r=await fetch("data/oedip-catalog.json",{cache:"no-cache"});
    if(r.ok){
      applyCatalogImport(await r.json(),{silent:true});
      return true;
    }
  }catch(e){}
  try{
    const r=await fetch("data/oedip-default-project.json",{cache:"no-cache"});
    if(!r.ok) return false;
    applyCatalogImport(await r.json(),{silent:true});
    return true;
  }catch(e){ return false; }
}

function applyBundledDefaultCatalogSync(){
  const bundled=catalogObjectFromBundled();
  if(!bundled) return false;
  applyCatalogImport(bundled,{silent:true});
  return true;
}

function applyBundledDemoStudySync(){
  if(typeof OEDIP_DEMO_STUDY!=="undefined"){
    applyStudyImport(OEDIP_DEMO_STUDY,{silent:true});
    return true;
  }
  const bundled=catalogObjectFromBundled();
  if(bundled?.projet){
    applyStudyImport(studyPayloadFromImport(bundled),{silent:true});
    return true;
  }
  return false;
}

async function loadBundledDefaultProject(){
  const ok=await loadBundledDefaultCatalog();
  if(ok) applyBundledDemoStudySync();
  return ok;
}

function applyBundledDefaultProjectSync(){
  if(!applyBundledDefaultCatalogSync()) return false;
  applyBundledDemoStudySync();
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
  }catch(e){ if(e.name!=="AbortError") alert(e.message); }
}

async function bootstrapWorkspace(){
  workspaceBooting=true;
  try{ lastSavedFile=localStorage.getItem("oedip_last_saved_file")||""; }catch(e){}
  try{ currentStudyCloudId=localStorage.getItem("oedip_current_study_cloud_id")||""; }catch(e){}
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
    if(await hasDirPermission(handle,false)){
      const remembered=localStorage.getItem("oedip_current_study_file");
      if(remembered&&await loadStudyFromDir(handle,remembered)){
        markSaved(); workspaceBooting=false; return true;
      }
      const ok=await importWorkspace("project",{silent:true,notify:false});
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

$("modalStudies").addEventListener("click",e=>{ if(e.target.id==="modalStudies") closeStudiesModal(); });
$("modalNewStudy").addEventListener("click",e=>{ if(e.target.id==="modalNewStudy") closeNewStudyModal(); });
$("newStudyName")?.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); confirmNewStudy(); } });

document.body.addEventListener("input",markDirty,true);
document.body.addEventListener("change",markDirty,true);

if(typeof ensureProjetHydraulique==="function") ensureProjetHydraulique(projet);
if(typeof ensureProjetInstallation==="function") ensureProjetInstallation(projet);
async function onSbAuthChanged(){
  if(sbCloudActive()){
    if(typeof sbLoadProfile==="function"){
      try{ await sbLoadProfile(); }catch(e){ console.warn("Profil:", e.message); }
    }
    if(typeof updateProcedureAdminUI==="function") updateProcedureAdminUI();
    await loadNotePrintPresetsFromCloud();
    await loadInstallerProfileFromCloud();
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
  if(sbCloudActive()&&typeof sbLoadProfile==="function"){
    try{ await sbLoadProfile(); }catch(e){}
  }
  await ensureDefaultCatalogLoaded();
  loadInstallerProfileFromLocal();
  if(sbCloudActive()) await loadNotePrintPresetsFromCloud();
  if(sbCloudActive()) await loadInstallerProfileFromCloud();
  await bootstrapWorkspace();
  if(!currentStudyCloudId&&!currentStudyFile) applyBundledDemoStudySync();
  fillSelects(); fillDbPerfSelects(); writeForm(); recalc(); renderGammes(); syncDeptFromCp(true);
  if(typeof ensureBundledComposants==="function") ensureBundledComposants();
  $("verLabel").textContent=`${state.meta.outil} ${state.meta.version} · ${state.meta.millesime||""}`;
  updateWsStatus();
  updateStudyUI();
  if (typeof initComposantsTab === "function") initComposantsTab();
}
bootApp();

