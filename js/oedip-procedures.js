/* OEDIP — procédures atelier par gamme (frigo)
   Variables machine : {{pac}}, {{pipe.aspBotComp.longM}}, {{comp.compresseur.ref}}
   Cotes par variante tube : {{L}}, {{diam}}… — proc.variants[].stepDims · machine.frigoTubeVariants[tubeRef] */

const PROCEDURE_DIM_CHIPS = [
  { key: "L", label: "L" },
  { key: "diam", label: "diam" },
  { key: "ep", label: "ep" },
  { key: "angle", label: "angle" },
];

const PROCEDURE_SUB_PART_PRESETS = ["Cintrage", "Brasage", "Assemblage", "Contrôle", "Recoupe"];

function allProcedureEntries() {
  const out = [];
  (state.procedureCatalogs || []).forEach((cat) => {
    (cat.procedures || []).forEach((proc) => {
      out.push({ proc, catalogGammeCode: +cat.gammeCode, catalog: cat });
    });
  });
  return out;
}

/** Codes gamme couverts par un catalogue procédures (partagé ou dédié). */
function procedureCatalogGammeCodes(cat) {
  if (!cat) return [];
  const codes = new Set();
  if (cat.gammeCode != null && cat.gammeCode !== "") codes.add(+cat.gammeCode);
  (cat.gammeCodes || []).forEach((c) => {
    if (c != null && c !== "") codes.add(+c);
  });
  return [...codes].sort((a, b) => a - b);
}

function normalizeProcedureCatalog(cat) {
  if (!cat) return;
  const codes = procedureCatalogGammeCodes(cat);
  cat.gammeCodes = codes;
  if (cat.gammeCode == null && codes.length) cat.gammeCode = codes[0];
}

function procedureCatalogSignature(cat) {
  return (cat.procedures || [])
    .map((p) => p.tubeRef || p.id)
    .sort()
    .join("\0");
}

/** Fusionne les catalogues identiques (ex. Géo R410 + R454C) en un catalogue partagé. */
function migrateProcedureCatalogSharing() {
  ensureProcedureCatalogs();
  state.procedureCatalogs.forEach(normalizeProcedureCatalog);
  const kept = [];
  const mergeGroups = new Map();
  state.procedureCatalogs.forEach((cat) => {
    const sig = procedureCatalogSignature(cat);
    if (!sig) {
      kept.push(cat);
      return;
    }
    if (!mergeGroups.has(sig)) mergeGroups.set(sig, []);
    mergeGroups.get(sig).push(cat);
  });
  mergeGroups.forEach((cats) => {
    if (cats.length === 1) {
      kept.push(cats[0]);
      return;
    }
    const master = cats.reduce((best, cur) =>
      ((cur.procedures?.length || 0) > (best.procedures?.length || 0) ? cur : best)
    );
    const allCodes = new Set();
    cats.forEach((cat) => procedureCatalogGammeCodes(cat).forEach((c) => allCodes.add(c)));
    master.gammeCodes = [...allCodes].sort((a, b) => a - b);
    master.gammeCode = master.gammeCodes[0];
    normalizeProcedureCatalog(master);
    kept.push(master);
  });
  state.procedureCatalogs = kept;
}

function procedureGalleryKey(proc) {
  return proc.tubeRef || proc.id;
}

/** Une fiche galerie par tube — évite les doublons entre catalogues/gammes. */
function galleryProcedureEntries() {
  const byKey = new Map();
  allProcedureEntries().forEach((entry) => {
    const key = procedureGalleryKey(entry.proc);
    const codes = procedureCatalogGammeCodes(entry.catalog);
    if (!byKey.has(key)) {
      byKey.set(key, {
        proc: entry.proc,
        catalogGammeCode: entry.catalogGammeCode,
        catalogGammeCodes: [...codes],
        catalog: entry.catalog,
      });
      return;
    }
    const ex = byKey.get(key);
    codes.forEach((c) => {
      if (!ex.catalogGammeCodes.includes(c)) ex.catalogGammeCodes.push(c);
    });
    ex.catalogGammeCodes.sort((a, b) => a - b);
  });
  return [...byKey.values()];
}

function findProcedureEntry(procId) {
  if (!procId) return null;
  for (const cat of state.procedureCatalogs || []) {
    const proc = cat.procedures?.find((p) => p.id === procId);
    if (proc) return { proc, catalogGammeCode: +cat.gammeCode, catalog: cat };
  }
  return null;
}

function procedureChildCount(procId) {
  let n = 0;
  (state.procedureCatalogs || []).forEach((cat) => {
    (cat.procedures || []).forEach((p) => { if (p.parentProcId === procId) n++; });
  });
  return n;
}

function detachProcedureChildren(procId) {
  (state.procedureCatalogs || []).forEach((cat) => {
    (cat.procedures || []).forEach((p) => {
      if (p.parentProcId === procId) delete p.parentProcId;
    });
  });
}

function cleanupProcedureMachineLinks(proc) {
  if (!proc) return;
  const procId = proc.id;
  const tubeRef = proc.tubeRef;
  (state.machines || []).forEach((m) => {
    if (m.frigoProcDims?.[procId]) {
      delete m.frigoProcDims[procId];
      if (!Object.keys(m.frigoProcDims).length) delete m.frigoProcDims;
    }
    if (tubeRef && m.frigoTubeVariants?.[tubeRef] !== undefined) {
      delete m.frigoTubeVariants[tubeRef];
      if (!Object.keys(m.frigoTubeVariants).length) delete m.frigoTubeVariants;
    }
  });
}

function removeProcedureFromCatalogs(procId) {
  let removed = false;
  (state.procedureCatalogs || []).forEach((cat) => {
    const idx = cat.procedures?.findIndex((p) => p.id === procId) ?? -1;
    if (idx >= 0) {
      cat.procedures.splice(idx, 1);
      removed = true;
    }
  });
  return removed;
}

function deleteProcedure(gammeCode, procId, opts) {
  opts = opts || {};
  if (!procedureEditAllowed()) {
    toast("Suppression réservée aux techniciens et administrateurs OEDIP");
    return false;
  }
  const entry = findProcedureEntry(procId);
  if (!entry) return false;
  const proc = entry.proc;
  const label = procedureShortName(proc) || procedureRefPattern(proc) || proc.title || procId;
  const childN = procedureChildCount(procId);
  let msg = `Supprimer la procédure « ${label} » ? Cette action est irréversible.`;
  if (childN) msg += `\n\n${childN} sous-procédure(s) liée(s) seront détachées.`;
  if (!opts.skipConfirm && !confirm(msg)) return false;
  if (procedureEditDraft?.procId === procId) closeProcedureEditor();
  detachProcedureChildren(procId);
  cleanupProcedureMachineLinks(proc);
  if (!removeProcedureFromCatalogs(procId)) return false;
  renderProceduresTab();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  toast(`Procédure « ${label} » supprimée`);
  return true;
}

function deleteProcedureFromEditor() {
  if (!procedureEditDraft) return;
  deleteProcedure(procedureEditDraft.gammeCode, procedureEditDraft.procId);
}

function frigoPipeDef(pipeId) {
  const list = typeof FRIGO_PIPES !== "undefined" ? FRIGO_PIPES : [];
  return list.find((p) => p.id === pipeId) || null;
}

function procedureFrigoPipeLabel(proc) {
  const pipeId = proc?.target?.type === "pipe" ? proc.target.pipeId : "";
  if (!pipeId) return "";
  const p = frigoPipeDef(pipeId);
  return p ? p.label : pipeId;
}

function procedureParentProc(proc, catalogGammeCode) {
  if (!proc?.parentProcId) return null;
  return getProcedureCatalog(catalogGammeCode)?.procedures?.find((p) => p.id === proc.parentProcId) || null;
}

function procedureLinkSummary(proc, catalogGammeCode) {
  const parts = [];
  const pipe = procedureFrigoPipeLabel(proc);
  if (pipe) parts.push(pipe);
  if (proc.tubePartNum >= 1) parts.push(`Partie ${proc.tubePartNum}`);
  const parent = procedureParentProc(proc, catalogGammeCode);
  if (parent) parts.push(`↳ ${procedureShortName(parent)}${proc.subPartLabel ? ` · ${proc.subPartLabel}` : ""}`);
  else if (proc.subPartLabel) parts.push(proc.subPartLabel);
  return parts.join(" · ");
}

function procedureFrigoOptionLabel(proc) {
  const bits = [procedureShortName(proc)];
  if (proc.tubePartNum >= 1) bits.push(`P${proc.tubePartNum}`);
  const extra = procedureFrigoPipeLabel(proc) || proc.tubeRef || proc.id;
  if (extra) bits.push(extra);
  return bits.join(" · ");
}

function proceduresOnFrigoPipe(pipeId, excludeId) {
  if (!pipeId) return [];
  return allProcedureEntries().filter(({ proc }) =>
    proc.id !== excludeId && proc.target?.type === "pipe" && proc.target.pipeId === pipeId
  );
}

function nextTubePartNumForPipe(pipeId, excludeId) {
  if (!pipeId) return 1;
  const nums = proceduresOnFrigoPipe(pipeId, excludeId)
    .map(({ proc }) => proc.tubePartNum)
    .filter((n) => n >= 1);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function mainTubeProceduresInCatalog(catalogGammeCode, excludeId) {
  const cat = getProcedureCatalog(catalogGammeCode);
  return (cat?.procedures || []).filter((p) =>
    p.tubeRef && p.id !== excludeId && !p.parentProcId
  ).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function parentProcedureOptions(proc, catalogGammeCode) {
  const pipeId = proc?.target?.type === "pipe" ? proc.target.pipeId : "";
  return mainTubeProceduresInCatalog(catalogGammeCode, proc.id).filter((p) =>
    !pipeId || p.target?.pipeId === pipeId
  );
}

function tubeProceduresForMachine(m) {
  if (!m) return [];
  const pac = m.pac;
  const out = [];
  const seen = new Set();
  (state.procedureCatalogs || []).forEach((cat) => {
    const catGammes = procedureCatalogGammeCodes(cat);
    (cat.procedures || []).forEach((p) => {
      if (!p.tubeRef || seen.has(p.id)) return;
      const hasMachineList = (p.variants || []).some((v) => (v.machines || []).length);
      const onMachine = (p.variants || []).some((v) => (v.machines || []).includes(pac));
      const legacyGamme = catGammes.includes(+m.gammeCode) && !hasMachineList;
      if (onMachine || legacyGamme) {
        seen.add(p.id);
        out.push(p);
      }
    });
  });
  return out.sort((a, b) => (a.tubeNum ?? 999) - (b.tubeNum ?? 999));
}

function procedureMatchesTarget(pr, target) {
  const t = pr.target || {};
  if (target.type === "pipe") return t.type === "pipe" && t.pipeId === target.pipeId;
  if (target.type === "role") return t.type === "role" && t.role === target.role;
  return false;
}

function renderFrigoPipeSelectOptions(selectedId) {
  const pipes = typeof FRIGO_PIPES !== "undefined" ? FRIGO_PIPES : [];
  return `<option value="">— Choisir un tronçon —</option>${pipes.map((p) =>
    `<option value="${escVal(p.id)}"${selectedId === p.id ? " selected" : ""}>${escHtml(p.label)}</option>`
  ).join("")}`;
}

function renderProcedureFrigoLinkEditor(proc, catalogGammeCode) {
  const isFrigo = !!(proc.tubeRef || proc.target?.type === "pipe");
  if (!isFrigo) return "";
  const pipeId = proc.target?.type === "pipe" ? proc.target.pipeId : "";
  const pipeOpts = renderFrigoPipeSelectOptions(pipeId);
  const parents = parentProcedureOptions(proc, catalogGammeCode);
  const parentOpts = `<option value="">— Procédure principale (pas de parent) —</option>${parents.map((p) =>
    `<option value="${escVal(p.id)}"${proc.parentProcId === p.id ? " selected" : ""}>${escHtml(procedureFrigoOptionLabel(p))}</option>`
  ).join("")}`;
  const subList = PROCEDURE_SUB_PART_PRESETS.map((s) => `<option value="${escVal(s)}">`).join("");
  const partVal = proc.tubePartNum >= 1 ? proc.tubePartNum : "";
  return `<div class="proc-frigo-link-block">
    <h4 class="subhead" style="margin-top:14px">Lien circuit frigo</h4>
    <p class="hint">Reliez cette procédure à un tronçon du schéma frigo. Numérotez les parties (1, 2, 3…) sur un même tronçon. Vous pouvez en faire une sous-procédure (ex. cintrage) d'une procédure principale.</p>
    <div class="proc-frigo-link-grid">
      <label>Partie du circuit<select id="procEditFrigoPipe" onchange="procedureEditRefreshParentSelect()">${pipeOpts}</select></label>
      <label>Partie n° (tronçon)<input type="number" id="procEditTubePartNum" min="1" class="mono" style="max-width:5rem" value="${escVal(partVal)}" placeholder="1" title="Partie 1, 2, 3… sur le même tronçon"></label>
      <label>Sous-procédure de<select id="procEditParentProc" class="proc-parent-sel">${parentOpts}</select></label>
      <label>Nature (optionnel)<input type="text" id="procEditSubPart" list="procSubPartPresets" value="${escVal(proc.subPartLabel || "")}" placeholder="Ex. Cintrage, Brasage…"></label>
    </div>
    <datalist id="procSubPartPresets">${subList}</datalist>
  </div>`;
}

function procedurePreviewPac(proc, catalogGammeCode, opts) {
  opts = opts || {};
  const prefer = opts.preferPacs;
  if (prefer?.length && catalogGammeCode != null) {
    const hit = prefer.find((pac) => procedureAppliesToMachine(proc, catalogGammeCode, pac));
    if (hit) return hit;
  }
  for (const v of proc?.variants || []) {
    for (const pac of v.machines || []) {
      if (!prefer?.length || prefer.includes(pac)) return pac;
    }
  }
  if (prefer?.length) return prefer[0];
  return state.machines[0]?.pac || null;
}

function procedureHasExplicitMachines(proc) {
  return (proc.variants || []).some((v) => (v.machines || []).length);
}

function procedureLinkedMachinePacs(proc) {
  const pacs = new Set();
  (proc.variants || []).forEach((v) => (v.machines || []).forEach((pac) => pacs.add(pac)));
  return pacs;
}

function procedureAppliesToMachine(proc, catalogGammeCode, pac, catalogGammeCodes) {
  if (!pac) return false;
  const m = machineByPac(pac);
  if (!m) return false;
  const linked = procedureLinkedMachinePacs(proc);
  if (linked.size) return linked.has(pac);
  const codes = catalogGammeCodes?.length
    ? catalogGammeCodes
    : procedureCatalogGammeCodes(getProcedureCatalog(catalogGammeCode));
  return codes.includes(+m.gammeCode);
}

function procedureLinkedGammes(proc, catalogGammeCode, catalogGammeCodes) {
  const map = new Map();
  const linked = procedureLinkedMachinePacs(proc);
  if (linked.size) {
    linked.forEach((pac) => {
      const m = machineByPac(pac);
      if (!m) return;
      const code = +m.gammeCode;
      if (!map.has(code)) {
        const g = gammeByCode(code);
        map.set(code, g?.nom || `Gamme ${code}`);
      }
    });
  } else {
    const codes = catalogGammeCodes?.length
      ? catalogGammeCodes
      : procedureCatalogGammeCodes(getProcedureCatalog(catalogGammeCode));
    codes.forEach((code) => {
      const g = gammeByCode(code);
      map.set(code, g?.nom || `Gamme ${code}`);
    });
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([code, nom]) => ({ code, nom }));
}

function renderProcedureGalleryGammes(proc, catalogGammeCode, catalogGammeCodes) {
  const gammes = procedureLinkedGammes(proc, catalogGammeCode, catalogGammeCodes);
  if (!gammes.length) return "";
  return `<div class="proc-gallery-gammes noprint">${gammes.map((g) =>
    `<span class="proc-gallery-gamme" title="Gamme ${g.code}">${escHtml(g.nom)}</span>`
  ).join("")}</div>`;
}

function procedureMatchesProcFilter(proc, catalogGammeCode, filter, catalogGammeCodes) {
  if (!filter) return true;
  const machines = filter.machines || [];
  const gammeCode = filter.gammeCode != null && filter.gammeCode !== "" ? +filter.gammeCode : null;
  if (machines.length) {
    return machines.some((pac) => procedureAppliesToMachine(proc, catalogGammeCode, pac, catalogGammeCodes));
  }
  if (gammeCode != null) {
    const linked = procedureLinkedMachinePacs(proc);
    if (linked.size) {
      return [...linked].some((pac) => +machineByPac(pac)?.gammeCode === gammeCode);
    }
    const codes = catalogGammeCodes?.length
      ? catalogGammeCodes
      : procedureCatalogGammeCodes(getProcedureCatalog(catalogGammeCode));
    return codes.includes(gammeCode);
  }
  return true;
}

function getProcFilter() {
  const gammeCode = ($("procFilterGamme")?.value ?? "").trim();
  const machines = [...document.querySelectorAll(".proc-filter-machine-cb:checked")]
    .map((cb) => cb.value)
    .filter(Boolean);
  return { gammeCode, machines };
}

function machinesForProcFilter(gammeCode) {
  let list = state.machines || [];
  if (gammeCode !== "" && gammeCode != null) list = list.filter((m) => +m.gammeCode === +gammeCode);
  return list.slice().sort((a, b) => String(a.pac).localeCompare(String(b.pac), "fr"));
}

function fillProcFilterControls() {
  const gamSel = $("procFilterGamme");
  const host = $("procFilterMachineList");
  if (!gamSel && !host) return;
  const curGam = gamSel?.value ?? "";
  const curMachines = new Set(getProcFilter().machines);
  if (gamSel) {
    const groups = machinesGroupedByGamme();
    gamSel.innerHTML = `<option value="">Toutes les gammes</option>${groups.map((g) =>
      `<option value="${g.gammeCode}"${String(g.gammeCode) === curGam ? " selected" : ""}>${escHtml(g.gammeNom)} (${g.gammeCode})</option>`
    ).join("")}`;
  }
  if (host) {
    const machines = machinesForProcFilter(curGam);
    if (!machines.length) {
      host.innerHTML = `<span class="hint">Aucune machine${curGam ? " dans cette gamme" : ""}.</span>`;
      return;
    }
    host.innerHTML = machines.map((m) => {
      const g = gammeByCode(m.gammeCode);
      return `<label class="proc-filter-machine-chk">
        <input type="checkbox" class="proc-filter-machine-cb" value="${escVal(m.pac)}"${curMachines.has(m.pac) ? " checked" : ""}>
        <span class="mono">${escHtml(m.pac)}</span>
        ${curGam ? "" : `<span class="proc-filter-machine-gamme">${escHtml(g?.nom || m.gammeCode)}</span>`}
      </label>`;
    }).join("");
  }
}

function onProcFilterGammeChange() {
  const gammeCode = ($("procFilterGamme")?.value ?? "").trim();
  const allowed = new Set(machinesForProcFilter(gammeCode).map((m) => m.pac));
  document.querySelectorAll(".proc-filter-machine-cb:checked").forEach((cb) => {
    if (!allowed.has(cb.value)) cb.checked = false;
  });
  exitProcGalleryReorderMode();
  fillProcFilterControls();
  renderProceduresTab();
}

function clearProcFilter() {
  if ($("procFilterGamme")) $("procFilterGamme").value = "";
  fillProcFilterControls();
  renderProceduresTab();
}

function ensureProcFilterSync() {
  const bar = $("procFilterBar");
  if (!bar || bar.dataset.bound) return;
  bar.dataset.bound = "1";
  bar.addEventListener("change", (e) => {
    if (e.target.id === "procFilterGamme") onProcFilterGammeChange();
    else if (e.target.classList.contains("proc-filter-machine-cb")) {
      exitProcGalleryReorderMode();
      renderProceduresTab();
    }
  });
}

function procedureEditRefreshParentSelect() {
  const proc = procedureEditDraft?.proc;
  const catalogGammeCode = procedureEditDraft?.gammeCode;
  if (!proc || !catalogGammeCode) return;
  gatherProcedureFrigoLinkFromForm(proc);
  const sel = $("procEditParentProc");
  if (!sel) return;
  const cur = proc.parentProcId || "";
  const parents = parentProcedureOptions(proc, catalogGammeCode);
  sel.innerHTML = `<option value="">— Procédure principale (pas de parent) —</option>${parents.map((p) =>
    `<option value="${escVal(p.id)}"${cur === p.id ? " selected" : ""}>${escHtml(procedureFrigoOptionLabel(p))}</option>`
  ).join("")}`;
  const partInp = $("procEditTubePartNum");
  if (partInp && !partInp.value && proc.target?.pipeId) {
    partInp.placeholder = String(nextTubePartNumForPipe(proc.target.pipeId, proc.id));
  }
}

function gatherProcedureFrigoLinkFromForm(proc) {
  const pipeId = $("procEditFrigoPipe")?.value?.trim();
  if (pipeId) proc.target = { type: "pipe", pipeId };
  else if (proc.target?.type === "pipe") delete proc.target;

  const partRaw = ($("procEditTubePartNum")?.value ?? "").trim();
  const partNum = partRaw !== "" ? +partRaw : NaN;
  if (Number.isFinite(partNum) && partNum >= 1) proc.tubePartNum = Math.floor(partNum);
  else delete proc.tubePartNum;

  const parentId = $("procEditParentProc")?.value?.trim();
  if (parentId) proc.parentProcId = parentId;
  else delete proc.parentProcId;

  const subPart = $("procEditSubPart")?.value?.trim();
  if (subPart) proc.subPartLabel = subPart;
  else delete proc.subPartLabel;
}

function ensureProcedureCatalogs() {
  if (!Array.isArray(state.procedureCatalogs)) state.procedureCatalogs = [];
}

function procedureCatalogImageStepCount(cat) {
  if (!cat?.procedures) return 0;
  let n = 0;
  cat.procedures.forEach((p) => (p.steps || []).forEach((s) => {
    if (s.image || (s.images && s.images.length)) n++;
  }));
  return n;
}

function bundledProcedureCatalogFor(gammeCode) {
  const root = typeof OEDIP_DEFAULT_CATALOG !== "undefined" ? OEDIP_DEFAULT_CATALOG : null;
  if (!root) return null;
  const list = root.data?.procedureCatalogs || root.procedureCatalogs || [];
  return list.find((c) => +c.gammeCode === +gammeCode) || null;
}

/** Conserve la version active (cloud / import / édition locale) ; le bundle ne remplace plus les éditions. */
function pickProcedureCatalog(candidate, gammeCode) {
  if (candidate) return candidate;
  const bundled = bundledProcedureCatalogFor(gammeCode);
  return bundled ? JSON.parse(JSON.stringify(bundled)) : null;
}

function mergeProcedureStepPhotos(from, into) {
  if (!from?.procedures || !into?.procedures) return into;
  from.procedures.forEach((fp) => {
    const ip = into.procedures.find((p) => p.id === fp.id);
    if (!ip) return;
    (fp.steps || []).forEach((fs, si) => {
      const is = ip.steps?.[si];
      if (!is) return;
      if (!is.image && fs.image) is.image = fs.image;
      if ((!is.images || !is.images.length) && fs.images?.length) is.images = fs.images.slice();
      if (fs.src && !is.src) is.src = fs.src;
    });
  });
  return into;
}

function procedureEditAllowed() {
  return typeof sbCanEditReference === "function" && sbCanEditReference();
}

function updateProcedureAdminUI() {
  const host = $("v-procedures");
  if (host) host.classList.toggle("proc-admin", procedureEditAllowed());
  const reorderBtn = $("procReorderBtn");
  if (reorderBtn) reorderBtn.style.display = procedureEditAllowed() ? "" : "none";
  if (!procedureEditAllowed()) exitProcGalleryReorderMode();
  if ($("procList") && typeof renderProceduresTab === "function") renderProceduresTab();
}

function ensureProcedureCatalogPhotos() {
  ensureProcedureCatalogs();
  const bundledList = (typeof OEDIP_DEFAULT_CATALOG !== "undefined" && OEDIP_DEFAULT_CATALOG?.data?.procedureCatalogs) || [];
  bundledList.forEach((bundled) => {
    let cur = getProcedureCatalog(bundled.gammeCode);
    if (!cur) {
      const copy = JSON.parse(JSON.stringify(bundled));
      normalizeProcedureCatalog(copy);
      state.procedureCatalogs.push(copy);
      return;
    }
    mergeProcedureStepPhotos(bundled, cur);
  });
}

function getProcedureCatalog(gammeCode) {
  ensureProcedureCatalogs();
  const code = +gammeCode;
  return state.procedureCatalogs.find((c) => procedureCatalogGammeCodes(c).includes(code)) || null;
}

function ensureProcedureCatalogForGamme(gammeCode) {
  ensureProcedureCatalogs();
  const code = +gammeCode;
  let cat = getProcedureCatalog(code);
  if (!cat) {
    cat = { gammeCode: code, gammeCodes: [code], procedures: [] };
    state.procedureCatalogs.push(cat);
  }
  if (!Array.isArray(cat.procedures)) cat.procedures = [];
  if (!procedureCatalogGammeCodes(cat).includes(code)) {
    cat.gammeCodes = [...procedureCatalogGammeCodes(cat), code].sort((a, b) => a - b);
  }
  normalizeProcedureCatalog(cat);
  return cat;
}

function nextProcedureOrder(gammeCode) {
  const cat = ensureProcedureCatalogForGamme(gammeCode);
  const orders = cat.procedures.map((p) => p.order ?? 0);
  return orders.length ? Math.max(...orders) + 1 : 1;
}

function generateProcedureId(gammeCode, kind) {
  const cat = ensureProcedureCatalogForGamme(gammeCode);
  const ids = new Set(cat.procedures.map((p) => p.id));
  if (kind === "tube") {
    let n = 1;
    while (ids.has(`geo-tube-${String(n).padStart(2, "0")}`)) n++;
    return `geo-tube-${String(n).padStart(2, "0")}`;
  }
  let n = 1;
  while (ids.has(`proc-custom-${n}`)) n++;
  return `proc-custom-${n}`;
}

function buildNewProcedureTemplate(gammeCode, opts) {
  opts = opts || {};
  const kind = opts.kind || "tube";
  const tubeRef = String(opts.tubeRef || "").trim();
  const tubeNum = opts.tubeNum != null && opts.tubeNum !== "" ? +opts.tubeNum : null;
  const id = generateProcedureId(gammeCode, kind);
  const proc = {
    id,
    order: nextProcedureOrder(gammeCode),
    title: String(opts.title || "").trim()
      || (kind === "tube"
        ? `Tube ${tubeNum || "?"} — Nouveau tronçon`
        : "Nouvelle procédure atelier"),
    steps: [{ text: "", _media: [] }],
  };
  if (kind === "tube") {
    proc.tubeRef = tubeRef || "T?-XX-YY";
    if (tubeNum) proc.tubeNum = tubeNum;
    proc.variants = [{ ver: "01", ref: `${proc.tubeRef}-01`, stepDims: { e1: {} }, machines: [] }];
    const pipeId = String(opts.frigoPipeId || "").trim();
    if (pipeId) proc.target = { type: "pipe", pipeId };
    const parentId = String(opts.parentProcId || "").trim();
    if (parentId) proc.parentProcId = parentId;
    const subPart = String(opts.subPartLabel || "").trim();
    if (subPart) proc.subPartLabel = subPart;
    const partNum = opts.tubePartNum != null && opts.tubePartNum !== "" ? +opts.tubePartNum : NaN;
    if (Number.isFinite(partNum) && partNum >= 1) proc.tubePartNum = Math.floor(partNum);
  }
  return proc;
}

function openNewProcedureModal() {
  if (!procedureEditAllowed()) {
    toast("Connectez-vous en technicien ou administrateur OEDIP");
    return;
  }
  const code = +($("procNewGamme")?.value || state.gammes[0]?.code);
  const gamSel = $("procNewGamme");
  if (gamSel) {
    gamSel.innerHTML = state.gammes.map((g) =>
      `<option value="${g.code}"${+g.code === code ? " selected" : ""}>${escHtml(g.nom)} (${g.code})</option>`
    ).join("");
  }
  const pipeSel = $("procNewFrigoPipe");
  if (pipeSel) pipeSel.innerHTML = renderFrigoPipeSelectOptions("");
  const tubeProcs = tubeProceduresForGamme(code);
  const nextTube = tubeProcs.length
    ? Math.max(...tubeProcs.map((p) => p.tubeNum ?? 0)) + 1
    : 1;
  if ($("procNewKind")) $("procNewKind").value = "tube";
  if ($("procNewTitle")) $("procNewTitle").value = "";
  if ($("procNewTubeRef")) $("procNewTubeRef").value = `T${nextTube}-XX-YY`;
  if ($("procNewTubeNum")) $("procNewTubeNum").value = nextTube;
  toggleNewProcedureTubeFields();
  refreshNewProcedureParentSelect();
  $("procNewError") && ($("procNewError").textContent = "");
  $("modalProcedureNew")?.classList.add("show");
  setTimeout(() => $("procNewTitle")?.focus(), 50);
}

function closeNewProcedureModal() {
  $("modalProcedureNew")?.classList.remove("show");
}

function toggleNewProcedureTubeFields() {
  const kind = $("procNewKind")?.value || "tube";
  const row = $("procNewTubeFields");
  const frigoRow = $("procNewFrigoFields");
  if (row) row.style.display = kind === "tube" ? "" : "none";
  if (frigoRow) frigoRow.style.display = kind === "tube" ? "" : "none";
  if (kind === "tube") refreshNewProcedureParentSelect();
}

function refreshNewProcedureParentSelect() {
  const gammeCode = +($("procNewGamme")?.value || state.gammes[0]?.code);
  const pipeId = ($("procNewFrigoPipe")?.value || "").trim();
  const sel = $("procNewParentProc");
  if (!sel) return;
  const cat = getProcedureCatalog(gammeCode);
  const parents = (cat?.procedures || []).filter((p) =>
    p.tubeRef && !p.parentProcId && (!pipeId || p.target?.pipeId === pipeId)
  );
  sel.innerHTML = `<option value="">— Procédure principale —</option>${parents.map((p) =>
    `<option value="${escVal(p.id)}">${escHtml(procedureFrigoOptionLabel(p))}</option>`
  ).join("")}`;
  const partInp = $("procNewTubePartNum");
  if (partInp) partInp.value = pipeId ? nextTubePartNumForPipe(pipeId) : "";
}

function confirmNewProcedure() {
  if (!procedureEditAllowed()) {
    toast("Connectez-vous en technicien ou administrateur OEDIP");
    return;
  }
  const gammeCode = +($("procNewGamme")?.value || state.gammes[0]?.code);
  const kind = $("procNewKind")?.value || "tube";
  const title = ($("procNewTitle")?.value || "").trim();
  const tubeRef = ($("procNewTubeRef")?.value || "").trim();
  const tubeNum = ($("procNewTubeNum")?.value || "").trim();
  const errEl = $("procNewError");
  if (kind === "tube" && !tubeRef) {
    if (errEl) errEl.textContent = "Indiquez une référence tube (ex. T11-CP-CD).";
    return;
  }
  const cat = ensureProcedureCatalogForGamme(gammeCode);
  const proc = buildNewProcedureTemplate(gammeCode, {
    kind, title, tubeRef, tubeNum,
    frigoPipeId: ($("procNewFrigoPipe")?.value || "").trim(),
    parentProcId: ($("procNewParentProc")?.value || "").trim(),
    subPartLabel: ($("procNewSubPart")?.value || "").trim(),
    tubePartNum: ($("procNewTubePartNum")?.value || "").trim(),
  });
  cat.procedures.push(proc);
  closeNewProcedureModal();
  renderProceduresTab();
  openProcedureEditor(gammeCode, proc.id);
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else if (typeof markDirty === "function") markDirty();
  toast("Nouvelle procédure créée — ajoutez texte et photos");
}

function machinesInGamme(gammeCode) {
  return state.machines.filter((m) => +m.gammeCode === +gammeCode);
}

function findCatalogCompByRef(ref) {
  if (!ref) return null;
  const key = String(ref);
  for (const type of Object.keys(state.composants || {})) {
    const list = state.composants[type];
    if (!Array.isArray(list)) continue;
    const found = list.find((c) => String(c.ref || c.modele || c.id) === key);
    if (found) return found;
  }
  return null;
}

function buildMachineProcContext(pac) {
  const m = machineByPac(pac);
  if (!m) return {};
  const gam = gammeByCode(m.gammeCode);
  const t = typeof ensureFrigoTuyaux === "function" ? ensureFrigoTuyaux(m) : m.frigoTuyaux || {};
  const pipe = {};
  (typeof FRIGO_PIPES !== "undefined" ? FRIGO_PIPES : []).forEach((p) => {
    const cur = t[p.id] || {};
    pipe[p.id] = {
      diamMm: cur.diamMm != null ? cur.diamMm : "—",
      longM: cur.longM != null ? cur.longM : "—",
      label: p.label,
      circuit: p.circuit
    };
  });
  const comp = {};
  Object.entries(m.composantsLiens || {}).forEach(([role, ref]) => {
    const item = findCatalogCompByRef(ref);
    comp[role] = {
      ref: ref || "—",
      modele: item?.modele || item?.ref || "—"
    };
  });
  return {
    pac: m.pac || "—",
    chargeFluide: m.chargeFluide != null ? m.chargeFluide : "—",
    nbComp: m.nbComp != null ? m.nbComp : "—",
    gamme: {
      nom: gam?.nom || "—",
      fluide: gam?.fluide === "custom" ? (gam?.fluideLabel || "Autre") : (gam?.fluide || "—"),
      desc: gam?.desc || ""
    },
    pipe,
    comp,
    procDims: m.frigoProcDims && typeof m.frigoProcDims === "object" ? m.frigoProcDims : {}
  };
}

function procPathValue(ctx, path) {
  if (!path) return "";
  return String(path.split(".").reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : undefined), ctx) ?? "—");
}

function ensureFrigoTubeVariants(m) {
  if (!m) return {};
  if (!m.frigoTubeVariants || typeof m.frigoTubeVariants !== "object") m.frigoTubeVariants = {};
  return m.frigoTubeVariants;
}

function normalizeVariantVer(ver) {
  const s = String(ver ?? "01").replace(/\D/g, "") || "1";
  return String(+s).padStart(2, "0");
}

function getProcedureVariant(proc, ver) {
  if (!proc?.variants?.length) return null;
  const v = normalizeVariantVer(ver);
  return proc.variants.find((x) => normalizeVariantVer(x.ver) === v || x.ref === `${proc.tubeRef}-${v}`) || proc.variants[0];
}

function getMachineTubeVariantVer(m, tubeRef) {
  if (!tubeRef) return "01";
  return normalizeVariantVer(ensureFrigoTubeVariants(m)[tubeRef]);
}

function tubeProceduresForGamme(gammeCode) {
  const cat = getProcedureCatalog(gammeCode);
  return (cat?.procedures || []).filter((p) => p.tubeRef).sort((a, b) => (a.tubeNum ?? 999) - (b.tubeNum ?? 999));
}

function migrateProcedureVariants(proc) {
  if (!proc?.tubeRef || proc.variants?.length) return;
  const stepDims = {};
  (proc.steps || []).forEach((s, i) => {
    if (s.dims && Object.keys(s.dims).length) stepDims[`e${i + 1}`] = { ...s.dims };
  });
  if (Object.keys(stepDims).length) {
    proc.variants = [{ ver: "01", ref: `${proc.tubeRef}-01`, stepDims, machines: [] }];
    proc.steps.forEach((s) => { delete s.dims; });
  }
}

function migrateProcedureCatalogVariants(cat) {
  (cat?.procedures || []).forEach(migrateProcedureVariants);
}

function procedureStepKey(stepIndex) {
  return `e${stepIndex + 1}`;
}

function variantStepDims(variant, stepIndex) {
  return variant?.stepDims?.[procedureStepKey(stepIndex)] || {};
}

function mergedStepDims(proc, step, stepIndex, ctx) {
  const key = procedureStepKey(stepIndex);
  if (proc.tubeRef && proc.variants?.length) {
    const m = ctx.pac && ctx.pac !== "—" ? machineByPac(ctx.pac) : null;
    const ver = m ? getMachineTubeVariantVer(m, proc.tubeRef) : "01";
    const variant = getProcedureVariant(proc, ver);
    const fromVar = variantStepDims(variant, stepIndex);
    if (Object.keys(fromVar).length) return { ...fromVar };
  }
  const defaults = step.dims && typeof step.dims === "object" ? step.dims : {};
  const over = ctx.procDims?.[proc.id]?.[key];
  return over && typeof over === "object" ? { ...defaults, ...over } : defaults;
}

function resolveProcedureText(text, ctx, stepDims = null) {
  if (!text) return "";
  const dims = stepDims && typeof stepDims === "object" ? stepDims : {};
  return String(text).replace(/\{\{([^}]+)\}\}/g, (_, p) => {
    const k = p.trim();
    if (dims[k] !== undefined && dims[k] !== null && dims[k] !== "") return String(dims[k]);
    return procPathValue(ctx, k);
  });
}

function escVal(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const PROC_IMG_SCALE_MIN = 0.25;
const PROC_IMG_SCALE_MAX = 3;
const PROC_ANNOT_DEFAULT_COLOR = "#c62828";
const PROC_ANNOT_DEFAULT_WIDTH = 0.008;
const PROC_ANNOT_TOOLS = [
  { id: "arrow", label: "→ Flèche" },
  { id: "line", label: "— Trait" },
  { id: "circle", label: "○ Cercle" },
  { id: "text", label: "T Texte" },
];
let procEditPhotoPick = { stepIdx: -1, photoIdx: -1 };
let procAnnotDrag = null;

function clamp01(v) {
  const n = +v;
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function normalizeAnnotation(a) {
  if (!a || typeof a !== "object") return null;
  const color = String(a.color || PROC_ANNOT_DEFAULT_COLOR).slice(0, 24);
  const width = Math.max(0.002, Math.min(0.04, +(a.width) || PROC_ANNOT_DEFAULT_WIDTH));
  if (a.type === "arrow" || a.type === "line") {
    return { type: a.type, x1: clamp01(a.x1), y1: clamp01(a.y1), x2: clamp01(a.x2), y2: clamp01(a.y2), color, width };
  }
  if (a.type === "circle") {
    return { type: "circle", cx: clamp01(a.cx), cy: clamp01(a.cy), r: Math.max(0.008, Math.min(0.45, +(a.r) || 0.05)), color, width };
  }
  if (a.type === "text") {
    const text = String(a.text || "").trim().slice(0, 120);
    if (!text) return null;
    return { type: "text", x: clamp01(a.x), y: clamp01(a.y), text, color, size: Math.max(0.02, Math.min(0.12, +(a.size) || 0.04)) };
  }
  return null;
}

function normalizeMediaItem(item) {
  if (typeof item === "string") return { src: item, rotate: 0, scale: 1, annotations: [] };
  const o = item && typeof item === "object" ? item : {};
  let rotate = +(o.rotate || 0);
  if (![0, 90, 180, 270].includes(rotate)) rotate = 0;
  let scale = +(o.scale) || 1;
  scale = Math.max(PROC_IMG_SCALE_MIN, Math.min(PROC_IMG_SCALE_MAX, scale));
  const annotations = Array.isArray(o.annotations) ? o.annotations.map(normalizeAnnotation).filter(Boolean) : [];
  return { src: o.src || "", rotate, scale, annotations };
}

function normalizeStepMedia(step) {
  if (!step) return [];
  const raw = step.images?.length ? step.images : step.image ? [step.image] : [];
  return raw.map(normalizeMediaItem).filter((m) => m.src);
}

function ensureStepMedia(step) {
  if (!step._media) step._media = normalizeStepMedia(step);
  return step._media;
}

function applyMediaToStep(step, media) {
  delete step.image;
  delete step.images;
  delete step._media;
  const list = (media || []).filter((m) => m.src);
  if (!list.length) return;
  const compact = list.map((m) => {
    const hasAnnot = (m.annotations || []).length;
    const hasMeta = m.rotate || m.scale !== 1 || hasAnnot;
    if (!hasMeta && !String(m.src).startsWith("data:")) return m.src;
    const o = { src: m.src };
    if (m.rotate) o.rotate = m.rotate;
    if (m.scale !== 1) o.scale = m.scale;
    if (hasAnnot) o.annotations = m.annotations.map(normalizeAnnotation).filter(Boolean);
    return o;
  });
  if (compact.length === 1 && typeof compact[0] === "string") step.image = compact[0];
  else step.images = compact;
}

function procImgInnerStyle(item) {
  const rot = item.rotate || 0;
  const sc = item.scale || 1;
  if (!rot && sc === 1) return "";
  return `transform:rotate(${rot}deg) scale(${sc});transform-origin:center center`;
}

function procAnnotArrowMarkup(a, col, sw, opacity) {
  const x1 = a.x1;
  const y1 = a.y1;
  const x2 = a.x2;
  const y2 = a.y2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return "";
  const ux = dx / len;
  const uy = dy / len;
  const headLen = Math.min(0.05, len * 0.3);
  const headHalf = headLen * 0.45;
  const px = -uy;
  const py = ux;
  const bx = x2 - ux * headLen;
  const by = y2 - uy * headLen;
  const l1x = bx + px * headHalf;
  const l1y = by + py * headHalf;
  const l2x = bx - px * headHalf;
  const l2y = by - py * headHalf;
  const op = opacity != null ? ` opacity="${opacity}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"${op}/>
<polygon points="${x2},${y2} ${l1x},${l1y} ${l2x},${l2y}" fill="${col}"${op}/>`;
}

function renderProcAnnotShape(a) {
  const col = escAttr(a.color || PROC_ANNOT_DEFAULT_COLOR);
  const sw = a.width || PROC_ANNOT_DEFAULT_WIDTH;
  if (a.type === "arrow") return procAnnotArrowMarkup(a, col, sw);
  if (a.type === "line") {
    return `<line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (a.type === "circle") {
    return `<circle cx="${a.cx}" cy="${a.cy}" r="${a.r}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
  }
  if (a.type === "text") {
    return `<text x="${a.x}" y="${a.y}" fill="${col}" font-size="${a.size}" font-family="IBM Plex Sans,sans-serif" font-weight="600" dominant-baseline="middle" text-anchor="start">${escHtml(a.text)}</text>`;
  }
  return "";
}

function renderProcAnnotSvg(annotations, uid) {
  const list = (annotations || []).map(normalizeAnnotation).filter(Boolean);
  if (!list.length) return "";
  return `<svg class="proc-annot-overlay proc-annot-saved" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
    ${list.map((a) => renderProcAnnotShape(a)).join("")}
  </svg>`;
}

function renderProcMediaStack(item, opts) {
  opts = opts || {};
  if (!item?.src) return opts.placeholder || "";
  const uid = opts.uid || `m${Math.random().toString(36).slice(2, 9)}`;
  const innerStyle = procImgInnerStyle(item);
  const img = `<img src="${escAttr(oedipMediaUrl(item.src))}" alt=""${opts.loading ? ' loading="lazy"' : ""}>`;
  const svg = renderProcAnnotSvg(item.annotations, uid);
  const inner = `<span class="proc-step-img-inner"${innerStyle ? ` style="${escVal(innerStyle)}"` : ""}>${img}${svg}</span>`;
  if (opts.interactive) {
    return `<div class="proc-media-stack proc-edit-photo-annot-layer" data-step-i="${opts.stepIdx}" data-photo-i="${opts.photoIdx}" data-annot-tool="arrow">
      ${inner}
      <svg class="proc-annot-overlay proc-annot-draft-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"></svg>
    </div>`;
  }
  const wrapCls = opts.wrapperClass || "proc-media-stack";
  return `<span class="${wrapCls}">${inner}</span>`;
}

function procAnnotPointFromLayer(layer, clientX, clientY) {
  const img = layer?.querySelector("img");
  if (!img) return null;
  const r = img.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return {
    x: clamp01((clientX - r.left) / r.width),
    y: clamp01((clientY - r.top) / r.height),
  };
}

function procAnnotClientPoint(e) {
  if (e.touches?.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches?.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function procAnnotDist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function procAnnotClearDraft(layer) {
  const draft = layer?.querySelector(".proc-annot-draft-layer");
  if (draft) draft.innerHTML = "";
}

function procAnnotShowDraft(layer, ann) {
  const draft = layer?.querySelector(".proc-annot-draft-layer");
  if (!draft || !ann) return;
  const col = escAttr(PROC_ANNOT_DEFAULT_COLOR);
  const sw = PROC_ANNOT_DEFAULT_WIDTH;
  if (ann.type === "circle") {
    draft.innerHTML = `<circle cx="${ann.cx}" cy="${ann.cy}" r="${ann.r}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="0.85"/>`;
  } else if (ann.type === "line") {
    draft.innerHTML = `<line x1="${ann.x1}" y1="${ann.y1}" x2="${ann.x2}" y2="${ann.y2}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" opacity="0.85"/>`;
  } else if (ann.type === "arrow") {
    draft.innerHTML = procAnnotArrowMarkup(ann, col, sw, 0.85);
  }
}

function procAnnotGetMedia(stepIdx, photoIdx) {
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return null;
  return ensureStepMedia(step)[photoIdx] || null;
}

function procEditAnnotSetTool(stepIdx, photoIdx, tool) {
  const card = document.querySelector(`.proc-edit-step[data-step-i="${stepIdx}"] .proc-edit-photo-card[data-photo-idx="${photoIdx}"]`);
  const layer = card?.querySelector(".proc-edit-photo-annot-layer");
  if (layer) layer.dataset.annotTool = tool;
  card?.querySelectorAll(".proc-annot-tool-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
}

function procEditAnnotUndo(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  const media = procAnnotGetMedia(stepIdx, photoIdx);
  if (!media?.annotations?.length) return;
  media.annotations.pop();
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditAnnotClear(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  const media = procAnnotGetMedia(stepIdx, photoIdx);
  if (!media?.annotations?.length) return;
  if (!confirm("Effacer toutes les annotations sur cette photo ?")) return;
  media.annotations = [];
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procAnnotCommit(stepIdx, photoIdx, ann) {
  const media = procAnnotGetMedia(stepIdx, photoIdx);
  const norm = normalizeAnnotation(ann);
  if (!media || !norm) return;
  if (!media.annotations) media.annotations = [];
  media.annotations.push(norm);
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procAnnotFinishDrag(layer, pt) {
  const d = procAnnotDrag;
  procAnnotDrag = null;
  procAnnotClearDraft(layer);
  if (!d || !pt) return;
  const tool = d.tool || "arrow";
  if (tool === "text") {
    const text = window.prompt("Texte de l'annotation :", "");
    if (text?.trim()) procAnnotCommit(d.stepIdx, d.photoIdx, { type: "text", x: d.x1, y: d.y1, text: text.trim() });
    return;
  }
  const dist = procAnnotDist({ x: d.x1, y: d.y1 }, pt);
  if (dist < 0.012) return;
  if (tool === "circle") {
    procAnnotCommit(d.stepIdx, d.photoIdx, { type: "circle", cx: d.x1, cy: d.y1, r: dist });
    return;
  }
  procAnnotCommit(d.stepIdx, d.photoIdx, { type: tool === "line" ? "line" : "arrow", x1: d.x1, y1: d.y1, x2: pt.x, y2: pt.y });
}

function procAnnotOnPointerDown(e) {
  if (!procedureEditDraft) return;
  const layer = e.target.closest(".proc-edit-photo-annot-layer");
  if (!layer || e.button > 0) return;
  const stepIdx = +layer.dataset.stepI;
  const photoIdx = +layer.dataset.photoI;
  if (Number.isNaN(stepIdx) || Number.isNaN(photoIdx)) return;
  const pt = procAnnotPointFromLayer(layer, procAnnotClientPoint(e).x, procAnnotClientPoint(e).y);
  if (!pt) return;
  const tool = layer.dataset.annotTool || "arrow";
  if (tool === "text") {
    e.preventDefault();
    const text = window.prompt("Texte de l'annotation :", "");
    if (text?.trim()) procAnnotCommit(stepIdx, photoIdx, { type: "text", x: pt.x, y: pt.y, text: text.trim() });
    return;
  }
  e.preventDefault();
  procAnnotDrag = { stepIdx, photoIdx, tool, x1: pt.x, y1: pt.y, layer };
  procAnnotShowDraft(layer, { type: tool === "circle" ? "circle" : "line", x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y, cx: pt.x, cy: pt.y, r: 0.01 });
}

function procAnnotOnPointerMove(e) {
  if (!procAnnotDrag) return;
  const pt = procAnnotPointFromLayer(procAnnotDrag.layer, procAnnotClientPoint(e).x, procAnnotClientPoint(e).y);
  if (!pt) return;
  const d = procAnnotDrag;
  if (d.tool === "circle") {
    procAnnotShowDraft(d.layer, { type: "circle", cx: d.x1, cy: d.y1, r: procAnnotDist({ x: d.x1, y: d.y1 }, pt) });
  } else {
    procAnnotShowDraft(d.layer, { type: d.tool === "line" ? "line" : "arrow", x1: d.x1, y1: d.y1, x2: pt.x, y2: pt.y });
  }
}

function procAnnotOnPointerUp(e) {
  if (!procAnnotDrag) return;
  const layer = procAnnotDrag.layer;
  const pt = procAnnotPointFromLayer(layer, procAnnotClientPoint(e).x, procAnnotClientPoint(e).y);
  procAnnotFinishDrag(layer, pt);
}

function ensureProcAnnotSync() {
  const modal = $("modalProcedureEdit");
  if (!modal || modal.dataset.annotBound) return;
  modal.dataset.annotBound = "1";
  modal.addEventListener("mousedown", procAnnotOnPointerDown);
  modal.addEventListener("mousemove", procAnnotOnPointerMove);
  modal.addEventListener("mouseup", procAnnotOnPointerUp);
  modal.addEventListener("touchstart", procAnnotOnPointerDown, { passive: false });
  modal.addEventListener("touchmove", procAnnotOnPointerMove, { passive: false });
  modal.addEventListener("touchend", procAnnotOnPointerUp);
}

function readImageFileAsDataUrl(file, maxSide = 1600, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const m = Math.max(w, h);
      if (m > maxSide) {
        const s = maxSide / m;
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("read")); };
    img.src = url;
  });
}

function extractDimVarsFromText(text) {
  const found = [];
  String(text || "").replace(/\{\{([^}]+)\}\}/g, (_, p) => {
    const k = p.trim();
    if (k && !k.includes(".")) found.push(k);
    return "";
  });
  return [...new Set(found)];
}

function collectProcedureDimColumns(proc) {
  const cols = [];
  const seen = new Set();
  const addVars = (stepIndex, dimKey) => {
    const stepKey = procedureStepKey(stepIndex);
    const colId = `${stepKey}.${dimKey}`;
    if (seen.has(colId)) return;
    seen.add(colId);
    cols.push({ stepIndex, stepKey, dimKey, colId, label: `É${stepIndex + 1} · ${dimKey}` });
  };
  const scanStep = (stepIndex, dimsObj, stepText) => {
    const vars = new Set(Object.keys(dimsObj || {}));
    extractDimVarsFromText(stepText).forEach((v) => vars.add(v));
    [...vars].sort().forEach((dimKey) => addVars(stepIndex, dimKey));
  };
  if (proc?.variants?.length) {
    proc.variants.forEach((v) => {
      Object.entries(v.stepDims || {}).forEach(([sk, dims]) => {
        const stepIndex = parseInt(sk.slice(1), 10) - 1;
        scanStep(stepIndex, dims, proc.steps?.[stepIndex]?.text);
      });
    });
    (proc.steps || []).forEach((step, i) => {
      extractDimVarsFromText(step.text).forEach((dimKey) => addVars(i, dimKey));
    });
  } else {
    (proc?.steps || []).forEach((step, i) => scanStep(i, step.dims, step.text));
  }
  return cols;
}

function effectiveDimFromVariant(variant, stepIndex, dimKey) {
  return variantStepDims(variant, stepIndex)[dimKey] ?? "";
}

function stepDimDefault(step, dimKey) {
  return step?.dims?.[dimKey] ?? "";
}

function procedureUsesVariants(proc) {
  return !!(proc?.tubeRef && proc.variants?.length);
}

function ensureProcedureVariants(proc) {
  if (!proc?.tubeRef || proc.variants?.length) return;
  proc.variants = [{ ver: "01", ref: `${proc.tubeRef}-01`, stepDims: {} }];
}

function getStepDimValue(proc, stepIndex, dimKey, variantIndex = 0) {
  if (procedureUsesVariants(proc)) {
    const variant = proc.variants[variantIndex] || proc.variants[0];
    return variantStepDims(variant, stepIndex)[dimKey] ?? "";
  }
  return proc.steps[stepIndex]?.dims?.[dimKey] ?? "";
}

function setStepDimInProc(proc, stepIndex, dimKey, value, variantIndex = 0) {
  const sk = procedureStepKey(stepIndex);
  const v = String(value ?? "").trim();
  if (procedureUsesVariants(proc)) {
    ensureProcedureVariants(proc);
    const variant = proc.variants[variantIndex] || proc.variants[0];
    if (!variant.stepDims) variant.stepDims = {};
    if (!variant.stepDims[sk]) variant.stepDims[sk] = {};
    if (v) variant.stepDims[sk][dimKey] = v;
    else {
      delete variant.stepDims[sk][dimKey];
      if (!Object.keys(variant.stepDims[sk]).length) delete variant.stepDims[sk];
    }
    return;
  }
  const step = proc.steps[stepIndex];
  if (!step) return;
  if (!step.dims) step.dims = {};
  if (v) step.dims[dimKey] = v;
  else {
    delete step.dims[dimKey];
    if (!Object.keys(step.dims).length) delete step.dims;
  }
}

function collectStepDimVars(proc, stepIndex, step) {
  const vars = new Set();
  if (procedureUsesVariants(proc)) {
    (proc.variants || []).forEach((v) => {
      Object.keys(variantStepDims(v, stepIndex)).forEach((k) => vars.add(k));
    });
  } else {
    Object.keys(step?.dims || {}).forEach((k) => vars.add(k));
  }
  extractDimVarsFromText(step?.text).forEach((k) => vars.add(k));
  return [...vars].sort();
}

function renderProcedureDimChips(stepIdx) {
  return PROCEDURE_DIM_CHIPS.map((c) =>
    `<button type="button" class="proc-var-chip mono" data-step-idx="${stepIdx}" data-var-key="${escVal(c.key)}" title="Insérer {{${escHtml(c.key)}}}">${escHtml(c.label)}</button>`
  ).join("");
}

function renderProcedureEditStepDimsInner(stepIdx, proc, step) {
  const vars = collectStepDimVars(proc, stepIdx, step);
  if (!vars.length) {
    return `<p class="proc-edit-step-dims-empty hint" style="margin:0">Insérez une variable (<span class="mono">{{L}}</span>, <span class="mono">{{diam}}</span>…) avec les puces ci-dessus pour saisir la cote ici.</p>`;
  }
  if (procedureUsesVariants(proc)) {
    const variants = proc.variants || [];
    const canDel = variants.length > 1;
    const head = variants.map((v, vi) =>
      `<th class="mono proc-edit-var-col" title="${escVal(v.ref || `${proc.tubeRef}-${v.ver}`)}">${escHtml(v.ver || "01")}${canDel ? `<button type="button" class="proc-var-col-del" onclick="procedureEditRemoveVariant(${vi})" title="Supprimer la variante">×</button>` : ""}</th>`
    ).join("");
    const rows = vars.map((dk) => {
      const cells = variants.map((v, vi) =>
        `<td><input type="text" class="mono proc-edit-step-dim-inp" data-proc-dim-key="${escVal(dk)}" data-var-i="${vi}" value="${escVal(getStepDimValue(proc, stepIdx, dk, vi))}" placeholder="—"></td>`
      ).join("");
      return `<tr><td class="mono proc-edit-step-dim-key">{{${escHtml(dk)}}}</td>${cells}</tr>`;
    }).join("");
    return `<table class="proc-edit-step-dims-tbl"><thead><tr><th>Variable</th>${head}</tr></thead><tbody>${rows}</tbody></table>
      <p class="hint" style="margin:4px 0 0">Une colonne = une variante (<span class="mono">${escHtml(proc.tubeRef)}-01</span>, <span class="mono">-02</span>…).</p>`;
  }
  const rows = vars.map((dk) =>
    `<tr><td class="mono proc-edit-step-dim-key">{{${escHtml(dk)}}}</td>
      <td><input type="text" class="mono proc-edit-step-dim-inp" data-proc-dim-key="${escVal(dk)}" value="${escVal(getStepDimValue(proc, stepIdx, dk))}" placeholder="—"></td></tr>`
  ).join("");
  return `<table class="proc-edit-step-dims-tbl"><thead><tr><th>Variable</th><th>Valeur défaut</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function refreshProcedureEditStepDims(stepIdx) {
  const proc = procedureEditDraft?.proc;
  const step = proc?.steps?.[stepIdx];
  const stepEl = document.querySelector(`.proc-edit-step[data-step-i="${stepIdx}"]`);
  const host = stepEl?.querySelector(".proc-edit-step-dims-host");
  if (!proc || !step || !host) return;
  const html = renderProcedureEditStepDimsInner(stepIdx, proc, step);
  host.innerHTML = html;
  host.style.display = "";
}

function findProcVarDimInput(stepKey, dimKey, varI = 0) {
  return [...document.querySelectorAll(`tr[data-var-i="${varI}"] .proc-var-dim-inp`)].find(
    (inp) => inp.dataset.stepKey === stepKey && inp.dataset.dimKey === dimKey
  );
}

function findProcStepDimInput(stepIdx, dimKey, varI = 0) {
  return [...document.querySelectorAll(`.proc-edit-step[data-step-i="${stepIdx}"] .proc-edit-step-dim-inp`)].find(
    (inp) => inp.dataset.procDimKey === dimKey && (+(inp.dataset.varI ?? 0)) === varI
  );
}

function syncStepDimToVariantsTable(stepIdx, dimKey, value, varI = 0) {
  const proc = procedureEditDraft?.proc;
  if (!proc) return;
  setStepDimInProc(proc, stepIdx, dimKey, value, varI);
  if (!procedureUsesVariants(proc)) return;
  const sk = procedureStepKey(stepIdx);
  const inp = findProcVarDimInput(sk, dimKey, varI);
  if (inp && inp.value !== value) inp.value = value;
  else if (!inp) procedureEditRefreshDimsTable();
}

function syncVariantsTableToStepDim(stepIdx, dimKey, value, varI = 0) {
  const proc = procedureEditDraft?.proc;
  if (!proc) return;
  setStepDimInProc(proc, stepIdx, dimKey, value, varI);
  const inp = findProcStepDimInput(stepIdx, dimKey, varI);
  if (inp && inp.value !== value) inp.value = value;
  else if (!inp) refreshProcedureEditStepDims(stepIdx);
}

function procEditInsertVar(stepIdx, varKey) {
  syncProcedureEditTextsOnly();
  const el = document.querySelector(`.proc-edit-step[data-step-i="${stepIdx}"] .proc-edit-step-text`);
  if (!el) return;
  const token = `{{${varKey}}}`;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.value = el.value.slice(0, start) + token + el.value.slice(end);
  const pos = start + token.length;
  el.focus();
  el.setSelectionRange(pos, pos);
  const proc = procedureEditDraft?.proc;
  if (proc) {
    const step = proc.steps[stepIdx];
    if (step) step.text = el.value;
  }
  const colsBefore = proc ? collectProcedureDimColumns(proc).length : 0;
  refreshProcedureEditStepDims(stepIdx);
  if (proc && collectProcedureDimColumns(proc).length !== colsBefore) procedureEditRefreshDimsTable();
}

function procEditOnStepTextChange(stepIdx) {
  if (!procedureEditDraft) return;
  const proc = procedureEditDraft.proc;
  const colsBefore = collectProcedureDimColumns(proc).length;
  syncProcedureEditTextsOnly();
  refreshProcedureEditStepDims(stepIdx);
  if (collectProcedureDimColumns(proc).length !== colsBefore) procedureEditRefreshDimsTable();
}

function ensureProcedureEditDimSync() {
  const modal = $("modalProcedureEdit");
  if (!modal || modal.dataset.dimSyncBound) return;
  modal.dataset.dimSyncBound = "1";
  modal.addEventListener("click", (e) => {
    const chip = e.target.closest(".proc-var-chip");
    if (chip) {
      e.preventDefault();
      const stepIdx = +chip.dataset.stepIdx;
      const varKey = chip.dataset.varKey;
      if (Number.isNaN(stepIdx) || !varKey) return;
      procEditInsertVar(stepIdx, varKey);
      return;
    }
    const allBtn = e.target.closest(".proc-var-machines-all");
    if (allBtn) {
      procVarMachineSelectAll(+allBtn.dataset.varI, "all");
      return;
    }
    const gammeBtn = e.target.closest(".proc-var-machines-gamme-all");
    if (gammeBtn) {
      procVarMachineSelectAll(+gammeBtn.dataset.varI, "gamme");
      return;
    }
    const noneBtn = e.target.closest(".proc-var-machines-none");
    if (noneBtn) procVarMachineSelectAll(+noneBtn.dataset.varI, "none");
  });
  modal.addEventListener("change", (e) => {
    const cb = e.target.closest(".proc-var-machine-cb");
    if (!cb) return;
    if (cb.checked) {
      const pac = cb.dataset.pac;
      document.querySelectorAll(".proc-var-machine-cb").forEach((other) => {
        if (other !== cb && other.dataset.pac === pac) other.checked = false;
      });
    }
    refreshProcedureVariantMachineCounts();
  });
  modal.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches(".proc-edit-step-dim-inp")) {
      const stepIdx = +t.closest(".proc-edit-step")?.dataset.stepI;
      if (Number.isNaN(stepIdx)) return;
      const varI = +(t.dataset.varI ?? 0);
      syncStepDimToVariantsTable(stepIdx, t.dataset.procDimKey, t.value.trim(), varI);
      return;
    }
    if (t.matches(".proc-var-dim-inp")) {
      const row = t.closest("tr[data-var-i]");
      const varI = +(row?.dataset.varI ?? -1);
      if (varI < 0) return;
      const sk = t.dataset.stepKey;
      const dimKey = t.dataset.dimKey;
      if (!sk || !dimKey) return;
      const stepIdx = parseInt(sk.slice(1), 10) - 1;
      syncVariantsTableToStepDim(stepIdx, dimKey, t.value.trim(), varI);
    }
  });
}

function machineDimOverride(m, procId, stepKey, dimKey) {
  return m.frigoProcDims?.[procId]?.[stepKey]?.[dimKey] ?? "";
}

function effectiveDim(m, proc, stepIndex, dimKey) {
  const stepKey = procedureStepKey(stepIndex);
  const def = stepDimDefault(proc.steps[stepIndex], dimKey);
  const over = machineDimOverride(m, proc.id, stepKey, dimKey);
  return over !== "" ? over : def;
}

function setMachineProcDim(m, procId, stepKey, dimKey, value, defaultVal) {
  if (!m.frigoProcDims) m.frigoProcDims = {};
  const branch = m.frigoProcDims[procId] || (m.frigoProcDims[procId] = {});
  const stepBranch = branch[stepKey] || (branch[stepKey] = {});
  const v = String(value ?? "").trim();
  const def = String(defaultVal ?? "").trim();
  if (!v || v === def) {
    delete stepBranch[dimKey];
    if (!Object.keys(stepBranch).length) delete branch[stepKey];
    if (!Object.keys(branch).length) delete m.frigoProcDims[procId];
    if (m.frigoProcDims && !Object.keys(m.frigoProcDims).length) delete m.frigoProcDims;
  } else {
    stepBranch[dimKey] = v;
  }
}

function machinesGroupedByGamme() {
  const groups = new Map();
  (state.machines || []).forEach((m) => {
    const gam = gammeByCode(m.gammeCode);
    const key = +m.gammeCode;
    if (!groups.has(key)) {
      groups.set(key, { gammeCode: key, gammeNom: gam?.nom || `Gamme ${key}`, machines: [] });
    }
    groups.get(key).machines.push(m);
  });
  return [...groups.values()].sort((a, b) => a.gammeCode - b.gammeCode);
}

function ensureProcedureVariantMachines(proc, gammeCode) {
  if (!proc?.tubeRef || !proc.variants?.length) return;
  const tubeRef = proc.tubeRef;
  proc.variants.forEach((v) => {
    if (Array.isArray(v.machines)) return;
    const ver = normalizeVariantVer(v.ver);
    v.machines = (state.machines || [])
      .filter((m) => {
        const explicit = m.frigoTubeVariants?.[tubeRef];
        return explicit && normalizeVariantVer(explicit) === ver;
      })
      .map((m) => m.pac);
  });
}

function machinesOnVariant(proc, variant) {
  return new Set(Array.isArray(variant?.machines) ? variant.machines : []);
}

function renderProcedureVariantMachinesHtml(proc, gammeCode, opts = {}) {
  if (!proc?.tubeRef || !proc.variants?.length) return "";
  const mode = opts.mode || "view";
  const groups = machinesGroupedByGamme();
  if (!groups.length) {
    return `<p class="hint">Aucune machine dans le projet — créez des machines dans l'onglet Machines.</p>`;
  }
  if (mode === "view") {
    const blocks = proc.variants.map((v) => {
      const byGamme = new Map();
      (v.machines || []).forEach((pac) => {
        const m = machineByPac(pac);
        const code = m ? +m.gammeCode : 0;
        if (!byGamme.has(code)) {
          const g = gammeByCode(code);
          byGamme.set(code, { nom: g?.nom || (code ? `Gamme ${code}` : "—"), pacs: [] });
        }
        byGamme.get(code).pacs.push(pac);
      });
      const groups = [...byGamme.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      const list = groups.length
        ? groups.map((g) => `<div class="proc-var-machines-gamme-tags">
            <span class="proc-var-machines-gamme-lbl">${escHtml(g.nom)}</span>
            <div class="proc-var-machines-tags">${g.pacs.map((pac) =>
              `<span class="proc-var-machine-tag mono">${escHtml(pac)}</span>`
            ).join("")}</div>
          </div>`).join("")
        : `<span class="hint" style="display:inline;padding:2px 6px">—</span>`;
      return `<div class="proc-var-machines-block">
        <div class="proc-var-machines-head mono">${escHtml(v.ref || `${proc.tubeRef}-${v.ver}`)}</div>
        ${list}
      </div>`;
    }).join("");
    return `<div class="proc-var-machines-wrap proc-var-machines-view">${blocks}</div>`;
  }
  const blocks = proc.variants.map((v, vi) => {
    const ver = normalizeVariantVer(v.ver);
    const selected = machinesOnVariant(proc, v);
    const canDel = proc.variants.length > 1;
    const groupHtml = groups.map((g) => {
      const sameGamme = +g.gammeCode === +gammeCode;
      const items = g.machines.map((m) =>
        `<label class="proc-var-machine-chk${sameGamme ? " proc-var-machine-chk-gamme" : ""}">
          <input type="checkbox" class="proc-var-machine-cb" data-var-i="${vi}" data-var-ver="${escVal(ver)}" data-pac="${escVal(m.pac)}"${selected.has(m.pac) ? " checked" : ""}>
          <span class="mono proc-var-machine-pac">${escHtml(m.pac)}</span>
          ${sameGamme ? "" : `<span class="proc-var-machine-gamme">${escHtml(g.gammeNom)}</span>`}
        </label>`
      ).join("");
      return `<div class="proc-var-machines-gamme${sameGamme ? " proc-var-machines-gamme-cur" : ""}">
        <div class="proc-var-machines-gamme-lbl">${escHtml(g.gammeNom)} <span class="mono">(${g.gammeCode})</span></div>
        <div class="proc-var-machines-grid">${items}</div>
      </div>`;
    }).join("");
    return `<div class="proc-var-machines-block" data-var-i="${vi}">
      <div class="proc-var-machines-head">
        <span class="mono proc-var-machines-ref">${escHtml(v.ref || `${proc.tubeRef}-${ver}`)}</span>
        <span class="proc-var-machines-count">${selected.size} machine${selected.size !== 1 ? "s" : ""}</span>
        <span class="grow"></span>
        ${canDel ? `<button type="button" class="btn-ghost proc-var-del-btn" onclick="procedureEditRemoveVariant(${vi})" title="Supprimer la variante">✕ Variante</button>` : ""}
        <button type="button" class="btn-ghost proc-var-machines-all" data-var-i="${vi}">Tout</button>
        <button type="button" class="btn-ghost proc-var-machines-gamme-all" data-var-i="${vi}" data-gamme-code="${gammeCode}">Gamme proc.</button>
        <button type="button" class="btn-ghost proc-var-machines-none" data-var-i="${vi}">Aucune</button>
      </div>
      ${groupHtml}
    </div>`;
  }).join("");
  return `<div class="proc-var-machines-wrap">${blocks}</div>`;
}

function gatherProcedureVariantMachinesFromForm(proc) {
  if (!proc?.tubeRef || !proc.variants?.length) return;
  proc.variants.forEach((v, vi) => {
    v.machines = [...document.querySelectorAll(`.proc-var-machine-cb[data-var-i="${vi}"]:checked`)]
      .map((cb) => cb.dataset.pac)
      .filter(Boolean);
  });
}

function applyProcedureVariantMachinesToMachines(proc) {
  if (!proc?.tubeRef || !proc.variants?.length) return;
  const tubeRef = proc.tubeRef;
  const pacToVer = {};
  proc.variants.forEach((v) => {
    const ver = normalizeVariantVer(v.ver);
    (v.machines || []).forEach((pac) => { pacToVer[pac] = ver; });
  });
  (state.machines || []).forEach((m) => {
    const ver = pacToVer[m.pac];
    const branch = ensureFrigoTubeVariants(m);
    if (ver) branch[tubeRef] = ver;
    else if (branch[tubeRef] !== undefined) {
      delete branch[tubeRef];
      if (!Object.keys(branch).length) delete m.frigoTubeVariants;
    }
  });
}

function refreshProcedureVariantMachineCounts() {
  document.querySelectorAll(".proc-var-machines-block[data-var-i]").forEach((block) => {
    const vi = block.dataset.varI;
    const n = document.querySelectorAll(`.proc-var-machine-cb[data-var-i="${vi}"]:checked`).length;
    const el = block.querySelector(".proc-var-machines-count");
    if (el) el.textContent = `${n} machine${n !== 1 ? "s" : ""}`;
  });
}

function procVarMachineSelectAll(varIdx, mode) {
  const proc = procedureEditDraft?.proc;
  const gammeCode = procedureEditDraft?.gammeCode;
  const block = document.querySelector(`.proc-var-machines-block[data-var-i="${varIdx}"]`);
  if (!block) return;
  block.querySelectorAll(".proc-var-machine-cb").forEach((cb) => {
    if (mode === "gamme") {
      const m = machineByPac(cb.dataset.pac);
      cb.checked = m && +m.gammeCode === +gammeCode;
    } else if (mode === "none") cb.checked = false;
    else cb.checked = true;
  });
  block.querySelectorAll(".proc-var-machine-cb:checked").forEach((cb) => {
    const pac = cb.dataset.pac;
    document.querySelectorAll(".proc-var-machine-cb").forEach((other) => {
      if (other !== cb && other.dataset.pac === pac) other.checked = false;
    });
  });
  refreshProcedureVariantMachineCounts();
}

function cleanupMachineProcDims(m, procId) {
  const b = m.frigoProcDims?.[procId];
  if (!b) return;
  Object.keys(b).forEach((sk) => { if (!Object.keys(b[sk]).length) delete b[sk]; });
  if (!Object.keys(b).length) delete m.frigoProcDims[procId];
}

function renderProcedureVariantsTableHtml(proc, opts = {}) {
  const cols = collectProcedureDimColumns(proc);
  if (!proc.tubeRef || !proc.variants?.length) {
    if (!cols.length) return `<p class="hint">Aucune cote variable.</p>`;
    return renderProcedureDimsTableHtml(proc, null, opts);
  }
  if (!cols.length) return `<p class="hint">Réf. <span class="mono">${escHtml(proc.tubeRef)}</span> — aucune cote dans les variantes.</p>`;
  const mode = opts.mode || "view";
  const canDel = proc.variants.length > 1;
  const head = `<tr><th>Variante</th>${cols.map((c) => `<th>${escHtml(c.label)}</th>`).join("")}${mode === "edit" && canDel ? `<th class="proc-var-del-col"></th>` : ""}</tr>`;
  if (mode === "edit") {
    const rows = proc.variants.map((v, vi) => `<tr data-var-i="${vi}">
      <td class="mono proc-var-ref-cell"><div class="proc-var-ref-row"><input type="text" class="proc-var-ref-inp" value="${escVal(v.ref || "")}">${canDel ? `<button type="button" class="btn-ghost proc-var-del-btn" onclick="procedureEditRemoveVariant(${vi})" title="Supprimer la variante">✕</button>` : ""}</div><input type="hidden" class="proc-var-ver-inp" value="${escVal(v.ver || "01")}"></td>
      ${cols.map((c) => {
        const val = effectiveDimFromVariant(v, c.stepIndex, c.dimKey);
        return `<td><input type="text" class="mono proc-var-dim-inp" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(val)}"></td>`;
      }).join("")}
      ${canDel ? `<td class="proc-var-del-col"></td>` : ""}
    </tr>`).join("");
    return `<div class="proc-dims-wrap"><p class="hint">Base <span class="mono">${escHtml(proc.tubeRef)}</span> — une ligne = une variante (<span class="mono">${escHtml(proc.tubeRef)}-01</span>, <span class="mono">-02</span>…).</p>
      <table class="proc-dims-tbl proc-gamme-tbl proc-variants-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table>
      <button type="button" class="btn-ghost" onclick="procedureEditAddVariant()">+ Variante ${String(proc.variants.length + 1).padStart(2, "0")}</button>
      ${renderProcedureVariantMachinesHtml(proc, opts.gammeCode, { mode: "edit" })}</div>`;
  }
  const rows = proc.variants.map((v) => `<tr class="${normalizeVariantVer(v.ver) === "01" ? "proc-dims-def" : ""}">
    <td class="mono"><b>${escHtml(v.ref || `${proc.tubeRef}-${v.ver}`)}</b></td>
    ${cols.map((c) => `<td class="mono">${escHtml(effectiveDimFromVariant(v, c.stepIndex, c.dimKey) || "—")}</td>`).join("")}
  </tr>`).join("");
  return `<div class="proc-dims-wrap"><p class="hint">Réf. base <span class="mono">${escHtml(proc.tubeRef)}</span> · version choisie par machine sur le schéma frigo.</p>
    <table class="proc-dims-tbl proc-gamme-tbl proc-variants-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table>
    ${renderProcedureVariantMachinesHtml(proc, opts.gammeCode, { mode: "view" })}</div>`;
}

function renderProcedureDimsTableHtml(proc, gammeCode, opts = {}) {
  if (proc.tubeRef && proc.variants?.length) return renderProcedureVariantsTableHtml(proc, opts);
  const cols = collectProcedureDimColumns(proc);
  if (!cols.length) {
    return `<p class="hint">Aucune variable de mesure (<span class="mono">{{L}}</span>, <span class="mono">{{diam}}</span>…) — ajoutez-les dans le texte des étapes.</p>`;
  }
  const machines = machinesInGamme(gammeCode);
  const mode = opts.mode || "view";
  const head = `<tr><th>Machine</th>${cols.map((c) => `<th title="${escVal(c.colId)}">${escHtml(c.label)}</th>`).join("")}</tr>`;

  if (mode === "edit") {
    const defRow = `<tr class="proc-dims-def"><td><b>Défaut gamme</b></td>${cols.map((c) => {
      const v = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
      return `<td><input type="text" class="mono proc-dim-inp" data-dim-scope="default" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(v)}"></td>`;
    }).join("")}</tr>`;
    const mRows = machines.map((m, mi) => `<tr>
      <td class="mono">${escHtml(m.pac)}</td>
      ${cols.map((c) => {
        const def = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
        const over = machineDimOverride(m, proc.id, c.stepKey, c.dimKey);
        return `<td><input type="text" class="mono proc-dim-inp" data-dim-scope="machine" data-mi="${mi}" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(over)}" placeholder="${escVal(def)}"></td>`;
      }).join("")}
    </tr>`).join("");
    return `<div class="proc-dims-wrap"><table class="proc-dims-tbl proc-gamme-tbl"><thead>${head}</thead><tbody>${defRow}${mRows}</tbody></table></div>`;
  }

  const defRow = `<tr class="proc-dims-def"><td><span class="tag">Défaut</span></td>${cols.map((c) => {
    const v = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
    return `<td class="mono">${escHtml(v || "—")}</td>`;
  }).join("")}</tr>`;
  const mRows = machines.map((m) => `<tr>
    <td class="mono">${escHtml(m.pac)}</td>
    ${cols.map((c) => {
      const eff = effectiveDim(m, proc, c.stepIndex, c.dimKey);
      const over = machineDimOverride(m, proc.id, c.stepKey, c.dimKey);
      const cls = over !== "" ? "proc-dim-override" : "";
      return `<td class="mono ${cls}" title="${over !== "" ? "Surcharge machine" : ""}">${escHtml(eff || "—")}</td>`;
    }).join("")}
  </tr>`).join("");
  return `<div class="proc-dims-wrap"><table class="proc-dims-tbl proc-gamme-tbl"><thead>${head}</thead><tbody>${defRow}${mRows}</tbody></table></div>`;
}

let procedureEditDraft = null;

function renderProcedureEditPhotosInner(step, stepIdx) {
  const media = ensureStepMedia(step);
  const cards = media.map((m, pi) => {
    const scPct = Math.round((m.scale || 1) * 100);
    const uid = `e${stepIdx}p${pi}`;
    const preview = m.src
      ? renderProcMediaStack(m, { uid, interactive: true, stepIdx, photoIdx: pi })
      : `<span class="hint">Aucune image</span>`;
    const toolBtns = PROC_ANNOT_TOOLS.map((t) =>
      `<button type="button" class="btn-ghost proc-annot-tool-btn${t.id === "arrow" ? " active" : ""}" data-tool="${escVal(t.id)}" onclick="procEditAnnotSetTool(${stepIdx},${pi},'${escAttr(t.id)}')">${escHtml(t.label)}</button>`
    ).join("");
    return `<div class="proc-edit-photo-card" data-photo-idx="${pi}">
      <div class="proc-edit-photo-preview">${preview}</div>
      <div class="proc-edit-annot-tools">${toolBtns}
        <button type="button" class="btn-ghost" title="Annuler la dernière annotation" onclick="procEditAnnotUndo(${stepIdx},${pi})">↩</button>
        <button type="button" class="btn-ghost" title="Effacer les annotations" onclick="procEditAnnotClear(${stepIdx},${pi})">⌫</button>
      </div>
      <div class="proc-edit-photo-tools">
        <button type="button" class="btn-ghost" title="Pivoter à gauche" onclick="procEditPhotoRotate(${stepIdx},${pi},-90)">↺</button>
        <button type="button" class="btn-ghost" title="Pivoter à droite" onclick="procEditPhotoRotate(${stepIdx},${pi},90)">↻</button>
        <button type="button" class="btn-ghost" title="Réduire" onclick="procEditPhotoScale(${stepIdx},${pi},-0.1)">−</button>
        <span class="mono proc-edit-photo-scale-lbl">${scPct}%</span>
        <button type="button" class="btn-ghost" title="Agrandir" onclick="procEditPhotoScale(${stepIdx},${pi},0.1)">+</button>
        <button type="button" class="btn-ghost" title="Changer l'image" onclick="procEditPhotoPickFile(${stepIdx},${pi})">🖼</button>
        <button type="button" class="btn-ghost" title="Supprimer" onclick="procEditPhotoRemove(${stepIdx},${pi})">✕</button>
      </div>
      <input type="text" class="mono proc-edit-photo-path" value="${escVal(m.src)}" placeholder="img/procedures/geo/…" title="Chemin relatif ou image importée">
    </div>`;
  }).join("");
  return `${cards ? `<div class="proc-edit-photos-grid">${cards}</div>` : ""}
    <div class="proc-edit-photos-actions">
      <button type="button" class="btn-soft" onclick="procEditPhotoPickFile(${stepIdx},-1)">🖼 Galerie</button>
      <button type="button" class="btn-soft" onclick="procEditPhotoTakeCamera(${stepIdx},-1)">📷 Photo</button>
    </div>`;
}

function refreshProcedureEditPhotos(stepIdx) {
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  const host = document.querySelector(`.proc-edit-step[data-step-i="${stepIdx}"] .proc-edit-photos-body`);
  if (step && host) host.innerHTML = renderProcedureEditPhotosInner(step, stepIdx);
}

function syncProcedureEditTextsOnly() {
  if (!procedureEditDraft) return;
  const proc = procedureEditDraft.proc;
  const titleInp = $("procEditTitleInp");
  const introInp = $("procEditIntroInp");
  const orderInp = $("procEditOrderInp");
  if (titleInp) proc.title = titleInp.value.trim() || proc.title;
  if (introInp) {
    const intro = introInp.value.trim();
    if (intro) proc.printIntro = intro;
    else delete proc.printIntro;
  }
  if (orderInp) proc.order = +orderInp.value || proc.order || 999;
  [...document.querySelectorAll(".proc-edit-step")].forEach((el, i) => {
    const step = proc.steps[i];
    if (!step) return;
    step.text = el.querySelector(".proc-edit-step-text")?.value ?? "";
    el.querySelectorAll(".proc-edit-step-dim-inp").forEach((inp) => {
      setStepDimInProc(proc, i, inp.dataset.procDimKey, inp.value.trim(), +(inp.dataset.varI ?? 0));
    });
    const media = ensureStepMedia(step);
    el.querySelectorAll(".proc-edit-photo-card").forEach((card, pi) => {
      if (!media[pi]) return;
      const pathInp = card.querySelector(".proc-edit-photo-path");
      if (pathInp?.value.trim()) media[pi].src = pathInp.value.trim();
    });
  });
}

function procEditPhotoApply(stepIdx) {
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  applyMediaToStep(step, media);
  step._media = media;
}

function procEditPhotoRotate(stepIdx, photoIdx, delta) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  if (!media[photoIdx]) return;
  media[photoIdx].rotate = (media[photoIdx].rotate + delta + 360) % 360;
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoScale(stepIdx, photoIdx, delta) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  if (!media[photoIdx]) return;
  const sc = (media[photoIdx].scale || 1) + delta;
  media[photoIdx].scale = Math.max(PROC_IMG_SCALE_MIN, Math.min(PROC_IMG_SCALE_MAX, Math.round(sc * 100) / 100));
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoRemove(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  media.splice(photoIdx, 1);
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoPickFile(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  procEditPhotoPick = { stepIdx, photoIdx };
  $("procEditPhotoFileInput")?.click();
}

function procEditPhotoTakeCamera(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  procEditPhotoPick = { stepIdx, photoIdx };
  $("procEditPhotoCameraInput")?.click();
}

async function onProcEditPhotoFileChange(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file || !procedureEditDraft) return;
  const { stepIdx, photoIdx } = procEditPhotoPick;
  const step = procedureEditDraft.proc.steps[stepIdx];
  if (!step) return;
  try {
    const dataUrl = await readImageFileAsDataUrl(file);
    const media = ensureStepMedia(step);
    if (photoIdx >= 0 && media[photoIdx]) {
      media[photoIdx].src = dataUrl;
      media[photoIdx].annotations = [];
    }
    else media.push({ src: dataUrl, rotate: 0, scale: 1, annotations: [] });
    procEditPhotoApply(stepIdx);
    refreshProcedureEditPhotos(stepIdx);
    toast("Photo importée");
  } catch (e) {
    toast("Impossible de lire l'image");
  }
}

function renderProcedureEditSteps(proc) {
  return (proc.steps || []).map((step, i) => {
    ensureStepMedia(step);
    const dimPanel = renderProcedureEditStepDimsInner(i, proc, step);
    const last = (proc.steps || []).length - 1;
    return `<div class="proc-edit-step" data-step-i="${i}">
      <div class="proc-edit-step-head">
        <span class="tag mono">Étape ${i + 1}</span>
        <span class="grow"></span>
        <button type="button" class="btn-ghost" onclick="procedureEditMoveStep(${i},-1)"${i === 0 ? " disabled" : ""}>↑</button>
        <button type="button" class="btn-ghost" onclick="procedureEditMoveStep(${i},1)"${i === last ? " disabled" : ""}>↓</button>
        <button type="button" class="btn-ghost" onclick="procedureEditRemoveStep(${i})" title="Supprimer">✕</button>
      </div>
      <div class="proc-edit-var-chips-wrap">
        <span class="proc-edit-var-chips-label">Insérer :</span>
        <div class="proc-edit-var-chips">${renderProcedureDimChips(i)}</div>
      </div>
      <textarea class="proc-edit-step-text" rows="3" placeholder="Texte — {{L}}, {{diam}}, {{pac}}, {{comp.compresseur.ref}}…" oninput="procEditOnStepTextChange(${i})">${escHtml(step.text || "")}</textarea>
      <div class="proc-edit-step-dims-host">${dimPanel}</div>
      <div class="proc-edit-photos">
        <span class="subhead" style="margin:10px 0 6px;border:none">Photos</span>
        <p class="hint" style="margin:0 0 8px">Annotations vectorielles sur la photo · ↺ ↻ pivoter · − + taille · 🖼 remplacer</p>
        <div class="proc-edit-photos-body">${renderProcedureEditPhotosInner(step, i)}</div>
      </div>
    </div>`;
  }).join("");
}

function gatherProcedureVariantsFromForm(proc) {
  if (!proc.tubeRef) return;
  const rows = [...document.querySelectorAll("tr[data-var-i]")];
  if (!rows.length) return;
  proc.variants = rows.map((row, vi) => {
    const refInp = row.querySelector(".proc-var-ref-inp")?.value.trim() || "";
    const ver = normalizeVariantVer(row.querySelector(".proc-var-ver-inp")?.value || refInp.split("-").pop() || "01");
    const stepDims = {};
    row.querySelectorAll(".proc-var-dim-inp").forEach((inp) => {
      const sk = inp.dataset.stepKey;
      const dk = inp.dataset.dimKey;
      const v = inp.value.trim();
      if (!sk || !dk || !v) return;
      if (!stepDims[sk]) stepDims[sk] = {};
      stepDims[sk][dk] = v;
    });
    const prevMachines = proc.variants?.[vi]?.machines;
    return {
      ver,
      ref: refInp || `${proc.tubeRef}-${ver}`,
      stepDims,
      machines: Array.isArray(prevMachines) ? [...prevMachines] : [],
    };
  });
}

function procedureEditAddVariant() {
  gatherProcedureEditForm();
  const proc = procedureEditDraft?.proc;
  if (!proc?.tubeRef) return;
  const n = (proc.variants?.length || 0) + 1;
  const ver = String(n).padStart(2, "0");
  const base = proc.variants?.[0];
  proc.variants = proc.variants || [];
  proc.variants.push({
    ver,
    ref: `${proc.tubeRef}-${ver}`,
    stepDims: base?.stepDims ? JSON.parse(JSON.stringify(base.stepDims)) : {},
    machines: [],
  });
  renderProcedureEditor();
}

function procedureEditRemoveVariant(vi) {
  if (!procedureEditDraft) return;
  gatherProcedureEditForm();
  const proc = procedureEditDraft.proc;
  if (!proc?.tubeRef || !proc.variants?.length) return;
  if (proc.variants.length <= 1) {
    if (typeof toast === "function") toast("Impossible de supprimer la dernière variante.");
    return;
  }
  const v = proc.variants[vi];
  if (!v) return;
  const label = v.ref || `${proc.tubeRef}-${normalizeVariantVer(v.ver)}`;
  if (!confirm(`Supprimer la variante « ${label} » ?`)) return;
  const removedVer = normalizeVariantVer(v.ver);
  proc.variants.splice(vi, 1);
  const tubeRef = proc.tubeRef;
  const fallback = normalizeVariantVer(proc.variants[0]?.ver || "01");
  (state.machines || []).forEach((m) => {
    const branch = m.frigoTubeVariants;
    if (!branch?.[tubeRef]) return;
    if (normalizeVariantVer(branch[tubeRef]) === removedVer) branch[tubeRef] = fallback;
  });
  applyProcedureVariantMachinesToMachines(proc);
  renderProcedureEditor();
  if (typeof toast === "function") toast(`Variante ${label} supprimée`);
}

function gatherProcedureEditForm() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  const titleInp = $("procEditTitleInp");
  const introInp = $("procEditIntroInp");
  const orderInp = $("procEditOrderInp");
  if (titleInp) proc.title = titleInp.value.trim() || proc.title;
  if (introInp) {
    const intro = introInp.value.trim();
    if (intro) proc.printIntro = intro;
    else delete proc.printIntro;
  }
  if (orderInp) proc.order = +orderInp.value || proc.order || 999;

  const stepEls = [...document.querySelectorAll(".proc-edit-step")];
  const prevSteps = proc.steps || [];
  proc.steps = stepEls.map((el, i) => {
    const text = el.querySelector(".proc-edit-step-text")?.value ?? "";
    const step = { text };
    const prev = prevSteps[i] || {};
    const media = [...ensureStepMedia(prev)];
    el.querySelectorAll(".proc-edit-photo-card").forEach((card, pi) => {
      if (!media[pi]) return;
      const pathInp = card.querySelector(".proc-edit-photo-path");
      if (pathInp) {
        const v = pathInp.value.trim();
        if (v) media[pi].src = v;
      }
    });
    applyMediaToStep(step, media);
    return step;
  });

  document.querySelectorAll("[data-dim-scope=default]").forEach((inp) => {
    const stepKey = inp.dataset.stepKey;
    const dimKey = inp.dataset.dimKey;
    const stepIndex = parseInt(stepKey.slice(1), 10) - 1;
    const v = inp.value.trim();
    if (!proc.steps[stepIndex]) return;
    if (!proc.steps[stepIndex].dims) proc.steps[stepIndex].dims = {};
    if (v) proc.steps[stepIndex].dims[dimKey] = v;
    else delete proc.steps[stepIndex].dims[dimKey];
    if (!Object.keys(proc.steps[stepIndex].dims).length) delete proc.steps[stepIndex].dims;
  });
  if ($("procFicheDocRef") && typeof gatherProcedureFicheFromForm === "function") gatherProcedureFicheFromForm(proc);
  gatherProcedureFrigoLinkFromForm(proc);
  gatherProcedureVariantsFromForm(proc);
  stepEls.forEach((el, i) => {
    el.querySelectorAll(".proc-edit-step-dim-inp").forEach((inp) => {
      const varI = +(inp.dataset.varI ?? 0);
      setStepDimInProc(proc, i, inp.dataset.procDimKey, inp.value.trim(), varI);
    });
    if (!procedureUsesVariants(proc)) {
      const dims = {};
      el.querySelectorAll(".proc-edit-step-dim-inp").forEach((inp) => {
        const v = inp.value.trim();
        if (v) dims[inp.dataset.procDimKey] = v;
      });
      if (Object.keys(dims).length) proc.steps[i].dims = dims;
    }
  });
  gatherProcedureVariantMachinesFromForm(proc);
  applyProcedureVariantMachinesToMachines(proc);
}

function applyProcedureEditMachineDims() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  machinesInGamme(d.gammeCode).forEach((m, mi) => {
    document.querySelectorAll(`[data-dim-scope=machine][data-mi="${mi}"]`).forEach((inp) => {
      const stepKey = inp.dataset.stepKey;
      const dimKey = inp.dataset.dimKey;
      const stepIndex = parseInt(stepKey.slice(1), 10) - 1;
      const def = stepDimDefault(proc.steps[stepIndex], dimKey);
      setMachineProcDim(m, proc.id, stepKey, dimKey, inp.value.trim(), def);
    });
    cleanupMachineProcDims(m, proc.id);
  });
}

function renderProcedureEditor() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  const gam = gammeByCode(d.gammeCode);
  const cat = getProcedureCatalog(d.gammeCode);
  const sharedGammes = procedureCatalogGammeCodes(cat);
  const sharedLabel = sharedGammes.length > 1
    ? sharedGammes.map((c) => escHtml(gammeByCode(c)?.nom || `Gamme ${c}`)).join(" · ")
    : escHtml(gam?.nom || "—");
  const nbMachinesGamme = machinesInGamme(d.gammeCode).length;
  ensureProcFiche(proc, gam);
  $("procedureEditHead").textContent = `Édition · ${proc.title}`;
  $("procedureEditBody").innerHTML = `<div class="proc-edit-form">
    <div class="proc-edit-gamme-banner hint">
      ${sharedGammes.length > 1 ? "Catalogue partagé" : "Gamme"} <b>${sharedLabel}</b>
      ${sharedGammes.length > 1 ? "" : ` <span class="mono">(${d.gammeCode})</span>`}
      · ${nbMachinesGamme} machine${nbMachinesGamme !== 1 ? "s" : ""} dans la gamme courante
      · ${(state.machines || []).length} au total
      ${proc.tubeRef ? ` · tube <span class="mono">${escHtml(proc.tubeRef)}</span>` : ""}
    </div>
    <label class="subhead">Titre</label>
    <input type="text" id="procEditTitleInp" class="mono" value="${escVal(proc.title)}">
    <label class="subhead">Introduction (note mode opératoire §6)</label>
    <textarea id="procEditIntroInp" rows="2" placeholder="Affichée dans la note du §6 si mesures variables">${escHtml(proc.printIntro || "")}</textarea>
    <label class="subhead">Ordre d'affichage</label>
    <input type="number" id="procEditOrderInp" class="mono" style="max-width:96px" value="${proc.order ?? 999}">
    ${renderProcedureFrigoLinkEditor(proc, d.gammeCode)}
    <h4 class="subhead" style="margin-top:18px">Étapes &amp; texte</h4>
    <p class="hint proc-edit-steps-hint">Sous chaque étape : puces <span class="mono">L</span> · <span class="mono">diam</span> · <span class="mono">ep</span> · <span class="mono">angle</span> pour insérer une variable, puis tableau de cotes (synchronisé avec le tableau variantes en bas).</p>
    <div id="procEditSteps">${renderProcedureEditSteps(proc)}</div>
    <button type="button" class="btn-soft" onclick="procedureEditAddStep()">+ Ajouter une étape</button>
    <details class="proc-edit-fiche-fold" style="margin-top:22px">
      <summary class="subhead proc-edit-fiche-summary">Fiche atelier (impression A4)</summary>
      <div id="procFicheEditHost">${renderProcedureFicheEditor(proc, gam)}</div>
    </details>
    <h4 class="subhead" style="margin-top:22px">Variantes, cotes &amp; machines <span class="mono">${escVal(proc.tubeRef || "—")}</span></h4>
    <p class="hint">Cotes par version de tube · cochez en bas les machines concernées pour chaque version (synchronisé avec le schéma frigo de chaque machine).</p>
    <div id="procEditDims">${renderProcedureVariantsTableHtml(proc, { mode: "edit", gammeCode: d.gammeCode })}</div>
    <button type="button" class="btn-ghost" onclick="procedureEditRefreshDimsTable()">↻ Actualiser le tableau variantes</button>
    <input type="file" id="procEditPhotoFileInput" accept="image/*" hidden onchange="onProcEditPhotoFileChange(event)">
    <input type="file" id="procEditPhotoCameraInput" accept="image/*" capture="environment" hidden onchange="onProcEditPhotoFileChange(event)">
  </div>`;
  ensureProcedureEditDimSync();
  ensureProcAnnotSync();
  (proc.steps || []).forEach((_, i) => refreshProcedureEditStepDims(i));
}

function openProcedureEditor(gammeCode, procId) {
  if (!procedureEditAllowed()) {
    toast("Édition réservée aux techniciens et administrateurs OEDIP");
    return;
  }
  const cat = getProcedureCatalog(gammeCode);
  const proc = cat?.procedures?.find((p) => p.id === procId);
  if (!proc) return;
  procedureEditDraft = { gammeCode: +gammeCode, procId, proc: JSON.parse(JSON.stringify(proc)) };
  (procedureEditDraft.proc.steps || []).forEach((s) => { s._media = normalizeStepMedia(s); });
  ensureProcedureVariantMachines(procedureEditDraft.proc, +gammeCode);
  ensureProcFiche(procedureEditDraft.proc, gammeByCode(+gammeCode));
  renderProcedureEditor();
  $("modalProcedureEdit")?.classList.add("show");
}

function closeProcedureEditor() {
  $("modalProcedureEdit")?.classList.remove("show");
  procedureEditDraft = null;
}

function saveProcedureEditor() {
  if (!procedureEditDraft) return;
  if (!procedureEditAllowed()) {
    toast("Édition réservée aux techniciens et administrateurs OEDIP");
    return;
  }
  gatherProcedureEditForm();
  const d = procedureEditDraft;
  const cat = getProcedureCatalog(d.gammeCode);
  const idx = cat?.procedures?.findIndex((p) => p.id === d.procId);
  if (idx < 0) return;
  cat.procedures[idx] = d.proc;
  closeProcedureEditor();
  renderProceduresTab();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  if (typeof sbCanEditReference === "function" && sbCanEditReference() && sbCloudActive()) {
    toast("Procédure enregistrée · publication cloud…");
  } else if (typeof sbCanEditReference === "function" && sbCanEditReference()) {
    toast("Procédure enregistrée localement — reconnectez ☁ Cloud pour publier");
  } else {
    toast("Procédure enregistrée localement");
  }
}

function procedureEditAddStep() {
  gatherProcedureEditForm();
  if (!procedureEditDraft) return;
  procedureEditDraft.proc.steps.push({ text: "", _media: [] });
  renderProcedureEditor();
}

function procedureEditRemoveStep(i) {
  if (!procedureEditDraft) return;
  if (!confirm("Supprimer cette étape ?")) return;
  gatherProcedureEditForm();
  procedureEditDraft.proc.steps.splice(i, 1);
  renderProcedureEditor();
}

function procedureEditMoveStep(i, dir) {
  if (!procedureEditDraft) return;
  gatherProcedureEditForm();
  const steps = procedureEditDraft.proc.steps;
  const j = i + dir;
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  renderProcedureEditor();
}

function procedureEditRefreshDimsTable() {
  gatherProcedureEditForm();
  const el = $("procEditDims");
  if (el && procedureEditDraft) {
    el.innerHTML = renderProcedureVariantsTableHtml(procedureEditDraft.proc, {
      mode: "edit",
      gammeCode: procedureEditDraft.gammeCode,
    });
  }
}

function findProceduresForTarget(_gammeCode, target) {
  if (!target) return [];
  const out = [];
  const seen = new Set();
  allProcedureEntries().forEach(({ proc }) => {
    if (seen.has(proc.id)) return;
    if (procedureMatchesTarget(proc, target)) {
      seen.add(proc.id);
      out.push(proc);
    }
  });
  return out.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function procedureSchemaBtn(pac, target) {
  const m = machineByPac(pac);
  const procs = findProceduresForTarget(m?.gammeCode, target);
  if (!procs.length) return "";
  const pacAttr = escAttr(pac);
  const typeAttr = escAttr(target.type);
  const idAttr = escAttr(target.pipeId || target.role || "");
  return `<button type="button" class="schema-proc-btn" title="Procédure (${procs.length})" onclick="openProcedureFromSchema('${pacAttr}','${typeAttr}','${idAttr}')">📋</button>`;
}

function openProcedureFromSchema(pac, type, id) {
  const target = type === "pipe" ? { type: "pipe", pipeId: id } : { type: "role", role: id };
  const m = machineByPac(pac);
  const procs = findProceduresForTarget(m?.gammeCode, target);
  if (!procs.length) {
    toast("Aucune procédure pour cet élément");
    return;
  }
  if (procs.length === 1) openProcedureViewer(procs[0].id, pac);
  else showProcedurePicker(procs, pac);
}

function showProcedurePicker(procs, pac) {
  const list = procs.map((p) =>
    `<button type="button" class="btn-soft proc-pick-btn" onclick="closeProcedurePicker();openProcedureViewer('${escAttr(p.id)}','${escAttr(pac)}')">${escHtml(p.title)}</button>`
  ).join("");
  const m = $("modalProcedurePicker");
  if (!m) {
    openProcedureViewer(procs[0].id, pac);
    return;
  }
  $("procedurePickerList").innerHTML = list;
  $("procedurePickerTitle").textContent = machineByPac(pac)?.pac || pac;
  m.classList.add("show");
}
function closeProcedurePicker() { $("modalProcedurePicker")?.classList.remove("show"); }

function openProcedureViewer(procedureId, pac) {
  const entry = findProcedureEntry(procedureId);
  if (!entry) return;
  const proc = entry.proc;
  const m = machineByPac(pac);
  const ctx = buildMachineProcContext(pac);
  $("procedureModalTitle").textContent = proc.title;
  $("procedureModalSub").textContent = (() => {
    const v = getMachineTubeVariantVer(m, proc.tubeRef);
    const ref = proc.tubeRef ? getProcedureVariant(proc, v)?.ref || `${proc.tubeRef}-${v}` : "";
    return `${ctx.pac} · ${ctx.gamme.nom}${ref ? ` · ${ref}` : ""}`;
  })();
  $("procedureModalBody").innerHTML = renderProcedureBodyHtml(proc, ctx);
  $("modalProcedure")?.classList.add("show");
}
function closeProcedureViewer() { $("modalProcedure")?.classList.remove("show"); }

function procedureStepImagesBlock(step) {
  const list = normalizeStepMedia(step);
  if (!list.length) return "";
  const figures = list.map((item, i) => {
    const inner = renderProcMediaStack(item, { uid: `v${i}`, loading: true });
    return `<figure class="proc-step-img">${inner}</figure>`;
  }).join("");
  const multi = list.length > 1 ? " proc-step-imgs-multi" : "";
  return `<div class="proc-step-imgs${multi}">${figures}</div>`;
}

function renderProcedureStepContent(step, text) {
  const imgs = procedureStepImagesBlock(step);
  const para = text ? `<p class="proc-step-text">${escHtml(text)}</p>` : "";
  return `${para}${imgs}`;
}

function renderProcedureStepHtml(step, ctx, proc, stepIndex) {
  const dims = proc != null && stepIndex != null ? mergedStepDims(proc, step, stepIndex, ctx) : {};
  const text = resolveProcedureText(step.text || "", ctx, dims);
  return `<li class="proc-step">${renderProcedureStepContent(step, text)}</li>`;
}

function renderProcedureBodyHtml(proc, ctx) {
  const steps = (proc.steps || []).map((s, i) => renderProcedureStepHtml(s, ctx, proc, i)).join("");
  return `<ol class="proc-steps">${steps || "<li>Aucune étape.</li>"}</ol>`;
}

function defaultGammeTableColumns(proc) {
  const t = proc.target || {};
  if (t.type === "pipe" && t.pipeId) {
    return [
      { key: "pac", label: "Machine" },
      { key: `pipe.${t.pipeId}.diamMm`, label: "Ø mm" },
      { key: `pipe.${t.pipeId}.longM`, label: "L m" }
    ];
  }
  if (t.type === "role" && t.role) {
    return [
      { key: "pac", label: "Machine" },
      { key: `comp.${t.role}.ref`, label: "Réf." },
      { key: `comp.${t.role}.modele`, label: "Modèle" }
    ];
  }
  return [{ key: "pac", label: "Machine" }];
}

function renderGammeTableHtml(proc, gammeCode) {
  const cols = (proc.gammeTable && proc.gammeTable.length)
    ? proc.gammeTable.map((c) => (typeof c === "string" ? { key: c, label: c } : c))
    : defaultGammeTableColumns(proc);
  const machines = machinesInGamme(gammeCode);
  if (!machines.length) return `<p class="hint">Aucune machine dans cette gamme.</p>`;
  const head = cols.map((c) => `<th>${escHtml(c.label || c.key)}</th>`).join("");
  const rows = machines.map((m) => {
    const ctx = buildMachineProcContext(m.pac);
    return `<tr>${cols.map((c) => `<td class="mono">${escHtml(procPathValue(ctx, c.key))}</td>`).join("")}</tr>`;
  }).join("");
  return `<table class="proc-gamme-tbl"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function printAllProcedures() {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Autorisez les fenêtres popup pour imprimer.");
    return;
  }
  const html = typeof buildAllProceduresPrintDocument === "function"
    ? buildAllProceduresPrintDocument()
    : buildGammePrintDocument(state.gammes[0]?.code);
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function procedureAllMedia(proc) {
  const out = [];
  (proc.steps || []).forEach((s) => ensureStepMedia(s).forEach((m) => { if (m.src) out.push(m); }));
  return out;
}

function procedureCoverMedia(proc) {
  const all = procedureAllMedia(proc);
  return all.length ? all[all.length - 1] : null;
}

function procedureRefPattern(proc) {
  if (proc.tubeRef) return `${proc.tubeRef}-xx`;
  const id = proc.id || "";
  if (id.startsWith("geo-annex-")) return id.replace("geo-annex-", "ANN-").toUpperCase();
  if (id.startsWith("geo-")) return id.replace("geo-", "").toUpperCase();
  return id.toUpperCase() || "—";
}

function procedureShortName(proc) {
  const t = proc.title || "";
  return t.replace(/^Tube \d+ — /, "").trim() || t || "—";
}

function renderProcedureCoverHtml(proc) {
  const cover = procedureCoverMedia(proc);
  if (!cover?.src) {
    return `<div class="proc-gallery-ph"><span>${proc.tubeNum ? `T${proc.tubeNum}` : "📋"}</span></div>`;
  }
  return renderProcMediaStack(cover, { uid: "cover", wrapperClass: "proc-gallery-img-inner" });
}

let procGalleryReorderMode = false;
let procGalleryDragSrc = null;

function exitProcGalleryReorderMode() {
  if (!procGalleryReorderMode) return;
  procGalleryReorderMode = false;
  procGalleryDragSrc = null;
  $("procReorderBtn")?.classList.remove("active");
  $("v-procedures")?.classList.remove("proc-reorder-mode");
}

function toggleProcGalleryReorder() {
  if (!procedureEditAllowed()) {
    toast("Connectez-vous en technicien ou administrateur");
    return;
  }
  const filter = getProcFilter();
  if (filter.gammeCode || filter.machines.length) {
    toast("Effacez les filtres pour réorganiser la galerie");
    return;
  }
  procGalleryReorderMode = !procGalleryReorderMode;
  $("procReorderBtn")?.classList.toggle("active", procGalleryReorderMode);
  $("v-procedures")?.classList.toggle("proc-reorder-mode", procGalleryReorderMode);
  renderProceduresTab();
  if (procGalleryReorderMode) toast("Glissez les fiches pour modifier l'ordre");
}

function applyProcGalleryOrderFromDom() {
  const cards = [...document.querySelectorAll("#procList .proc-gallery-card-draggable")];
  const touchedGammes = new Set();
  cards.forEach((card, i) => {
    const code = +card.dataset.gammeCode;
    const id = card.dataset.procId;
    const proc = getProcedureCatalog(code)?.procedures?.find((p) => p.id === id);
    if (proc) {
      proc.order = (i + 1) * 10;
      touchedGammes.add(code);
    }
  });
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else if (typeof markDirty === "function") markDirty();
  toast(typeof sbCanEditReference === "function" && sbCanEditReference() && sbCloudActive()
    ? "Ordre enregistré · publication cloud…"
    : "Ordre enregistré");
}

function ensureProcGalleryDragSync() {
  const list = $("procList");
  if (!list || list.dataset.procDragBound) return;
  list.dataset.procDragBound = "1";
  list.addEventListener("dragstart", (e) => {
    if (!procGalleryReorderMode) return;
    const card = e.target.closest(".proc-gallery-card-draggable");
    if (!card) {
      e.preventDefault();
      return;
    }
    procGalleryDragSrc = card;
    card.classList.add("proc-gallery-card-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.procId || "");
  });
  list.addEventListener("dragend", () => {
    procGalleryDragSrc?.classList.remove("proc-gallery-card-dragging");
    procGalleryDragSrc = null;
    list.querySelectorAll(".proc-gallery-card-drop-target").forEach((el) => {
      el.classList.remove("proc-gallery-card-drop-target", "proc-gallery-card-drop-before", "proc-gallery-card-drop-after");
    });
  });
  list.addEventListener("dragover", (e) => {
    if (!procGalleryReorderMode || !procGalleryDragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const card = e.target.closest(".proc-gallery-card-draggable");
    list.querySelectorAll(".proc-gallery-card-drop-target").forEach((el) => {
      el.classList.remove("proc-gallery-card-drop-target", "proc-gallery-card-drop-before", "proc-gallery-card-drop-after");
    });
    if (card && card !== procGalleryDragSrc) {
      const rect = card.getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      card.classList.add("proc-gallery-card-drop-target", before ? "proc-gallery-card-drop-before" : "proc-gallery-card-drop-after");
    }
  });
  list.addEventListener("drop", (e) => {
    if (!procGalleryReorderMode || !procGalleryDragSrc) return;
    e.preventDefault();
    const target = e.target.closest(".proc-gallery-card-draggable");
    if (!target || target === procGalleryDragSrc) return;
    const gallery = list.querySelector(".proc-gallery");
    if (!gallery) return;
    const rect = target.getBoundingClientRect();
    const before = e.clientX < rect.left + rect.width / 2;
    if (before) gallery.insertBefore(procGalleryDragSrc, target);
    else gallery.insertBefore(procGalleryDragSrc, target.nextSibling);
    target.classList.remove("proc-gallery-card-drop-target", "proc-gallery-card-drop-before", "proc-gallery-card-drop-after");
    applyProcGalleryOrderFromDom();
  });
}

function renderProceduresTab() {
  const list = $("procList");
  if (!list) return;
  const filter = getProcFilter();
  const filterActive = !!(filter.gammeCode || filter.machines.length);
  const canEdit = procedureEditAllowed();
  const entries = galleryProcedureEntries().sort((a, b) => {
    const oa = a.proc.order ?? 999;
    const ob = b.proc.order ?? 999;
    if (oa !== ob) return oa - ob;
    const pa = a.proc.tubePartNum ?? 999;
    const pb = b.proc.tubePartNum ?? 999;
    if (pa !== pb) return pa - pb;
    return a.catalogGammeCode - b.catalogGammeCode;
  });
  const filtered = entries.filter(({ proc, catalogGammeCode, catalogGammeCodes }) =>
    procedureMatchesProcFilter(proc, catalogGammeCode, filter, catalogGammeCodes)
  );
  const reorder = procGalleryReorderMode && canEdit && !filterActive;
  const showing = reorder ? entries : filtered;
  const countEl = $("procFilterCount");
  if (countEl) {
    countEl.textContent = filterActive
      ? `${filtered.length} / ${entries.length} procédure${entries.length !== 1 ? "s" : ""}`
      : `${entries.length} procédure${entries.length !== 1 ? "s" : ""}`;
  }
  if (!entries.length) {
    list.innerHTML = `<div class="empty proc-empty-create">
      <p>Aucune procédure enregistrée.</p>
      ${canEdit ? `<button type="button" class="btn-heat" onclick="openNewProcedureModal()">+ Nouvelle procédure</button>` : `<p class="hint">Connectez-vous en technicien ou administrateur pour en créer.</p>`}
    </div>`;
    return;
  }
  if (!showing.length) {
    list.innerHTML = `<div class="empty proc-empty-create">
      <p>Aucune procédure ne correspond aux filtres.</p>
      <button type="button" class="btn-ghost" onclick="clearProcFilter()">Effacer les filtres</button>
    </div>`;
    return;
  }
  const reorderHint = reorder
    ? `<p class="hint proc-reorder-hint noprint">Mode réorganisation — glissez les fiches. <button type="button" class="btn-ghost" onclick="toggleProcGalleryReorder()">Terminer</button></p>`
    : "";
  list.innerHTML = `${reorderHint}<div class="proc-gallery">${showing.map(({ proc: p, catalogGammeCode: code, catalogGammeCodes: gamCodes }) => {
    const previewPac = procedurePreviewPac(p, code, { preferPacs: filter.machines });
    const pacAttr = previewPac ? escAttr(previewPac) : "";
    const idAttr = escAttr(p.id);
    const link = procedureLinkSummary(p, code);
    const onPreview = !reorder && previewPac
      ? `onclick="openProcedureViewer('${idAttr}','${pacAttr}')"`
      : !reorder && canEdit
        ? `onclick="openProcedureEditor(${code},'${idAttr}')" title="Aucune machine — ouverture en édition"`
        : "";
    const dragAttrs = reorder
      ? `class="proc-gallery-card proc-gallery-card-draggable" draggable="true" data-proc-id="${idAttr}" data-gamme-code="${code}"`
      : `class="proc-gallery-card" ${onPreview}`;
    return `<article ${dragAttrs}>
      ${reorder ? `<span class="proc-gallery-drag-handle noprint" title="Glisser pour réordonner">⠿</span>` : ""}
      <div class="proc-gallery-cover">${renderProcedureCoverHtml(p)}
        ${renderProcedureGalleryGammes(p, code, gamCodes)}
        <div class="proc-gallery-actions noprint" onclick="event.stopPropagation()">
          ${!reorder && canEdit ? `<button type="button" class="btn-heat" onclick="openProcedureEditor(${code},'${idAttr}')">Édition</button>` : ""}
          ${!reorder && canEdit ? `<button type="button" class="btn-ghost proc-del-btn" onclick="deleteProcedure(${code},'${idAttr}')">Supprimer</button>` : ""}
          ${!reorder ? `<button type="button" class="btn-soft" onclick="printSingleProcedure(${code},'${idAttr}')">🖶</button>` : ""}
          ${!reorder && previewPac ? `<button type="button" class="btn-soft" onclick="openProcedureViewer('${idAttr}','${pacAttr}')">Aperçu</button>` : ""}
        </div>
      </div>
      <div class="proc-gallery-meta">
        <h3 class="proc-gallery-ref mono">${escHtml(procedureRefPattern(p))}${p.tubePartNum >= 1 ? `<span class="proc-gallery-part"> · P${p.tubePartNum}</span>` : ""}</h3>
        <p class="proc-gallery-name">${escHtml(procedureShortName(p))}</p>
        ${link ? `<p class="proc-gallery-link hint">${escHtml(link)}</p>` : ""}
      </div>
    </article>`;
  }).join("")}</div>`;
  ensureProcGalleryDragSync();
}

function initProceduresTab() {
  ensureProcedureCatalogPhotos();
  migrateProcedureCatalogSharing();
  state.procedureCatalogs.forEach(migrateProcedureCatalogVariants);
  ensureProcedureEditDimSync();
  ensureProcAnnotSync();
  fillProcFilterControls();
  ensureProcFilterSync();
  updateProcedureAdminUI();
  renderProceduresTab();
}

function editFrigoTubeVariant(pac, tubeRef, ver) {
  const m = machineByPac(pac);
  if (!m || !tubeRef) return;
  ensureFrigoTubeVariants(m)[tubeRef] = normalizeVariantVer(ver);
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
}

function renderFrigoTubeVariantsTable(pac) {
  const m = machineByPac(pac);
  if (!m) return "";
  const procs = tubeProceduresForMachine(m);
  if (!procs.length) return "";
  ensureFrigoTubeVariants(m);
  const pacAttr = escAttr(pac);
  const rows = procs.map((p) => {
    const cur = getMachineTubeVariantVer(m, p.tubeRef);
    const opts = (p.variants?.length ? p.variants : [{ ver: "01", ref: `${p.tubeRef}-01` }]).map((v) => {
      const ver = normalizeVariantVer(v.ver);
      const ref = v.ref || `${p.tubeRef}-${ver}`;
      return `<option value="${escVal(ver)}"${ver === cur ? " selected" : ""}>${escHtml(ref)}</option>`;
    }).join("");
    return `<tr>
      <td class="mono">${escHtml(p.tubeRef)}</td>
      <td>${escHtml(p.title.replace(/^Tube \d+ — /, ""))}</td>
      <td><select class="mono schema-tube-var-sel" onchange="editFrigoTubeVariant('${pacAttr}','${escAttr(p.tubeRef)}',this.value)">${opts}</select></td>
      <td class="schema-pipe-proc"><button type="button" class="schema-proc-btn" title="Procédure" onclick="openProcedureViewer('${escAttr(p.id)}','${pacAttr}')">📋</button></td>
    </tr>`;
  }).join("");
  return `<div class="schema-pipes-wrap schema-tube-vars-wrap">
    <div class="schema-pipes-head">Versions tubes atelier</div>
    <table class="schema-pipes-tbl proc-variants-tbl">
      <thead><tr><th>Réf.</th><th>Tronçon</th><th>Version machine</th><th>Proc.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

$("modalProcedure")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedure") closeProcedureViewer(); });
$("modalProcedurePicker")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedurePicker") closeProcedurePicker(); });
$("modalProcedureEdit")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedureEdit") closeProcedureEditor(); });
$("modalProcedureNew")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedureNew") closeNewProcedureModal(); });
