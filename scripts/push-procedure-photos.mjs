/**
 * Upload img/procedures/geo/*.jpg → Supabase Storage (bucket procedure-photos).
 *
 * Prérequis :
 *   - migration 20260614180000_procedure_photos_storage appliquée
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   npm run photos:push
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG_DIR = path.join(root, "img/procedures/geo");
const BUCKET = "procedure-photos";
const url = process.env.SUPABASE_URL || "https://lgpckxeyorsnizetpmuz.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error("Définissez SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

function storageSafeName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function storageKeyForFile(name) {
  return `geo/${storageSafeName(name)}`;
}

async function upsertManifest(files) {
  const payload = {
    bucket: BUCKET,
    prefix: "geo/",
    count: files.length,
    totalBytes: files.reduce((a, f) => a + f.bytes, 0),
    files,
    uploadedAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("reference_catalogs").upsert(
    {
      key: "catalog_procedure_photos",
      name: "Photos procédures géo",
      description: "Index des fichiers Storage procedure-photos/geo/",
      payload,
      version: 1,
      published: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) throw error;
}

async function uploadOne(filePath, storageKey) {
  const body = fs.readFileSync(filePath);
  const { error } = await supabase.storage.from(BUCKET).upload(storageKey, body, {
    contentType: "image/jpeg",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return body.length;
}

async function runPool(items, limit, worker) {
  let i = 0;
  const results = [];
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function main() {
  if (!fs.existsSync(IMG_DIR)) {
    console.error("Dossier introuvable :", IMG_DIR);
    process.exit(1);
  }

  const jpgFiles = fs
    .readdirSync(IMG_DIR)
    .filter((f) => f.toLowerCase().endsWith(".jpg"))
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

  console.log(`Upload ${jpgFiles.length} photos → ${BUCKET}/geo/`);

  const manifest = [];
  let done = 0;
  let totalBytes = 0;

  await runPool(jpgFiles, 4, async (name) => {
    const filePath = path.join(IMG_DIR, name);
    const storageKey = storageKeyForFile(name);
    const bytes = await uploadOne(filePath, storageKey);
    done++;
    totalBytes += bytes;
    manifest.push({
      name,
      local: `img/procedures/geo/${name}`,
      storageKey,
      publicUrl: `${url}/storage/v1/object/public/${BUCKET}/${storageKey.split("/").map(encodeURIComponent).join("/")}`,
      bytes,
    });
    if (done % 10 === 0 || done === jpgFiles.length) {
      process.stdout.write(`\r  ${done}/${jpgFiles.length} (${(totalBytes / 1024 / 1024).toFixed(1)} Mo)`);
    }
  });

  console.log("\nIndex manifest…");
  try {
    await upsertManifest(manifest);
    console.log(`✓ ${done} photos · ${(totalBytes / 1024 / 1024).toFixed(1)} Mo · manifest catalog_procedure_photos`);
  } catch (e) {
    console.warn(`✓ ${done} photos · ${(totalBytes / 1024 / 1024).toFixed(1)} Mo uploadés`);
    console.warn(`⚠ Manifest non enregistré (${e.message || e}) — appliquez la migration reference_catalogs_service_role puis relancez photos:push`);
  }
}

main().catch((e) => {
  console.error("\n" + (e.message || e));
  process.exit(1);
});
