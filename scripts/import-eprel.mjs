/**
 * Importe des fiches EPREL dans data/oedip-catalog.json
 * Usage: node scripts/import-eprel.mjs 2615847 2607765 …
 *        node scripts/import-eprel.mjs --file nums.txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "data/oedip-catalog.json");
const EPREL_API = "https://eprel.ec.europa.eu/api/product/";

function nextEprelId() {
  return "eprel_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function mapEprelProductGroup(apiGroup) {
  const g = String(apiGroup || "").toLowerCase();
  if (g.includes("water")) return "water_heater";
  if (g.includes("space") || g.includes("heat") || g.includes("package") || g.includes("boiler")) return "space_heater";
  return "other";
}

function pickFirstNum(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null && v !== "" && Number.isFinite(+v)) return +v;
  }
  return null;
}

function mapEprelApiToFiche(data) {
  const reg = String(data.eprelRegistrationNumber || "");
  const pg = (data.productGroup || "product").toLowerCase();
  const meta = [
    data.productGroup ? `Groupe EPREL : ${data.productGroup}` : "",
    data.implementingAct ? `Acte : ${data.implementingAct}` : "",
    data.status ? `Statut : ${data.status}` : "",
    data.spaceHeaterType ? `Type : ${data.spaceHeaterType}` : "",
  ].filter(Boolean).join(" · ");
  return {
    id: nextEprelId(),
    registrationNumber: reg,
    brand: data.supplierOrTrademark || data.trademarkOwner || "",
    modelIdentifier: data.modelIdentifier || "",
    productGroup: mapEprelProductGroup(data.productGroup),
    eprelProductGroup: data.productGroup || "",
    energyClass: data.energyClass || data.packageEnergyClass || data.waterHeatingEnergyClass || "",
    etaSeasonalPct: pickFirstNum(data, [
      "seasonalSpaceHeatingEnergyEfficiencyAverage35",
      "seasonalHeatingEnergyEfficiency",
      "packageSeasonalSpaceHeatingEfficiency",
      "seasonalSpaceHeatingEnergyEfficiency",
    ]),
    etaS30Avg: pickFirstNum(data, ["seasonalSpaceHeatingEnergyEfficiencyAverage35"]),
    etaS55Avg: pickFirstNum(data, ["seasonalSpaceHeatingEnergyEfficiencyAverage55"]),
    energyClass55: data.energyClass55 || "",
    soundPowerDb: pickFirstNum(data, [
      "noise",
      "outdoorNoise",
      "soundPowerLevel",
      "soundPowerLevelIndoor",
      "soundPowerLevelOutdoor",
      "soundPower",
      "soundLevel",
    ]),
    ratedHeatOutputKw: pickFirstNum(data, [
      "ratedHeatOutput",
      "heatOutput",
      "nominalHeatOutput",
      "ratedOutputPowerHeat",
      "heatCapNominal",
      "heatCapacity",
      "ratedCapacity",
    ]),
    url: `https://eprel.ec.europa.eu/screen/product/${pg}/${reg}`,
    machines: [],
    notes: meta,
  };
}

async function fetchEprel(regNum) {
  const n = String(regNum).trim().replace(/\D/g, "");
  const res = await fetch(EPREL_API + n);
  if (!res.ok) {
    let msg = "introuvable";
    try {
      const err = await res.json();
      msg = err.message || msg;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

function parseArgs(argv) {
  if (argv.includes("--file")) {
    const i = argv.indexOf("--file");
    const p = argv[i + 1];
    if (!p) throw new Error("--file requiert un chemin");
    const text = fs.readFileSync(path.resolve(p), "utf8");
    return [...new Set(text.split(/[\s,;\n\r\t]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean))];
  }
  return [...new Set(argv.filter((a) => /^\d{5,}$/.test(a.replace(/\D/g, ""))).map((a) => a.replace(/\D/g, "")))];
}

const nums = parseArgs(process.argv.slice(2));
if (!nums.length) {
  console.error("Usage: node scripts/import-eprel.mjs 2615847 2607765 …");
  console.error("       node scripts/import-eprel.mjs --file nums.txt");
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
if (!catalog.data) catalog.data = {};
if (!Array.isArray(catalog.data.eprelFiches)) catalog.data.eprelFiches = [];

const results = { added: [], updated: [], err: [] };

for (const n of nums) {
  try {
    const data = await fetchEprel(n);
    const fiche = mapEprelApiToFiche(data);
    const j = catalog.data.eprelFiches.findIndex((f) => String(f.registrationNumber) === n);
    if (j >= 0) {
      fiche.id = catalog.data.eprelFiches[j].id;
      fiche.machines = catalog.data.eprelFiches[j].machines || [];
      catalog.data.eprelFiches[j] = fiche;
      results.updated.push(`${n} · ${fiche.modelIdentifier}`);
    } else {
      catalog.data.eprelFiches.push(fiche);
      results.added.push(`${n} · ${fiche.modelIdentifier} · ${fiche.energyClass} · ηs ${fiche.etaSeasonalPct}% · ${fiche.ratedHeatOutputKw} kW`);
    }
  } catch (e) {
    results.err.push(`${n} : ${e.message}`);
  }
}

catalog.date = new Date().toISOString();
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

console.log("Import EPREL —", results.added.length, "ajoutée(s),", results.updated.length, "mise(s) à jour,", results.err.length, "erreur(s)");
results.added.forEach((l) => console.log("  +", l));
results.updated.forEach((l) => console.log("  ↻", l));
results.err.forEach((l) => console.warn("  ✕", l));
console.log("\nLancez npm run default:build pour régénérer data/oedip-catalog.js");
