/**
 * Génère data/gpac-r410-pack.json depuis import json.xlsx
 * (feuilles performances + composants + description générale).
 */
import { writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import XLSX from "xlsx";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "data", "gpac-r410-pack.json");
const DEFAULT_XLSX =
  "c:\\Users\\Pierre Raveleau\\OneDrive - ETAO\\Documents\\ENTHALPIE\\import json.xlsx";

const MONO_MODELS = ["G80", "G90", "G100", "G110", "G130"];
const TRI_MODELS = ["G90", "G100", "G110", "G130", "G140"];

const BLOCKS = [
  { src: "5/2", monoStart: 2, triStart: 7 },
  { src: "9/6", monoStart: 14, triStart: 19 },
  { src: "0/-3", monoStart: 26, triStart: 31 },
];

const COMP_MACHINE_COLS = [
  [1, "G80 Mono"],
  [2, "G90 Mono"],
  [3, "G90 Tri"],
  [4, "G100 Mono"],
  [5, "G100 Tri"],
  [6, "G110 Mono"],
  [7, "G110 Tri"],
  [8, "G130 Mono"],
  [9, "G130 Tri"],
  [10, "G140 Tri"],
];

const METRIC_ROWS = {
  chaud: 0,
  absorbee: 1,
  froid: 2,
  scop: 3,
  etas: 4,
  classeEnergie: 5,
  consoAnnuelleKwh: 6,
};

function findRow(rows, pred) {
  return rows.findIndex(pred);
}

function findPerfRegimes(rows) {
  const i30 = findRow(rows, (r) => /30.*35/.test(String(r[0])) && /calorifique|Régime/i.test(String(r[0] + r[1])));
  const i40 = findRow(rows, (r) => /40.*45/.test(String(r[0])) && /Régime/i.test(String(r[0])));
  const i47 = findRow(rows, (r) => /47.*55/.test(String(r[0])) && /Régime/i.test(String(r[0])));
  return [
    { dep: "30/35", startRow: i30 },
    { dep: "40/45", startRow: i40 },
    { dep: "47/55", startRow: i47 },
  ];
}

function round2(x) {
  const n = Number(x);
  return Number.isFinite(n) ? +n.toFixed(2) : 0;
}

function num(cell) {
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

function str(cell) {
  const s = String(cell ?? "").trim();
  return s || null;
}

function slugId(label) {
  const h = crypto.createHash("md5").update(label).digest("hex").slice(0, 10);
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36);
  return `cmp_${base}_${h}`;
}

function parseComponentRow(label) {
  const s = String(label || "").trim();
  if (!s) return null;
  if (/^Compresseur/i.test(s)) {
    const modele = s.replace(/^Compresseur\s+/i, "");
    return {
      type: "compresseur",
      role: "compresseur",
      item: {
        ref: modele,
        fabricant: "Copeland",
        modele,
        typeComp: "scroll",
        fluide: "R410A",
      },
    };
  }
  if (/^Bouteille/i.test(s)) {
    return {
      type: "bouteille_anticoup",
      role: "bouteilleAspiration",
      item: { ref: s, modele: s, fluide: "R410A" },
    };
  }
  if (/^Réservoir/i.test(s)) {
    const vol = s.match(/([\d,.]+)\s*l/i);
    return {
      type: "reservoir_liquide",
      role: "reservoirLiquide",
      item: {
        ref: s,
        modele: s,
        volumeL: vol ? parseFloat(vol[1].replace(",", ".")) : null,
        fluide: "R410A",
      },
    };
  }
  if (/^Echangeur\s+(B26\w*)/i.test(s)) {
    const modele = s.replace(/^Echangeur\s+/i, "");
    return {
      type: "echangeur_plaques",
      role: "echangeurB26",
      item: { ref: modele, fabricant: "SWEP", modele, materiau: "Cu brasé" },
    };
  }
  if (/^Echangeur\s+(F80\w*)/i.test(s)) {
    const modele = s.replace(/^Echangeur\s+/i, "");
    return {
      type: "echangeur_plaques",
      role: "echangeurF80",
      item: { ref: modele, fabricant: "SWEP", modele, materiau: "Cu brasé" },
    };
  }
  if (/^Echangeur\s+(FI22\w*)/i.test(s)) {
    const modele = s.replace(/^Echangeur\s+/i, "");
    return {
      type: "echangeur_plaques",
      role: "echangeurFI22",
      item: { ref: modele, fabricant: "SWEP", modele, materiau: "Cu brasé" },
    };
  }
  if (/^Détendeur/i.test(s)) {
    return {
      type: "detendeur",
      role: "detendeur",
      item: {
        ref: "TUAE-R410A",
        fabricant: "Danfoss",
        modele: s,
        typeDet: "tev",
        fluide: "R410A",
        notes: s,
      },
    };
  }
  if (/^Orifice/i.test(s)) {
    return {
      type: "detendeur",
      role: "orificeDetendeur",
      item: {
        ref: s,
        fabricant: "Danfoss",
        modele: s,
        typeDet: "tev",
        fluide: "R410A",
        notes: "Orifice TUAE",
      },
    };
  }
  return null;
}

function parseCirculateurLabel(label, role) {
  const s = String(label || "").trim();
  if (!s) return null;
  let fabricant = "";
  if (/^Para/i.test(s)) fabricant = "Wilo/Para";
  else if (/^Star-Z|^Star/i.test(s)) fabricant = "Wilo/Star-Z";
  else if (/^Yonos|^TOP-Z/i.test(s)) fabricant = "Wilo";
  else fabricant = "—";
  return {
    type: "circulateur",
    role,
    item: { ref: s, fabricant, modele: s, fluide: "eau / glycolé" },
  };
}

function catalogAdd(catalog, parsed) {
  const id = slugId(parsed.item.ref || parsed.item.modele);
  if (!catalog[parsed.type]) catalog[parsed.type] = new Map();
  if (!catalog[parsed.type].has(id)) {
    catalog[parsed.type].set(id, { id, type: parsed.type, ...parsed.item });
  }
  return id;
}

function exportCatalog(catalog) {
  const composants = {};
  Object.keys(catalog).forEach((type) => {
    composants[type] = [...catalog[type].values()];
  });
  return composants;
}

function buildComposantsFromSheet(rows) {
  const catalog = {};
  const liensByPac = {};
  COMP_MACHINE_COLS.forEach(([, pac]) => {
    liensByPac[pac] = {};
  });

  for (let r = 1; r < rows.length; r++) {
    const label = rows[r][0];
    const parsed = parseComponentRow(label);
    if (!parsed) continue;
    const id = catalogAdd(catalog, parsed);
    COMP_MACHINE_COLS.forEach(([col, pac]) => {
      const v = rows[r][col];
      if (v === 1 || v === "1" || (typeof v === "number" && v > 0)) {
        liensByPac[pac][parsed.role] = id;
      }
    });
  }

  return { catalog, liensByPac };
}

function addCirculateurLinks(general, catalog, liens, pac) {
  const links = liens[pac] || (liens[pac] = {});
  const h = general?.hydraulique || {};
  const e = general?.ecs || {};
  const map = [
    ["circulateurFroid", h.circulateurFroid],
    ["circulateurChaud", h.circulateurChaud],
    ["circulateurEcs", e.circulateurEcs],
  ];
  map.forEach(([role, label]) => {
    const parsed = parseCirculateurLabel(label, role);
    if (!parsed) return;
    const id = catalogAdd(catalog, parsed);
    links[role] = id;
  });
}

function normDep(label) {
  if (/47|55/.test(label)) return "47/55";
  if (/40|45/.test(label)) return "40/45";
  return "30/35";
}

function etasPct(v) {
  const n = num(v);
  if (!n) return null;
  return n < 10 ? Math.round(n * 100) : Math.round(n);
}

function pageKey(src, dep) {
  return `${src}|${dep}`;
}

function mkPerfPoint({ chaud, absorbee, froid, scop, etas, classeEnergie, consoAnnuelleKwh }) {
  const absorbeeR = round2(absorbee);
  const chaudR = round2(chaud);
  const cop = absorbeeR > 0 ? round2(chaudR / absorbeeR) : round2(scop);
  const out = {
    chaud: chaudR,
    froid: round2(froid),
    absorbee: absorbeeR,
    cop,
    intensite: 0,
    scop: round2(scop),
  };
  const eta = etasPct(etas);
  if (eta != null) out.etasPct = eta;
  if (classeEnergie) out.classeEnergie = classeEnergie;
  if (consoAnnuelleKwh) out.consoAnnuelleKwh = round2(consoAnnuelleKwh);
  return out;
}

function readRegimeBlock(rows, startRow, col) {
  const dep = normDep(String(rows[startRow][0] || ""));
  const out = { dep };
  Object.entries(METRIC_ROWS).forEach(([key, off]) => {
    const v = rows[startRow + off]?.[col];
    if (key === "classeEnergie") out[key] = str(v);
    else if (key === "consoAnnuelleKwh") out[key] = num(v);
    else out[key] = num(v);
  });
  return out;
}

function readGeneral(rows, descRow, col) {
  const cell = (off) => rows[descRow + off]?.[col];
  return {
    dimensions: {
      poidsKg: num(cell(3)),
      hauteurMm: num(cell(4)),
      largeurMm: num(cell(5)),
      profondeurMm: num(cell(6)),
    },
    acoustique: { puissanceAcoustiqueDb: num(cell(7)) },
    hydraulique: {
      connexion: str(cell(8)),
      debitCaptageM3h: num(cell(9)),
      pdcCaptageKpa: num(cell(10)),
      circulateurFroid: str(cell(11)),
      debitChauffageM3h: num(cell(12)),
      pdcChauffageKpa: num(cell(13)),
      circulateurChaud: str(cell(14)),
    },
    ecs: {
      ballonL: (() => {
        const m = String(cell(15) || "").match(/(\d+)/);
        return m ? +m[1] : null;
      })(),
      ballon: str(cell(15)),
      circulateurEcs: str(cell(16)),
    },
    electrique: {
      tension: str(cell(17)),
      cableAlimentation: str(cell(18)),
      protection: str(cell(19)),
      appointElectriqueKw: num(cell(20)),
    },
  };
}

function modelKw(name) {
  return parseInt(String(name).replace(/\D/g, ""), 10) || 0;
}

function buildPack(perfRows, compRows) {
  const descRow = findRow(perfRows, (r) => String(r[0]).includes("DESCRIPTION"));
  if (descRow < 0) throw new Error("Section DESCRIPTION GENERALE introuvable");
  const REGIMES = findPerfRegimes(perfRows);
  if (REGIMES.some((r) => r.startRow < 0)) throw new Error("Blocs régimes performance introuvables");

  const { catalog, liensByPac: liensComp } = buildComposantsFromSheet(compRows);

  const machines = [];
  const performances = {};

  function colFor(block, model, alim) {
    const i = alim === "Mono" ? MONO_MODELS.indexOf(model) : TRI_MODELS.indexOf(model);
    if (i < 0) return null;
    return alim === "Mono" ? block.monoStart + i : block.triStart + i;
  }

  function addUnit(model, alim) {
    const pac = `${model} ${alim}`;
    const kw = modelKw(model);
    const tension = alim === "Mono" ? 0 : 1;
    const specCol = colFor(BLOCKS[0], model, alim);
    if (specCol == null) return;

    const general = readGeneral(perfRows, descRow, specCol);
    addCirculateurLinks(general, catalog, liensComp, pac);

    const composantsLiens = { ...(liensComp[pac] || {}) };

    machines.push({
      pac,
      gammeCode: 6,
      tension,
      nbComp: 1,
      ref: kw,
      reversible: 1,
      chargeFluide: kw <= 90 ? 3 : kw <= 110 ? 4 : 5,
      general,
      composantsLiens,
    });

    performances[pac] = {};
    BLOCKS.forEach((block) => {
      const col = colFor(block, model, alim);
      if (col == null) return;
      REGIMES.forEach(({ dep, startRow }) => {
        const r = readRegimeBlock(perfRows, startRow, col);
        const pk = pageKey(block.src, dep);
        const pt = mkPerfPoint(r);
        if (dep === "30/35" && pt.etasPct != null) pt.etaS30 = pt.etasPct;
        if (dep === "47/55" && pt.etasPct != null) pt.etaS50 = pt.etasPct;
        performances[pac][pk] = pt;
      });
    });
  }

  MONO_MODELS.forEach((m) => addUnit(m, "Mono"));
  TRI_MODELS.forEach((m) => addUnit(m, "Tri"));

  return { machines, performances, composants: exportCatalog(catalog) };
}

const xlsxPath = process.argv[2] || DEFAULT_XLSX;
if (!existsSync(xlsxPath)) {
  console.error("Fichier introuvable :", xlsxPath);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const perfRows = XLSX.utils.sheet_to_json(wb.Sheets["performances"] || wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: "",
});
const compRows = wb.Sheets["composants"]
  ? XLSX.utils.sheet_to_json(wb.Sheets["composants"], { header: 1, defval: "" })
  : [];

const { machines, performances, composants } = buildPack(perfRows, compRows);

const pack = {
  type: "oedip-gamme-pack",
  version: 4,
  date: new Date().toISOString(),
  source: xlsxPath,
  note:
    "machines[].general · machines[].composantsLiens (id catalogue) · performances · composants (bibliothèque partagée)",
  gamme: {
    nom: "G",
    code: 6,
    fonction: "geothermie",
    fluide: "R410A",
    sources: ["0/-3", "5/2", "9/6"],
    departs: ["30/35", "40/45", "47/55"],
    desc: "PAC géothermique R410A · G80 à G140",
  },
  composants,
  machines,
  performances,
};

writeFileSync(OUT, JSON.stringify(pack, null, 2), "utf8");
const nComp = Object.values(composants).reduce((s, a) => s + a.length, 0);
console.log("Écrit:", OUT);
console.log("Machines:", machines.length, "· catalogue:", nComp, "composants");
