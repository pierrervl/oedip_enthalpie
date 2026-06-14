/**
 * Pousse les catalogues locaux OEDIP vers Supabase (table reference_catalogs).
 *
 * Prérequis : variable d'environnement SUPABASE_SERVICE_ROLE_KEY
 * (Dashboard → Project Settings → API → service_role secret)
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run catalog:push
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL || "https://lgpckxeyorsnizetpmuz.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("Définissez SUPABASE_SERVICE_ROLE_KEY (Dashboard Supabase → Settings → API → service_role).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function readJsArray(rel, constName) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(p, "utf8"), sandbox, { filename: p });
  return sandbox[constName] ?? null;
}

function readJsObject(rel, constName) {
  return readJsArray(rel, constName);
}

function projectToDbExport(proj) {
  const d = proj.data || {};
  return {
    type: "oedip-db",
    version: proj.version || 2,
    date: new Date().toISOString(),
    meta: proj.meta,
    reglages: proj.reglages,
    prix: proj.prix,
    pci: proj.pci,
    co2: proj.co2,
    gammes: d.gammes || [],
    machines: d.machines || [],
    performances: d.performances || {},
    composants: d.composants || {},
    outils: d.outils || {},
    frigoLayoutPresets: d.frigoLayoutPresets || [],
    hydroLayoutPresets: d.hydroLayoutPresets || [],
    notePrintPresets: d.notePrintPresets || [],
    procedureCatalogs: d.procedureCatalogs || [],
    isolationTypes: d.isolationTypes || [],
    emetteurs: d.emetteurs || [],
    captages: d.captages || [],
    departements: d.departements || [],
  };
}

async function upsertCatalog(key, name, description, payload) {
  const sizeKb = (JSON.stringify(payload).length / 1024).toFixed(1);
  const { error } = await supabase.from("reference_catalogs").upsert(
    {
      key,
      name,
      description,
      payload,
      version: 1,
      published: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw new Error(`${key}: ${error.message}`);
  console.log(`✓ ${key} — ${name} (${sizeKb} KB)`);
}

async function main() {
  const catalogPath = path.join(root, "data/oedip-catalog.json");
  const legacyPath = path.join(root, "data/oedip-default-project.json");
  const projPath = fs.existsSync(catalogPath) ? catalogPath : legacyPath;
  if (!fs.existsSync(projPath)) {
    console.error("Catalogue introuvable — lancez npm run default:build");
    process.exit(1);
  }

  const proj = JSON.parse(fs.readFileSync(projPath, "utf8"));
  const catalogPayload = proj;
  const dbSource =
    catalogPayload.type === "oedip-catalog"
      ? {
          version: catalogPayload.version,
          meta: catalogPayload.meta,
          reglages: catalogPayload.reglages,
          prix: catalogPayload.prix,
          pci: catalogPayload.pci,
          co2: catalogPayload.co2,
          data: catalogPayload.data,
        }
      : catalogPayload;
  const dbExport = projectToDbExport(dbSource);

  await upsertCatalog(
    "catalog_full",
    "Catalogue OEDIP complet",
    "Gammes, machines, performances, composants, outils, procédures, réglages (source data/oedip-catalog.json)",
    catalogPayload
  );

  await upsertCatalog(
    "catalog_db",
    "Base machines OEDIP",
    "Export oedip-db sans saisie projet (gammes + machines + perf + composants + procédures)",
    dbExport
  );

  const dju = readJson("data/oedip-dju-departements.json");
  if (dju) {
    await upsertCatalog(
      "catalog_dju",
      "DJU départements SDES",
      "Séries DJU 17°C / 15°C 1990–2025 par département",
      dju
    );
  }

  const circulateurs = readJsArray("data/oedip-circulateurs-wilo.js", "OEDIP_CIRCULATEURS_WILO");
  if (circulateurs) {
    await upsertCatalog(
      "catalog_circulateurs_wilo",
      "Circulateurs Wilo",
      "Courbes débit/HMT — import circu.xlsx",
      circulateurs
    );
  }

  const pdc = readJson("data/oedip-echangeurs-pdc.json");
  if (pdc) {
    await upsertCatalog(
      "catalog_echangeurs_pdc",
      "Échangeurs SWEP — courbes Pdc",
      "Feuille echangeurs pdc (circu.xlsx)",
      pdc
    );
  }

  const geo = readJson("data/oedip-procedures-geo.json");
  if (geo) {
    await upsertCatalog(
      "catalog_procedures_geo",
      "Procédures géothermie",
      "Fiches tubes + photos img/procedures/geo/",
      geo
    );
  }

  const gpac = readJson("data/gpac-r410-pack.json");
  if (gpac) {
    await upsertCatalog(
      "catalog_gpac_r410",
      "Pack gamme GPAC R410",
      "Import gamme pack JSON",
      gpac
    );
  }

  console.log("\nCatalogues publiés dans Supabase → Table Editor → reference_catalogs");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
