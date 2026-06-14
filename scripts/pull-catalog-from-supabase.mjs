/**
 * Récupère les catalogues de référence Supabase → fichiers locaux data/
 *
 * Prérequis : SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run catalog:pull
 *   npm run catalog:pull -- --rebuild
 *   npm run catalog:pull -- --key catalog_procedures_geo
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.SUPABASE_URL || "https://lgpckxeyorsnizetpmuz.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rebuild = args.includes("--rebuild");
const keyArg = args.find((a, i) => args[i - 1] === "--key") || null;

if (!serviceKey) {
  console.error("Définissez SUPABASE_SERVICE_ROLE_KEY (Dashboard Supabase → Settings → API → service_role).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

/** Clés Supabase → fichiers locaux (miroir de push-catalog-to-supabase.mjs). */
const TARGETS = {
  catalog_full: {
    file: "data/oedip-catalog.json",
    kind: "json",
    label: "Catalogue OEDIP complet",
  },
  catalog_procedures_geo: {
    file: "data/oedip-procedures-geo.json",
    kind: "json",
    label: "Procédures géothermie",
  },
  catalog_dju: {
    file: "data/oedip-dju-departements.json",
    kind: "json",
    label: "DJU départements",
  },
  catalog_echangeurs_pdc: {
    file: "data/oedip-echangeurs-pdc.json",
    kind: "json",
    label: "Échangeurs Pdc",
  },
  catalog_circulateurs_wilo: {
    file: "data/oedip-circulateurs-wilo.js",
    kind: "js",
    constName: "OEDIP_CIRCULATEURS_WILO",
    label: "Circulateurs Wilo",
  },
  catalog_gpac_r410: {
    file: "data/gpac-r410-pack.json",
    kind: "json",
    label: "Pack GPAC R410",
  },
};

function writeJson(absPath, payload) {
  const text = JSON.stringify(payload, null, 2) + "\n";
  if (dryRun) {
    console.log(`  (dry-run) ${path.relative(root, absPath)} — ${(text.length / 1024).toFixed(1)} KB`);
    return;
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, text, "utf8");
}

function writeJs(absPath, constName, payload) {
  const text = `/* OEDIP — ${constName} (pull Supabase ${new Date().toISOString().slice(0, 10)})
   Régénérer : npm run catalog:pull
*/
const ${constName} = ${JSON.stringify(payload, null, 2)};
`;
  if (dryRun) {
    console.log(`  (dry-run) ${path.relative(root, absPath)} — ${(text.length / 1024).toFixed(1)} KB`);
    return;
  }
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, text, "utf8");
}

function writeCatalogJs(catalog) {
  const absPath = path.join(root, "data/oedip-catalog.js");
  const text = `/* OEDIP — catalogue de référence (pull Supabase ${new Date().toISOString().slice(0, 10)})
   Régénérer : npm run catalog:pull
*/
const OEDIP_DEFAULT_CATALOG = ${JSON.stringify(catalog)};
`;
  if (dryRun) {
    console.log(`  (dry-run) data/oedip-catalog.js — ${(text.length / 1024).toFixed(1)} KB`);
    return;
  }
  fs.writeFileSync(absPath, text, "utf8");
}

function writeTarget(key, payload) {
  const t = TARGETS[key];
  if (!t) {
    console.warn(`⚠ Clé inconnue (non mappée) : ${key}`);
    return false;
  }
  const absPath = path.join(root, t.file);
  if (t.kind === "js") {
    writeJs(absPath, t.constName, payload);
  } else {
    writeJson(absPath, payload);
  }
  if (key === "catalog_full" && payload && typeof payload === "object") {
    writeCatalogJs(payload);
  }
  const kb = (JSON.stringify(payload).length / 1024).toFixed(1);
  console.log(`✓ ${key} → ${t.file} (${kb} KB) · ${t.label}`);
  return true;
}

async function main() {
  const keys = keyArg ? [keyArg] : Object.keys(TARGETS);
  if (keyArg && !TARGETS[keyArg]) {
    console.error(`Clé inconnue : ${keyArg}\nClés : ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }

  console.log(`Supabase → local${dryRun ? " (dry-run)" : ""}${keyArg ? ` · ${keyArg}` : ""}\n`);

  const { data: rows, error } = await supabase
    .from("reference_catalogs")
    .select("key,payload,updated_at,name")
    .eq("published", true)
    .in("key", keys);
  if (error) throw error;

  const byKey = Object.fromEntries((rows || []).map((r) => [r.key, r]));
  let n = 0;
  for (const key of keys) {
    const row = byKey[key];
    if (!row?.payload) {
      console.warn(`⚠ ${key} — absent ou vide dans reference_catalogs`);
      continue;
    }
    const updated = row.updated_at ? new Date(row.updated_at).toLocaleString("fr-FR") : "—";
    console.log(`${row.name || key} (maj ${updated})`);
    if (writeTarget(key, row.payload)) n++;
  }

  if (!n) {
    console.error("\nAucun catalogue récupéré.");
    process.exit(1);
  }

  console.log(`\n${n} catalogue(s) écrit(s) dans data/`);

  if (rebuild && !dryRun) {
    console.log("\nRegénération (build-default-project)…");
    const r = spawnSync(process.execPath, ["scripts/build-default-project.mjs"], {
      cwd: root,
      stdio: "inherit",
    });
    if (r.status !== 0) process.exit(r.status || 1);
  } else if (!dryRun && !keyArg) {
    console.log("\nAstuce : npm run catalog:pull -- --rebuild pour fusionner Pdc + procédures geo dans le catalogue.");
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
