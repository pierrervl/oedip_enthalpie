/* OEDIP — catalogue composants hydrauliques & frigorifiques */
const COMP_TYPES = {
  circulateur: {
    label: "Circulateur",
    icon: "⟳",
    family: "hydrau",
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
    family: "frigo",
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
    family: "frigo",
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
    family: "frigo",
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
    family: "frigo",
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
    family: "hydrau",
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
    family: "hydrau",
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
    family: "frigo",
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
  },
  raccord_hydraulique: {
    label: "Raccord",
    icon: "⬡",
    family: "hydrau",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeRaccord", label: "Type", type: "select", options: [["coude", "Coude"], ["te", "Té"], ["reduction", "Réduction"], ["mamelon", "Mamelon"], ["autre", "Autre"]] },
      { key: "dnMm", label: "Diamètre nominal", unit: "mm", type: "number" },
      { key: "materiau", label: "Matériau", type: "text", placeholder: "laiton, acier, inox…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.typeRaccord) p.push(c.typeRaccord);
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      return p.join(" · ") || "—";
    }
  },
  vanne_hydraulique: {
    label: "Vanne",
    icon: "◉",
    family: "hydrau",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeVanne", label: "Type", type: "select", options: [["iso", "Isolement"], ["3voies", "3 voies"], ["melangeuse", "Mélangeuse"], ["clapet", "Clapet"], ["autre", "Autre"]] },
      { key: "dnMm", label: "Diamètre nominal", unit: "mm", type: "number" },
      { key: "pMaxBar", label: "Pression max", unit: "bar", type: "number", step: 0.1 },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.typeVanne) p.push(c.typeVanne);
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      return p.join(" · ") || "—";
    }
  },
  groupe_securite: {
    label: "Groupe de sécurité",
    icon: "⚠",
    family: "hydrau",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "dnMm", label: "Diamètre nominal", unit: "mm", type: "number" },
      { key: "pOuvBar", label: "Pression ouverture", unit: "bar", type: "number", step: 0.1 },
      { key: "debitEvac", label: "Débit évacuation", unit: "l/min", type: "number", step: 0.1 },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.dnMm) p.push("DN " + fmt(c.dnMm, 0));
      if (c.pOuvBar) p.push(fmt(c.pOuvBar, 1) + " bar");
      return p.join(" · ") || "—";
    }
  },
  prequipement_hydraulique: {
    label: "Prééquipement hydraulique",
    icon: "⊞",
    family: "hydrau",
    isOuvrage: true,
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "designation", label: "Désignation", type: "text", full: true },
      { key: "circuit", label: "Circuit", type: "select", options: [["captage", "Captage / froid"], ["chauffage", "Chauffage"], ["ecs", "ECS"], ["general", "Général"]] },
      { key: "dnMm", label: "DN principal", unit: "mm", type: "number" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const n = (c.lignes || []).length;
      const q = (c.lignes || []).reduce((s, l) => s + (+l.qty || 1), 0);
      const p = [c.designation || c.ref];
      if (c.circuit) p.push(c.circuit);
      if (n) p.push(n + " ref · " + q + " pcs");
      return p.filter(Boolean).join(" · ") || "—";
    }
  },
  disjoncteur: {
    label: "Disjoncteur / protection",
    icon: "▭",
    family: "elec",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeProt", label: "Type", type: "select", options: [["disj", "Disjoncteur"], ["diff", "Différentiel"], ["fusible", "Fusible"], ["sectionneur", "Sectionneur"], ["autre", "Autre"]] },
      { key: "iNomA", label: "Courant nominal", unit: "A", type: "number", step: 0.1 },
      { key: "pdcKa", label: "Pouvoir coupure", unit: "kA", type: "number", step: 0.1 },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.typeProt) p.push(c.typeProt);
      if (c.iNomA) p.push(fmt(c.iNomA, 1) + " A");
      return p.join(" · ") || "—";
    }
  },
  contacteur: {
    label: "Contacteur / relais",
    icon: "⌁",
    family: "elec",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle", type: "text" },
      { key: "typeApp", label: "Type", type: "select", options: [["contacteur", "Contacteur"], ["relais", "Relais"], ["telerupteur", "Télérupteur"], ["autre", "Autre"]] },
      { key: "iNomA", label: "Courant nominal", unit: "A", type: "number", step: 0.1 },
      { key: "bobineV", label: "Tension bobine", unit: "V", type: "number" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.typeApp) p.push(c.typeApp);
      if (c.iNomA) p.push(fmt(c.iNomA, 1) + " A");
      return p.join(" · ") || "—";
    }
  },
  cable: {
    label: "Câble / fil",
    icon: "∿",
    family: "elec",
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "fabricant", label: "Fabricant", type: "text" },
      { key: "modele", label: "Modèle / section", type: "text" },
      { key: "sectionMm2", label: "Section", unit: "mm²", type: "number", step: 0.1 },
      { key: "nbConducteurs", label: "Conducteurs", type: "number" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const p = [];
      if (c.sectionMm2) p.push(fmt(c.sectionMm2, 1) + " mm²");
      if (c.nbConducteurs) p.push(c.nbConducteurs + "C");
      return p.join(" · ") || "—";
    }
  },
  tableau_electrique: {
    label: "Tableau électrique",
    icon: "▣",
    family: "elec",
    isOuvrage: true,
    fields: [
      { key: "ref", label: "Référence interne", type: "text", full: true },
      { key: "designation", label: "Désignation", type: "text", full: true },
      { key: "tension", label: "Alimentation", type: "select", options: [["0", "Mono 230V"], ["1", "Tri 400V"], ["2", "Indiff."]] },
      { key: "iMaxA", label: "Courant max", unit: "A", type: "number", step: 0.1 },
      { key: "indiceIP", label: "Indice IP", type: "text", placeholder: "IP54…" },
      { key: "notes", label: "Notes", type: "textarea", full: true }
    ],
    summary(c) {
      const n = (c.lignes || []).length;
      const q = (c.lignes || []).reduce((s, l) => s + (+l.qty || 1), 0);
      const p = [c.designation || c.ref];
      if (c.iMaxA) p.push(fmt(c.iMaxA, 1) + " A");
      if (n) p.push(n + " ref · " + q + " pcs");
      return p.filter(Boolean).join(" · ") || "—";
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
  if (def.isOuvrage || def.family === "elec") return;
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

function findCompById(id) {
  if (!id) return null;
  for (const type of Object.keys(COMP_TYPES)) {
    const hit = (state.composants[type] || []).find((c) => c.id === id);
    if (hit) return { ...hit, _type: type };
  }
  return null;
}

function ouvrageLignesPreview(c) {
  const lignes = c.lignes || [];
  if (!lignes.length) return "";
  return lignes
    .map((ln) => {
      const comp = findCompById(ln.compId);
      const label = comp ? comp.ref || comp.modele || comp.id : "—";
      return (ln.qty > 1 ? ln.qty + "× " : "") + label;
    })
    .join(" · ");
}

function emptyCompItem(type) {
  const item = { id: nextCompId(), type };
  COMP_TYPES[type].fields.forEach((f) => {
    if (f.type === "select" && f.options) item[f.key] = f.options[0][0];
    else item[f.key] = "";
  });
  if (COMP_TYPES[type].isOuvrage) item.lignes = [];
  item.fournisseurId = item.fournisseurId || "";
  return item;
}

let COMP_EDIT = null;
let COMP_TYPE_ACTIVE = "compresseur";
let COMP_FAMILY_ACTIVE = "frigo";
let COMP_OUVRAGE_VIEW = "elements";
let COMP_SUBVIEW = "list";
let COMP_MODAL_VIEW = "fiche";

const COMP_FAMILIES = {
  frigo: { label: "Frigo", icon: "❄", hint: "Compresseurs, échangeurs, détendeurs et accessoires du circuit frigorifique." },
  hydrau: { label: "Hydraulique", icon: "💧", hint: "Circulateurs, filtres, raccords, vannes, groupes de sécurité et prééquipements hydrauliques." },
  elec: { label: "Électrique", icon: "⚡", hint: "Protections, contacteurs, câbles et tableaux électriques assemblés." },
};

function compTypesInFamily(family, ouvrageView) {
  return Object.keys(COMP_TYPES).filter((k) => {
    const t = COMP_TYPES[k];
    if ((t.family || "frigo") !== family) return false;
    if (family === "frigo") return !t.isOuvrage;
    if (ouvrageView === "ouvrages") return !!t.isOuvrage;
    return !t.isOuvrage;
  });
}

function compElementTypesInFamily(family) {
  return compTypesInFamily(family, "elements");
}

function setCompFamily(f) {
  COMP_FAMILY_ACTIVE = f;
  COMP_OUVRAGE_VIEW = "elements";
  COMP_SUBVIEW = "list";
  const types = compTypesInFamily(f, "elements");
  COMP_TYPE_ACTIVE = types[0] || "compresseur";
  renderCompFamilyTabs();
  renderCompOuvrageTabs();
  renderCompTypeTabs();
  renderCompSubTabs();
  renderComposants();
}

function setCompOuvrageView(v) {
  COMP_OUVRAGE_VIEW = v;
  COMP_SUBVIEW = "list";
  const types = compTypesInFamily(COMP_FAMILY_ACTIVE, v);
  COMP_TYPE_ACTIVE = types[0] || COMP_TYPE_ACTIVE;
  renderCompOuvrageTabs();
  renderCompTypeTabs();
  renderCompSubTabs();
  renderComposants();
}

function renderCompFamilyTabs() {
  const el = $("compFamilyTabs");
  if (!el) return;
  el.innerHTML = Object.keys(COMP_FAMILIES).map((k) => {
    const f = COMP_FAMILIES[k];
    const n = compTypesInFamily(k, "elements").reduce((s, t) => s + (state.composants[t]?.length || 0), 0)
      + compTypesInFamily(k, "ouvrages").reduce((s, t) => s + (state.composants[t]?.length || 0), 0);
    return `<button type="button" class="comp-family-tab${COMP_FAMILY_ACTIVE === k ? " on" : ""}" onclick="setCompFamily('${k}')">${f.icon} ${f.label}${n ? ` <span class="n">${n}</span>` : ""}</button>`;
  }).join("");
  const hint = $("compFamilyHint");
  if (hint) hint.textContent = COMP_FAMILIES[COMP_FAMILY_ACTIVE]?.hint || "";
}

function renderCompOuvrageTabs() {
  const el = $("compOuvrageTabs");
  if (!el) return;
  if (COMP_FAMILY_ACTIVE === "frigo") {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  el.style.display = "flex";
  el.innerHTML = [
    `<button type="button" class="comp-ouvrage-tab${COMP_OUVRAGE_VIEW === "elements" ? " on" : ""}" onclick="setCompOuvrageView('elements')">Éléments</button>`,
    `<button type="button" class="comp-ouvrage-tab${COMP_OUVRAGE_VIEW === "ouvrages" ? " on" : ""}" onclick="setCompOuvrageView('ouvrages')">Ouvrages</button>`,
  ].join("");
}

function renderCompTypeTabs() {
  const tabs = $("compTabs");
  if (!tabs) return;
  const types = compTypesInFamily(COMP_FAMILY_ACTIVE, COMP_OUVRAGE_VIEW);
  tabs.innerHTML = types.map((k) =>
    `<button type="button" class="comp-tab${COMP_TYPE_ACTIVE === k ? " on" : ""}" data-comp="${k}" onclick="setCompType('${k}')">${COMP_TYPES[k].icon} ${COMP_TYPES[k].label}</button>`
  ).join("");
}

function compEscVal(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function ouvrageElementOptions(family, selectedId) {
  const types = compElementTypesInFamily(family);
  const groups = types.map((type) => {
    const items = state.composants[type] || [];
    if (!items.length) return "";
    const opts = items.map((c) =>
      `<option value="${compEscVal(c.id)}"${c.id === selectedId ? " selected" : ""}>${escHtml(c.ref || c.modele || c.id)}</option>`
    ).join("");
    return `<optgroup label="${escHtml(COMP_TYPES[type].label)}">${opts}</optgroup>`;
  }).filter(Boolean).join("");
  return groups || '<option value="">— Aucun élément dans le catalogue —</option>';
}

function renderOuvrageLignesEditor(lignes, family) {
  const rows = (lignes || []).map((ln, i) => `<tr data-ligne-i="${i}">
    <td><select class="ouv-ligne-comp" data-ligne-i="${i}">${ouvrageElementOptions(family, ln.compId)}</select></td>
    <td><input type="number" class="ouv-ligne-qty mono" data-ligne-i="${i}" min="1" step="1" value="${ln.qty ?? 1}" style="width:4rem"></td>
    <td><input type="text" class="ouv-ligne-note" data-ligne-i="${i}" value="${compEscVal(ln.note || "")}" placeholder="Optionnel"></td>
    <td><button type="button" class="btn-ghost" onclick="removeOuvrageLigne(${i})">✕</button></td>
  </tr>`).join("");
  return `<div class="ouv-lignes-wrap">
    <span class="subhead">Nomenclature (assemblage)</span>
    <table class="proc-dims-tbl ouv-lignes-tbl"><thead><tr><th>Composant</th><th>Qté</th><th>Remarque</th><th></th></tr></thead>
    <tbody id="ouvLignesBody">${rows}</tbody></table>
    <button type="button" class="btn-ghost" onclick="addOuvrageLigne()">+ Ajouter un élément</button>
  </div>`;
}

function gatherOuvrageLignesFromForm() {
  const body = $("ouvLignesBody");
  if (!body) return [];
  return [...body.querySelectorAll("tr[data-ligne-i]")].map((row) => ({
    compId: row.querySelector(".ouv-ligne-comp")?.value || "",
    qty: Math.max(1, +(row.querySelector(".ouv-ligne-qty")?.value || 1)),
    note: row.querySelector(".ouv-ligne-note")?.value.trim() || "",
  })).filter((ln) => ln.compId);
}

function addOuvrageLigne() {
  if (!COMP_EDIT) return;
  gatherCompModalPartial();
  const draft = COMP_EDIT._draft || {};
  if (!draft.lignes) draft.lignes = [];
  draft.lignes.push({ compId: "", qty: 1, note: "" });
  COMP_EDIT._draft = draft;
  const { type } = COMP_EDIT;
  const prev = COMP_EDIT.idx != null ? { ...state.composants[type][COMP_EDIT.idx] } : emptyCompItem(type);
  const c = { ...prev, ...draft };
  if (draft.fdes) c.fdes = { ...ensureCompFdes(prev), ...draft.fdes };
  renderCompModalBody(c, type);
}

function removeOuvrageLigne(i) {
  if (!COMP_EDIT) return;
  gatherCompModalPartial();
  const draft = COMP_EDIT._draft || {};
  draft.lignes = (draft.lignes || []).filter((_, j) => j !== i);
  COMP_EDIT._draft = draft;
  const { type } = COMP_EDIT;
  const prev = COMP_EDIT.idx != null ? { ...state.composants[type][COMP_EDIT.idx] } : emptyCompItem(type);
  const c = { ...prev, ...draft };
  renderCompModalBody(c, type);
}

const COMP_FDES_FIELDS = [
  { key: "iniesRef", label: "Réf. FDES / INIES", type: "text", full: true },
  { key: "url", label: "URL fiche FDES", type: "text", full: true },
  { key: "origine", label: "Origine fabrication", type: "text", placeholder: "Pays, site usine…" },
  { key: "poidsKg", label: "Poids pièce", unit: "kg", type: "number", step: 0.01 },
  { key: "transportKm", label: "Transport jusqu'au site", unit: "km", type: "number", step: 1 },
  { key: "transportMode", label: "Mode transport", type: "select", options: [["route", "Route (camion)"], ["mer", "Maritime"], ["fer", "Ferroviaire"], ["air", "Aérien"]] },
  { key: "materiauPrincipal", label: "Matériau principal", type: "text" },
  { key: "contenuRecyclePct", label: "Contenu recyclé", unit: "%", type: "number", step: 1 },
  { key: "acvA1A3", label: "ACV A1-A3 (production)", unit: "kgCO₂eq", type: "number", step: 0.01 },
  { key: "acvA4", label: "ACV A4 (transport)", unit: "kgCO₂eq", type: "number", step: 0.01 },
  { key: "acvA5", label: "ACV A5 (installation)", unit: "kgCO₂eq", type: "number", step: 0.01 },
  { key: "acvC1C4", label: "ACV C1-C4 (fin de vie)", unit: "kgCO₂eq", type: "number", step: 0.01 },
  { key: "acvTotal", label: "ACV total déclaré", unit: "kgCO₂eq", type: "number", step: 0.01 },
  { key: "notes", label: "Notes FDES", type: "textarea", full: true },
];

function defaultCompFdes() {
  return {
    iniesRef: "",
    url: "",
    origine: "",
    poidsKg: null,
    transportKm: null,
    transportMode: "route",
    acvA1A3: null,
    acvA4: null,
    acvA5: null,
    acvC1C4: null,
    acvTotal: null,
    materiauPrincipal: "",
    contenuRecyclePct: null,
    notes: "",
  };
}

function ensureCompFdes(c) {
  if (!c) return defaultCompFdes();
  if (!c.fdes || typeof c.fdes !== "object") c.fdes = defaultCompFdes();
  return c.fdes;
}

function compFdesTotal(fdes) {
  if (!fdes) return null;
  if (fdes.acvTotal != null && fdes.acvTotal !== "") return +fdes.acvTotal;
  const parts = [fdes.acvA1A3, fdes.acvA4, fdes.acvA5, fdes.acvC1C4].filter((v) => v != null && v !== "" && Number.isFinite(+v));
  if (!parts.length) return null;
  return parts.reduce((s, v) => s + +v, 0);
}

function compFdesSummary(c) {
  const f = ensureCompFdes(c);
  const total = compFdesTotal(f);
  const p = [];
  if (f.iniesRef) p.push(f.iniesRef);
  if (f.origine) p.push(f.origine);
  if (f.poidsKg) p.push(fmt(f.poidsKg, 2) + " kg");
  if (total != null) p.push(fmt(total, 2) + " kgCO₂eq");
  return p.join(" · ") || "—";
}

const CIRC_CURVE_COLORS = [
  "#0c7a8c", "#cf4310", "#2f7d3b", "#6b4c9a", "#b5740c", "#c41e6a",
  "#1a6b8a", "#8b4513", "#228b22", "#9932cc", "#dc143c", "#2e8b57", "#4682b4"
];

function setCompType(t) {
  COMP_TYPE_ACTIVE = t;
  COMP_SUBVIEW = "list";
  document.querySelectorAll(".comp-tab").forEach((b) => b.classList.toggle("on", b.dataset.comp === t));
  renderCompSubTabs();
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
  if (COMP_TYPES[COMP_TYPE_ACTIVE]?.isOuvrage && COMP_OUVRAGE_VIEW === "ouvrages") {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }
  const fdesBtn = `<button type="button" class="comp-subtab${COMP_SUBVIEW === "fdes" ? " on" : ""}" onclick="setCompSubView('fdes')">FDES ACV</button>`;
  if (COMP_TYPE_ACTIVE === "circulateur") {
    el.style.display = "flex";
    el.innerHTML = `
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "list" ? " on" : ""}" onclick="setCompSubView('list')">Fiches</button>
    ${fdesBtn}
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "curves" ? " on" : ""}" onclick="setCompSubView('curves')">Courbes HMT</button>`;
    return;
  }
  if (COMP_TYPE_ACTIVE === "echangeur_plaques") {
    el.style.display = "flex";
    el.innerHTML = `
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "list" ? " on" : ""}" onclick="setCompSubView('list')">Fiches</button>
    ${fdesBtn}
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "curves" ? " on" : ""}" onclick="setCompSubView('curves')">Courbes Pdc</button>`;
    return;
  }
  el.style.display = "flex";
  el.innerHTML = `
    <button type="button" class="comp-subtab${COMP_SUBVIEW === "list" ? " on" : ""}" onclick="setCompSubView('list')">Fiches</button>
    ${fdesBtn}`;
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
  renderCompFamilyTabs();
  renderCompOuvrageTabs();

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

  if (COMP_SUBVIEW === "fdes") {
    $("compTypeTitle").textContent = def.label + " — FDES ACV";
    const withFdes = list.filter((c) => compFdesTotal(ensureCompFdes(c)) != null).length;
    $("compTypeCount").textContent = withFdes + "/" + list.length + " avec ACV";
    if (addBtn) addBtn.style.display = "";
    $("compList").className = "comp-grid";
    $("compList").innerHTML = list.length
      ? list.map((c, i) => {
          const f = ensureCompFdes(c);
          const total = compFdesTotal(f);
          const title = c.ref || c.modele || c.fabricant || "Sans nom";
          return `<div class="ccard${total != null ? " cert-card-ok" : ""}">
        <div class="ccard-top"><h4>${escHtml(title)}</h4>
          ${total != null ? `<span class="badge cert-badge-acv mono">${fmt(total, 2)} kgCO₂eq</span>` : `<span class="badge">Incomplet</span>`}</div>
        <div class="ccard-sub">${escHtml(compFdesSummary(c))}</div>
        <div class="ccard-spec mono">${escHtml([f.origine, f.poidsKg ? fmt(f.poidsKg, 2) + " kg" : "", f.iniesRef].filter(Boolean).join(" · ") || "—")}</div>
        <div class="ccard-acts">
          <button class="btn-soft" onclick="openCompModal('${type}',${i},'fdes')">FDES</button>
          <button class="btn-soft" onclick="openCompModal('${type}',${i})">Fiche</button>
        </div>
      </div>`;
        }).join("")
      : `<div class="empty" style="grid-column:1/-1">Aucun composant — les données FDES alimentent le dossier produit (Certification → FDES).</div>`;
    return;
  }

  if (addBtn) {
    addBtn.style.display = "";
    addBtn.textContent = def.isOuvrage ? "+ Ajouter un ouvrage" : "+ Ajouter";
  }
  $("compList").className = "comp-grid";
  $("compTypeTitle").textContent = def.label;
  $("compTypeCount").textContent = list.length + (def.isOuvrage ? " ouvrage(s)" : " fiche(s)");

  $("compList").innerHTML = list.length
    ? list
        .map((c, i) => {
          const title = c.designation || c.ref || c.modele || c.fabricant || "Sans nom";
          const sub = def.isOuvrage
            ? [c.ref, c.circuit].filter(Boolean).join(" · ")
            : [c.fabricant, c.modele].filter(Boolean).join(" · ");
          const frnHint = c.fournisseurId && typeof findFournisseurById === "function"
            ? findFournisseurById(c.fournisseurId)?.nom
            : "";
          const bom = def.isOuvrage ? ouvrageLignesPreview(c) : "";
          return `<div class="ccard${def.isOuvrage ? " ccard-ouvrage" : ""}">
        <div class="ccard-top">
          <h4>${escHtml(title)}</h4>
          <span class="badge mono">${def.isOuvrage ? "Ouvrage" : def.label}</span>
        </div>
        <div class="ccard-sub">${escHtml(sub || "—")}${frnHint ? ` · <span class="hint">${escHtml(frnHint)}</span>` : ""}</div>
        <div class="ccard-spec mono">${escHtml(def.summary(c))}</div>
        ${bom ? `<div class="ccard-bom hint">${escHtml(bom)}</div>` : ""}
        ${c.notes ? `<div class="ccard-note">${escHtml(c.notes)}</div>` : ""}
        <div class="ccard-acts">
          <button class="btn-soft" onclick="openCompModal('${type}',${i})">Modifier</button>
          <button class="btn-soft" onclick="dupComp('${type}',${i})">Dupliquer</button>
          <button class="btn-soft" style="color:var(--bad)" onclick="delComp('${type}',${i})">Supprimer</button>
        </div>
      </div>`;
        })
        .join("")
    : `<div class="empty" style="grid-column:1/-1">Aucun ${def.label.toLowerCase()} — ${def.isOuvrage ? "créez un ouvrage en assemblant des éléments du catalogue." : "ajoutez une fiche pour constituer votre bibliothèque."}</div>`;
}

function openCompModal(type, idx, view) {
  ensureComposants();
  const def = COMP_TYPES[type];
  COMP_EDIT = { type, idx: idx != null ? idx : null, _draft: {} };
  COMP_MODAL_VIEW = view === "fdes" ? "fdes" : "fiche";
  const c =
    idx != null ? { ...state.composants[type][idx] } : emptyCompItem(type);
  ensureCompFdes(c);
  $("compModalTitle").textContent =
    (idx != null ? "Modifier" : "Ajouter") + " — " + def.label;
  renderCompModalBody(c, type);
  $("modalComp").classList.add("show");
}

function setCompModalView(v) {
  COMP_MODAL_VIEW = v;
  if (!COMP_EDIT) return;
  gatherCompModalPartial();
  const { type, idx } = COMP_EDIT;
  const prev = idx != null ? { ...state.composants[type][idx] } : emptyCompItem(type);
  const draft = COMP_EDIT._draft || {};
  const c = { ...prev };
  Object.keys(draft).forEach((k) => { if (k !== "fdes") c[k] = draft[k]; });
  if (draft.fdes) c.fdes = { ...ensureCompFdes(prev), ...draft.fdes };
  renderCompModalBody(c, type);
}

function gatherCompModalPartial() {
  if (!COMP_EDIT) return;
  const draft = COMP_EDIT._draft || {};
  $("compModalBody")?.querySelectorAll("[data-k]").forEach((el) => {
    draft[el.dataset.k] = el.tagName === "SELECT" ? el.value : el.value.trim();
  });
  $("compModalBody")?.querySelectorAll("[data-fdes-k]").forEach((el) => {
    if (!draft.fdes) draft.fdes = {};
    draft.fdes[el.dataset.fdesK] = el.tagName === "SELECT" ? el.value : el.value.trim();
  });
  if (COMP_TYPES[COMP_EDIT.type]?.isOuvrage) {
    if ($("ouvLignesBody")) draft.lignes = gatherOuvrageLignesFromForm();
    else if (!draft.lignes) {
      const prev = COMP_EDIT.idx != null ? state.composants[COMP_EDIT.type][COMP_EDIT.idx] : null;
      draft.lignes = prev?.lignes ? [...prev.lignes] : [];
    }
  }
  COMP_EDIT._draft = draft;
}

function renderCompModalBody(c, type) {
  const def = COMP_TYPES[type];
  const seg = `<div class="seg comp-modal-seg" style="margin-bottom:14px">
    <button type="button" class="${COMP_MODAL_VIEW === "fiche" ? "on" : ""}" onclick="setCompModalView('fiche')">Fiche technique</button>
    <button type="button" class="${COMP_MODAL_VIEW === "fdes" ? "on" : ""}" onclick="setCompModalView('fdes')">FDES / ACV</button>
  </div>`;
  if (COMP_MODAL_VIEW === "fdes") {
    const f = ensureCompFdes(c);
    const frn = typeof findFournisseurById === "function" ? findFournisseurById(c.fournisseurId) : null;
    const kmCalc = frn && typeof calcFournisseurTransportKm === "function" ? calcFournisseurTransportKm(c.fournisseurId) : null;
    const frnBlock = frn
      ? `<div class="frn-comp-hint hint" style="margin-bottom:12px;padding:10px;background:var(--field);border-radius:6px">
          <b>Fournisseur :</b> ${escHtml(fournisseurLabel(frn))}<br>
          ${escHtml(fournisseurAddressLine(frn) || "")}
          ${kmCalc != null ? `<br>Distance calculée : <span class="mono">${fmt(kmCalc, 0)} km</span>` : ""}
          ${COMP_EDIT?.idx != null ? `<br><button type="button" class="btn-ghost" style="margin-top:6px" onclick="applyTransportToSingleComp('${type}',${COMP_EDIT.idx})">Appliquer la distance au transport FDES</button>` : ""}
        </div>`
      : c.fournisseurId
        ? `<p class="hint">Fournisseur introuvable — vérifiez le registre fournisseurs.</p>`
        : `<p class="hint">Liez un fournisseur sur la fiche technique pour calculer automatiquement le transport.</p>`;
    $("compModalBody").innerHTML = seg + frnBlock + `<div class="comp-form">${COMP_FDES_FIELDS.map((fld) => compFdesFieldHtml(fld, f)).join("")}</div>
      <p class="hint">Ces données alimentent le dossier FDES produit (Certification → FDES produit).</p>`;
    return;
  }
  const frnSel = typeof fournisseurOptionsHtml === "function"
    ? `<label class="comp-field full"><span>Fournisseur</span><select data-k="fournisseurId">${fournisseurOptionsHtml(c.fournisseurId, "— Choisir un fournisseur —")}</select></label>`
    : "";
  const ouv = def.isOuvrage ? renderOuvrageLignesEditor(c.lignes || [], def.family) : "";
  $("compModalBody").innerHTML = seg + `<div class="comp-form">${frnSel}${def.fields.map((f) => compFieldHtml(f, c)).join("")}</div>${ouv}`;
}

function compFdesFieldHtml(f, fdes) {
  const v = fdes[f.key] ?? "";
  const span = f.full ? ' style="grid-column:1/-1"' : "";
  if (f.type === "textarea") {
    return `<label class="comp-field"${span}><span>${f.label}</span><textarea data-fdes-k="${f.key}" rows="3">${escHtml(v)}</textarea></label>`;
  }
  if (f.type === "select") {
    const opts = (f.options || []).map(([val, lab]) => `<option value="${val}"${String(v) === val ? " selected" : ""}>${lab}</option>`).join("");
    return `<label class="comp-field"${span}><span>${f.label}</span><select data-fdes-k="${f.key}">${opts}</select></label>`;
  }
  const unit = f.unit ? `<span class="unit">${f.unit}</span>` : "";
  return `<label class="comp-field"${span}><span>${f.label}</span><input data-fdes-k="${f.key}" type="${f.type || "text"}" value="${escHtml(v)}"${f.step != null ? ` step="${f.step}"` : ""} placeholder="${escHtml(f.placeholder || "")}">${unit}</label>`;
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
  gatherCompModalPartial();
  const { type, idx } = COMP_EDIT;
  const prev = idx != null ? state.composants[type][idx] : {};
  const draft = COMP_EDIT._draft || {};
  const data = { ...prev };
  Object.keys(draft).forEach((k) => {
    if (k !== "fdes") data[k] = draft[k];
  });
  if (draft.fdes) {
    data.fdes = { ...ensureCompFdes(prev), ...draft.fdes };
    COMP_FDES_FIELDS.forEach((f) => {
      if (f.type === "number" && data.fdes[f.key] !== "" && data.fdes[f.key] != null) data.fdes[f.key] = num(data.fdes[f.key]);
      else if (f.type === "number" && data.fdes[f.key] === "") data.fdes[f.key] = null;
    });
    if (data.fdes.acvTotal == null) {
      const t = compFdesTotal(data.fdes);
      if (t != null) data.fdes.acvTotal = t;
    }
  }
  data.id = idx != null ? prev.id : nextCompId();
  data.type = type;
  COMP_TYPES[type].fields.forEach((f) => {
    if (data[f.key] === undefined) return;
    if (f.type === "number" && data[f.key] !== "" && data[f.key] != null) data[f.key] = num(data[f.key]);
    else if (f.type === "number" && data[f.key] === "") data[f.key] = null;
  });
  if (COMP_TYPES[type].isOuvrage) {
    data.lignes = draft.lignes?.length ? draft.lignes : gatherOuvrageLignesFromForm();
    if (!data.lignes?.length && prev.lignes?.length) data.lignes = prev.lignes;
  }
  if (idx != null) state.composants[type][idx] = data;
  else state.composants[type].push(data);
  closeCompModal();
  renderComposants();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
  toast("Composant enregistré");
}

function closeCompModal() {
  $("modalComp").classList.remove("show");
  COMP_EDIT = null;
  COMP_MODAL_VIEW = "fiche";
}

function delComp(type, idx) {
  const c = state.composants[type][idx];
  const name = c.ref || c.modele || "cet élément";
  if (!confirm("Supprimer « " + name + " » ?")) return;
  state.composants[type].splice(idx, 1);
  renderComposants();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
}

function dupComp(type, idx) {
  const copy = JSON.parse(JSON.stringify(state.composants[type][idx]));
  copy.id = nextCompId();
  if (copy.ref) copy.ref += " (copie)";
  state.composants[type].push(copy);
  renderComposants();
  if (typeof markCatalogDirty === "function") markCatalogDirty();
  else markDirty();
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
        if (typeof markCatalogDirty === "function") markCatalogDirty();
        else markDirty();
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
  if (!$("compTabs")) return;
  if (typeof renderCompMainSeg === "function") renderCompMainSeg();
  if (typeof setCompMainView === "function") setCompMainView(COMP_MAIN_VIEW || "catalogue");
  renderCompFamilyTabs();
  renderCompOuvrageTabs();
  renderCompTypeTabs();
  renderCompSubTabs();
  renderComposants();
}
