/**
 * Régénère data/oedip-default-project.{json,js}
 * Fusionne les courbes Pdc échangeurs depuis data/oedip-echangeurs-pdc.json.
 *
 * Usage: node scripts/build-default-project.mjs [chemin/projet-source.json]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(root, "data/oedip-default-project.json");
const defaultSource = process.argv[2] || outPath;
const pdcPath = path.join(root, "data/oedip-echangeurs-pdc.json");

if (!fs.existsSync(defaultSource)) {
  console.error("Fichier source introuvable :", defaultSource);
  process.exit(1);
}
if (!fs.existsSync(pdcPath)) {
  console.error("Catalogue Pdc introuvable — lancez d'abord : npm run echangeurs:import");
  process.exit(1);
}

const proj = JSON.parse(fs.readFileSync(defaultSource, "utf8"));
const geoProcPath = path.join(root, "data/oedip-procedures-geo.json");
if (fs.existsSync(geoProcPath)) {
  const geo = JSON.parse(fs.readFileSync(geoProcPath, "utf8"));
  if (!proj.data) proj.data = {};
  if (!Array.isArray(proj.data.procedureCatalogs)) proj.data.procedureCatalogs = [];
  const idx = proj.data.procedureCatalogs.findIndex((c) => +c.gammeCode === +geo.gammeCode);
  if (idx >= 0) proj.data.procedureCatalogs[idx] = geo;
  else proj.data.procedureCatalogs.push(geo);
}
const { byRef } = JSON.parse(fs.readFileSync(pdcPath, "utf8"));
const list = proj.data?.composants?.echangeur_plaques || [];
let n = 0;
const missing = [];

list.forEach((item) => {
  const key = item.ref || item.modele;
  const entry = byRef[key];
  if (!entry?.courbesPdc?.length) {
    missing.push(key);
    return;
  }
  item.courbesPdc = JSON.parse(JSON.stringify(entry.courbesPdc));
  if (entry.plaques) item.plaques = entry.plaques;
  n++;
});

fs.writeFileSync(outPath, JSON.stringify(proj, null, 2) + "\n", "utf8");

const jsPath = path.join(root, "data/oedip-default-project.js");
const js = `/* OEDIP — projet par défaut (généré automatiquement)
   Source : data/oedip-default-project.json
   Régénérer : npm run default:build
*/
const OEDIP_DEFAULT_PROJECT = ${JSON.stringify(proj)};
`;
fs.writeFileSync(jsPath, js, "utf8");

console.log("Source :", path.relative(root, defaultSource));
console.log("Bundled :", path.relative(root, outPath), "—", (fs.statSync(outPath).size / 1024).toFixed(0), "KB");
console.log("Script  :", path.relative(root, jsPath));
console.log("Courbes Pdc :", n + "/" + list.length, "échangeurs");
if (missing.length) console.warn("Sans courbe :", missing.join(", "));
