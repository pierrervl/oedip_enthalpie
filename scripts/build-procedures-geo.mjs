/**
 * Génère data/oedip-procedures-geo.json — procédures tubes Géo + annexes montage.
 * Dimensions : {{L}}, {{diam}}, {{L1}}… — défaut step.dims, surcharge machine.frigoProcDims[procId].eN
 * Régénérer : npm run procedures:geo:build
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG_DIR = path.join(root, "img/procedures/geo");
const outPath = path.join(root, "data/oedip-procedures-geo.json");

function hasImg(stem) {
  return fs.existsSync(path.join(IMG_DIR, `${stem}.jpg`));
}

function sortPhotoStems(a, b) {
  return a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });
}

/** Associe automatiquement les JPEG du dossier aux étapes des procédures. */
function applyAutoProcedurePhotos(procedures) {
  if (!fs.existsSync(IMG_DIR)) return { orphans: [], mapped: 0 };
  const stems = fs.readdirSync(IMG_DIR).filter((f) => f.toLowerCase().endsWith(".jpg")).map((f) => f.slice(0, -4));
  const byKey = new Map();
  const orphans = new Set(stems);

  const assign = (procId, stepIdx, stem) => {
    const key = `${procId}:${stepIdx}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(stem);
    orphans.delete(stem);
  };

  const procById = Object.fromEntries(procedures.map((p) => [p.id, p]));

  for (const stem of stems) {
    const s = stem;
    const low = s.toLowerCase();

    let m = s.match(/^T(\d+)[-_]E(\d+)/i);
    if (m) {
      assign(`geo-tube-${String(+m[1]).padStart(2, "0")}`, +m[2] - 1, s);
      continue;
    }
    m = s.match(/^T(\d+)_E(\d+)/i);
    if (m) {
      assign(`geo-tube-${String(+m[1]).padStart(2, "0")}`, +m[2] - 1, s);
      continue;
    }

    if (low.startsWith("chassis-e")) {
      m = s.match(/E(\d+)/i);
      if (m) assign("geo-annex-chassis", +m[1] - 1, s);
      continue;
    }
    if (low === "chassis_e3" || low === "chassis-e3") {
      assign("geo-annex-chassis", 2, s);
      continue;
    }
    if (low === "chassis-finis") {
      assign("geo-annex-chassis", 1, s);
      continue;
    }
    if (low === "chassis-dans-caisse") {
      assign("geo-annex-chassis", 2, s);
      continue;
    }

    if (low.startsWith("condenseur-e")) {
      m = s.match(/E(\d+)/i);
      if (m) assign("geo-annex-condenseur", +m[1] - 1, s);
      continue;
    }

    if (low.includes("brasage") && low.includes("e")) {
      m = s.match(/E(\d+)/i);
      if (m) assign("geo-annex-detendeur", +m[1], s);
      continue;
    }

    if (/^b12x50/i.test(s)) {
      m = s.match(/E(\d+)/i);
      if (m) {
        const stepIdx = +m[1] === 10 ? 4 : +m[1] - 1;
        assign("geo-annex-evap-b12", stepIdx, s);
      }
      continue;
    }

    if (low.startsWith("alim_compresseur")) {
      assign("geo-annex-compresseur", 2, s);
    }
  }

  let mapped = 0;
  for (const [key, photoStems] of byKey) {
    const [procId, stepIdxStr] = key.split(":");
    const stepIdx = +stepIdxStr;
    const proc = procById[procId];
    if (!proc) continue;
    while (proc.steps.length <= stepIdx) {
      proc.steps.push({ text: `Étape ${proc.steps.length + 1} (photo)` });
    }
    photoStems.sort(sortPhotoStems);
    const images = photoStems.map((st) => `img/procedures/geo/${st}.jpg`);
    const step = proc.steps[stepIdx];
    if (images.length === 1) {
      step.image = images[0];
      delete step.images;
    } else {
      step.images = images;
      delete step.image;
    }
    mapped += images.length;
  }

  return { orphans: [...orphans].sort(sortPhotoStems), mapped };
}

/** @param {string} text @param {Record<string,string>|string} dimsOrPhoto @param {...string} rest */
function step(text, dimsOrPhoto, ...rest) {
  let dims = {};
  let stems = [];
  if (dimsOrPhoto && typeof dimsOrPhoto === "object" && !Array.isArray(dimsOrPhoto)) {
    dims = dimsOrPhoto;
    stems = rest;
  } else {
    stems = dimsOrPhoto ? [dimsOrPhoto, ...rest] : rest;
  }
  const images = stems.filter(hasImg).map((s) => `img/procedures/geo/${s}.jpg`);
  const out = { text };
  if (Object.keys(dims).length) out.dims = dims;
  if (images.length === 1) out.image = images[0];
  else if (images.length > 1) out.images = images;
  return out;
}

const TUBE_META = {
  "geo-tube-01": { tubeRef: "T1-CP-CD", tubeNum: 1 },
  "geo-tube-02": { tubeRef: "T2-CD-T3", tubeNum: 2 },
  "geo-tube-03": { tubeRef: "T3-T3-RL", tubeNum: 3 },
  "geo-tube-04": { tubeRef: "T4-RL-DH", tubeNum: 4 },
  "geo-tube-05": { tubeRef: "T5-DH-VL", tubeNum: 5 },
  "geo-tube-06": { tubeRef: "T6-VL-BAC", tubeNum: 6 },
  "geo-tube-07": { tubeRef: "T7-BAC-T8", tubeNum: 7 },
  "geo-tube-08": { tubeRef: "T8-T8-DE", tubeNum: 8 },
  "geo-tube-09": { tubeRef: "T9-DE-EV", tubeNum: 9 },
  "geo-tube-10": { tubeRef: "T10-EV-BAC", tubeNum: 10 },
  "geo-tube-11": { tubeRef: "T11-BAC-CP", tubeNum: 11 },
  "geo-tube-12": { tubeRef: "T12-EG-DE", tubeNum: 12 }
};

function finalizeTubeVariants(proc) {
  const meta = TUBE_META[proc.id];
  if (!meta) return;
  proc.tubeRef = proc.tubeRef || meta.tubeRef;
  proc.tubeNum = proc.tubeNum ?? meta.tubeNum;
  if (proc.variants?.length) {
    proc.variants.forEach((v) => {
      v.ver = String(v.ver || "01").padStart(2, "0");
      if (!v.ref) v.ref = `${proc.tubeRef}-${v.ver}`;
    });
    return;
  }
  const stepDims = {};
  (proc.steps || []).forEach((s, i) => {
    if (s.dims && Object.keys(s.dims).length) stepDims[`e${i + 1}`] = { ...s.dims };
  });
  proc.variants = [{ ver: "01", ref: `${proc.tubeRef}-01`, stepDims }];
  proc.steps.forEach((s) => { delete s.dims; });
}

function applyTubeMeta(procedures) {
  procedures.forEach((p) => finalizeTubeVariants(p));
}

const procedures = [
  {
    id: "geo-tube-01",
    order: 1,
    title: "Tube 1 — Compresseur → Condenseur",
    target: { type: "pipe", pipeId: "disCompCond" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "55", diam: "1/2" }),
      step("Ergot, cintrer à 90° puis recouper {{L}} cm.", { L: "1" }),
      step("Coter {{L}} cm de l'axe du tube.", { L: "42" }),
      step('Marque sur "O", cintrer à 45° dans le même sens.'),
      step('Réduction M-F {{diam1}}"–{{diam2}}" + Coude 90° M-F {{diam3}}" GR.', { diam1: "7/8", diam2: "1/2", diam3: "7/8" }, "T1_E5-1", "T1_E5-2"),
      step("Braser le tout.")
    ]
  },
  {
    id: "geo-tube-02",
    order: 2,
    title: "Tube 2 — Condenseur → Tube 3",
    target: { type: "pipe", pipeId: "disFi22Cond" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "23", diam: "1/2" }),
      step("Coter {{L}} cm du bord du tube.", { L: "8,5" }),
      step('Marque sur "L", cintrer à 90°.'),
      step("Coter {{L}} cm de l'axe du tube.", { L: "6,5" }),
      step('Marque sur "O", cintrer à 22,5°, tube à l\'opposé.'),
      step("Recouper {{L}} cm.", { L: "2,5" })
    ]
  },
  {
    id: "geo-tube-03",
    order: 3,
    title: "Tube 3 — Tube 2 → Réservoir liquide",
    target: { type: "pipe", pipeId: "liqCondRes" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "25", diam: "1/2" }),
      step("Ergot, cintrer à 45° puis recouper {{L}} cm.", { L: "2" }),
      step("Coter {{L}} cm du bout du tube.", { L: "12" }),
      step("Marque sur 45°, cintré à 45° à l'inverse."),
      step('Couper 1 Schrader {{diam}}" en 2.', { diam: "1/4" }),
      step("Ergot, cintrer le pressostat HP à 90°."),
      step("Coter {{L1}} cm et {{L2}} cm du bord du tube.", { L1: "3,5", L2: "7" }),
      step("Percer le tube au marque de Ø {{diamTrou}} mm puis ébavurer les deux trous.", { diamTrou: "6" }),
      step("Monter le Schrader et le pressostat puis braser."),
      step('Faire une emboiture {{diam}}" après le pressostat.', { diam: "1/2" }, "T3-E10")
    ]
  },
  {
    id: "geo-tube-04",
    order: 4,
    title: "Tube 4 — Réservoir liquide → Déshy Danfoss 3/8\" (plan G-100 mono)",
    target: { type: "pipe", pipeId: "liqResDet" },
    printIntro: "Tubes 4 à 6 : braser le tout à l'argent 15 % sous azote.",
    steps: [
      step('Couper {{L}} cm de tube {{diam}}".', { L: "13", diam: "3/8" }),
      step("Ergot, cintrer à 90° puis recouper {{L}} cm.", { L: "0,5" }),
      step('Coter {{L}} cm de l\'axe du tube — Marque sur "O" puis cintrer à 15° (tube vers nous) — Puis recouper {{L2}} cm — Réduction MF {{diam1}}"–{{diam2}}".', { L: "4", L2: "2", diam1: "1/2", diam2: "3/8" })
    ]
  },
  {
    id: "geo-tube-05",
    order: 5,
    title: "Tube 5 — Déshy Danfoss → Voyant liquide Freddox (plan G-100 mono)",
    target: { type: "workflow", group: "circuit-liquide" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "20", diam: "3/8" }),
      step('Coter {{L}} cm, marque sur "L".', { L: "12" }),
      step("Cintrer à 90° — côté long côté déshy.")
    ]
  },
  {
    id: "geo-tube-06",
    order: 6,
    title: "Tube 6 — Voyant Freddox → Bouteille anti-coup Frigomec (plan G-100 mono)",
    target: { type: "workflow", group: "circuit-liquide" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "18", diam: "3/8" }),
      step("Ergot, cintrer à 90°."),
      step("Coter {{L}} cm de l'axe du tube.", { L: "7" }),
      step('Marque sur "L", cintrer à 90° dans le même sens — côté long côté voyant.')
    ]
  },
  {
    id: "geo-tube-07",
    order: 7,
    title: "Tube 7 — Bouteille anti-coup → Tube 8",
    target: { type: "pipe", pipeId: "liqResDet" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "10", diam: "3/8" }, "T7-E1"),
      step("Braser le tube sur la bouteille anti-coup, sur la sortie liquide de la bouteille.", "T7-E2")
    ]
  },
  {
    id: "geo-tube-08",
    order: 8,
    title: "Tube 8 — Tube 7 → Détendeur",
    target: { type: "pipe", pipeId: "liqDetEvap" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "17", diam: "1/4" }, "T8-E1"),
      step("Coter {{L}} cm du bord du tube.", { L: "6" }, "T8-E2"),
      step('Marque sur "L", cintrer à 90°.', "T8-E3-1", "T8-E3-2"),
      step("Coter {{L}} cm de l'axe du tube.", { L: "6,5" }, "T8-E4"),
      step('Marque sur "L", cintrer à 90° à l\'inverse.', "T8-E5-1", "T8-E5-2")
    ]
  },
  {
    id: "geo-tube-09",
    order: 9,
    title: "Tube 9 — Détendeur → Évaporateur",
    target: { type: "pipe", pipeId: "liqDetEvap" },
    steps: [
      step('Couper {{L}} cm de tube {{diam}}".', { L: "15", diam: "1/2" }),
      step("Coter {{L}} cm du bord du tube.", { L: "8,5" }),
      step('Marque sur "L", cintrer à 90°.'),
      step("Puis recouper {{L}} cm (une ancienne version indiquait 2 cm — à confirmer sur plan).", { L: "3" }, "T9-E4-1", "T9-E4-2")
    ]
  },
  {
    id: "geo-tube-10",
    order: 10,
    title: "Tube 10 — Évaporateur → Bouteille anti-coup (7/8\", plan G-100 mono)",
    target: { type: "pipe", pipeId: "aspEvapBot" },
    printIntro: "Version retenue : assemblage 7/8\" par coudes. Variante 3/4\" cintrée sur autre plan (non détaillée ici).",
    steps: [
      step('Coude {{diam}}" 90° M-F G-R.', { diam: "7/8" }),
      step('Couper {{L}} cm de tube {{diam}}".', { L: "8,5", diam: "7/8" }, "T10-E2"),
      step('Coude {{diam}}" 45° F-F.', { diam: "7/8" }, "T10-E3"),
      step('Couper {{L}} cm de tube {{diam}}".', { L: "33", diam: "7/8" }, "T10-E4"),
      step('Coude {{diam}}" 45° M-F + Coude {{diam}}" 45° F-F.', { diam: "7/8" }, "T10-E5"),
      step('Couper {{L}} cm de tube {{diam}}".', { L: "15", diam: "7/8" }, "T10-E6"),
      step("Braser le tout.", "T10-E7-1", "T10-E7-2"),
      step("Percer Ø {{diamTrou}} mm à {{L}} cm du bord du tube de {{Lref}} cm, avant le coude 45° MF.", { diamTrou: "6", L: "4,5", Lref: "33" }, "T10-E8"),
      step('Percer Ø {{diamTrou}} mm à {{L1}} cm et {{L2}} cm du bord du tube de {{Lref}} cm, après le coude F-F {{diam}}" 45°.', { diamTrou: "6", L1: "7", L2: "10,5", Lref: "15", diam: "7/8" }, "T10-E9"),
      step("Ergot, cintrer le pressostat BP à 90°.", "T10-E10"),
      step('Couper le Schrader {{diam}}" en deux.', { diam: "1/4" }, "T10-E11"),
      step("Braser le pressostat et le Schrader sur le tube.", "T10-E12")
    ]
  },
  {
    id: "geo-tube-11",
    order: 11,
    title: "Tube 11 — Bouteille anti-coup → Aspiration compresseur (7/8\", plan G-110)",
    target: { type: "pipe", pipeId: "aspBotComp" },
    printIntro: "Version retenue : assemblage 7/8\" par coudes. Variante 3/4\" cintrée sur autre plan (non détaillée ici).",
    steps: [
      step('Coude 90° M-F {{diam}}" GR.', { diam: "7/8" }, "T11-E1"),
      step('Couper {{L}} cm de tube {{diam}}" puis assembler.', { L: "4,5", diam: "7/8" }, "T11-E2"),
      step('Coude 90° F-F {{diam}}" GR.', { diam: "7/8" }, "T11-E3"),
      step('Couper {{L}} cm de tube {{diam}}" puis assembler.', { L: "19", diam: "7/8" }, "T11-E4"),
      step('Coude 180° F-F {{diam}}" GR.', { diam: "7/8" }, "T11-E5"),
      step('Couper {{L}} cm de tube {{diam}}" puis assembler.', { L: "32,5", diam: "7/8" }, "T11-E6"),
      step('Coude 90° F-F {{diam}}" GR.', { diam: "7/8" }, "T11-E7"),
      step('Couper {{L}} cm de tube {{diam}}" puis assembler.', { L: "20", diam: "7/8" }, "T11-E8"),
      step('Coude 90° F-F {{diam}}" GR.', { diam: "7/8" }, "T11-E9"),
      step('Couper {{L}} cm de tube {{diam}}" puis assembler.', { L: "9", diam: "7/8" }, "T11-E10"),
      step('Coude 90° M-F {{diam}}" GR.', { diam: "7/8" }, "T11-E11"),
      step("Puis braser le tout.", "T11-E12-1", "T11-E12-2", "T11-E12-3")
    ]
  },
  {
    id: "geo-tube-12",
    order: 12,
    title: "Tube 12 — Égalisation (Détendeur → Tube 10)",
    target: { type: "workflow", group: "egalisation" },
    steps: [
      step('Couper {{L}} cm de {{diam}}".', { L: "22", diam: "1/4" }, "T12-E1"),
      step("Ergots, cintrer à 90°.", "T12-E2", "T12-E2-1", "T12-E2-2"),
      step("Coter {{L}} cm de l'axe du tube.", { L: "6" }, "T12-E3"),
      step('Marque sur "L", cintrer à 90° tube vers nous.', "T12-E4", "T12-E4-1", "T12-E4-2"),
      step("Coter {{L}} cm de l'axe du tube.", { L: "5,5" }, "T12-E5"),
      step('Marque sur "L", cintrer à 90° dans le même sens que précédent.', "T12-E6", "T12-E6-1", "T12-E6-2", "T12-E7", "T12-E8-1", "T12-E8-2", "T12-E8-2.1", "T12-E8-3")
    ]
  },
  {
    id: "geo-annex-chassis",
    order: 101,
    title: "Préparation châssis",
    target: { type: "workflow", group: "montage" },
    steps: [
      step("Préparer le châssis selon plan gamme.", "Chassis-E2"),
      step("Châssis fini prêt pour montage.", "Chassis-finis"),
      step("Châssis positionné dans la caisse.", "chassis-dans-caisse")
    ]
  },
  {
    id: "geo-annex-compresseur",
    order: 102,
    title: "Pose du compresseur",
    target: { type: "role", role: "compresseur" },
    gammeTable: [
      { key: "pac", label: "Machine" },
      { key: "comp.compresseur.ref", label: "Réf. compresseur" },
      { key: "comp.compresseur.modele", label: "Modèle" }
    ],
    steps: [
      step("Compresseur {{comp.compresseur.ref}} — {{comp.compresseur.modele}} (machine {{pac}})."),
      step("Fixer sur silent-blocs, vérifier l'alignement des raccords aspiration et refoulement."),
      step("Raccordement alimentation électrique compresseur.", "Alim_Compresseur-1")
    ]
  },
  {
    id: "geo-annex-bouteille",
    order: 103,
    title: "Pose bouteille anti-coup",
    target: { type: "workflow", group: "montage" },
    steps: [
      step("Positionner la bouteille anti-coup Frigomec sur le châssis selon plan."),
      step("Vérifier l'orientation des raccords liquide et gaz.")
    ]
  },
  {
    id: "geo-annex-reservoir",
    order: 104,
    title: "Pose réservoir liquide",
    target: { type: "workflow", group: "montage" },
    steps: [
      step("Fixer le réservoir liquide sur le châssis."),
      step("Préparer les raccords pour les tubes 3 et 4.")
    ]
  },
  {
    id: "geo-annex-condenseur",
    order: 105,
    title: "Préparation et isolation condenseur",
    target: { type: "role", role: "condenseur" },
    steps: [
      step("Préparer le condenseur : fixations et passages de tubes."),
      step("Isoler le condenseur selon notice fabricant.")
    ]
  },
  {
    id: "geo-annex-evap-b12",
    order: 106,
    title: "Préparation, brasage et isolation évaporateur B12",
    target: { type: "role", role: "evaporateur" },
    steps: [
      step("Préparer l'échangeur B12 × 50.", "B12x50-E1"),
      step("Étape 2 — montage / positionnement.", "B12X50-E2"),
      step("Étape 3.", "B12x50-E3"),
      step("Étape 4.", "B12x50-E4"),
      step("Étape 10 — finition.", "B12x50-E10", "B12x50-E10-1")
    ]
  },
  {
    id: "geo-annex-detendeur",
    order: 107,
    title: "Brasage détendeur",
    target: { type: "role", role: "detendeur" },
    steps: [
      step("Positionner le détendeur selon plan G-100."),
      step("Braser les tubes 8 et 9, puis le tube 12 d'égalisation.")
    ]
  },
  {
    id: "geo-annex-bulbe",
    order: 108,
    title: "Pose bulbe détendeur",
    target: { type: "role", role: "detendeur" },
    steps: [
      step("Fixer le bulbe de détendeur sur la ligne liquide selon plan."),
      step("Isoler le bulbe et vérifier la bonne prise thermique.")
    ]
  }
];

const localJpgs = fs.existsSync(IMG_DIR)
  ? fs.readdirSync(IMG_DIR).filter((f) => f.toLowerCase().endsWith(".jpg"))
  : [];
const existingHasPhotos = () => {
  if (!fs.existsSync(outPath)) return false;
  try {
    const cur = JSON.parse(fs.readFileSync(outPath, "utf8"));
    return cur.procedures?.some((p) => p.steps?.some((s) => s.image || s.images));
  } catch {
    return false;
  }
};
if (!localJpgs.length && existingHasPhotos()) {
  console.log("Pas de photos locales — conservation de", path.relative(root, outPath));
  process.exit(0);
}

const { orphans, mapped } = applyAutoProcedurePhotos(procedures);
applyTubeMeta(procedures);
const catalog = { gammeCode: 6, procedures };
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

const orphanReportPath = path.join(root, "data/procedure-photos-orphans.json");
fs.writeFileSync(orphanReportPath, JSON.stringify({ generated: new Date().toISOString(), count: orphans.length, orphans }, null, 2) + "\n", "utf8");

const withImg = procedures.reduce((n, p) => n + p.steps.filter((s) => s.image || s.images).length, 0);
const withDims = procedures.reduce((n, p) => n + p.steps.filter((s) => s.dims).length, 0);
console.log("Catalogue Géo :", procedures.length, "procédures,", withDims, "étapes dimensionnées,", withImg, "étapes avec photo,", mapped, "fichiers liés");
console.log("Écrit :", path.relative(root, outPath));
if (orphans.length) {
  console.warn("Photos sans procédure associée (" + orphans.length + ") :");
  orphans.forEach((o) => console.warn("  -", o));
} else {
  console.log("Toutes les photos sont associées à une procédure.");
}
