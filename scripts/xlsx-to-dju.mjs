/**
 * Convertit data/statistiques_sdes_dju_donnees_departements_1990_2025.xlsx
 * → data/oedip-dju-departements.js (+ data/oedip-dju-departements.json)
 *
 * Usage: node scripts/xlsx-to-dju.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsxPath = path.join(
  root,
  "data/statistiques_sdes_dju_donnees_departements_1990_2025.xlsx"
);

function parseSheet(wb, sheetName) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
  });
  const hdrIdx = rows.findIndex(
    (r) => r[0] === "Nom département" && r[1] === "Code département"
  );
  if (hdrIdx < 0) throw new Error("En-tête introuvable dans " + sheetName);
  const header = rows[hdrIdx];
  const years = header
    .slice(2)
    .map((y) => +y)
    .filter((y) => y >= 1900 && y <= 2100);
  const byCode = {};
  for (const row of rows.slice(hdrIdx + 1)) {
    const nom = String(row[0] || "").trim();
    let code = String(row[1] || "").trim();
    if (!nom || !code) continue;
    if (/^\d$/.test(code)) code = "0" + code;
    const dju = {};
    years.forEach((y, i) => {
      const v = row[2 + i];
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\s/g, ""));
      if (!isNaN(n)) dju[y] = Math.round(n);
    });
    byCode[code] = { nom, dju };
  }
  return { years, byCode };
}

const wb = XLSX.readFile(xlsxPath);
const s17 = parseSheet(wb, "DJU 17°C");
const s15 = parseSheet(wb, "DJU 15°C");

const years = s17.years;
const byCode = {};
for (const code of Object.keys(s17.byCode)) {
  byCode[code] = {
    nom: s17.byCode[code].nom,
    dju17: s17.byCode[code].dju,
    dju15: s15.byCode[code]?.dju || {},
  };
}

const jsonOut = {
  meta: {
    source: "statistiques_sdes_dju_donnees_departements_1990_2025.xlsx",
    generated: new Date().toISOString(),
    years,
    bases: ["17°C", "15°C"],
    defaultBase: 17,
    defaultYear: 2025,
    defaultRef: "moyenne",
    departements: Object.keys(byCode).length,
  },
  byCode,
};

fs.writeFileSync(
  path.join(root, "data/oedip-dju-departements.json"),
  JSON.stringify(jsonOut, null, 2),
  "utf8"
);

const js = `/* OEDIP — DJU SDES par département (généré automatiquement)
   Source : data/statistiques_sdes_dju_donnees_departements_1990_2025.xlsx
   Régénérer : node scripts/xlsx-to-dju.mjs
*/
const OEDIP_DJU_META = ${JSON.stringify(jsonOut.meta, null, 2)};
const OEDIP_DJU_YEARS = OEDIP_DJU_META.years;
const OEDIP_DJU_DEFAULT_YEAR = OEDIP_DJU_META.defaultYear;
const OEDIP_DJU_DEFAULT_REF = OEDIP_DJU_META.defaultRef || "moyenne";
const OEDIP_DJU_DEFAULT_BASE = OEDIP_DJU_META.defaultBase;
const OEDIP_DJU_BY_CODE = ${JSON.stringify(byCode, null, 2)};

/** DJU pour un département (base 17 °C par défaut). year = nombre ou "moyenne" (1990–2025). */
function djuForDepartment(code, year, baseC) {
  const base = baseC == null ? OEDIP_DJU_DEFAULT_BASE : +baseC;
  const c = code == null ? "" : String(code);
  const dept =
    OEDIP_DJU_BY_CODE[c] ||
    OEDIP_DJU_BY_CODE[c.padStart(2, "0")] ||
    OEDIP_DJU_BY_CODE[c.replace(/^0+/, "")];
  if (!dept) return null;
  const tbl = base === 15 ? dept.dju15 : dept.dju17;
  const y = year ?? OEDIP_DJU_DEFAULT_REF ?? "moyenne";
  if (y === "moyenne" || y === "avg") {
    const vals = Object.values(tbl).filter((v) => typeof v === "number" && !isNaN(v));
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  const yn = +y;
  return tbl[yn] ?? tbl[OEDIP_DJU_DEFAULT_YEAR] ?? null;
}
`;

fs.writeFileSync(path.join(root, "data/oedip-dju-departements.js"), js, "utf8");
console.log(
  "OK",
  Object.keys(byCode).length,
  "départements ·",
  years[0],
  "–",
  years[years.length - 1],
  "· ex. Marne 51 / 2025:",
  byCode["51"]?.dju17[2025]
);
