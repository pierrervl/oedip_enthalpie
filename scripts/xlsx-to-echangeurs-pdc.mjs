/**
 * Importe les courbes Pdc échangeurs SWEP depuis circu.xlsx (feuille « echangeurs pdc »).
 * Usage: node scripts/xlsx-to-echangeurs-pdc.mjs [chemin/circu.xlsx]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsxPath = process.argv[2] || path.join(process.env.USERPROFILE || "", "Downloads/circu.xlsx");

function num(v) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseEchangeursPdcSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const out = {};
  const warnings = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ref = String(row[1] || "").trim();
    if (!ref || !/^(B26|F80|FI22)/i.test(ref)) continue;

    const plaques = num(row[2]);
    const label = String(row[3] || "").trim();
    if (!label.includes("Pertes de charge")) continue;

    const flowRow = rows[i + 1];
    if (!flowRow || !String(flowRow[3] || "").includes("Couler")) {
      warnings.push(`${ref} : ligne débit introuvable`);
      continue;
    }

    const points = [];
    for (let c = 4; c < flowRow.length; c++) {
      const debit = num(flowRow[c]);
      const pdcKpa = num(row[c]);
      if (debit == null || pdcKpa == null) continue;
      points.push({ debit, pdcKpa: +pdcKpa.toFixed(4) });
    }

    if (!points.length) {
      warnings.push(`${ref} (${row[0]}) : aucune Pdc lisible — cellule D${i + 1} corrompue ?`);
      continue;
    }

    const regime = String(row[0] || "").trim() || "—";
    if (!out[ref]) out[ref] = { ref, plaques, courbesPdc: [] };
    if (plaques) out[ref].plaques = plaques;
    out[ref].courbesPdc.push({ regime, points });
    i++; // skip flow row
  }

  // Détecter des références annoncées sans courbe (ex. F80Hx30 corrompu)
  for (let i = 1; i < rows.length; i++) {
    const ref = String(rows[i][1] || "").trim();
    if (!ref || !/^(B26|F80|FI22)/i.test(ref) || out[ref]) continue;
    const label = String(rows[i][3] || "").trim();
    if (label.includes("Couler") || label.includes("Pertes de charge")) continue;
    if (/^0\.?5|^[\d.]+$/.test(label.replace(/\s/g, ""))) {
      warnings.push(`${ref} : ligne Pdc absente ou corrompue (col. D${i + 1})`);
    }
  }

  return { byRef: out, warnings };
}

if (!fs.existsSync(xlsxPath)) {
  console.error("Fichier introuvable :", xlsxPath);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const sheetName = wb.SheetNames.find((s) => /echangeur/i.test(s));
if (!sheetName) {
  console.error("Feuille « echangeurs pdc » introuvable. Feuilles :", wb.SheetNames.join(", "));
  process.exit(1);
}

const { byRef, warnings } = parseEchangeursPdcSheet(wb.Sheets[sheetName]);
const refs = Object.keys(byRef).sort();

const jsonOut = {
  meta: {
    source: path.basename(xlsxPath),
    sheet: sheetName,
    generated: new Date().toISOString(),
    refs: refs.length,
    warnings,
  },
  byRef,
};

fs.writeFileSync(path.join(root, "data/oedip-echangeurs-pdc.json"), JSON.stringify(jsonOut, null, 2), "utf8");

const js = `/* OEDIP — courbes Pdc échangeurs SWEP (généré automatiquement)
   Source : ${path.basename(xlsxPath)} · feuille « ${sheetName} »
   Régénérer : node scripts/xlsx-to-echangeurs-pdc.mjs
*/
const OEDIP_ECHANGEURS_PDC = ${JSON.stringify(byRef, null, 2)};

/** Interpolation linéaire Pdc(kPa) à partir d'une courbe {debit, pdcKpa}[]. */
function echangeurPdcInterpPoints(points, debitM3h) {
  if (!points?.length || !debitM3h || debitM3h <= 0) return null;
  const sorted = [...points].sort((a, b) => a.debit - b.debit);
  const q = +debitM3h;
  if (q <= sorted[0].debit) return sorted[0].pdcKpa;
  if (q >= sorted[sorted.length - 1].debit) return sorted[sorted.length - 1].pdcKpa;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (q >= a.debit && q <= b.debit) {
      const t = (q - a.debit) / (b.debit - a.debit);
      return a.pdcKpa + t * (b.pdcKpa - a.pdcKpa);
    }
  }
  return null;
}

function echangeurPdcCatalogEntry(ref) {
  if (!ref) return null;
  const key = String(ref).trim();
  return OEDIP_ECHANGEURS_PDC[key]
    || OEDIP_ECHANGEURS_PDC[key.toUpperCase()]
    || OEDIP_ECHANGEURS_PDC[Object.keys(OEDIP_ECHANGEURS_PDC).find((k) => k.toLowerCase() === key.toLowerCase())]
    || null;
}

/** Pdc (kPa) pour un modèle SWEP, régime et débit. */
function echangeurPdcAt(ref, regime, debitM3h) {
  const entry = echangeurPdcCatalogEntry(ref);
  if (!entry?.courbesPdc?.length) return null;
  let curves = entry.courbesPdc;
  if (regime) {
    const r = String(regime).toLowerCase();
    const match = curves.filter((c) => String(c.regime || "").toLowerCase().includes(r));
    if (match.length) curves = match;
  }
  return echangeurPdcInterpPoints(curves[0].points, debitM3h);
}

function mergeEchangeursPdcIntoComposants(composants) {
  if (!composants || typeof OEDIP_ECHANGEURS_PDC === "undefined") return 0;
  const list = composants.echangeur_plaques;
  if (!Array.isArray(list)) return 0;
  let n = 0;
  list.forEach((item) => {
    const key = item.ref || item.modele;
    const entry = echangeurPdcCatalogEntry(key);
    if (!entry?.courbesPdc?.length) return;
    item.courbesPdc = JSON.parse(JSON.stringify(entry.courbesPdc));
    if (entry.plaques && !item.plaques) item.plaques = entry.plaques;
    n++;
  });
  return n;
}
`;

fs.writeFileSync(path.join(root, "data/oedip-echangeurs-pdc.js"), js, "utf8");

// Patch gpac-r410-pack.json si présent
const packPath = path.join(root, "data/gpac-r410-pack.json");
if (fs.existsSync(packPath)) {
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  const list = pack.composants?.echangeur_plaques;
  if (Array.isArray(list)) {
    let n = 0;
    list.forEach((item) => {
      const entry = byRef[item.ref || item.modele];
      if (!entry?.courbesPdc?.length) return;
      item.courbesPdc = entry.courbesPdc;
      if (entry.plaques) item.plaques = entry.plaques;
      n++;
    });
    fs.writeFileSync(packPath, JSON.stringify(pack, null, 2) + "\n", "utf8");
    console.log("Pack GPAC :", n, "échangeur(s) mis à jour");
  }
}

console.log("OK", refs.length, "modèles ·", sheetName);
refs.forEach((r) => {
  const e = byRef[r];
  console.log(" ", r, "—", e.courbesPdc.map((c) => c.regime + " (" + c.points.length + " pts)").join(", "));
});
warnings.forEach((w) => console.warn("⚠", w));
