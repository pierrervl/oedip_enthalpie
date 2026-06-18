/* OEDIP — catalogue outils atelier (cintreuse, coupe-tube, emboutisseur…) */

const OUTIL_TYPES = {
  cintreuse: {
    label: "Cintreuse",
    icon: "⌒",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeCintre", label: "Type", type: "select", options: [["manuelle", "Manuelle"], ["hydraulique", "Hydraulique"], ["electrique", "Électrique"], ["autre", "Autre"]] },
      { key: "diamMin", label: "Diamètre min", type: "text", placeholder: 'ex. 6 mm ou 1/4"' },
      { key: "diamMax", label: "Diamètre max", type: "text", placeholder: 'ex. 28 mm ou 1 1/8"' },
      { key: "rayonMinMm", label: "Rayon min cintrage", unit: "mm", type: "number", step: 1 },
      { key: "galets", label: "Galets / jeux", type: "textarea", full: true, placeholder: "Jeux de galets, profils tube…" },
      { key: "emplacement", label: "Emplacement", type: "text", placeholder: "Atelier, caisse mobile…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeCintre) p.push(o.typeCintre);
      if (o.diamMin || o.diamMax) p.push([o.diamMin, o.diamMax].filter(Boolean).join(" → "));
      if (o.galets) p.push("galets");
      return p.join(" · ") || "—";
    }
  },
  coupe_tube: {
    label: "Coupe-tube",
    icon: "✂",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeCoupe", label: "Type", type: "select", options: [["roulette", "Roulette"], ["cliquet", "Cliquet"], ["scie", "Scie"], ["autre", "Autre"]] },
      { key: "diamMin", label: "Diamètre min", type: "text", placeholder: 'ex. 1/8"' },
      { key: "diamMax", label: "Diamètre max", type: "text", placeholder: 'ex. 1 3/8"' },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeCoupe) p.push(o.typeCoupe);
      if (o.diamMin || o.diamMax) p.push([o.diamMin, o.diamMax].filter(Boolean).join(" → "));
      return p.join(" · ") || "—";
    }
  },
  emboutisseur: {
    label: "Emboutisseur",
    icon: "⬡",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeEmb", label: "Type", type: "select", options: [["emboiture", "Emboiture"], ["flare", "Flare / évasement"], ["cintrage_embout", "Cintrage embout"], ["autre", "Autre"]] },
      { key: "diametres", label: "Diamètres supportés", type: "text", full: true, placeholder: 'ex. 1/4", 3/8", 1/2"' },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeEmb) p.push(o.typeEmb);
      if (o.diametres) p.push(o.diametres);
      return p.join(" · ") || "—";
    }
  },
  ebavureur: {
    label: "Ébavureur",
    icon: "◈",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeEbav", label: "Type", type: "select", options: [["interieur", "Intérieur"], ["exterieur", "Extérieur"], ["combine", "Combiné"], ["autre", "Autre"]] },
      { key: "diamMin", label: "Diamètre min", type: "text" },
      { key: "diamMax", label: "Diamètre max", type: "text" },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeEbav) p.push(o.typeEbav);
      if (o.diamMin || o.diamMax) p.push([o.diamMin, o.diamMax].filter(Boolean).join(" → "));
      return p.join(" · ") || "—";
    }
  },
  mesure: {
    label: "Mesure",
    icon: "📏",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeMesure", label: "Type", type: "select", options: [["metre", "Mètre ruban"], ["pied_coulisse", "Pied à coulisse"], ["micrometre", "Micromètre"], ["niveau", "Niveau"], ["manometre", "Manomètre"], ["autre", "Autre"]] },
      { key: "precision", label: "Précision / gamme", type: "text", placeholder: "ex. 0,1 mm · 0–30 bar" },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeMesure) p.push(o.typeMesure.replace(/_/g, " "));
      if (o.precision) p.push(o.precision);
      return p.join(" · ") || "—";
    }
  },
  brasage: {
    label: "Brasage",
    icon: "🔥",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeBrasage", label: "Type", type: "select", options: [["poste", "Poste de brasage"], ["chalumeau", "Chalumeau"], ["baguettes", "Baguettes / consommables"], ["decapant", "Décapant / flux"], ["azote", "Azote / balayage"], ["autre", "Autre"]] },
      { key: "gaz", label: "Gaz / fluide", type: "text", placeholder: "azote, acétylène + O₂…" },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      const p = [];
      if (o.typeBrasage) p.push(o.typeBrasage);
      if (o.gaz) p.push(o.gaz);
      return p.join(" · ") || "—";
    }
  },
  divers: {
    label: "Divers",
    icon: "⚒",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "designation", label: "Désignation", type: "text", full: true },
      { key: "emplacement", label: "Emplacement", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(o) {
      return o.designation || o.modele || "—";
    }
  }
};

const OUTIL_SEED = {
  cintreuse: [
    { id: "out_cintreuse_std", type: "cintreuse", ref: "Cintreuse manuelle 6–28 mm", fabricant: "Rothenberger", modele: "Standard", typeCintre: "manuelle", diamMin: "6 mm", diamMax: '1 1/8"', galets: "Jeu galets cuivre standard", emplacement: "Atelier" },
    { id: "out_cintreuse_petit", type: "cintreuse", ref: "Mini-cintreuse 6–15 mm", fabricant: "—", modele: "Compact", typeCintre: "manuelle", diamMin: "6 mm", diamMax: "15 mm", galets: "Petits diamètres 1/4–1/2\"", emplacement: "Caisse tubes" }
  ],
  coupe_tube: [
    { id: "out_coupe_roulette", type: "coupe_tube", ref: "Coupe-tube roulette", fabricant: "Ridgid", modele: "35S", typeCoupe: "roulette", diamMin: '1/8"', diamMax: '1 3/8"', emplacement: "Atelier" }
  ],
  emboutisseur: [
    { id: "out_emb_flare", type: "emboutisseur", ref: "Kit embout flare", fabricant: "—", modele: "Manuel", typeEmb: "flare", diametres: '1/4", 3/8", 1/2", 5/8"', emplacement: "Atelier" }
  ],
  ebavureur: [
    { id: "out_ebav_int", type: "ebavureur", ref: "Ébavureur intérieur / extérieur", fabricant: "—", modele: "Combiné", typeEbav: "combine", diamMin: '1/4"', diamMax: '1 1/8"', emplacement: "Atelier" }
  ],
  mesure: [
    { id: "out_metre_5m", type: "mesure", ref: "Mètre ruban 5 m", fabricant: "—", modele: "5 m", typeMesure: "metre", precision: "mm", emplacement: "Atelier" },
    { id: "out_pied_coulisse", type: "mesure", ref: "Pied à coulisse 150 mm", fabricant: "—", modele: "150 mm", typeMesure: "pied_coulisse", precision: "0,1 mm", emplacement: "Atelier" }
  ],
  brasage: [
    { id: "out_poste_brasage", type: "brasage", ref: "Poste brasage argent 15 %", fabricant: "—", modele: "Atelier", typeBrasage: "poste", gaz: "azote balayage", emplacement: "Atelier" },
    { id: "out_baguettes_ag15", type: "brasage", ref: "Baguettes argent 15 %", fabricant: "—", modele: "Ø 2 mm", typeBrasage: "baguettes", emplacement: "Stock consommables" }
  ],
  divers: []
};

function defaultOutilsCatalog() {
  const out = {};
  Object.keys(OUTIL_TYPES).forEach((k) => { out[k] = []; });
  return out;
}

function ensureOutils() {
  if (!state.outils || typeof state.outils !== "object") state.outils = defaultOutilsCatalog();
  Object.keys(OUTIL_TYPES).forEach((k) => {
    if (!Array.isArray(state.outils[k])) state.outils[k] = [];
  });
  const empty = Object.keys(OUTIL_TYPES).every((k) => !state.outils[k].length);
  if (empty) {
    Object.keys(OUTIL_SEED).forEach((k) => {
      if (OUTIL_SEED[k]?.length) state.outils[k] = JSON.parse(JSON.stringify(OUTIL_SEED[k]));
    });
  }
}

function nextOutilId() {
  return "out_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function outilFindById(id) {
  if (!id) return null;
  for (const type of Object.keys(OUTIL_TYPES)) {
    const item = (state.outils[type] || []).find((o) => o.id === id);
    if (item) return { type, item };
  }
  return null;
}

function emptyOutilItem(type) {
  const item = { id: nextOutilId(), type, photo: "" };
  OUTIL_TYPES[type].fields.forEach((f) => {
    if (f.type === "select" && f.options) item[f.key] = f.options[0][0];
    else item[f.key] = "";
  });
  return item;
}

function outilPhotoPreviewInner(src, placeholderIcon) {
  if (src) return `<img src="${outilEscVal(src)}" alt="">`;
  return `<span class="outil-photo-ph" aria-hidden="true">${placeholderIcon || "📷"}</span>`;
}

function outilEscVal(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderOutilPhotoEditor(o, def) {
  const src = o.photo || "";
  return `<div class="outil-photo-edit">
    <label class="subhead" style="margin:0 0 8px;border:none">Photo</label>
    <div class="outil-photo-preview" id="outilPhotoPreview">${outilPhotoPreviewInner(src, def?.icon)}</div>
    <div class="outil-photo-actions">
      <button type="button" class="btn-soft" onclick="outilPickPhotoFile()">Choisir une image</button>
      <button type="button" class="btn-ghost" onclick="outilClearPhoto()">Supprimer</button>
    </div>
    <input type="text" class="mono outil-photo-path" id="outilPhotoPath" value="${outilEscVal(src)}" placeholder="img/outils/… ou image importée" oninput="refreshOutilPhotoPreview(this.value)">
    <p class="hint" style="margin:6px 0 0">Chemin relatif dans le dépôt (<span class="mono">img/outils/</span>) ou import direct (enregistré dans le projet).</p>
  </div>`;
}

function refreshOutilPhotoPreview(src) {
  const preview = $("outilPhotoPreview");
  if (!preview) return;
  const def = OUTIL_EDIT ? OUTIL_TYPES[OUTIL_EDIT.type] : null;
  preview.innerHTML = outilPhotoPreviewInner(src?.trim() || "", def?.icon);
}

function outilPickPhotoFile() {
  $("outilPhotoFileInput")?.click();
}

async function onOutilPhotoFileChange(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const dataUrl = typeof readImageFileAsDataUrl === "function"
      ? await readImageFileAsDataUrl(file, 1200, 0.85)
      : await outilReadImageFileAsDataUrl(file);
    const pathInp = $("outilPhotoPath");
    if (pathInp) pathInp.value = dataUrl;
    refreshOutilPhotoPreview(dataUrl);
    toast("Photo importée");
  } catch (e) {
    toast("Impossible de lire l'image");
  }
}

function outilReadImageFileAsDataUrl(file, maxSide = 1200, quality = 0.85) {
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

function outilClearPhoto() {
  const pathInp = $("outilPhotoPath");
  if (pathInp) pathInp.value = "";
  refreshOutilPhotoPreview("");
}

function readOutilPhotoFromModal() {
  return $("outilPhotoPath")?.value.trim() || "";
}

let OUTIL_EDIT = null;
let OUTIL_TYPE_ACTIVE = "cintreuse";

function setOutilType(t) {
  OUTIL_TYPE_ACTIVE = t;
  document.querySelectorAll(".outil-tab").forEach((b) => b.classList.toggle("on", b.dataset.outil === t));
  renderOutils();
}

function renderOutils() {
  ensureOutils();
  const type = OUTIL_TYPE_ACTIVE;
  const def = OUTIL_TYPES[type];
  const list = state.outils[type] || [];
  let total = 0;
  Object.keys(OUTIL_TYPES).forEach((k) => { total += (state.outils[k] || []).length; });
  const tc = $("outilTotalCount");
  if (tc) tc.textContent = total + " outil(s)";

  document.querySelectorAll(".outil-tab").forEach((b) => {
    const k = b.dataset.outil;
    const n = (state.outils[k] || []).length;
    b.innerHTML = `${OUTIL_TYPES[k].icon} ${OUTIL_TYPES[k].label}${n ? ` <span class="n">${n}</span>` : ""}`;
  });

  $("outilTypeTitle").textContent = def.label;
  $("outilTypeCount").textContent = list.length + " fiche(s)";

  $("outilList").innerHTML = list.length
    ? list.map((o, i) => {
      const title = o.ref || o.designation || o.modele || o.fabricant || "Sans nom";
      const sub = [o.fabricant, o.modele].filter(Boolean).join(" · ");
      const photoBlock = `<div class="outil-card-photo">${outilPhotoPreviewInner(o.photo, def.icon)}</div>`;
      return `<div class="ccard outil-card">
        ${photoBlock}
        <div class="outil-card-body">
          <div class="ccard-top">
            <h4>${outilEscHtml(title)}</h4>
            <span class="badge mono">${def.label}</span>
          </div>
          <div class="ccard-sub">${outilEscHtml(sub || "—")}${o.emplacement ? ` · ${outilEscHtml(o.emplacement)}` : ""}</div>
          <div class="ccard-spec mono">${outilEscHtml(def.summary(o))}</div>
          ${o.notes ? `<div class="ccard-note">${outilEscHtml(o.notes)}</div>` : ""}
          <div class="ccard-acts">
            <button class="btn-soft" onclick="openOutilModal('${type}',${i})">Modifier</button>
            <button class="btn-soft" onclick="dupOutil('${type}',${i})">Dupliquer</button>
            <button class="btn-soft" style="color:var(--bad)" onclick="delOutil('${type}',${i})">Supprimer</button>
          </div>
        </div>
      </div>`;
    }).join("")
    : `<div class="empty" style="grid-column:1/-1">Aucun ${def.label.toLowerCase()} — ajoutez une fiche pour constituer votre parc outils.</div>`;
}

function outilEscHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function outilFieldHtml(f, o) {
  const v = o[f.key] ?? "";
  const span = f.full ? ' style="grid-column:1/-1"' : "";
  if (f.type === "textarea") {
    return `<label class="comp-field"${span}><span>${f.label}</span><textarea data-k="${f.key}" rows="3">${outilEscHtml(v)}</textarea></label>`;
  }
  if (f.type === "select") {
    const opts = f.options.map(([val, lab]) => `<option value="${val}"${String(v) === val ? " selected" : ""}>${lab}</option>`).join("");
    return `<label class="comp-field"${span}><span>${f.label}</span><select data-k="${f.key}">${opts}</select></label>`;
  }
  const unit = f.unit ? `<span class="unit">${f.unit}</span>` : "";
  return `<label class="comp-field"${span}><span>${f.label}</span><input data-k="${f.key}" type="${f.type || "text"}" value="${outilEscHtml(v)}"${f.step != null ? ` step="${f.step}"` : ""} placeholder="${outilEscHtml(f.placeholder || "")}">${unit}</label>`;
}

function openOutilModal(type, idx) {
  ensureOutils();
  const def = OUTIL_TYPES[type];
  OUTIL_EDIT = { type, idx: idx != null ? idx : null };
  const o = idx != null ? { ...state.outils[type][idx] } : emptyOutilItem(type);
  $("outilModalTitle").textContent = (idx != null ? "Modifier" : "Ajouter") + " — " + def.label;
  $("outilModalBody").innerHTML = `${renderOutilPhotoEditor(o, def)}<div class="comp-form">${def.fields.map((f) => outilFieldHtml(f, o)).join("")}</div>`;
  $("modalOutil").classList.add("show");
}

function readOutilModal() {
  const o = {};
  $("outilModalBody").querySelectorAll("[data-k]").forEach((el) => {
    o[el.dataset.k] = el.tagName === "SELECT" ? el.value : el.value.trim();
  });
  return o;
}

function saveOutilModal() {
  if (!OUTIL_EDIT) return;
  const { type, idx } = OUTIL_EDIT;
  const prev = idx != null ? state.outils[type][idx] : {};
  const data = { ...prev, ...readOutilModal() };
  data.id = idx != null ? prev.id : nextOutilId();
  data.type = type;
  const photo = readOutilPhotoFromModal();
  if (photo) data.photo = photo;
  else delete data.photo;
  OUTIL_TYPES[type].fields.forEach((f) => {
    if (f.type === "number" && data[f.key] !== "" && data[f.key] != null) data[f.key] = num(data[f.key]);
    else if (f.type === "number" && data[f.key] === "") data[f.key] = null;
  });
  if (idx != null) state.outils[type][idx] = data;
  else state.outils[type].push(data);
  closeOutilModal();
  renderOutils();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
  toast("Outil enregistré");
}

function closeOutilModal() {
  $("modalOutil")?.classList.remove("show");
  OUTIL_EDIT = null;
}

function delOutil(type, idx) {
  const o = state.outils[type][idx];
  const name = o.ref || o.designation || "cet outil";
  if (!confirm("Supprimer « " + name + " » ?")) return;
  state.outils[type].splice(idx, 1);
  renderOutils();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
}

function dupOutil(type, idx) {
  const copy = JSON.parse(JSON.stringify(state.outils[type][idx]));
  copy.id = nextOutilId();
  if (copy.ref) copy.ref += " (copie)";
  state.outils[type].push(copy);
  renderOutils();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
  toast("Outil dupliqué");
}

function exportOutilsJson() {
  ensureOutils();
  download({ type: "oedip-outils", version: 1, date: new Date().toISOString(), outils: state.outils }, "oedip_outils.json");
  toast("Parc outils exporté");
}

function importOutilsJson() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result);
        const data = obj.outils || obj;
        ensureOutils();
        Object.keys(OUTIL_TYPES).forEach((k) => {
          if (Array.isArray(data[k])) state.outils[k] = data[k];
        });
        renderOutils();
        if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
        toast("Parc outils importé");
      } catch (err) {
        alert("JSON invalide : " + err.message);
      }
    };
    rd.readAsText(f);
  };
  inp.click();
}

function initOutilsTab() {
  ensureOutils();
  if (!$("outilTabs").dataset.ready) {
    $("outilTabs").innerHTML = Object.keys(OUTIL_TYPES).map(
      (k) => `<button type="button" class="comp-tab outil-tab" data-outil="${k}" onclick="setOutilType('${k}')">${OUTIL_TYPES[k].icon} ${OUTIL_TYPES[k].label}</button>`
    ).join("");
    $("outilTabs").dataset.ready = "1";
    setOutilType(OUTIL_TYPE_ACTIVE);
    return;
  }
  renderOutils();
}

if (typeof state !== "undefined") ensureOutils();
$("modalOutil")?.addEventListener("click", (e) => { if (e.target.id === "modalOutil") closeOutilModal(); });
