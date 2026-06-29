/**
 * Ajoute les compresseurs Copeland YH (R454C) et l'échangeur FI22ASMX44 manquant.
 * Usage: node scripts/add-yh-components.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/oedip-catalog.json");
const pdcPath = path.join(root, "data/oedip-echangeurs-pdc.json");

/** Déplacements volumétriques @ 50 Hz — nomenclature Copeland YH (A2L R454C/R452B). */
const DISPLACEMENT = {
  YH04: 4.0,
  YH06: 6.1,
  YH07: 7.2,
  YH09: 9.1,
  YH11: 11.4,
  YH13: 13.5,
  YH16: 16.2,
};

/** Perf. @ Te=3°C, Tc=40°C, SH=5K, SC=5K (régime 5/2 30/35). */
const COMPRESSORS = [
  { id: "cmp_yh04k1e_pfj_77ef16d26c", ref: "YH04K1E-PFJ", tension: "0", iMaxA: 11.4, pAbs: 1.32, pChaud: 6.35, cop: 4.8, debitGs: 34.7, fi22: 44 },
  { id: "cmp_yh04k1e_tfd_ee0f7b95bf", ref: "YH04K1E-TFD", tension: "1", iMaxA: 4.6, pAbs: 1.34, pChaud: 6.46, cop: 4.83, debitGs: 35.0, fi22: 44 },
  { id: "cmp_yh06k1e_pfj_3b29146c17", ref: "YH06K1E-PFJ", tension: "0", iMaxA: 16.2, pAbs: 1.8, pChaud: 8.79, cop: 4.9, debitGs: 48.2, fi22: 56 },
  { id: "cmp_yh06k1e_tfd_82c4e058ad", ref: "YH06K1E-TFD", tension: "1", iMaxA: 6.2, pAbs: 1.76, pChaud: 9.01, cop: 5.12, debitGs: 49.7, fi22: 56 },
  { id: "cmp_yh07k1e_pfj_184e103229", ref: "YH07K1E-PFJ", tension: "0", iMaxA: 20.6, pAbs: 2.2, pChaud: 10.9, cop: 4.95, debitGs: 58.9, fi22: 68 },
  { id: "cmp_yh07k1e_tfd_52827fda48", ref: "YH07K1E-TFD", tension: "1", iMaxA: 7.7, pAbs: 2.19, pChaud: 11.3, cop: 5.18, debitGs: 62.3, fi22: 68 },
  { id: "cmp_yh09k1e_pfj_5a83cc7fcf", ref: "YH09K1E-PFJ", tension: "0", iMaxA: 23.5, pAbs: 2.42, pChaud: 12.45, cop: 5.14, debitGs: 68.6, fi22: 78 },
  { id: "cmp_yh09k1e_tfd_1c4fb1b5f6", ref: "YH09K1E-TFD", tension: "1", iMaxA: 8.8, pAbs: 2.47, pChaud: 12.8, cop: 5.18, debitGs: 70.8, fi22: 78 },
  { id: "cmp_yh11k1e_tfd_c66d81b4bf", ref: "YH11K1E-TFD", tension: "1", iMaxA: 11.3, pAbs: 3.11, pChaud: 15.95, cop: 5.14, debitGs: 88.7, fi22: 90 },
  { id: "cmp_yh13k1e_tfd_4bf7f20bf6", ref: "YH13K1E-TFD", tension: "1", iMaxA: 12.9, pAbs: 3.61, pChaud: 18.8, cop: 5.21, debitGs: 105.0, fi22: 116 },
  { id: "cmp_yh16k1e_tfd_32219aa7df", ref: "YH16K1E-TFD", tension: "1", iMaxA: 15.9, pAbs: 4.66, pChaud: 23.9, cop: 5.14, debitGs: 133.0, fi22: null },
];

function round2(n) {
  return +Number(n).toFixed(2);
}

function makeCompressor(c) {
  const size = c.ref.match(/YH(\d+)/)?.[1];
  const disp = DISPLACEMENT[`YH${size}`];
  const pFroid = round2(c.pChaud - c.pAbs);
  return {
    id: c.id,
    type: "compresseur",
    ref: c.ref,
    fabricant: "Copeland",
    modele: c.ref,
    typeComp: "scroll",
    fluide: "R454C",
    pFroidKW: pFroid,
    pChaudKW: c.pChaud,
    debitMh: round2(c.debitGs * 3.6),
    cop: c.cop,
    iMaxA: c.iMaxA,
    tension: c.tension,
    notes: `Série YH A2L · Déplacement ${disp} m³/h @ 50 Hz · Perf. Te=3°C Tc=40°C SH/SC=5K · FI22 ${c.fi22 ?? "—"} plq`,
  };
}

function scalePdcCurves(source, ratio) {
  return source.courbesPdc.map((cu) => ({
    regime: cu.regime,
    points: cu.points.map((pt) => ({
      debit: pt.debit,
      pdcKpa: round2(pt.pdcKpa * ratio),
    })),
  }));
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const pdc = JSON.parse(fs.readFileSync(pdcPath, "utf8"));

const compList = catalog.data.composants.compresseur;
const exchList = catalog.data.composants.echangeur_plaques;
const existingCompRefs = new Set(compList.map((x) => x.ref));
const existingExchRefs = new Set(exchList.map((x) => x.ref));

let addedComp = 0;
for (const c of COMPRESSORS) {
  if (existingCompRefs.has(c.ref)) continue;
  compList.push(makeCompressor(c));
  addedComp++;
}

const fi44Id = "cmp_fi22asmx44_9e94f80522";
if (!existingExchRefs.has("FI22ASMX44")) {
  const src = pdc.byRef.FI22ASMX46;
  if (!src) throw new Error("FI22ASMX46 introuvable dans oedip-echangeurs-pdc.json");
  const ratio = 46 / 44;
  const fi44Entry = {
    ref: "FI22ASMX44",
    plaques: 44,
    courbesPdc: scalePdcCurves(src, ratio),
  };
  pdc.byRef.FI22ASMX44 = fi44Entry;
  exchList.push({
    id: fi44Id,
    type: "echangeur_plaques",
    ref: "FI22ASMX44",
    fabricant: "SWEP",
    modele: "FI22ASMX44",
    materiau: "Cu brasé",
    courbesPdc: JSON.parse(JSON.stringify(fi44Entry.courbesPdc)),
    plaques: 44,
    notes: "Courbes Pdc extrapolées depuis FI22ASMX46 (46 plq) — ratio 46/44",
  });
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
fs.writeFileSync(pdcPath, JSON.stringify(pdc, null, 2) + "\n", "utf8");

console.log(`Compresseurs YH ajoutés : ${addedComp}`);
console.log(`FI22ASMX44 : ${existingExchRefs.has("FI22ASMX44") ? "déjà présent" : "ajouté"}`);
