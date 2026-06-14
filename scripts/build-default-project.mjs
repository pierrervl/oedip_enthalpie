/**
 * Régénère le catalogue OEDIP et l'étude démo à partir de data/oedip-catalog.json
 * (ou d'une source legacy oedip-project).
 * Fusionne procédures géo + courbes Pdc échangeurs.
 *
 * Usage: node scripts/build-default-project.mjs [chemin/source.json]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/oedip-catalog.json");
const legacyPath = path.join(root, "data/oedip-default-project.json");
const defaultSource = process.argv[2] || (fs.existsSync(catalogPath) ? catalogPath : legacyPath);
const pdcPath = path.join(root, "data/oedip-echangeurs-pdc.json");
const demoPath = path.join(root, "data/oedip-demo-study.json");

if (!fs.existsSync(defaultSource)) {
  console.error("Source introuvable — lancez default:build après avoir créé data/oedip-catalog.json");
  process.exit(1);
}
if (!fs.existsSync(pdcPath)) {
  console.error("Catalogue Pdc introuvable — lancez d'abord : npm run echangeurs:import");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(defaultSource, "utf8"));
const proj = raw.type === "oedip-catalog" ? { ...raw, data: raw.data || {} } : raw;
if (!proj.data) proj.data = {};

const geoProcPath = path.join(root, "data/oedip-procedures-geo.json");
if (fs.existsSync(geoProcPath)) {
  const geo = JSON.parse(fs.readFileSync(geoProcPath, "utf8"));
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

const catalog = {
  type: "oedip-catalog",
  version: 1,
  date: proj.date || new Date().toISOString(),
  meta: proj.meta,
  reglages: proj.reglages,
  prix: proj.prix,
  pci: proj.pci,
  co2: proj.co2,
  data: proj.data,
};

let demoStudy = null;
if (fs.existsSync(demoPath)) {
  demoStudy = JSON.parse(fs.readFileSync(demoPath, "utf8"));
} else if (proj.projet) {
  demoStudy = {
    type: "oedip-study",
    version: 3,
    date: new Date().toISOString(),
    etudeNom: "Démo",
    reglages: proj.reglages,
    prix: proj.prix,
    pci: proj.pci,
    co2: proj.co2,
    projet: proj.projet,
  };
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

const catalogJsPath = path.join(root, "data/oedip-catalog.js");
fs.writeFileSync(
  catalogJsPath,
  `/* OEDIP — catalogue de référence (généré)
   Régénérer : npm run default:build
*/
const OEDIP_DEFAULT_CATALOG = ${JSON.stringify(catalog)};
`,
  "utf8"
);

if (demoStudy) {
  fs.writeFileSync(demoPath, JSON.stringify(demoStudy, null, 2) + "\n", "utf8");
  const demoJsPath = path.join(root, "data/oedip-demo-study.js");
  fs.writeFileSync(
    demoJsPath,
    `/* OEDIP — étude démo (générée)
   Régénérer : npm run default:build
*/
const OEDIP_DEMO_STUDY = ${JSON.stringify(demoStudy)};
`,
    "utf8"
  );
}

console.log("Catalogue :", path.relative(root, catalogPath), "—", (fs.statSync(catalogPath).size / 1024).toFixed(0), "KB");
console.log("Script    :", path.relative(root, catalogJsPath));
if (demoStudy) {
  console.log("Étude démo:", path.relative(root, demoPath), "—", (fs.statSync(demoPath).size / 1024).toFixed(0), "KB");
}
console.log("Courbes Pdc :", n + "/" + list.length, "échangeurs");
if (missing.length) console.warn("Sans courbe :", missing.join(", "));
