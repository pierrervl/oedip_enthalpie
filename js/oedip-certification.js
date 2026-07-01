/* OEDIP — Certification : EPREL & dossiers FDES */
let CERT_SUBVIEW = "eprel";
let EPREL_EDIT_IDX = null;

function ensureCertification() {
  if (!Array.isArray(state.eprelFiches)) state.eprelFiches = [];
  if (!Array.isArray(state.fdesDossiers)) state.fdesDossiers = [];
}

function nextEprelId() {
  return "eprel_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function nextFdesDossierId() {
  return "fdes_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function eprelForMachine(pac) {
  ensureCertification();
  return state.eprelFiches.find((f) => (f.machines || []).includes(pac)) || null;
}

function machinesLinkedToEprel(excludeIdx) {
  const set = new Set();
  state.eprelFiches.forEach((f, i) => {
    if (i === excludeIdx) return;
    (f.machines || []).forEach((pac) => set.add(pac));
  });
  return set;
}

function initCertificationTab() {
  ensureCertification();
  renderCertTabs();
  renderCertPanel();
}

function setCertSubView(v) {
  CERT_SUBVIEW = v;
  EPREL_EDIT_IDX = null;
  renderCertTabs();
  renderCertPanel();
}

function renderCertTabs() {
  const el = $("certTabs");
  if (!el) return;
  el.innerHTML = `
    <button type="button" class="comp-tab${CERT_SUBVIEW === "eprel" ? " on" : ""}" onclick="setCertSubView('eprel')">🏷 EPREL</button>
    <button type="button" class="comp-tab${CERT_SUBVIEW === "fdes" ? " on" : ""}" onclick="setCertSubView('fdes')">📋 FDES produit</button>`;
}

function renderCertPanel() {
  const el = $("certPanel");
  if (!el) return;
  el.innerHTML = CERT_SUBVIEW === "eprel" ? renderEprelPanel() : renderFdesPanel();
}

/* ---------- EPREL ---------- */

function emptyEprelFiche() {
  return {
    id: nextEprelId(),
    registrationNumber: "",
    brand: "",
    modelIdentifier: "",
    productGroup: "space_heater",
    eprelProductGroup: "",
    energyClass: "",
    etaSeasonalPct: null,
    etaS30Avg: null,
    etaS55Avg: null,
    energyClass55: "",
    soundPowerDb: null,
    ratedHeatOutputKw: null,
    url: "",
    machines: [],
    notes: "",
  };
}

const EPREL_API = "https://eprel.ec.europa.eu/api/product/";

function parseEprelNumberList(text) {
  return [...new Set(
    String(text || "")
      .split(/[\s,;\n\r\t]+/)
      .map((s) => s.trim().replace(/\D/g, ""))
      .filter(Boolean)
  )];
}

function eprelScreenUrl(data) {
  const pg = (data.productGroup || "product").toLowerCase();
  const reg = data.eprelRegistrationNumber || data.registrationNumber || "";
  return `https://eprel.ec.europa.eu/screen/product/${pg}/${reg}`;
}

function mapEprelProductGroup(apiGroup) {
  const g = String(apiGroup || "").toLowerCase();
  if (g.includes("water")) return "water_heater";
  if (g.includes("space") || g.includes("heat") || g.includes("package") || g.includes("boiler")) return "space_heater";
  return "other";
}

function pickFirstEprelNum(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && v !== "" && Number.isFinite(+v)) return +v;
  }
  return null;
}

function mapEprelApiToFiche(data) {
  const reg = String(data.eprelRegistrationNumber || "");
  const meta = [
    data.productGroup ? `Groupe EPREL : ${data.productGroup}` : "",
    data.implementingAct ? `Acte : ${data.implementingAct}` : "",
    data.status ? `Statut : ${data.status}` : "",
    data.spaceHeaterType ? `Type : ${data.spaceHeaterType}` : "",
  ].filter(Boolean).join(" · ");
  return {
    ...emptyEprelFiche(),
    registrationNumber: reg,
    brand: data.supplierOrTrademark || data.trademarkOwner || "",
    modelIdentifier: data.modelIdentifier || "",
    productGroup: mapEprelProductGroup(data.productGroup),
    eprelProductGroup: data.productGroup || "",
    energyClass: data.energyClass || data.packageEnergyClass || data.waterHeatingEnergyClass || "",
    etaSeasonalPct: pickFirstEprelNum(data, [
      "seasonalSpaceHeatingEnergyEfficiencyAverage35",
      "seasonalHeatingEnergyEfficiency",
      "packageSeasonalSpaceHeatingEfficiency",
      "seasonalSpaceHeatingEnergyEfficiency",
      "packageSeasonalSpaceHeatingEfficiencyWarm",
      "waterHeatingEfficiency",
      "waterHeatingEnergyEfficiencyAverage",
    ]),
    etaS30Avg: pickFirstEprelNum(data, ["seasonalSpaceHeatingEnergyEfficiencyAverage35"]),
    etaS55Avg: pickFirstEprelNum(data, ["seasonalSpaceHeatingEnergyEfficiencyAverage55"]),
    energyClass55: data.energyClass55 || "",
    soundPowerDb: pickFirstEprelNum(data, [
      "noise",
      "outdoorNoise",
      "soundPowerLevel",
      "soundPowerLevelIndoor",
      "soundPowerLevelOutdoor",
      "soundPower",
      "soundLevel",
    ]),
    ratedHeatOutputKw: pickFirstEprelNum(data, [
      "ratedHeatOutput",
      "heatOutput",
      "nominalHeatOutput",
      "ratedOutputPowerHeat",
      "heatCapNominal",
      "heatCapacity",
      "ratedCapacity",
    ]),
    url: eprelScreenUrl(data),
    notes: meta,
  };
}

async function fetchEprelProduct(regNum) {
  const n = String(regNum).trim().replace(/\D/g, "");
  if (!n) throw new Error("Numéro EPREL invalide");
  const res = await fetch(EPREL_API + n);
  if (!res.ok) {
    let msg = "Fiche introuvable";
    try {
      const err = await res.json();
      msg = err.message || msg;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

async function importEprelNumbers(text) {
  const nums = parseEprelNumberList(text);
  if (!nums.length) {
    alert("Aucun numéro EPREL détecté.");
    return { ok: [], updated: [], err: [] };
  }
  ensureCertification();
  const results = { ok: [], updated: [], err: [] };
  for (const n of nums) {
    try {
      const data = await fetchEprelProduct(n);
      const fiche = mapEprelApiToFiche(data);
      const existing = state.eprelFiches.findIndex((f) => String(f.registrationNumber) === n);
      if (existing >= 0) {
        const prev = state.eprelFiches[existing];
        fiche.id = prev.id;
        fiche.machines = prev.machines || [];
        if (prev.notes && !fiche.notes.includes(prev.notes)) {
          fiche.notes = [fiche.notes, prev.notes].filter(Boolean).join("\n");
        }
        state.eprelFiches[existing] = fiche;
        results.updated.push(n);
      } else {
        state.eprelFiches.push(fiche);
        results.ok.push(n);
      }
    } catch (e) {
      results.err.push({ n, msg: e.message });
    }
  }
  markCatalogDirty?.();
  return results;
}

async function runEprelImport() {
  const ta = $("eprelImportNums");
  const btn = $("eprelImportBtn");
  const text = ta?.value || "";
  if (btn) { btn.disabled = true; btn.textContent = "Import en cours…"; }
  try {
    const r = await importEprelNumbers(text);
    const parts = [];
    if (r.ok.length) parts.push(r.ok.length + " fiche(s) importée(s)");
    if (r.updated.length) parts.push(r.updated.length + " mise(s) à jour");
    if (r.err.length) parts.push(r.err.length + " erreur(s)");
    toast(parts.join(" · ") || "Terminé");
    if (r.err.length) {
      alert("Erreurs EPREL :\n" + r.err.map((e) => e.n + " : " + e.msg).join("\n"));
    }
    if (ta && (r.ok.length || r.updated.length)) ta.value = "";
    renderCertPanel();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Importer depuis EPREL"; }
  }
}

async function fetchEprelIntoForm() {
  const n = $("eprelRegNum")?.value.trim();
  if (!n) { alert("Saisissez un numéro EPREL."); return; }
  const btn = $("eprelFetchBtn");
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const data = await fetchEprelProduct(n);
    const f = mapEprelApiToFiche(data);
    $("eprelRegNum").value = f.registrationNumber;
    $("eprelBrand").value = f.brand;
    $("eprelModel").value = f.modelIdentifier;
    $("eprelProductGroup").value = f.productGroup;
    $("eprelEnergyClass").value = f.energyClass;
    if ($("eprelEta30")) $("eprelEta30").value = f.etaS30Avg ?? f.etaSeasonalPct ?? "";
    if ($("eprelEta55")) $("eprelEta55").value = f.etaS55Avg ?? "";
    if ($("eprelEnergyClass55")) $("eprelEnergyClass55").value = f.energyClass55 || "";
    if ($("eprelSound")) $("eprelSound").value = f.soundPowerDb ?? "";
    if ($("eprelRatedKw")) $("eprelRatedKw").value = f.ratedHeatOutputKw ?? "";
    $("eprelUrl").value = f.url;
    if ($("eprelNotes") && f.notes) $("eprelNotes").value = f.notes;
    toast("Données EPREL récupérées");
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Récupérer EPREL"; }
  }
}

function renderEprelImportPanel() {
  return `<div class="panel blk-geo cert-import-panel" style="margin-bottom:16px">
    <div class="head"><h3>Import depuis le registre EPREL</h3></div>
    <div class="body">
      <p class="hint">Collez un ou plusieurs <b>numéros d'enregistrement EPREL</b> (un par ligne, ou séparés par des virgules). Les fiches sont créées sans lien machine — vous les associerez ensuite.</p>
      <textarea id="eprelImportNums" class="mono" rows="4" placeholder="1688125&#10;2222222" style="width:100%;margin-bottom:10px"></textarea>
      <button type="button" class="btn-heat" id="eprelImportBtn" onclick="runEprelImport()">Importer depuis EPREL</button>
    </div>
  </div>`;
}

function renderEprelPanel() {
  ensureCertification();
  const list = state.eprelFiches;
  const allPacs = (state.machines || []).map((m) => m.pac);
  const linked = new Set();
  list.forEach((f) => (f.machines || []).forEach((p) => linked.add(p)));
  const unlinked = allPacs.filter((p) => !linked.has(p));

  let editHtml = "";
  if (EPREL_EDIT_IDX != null) {
    const f = list[EPREL_EDIT_IDX] || emptyEprelFiche();
    const taken = machinesLinkedToEprel(EPREL_EDIT_IDX);
    const machineChks = (state.machines || []).map((m) => {
      const checked = (f.machines || []).includes(m.pac);
      const disabled = !checked && taken.has(m.pac);
      const gam = gammeByCode(m.gammeCode);
      return `<label class="cert-machine-chk${disabled ? " cert-machine-chk-dis" : ""}">
        <input type="checkbox" class="eprel-mach-cb" value="${escVal(m.pac)}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}>
        <span class="mono">${escHtml(m.pac)}</span>
        <span class="cert-machine-gamme">${escHtml(gam?.nom || "")}</span>
      </label>`;
    }).join("");
    editHtml = `<div class="panel blk-geo cert-edit-panel">
      <div class="head"><h3>${EPREL_EDIT_IDX < list.length ? "Modifier" : "Nouvelle"} fiche EPREL</h3></div>
      <div class="body cert-form-grid">
        <label><span>N° enregistrement EPREL</span>
          <div class="eprel-reg-row">
            <input type="text" id="eprelRegNum" class="mono" value="${escVal(f.registrationNumber)}" placeholder="Ex. 1688125">
            <button type="button" class="btn-soft" id="eprelFetchBtn" onclick="fetchEprelIntoForm()">Récupérer EPREL</button>
          </div>
        </label>
        <label><span>Marque</span><input type="text" id="eprelBrand" value="${escVal(f.brand)}"></label>
        <label><span>Modèle / identifiant</span><input type="text" id="eprelModel" value="${escVal(f.modelIdentifier)}"></label>
        <label><span>Groupe produit</span>
          <select id="eprelProductGroup">
            <option value="space_heater"${f.productGroup === "space_heater" ? " selected" : ""}>Chauffage d'appoint (space heater)</option>
            <option value="water_heater"${f.productGroup === "water_heater" ? " selected" : ""}>Chauffe-eau</option>
            <option value="other"${f.productGroup === "other" ? " selected" : ""}>Autre</option>
          </select>
        </label>
        <label><span>ηs climat moyen · 30/35 (%)</span><input type="number" id="eprelEta30" step="0.1" value="${f.etaS30Avg ?? f.etaSeasonalPct ?? ""}"></label>
        <label><span>ηs climat moyen · 47/55 (%)</span><input type="number" id="eprelEta55" step="0.1" value="${f.etaS55Avg ?? ""}"></label>
        <label><span>Classe énergie · 35°C</span><input type="text" id="eprelEnergyClass" value="${escVal(f.energyClass)}" placeholder="APPP, A++…"></label>
        <label><span>Classe énergie · 55°C</span><input type="text" id="eprelEnergyClass55" value="${escVal(f.energyClass55 || "")}" placeholder="APP, A…"></label>
        <label><span>Puissance acoustique (dB)</span><input type="number" id="eprelSound" step="0.1" value="${f.soundPowerDb ?? ""}"></label>
        <label><span>Puissance nominale (kW)</span><input type="number" id="eprelRatedKw" step="0.1" value="${f.ratedHeatOutputKw ?? ""}"></label>
        <label style="grid-column:1/-1"><span>URL fiche EPREL</span><input type="url" id="eprelUrl" value="${escVal(f.url)}" placeholder="https://eprel.ec.europa.eu/…"></label>
        <label style="grid-column:1/-1"><span>Notes</span><textarea id="eprelNotes" rows="2">${escHtml(f.notes || "")}</textarea></label>
        <div style="grid-column:1/-1">
          <span class="subhead">Machines liées</span>
          <div class="cert-machine-grid">${machineChks || '<span class="hint">Aucune machine dans le catalogue.</span>'}</div>
        </div>
        <div class="cert-form-actions" style="grid-column:1/-1">
          <button type="button" class="btn-ghost" onclick="cancelEprelEdit()">Annuler</button>
          <button type="button" class="btn-heat" onclick="saveEprelEdit()">Enregistrer</button>
        </div>
      </div>
    </div>`;
  }

  const cards = list.map((f, i) => {
    const nMach = (f.machines || []).length;
    const machTags = (f.machines || []).map((p) => `<span class="cert-tag mono">${escHtml(p)}</span>`).join("") || '<span class="hint">Aucune machine</span>';
    return `<div class="ccard cert-card">
      <div class="ccard-top"><h4>${escHtml(f.registrationNumber || f.modelIdentifier || "Sans n° EPREL")}</h4>
        ${f.energyClass ? `<span class="badge cert-badge-energy">${escHtml(f.energyClass)}</span>` : ""}</div>
      <div class="ccard-sub">${escHtml([f.brand, f.modelIdentifier].filter(Boolean).join(" · ") || "—")}</div>
      <div class="ccard-spec mono">${f.etaS30Avg != null ? "ηs 30/35 " + fmt(f.etaS30Avg, 0) + "%" : ""}${f.etaS55Avg != null ? " · 47/55 " + fmt(f.etaS55Avg, 0) + "%" : ""}${f.etaS30Avg == null && f.etaSeasonalPct != null ? "ηs " + fmt(f.etaSeasonalPct, 0) + "%" : ""} · ${nMach} machine${nMach !== 1 ? "s" : ""}</div>
      <div class="cert-tags">${machTags}</div>
      ${f.url ? `<a class="cert-link" href="${escVal(f.url)}" target="_blank" rel="noopener">Voir sur EPREL ↗</a>` : ""}
      <div class="ccard-acts">
        <button class="btn-soft" onclick="editEprelFiche(${i})">Modifier</button>
        <button class="btn-soft" style="color:var(--bad)" onclick="deleteEprelFiche(${i})">Supprimer</button>
      </div>
    </div>`;
  }).join("");

  return `${renderEprelImportPanel()}${editHtml}
    <div class="toolbar"><span class="grow"><b>Fiches EPREL</b> <span class="tag mono">${list.length}</span></span>
      <button class="btn-soft" onclick="editEprelFiche(-1)">+ Fiche EPREL</button></div>
    <p class="hint">Liez chaque fiche EPREL à une ou plusieurs machines de votre catalogue. Une machine ne peut être liée qu'à une seule fiche.</p>
    ${unlinked.length ? `<p class="hint cert-warn">Machines sans fiche EPREL : ${unlinked.map((p) => `<span class="mono">${escHtml(p)}</span>`).join(", ")}</p>` : ""}
    <div class="comp-grid">${cards || '<div class="empty" style="grid-column:1/-1">Aucune fiche EPREL — ajoutez la première fiche et liez-la à vos machines.</div>'}</div>`;
}

function editEprelFiche(idx) {
  EPREL_EDIT_IDX = idx;
  renderCertPanel();
}

function cancelEprelEdit() {
  EPREL_EDIT_IDX = null;
  renderCertPanel();
}

function readEprelForm() {
  const prev = EPREL_EDIT_IDX >= 0 && EPREL_EDIT_IDX < state.eprelFiches.length
    ? state.eprelFiches[EPREL_EDIT_IDX]
    : emptyEprelFiche();
  const machines = [...document.querySelectorAll(".eprel-mach-cb:checked")].map((cb) => cb.value);
  const numOrNull = (id) => {
    const v = $(id)?.value.trim();
    return v === "" ? null : +v;
  };
  return {
    ...prev,
    registrationNumber: $("eprelRegNum")?.value.trim() || "",
    brand: $("eprelBrand")?.value.trim() || "",
    modelIdentifier: $("eprelModel")?.value.trim() || "",
    productGroup: $("eprelProductGroup")?.value || "space_heater",
    energyClass: $("eprelEnergyClass")?.value.trim() || "",
    energyClass55: $("eprelEnergyClass55")?.value.trim() || "",
    etaSeasonalPct: numOrNull("eprelEta30"),
    etaS30Avg: numOrNull("eprelEta30"),
    etaS55Avg: numOrNull("eprelEta55"),
    soundPowerDb: numOrNull("eprelSound"),
    ratedHeatOutputKw: numOrNull("eprelRatedKw"),
    url: $("eprelUrl")?.value.trim() || "",
    machines,
    notes: $("eprelNotes")?.value.trim() || "",
  };
}

function saveEprelEdit() {
  const f = readEprelForm();
  if (EPREL_EDIT_IDX >= 0 && EPREL_EDIT_IDX < state.eprelFiches.length) {
    state.eprelFiches[EPREL_EDIT_IDX] = f;
  } else {
    state.eprelFiches.push(f);
  }
  EPREL_EDIT_IDX = null;
  markCatalogDirty?.();
  toast("Fiche EPREL enregistrée");
  renderCertPanel();
}

function deleteEprelFiche(i) {
  const f = state.eprelFiches[i];
  if (!confirm("Supprimer la fiche EPREL « " + (f.registrationNumber || f.modelIdentifier || "?") + " » ?")) return;
  state.eprelFiches.splice(i, 1);
  markCatalogDirty?.();
  renderCertPanel();
}

/* ---------- FDES dossier ---------- */

function resolveMachineBom(pac) {
  const m = machineByPac(pac);
  if (!m) return [];
  const liens = m.composantsLiens || {};
  return MACHINE_COMP_SLOTS.map((slot) => {
    const compId = liens[slot.role];
    const found = compId ? compFindById(compId) : null;
    const comp = found?.item || null;
    const fdes = comp ? ensureCompFdes(comp) : null;
    const acvTotal = fdes ? compFdesTotal(fdes) : null;
    return {
      role: slot.role,
      roleLabel: slot.label,
      compId: compId || null,
      compRef: comp?.ref || comp?.modele || "—",
      compType: slot.type,
      fabricant: comp?.fabricant || fdes?.fabricant || "",
      fournisseur: (typeof findFournisseurById === "function" && comp?.fournisseurId ? fournisseurLabel(findFournisseurById(comp.fournisseurId)) : "") || "",
      origine: fdes?.origine || "",
      poidsKg: fdes?.poidsKg ?? null,
      transportKm: fdes?.transportKm ?? null,
      transportMode: fdes?.transportMode || "",
      iniesRef: fdes?.iniesRef || "",
      acvA1A3: fdes?.acvA1A3 ?? null,
      acvA4: fdes?.acvA4 ?? null,
      acvA5: fdes?.acvA5 ?? null,
      acvC1C4: fdes?.acvC1C4 ?? null,
      acvTotal,
      status: !compId ? "missing" : acvTotal != null ? "ok" : "partial",
    };
  });
}

function buildFdesDossier(pac) {
  const m = machineByPac(pac);
  if (!m) return null;
  const gam = gammeByCode(m.gammeCode);
  const lines = resolveMachineBom(pac);
  const gwp = calcGwpImpact(m);
  const totals = {
    acvProduction: 0,
    acvTransport: 0,
    acvInstallation: 0,
    acvEndOfLife: 0,
    acvComponents: 0,
    refrigerantCo2eq: gwp?.co2eq ?? 0,
    grandTotal: 0,
    unit: "kgCO2eq",
  };
  lines.forEach((ln) => {
    if (ln.acvA1A3) totals.acvProduction += +ln.acvA1A3;
    if (ln.acvA4) totals.acvTransport += +ln.acvA4;
    if (ln.acvA5) totals.acvInstallation += +ln.acvA5;
    if (ln.acvC1C4) totals.acvEndOfLife += +ln.acvC1C4;
    if (ln.acvTotal) totals.acvComponents += +ln.acvTotal;
  });
  totals.grandTotal = totals.acvComponents + totals.refrigerantCo2eq;
  const missing = lines.filter((l) => l.status !== "ok").length;
  return {
    id: nextFdesDossierId(),
    pac,
    gammeCode: m.gammeCode,
    gammeNom: gam?.nom || "",
    title: "FDES — " + pac,
    status: missing ? "incomplete" : "draft",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    functionalUnit: "1 PAC · durée de vie 20 ans",
    lines,
    refrigerant: gwp ? { fluide: gwp.fluide, chargeKg: gwp.charge, gwp: gwp.gwp, co2eqKg: gwp.co2eq } : null,
    machineWeightKg: m.general?.dimensions?.poidsKg ?? null,
    totals,
    gaps: missing,
  };
}

function renderFdesPanel() {
  ensureCertification();
  const selPac = $("fdesMachineSel")?.value || "";
  let dossierHtml = "";
  if (selPac) {
    const dossier = buildFdesDossier(selPac);
    if (dossier) dossierHtml = renderFdesDossierView(dossier);
  }

  const opts = (state.machines || []).map((m) => {
    const gam = gammeByCode(m.gammeCode);
    return `<option value="${escVal(m.pac)}"${m.pac === selPac ? " selected" : ""}>${escHtml(m.pac)} — ${escHtml(gam?.nom || "")}</option>`;
  }).join("");

  const saved = state.fdesDossiers.filter((d) => !selPac || d.pac === selPac);

  return `<div class="toolbar">
      <label class="cert-fdes-sel-lbl">Machine
        <select id="fdesMachineSel" onchange="renderCertPanel()" style="min-width:220px">${opts || '<option value="">—</option>'}</select>
      </label>
      <span class="grow"></span>
      ${selPac ? `<button class="btn-soft" onclick="generateAndSaveFdesDossier('${escAttr(selPac)}')">💾 Enregistrer dossier</button>
        <button class="btn-soft" onclick="exportFdesDossierJson('${escAttr(selPac)}')">⤒ Export JSON</button>
        <button class="btn-soft" onclick="printFdesDossier('${escAttr(selPac)}')">🖶 Imprimer</button>` : ""}
    </div>
    <p class="hint">Le dossier FDES agrège l'impact carbone (ACV) de chaque composant lié à la machine. Renseignez les données FDES dans <b>Composants → FDES ACV</b> pour chaque pièce.</p>
    ${dossierHtml || '<div class="empty">Sélectionnez une machine pour générer le dossier FDES.</div>'}
    ${saved.length ? `<h4 class="subhead" style="margin-top:24px">Dossiers enregistrés</h4>
      <div class="comp-grid">${saved.map((d, i) => `<div class="ccard">
        <div class="ccard-top"><h4 class="mono">${escHtml(d.pac)}</h4><span class="badge">${escHtml(d.status || "draft")}</span></div>
        <div class="ccard-spec mono">${fmt(d.totals?.grandTotal ?? 0, 2)} kgCO₂eq · ${(d.lines || []).length} composants</div>
        <div class="ccard-sub">${escHtml(d.updated ? new Date(d.updated).toLocaleString("fr-FR") : "")}</div>
        <div class="ccard-acts">
          <button class="btn-soft" onclick="loadSavedFdesDossier(${state.fdesDossiers.indexOf(d)})">Ouvrir</button>
          <button class="btn-soft" style="color:var(--bad)" onclick="deleteFdesDossier(${state.fdesDossiers.indexOf(d)})">Supprimer</button>
        </div>
      </div>`).join("")}</div>` : ""}`;
}

function renderFdesDossierView(d) {
  const rows = (d.lines || []).map((ln) => {
    const stCls = ln.status === "ok" ? "cert-ok" : ln.status === "partial" ? "cert-warn" : "cert-bad";
    return `<tr class="${stCls}">
      <td>${escHtml(ln.roleLabel)}</td>
      <td class="mono">${escHtml(ln.compRef)}</td>
      <td>${escHtml(ln.fabricant || "—")}</td>
      <td>${escHtml(ln.origine || "—")}</td>
      <td class="mono">${ln.poidsKg != null ? fmt(ln.poidsKg, 2) : "—"}</td>
      <td class="mono">${ln.iniesRef || "—"}</td>
      <td class="mono">${ln.acvA1A3 != null ? fmt(ln.acvA1A3, 2) : "—"}</td>
      <td class="mono">${ln.acvA4 != null ? fmt(ln.acvA4, 2) : "—"}</td>
      <td class="mono">${ln.acvC1C4 != null ? fmt(ln.acvC1C4, 2) : "—"}</td>
      <td class="mono"><b>${ln.acvTotal != null ? fmt(ln.acvTotal, 2) : "—"}</b></td>
    </tr>`;
  }).join("");

  const t = d.totals || {};
  const refLine = d.refrigerant
    ? `<tr class="cert-ref"><td colspan="6">Fluide frigorigène · ${escHtml(d.refrigerant.fluide)} · ${fmt(d.refrigerant.chargeKg, 2)} kg × PRP ${fmt(d.refrigerant.gwp, 0)}</td>
       <td colspan="3" class="mono"><b>${fmt(d.refrigerant.co2eqKg, 0)} kgCO₂eq</b> (fuite totale théorique)</td></tr>`
    : "";

  return `<div class="panel blk-geo cert-fdes-dossier">
    <div class="head"><h3>${escHtml(d.title)}</h3>
      <span class="tag mono">${d.gaps ? d.gaps + " composant(s) incomplet(s)" : "Complet"}</span></div>
    <div class="body">
      <div class="cert-fdes-totals">
        <div><span class="cert-total-lbl">ACV composants</span><span class="cert-total-val mono">${fmt(t.acvComponents ?? 0, 2)}</span><span class="cert-total-unit">kgCO₂eq</span></div>
        <div><span class="cert-total-lbl">Fluide (GWP)</span><span class="cert-total-val mono">${fmt(t.refrigerantCo2eq ?? 0, 0)}</span><span class="cert-total-unit">kgCO₂eq</span></div>
        <div class="cert-total-main"><span class="cert-total-lbl">Total indicatif</span><span class="cert-total-val mono">${fmt(t.grandTotal ?? 0, 2)}</span><span class="cert-total-unit">kgCO₂eq</span></div>
      </div>
      <div class="cert-fdes-table-wrap">
        <table class="proc-dims-tbl cert-fdes-tbl">
          <thead><tr>
            <th>Rôle</th><th>Composant</th><th>Fabricant</th><th>Origine</th><th>Poids kg</th><th>FDES / INIES</th>
            <th>A1-A3</th><th>A4</th><th>C1-C4</th><th>Total</th>
          </tr></thead>
          <tbody>${rows}${refLine}</tbody>
        </table>
      </div>
      <p class="hint">Unité fonctionnelle : ${escHtml(d.functionalUnit || "—")}. Les phases A5 (installation) et B (usage) peuvent être complétées ultérieurement.</p>
    </div>
  </div>`;
}

function generateAndSaveFdesDossier(pac) {
  const d = buildFdesDossier(pac);
  if (!d) return;
  const idx = state.fdesDossiers.findIndex((x) => x.pac === pac);
  if (idx >= 0) {
    d.id = state.fdesDossiers[idx].id;
    d.created = state.fdesDossiers[idx].created;
    state.fdesDossiers[idx] = d;
  } else {
    state.fdesDossiers.push(d);
  }
  markCatalogDirty?.();
  toast("Dossier FDES enregistré · " + pac);
  renderCertPanel();
}

function exportFdesDossierJson(pac) {
  const d = buildFdesDossier(pac);
  if (!d || typeof download !== "function") return;
  const slug = typeof wsSlugify === "function" ? wsSlugify(pac) : pac.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  download(d, "fdes_" + slug + ".json");
  toast("Dossier FDES exporté");
}

function printFdesDossier(pac) {
  const d = buildFdesDossier(pac);
  if (!d) return;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${escHtml(d.title)}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}
    h1{font-size:18px} table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left} th{background:#f0f0f0}
    .totals{display:flex;gap:24px;margin:16px 0} .totals div{padding:12px;background:#f5f5f5;border-radius:8px}
    </style></head><body>
    <h1>${escHtml(d.title)}</h1>
    <p>Gamme ${escHtml(d.gammeNom)} · ${escHtml(d.functionalUnit)} · ${new Date().toLocaleDateString("fr-FR")}</p>
    ${renderFdesDossierView(d)}
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les pop-ups pour imprimer."); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

function loadSavedFdesDossier(idx) {
  const d = state.fdesDossiers[idx];
  if (!d) return;
  const sel = $("fdesMachineSel");
  if (sel) sel.value = d.pac;
  renderCertPanel();
}

function deleteFdesDossier(idx) {
  if (!confirm("Supprimer ce dossier FDES enregistré ?")) return;
  state.fdesDossiers.splice(idx, 1);
  markCatalogDirty?.();
  renderCertPanel();
}
