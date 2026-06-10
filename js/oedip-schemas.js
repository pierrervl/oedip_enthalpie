/* OEDIP — schémas frigorifique & hydraulique (sélection dans les bulles) */

const FRIGO_SCHEMA_NODES = [
  { role: "echangeurB26", type: "echangeur_plaques", label: "Évaporateur F80", cls: "b-evap", key: "evap" },
  { role: "bouteilleAspiration", type: "bouteille_anticoup", label: "Bouteille aspiration", cls: "b-bot", key: "bot" },
  { role: "compresseur", type: "compresseur", label: "Compresseur", cls: "b-comp", key: "comp" },
  { role: "echangeurFI22", type: "echangeur_plaques", label: "Désurchauffeur", cls: "b-fi22", key: "fi22" },
  { role: "echangeurF80", type: "echangeur_plaques", label: "Condenseur B26", cls: "b-cond", key: "cond" },
  { role: "reservoirLiquide", type: "reservoir_liquide", label: "Réservoir liquide", cls: "b-res", key: "res" },
  { role: "detendeur", type: "detendeur", label: "Détendeur", cls: "b-det", key: "det" },
  { role: "orificeDetendeur", type: "detendeur", label: "Orifice détendeur", cls: "b-ori", key: "ori" }
];

const FRIGO_LAYOUT_VERSION = 3;
const FRIGO_ALL_KEYS = ["evap", "bot", "comp", "fi22", "cond", "res", "detori"];
const FRIGO_ELEMENT_LABELS = {
  evap: "Évaporateur", bot: "Bouteille asp.", comp: "Compresseur", fi22: "Désurchauffeur",
  cond: "Condenseur", res: "Réservoir", detori: "Détendeur"
};

/** Disposition par défaut — cycle centré. */
const FRIGO_LAYOUT_DEFAULTS = {
  bot: { left: 14, top: 18 },
  comp: { left: 42, top: 6 },
  fi22: { left: 62, top: 18 },
  cond: { left: 62, top: 36 },
  res: { left: 46, top: 52 },
  evap: { left: 14, top: 52 },
  detori: { left: 38, top: 68 }
};

const FRIGO_BUILTIN_PRESET_ID = "preset_centre";

const FRIGO_PIPE_REQUIRES = {
  aspEvapBot: ["evap", "bot"], aspBotComp: ["bot", "comp"], disCompCond: ["comp", "cond"],
  disFi22Cond: ["fi22", "cond"], liqCondRes: ["cond", "res"], liqResDet: ["res", "detori"], liqDetEvap: ["detori", "evap"]
};

/** fromPt / toPt : top | bottom | left | right — accroches explicites pour un tracé lisible. */
const FRIGO_WIRE_EDGES = [
  { from: "evap", to: "bot", circuit: "asp", fromPt: "top", toPt: "bottom" },
  { from: "bot", to: "comp", circuit: "asp", fromPt: "top", toPt: "left" },
  { from: "comp", to: "cond", circuit: "dis", fromPt: "right", toPt: "left" },
  { from: "fi22", to: "cond", circuit: "dis", fromPt: "bottom", toPt: "top" },
  { from: "cond", to: "res", circuit: "liq", fromPt: "bottom", toPt: "top" },
  { from: "res", to: "detori", circuit: "liq", fromPt: "left", toPt: "right" },
  { from: "detori", to: "evap", circuit: "liq", fromPt: "left", toPt: "right" }
];

const FRIGO_CIRCUIT_STROKE = { asp: "#2f7d3b", dis: "#cf4310", liq: "#0c7a8c" };
const FRIGO_CIRCUIT_LABEL = { asp: "Aspiration", dis: "Refoulement", liq: "Liquide" };
/** Rôles sans raccords IN/OUT affichés sur le schéma. */
const SCHEMA_NO_IO_ROLES = new Set(["orificeDetendeur"]);

/** Tronçons de tuyauterie frigorifique (Ø mm, longueur m). */
const FRIGO_PIPES = [
  { id: "aspEvapBot", label: "Évap → bouteille", circuit: "asp" },
  { id: "aspBotComp", label: "Bouteille → compresseur", circuit: "asp" },
  { id: "disCompCond", label: "Compresseur → condenseur", circuit: "dis" },
  { id: "disFi22Cond", label: "Désurchauffeur → condenseur", circuit: "dis" },
  { id: "liqCondRes", label: "Condenseur → réservoir", circuit: "liq" },
  { id: "liqResDet", label: "Réservoir → détendeur", circuit: "liq" },
  { id: "liqDetEvap", label: "Détendeur → évaporateur", circuit: "liq" }
];

function ensureFrigoTuyaux(m) {
  if (!m) return {};
  if (!m.frigoTuyaux || typeof m.frigoTuyaux !== "object") m.frigoTuyaux = {};
  const t = m.frigoTuyaux;
  if (t.liqOriEvap && !t.liqDetEvap) { t.liqDetEvap = t.liqOriEvap; delete t.liqOriEvap; }
  if (t.liqDetOri) delete t.liqDetOri;
  if (t.disCompFi22 && !t.disCompCond) { t.disCompCond = t.disCompFi22; delete t.disCompFi22; }
  return t;
}

function ensureFrigoLayoutPresets() {
  if (!Array.isArray(state.frigoLayoutPresets)) state.frigoLayoutPresets = [];
  if (!state.frigoLayoutPresets.some((p) => p.id === FRIGO_BUILTIN_PRESET_ID)) {
    state.frigoLayoutPresets.unshift({
      id: FRIGO_BUILTIN_PRESET_ID,
      nom: "Centré (défaut)",
      builtin: true,
      elements: FRIGO_ALL_KEYS.slice(),
      layout: JSON.parse(JSON.stringify(FRIGO_LAYOUT_DEFAULTS))
    });
  }
  return state.frigoLayoutPresets;
}

function ensureFrigoElements(m) {
  if (!m) return FRIGO_ALL_KEYS.slice();
  if (!Array.isArray(m.frigoElements) || !m.frigoElements.length) m.frigoElements = FRIGO_ALL_KEYS.slice();
  return m.frigoElements.filter((k) => FRIGO_ALL_KEYS.includes(k));
}

function getFrigoVisibleSet(m) {
  return new Set(ensureFrigoElements(m));
}

function ensureFrigoLayout(m) {
  if (!m) return { ...FRIGO_LAYOUT_DEFAULTS };
  if (m.frigoLayoutVersion !== FRIGO_LAYOUT_VERSION) {
    delete m.frigoLayout;
    delete m.frigoPresetId;
    ensureFrigoLayoutPresets();
    const builtin = state.frigoLayoutPresets.find((p) => p.id === FRIGO_BUILTIN_PRESET_ID);
    if (builtin) applyFrigoPresetToMachine(m, builtin);
  }
  if (!m.frigoLayout || typeof m.frigoLayout !== "object") m.frigoLayout = {};
  const out = {};
  Object.keys(FRIGO_LAYOUT_DEFAULTS).forEach((k) => {
    const saved = m.frigoLayout[k];
    const def = FRIGO_LAYOUT_DEFAULTS[k];
    out[k] = {
      left: saved?.left != null ? saved.left : def.left,
      top: saved?.top != null ? saved.top : def.top
    };
  });
  return out;
}

function saveFrigoLayoutPos(pac, key, left, top) {
  const m = machineByPac(pac);
  if (!m) return;
  if (!m.frigoLayout) m.frigoLayout = {};
  m.frigoLayout[key] = { left: Math.round(left * 10) / 10, top: Math.round(top * 10) / 10 };
  delete m.frigoPresetId;
}

function applyFrigoPresetToMachine(m, preset) {
  if (!m || !preset) return;
  m.frigoLayout = JSON.parse(JSON.stringify(preset.layout));
  m.frigoElements = preset.elements.filter((k) => FRIGO_ALL_KEYS.includes(k));
  if (!m.frigoElements.length) m.frigoElements = FRIGO_ALL_KEYS.slice();
  m.frigoLayoutVersion = FRIGO_LAYOUT_VERSION;
  m.frigoPresetId = preset.id;
}

function applyFrigoPreset(pac, presetId) {
  ensureFrigoLayoutPresets();
  const preset = state.frigoLayoutPresets.find((p) => p.id === presetId);
  const m = machineByPac(pac);
  if (!preset || !m) return;
  applyFrigoPresetToMachine(m, preset);
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
}

function saveFrigoPresetFromMachine(pac, nom) {
  const m = machineByPac(pac);
  if (!m) return;
  const name = String(nom || "").trim();
  if (!name) return;
  ensureFrigoLayoutPresets();
  const layout = ensureFrigoLayout(m);
  const preset = {
    id: "preset_" + Date.now().toString(36),
    nom: name,
    elements: ensureFrigoElements(m).slice(),
    layout: JSON.parse(JSON.stringify(layout))
  };
  state.frigoLayoutPresets.push(preset);
  m.frigoPresetId = preset.id;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
  toast("Modèle « " + name + " » enregistré");
}

function promptSaveFrigoPreset(pac) {
  const nom = prompt("Nom du modèle de disposition :");
  if (nom != null) saveFrigoPresetFromMachine(pac, nom);
}

function deleteFrigoPreset(pac, presetId) {
  ensureFrigoLayoutPresets();
  const preset = state.frigoLayoutPresets.find((p) => p.id === presetId);
  if (!preset || preset.builtin) return;
  if (!confirm("Supprimer le modèle « " + preset.nom + " » ?")) return;
  state.frigoLayoutPresets = state.frigoLayoutPresets.filter((p) => p.id !== presetId);
  const m = machineByPac(pac);
  if (m?.frigoPresetId === presetId) delete m.frigoPresetId;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
}

function toggleFrigoElement(pac, key, on) {
  const m = machineByPac(pac);
  if (!m || !FRIGO_ALL_KEYS.includes(key)) return;
  let els = ensureFrigoElements(m);
  if (on && !els.includes(key)) els.push(key);
  if (!on) {
    if (els.length <= 1) return;
    els = els.filter((k) => k !== key);
  }
  m.frigoElements = els;
  delete m.frigoPresetId;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
}

function resetFrigoLayout(pac) {
  applyFrigoPreset(pac, FRIGO_BUILTIN_PRESET_ID);
}

function schemaIoBadges(compId) {
  if (!compId || typeof compFindById !== "function") return "";
  const c = compFindById(compId)?.item;
  if (!c) return "";
  const inn = typeof formatCompDiamInch === "function" ? formatCompDiamInch(c.diamIn) : (c.diamIn || "");
  const outv = typeof formatCompDiamInch === "function" ? formatCompDiamInch(c.diamOut) : (c.diamOut || "");
  return `<div class="schema-io-row">
    <span class="schema-io schema-io-in"><b>IN</b> ${inn ? escHtml(inn) : "—"}</span>
    <span class="schema-io schema-io-out"><b>OUT</b> ${outv ? escHtml(outv) : "—"}</span>
  </div>`;
}

function schemaSelectOptions(type, curId) {
  ensureComposants();
  const list = state.composants[type] || [];
  return `<option value="">— Choisir —</option>` + list.map((c) => {
    const lbl = (c.ref || c.modele || c.id).replace(/"/g, "&quot;");
    return `<option value="${c.id}"${curId === c.id ? " selected" : ""}>${lbl}</option>`;
  }).join("");
}

function schemaBubble(pac, role, type, label, cls) {
  const m = machineByPac(pac);
  const cur = m?.composantsLiens?.[role] || "";
  const procBtn = typeof procedureSchemaBtn === "function" ? procedureSchemaBtn(pac, { type: "role", role }) : "";
  return `<div class="schema-bubble ${cls}${cur ? " linked" : ""}">
    <div class="schema-bubble-lbl-row"><div class="schema-bubble-lbl">${escHtml(label)}</div>${procBtn}</div>
    <select class="schema-bubble-sel" onchange="editMachineCompLink('${escAttr(pac)}','${role}',this.value)">${schemaSelectOptions(type, cur)}</select>
    ${cur && !SCHEMA_NO_IO_ROLES.has(role) ? schemaIoBadges(cur) : ""}
  </div>`;
}

function schemaDraggable(pac, key, innerHtml, extraCls) {
  const layout = ensureFrigoLayout(machineByPac(pac));
  const pos = layout[key] || FRIGO_LAYOUT_DEFAULTS[key];
  return `<div class="schema-draggable${extraCls ? " " + extraCls : ""}" data-frigo-key="${escAttr(key)}" style="left:${pos.left}%;top:${pos.top}%">
    <div class="schema-drag-handle" title="Glisser pour déplacer">⋮⋮</div>
    ${innerHtml}
  </div>`;
}

function renderFrigoDraggables(pac) {
  const m = machineByPac(pac);
  const visible = getFrigoVisibleSet(m);
  const soloKeys = ["evap", "bot", "comp", "fi22", "cond", "res"];
  let h = soloKeys.filter((key) => visible.has(key)).map((key) => {
    const n = FRIGO_SCHEMA_NODES.find((x) => x.key === key);
    return schemaDraggable(pac, key, schemaBubble(pac, n.role, n.type, n.label, n.cls));
  }).join("");
  if (visible.has("detori")) {
    const det = FRIGO_SCHEMA_NODES.find((n) => n.role === "detendeur");
    const ori = FRIGO_SCHEMA_NODES.find((n) => n.role === "orificeDetendeur");
    const asm = `<div class="schema-detori-asm">
      <span class="schema-detori-asm-lbl">Assemblage</span>
      ${schemaBubble(pac, det.role, det.type, det.label, det.cls)}
      ${schemaBubble(pac, ori.role, ori.type, ori.label, ori.cls)}
    </div>`;
    h += schemaDraggable(pac, "detori", asm, "is-asm");
  }
  return h;
}

function renderFrigoLayoutBar(pac) {
  ensureFrigoLayoutPresets();
  const m = machineByPac(pac);
  const pacAttr = escAttr(pac);
  const curId = m?.frigoPresetId || "";
  const opts = state.frigoLayoutPresets.map((p) => {
    const sel = p.id === curId ? " selected" : "";
    return `<option value="${escAttr(p.id)}"${sel}>${escHtml(p.nom)}</option>`;
  }).join("");
  const visible = getFrigoVisibleSet(m);
  const chips = FRIGO_ALL_KEYS.map((key) => {
    const on = visible.has(key);
    return `<label class="schema-el-chip${on ? " on" : ""}">
      <input type="checkbox"${on ? " checked" : ""} onchange="toggleFrigoElement('${pacAttr}','${key}',this.checked)">
      ${escHtml(FRIGO_ELEMENT_LABELS[key])}
    </label>`;
  }).join("");
  const cur = state.frigoLayoutPresets.find((p) => p.id === curId);
  const delBtn = cur && !cur.builtin
    ? `<button type="button" class="btn-soft" onclick="deleteFrigoPreset('${pacAttr}','${escAttr(curId)}')">Supprimer</button>`
    : "";
  return `<div class="schema-layout-bar">
    <div class="schema-layout-row">
      <label class="schema-layout-lbl">Modèle
        <select class="schema-preset-sel" onchange="applyFrigoPreset('${pacAttr}',this.value)">${opts}</select>
      </label>
      <button type="button" class="btn-soft" onclick="promptSaveFrigoPreset('${pacAttr}')">Enregistrer la disposition</button>
      <button type="button" class="btn-soft" onclick="resetFrigoLayout('${pacAttr}')">Réorganiser</button>
      ${delBtn}
    </div>
    <div class="schema-layout-row schema-elements-row">
      <span class="schema-layout-lbl">Éléments</span>${chips}
    </div>
  </div>`;
}

function frigoPipeVisible(pipeId, visible) {
  const req = FRIGO_PIPE_REQUIRES[pipeId];
  return req && req.every((k) => visible.has(k));
}

function renderFrigoPipesTable(pac) {
  const m = machineByPac(pac);
  const visible = getFrigoVisibleSet(m);
  const t = ensureFrigoTuyaux(m);
  const pacAttr = escAttr(pac);
  const rows = FRIGO_PIPES.filter((p) => frigoPipeVisible(p.id, visible)).map((p) => {
    const cur = t[p.id] || {};
    const d = cur.diamMm != null ? cur.diamMm : "";
    const l = cur.longM != null ? cur.longM : "";
    const idAttr = escAttr(p.id);
    const procBtn = typeof procedureSchemaBtn === "function" ? procedureSchemaBtn(pac, { type: "pipe", pipeId: p.id }) : "";
    return `<tr>
      <td><span class="schema-circuit-dot circuit-${p.circuit}"></span>${escHtml(FRIGO_CIRCUIT_LABEL[p.circuit])}</td>
      <td>${escHtml(p.label)}</td>
      <td><input class="mono" type="number" step="1" min="0" value="${d}" placeholder="—" onchange="editFrigoTuyau('${pacAttr}','${idAttr}','diamMm',this.value)"></td>
      <td><input class="mono" type="number" step="0.1" min="0" value="${l}" placeholder="—" onchange="editFrigoTuyau('${pacAttr}','${idAttr}','longM',this.value)"></td>
      <td class="schema-pipe-proc">${procBtn || "—"}</td>
    </tr>`;
  }).join("");
  const body = rows || `<tr><td colspan="5" class="schema-pipes-empty">Aucun tronçon (ajoutez des éléments au schéma)</td></tr>`;
  return `<div class="schema-pipes-wrap">
    <div class="schema-pipes-head">Tuyauterie frigorifique</div>
    <table class="schema-pipes-tbl">
      <thead><tr><th>Circuit</th><th>Tronçon</th><th>Ø mm</th><th>L m</th><th>Proc.</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function frigoPickAnchor(canvas, fromKey, toKey, end) {
  const fromEl = canvas.querySelector(`[data-frigo-key="${fromKey}"]`);
  const toEl = canvas.querySelector(`[data-frigo-key="${toKey}"]`);
  if (!fromEl || !toEl) return "center";
  const fr = fromEl.getBoundingClientRect();
  const tr = toEl.getBoundingClientRect();
  const fcx = fr.left + fr.width / 2;
  const fcy = fr.top + fr.height / 2;
  const tcx = tr.left + tr.width / 2;
  const tcy = tr.top + tr.height / 2;
  const dx = tcx - fcx;
  const dy = tcy - fcy;
  if (Math.abs(dx) > Math.abs(dy) * 1.15) {
    if (end === "from") return dx > 0 ? "right" : "left";
    return dx > 0 ? "left" : "right";
  }
  if (end === "from") return dy > 0 ? "bottom" : "top";
  return dy > 0 ? "top" : "bottom";
}

function getFrigoAnchor(canvas, key, pt) {
  const el = canvas.querySelector(`[data-frigo-key="${key}"]`);
  if (!el) return null;
  const cr = canvas.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const sx = 1000 / cr.width;
  const sy = canvas.clientHeight / cr.height;
  const cx = (er.left + er.width / 2 - cr.left) * sx;
  const cy = (er.top + er.height / 2 - cr.top) * sy;
  const inset = 3;
  if (pt === "top") return { x: cx, y: (er.top - cr.top) * sy + inset };
  if (pt === "bottom") return { x: cx, y: (er.bottom - cr.top) * sy - inset };
  if (pt === "left") return { x: (er.left - cr.left) * sx + inset, y: cy };
  if (pt === "right") return { x: (er.right - cr.left) * sx - inset, y: cy };
  return { x: cx, y: cy };
}

function redrawFrigoWires(pac) {
  const canvas = document.querySelector(`.schema-frigo-canvas[data-pac="${CSS.escape(pac)}"]`);
  const svg = canvas?.querySelector(".schema-wires-dynamic");
  if (!svg || !canvas || !canvas.clientHeight) return;
  const visible = getFrigoVisibleSet(machineByPac(pac));
  const h = canvas.clientHeight;
  svg.setAttribute("viewBox", `0 0 1000 ${h}`);
  const paths = FRIGO_WIRE_EDGES.filter((e) => visible.has(e.from) && visible.has(e.to)).map((e) => {
    const fromPt = e.fromPt || frigoPickAnchor(canvas, e.from, e.to, "from");
    const toPt = e.toPt || frigoPickAnchor(canvas, e.from, e.to, "to");
    const a = getFrigoAnchor(canvas, e.from, fromPt);
    const b = getFrigoAnchor(canvas, e.to, toPt);
    if (!a || !b) return "";
    const w = e.circuit === "dis" && e.from === "comp" ? 2.6 : 2.2;
    return `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}" fill="none" stroke="${FRIGO_CIRCUIT_STROKE[e.circuit]}" stroke-width="${w}" stroke-linecap="round" opacity="0.55"/>`;
  }).join("");
  svg.innerHTML = paths;
}

let _frigoDrag = null;

function frigoDragEnd() {
  if (!_frigoDrag) return;
  const { pac, key, el, onMove, onUp } = _frigoDrag;
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("mouseup", onUp);
  document.removeEventListener("touchmove", onMove);
  document.removeEventListener("touchend", onUp);
  el.classList.remove("dragging");
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);
  if (!isNaN(left) && !isNaN(top)) saveFrigoLayoutPos(pac, key, left, top);
  _frigoDrag = null;
}

function frigoDragStart(e, handle) {
  if (e.type === "mousedown" && e.button !== 0) return;
  e.preventDefault();
  frigoDragEnd();
  const el = handle.closest("[data-frigo-key]");
  const canvas = el?.closest(".schema-frigo-canvas");
  if (!el || !canvas) return;
  const pac = canvas.dataset.pac;
  const key = el.dataset.frigoKey;
  const rect = canvas.getBoundingClientRect();
  const dr = el.getBoundingClientRect();
  const cx = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
  const cy = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
  const offsetX = cx - dr.left;
  const offsetY = cy - dr.top;
  el.classList.add("dragging");
  el.style.zIndex = "10";

  function onMove(ev) {
    const mx = ev.type.startsWith("touch") ? ev.touches[0].clientX : ev.clientX;
    const my = ev.type.startsWith("touch") ? ev.touches[0].clientY : ev.clientY;
    const left = ((mx - rect.left - offsetX) / rect.width) * 100;
    const top = ((my - rect.top - offsetY) / rect.height) * 100;
    el.style.left = Math.max(0, Math.min(82, left)).toFixed(1) + "%";
    el.style.top = Math.max(0, Math.min(85, top)).toFixed(1) + "%";
    redrawFrigoWires(pac);
  }

  function onUp() {
    el.style.zIndex = "";
    frigoDragEnd();
  }

  _frigoDrag = { pac, key, el, onMove, onUp };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
}

function initFrigoDrag(pac) {
  const canvas = document.querySelector(`.schema-frigo-canvas[data-pac="${CSS.escape(pac)}"]`);
  if (!canvas) return;
  canvas.querySelectorAll(".schema-drag-handle").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => frigoDragStart(e, handle));
    handle.addEventListener("touchstart", (e) => frigoDragStart(e, handle), { passive: false });
  });
  requestAnimationFrame(() => redrawFrigoWires(pac));
  bindSchemaResize();
}

function bindSchemaResize() {
  if (window._schemaResizeBound) return;
  window._schemaResizeBound = true;
  window.addEventListener("resize", () => {
    if (!MOPEN?.pac) return;
    if (MOPEN.tab === "composants-frigo") redrawFrigoWires(MOPEN.pac);
    if (MOPEN.tab === "composants-hydro") redrawHydroWires(MOPEN.pac);
  });
}

function schemaPacBubble(pac) {
  return `<div class="schema-bubble b-pac linked">
    <div class="schema-bubble-lbl">PAC</div>
    <div class="schema-bubble-pac">${escHtml(pac)}</div>
  </div>`;
}

function renderFrigoSchema(pac) {
  const gam = gammeByCode(machineByPac(pac)?.gammeCode);
  const fluide = gam ? (gam.fluide === "custom" ? (gam.fluideLabel || "Autre") : gam.fluide) : "—";
  const pacAttr = escAttr(pac);

  return `<div class="schema-panel schema-frigo">
    <div class="schema-head">
      <span class="schema-title">Composants frigorifiques</span>
      <span class="schema-meta mono">Fluide ${escHtml(fluide)} · <span class="schema-circuit-dot circuit-asp"></span>Asp. <span class="schema-circuit-dot circuit-dis"></span>Ref. <span class="schema-circuit-dot circuit-liq"></span>Liq.</span>
    </div>
    ${renderFrigoLayoutBar(pac)}
    <div class="schema-canvas schema-frigo-canvas" data-pac="${pacAttr}">
      <svg class="schema-wires schema-wires-dynamic" aria-hidden="true"></svg>
      ${renderFrigoDraggables(pac)}
      <span class="schema-caption c-capt">Captage</span>
      <span class="schema-caption c-chaud">Chauffage</span>
    </div>
    ${typeof renderFrigoTubeVariantsTable === "function" ? renderFrigoTubeVariantsTable(pac) : ""}
    <p class="schema-foot">Glissez les poignées <b>⋮⋮</b> · Versions tubes ci-dessus · 📋 procédures · <b>Production → Composants</b></p>
  </div>`;
}

/* ---------- Schéma hydraulique ---------- */

const HYDRO_LAYOUT_VERSION = 2;
const HYDRO_OPTIONAL_KEYS = ["filtreCapt", "potCapt", "filtreChaud", "potChaud"];
const HYDRO_SCHEMA_NODES = [
  { role: "circulateurFroid", type: "circulateur", label: "Circulateur captage", cls: "b-circ-f", key: "circCapt" },
  { role: "filtreCaptage", type: "filtre", label: "Filtre captage", cls: "b-filt-c", key: "filtreCapt" },
  { role: "potBoueCaptage", type: "pot_boue", label: "Pot à boue captage", cls: "b-pot-c", key: "potCapt" },
  { role: "circulateurChaud", type: "circulateur", label: "Circulateur chauffage", cls: "b-circ-c", key: "circChaud" },
  { role: "filtreChauffage", type: "filtre", label: "Filtre chauffage", cls: "b-filt-h", key: "filtreChaud" },
  { role: "potBoueChauffage", type: "pot_boue", label: "Pot à boue chauffage", cls: "b-pot-h", key: "potChaud" }
];
const HYDRO_DEFAULT_ELEMENTS = ["circCapt", "pac", "circChaud"];
const HYDRO_ALL_KEYS = ["circCapt", "filtreCapt", "potCapt", "pac", "circChaud", "filtreChaud", "potChaud"];
const HYDRO_ELEMENT_LABELS = {
  circCapt: "Circ. captage", filtreCapt: "Filtre captage", potCapt: "Pot à boue captage",
  pac: "PAC", circChaud: "Circ. chauffage", filtreChaud: "Filtre chauffage", potChaud: "Pot à boue chauffage"
};
/** Extérieur → intérieur (circulateur collé à la PAC). */
const HYDRO_LEFT_ORDER = ["filtreCapt", "potCapt", "circCapt"];
const HYDRO_RIGHT_ORDER = ["circChaud", "filtreChaud", "potChaud"];
const HYDRO_CIRCUIT_STROKE = { capt: "#0c7a8c", chaud: "#cf4310" };
const HYDRO_BUILTIN_PRESET_ID = "hydro_standard";

const HYDRO_LAYOUT_DEFAULTS = {
  filtreCapt: { left: 4, top: 42 },
  potCapt: { left: 12, top: 42 },
  circCapt: { left: 26, top: 42 },
  pac: { left: 44, top: 38 },
  circChaud: { left: 58, top: 42 },
  filtreChaud: { left: 74, top: 42 },
  potChaud: { left: 84, top: 42 }
};

function ensureHydroLayoutPresets() {
  if (!Array.isArray(state.hydroLayoutPresets)) state.hydroLayoutPresets = [];
  const builtinLayout = JSON.parse(JSON.stringify(HYDRO_LAYOUT_DEFAULTS));
  const existing = state.hydroLayoutPresets.find((p) => p.id === HYDRO_BUILTIN_PRESET_ID);
  if (!existing) {
    state.hydroLayoutPresets.unshift({
      id: HYDRO_BUILTIN_PRESET_ID,
      nom: "Standard (défaut)",
      builtin: true,
      elements: HYDRO_DEFAULT_ELEMENTS.slice(),
      layout: builtinLayout
    });
  } else {
    existing.layout = builtinLayout;
  }
  return state.hydroLayoutPresets;
}

function ensureHydroElements(m) {
  if (!m) return HYDRO_DEFAULT_ELEMENTS.slice();
  if (!Array.isArray(m.hydroElements) || !m.hydroElements.length) m.hydroElements = HYDRO_DEFAULT_ELEMENTS.slice();
  return m.hydroElements.filter((k) => HYDRO_ALL_KEYS.includes(k));
}

function getHydroVisibleSet(m) {
  return new Set(ensureHydroElements(m));
}

function ensureHydroLayout(m) {
  if (!m) return { ...HYDRO_LAYOUT_DEFAULTS };
  if (m.hydroLayoutVersion !== HYDRO_LAYOUT_VERSION) {
    delete m.hydroLayout;
    delete m.hydroPresetId;
    ensureHydroLayoutPresets();
    const builtin = state.hydroLayoutPresets.find((p) => p.id === HYDRO_BUILTIN_PRESET_ID);
    if (builtin) applyHydroPresetToMachine(m, builtin);
  }
  if (!m.hydroLayout || typeof m.hydroLayout !== "object") m.hydroLayout = {};
  const out = {};
  Object.keys(HYDRO_LAYOUT_DEFAULTS).forEach((k) => {
    const saved = m.hydroLayout[k];
    const def = HYDRO_LAYOUT_DEFAULTS[k];
    out[k] = { left: saved?.left != null ? saved.left : def.left, top: saved?.top != null ? saved.top : def.top };
  });
  return out;
}

function saveHydroLayoutPos(pac, key, left, top) {
  const m = machineByPac(pac);
  if (!m) return;
  if (!m.hydroLayout) m.hydroLayout = {};
  m.hydroLayout[key] = { left: Math.round(left * 10) / 10, top: Math.round(top * 10) / 10 };
  delete m.hydroPresetId;
}

function applyHydroPresetToMachine(m, preset) {
  if (!m || !preset) return;
  m.hydroLayout = JSON.parse(JSON.stringify(preset.layout));
  m.hydroElements = preset.elements.filter((k) => HYDRO_ALL_KEYS.includes(k));
  if (!m.hydroElements.length) m.hydroElements = HYDRO_DEFAULT_ELEMENTS.slice();
  m.hydroLayoutVersion = HYDRO_LAYOUT_VERSION;
  m.hydroPresetId = preset.id;
}

function applyHydroPreset(pac, presetId) {
  ensureHydroLayoutPresets();
  const preset = state.hydroLayoutPresets.find((p) => p.id === presetId);
  const m = machineByPac(pac);
  if (!preset || !m) return;
  applyHydroPresetToMachine(m, preset);
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-hydro") renderMachineModal();
}

function saveHydroPresetFromMachine(pac, nom) {
  const m = machineByPac(pac);
  if (!m) return;
  const name = String(nom || "").trim();
  if (!name) return;
  ensureHydroLayoutPresets();
  const preset = {
    id: "hpreset_" + Date.now().toString(36),
    nom: name,
    elements: ensureHydroElements(m).slice(),
    layout: JSON.parse(JSON.stringify(ensureHydroLayout(m)))
  };
  state.hydroLayoutPresets.push(preset);
  m.hydroPresetId = preset.id;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-hydro") renderMachineModal();
  toast("Modèle « " + name + " » enregistré");
}

function promptSaveHydroPreset(pac) {
  const nom = prompt("Nom du modèle hydraulique :");
  if (nom != null) saveHydroPresetFromMachine(pac, nom);
}

function deleteHydroPreset(pac, presetId) {
  ensureHydroLayoutPresets();
  const preset = state.hydroLayoutPresets.find((p) => p.id === presetId);
  if (!preset || preset.builtin) return;
  if (!confirm("Supprimer le modèle « " + preset.nom + " » ?")) return;
  state.hydroLayoutPresets = state.hydroLayoutPresets.filter((p) => p.id !== presetId);
  const m = machineByPac(pac);
  if (m?.hydroPresetId === presetId) delete m.hydroPresetId;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-hydro") renderMachineModal();
}

function toggleHydroElement(pac, key, on) {
  const m = machineByPac(pac);
  if (!m || !HYDRO_ALL_KEYS.includes(key)) return;
  let els = ensureHydroElements(m);
  if (key === "pac") return;
  if (on && !els.includes(key)) {
    els.push(key);
    if (HYDRO_OPTIONAL_KEYS.includes(key)) {
      if (!m.hydroLayout) m.hydroLayout = {};
      m.hydroLayout[key] = { ...HYDRO_LAYOUT_DEFAULTS[key] };
    }
  }
  if (!on) {
    const rest = els.filter((k) => k !== key);
    if (!rest.includes("pac")) return;
    els = rest;
  }
  m.hydroElements = els;
  delete m.hydroPresetId;
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-hydro") renderMachineModal();
}

function resetHydroLayout(pac) {
  applyHydroPreset(pac, HYDRO_BUILTIN_PRESET_ID);
}

function hydroDraggable(pac, key, innerHtml, extraCls) {
  const layout = ensureHydroLayout(machineByPac(pac));
  const pos = layout[key] || HYDRO_LAYOUT_DEFAULTS[key];
  return `<div class="schema-draggable${extraCls ? " " + extraCls : ""}" data-hydro-key="${escAttr(key)}" style="left:${pos.left}%;top:${pos.top}%">
    <div class="schema-drag-handle" title="Glisser pour déplacer">⋮⋮</div>
    ${innerHtml}
  </div>`;
}

function renderHydroDraggables(pac) {
  const m = machineByPac(pac);
  const visible = getHydroVisibleSet(m);
  const g = m ? ensureMachineGeneral(m) : null;
  const h = g?.hydraulique || {};
  let out = "";
  HYDRO_SCHEMA_NODES.forEach((n) => {
    if (!visible.has(n.key)) return;
    let inner = schemaBubble(pac, n.role, n.type, n.label, n.cls);
    if (n.key === "circCapt" && h.debitCaptageM3h != null) {
      inner += `<div class="schema-debit mono">${escHtml(fmt(h.debitCaptageM3h, 1) + " m³/h")}</div>`;
    }
    if (n.key === "circChaud" && h.debitChauffageM3h != null) {
      inner += `<div class="schema-debit mono">${escHtml(fmt(h.debitChauffageM3h, 1) + " m³/h")}</div>`;
    }
    out += hydroDraggable(pac, n.key, inner);
  });
  if (visible.has("pac")) {
    out += hydroDraggable(pac, "pac", schemaPacBubble(pac), "is-pac");
  }
  return out;
}

function renderHydroLayoutBar(pac) {
  ensureHydroLayoutPresets();
  const m = machineByPac(pac);
  const pacAttr = escAttr(pac);
  const curId = m?.hydroPresetId || "";
  const opts = state.hydroLayoutPresets.map((p) => {
    const sel = p.id === curId ? " selected" : "";
    return `<option value="${escAttr(p.id)}"${sel}>${escHtml(p.nom)}</option>`;
  }).join("");
  const visible = getHydroVisibleSet(m);
  const chips = HYDRO_ALL_KEYS.filter((k) => k !== "pac").map((key) => {
    const on = visible.has(key);
    return `<label class="schema-el-chip${on ? " on" : ""}">
      <input type="checkbox"${on ? " checked" : ""} onchange="toggleHydroElement('${pacAttr}','${key}',this.checked)">
      ${escHtml(HYDRO_ELEMENT_LABELS[key])}
    </label>`;
  }).join("");
  const cur = state.hydroLayoutPresets.find((p) => p.id === curId);
  const delBtn = cur && !cur.builtin
    ? `<button type="button" class="btn-soft" onclick="deleteHydroPreset('${pacAttr}','${escAttr(curId)}')">Supprimer</button>`
    : "";
  return `<div class="schema-layout-bar">
    <div class="schema-layout-row">
      <label class="schema-layout-lbl">Modèle
        <select class="schema-preset-sel" onchange="applyHydroPreset('${pacAttr}',this.value)">${opts}</select>
      </label>
      <button type="button" class="btn-soft" onclick="promptSaveHydroPreset('${pacAttr}')">Enregistrer la disposition</button>
      <button type="button" class="btn-soft" onclick="resetHydroLayout('${pacAttr}')">Réorganiser</button>
      ${delBtn}
    </div>
    <div class="schema-layout-row schema-elements-row">
      <span class="schema-layout-lbl">Éléments</span>${chips}
    </div>
  </div>`;
}

function buildHydroWireEdges(visible) {
  const edges = [];
  if (!visible.has("pac")) return edges;
  const left = HYDRO_LEFT_ORDER.filter((k) => visible.has(k));
  const right = HYDRO_RIGHT_ORDER.filter((k) => visible.has(k));
  for (let i = 0; i < left.length - 1; i++) {
    edges.push({ from: left[i], to: left[i + 1], circuit: "capt" });
  }
  if (left.length) {
    edges.push({ from: left[left.length - 1], to: "pac", circuit: "capt", fromPt: "right", toPt: "left" });
  }
  if (right.length) {
    edges.push({ from: "pac", to: right[0], circuit: "chaud", fromPt: "right", toPt: "left" });
    for (let i = 0; i < right.length - 1; i++) {
      edges.push({ from: right[i], to: right[i + 1], circuit: "chaud" });
    }
  }
  return edges;
}

function getHydroAnchor(canvas, key, pt) {
  const el = canvas.querySelector(`[data-hydro-key="${key}"]`);
  if (!el) return null;
  const cr = canvas.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const sx = 1000 / cr.width;
  const sy = canvas.clientHeight / cr.height;
  const cx = (er.left + er.width / 2 - cr.left) * sx;
  const cy = (er.top + er.height / 2 - cr.top) * sy;
  const inset = 3;
  if (pt === "top") return { x: cx, y: (er.top - cr.top) * sy + inset };
  if (pt === "bottom") return { x: cx, y: (er.bottom - cr.top) * sy - inset };
  if (pt === "left") return { x: (er.left - cr.left) * sx + inset, y: cy };
  if (pt === "right") return { x: (er.right - cr.left) * sx - inset, y: cy };
  return { x: cx, y: cy };
}

function hydroPickAnchor(canvas, fromKey, toKey, end) {
  const fromEl = canvas.querySelector(`[data-hydro-key="${fromKey}"]`);
  const toEl = canvas.querySelector(`[data-hydro-key="${toKey}"]`);
  if (!fromEl || !toEl) return "center";
  const fr = fromEl.getBoundingClientRect();
  const tr = toEl.getBoundingClientRect();
  const dx = (tr.left + tr.width / 2) - (fr.left + fr.width / 2);
  const dy = (tr.top + tr.height / 2) - (fr.top + fr.height / 2);
  if (Math.abs(dx) > Math.abs(dy) * 1.15) {
    if (end === "from") return dx > 0 ? "right" : "left";
    return dx > 0 ? "left" : "right";
  }
  if (end === "from") return dy > 0 ? "bottom" : "top";
  return dy > 0 ? "top" : "bottom";
}

function redrawHydroWires(pac) {
  const canvas = document.querySelector(`.schema-hydro-canvas[data-pac="${CSS.escape(pac)}"]`);
  const svg = canvas?.querySelector(".schema-wires-dynamic");
  if (!svg || !canvas || !canvas.clientHeight) return;
  const visible = getHydroVisibleSet(machineByPac(pac));
  const h = canvas.clientHeight;
  svg.setAttribute("viewBox", `0 0 1000 ${h}`);
  const paths = buildHydroWireEdges(visible).map((e) => {
    const fromPt = e.fromPt || hydroPickAnchor(canvas, e.from, e.to, "from");
    const toPt = e.toPt || hydroPickAnchor(canvas, e.from, e.to, "to");
    const a = getHydroAnchor(canvas, e.from, fromPt);
    const b = getHydroAnchor(canvas, e.to, toPt);
    if (!a || !b) return "";
    return `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}" fill="none" stroke="${HYDRO_CIRCUIT_STROKE[e.circuit]}" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>`;
  }).join("");
  svg.innerHTML = paths;
}

let _hydroDrag = null;

function hydroDragEnd() {
  if (!_hydroDrag) return;
  const { pac, onMove, onUp } = _hydroDrag;
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("mouseup", onUp);
  document.removeEventListener("touchmove", onMove);
  document.removeEventListener("touchend", onUp);
  _hydroDrag.el.classList.remove("dragging");
  const left = parseFloat(_hydroDrag.el.style.left);
  const top = parseFloat(_hydroDrag.el.style.top);
  if (!isNaN(left) && !isNaN(top)) saveHydroLayoutPos(pac, _hydroDrag.key, left, top);
  _hydroDrag = null;
}

function hydroDragStart(e, handle) {
  if (e.type === "mousedown" && e.button !== 0) return;
  e.preventDefault();
  hydroDragEnd();
  const el = handle.closest("[data-hydro-key]");
  const canvas = el?.closest(".schema-hydro-canvas");
  if (!el || !canvas) return;
  const pac = canvas.dataset.pac;
  const key = el.dataset.hydroKey;
  const rect = canvas.getBoundingClientRect();
  const dr = el.getBoundingClientRect();
  const cx = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
  const cy = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
  const offsetX = cx - dr.left;
  const offsetY = cy - dr.top;
  el.classList.add("dragging");
  el.style.zIndex = "10";

  function onMove(ev) {
    const mx = ev.type.startsWith("touch") ? ev.touches[0].clientX : ev.clientX;
    const my = ev.type.startsWith("touch") ? ev.touches[0].clientY : ev.clientY;
    el.style.left = Math.max(0, Math.min(82, ((mx - rect.left - offsetX) / rect.width) * 100)).toFixed(1) + "%";
    el.style.top = Math.max(0, Math.min(85, ((my - rect.top - offsetY) / rect.height) * 100)).toFixed(1) + "%";
    redrawHydroWires(pac);
  }

  function onUp() {
    el.style.zIndex = "";
    hydroDragEnd();
  }

  _hydroDrag = { pac, key, el, onMove, onUp };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
}

function initHydroDrag(pac) {
  const canvas = document.querySelector(`.schema-hydro-canvas[data-pac="${CSS.escape(pac)}"]`);
  if (!canvas) return;
  canvas.querySelectorAll(".schema-drag-handle").forEach((handle) => {
    handle.addEventListener("mousedown", (e) => hydroDragStart(e, handle));
    handle.addEventListener("touchstart", (e) => hydroDragStart(e, handle), { passive: false });
  });
  requestAnimationFrame(() => redrawHydroWires(pac));
  bindSchemaResize();
}

function renderHydroSchema(pac) {
  const pacAttr = escAttr(pac);
  const estim = typeof renderHydroMachineEstim === "function" ? renderHydroMachineEstim(pac) : "";
  return `<div class="schema-panel schema-hydro">
    <div class="schema-head">
      <span class="schema-title">Composants hydrauliques</span>
      <span class="schema-meta mono"><span class="schema-circuit-dot circuit-liq"></span>Captage <span class="schema-circuit-dot circuit-dis"></span>Chauffage</span>
    </div>
    ${estim}
    ${renderHydroLayoutBar(pac)}
    <div class="schema-canvas schema-hydro-canvas" data-pac="${pacAttr}">
      <svg class="schema-wires schema-wires-dynamic" aria-hidden="true"></svg>
      ${renderHydroDraggables(pac)}
      <span class="schema-caption c-capt">Captage</span>
      <span class="schema-caption c-chaud">Chauffage</span>
    </div>
    <p class="schema-foot">Glissez les poignées <b>⋮⋮</b> · Pdc estimée : onglet <b>Projet · E</b></p>
  </div>`;
}

function renderMachineFrigo(pac) {
  return renderFrigoSchema(pac);
}

function renderMachineHydro(pac) {
  return renderHydroSchema(pac);
}
