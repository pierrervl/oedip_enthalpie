/* OEDIP — catalogue composants hydrauliques & frigorifiques */
const COMP_TYPES = {
  circulateur: {
    label: "Circulateur",
    icon: "⟳",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "debitM3h", label: "Débit nominal", unit: "m³/h", type: "number", step: 0.1 },
      { key: "hmtM", label: "Hauteur manométrique", unit: "m", type: "number", step: 0.1 },
      { key: "iMaxA", label: "Courant max", unit: "A", type: "number", step: 0.01 },
      { key: "puissanceW", label: "Puissance moteur", unit: "W", type: "number" },
      { key: "rendementPct", label: "Rendement", unit: "%", type: "number", step: 1 },
      { key: "tension", label: "Alimentation", type: "select", options: [["2", "Indiff."], ["0", "Mono 230V"], ["1", "Tri 400V"]] },
      { key: "fluide", label: "Fluide circuit", type: "text", placeholder: "eau, glycolé 30 %…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.debitM3h) p.push(fmt(c.debitM3h, 1) + " m³/h");
      if (c.hmtM) p.push("HMT " + fmt(c.hmtM, 1) + " m");
      if (c.iMaxA) p.push(fmt(c.iMaxA, 2) + " A");
      if (c.puissanceW) p.push(fmt(c.puissanceW, 0) + " W");
      if (c.courbeHmt?.length) p.push(c.courbeHmt.length + " pts courbe");
      return p.join(" · ") || "—";
    }
  },
  compresseur: {
    label: "Compresseur",
    icon: "⚙",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeComp", label: "Technologie", type: "select", options: [["scroll", "Scroll"], ["rotary", "Rotatif"], ["recip", "Piston"], ["autre", "Autre"]] },
      { key: "fluide", label: "Fluide frigorigène", type: "text" },
      { key: "pFroidKW", label: "Puissance frigorifique", unit: "kW", type: "number", step: 0.1 },
      { key: "pChaudKW", label: "Puissance calorifique", unit: "kW", type: "number", step: 0.1 },
      { key: "debitMh", label: "Débit massique", unit: "kg/h", type: "number" },
      { key: "cop", label: "COP indicatif", type: "number", step: 0.01 },
      { key: "iMaxA", label: "Courant max", unit: "A", type: "number", step: 0.1 },
      { key: "tension", label: "Alimentation", type: "select", options: [["2", "Indiff."], ["0", "Mono 230V"], ["1", "Tri 400V"]] },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.pChaudKW) p.push(fmt(c.pChaudKW, 1) + " kW chaud");
      if (c.pFroidKW) p.push(fmt(c.pFroidKW, 1) + " kW froid");
      if (c.cop) p.push("COP " + fmt(c.cop, 2));
      if (c.fluide) p.push(c.fluide);
      return p.join(" · ") || "—";
    }
  },
  echangeur_plaques: {
    label: "Échangeur à plaques",
    icon: "▦",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "pThermKW", label: "Puissance thermique", unit: "kW", type: "number", step: 0.1 },
      { key: "surfaceM2", label: "Surface échange", unit: "m²", type: "number", step: 0.01 },
      { key: "plaques", label: "Nombre de plaques", type: "number" },
      { key: "dpMaxKpa", label: "Perte de charge max", unit: "kPa", type: "number", step: 0.1 },
      { key: "debitPrimM3h", label: "Débit primaire", unit: "m³/h", type: "number", step: 0.1 },
      { key: "debitSecM3h", label: "Débit secondaire", unit: "m³/h", type: "number", step: 0.1 },
      { key: "materiau", label: "Matériau / brasage", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.pThermKW) p.push(fmt(c.pThermKW, 1) + " kW");
      if (c.surfaceM2) p.push(fmt(c.surfaceM2, 2) + " m²");
      if (c.plaques) p.push(c.plaques + " plaques");
      if (c.courbesPdc?.length) {
        const n = c.courbesPdc.reduce((s, cu) => s + (cu.points?.length || 0), 0);
        const reg = c.courbesPdc.map((cu) => cu.regime).filter(Boolean).join(", ");
        p.push(n + " pts Pdc" + (reg ? " (" + reg + ")" : ""));
      }
      return p.join(" · ") || "—";
    }
  },
  detendeur: {
    label: "Détendeur",
    icon: "◇",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeDet", label: "Type", type: "select", options: [["tev", "TEV"], ["txv", "TXV"], ["exv", "EXV électronique"], ["capillaire", "Capillaire"], ["autre", "Autre"]] },
      { key: "fluide", label: "Fluide frigorigène", type: "text" },
      { key: "capaciteKW", label: "Capacité", unit: "kW", type: "number", step: 0.1 },
      { key: "orificeMm", label: "Orifice / tige", unit: "mm", type: "number", step: 0.1 },
      { key: "shK", label: "Surchauffe consigne", unit: "K", type: "number", step: 0.1 },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.typeDet) p.push(String(c.typeDet).toUpperCase());
      if (c.capaciteKW) p.push(fmt(c.capaciteKW, 1) + " kW");
      if (c.fluide) p.push(c.fluide);
      return p.join(" · ") || "—";
    }
  },
  reservoir_liquide: {
    label: "Réservoir liquide",
    icon: "▣",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "volumeL", label: "Volume", unit: "L", type: "number", step: 0.1 },
      { key: "dnMm", label: "Diamètre raccords", unit: "mm", type: "number" },
      { key: "pMaxBar", label: "Pression max", unit: "bar", type: "number", step: 0.1 },
      { key: "fluide", label: "Fluide frigorigène", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.volumeL) p.push(fmt(c.volumeL, 0) + " L");
      if (c.pMaxBar) p.push(fmt(c.pMaxBar, 1) + " bar");
      if (c.fluide) p.push(c.fluide);
      return p.join(" · ") || "—";
    }
  },
  filtre: {
    label: "Filtre",
    icon: "▥",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "dnMm", label: "Diamètre nominal", unit: "mm", type: "number" },
      { key: "mailleMic", label: "Maille / micronage", unit: "µm", type: "number" },
      { key: "pdcKpa", label: "Perte de charge", unit: "kPa", type: "number", step: 0.1 },
      { key: "fluide", label: "Fluide circuit", type: "text", placeholder: "eau, glycolé…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      if (c.mailleMic) p.push(fmt(c.mailleMic, 0) + " µm");
      return p.join(" · ") || "—";
    }
  },
  pot_boue: {
    label: "Pot à boue",
    icon: "◎",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "dnMm", label: "Diamètre nominal", unit: "mm", type: "number" },
      { key: "volumeL", label: "Volume", unit: "L", type: "number", step: 0.1 },
      { key: "pdcKpa", label: "Perte de charge", unit: "kPa", type: "number", step: 0.1 },
      { key: "fluide", label: "Fluide circuit", type: "text", placeholder: "eau, glycolé…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      if (c.volumeL) p.push(fmt(c.volumeL, 0) + " L");
      return p.join(" · ") || "—";
    }
  },
  bouteille_anticoup: {
    label: "Bouteille anticoup de liquide",
    icon: "◆",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "volumeL", label: "Volume", unit: "L", type: "number", step: 0.1 },
      { key: "dnMm", label: "Diamètre raccords", unit: "mm", type: "number" },
      { key: "fluide", label: "Fluide frigorigène", type: "text" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.volumeL) p.push(fmt(c.volumeL, 0) + " L");
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      if (c.fluide) p.push(c.fluide);
      return p.join(" · ") || "—";
    }
  }
};

const COMP_CONN_FIELDS = [
  { key: "diamIn", label: "IN", type: "text", placeholder: 'Entrée · ex. 3/8"' },
  { key: "diamOut", label: "OUT", type: "text", placeholder: 'Sortie · ex. 1/2"' }
];

function compIoSummary(c) {
  const p = [];
  if (c.diamIn) p.push("IN " + formatCompDiamInch(c.diamIn));
  if (c.diamOut) p.push("OUT " + formatCompDiamInch(c.diamOut));
  return p.join(" · ");
}

function formatCompDiamInch(val) {
  if (val == null || val === "") return "";
  const s = String(val).trim();
  return s.endsWith('"') ? s : `${s}"`;
}

Object.values(COMP_TYPES).forEach((def) => {
  const notesIdx = def.fields.findIndex((f) => f.key === "notes");
  const at = notesIdx >= 0 ? notesIdx : def.fields.length;
  def.fields.splice(at, 0, ...COMP_CONN_FIELDS.map((f) => ({ ...f })));
  const origSummary = def.summary;
  def.summary = function (c) {
    const io = compIoSummary(c);
    const base = origSummary.call(this, c);
    if (io && base && base !== "—") return `${io} · ${base}`;
    if (io) return io;
    return base;
  };
});

function defaultComposantsCatalog() {
  const out = {};
  Object.keys(COMP_TYPES).forEach((k) => (out[k] = []));
  return out;
}

function bundledComposantsData() {
  const root = typeof OEDIP_DEFAULT_CATALOG !== "undefined" ? OEDIP_DEFAULT_CATALOG : null;
  return root?.data?.composants || root?.composants || null;
}

function composantCount(comp) {
  if (!comp || typeof comp !== "object") return 0;
  return Object.keys(COMP_TYPES).reduce((n, k) => n + (comp[k]?.length || 0), 0);
}

function bundledComposantCount() {
  return composantCount(bundledComposantsData());
}

function assignMissingCompIds() {
  Object.keys(COMP_TYPES).forEach((k) => {
    (state.composants[k] || []).forEach((c) => {
      if (!c.id) c.id = nextCompId();
    });
  });
}

/** Réinjecte / complète la bibliothèque embarquée (cloud ou import partiel, courbes manquantes…). */
function ensureBundledComposants() {
  ensureComposants();
  const bc = bundledComposantsData();
  if (!bc) {
    assignMissingCompIds();
    return;
  }
  Object.keys(COMP_TYPES).forEach((k) => {
    const src = bc[k];
    if (!Array.isArray(src) || !src.length) return;
    if (!Array.isArray(state.composants[k])) state.composants[k] = [];
    src.forEach((item) => {
      const j = state.composants[k].findIndex(
        (c) =>
          (item.id && c.id === item.id) ||
          (item.ref && c.ref === item.ref) ||
          (item.modele && c.modele === item.modele)
      );
      if (j >= 0) {
        const cur = state.composants[k][j];
        state.composants[k][j] = {
          ...item,
          ...cur,
          id: cur.id || item.id || nextCompId(),
          courbeHmt:
            cur.courbeHmt?.length >= 2 ? cur.courbeHmt : item.courbeHmt || cur.courbeHmt,
          courbesPdc:
            cur.courbesPdc?.length ? cur.courbesPdc : item.courbesPdc || cur.courbesPdc,
        };
      } else {
        state.composants[k].push({ ...item, id: item.id || nextCompId() });
      }
    });
  });
  assignMissingCompIds();
}

function ensureComposants() {
  if (!state.composants || typeof state.composants !== "object") state.composants = defaultComposantsCatalog();
  Object.keys(COMP_TYPES).forEach((k) => {
    if (!Array.isArray(state.composants[k])) state.composants[k] = [];
  });
  if (typeof OEDIP_CIRCULATEURS_WILO !== "undefined") mergeCirculateursCatalog(OEDIP_CIRCULATEURS_WILO);
  if (typeof mergeEchangeursPdcIntoComposants === "function") mergeEchangeursPdcIntoComposants(state.composants);
  assignMissingCompIds();
}

/** Fusionne ou met à jour des circulateurs par référence (courbes débit/HMT). */
function mergeCirculateursCatalog(items) {
  if (!items?.length || !Array.isArray(state.composants?.circulateur)) return;
  const list = state.composants.circulateur;
  items.forEach((item) => {
    const key = item.ref || item.modele;
    if (!key) return;
    const j = list.findIndex((c) => (c.ref || c.modele) === key);
    if (j >= 0) list[j] = { ...item, id: list[j].id };
    else list.push({ ...item });
  });
}

/** Emplacements composants principaux liés à une machine (référence id catalogue). */
const MACHINE_COMP_SLOTS = [
  { role: "compresseur", type: "compresseur", label: "Compresseur" },
  { role: "bouteilleAspiration", type: "bouteille_anticoup", label: "Bouteille aspiration" },
  { role: "reservoirLiquide", type: "reservoir_liquide", label: "Réservoir liquide" },
  { role: "echangeurB26", type: "echangeur_plaques", label: "Évaporateur F80 (captage)" },
  { role: "echangeurF80", type: "echangeur_plaques", label: "Condenseur B26 (eau)" },
  { role: "echangeurFI22", type: "echangeur_plaques", label: "Désurchauffeur" },
  { role: "detendeur", type: "detendeur", label: "Détendeur" },
  { role: "orificeDetendeur", type: "detendeur", label: "Orifice détendeur" },
  { role: "circulateurFroid", type: "circulateur", label: "Circulateur captage" },
  { role: "filtreCaptage", type: "filtre", label: "Filtre captage" },
  { role: "potBoueCaptage", type: "pot_boue", label: "Pot à boue captage" },
  { role: "circulateurChaud", type: "circulateur", label: "Circulateur chauffage" },
  { role: "filtreChauffage", type: "filtre", label: "Filtre chauffage" },
  { role: "potBoueChauffage", type: "pot_boue", label: "Pot à boue chauffage" },
  { role: "circulateurEcs", type: "circulateur", label: "Circulateur ECS" },
];

function compFindById(id) {
  if (!id) return null;
  for (const type of Object.keys(COMP_TYPES)) {
    const item = (state.composants[type] || []).find((c) => c.id === id);
    if (item) return { type, item };
  }
  return null;
}

function ensureMachineComposantsLiens(m) {
  if (!m) return {};
  if (!m.composantsLiens || typeof m.composantsLiens !== "object") m.composantsLiens = {};
  return m.composantsLiens;
}

function setMachineCompLink(pac, role, compId) {
  const m = machineByPac(pac);
  if (!m) return;
  const liens = ensureMachineComposantsLiens(m);
  if (!compId) delete liens[role];
  else liens[role] = compId;
}

function nextCompId() {
  return "cmp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function emptyCompItem(type) {
  const item = { id: nextCompId(), type };
  COMP_TYPES[type].fields.forEach((f) => {
    if (f.type === "select" && f.options) item[f.key] = f.options[0][0];
    else item[f.key] = "";
  });
  return item;
}

let COMP_EDIT = null;
let COMP_TYPE_ACTIVE = "circulateur";
let COMP_SUBVIEW = "list";

const CIRC_CURVE_COLORS = [
  "#0c7a8c", "#cf4310", "#2f7d3b", "#6b4c9a", "#b5740c", "#c41e6a",
  "#1a6b8a", "#8b4513", "#228b22", "#9932cc", "#dc143c", "#2e8b57", "#4682b4"
];

function setCompType(t) {
  COMP_TYPE_ACTIVE = t;
  COMP_SUBVIEW = "list";
  document.querySelectorAll(".comp-tab").forEach((b) => b.classList.toggle("on", b.dataset.comp === t));
  renderComposants();
}

function setCompSubView(v) {
  COMP_SUBVIEW = v;
  renderComposants();
}

function circulateursWithCurve() {
  return (state.composants.circulateur || []).filter(
    (c) => Array.isArray(c.courbeHmt) && c.courbeHmt.length >= 2
  );
}

function renderCompSubTabs() {
  const el = $("compSubTabs");
  if (!el) return;
  if (COMP_TYPE_ACTIVE === "circulateur") {
    el.style.display = "flex";
    el.innerHTML = `
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "list" ? " on" : ""}" onclick="setCompSubView('list')">Fiches</button>
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "curves" ? " on" : ""}" onclick="setCompSubView('curves')">Courbes HMT</button>`;
    return;
  }
  if (COMP_TYPE_ACTIVE === "echangeur_plaques") {
    el.style.display = "flex";
    el.innerHTML = `
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "list" ? " on" : ""}" onclick="setCompSubView('list')">Fiches</button>
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "curves" ? " on" : ""}" onclick="setCompSubView('curves')">Courbes Pdc</button>`;
    return;
  }
  el.style.display = "none";
}

function echangeurPdcSeries() {
  const out = [];
  (state.composants.echangeur_plaques || []).forEach((e) => {
    (e.courbesPdc || []).forEach((cu) => {
      if (!cu.points || cu.points.length < 2) return;
      const ref = e.ref || e.modele || "—";
      const regime = cu.regime || "—";
      out.push({ ref, regime, label: `${ref} · ${regime}`, points: cu.points });
    });
  });
  return out;
}

function renderEchangeurPdcCurvesPanel() {
  const series = echangeurPdcSeries();
  const refsWithCurve = new Set(series.map((s) => s.ref));
  const without = (state.composants.echangeur_plaques || []).filter(
    (e) => !refsWithCurve.has(e.ref || e.modele)
  );
  if (!series.length) {
    return `<div class="circ-curves-empty">Aucune courbe débit/Pdc enregistrée. Importez les échangeurs SWEP (<b>circu.xlsx</b> · feuille « echangeurs pdc ») puis <span class="mono">npm run echangeurs:import</span> et <span class="mono">npm run default:build</span>.</div>`;
  }
  const hydro = typeof LAST !== "undefined" && LAST?.hydro?.active ? LAST.hydro : null;
  const hydroHint = hydro?.pdcEchangeurKpa > 0
    ? ` · <b>Point projet</b> : ${fmt(hydro.debitM3h, 2)} m³/h @ ${fmt(hydro.pdcEchangeurKpa, 1)} kPa${hydro.pdcEchangeurRef ? " (" + escHtml(hydro.pdcEchangeurRef) + ")" : ""}`
    : hydro
      ? ` · <b>Débit projet</b> : ${fmt(hydro.debitM3h, 2)} m³/h (Pdc échangeur non renseignée)`
      : "";
  return `<div class="circ-curves-panel">
    <p class="hint circ-curves-hint">${series.length} courbe(s) — perte de charge en fonction du débit${hydroHint}</p>
    <div class="circ-chart-wrap" id="circChartWrap"><div class="circ-chart-tooltip" id="circChartTooltip" hidden></div><svg id="circChartSvg" role="img" aria-label="Courbes Pdc des échangeurs"></svg></div>
    <div class="circ-legend" id="circChartLegend"></div>
    ${without.length ? `<p class="hint circ-no-curve"><b>Sans courbe :</b> ${without.map((c) => escHtml(c.ref || c.modele || "—")).join(" · ")}</p>` : ""}
  </div>`;
}

let _echPdcChartMeta = null;

function echPdcNearestOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return { x: a.x, y: a.y, debit: a.debit, pdcKpa: a.pdcKpa, dist: Math.hypot(p.x - a.x, p.y - a.y) };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return {
    x, y,
    debit: a.debit + t * (b.debit - a.debit),
    pdcKpa: a.pdcKpa + t * (b.pdcKpa - a.pdcKpa),
    dist: Math.hypot(p.x - x, p.y - y)
  };
}

function echPdcFindHoverHit(svgPt) {
  if (!_echPdcChartMeta || !svgPt) return null;
  let best = null;
  _echPdcChartMeta.series.forEach((s, si) => {
    s.points.forEach((pt, pi) => {
      const dist = Math.hypot(svgPt.x - pt.x, svgPt.y - pt.y);
      if (dist < 14 && (!best || dist < best.dist || best.kind === "line")) {
        best = { kind: "point", dist, si, pi, x: pt.x, y: pt.y, debit: pt.debit, pdcKpa: pt.pdcKpa, label: s.label, color: s.color };
      }
    });
    for (let j = 0; j < s.points.length - 1; j++) {
      const hit = echPdcNearestOnSegment(svgPt, s.points[j], s.points[j + 1]);
      if (hit.dist < 12 && (!best || hit.dist < best.dist)) {
        best = { kind: "line", dist: hit.dist, si, x: hit.x, y: hit.y, debit: hit.debit, pdcKpa: hit.pdcKpa, label: s.label, color: s.color };
      }
    }
  });
  return best;
}

function echPdcUpdateChartHighlight(hit) {
  const svg = $("circChartSvg");
  if (!svg) return;
  svg.querySelectorAll(".circ-curve-line").forEach((el, i) => {
    const on = hit && hit.si === i;
    el.classList.toggle("active", on);
    el.classList.toggle("dim", hit && !on);
  });
  const hl = svg.querySelector("#circHlDot");
  const ring = svg.querySelector("#circHlRing");
  if (!hit) {
    if (hl) hl.setAttribute("visibility", "hidden");
    if (ring) ring.setAttribute("visibility", "hidden");
    return;
  }
  if (hl) {
    hl.setAttribute("cx", hit.x.toFixed(1));
    hl.setAttribute("cy", hit.y.toFixed(1));
    hl.setAttribute("fill", hit.color);
    hl.setAttribute("visibility", "visible");
  }
  if (ring) {
    ring.setAttribute("cx", hit.x.toFixed(1));
    ring.setAttribute("cy", hit.y.toFixed(1));
    ring.setAttribute("stroke", hit.color);
    ring.setAttribute("visibility", "visible");
  }
}

function echPdcShowChartTooltip(wrap, tooltip, evt, hit) {
  if (!tooltip || !wrap) return;
  if (!hit) {
    tooltip.hidden = true;
    tooltip.classList.remove("show");
    return;
  }
  tooltip.hidden = false;
  tooltip.classList.add("show");
  tooltip.innerHTML = `<strong>${escHtml(hit.label)}</strong><span class="circ-tt-row"><b>Débit</b> ${fmt(hit.debit, 2)} m³/h</span><span class="circ-tt-row"><b>Pdc</b> ${fmt(hit.pdcKpa, 1)} kPa</span>`;
  const rect = wrap.getBoundingClientRect();
  tooltip.style.left = `${evt.clientX - rect.left + 12}px`;
  tooltip.style.top = `${evt.clientY - rect.top - 8}px`;
}

function initEchPdcChartHover(wrap, svg) {
  if (wrap._echPdcHoverBound) return;
  wrap._echPdcHoverBound = true;
  const tooltip = $("circChartTooltip");

  function onMove(evt) {
    const svgPt = circChartSvgPoint(svg, evt);
    const hit = echPdcFindHoverHit(svgPt);
    echPdcUpdateChartHighlight(hit);
    echPdcShowChartTooltip(wrap, tooltip, evt, hit);
    wrap.style.cursor = hit ? "crosshair" : "default";
  }

  function onLeave() {
    echPdcUpdateChartHighlight(null);
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.classList.remove("show");
    }
    wrap.style.cursor = "default";
  }

  wrap.addEventListener("mousemove", onMove);
  wrap.addEventListener("mouseleave", onLeave);
}

function drawEchangeurPdcCurvesChart() {
  const wrap = $("circChartWrap");
  const svg = $("circChartSvg");
  if (!wrap || !svg) return;
  const allSeries = echangeurPdcSeries();
  if (!allSeries.length) return;

  const W = Math.max(720, wrap.clientWidth || 900);
  const H = 420;
  const pad = { l: 56, r: 24, t: 28, b: 48 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  let maxD = 0;
  let maxP = 0;
  allSeries.forEach((s) => {
    s.points.forEach((pt) => {
      if (pt.debit > maxD) maxD = pt.debit;
      if (pt.pdcKpa > maxP) maxP = pt.pdcKpa;
    });
  });
  const hydro = typeof LAST !== "undefined" && LAST?.hydro?.active ? LAST.hydro : null;
  if (hydro) {
    if (hydro.debitM3h > maxD) maxD = hydro.debitM3h;
    if (hydro.pdcEchangeurKpa > maxP) maxP = hydro.pdcEchangeurKpa;
  }
  maxD = Math.max(maxD * 1.05, 1);
  maxP = Math.max(maxP * 1.08, 1);

  const xAt = (d) => pad.l + (d / maxD) * plotW;
  const yAt = (p) => pad.t + plotH - (p / maxP) * plotH;

  let grid = "";
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxP * i) / ticks;
    const y = yAt(v);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
    grid += `<text x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--ink-soft)" font-size="9">${fmt(v, 0)}</text>`;
  }
  for (let i = 0; i <= ticks; i++) {
    const v = (maxD * i) / ticks;
    const x = xAt(v);
    grid += `<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${pad.t + plotH}" stroke="var(--line)" stroke-dasharray="3 4" opacity=".5"/>`;
    grid += `<text x="${x.toFixed(1)}" y="${(H - 14).toFixed(1)}" text-anchor="middle" fill="var(--ink-soft)" font-size="9">${fmt(v, 1)}</text>`;
  }

  const series = [];
  let curves = "";
  let legendHtml = "";
  allSeries.forEach((s, i) => {
    const col = CIRC_CURVE_COLORS[i % CIRC_CURVE_COLORS.length];
    const pts = [...s.points].sort((a, b) => a.debit - b.debit);
    const mapped = pts.map((pt) => ({ debit: pt.debit, pdcKpa: pt.pdcKpa, x: xAt(pt.debit), y: yAt(pt.pdcKpa) }));
    series.push({ label: s.label, color: col, points: mapped });
    const poly = mapped.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
    curves += `<polyline class="circ-curve-line" data-idx="${i}" points="${poly}" fill="none" stroke="${col}" stroke-width="2.2" opacity=".88"/>`;
    mapped.forEach((pt) => {
      curves += `<circle class="circ-curve-dot" data-idx="${i}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.5" fill="${col}"/>`;
    });
    legendHtml += `<span class="circ-leg-item" data-leg-idx="${i}"><span class="circ-leg-swatch" style="background:${col}"></span>${escHtml(s.label)}</span>`;
  });

  _echPdcChartMeta = { W, H, series };

  let opSvg = "";
  if (hydro?.pdcEchangeurKpa > 0 && hydro.debitM3h > 0) {
    const ox = xAt(hydro.debitM3h);
    const oy = yAt(hydro.pdcEchangeurKpa);
    const yBase = pad.t + plotH;
    opSvg = `<g class="circ-op-point" pointer-events="none">
      <line x1="${ox.toFixed(1)}" y1="${yBase.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" stroke="var(--heat)" stroke-dasharray="4 3" opacity=".55"/>
      <line x1="${pad.l}" y1="${oy.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" stroke="var(--heat)" stroke-dasharray="4 3" opacity=".55"/>
      <circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="5.5" fill="var(--heat)" stroke="#fff" stroke-width="1.5"/>
      <text x="${Math.min(ox + 8, W - pad.r - 40).toFixed(1)}" y="${Math.max(oy - 8, pad.t + 10).toFixed(1)}" fill="var(--heat)" font-size="9.5" font-weight="600" font-family="var(--sans)">Projet</text>
    </g>`;
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <text x="${pad.l}" y="16" fill="var(--ink)" font-size="11" font-family="var(--sans)">Pdc (kPa)</text>
    ${grid}
    <line x1="${pad.l}" y1="${(pad.t + plotH).toFixed(1)}" x2="${W - pad.r}" y2="${(pad.t + plotH).toFixed(1)}" stroke="var(--line-strong)"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${(pad.t + plotH).toFixed(1)}" stroke="var(--line-strong)"/>
    ${curves}
    ${opSvg}
    <circle id="circHlRing" cx="0" cy="0" r="7" fill="none" stroke="#000" stroke-width="2" visibility="hidden" pointer-events="none"/>
    <circle id="circHlDot" cx="0" cy="0" r="4" fill="#000" visibility="hidden" pointer-events="none"/>
    <text x="${(pad.l + plotW / 2).toFixed(1)}" y="${(H - 2).toFixed(1)}" text-anchor="middle" fill="var(--ink-soft)" font-size="10" font-family="var(--sans)">Débit (m³/h)</text>`;

  const leg = $("circChartLegend");
  if (leg) {
    leg.innerHTML = legendHtml;
    leg.querySelectorAll(".circ-leg-item").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const idx = +el.dataset.legIdx;
        svg.querySelectorAll(".circ-curve-line").forEach((ln, i) => {
          ln.classList.toggle("active", i === idx);
          ln.classList.toggle("dim", i !== idx);
        });
      });
      el.addEventListener("mouseleave", () => {
        svg.querySelectorAll(".circ-curve-line").forEach((ln) => ln.classList.remove("active", "dim"));
      });
    });
  }

  wrap._echPdcHoverBound = false;
  initEchPdcChartHover(wrap, svg);
}

function renderCirculateurCurvesPanel() {
  const withCurve = circulateursWithCurve();
  const without = (state.composants.circulateur || []).filter(
    (c) => !Array.isArray(c.courbeHmt) || c.courbeHmt.length < 2
  );
  if (!withCurve.length) {
    return `<div class="circ-curves-empty">Aucune courbe débit/HMT enregistrée. Importez des circulateurs Wilo (<b>circu.xlsx</b>) ou ajoutez un tableau <span class="mono">courbeHmt</span> sur chaque fiche.</div>`;
  }
  const hydroHint = typeof LAST !== "undefined" && LAST?.hydro?.active
    ? ` · <b>Point projet</b> : ${fmt(LAST.hydro.debitM3h, 2)} m³/h @ ${fmt(LAST.hydro.hmtM, 2)} m`
    : "";
  return `<div class="circ-curves-panel">
    <p class="hint circ-curves-hint">${withCurve.length} courbe(s) — hauteur manométrique en fonction du débit${hydroHint}</p>
    <div class="circ-chart-wrap" id="circChartWrap"><div class="circ-chart-tooltip" id="circChartTooltip" hidden></div><svg id="circChartSvg" role="img" aria-label="Courbes des circulateurs"></svg></div>
    <div class="circ-legend" id="circChartLegend"></div>
    ${without.length ? `<p class="hint circ-no-curve"><b>Sans courbe :</b> ${without.map((c) => escHtml(c.ref || c.modele || "—")).join(" · ")}</p>` : ""}
  </div>`;
}

function circChartSvgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const m = svg.getScreenCTM();
  if (!m) return null;
  return pt.matrixTransform(m.inverse());
}

function circNearestOnSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return { x: a.x, y: a.y, debit: a.debit, hmt: a.hmt, dist: Math.hypot(p.x - a.x, p.y - a.y) };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return {
    x, y,
    debit: a.debit + t * (b.debit - a.debit),
    hmt: a.hmt + t * (b.hmt - a.hmt),
    dist: Math.hypot(p.x - x, p.y - y)
  };
}

function circFindHoverHit(svgPt) {
  if (!_circChartMeta || !svgPt) return null;
  let best = null;
  _circChartMeta.series.forEach((s, si) => {
    s.points.forEach((pt, pi) => {
      const dist = Math.hypot(svgPt.x - pt.x, svgPt.y - pt.y);
      if (dist < 14 && (!best || dist < best.dist || best.kind === "line")) {
        best = { kind: "point", dist, si, pi, x: pt.x, y: pt.y, debit: pt.debit, hmt: pt.hmt, label: s.label, color: s.color };
      }
    });
    for (let j = 0; j < s.points.length - 1; j++) {
      const hit = circNearestOnSegment(svgPt, s.points[j], s.points[j + 1]);
      if (hit.dist < 12 && (!best || hit.dist < best.dist)) {
        best = { kind: "line", dist: hit.dist, si, x: hit.x, y: hit.y, debit: hit.debit, hmt: hit.hmt, label: s.label, color: s.color };
      }
    }
  });
  return best;
}

function circUpdateChartHighlight(hit) {
  const svg = $("circChartSvg");
  if (!svg) return;
  svg.querySelectorAll(".circ-curve-line").forEach((el, i) => {
    const on = hit && hit.si === i;
    el.classList.toggle("active", on);
    el.classList.toggle("dim", hit && !on);
  });
  const hl = svg.querySelector("#circHlDot");
  const ring = svg.querySelector("#circHlRing");
  if (!hit) {
    if (hl) hl.setAttribute("visibility", "hidden");
    if (ring) ring.setAttribute("visibility", "hidden");
    return;
  }
  if (hl) {
    hl.setAttribute("cx", hit.x.toFixed(1));
    hl.setAttribute("cy", hit.y.toFixed(1));
    hl.setAttribute("fill", hit.color);
    hl.setAttribute("visibility", "visible");
  }
  if (ring) {
    ring.setAttribute("cx", hit.x.toFixed(1));
    ring.setAttribute("cy", hit.y.toFixed(1));
    ring.setAttribute("stroke", hit.color);
    ring.setAttribute("visibility", "visible");
  }
}

function circShowChartTooltip(wrap, tooltip, evt, hit) {
  if (!hit) {
    tooltip.hidden = true;
    tooltip.classList.remove("show");
    return;
  }
  tooltip.innerHTML = `<strong>${escHtml(hit.label)}</strong><span class="circ-tt-row"><b>Débit</b> ${fmt(hit.debit, 2)} m³/h</span><span class="circ-tt-row"><b>HMT</b> ${fmt(hit.hmt, 2)} m</span>`;
  tooltip.hidden = false;
  tooltip.classList.add("show");
  const rect = wrap.getBoundingClientRect();
  let left = evt.clientX - rect.left + 14;
  let top = evt.clientY - rect.top - 12;
  const tw = tooltip.offsetWidth || 160;
  const th = tooltip.offsetHeight || 56;
  left = Math.max(8, Math.min(left, rect.width - tw - 8));
  top = Math.max(8, Math.min(top, rect.height - th - 8));
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

let _circChartMeta = null;

function initCircChartHover(wrap, svg) {
  if (!wrap || !svg || wrap._circHoverBound) return;
  wrap._circHoverBound = true;
  const tooltip = $("circChartTooltip");

  function onMove(evt) {
    const svgPt = circChartSvgPoint(svg, evt);
    const hit = circFindHoverHit(svgPt);
    circUpdateChartHighlight(hit);
    circShowChartTooltip(wrap, tooltip, evt, hit);
    wrap.style.cursor = hit ? "crosshair" : "default";
  }

  function onLeave() {
    circUpdateChartHighlight(null);
    if (tooltip) {
      tooltip.hidden = true;
      tooltip.classList.remove("show");
    }
    wrap.style.cursor = "default";
  }

  wrap.addEventListener("mousemove", onMove);
  wrap.addEventListener("mouseleave", onLeave);
}

function drawCirculateurCurvesChart() {
  const wrap = $("circChartWrap");
  const svg = $("circChartSvg");
  if (!wrap || !svg) return;
  const pumps = circulateursWithCurve();
  if (!pumps.length) return;

  const W = Math.max(720, wrap.clientWidth || 900);
  const H = 420;
  const pad = { l: 52, r: 24, t: 28, b: 48 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  let maxD = 0;
  let maxH = 0;
  pumps.forEach((p) => {
    p.courbeHmt.forEach((pt) => {
      if (pt.debit > maxD) maxD = pt.debit;
      if (pt.hmt > maxH) maxH = pt.hmt;
    });
  });
  const hydroOp = typeof LAST !== "undefined" && LAST?.hydro?.active ? LAST.hydro : null;
  if (hydroOp) {
    if (hydroOp.debitM3h > maxD) maxD = hydroOp.debitM3h;
    if (hydroOp.hmtM > maxH) maxH = hydroOp.hmtM;
  }
  maxD = Math.max(maxD * 1.05, 1);
  maxH = Math.max(maxH * 1.08, 1);

  const xAt = (d) => pad.l + (d / maxD) * plotW;
  const yAt = (h) => pad.t + plotH - (h / maxH) * plotH;

  let grid = "";
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxH * i) / ticks;
    const y = yAt(v);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
    grid += `<text x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--ink-soft)" font-size="9">${fmt(v, 1)}</text>`;
  }
  for (let i = 0; i <= ticks; i++) {
    const v = (maxD * i) / ticks;
    const x = xAt(v);
    grid += `<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${pad.t + plotH}" stroke="var(--line)" stroke-dasharray="3 4" opacity=".5"/>`;
    grid += `<text x="${x.toFixed(1)}" y="${(H - 14).toFixed(1)}" text-anchor="middle" fill="var(--ink-soft)" font-size="9">${fmt(v, 1)}</text>`;
  }

  const series = [];
  let curves = "";
  let legendHtml = "";
  pumps.forEach((p, i) => {
    const col = CIRC_CURVE_COLORS[i % CIRC_CURVE_COLORS.length];
    const pts = [...p.courbeHmt].sort((a, b) => a.debit - b.debit);
    const mapped = pts.map((pt) => ({ debit: pt.debit, hmt: pt.hmt, x: xAt(pt.debit), y: yAt(pt.hmt) }));
    const lbl = p.ref || p.modele || "Sans nom";
    series.push({ label: lbl, color: col, points: mapped });
    const poly = mapped.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
    curves += `<polyline class="circ-curve-line" data-idx="${i}" points="${poly}" fill="none" stroke="${col}" stroke-width="2.2" opacity=".88"/>`;
    mapped.forEach((pt) => {
      curves += `<circle class="circ-curve-dot" data-idx="${i}" cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.5" fill="${col}"/>`;
    });
    const spec = [p.debitM3h != null ? fmt(p.debitM3h, 1) + " m³/h" : "", p.hmtM != null ? "HMT " + fmt(p.hmtM, 1) + " m" : ""].filter(Boolean).join(" · ");
    legendHtml += `<span class="circ-leg-item" data-leg-idx="${i}" title="${escHtml(spec)}"><span class="circ-leg-swatch" style="background:${col}"></span>${escHtml(lbl)}</span>`;
  });

  _circChartMeta = { W, H, series };

  let opSvg = "";
  if (hydroOp) {
    const ox = xAt(hydroOp.debitM3h);
    const oy = yAt(hydroOp.hmtM);
    const yBase = pad.t + plotH;
    opSvg = `<g class="circ-op-point" pointer-events="none">
      <line x1="${ox.toFixed(1)}" y1="${yBase.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" stroke="var(--heat)" stroke-dasharray="4 3" opacity=".55"/>
      <line x1="${pad.l}" y1="${oy.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" stroke="var(--heat)" stroke-dasharray="4 3" opacity=".55"/>
      <circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="5.5" fill="var(--heat)" stroke="#fff" stroke-width="1.5"/>
      <text x="${Math.min(ox + 8, W - pad.r - 40).toFixed(1)}" y="${Math.max(oy - 8, pad.t + 10).toFixed(1)}" fill="var(--heat)" font-size="9.5" font-weight="600" font-family="var(--sans)">Projet</text>
    </g>`;
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <text x="${pad.l}" y="16" fill="var(--ink)" font-size="11" font-family="var(--sans)">HMT (m)</text>
    ${grid}
    <line x1="${pad.l}" y1="${(pad.t + plotH).toFixed(1)}" x2="${W - pad.r}" y2="${(pad.t + plotH).toFixed(1)}" stroke="var(--line-strong)"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${(pad.t + plotH).toFixed(1)}" stroke="var(--line-strong)"/>
    ${curves}
    ${opSvg}
    <circle id="circHlRing" cx="0" cy="0" r="7" fill="none" stroke="#000" stroke-width="2" visibility="hidden" pointer-events="none"/>
    <circle id="circHlDot" cx="0" cy="0" r="4" fill="#000" visibility="hidden" pointer-events="none"/>
    <text x="${(pad.l + plotW / 2).toFixed(1)}" y="${(H - 2).toFixed(1)}" text-anchor="middle" fill="var(--ink-soft)" font-size="10" font-family="var(--sans)">Débit (m³/h)</text>`;

  const leg = $("circChartLegend");
  if (leg) {
    leg.innerHTML = legendHtml;
    leg.querySelectorAll(".circ-leg-item").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const idx = +el.dataset.legIdx;
        svg.querySelectorAll(".circ-curve-line").forEach((ln, i) => {
          ln.classList.toggle("active", i === idx);
          ln.classList.toggle("dim", i !== idx);
        });
      });
      el.addEventListener("mouseleave", () => {
        svg.querySelectorAll(".circ-curve-line").forEach((ln) => ln.classList.remove("active", "dim"));
      });
    });
  }

  initCircChartHover(wrap, svg);
}

function bindCircChartResize() {
  if (window._circChartResize) return;
  window._circChartResize = true;
  window.addEventListener("resize", () => {
    if (COMP_SUBVIEW !== "curves") return;
    if (COMP_TYPE_ACTIVE === "circulateur") drawCirculateurCurvesChart();
    else if (COMP_TYPE_ACTIVE === "echangeur_plaques") drawEchangeurPdcCurvesChart();
  });
}

function renderComposants() {
  ensureBundledComposants();
  const type = COMP_TYPE_ACTIVE;
  const def = COMP_TYPES[type];
  if (!def) return;
  const list = state.composants[type] || [];
  const total = Object.keys(COMP_TYPES).reduce((n, k) => n + (state.composants[k]?.length || 0), 0);
  $("compTotalCount").textContent = total + " composant(s) au total";

  document.querySelectorAll(".comp-tab").forEach((b) => {
    const k = b.dataset.comp;
    const n = state.composants[k]?.length || 0;
    b.innerHTML = `${COMP_TYPES[k].icon} ${COMP_TYPES[k].label}${n ? ` <span class="n">${n}</span>` : ""}`;
  });

  renderCompSubTabs();

  const addBtn = $("compToolbar")?.querySelector("button[onclick*='openCompModal']");
  if (type === "circulateur" && COMP_SUBVIEW === "curves") {
    $("compTypeTitle").textContent = "Courbes de fonctionnement";
    $("compTypeCount").textContent = circulateursWithCurve().length + " courbe(s)";
    if (addBtn) addBtn.style.display = "none";
    $("compList").className = "comp-grid comp-grid-curves";
    $("compList").innerHTML = renderCirculateurCurvesPanel();
    bindCircChartResize();
    requestAnimationFrame(() => drawCirculateurCurvesChart());
    return;
  }

  if (type === "echangeur_plaques" && COMP_SUBVIEW === "curves") {
    $("compTypeTitle").textContent = "Courbes perte de charge";
    $("compTypeCount").textContent = echangeurPdcSeries().length + " courbe(s)";
    if (addBtn) addBtn.style.display = "none";
    $("compList").className = "comp-grid comp-grid-curves";
    $("compList").innerHTML = renderEchangeurPdcCurvesPanel();
    bindCircChartResize();
    requestAnimationFrame(() => drawEchangeurPdcCurvesChart());
    return;
  }

  if (addBtn) addBtn.style.display = "";
  $("compList").className = "comp-grid";
  $("compTypeTitle").textContent = def.label;
  $("compTypeCount").textContent = list.length + " fiche(s)";

  $("compList").innerHTML = list.length
    ? list
        .map((c, i) => {
          const title = c.ref || c.modele || c.fabricant || "Sans nom";
          const sub = [c.fabricant, c.modele].filter(Boolean).join(" · ");
          return `<div class="ccard">
        <div class="ccard-top">
          <h4>${escHtml(title)}</h4>
          <span class="badge mono">${def.label}</span>
        </div>
        <div class="ccard-sub">${escHtml(sub || "—")}</div>
        <div class="ccard-spec mono">${escHtml(def.summary(c))}</div>
        ${c.notes ? `<div class="ccard-note">${escHtml(c.notes)}</div>` : ""}
        <div class="ccard-acts">
          <button class="btn-soft" onclick="openCompModal('${type}',${i})">Modifier</button>
          <button class="btn-soft" onclick="dupComp('${type}',${i})">Dupliquer</button>
          <button class="btn-soft" style="color:var(--bad)" onclick="delComp('${type}',${i})">Supprimer</button>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="empty" style="grid-column:1/-1">Aucun ${def.label.toLowerCase()} — ajoutez une fiche pour constituer votre bibliothèque.</div>`;
}

function openCompModal(type, idx) {
  ensureComposants();
  const def = COMP_TYPES[type];
  COMP_EDIT = { type, idx: idx != null ? idx : null };
  const c =
    idx != null ? { ...state.composants[type][idx] } : emptyCompItem(type);
  $("compModalTitle").textContent =
    (idx != null ? "Modifier" : "Ajouter") + " — " + def.label;
  $("compModalBody").innerHTML =
    `<div class="comp-form">${def.fields
      .map((f) => compFieldHtml(f, c))
      .join("")}</div>`;
  $("modalComp").classList.add("show");
}

function compFieldHtml(f, c) {
  const v = c[f.key] ?? "";
  const span = f.full ? ' style="grid-column:1/-1"' : "";
  if (f.type === "textarea") {
    return `<label class="comp-field"${span}><span>${f.label}</span><textarea data-k="${f.key}" rows="3">${escHtml(v)}</textarea></label>`;
  }
  if (f.type === "select") {
    const opts = f.options
      .map(([val, lab]) => `<option value="${val}"${String(v) === val ? " selected" : ""}>${lab}</option>`)
      .join("");
    return `<label class="comp-field"${span}><span>${f.label}</span><select data-k="${f.key}">${opts}</select></label>`;
  }
  const unit = f.unit ? `<span class="unit">${f.unit}</span>` : "";
  return `<label class="comp-field"${span}><span>${f.label}</span><input data-k="${f.key}" type="${f.type || "text"}" value="${escHtml(v)}"${f.step != null ? ` step="${f.step}"` : ""} placeholder="${escHtml(f.placeholder || "")}">${unit}</label>`;
}

function readCompModal() {
  const o = {};
  $("compModalBody")
    .querySelectorAll("[data-k]")
    .forEach((el) => {
      const k = el.dataset.k;
      o[k] = el.tagName === "SELECT" ? el.value : el.value.trim();
    });
  return o;
}

function saveCompModal() {
  if (!COMP_EDIT) return;
  const { type, idx } = COMP_EDIT;
  const prev = idx != null ? state.composants[type][idx] : {};
  const data = { ...prev, ...readCompModal() };
  data.id = idx != null ? prev.id : nextCompId();
  data.type = type;
  COMP_TYPES[type].fields.forEach((f) => {
    if (f.type === "number" && data[f.key] !== "" && data[f.key] != null) data[f.key] = num(data[f.key]);
    else if (f.type === "number" && data[f.key] === "") data[f.key] = null;
  });
  if (idx != null) state.composants[type][idx] = data;
  else state.composants[type].push(data);
  closeCompModal();
  renderComposants();
  markDirty();
  toast("Composant enregistré");
}

function closeCompModal() {
  $("modalComp").classList.remove("show");
  COMP_EDIT = null;
}

function delComp(type, idx) {
  const c = state.composants[type][idx];
  const name = c.ref || c.modele || "cet élément";
  if (!confirm("Supprimer « " + name + " » ?")) return;
  state.composants[type].splice(idx, 1);
  renderComposants();
  markDirty();
}

function dupComp(type, idx) {
  const copy = JSON.parse(JSON.stringify(state.composants[type][idx]));
  copy.id = nextCompId();
  if (copy.ref) copy.ref += " (copie)";
  state.composants[type].push(copy);
  renderComposants();
  markDirty();
  toast("Composant dupliqué");
}

function exportComposantsJson() {
  ensureComposants();
  const obj = {
    type: "oedip-composants",
    version: 1,
    date: new Date().toISOString(),
    composants: state.composants
  };
  download(obj, "oedip_composants.json");
  toast("Bibliothèque composants exportée");
}

function importComposantsJson() {
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
        const data = obj.composants || obj;
        ensureComposants();
        Object.keys(COMP_TYPES).forEach((k) => {
          if (Array.isArray(data[k])) state.composants[k] = data[k];
        });
        renderComposants();
        markDirty();
        toast("Bibliothèque composants importée");
      } catch (err) {
        alert("JSON invalide : " + err.message);
      }
    };
    rd.readAsText(f);
  };
  inp.click();
}

if (typeof state !== "undefined") ensureComposants();

if ($("modalComp")) $("modalComp").addEventListener("click", (e) => { if (e.target.id === "modalComp") closeCompModal(); });

function initComposantsTab() {
  ensureBundledComposants();
  const tabs = $("compTabs");
  if (!tabs) return;
  if (!tabs.dataset.ready) {
    tabs.innerHTML = Object.keys(COMP_TYPES)
      .map(
        (k) =>
          `<button type="button" class="comp-tab" data-comp="${k}" onclick="setCompType('${k}')">${COMP_TYPES[k].icon} ${COMP_TYPES[k].label}</button>`
      )
      .join("");
    tabs.dataset.ready = "1";
    setCompType("circulateur");
  } else renderComposants();
}
