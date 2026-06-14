#!/usr/bin/env node
/**
 * Applique les migrations Supabase sur le projet lié (OEDIP).
 * Nécessite SUPABASE_DB_PASSWORD (mot de passe Postgres du dashboard Supabase).
 * Utilise le pooler IPv4 — requis si la connexion directe IPv6 échoue.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "lgpckxeyorsnizetpmuz";
const password = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!password) {
  console.error("Variable SUPABASE_DB_PASSWORD manquante.");
  console.error("Dashboard Supabase → Project Settings → Database → Database password");
  console.error("Puis (PowerShell) : $env:SUPABASE_DB_PASSWORD = 'votre-mot-de-passe'");
  console.error("Et relancez : npm run supabase:migrate");
  process.exit(1);
}

function run(args) {
  const r = spawnSync("npx", ["supabase", ...args], { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Liaison pooler IPv4…");
run(["link", "--project-ref", projectRef, "-p", password, "--yes"]);

console.log("Application des migrations…");
run(["db", "push", "--linked", "-p", password, "--yes"]);

console.log("Migrations appliquées.");
