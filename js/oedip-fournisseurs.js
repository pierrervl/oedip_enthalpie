/* OEDIP — fournisseurs composants & distances transport (FDES A4) */

const ROAD_DISTANCE_FACTOR = 1.25;

let FRN_EDIT_IDX = null;
let COMP_MAIN_VIEW = "catalogue";

function defaultFournisseur(obj) {
  return {
    id: "",
    nom: "",
    contact: "",
    email: "",
    tel: "",
    adr: "",
    cp: "",
    ville: "",
    pays: "France",
    lat: null,
    lng: null,
    notes: "",
    ...(obj && typeof obj === "object" ? obj : {}),
  };
}

function defaultFournisseurSettings() {
  return {
    source: "atelier",
    roadFactor: ROAD_DISTANCE_FACTOR,
    custom: { label: "Site de réception", adr: "", cp: "", ville: "", pays: "France", lat: null, lng: null },
  };
}

function nextFournisseurId() {
  return "frn_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function ensureFournisseurs() {
  if (!Array.isArray(state.fournisseurs)) state.fournisseurs = [];
  state.fournisseurs = state.fournisseurs.map((f) => {
    const n = defaultFournisseur(f);
    if (!n.id) n.id = nextFournisseurId();
    return n;
  });
}

function ensureFournisseurSettings() {
  if (!state.fournisseurSettings || typeof state.fournisseurSettings !== "object") {
    state.fournisseurSettings = defaultFournisseurSettings();
  }
  const d = defaultFournisseurSettings();
  state.fournisseurSettings = { ...d, ...state.fournisseurSettings, custom: { ...d.custom, ...(state.fournisseurSettings.custom || {}) } };
}

function findFournisseurById(id) {
  if (!id) return null;
  ensureFournisseurs();
  return state.fournisseurs.find((f) => f.id === id) || null;
}

function fournisseurLabel(f) {
  if (!f) return "—";
  const loc = [f.cp, f.ville].filter(Boolean).join(" ");
  return [f.nom, loc].filter(Boolean).join(" · ") || f.id;
}

function fournisseurAddressLine(f) {
  if (!f) return "";
  return [f.adr, [f.cp, f.ville].filter(Boolean).join(" "), f.pays].filter(Boolean).join(", ");
}

function fournisseurOptionsHtml(selectedId, emptyLabel) {
  ensureFournisseurs();
  const opts = (state.fournisseurs || [])
    .slice()
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"))
    .map((f) => `<option value="${compEscVal(f.id)}"${f.id === selectedId ? " selected" : ""}>${escHtml(fournisseurLabel(f))}</option>`)
    .join("");
  return `<option value="">${escHtml(emptyLabel || "— Aucun —")}</option>${opts}`;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function roadDistanceKm(lineKm, factor) {
  const f = factor ?? state.fournisseurSettings?.roadFactor ?? ROAD_DISTANCE_FACTOR;
  return Math.round(lineKm * f);
}

function getSiteLivraison() {
  ensureFournisseurSettings();
  const src = state.fournisseurSettings.source || "atelier";
  if (src === "projet" && typeof projet !== "undefined" && projet?.client) {
    const c = projet.client;
    return {
      label: "Chantier / client (" + (c.nom || c.ref || "étude") + ")",
      adr: c.adr || "",
      cp: c.cp || "",
      ville: c.ville || "",
      pays: "France",
      lat: c.lat ?? null,
      lng: c.lng ?? null,
    };
  }
  if (src === "custom") {
    const c = state.fournisseurSettings.custom || {};
    return { label: c.label || "Site personnalisé", ...c };
  }
  const co = typeof getActiveInstallerCompany === "function" ? getActiveInstallerCompany() : null;
  return {
    label: "Atelier (" + (co?.company || "entreprise") + ")",
    adr: co?.adr || "",
    cp: co?.cp || "",
    ville: co?.ville || "",
    pays: "France",
    lat: co?.lat ?? null,
    lng: co?.lng ?? null,
  };
}

function coordsFromEntity(ent) {
  const lat = ent?.lat != null && ent.lat !== "" ? +ent.lat : null;
  const lng = ent?.lng != null && ent.lng !== "" ? +ent.lng : null;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function calcFournisseurTransportKm(fournisseurId) {
  const frn = findFournisseurById(fournisseurId);
  if (!frn) return null;
  const a = coordsFromEntity(frn);
  const b = coordsFromEntity(getSiteLivraison());
  if (!a || !b) return null;
  return roadDistanceKm(haversineKm(a.lat, a.lng, b.lat, b.lng));
}

function applyTransportKmToComp(comp, km) {
  if (!comp || km == null) return;
  const fdes = ensureCompFdes(comp);
  fdes.transportKm = km;
  if (!fdes.origine && comp.fournisseurId) {
    const frn = findFournisseurById(comp.fournisseurId);
    if (frn) fdes.origine = [frn.ville, frn.pays].filter(Boolean).join(", ");
  }
}

function iterAllComposants(cb) {
  ensureComposants();
  Object.keys(COMP_TYPES).forEach((type) => {
    (state.composants[type] || []).forEach((c, idx) => cb(c, type, idx));
  });
}

function countComposantsWithFournisseur() {
  let n = 0;
  iterAllComposants((c) => { if (c.fournisseurId) n++; });
  return n;
}

async function geocodeAddressQuery(q) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Géocodage indisponible (" + res.status + ")");
  const data = await res.json();
  if (!data?.length) throw new Error("Adresse introuvable");
  return { lat: +data[0].lat, lng: +data[0].lon, display: data[0].display_name || q };
}

async function geocodeFournisseurAt(i) {
  ensureFournisseurs();
  const f = state.fournisseurs[i];
  if (!f) return;
  const q = fournisseurAddressLine(f);
  if (!q.trim()) { alert("Renseignez l'adresse du fournisseur."); return; }
  try {
    toast("Géocodage…");
    const g = await geocodeAddressQuery(q);
    f.lat = g.lat;
    f.lng = g.lng;
    markCatalogDirty?.();
    renderFournisseursView();
    toast("Coordonnées enregistrées · " + g.display.slice(0, 60) + "…");
  } catch (err) {
    alert(err.message + "\n\nSaisissez latitude / longitude manuellement si besoin.");
  }
}

async function geocodeSiteLivraison() {
  ensureFournisseurSettings();
  const site = getSiteLivraison();
  if (state.fournisseurSettings.source === "custom") {
    const c = state.fournisseurSettings.custom;
    const q = [c.adr, c.cp, c.ville, c.pays].filter(Boolean).join(", ");
    if (!q.trim()) { alert("Renseignez l'adresse du site de réception."); return; }
    try {
      toast("Géocodage site…");
      const g = await geocodeAddressQuery(q);
      c.lat = g.lat;
      c.lng = g.lng;
      markCatalogDirty?.();
      renderFournisseursView();
      toast("Site géolocalisé");
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  alert("Pour l'atelier ou le chantier client, saisissez lat/lng dans Entreprise ou Client, ou passez en « Site personnalisé ».");
}

function bulkCalcTransportDistances() {
  ensureFournisseurs();
  ensureFournisseurSettings();
  const site = getSiteLivraison();
  if (!coordsFromEntity(site)) {
    alert("Le site de réception n'a pas de coordonnées GPS.\n\nGéocodez le site ou saisissez latitude / longitude.");
    return;
  }
  let ok = 0;
  let skip = 0;
  iterAllComposants((c) => {
    if (!c.fournisseurId) return;
    const km = calcFournisseurTransportKm(c.fournisseurId);
    if (km == null) { skip++; return; }
    applyTransportKmToComp(c, km);
    ok++;
  });
  markCatalogDirty?.();
  if (typeof renderComposants === "function" && COMP_MAIN_VIEW === "catalogue") renderComposants();
  renderFournisseursView();
  toast(ok + " distance(s) calculée(s)" + (skip ? " · " + skip + " sans GPS fournisseur" : ""));
}

function applyTransportToSingleComp(type, idx) {
  const c = state.composants[type]?.[idx];
  if (!c?.fournisseurId) { alert("Aucun fournisseur lié à ce composant."); return; }
  const km = calcFournisseurTransportKm(c.fournisseurId);
  if (km == null) {
    alert("Impossible de calculer : vérifiez les coordonnées GPS du fournisseur et du site de réception.");
    return;
  }
  applyTransportKmToComp(c, km);
  markCatalogDirty?.();
  toast("Transport : " + km + " km");
  if (COMP_EDIT?.type === type && COMP_EDIT?.idx === idx) {
    const draft = COMP_EDIT._draft || {};
    draft.transportKm = km;
    if (!draft.fdes) draft.fdes = {};
    draft.fdes.transportKm = km;
    COMP_EDIT._draft = draft;
    renderCompModalBody({ ...c, fdes: ensureCompFdes(c) }, type);
  }
}

function setCompMainView(v) {
  COMP_MAIN_VIEW = v;
  const cat = $("compCatalogueView");
  const frn = $("compFournisseursView");
  const nav = $("compCatalogueNav");
  if (cat) cat.hidden = v !== "catalogue";
  if (nav) nav.hidden = v !== "catalogue";
  if (frn) frn.hidden = v !== "fournisseurs";
  document.querySelectorAll(".comp-main-seg button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  if (v === "fournisseurs") renderFournisseursView();
  else if (typeof renderComposants === "function") renderComposants();
}

function renderSiteLivraisonPanel() {
  ensureFournisseurSettings();
  const s = state.fournisseurSettings;
  const site = getSiteLivraison();
  const coords = coordsFromEntity(site);
  const src = s.source || "atelier";
  const custom = s.custom || {};
  return `<div class="frn-site-panel panel blk-geo">
    <div class="head"><h3>Site de réception</h3><span class="tag mono">${coords ? fmt(coords.lat, 5) + " · " + fmt(coords.lng, 5) : "Sans GPS"}</span></div>
    <div class="body">
      <p class="hint">Distance calculée entre le fournisseur et ce site (× coefficient route ${fmt(s.roadFactor ?? ROAD_DISTANCE_FACTOR, 2)}). Alimente le champ <b>Transport</b> des fiches FDES composants.</p>
      <div class="seg frn-site-seg" style="margin-bottom:12px">
        <button type="button" data-src="atelier" class="${src === "atelier" ? "on" : ""}" onclick="setSiteLivraisonSource('atelier')">Atelier</button>
        <button type="button" data-src="projet" class="${src === "projet" ? "on" : ""}" onclick="setSiteLivraisonSource('projet')">Chantier client</button>
        <button type="button" data-src="custom" class="${src === "custom" ? "on" : ""}" onclick="setSiteLivraisonSource('custom')">Personnalisé</button>
      </div>
      ${src === "custom" ? `<div class="comp-form frn-site-form">
        <label class="comp-field full"><span>Libellé</span><input id="frnSiteLabel" value="${compEscVal(custom.label || "")}"></label>
        <label class="comp-field full"><span>Adresse</span><input id="frnSiteAdr" value="${compEscVal(custom.adr || "")}"></label>
        <label class="comp-field"><span>CP</span><input id="frnSiteCp" value="${compEscVal(custom.cp || "")}"></label>
        <label class="comp-field"><span>Ville</span><input id="frnSiteVille" value="${compEscVal(custom.ville || "")}"></label>
        <label class="comp-field"><span>Pays</span><input id="frnSitePays" value="${compEscVal(custom.pays || "France")}"></label>
        <label class="comp-field"><span>Latitude</span><input id="frnSiteLat" type="number" step="0.000001" value="${custom.lat ?? ""}"></label>
        <label class="comp-field"><span>Longitude</span><input id="frnSiteLng" type="number" step="0.000001" value="${custom.lng ?? ""}"></label>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn-soft" onclick="saveSiteLivraisonCustom()">Enregistrer site</button>
        <button type="button" class="btn-ghost" onclick="geocodeSiteLivraison()">Géolocaliser l'adresse</button>
      </div>` : `<p class="mono frn-site-readout">${escHtml(site.label)}<br>${escHtml(fournisseurAddressLine(site) || "—")}</p>
      <p class="hint">${src === "atelier" ? "Adresse issue de Entreprise (Installation)." : "Adresse issue de la fiche Client de l'étude en cours."}</p>`}
      <label class="comp-field" style="margin-top:12px;max-width:220px"><span>Coefficient route</span><input id="frnRoadFactor" type="number" step="0.01" min="1" value="${s.roadFactor ?? ROAD_DISTANCE_FACTOR}" onchange="saveRoadFactor()"></label>
    </div>
  </div>`;
}

function setSiteLivraisonSource(src) {
  ensureFournisseurSettings();
  state.fournisseurSettings.source = src;
  markCatalogDirty?.();
  renderFournisseursView();
}

function saveSiteLivraisonCustom() {
  ensureFournisseurSettings();
  const c = state.fournisseurSettings.custom;
  c.label = $("frnSiteLabel")?.value.trim() || "Site de réception";
  c.adr = $("frnSiteAdr")?.value.trim() || "";
  c.cp = $("frnSiteCp")?.value.trim() || "";
  c.ville = $("frnSiteVille")?.value.trim() || "";
  c.pays = $("frnSitePays")?.value.trim() || "France";
  c.lat = numOrNullEl("frnSiteLat");
  c.lng = numOrNullEl("frnSiteLng");
  state.fournisseurSettings.source = "custom";
  markCatalogDirty?.();
  toast("Site enregistré");
  renderFournisseursView();
}

function saveRoadFactor() {
  ensureFournisseurSettings();
  const v = +($("frnRoadFactor")?.value || ROAD_DISTANCE_FACTOR);
  state.fournisseurSettings.roadFactor = Number.isFinite(v) && v >= 1 ? v : ROAD_DISTANCE_FACTOR;
  markCatalogDirty?.();
}

function numOrNullEl(id) {
  const v = $(id)?.value;
  if (v === "" || v == null) return null;
  const n = +v;
  return Number.isFinite(n) ? n : null;
}

function renderFournisseurTransportTable() {
  const rows = [];
  iterAllComposants((c, type, idx) => {
    if (!c.fournisseurId) return;
    const frn = findFournisseurById(c.fournisseurId);
    const fdes = ensureCompFdes(c);
    const kmCalc = calcFournisseurTransportKm(c.fournisseurId);
    rows.push({ c, type, idx, frn, fdes, kmCalc });
  });
  if (!rows.length) {
    return `<div class="empty">Aucun composant lié à un fournisseur. Associez un fournisseur sur chaque fiche composant (FDES / fiche technique).</div>`;
  }
  rows.sort((a, b) => (a.frn?.nom || "").localeCompare(b.frn?.nom || "", "fr"));
  return `<table class="proc-dims-tbl frn-transport-tbl"><thead><tr>
    <th>Composant</th><th>Fournisseur</th><th>Transport FDES</th><th>Calculé</th><th></th>
  </tr></thead><tbody>${rows.map((r) => {
    const title = r.c.ref || r.c.modele || r.c.designation || "—";
    const km = r.fdes.transportKm;
    const ok = km != null && r.kmCalc != null && Math.abs(km - r.kmCalc) <= 1;
    return `<tr>
      <td>${escHtml(title)}<br><span class="hint">${escHtml(COMP_TYPES[r.type]?.label || r.type)}</span></td>
      <td>${escHtml(r.frn ? fournisseurLabel(r.frn) : "—")}</td>
      <td class="mono">${km != null ? fmt(km, 0) + " km" : "—"}</td>
      <td class="mono${ok ? " frn-km-ok" : ""}">${r.kmCalc != null ? fmt(r.kmCalc, 0) + " km" : '<span class="hint">GPS manquant</span>'}</td>
      <td><button type="button" class="btn-ghost" onclick="applyTransportToSingleComp('${r.type}',${r.idx})">Recalculer</button></td>
    </tr>`;
  }).join("")}</tbody></table>`;
}

function renderFournisseursView() {
  ensureFournisseurs();
  ensureFournisseurSettings();
  const el = $("compFournisseursView");
  if (!el) return;
  const list = state.fournisseurs || [];
  el.innerHTML = `
    ${renderSiteLivraisonPanel()}
    <div class="toolbar" style="margin:16px 0 10px">
      <span class="grow"><b>Fournisseurs</b> <span class="tag mono">${list.length}</span>
        <span class="hint" style="margin-left:8px">${countComposantsWithFournisseur()} composant(s) lié(s)</span></span>
      <button type="button" class="btn-soft" onclick="openFournisseurModal()">+ Fournisseur</button>
      <button type="button" class="btn-heat" onclick="bulkCalcTransportDistances()">Calculer toutes les distances</button>
    </div>
    <div class="comp-grid">${list.length ? list.map((f, i) => {
      const coords = coordsFromEntity(f);
      const linked = [];
      iterAllComposants((c) => { if (c.fournisseurId === f.id) linked.push(c); });
      return `<div class="ccard frn-card">
        <div class="ccard-top"><h4>${escHtml(f.nom || "Sans nom")}</h4>
          ${coords ? `<span class="badge mono">GPS</span>` : `<span class="badge">Sans GPS</span>`}</div>
        <div class="ccard-sub">${escHtml(fournisseurAddressLine(f) || "—")}</div>
        <div class="ccard-spec mono">${escHtml([f.contact, f.tel, f.email].filter(Boolean).join(" · ") || "—")}</div>
        <div class="hint">${linked.length} composant(s) · ${coords ? fmt(f.lat, 4) + ", " + fmt(f.lng, 4) : "Géocodez pour calculer les km"}</div>
        <div class="ccard-acts">
          <button class="btn-soft" onclick="openFournisseurModal(${i})">Modifier</button>
          <button class="btn-soft" onclick="geocodeFournisseurAt(${i})">Géolocaliser</button>
          <button class="btn-soft" style="color:var(--bad)" onclick="deleteFournisseur(${i})">Supprimer</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty" style="grid-column:1/-1">Ajoutez vos fournisseurs (grossistes, fabricants, logisticiens) avec leur adresse pour estimer les distances transport FDES.</div>`}</div>
    <div class="panel blk-geo" style="margin-top:18px">
      <div class="head"><h3>Distances transport composants</h3></div>
      <div class="body">${renderFournisseurTransportTable()}</div>
    </div>`;
}

function openFournisseurModal(idx) {
  ensureFournisseurs();
  FRN_EDIT_IDX = idx != null ? idx : -1;
  const f = FRN_EDIT_IDX >= 0 ? { ...state.fournisseurs[FRN_EDIT_IDX] } : defaultFournisseur({ id: nextFournisseurId() });
  $("frnModalTitle").textContent = (FRN_EDIT_IDX >= 0 ? "Modifier" : "Ajouter") + " — Fournisseur";
  $("frnModalBody").innerHTML = `<div class="comp-form">
    <label class="comp-field full"><span>Raison sociale</span><input id="frnNom" value="${compEscVal(f.nom)}"></label>
    <label class="comp-field"><span>Contact</span><input id="frnContact" value="${compEscVal(f.contact)}"></label>
    <label class="comp-field"><span>Téléphone</span><input id="frnTel" value="${compEscVal(f.tel)}"></label>
    <label class="comp-field full"><span>E-mail</span><input id="frnEmail" type="email" value="${compEscVal(f.email)}"></label>
    <label class="comp-field full"><span>Adresse</span><input id="frnAdr" value="${compEscVal(f.adr)}"></label>
    <label class="comp-field"><span>Code postal</span><input id="frnCp" value="${compEscVal(f.cp)}"></label>
    <label class="comp-field"><span>Ville</span><input id="frnVille" value="${compEscVal(f.ville)}"></label>
    <label class="comp-field"><span>Pays</span><input id="frnPays" value="${compEscVal(f.pays || "France")}"></label>
    <label class="comp-field"><span>Latitude</span><input id="frnLat" type="number" step="0.000001" value="${f.lat ?? ""}"></label>
    <label class="comp-field"><span>Longitude</span><input id="frnLng" type="number" step="0.000001" value="${f.lng ?? ""}"></label>
    <label class="comp-field full"><span>Notes</span><textarea id="frnNotes" rows="2">${escHtml(f.notes || "")}</textarea></label>
  </div>
  <p class="hint">Utilisez <b>Géolocaliser</b> après enregistrement pour obtenir lat/lng automatiquement (OpenStreetMap).</p>`;
  $("modalFournisseur").classList.add("show");
}

function readFournisseurModal() {
  return defaultFournisseur({
    nom: $("frnNom")?.value.trim() || "",
    contact: $("frnContact")?.value.trim() || "",
    tel: $("frnTel")?.value.trim() || "",
    email: $("frnEmail")?.value.trim() || "",
    adr: $("frnAdr")?.value.trim() || "",
    cp: $("frnCp")?.value.trim() || "",
    ville: $("frnVille")?.value.trim() || "",
    pays: $("frnPays")?.value.trim() || "France",
    lat: numOrNullEl("frnLat"),
    lng: numOrNullEl("frnLng"),
    notes: $("frnNotes")?.value.trim() || "",
  });
}

function saveFournisseurModal() {
  ensureFournisseurs();
  const data = readFournisseurModal();
  if (!data.nom) { alert("Indiquez au minimum la raison sociale."); return; }
  if (FRN_EDIT_IDX >= 0) {
    data.id = state.fournisseurs[FRN_EDIT_IDX].id;
    state.fournisseurs[FRN_EDIT_IDX] = data;
  } else {
    data.id = data.id || nextFournisseurId();
    state.fournisseurs.push(data);
  }
  closeFournisseurModal();
  markCatalogDirty?.();
  toast("Fournisseur enregistré");
  renderFournisseursView();
}

function closeFournisseurModal() {
  $("modalFournisseur")?.classList.remove("show");
  FRN_EDIT_IDX = null;
}

function deleteFournisseur(i) {
  const f = state.fournisseurs[i];
  if (!f) return;
  let used = 0;
  iterAllComposants((c) => { if (c.fournisseurId === f.id) used++; });
  const msg = used
    ? `« ${f.nom} » est lié à ${used} composant(s). Supprimer quand même ? (les liens seront retirés)`
    : `Supprimer le fournisseur « ${f.nom} » ?`;
  if (!confirm(msg)) return;
  iterAllComposants((c) => { if (c.fournisseurId === f.id) c.fournisseurId = ""; });
  state.fournisseurs.splice(i, 1);
  markCatalogDirty?.();
  renderFournisseursView();
  toast("Fournisseur supprimé");
}

function renderCompMainSeg() {
  const el = $("compMainSeg");
  if (!el) return;
  el.innerHTML = `
    <button type="button" data-v="catalogue" class="${COMP_MAIN_VIEW === "catalogue" ? "on" : ""}" onclick="setCompMainView('catalogue')">Catalogue</button>
    <button type="button" data-v="fournisseurs" class="${COMP_MAIN_VIEW === "fournisseurs" ? "on" : ""}" onclick="setCompMainView('fournisseurs')">Fournisseurs & transport</button>`;
}

if ($("modalFournisseur")) {
  $("modalFournisseur").addEventListener("click", (e) => { if (e.target.id === "modalFournisseur") closeFournisseurModal(); });
}

if (typeof state !== "undefined") {
  ensureFournisseurs();
  ensureFournisseurSettings();
}
