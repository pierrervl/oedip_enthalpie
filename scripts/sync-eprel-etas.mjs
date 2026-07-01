/**
 * Met à jour les fiches EPREL et performances machines (5/2 · 30/35 et 47/55)
 * avec les ηs EPREL à climat moyen (Average35 / Average55).
 * Usage: node scripts/sync-eprel-etas.mjs [n° EPREL …]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/oedip-catalog.json");
const EPREL_API = "https://eprel.ec.europa.eu/api/product/";
const SRC = "5/2";
const DEP_30 = "30/35";
const DEP_55 = "47/55";

function eprelModelToPac(modelIdentifier) {
  const u = String(modelIdentifier || "").toUpperCase().replace(/-/g, " ").trim();
  const m = u.match(/G\s*(\d+)\s*(MONO|TRI)?/);
  if (!m) return null;
  const phase = m[2] === "TRI" ? "Tri" : "Mono";
  return `G${m[1]} ${phase}`;
}

function ensureFiche(perf, pac, key) {
  if (!perf[pac]) perf[pac] = {};
  if (!perf[pac][key]) {
    perf[pac][key] = {
      chaud: 0, froid: 0, absorbee: 0, intensite: 0, cop: 0,
      etaS30: null, etaS50: null, etasPct: null, pCaptSpec: 30,
    };
  }
  return perf[pac][key];
}

async function fetchEprel(regNum) {
  const res = await fetch(EPREL_API + regNum);
  if (!res.ok) throw new Error("introuvable");
  return res.json();
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const data = catalog.data;
if (!Array.isArray(data.eprelFiches)) data.eprelFiches = [];
if (!data.performances) data.performances = {};

const nums = process.argv.slice(2).length
  ? process.argv.slice(2).map((n) => n.replace(/\D/g, ""))
  : data.eprelFiches.map((f) => f.registrationNumber).filter(Boolean);

for (const n of nums) {
  const dataApi = await fetchEprel(n);
  const pac = eprelModelToPac(dataApi.modelIdentifier);
  const eta30 = dataApi.seasonalSpaceHeatingEnergyEfficiencyAverage35 ?? null;
  const eta55 = dataApi.seasonalSpaceHeatingEnergyEfficiencyAverage55 ?? null;

  let fiche = data.eprelFiches.find((f) => String(f.registrationNumber) === n);
  if (!fiche) {
    console.warn("Fiche EPREL absente pour", n, "— lancez import-eprel.mjs d'abord");
    continue;
  }

  fiche.etaSeasonalPct = eta30 ?? fiche.etaSeasonalPct;
  fiche.etaS30Avg = eta30;
  fiche.etaS55Avg = eta55;
  fiche.energyClass55 = dataApi.energyClass55 || fiche.energyClass55 || "";
  if (pac) fiche.machines = [pac];

  if (pac && data.performances[pac]) {
    const f30 = ensureFiche(data.performances, pac, `${SRC}|${DEP_30}`);
    const f55 = ensureFiche(data.performances, pac, `${SRC}|${DEP_55}`);
    if (eta30 != null) {
      f30.etaS30 = eta30;
      f30.etasPct = eta30;
    }
    if (eta55 != null) {
      f55.etaS50 = eta55;
      f55.etasPct = eta55;
    }
    console.log(`${n} → ${pac} · ηs ${DEP_30}=${eta30}% · ${DEP_55}=${eta55}%`);
  } else {
    console.warn(`${n} → ${pac || "?"} · perf non trouvée`);
  }
}

catalog.date = new Date().toISOString();
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("\nCatalogue mis à jour — npm run default:build");
