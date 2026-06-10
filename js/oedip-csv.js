/* OEDIP — import / export CSV gammes — ne pas modifier l'ordre de chargement dans oedip.html */
/*
 * Format OEDIP-CSV v2 (séparateur ; recommandé pour Excel FR, virgule acceptée à l'import)
 *
 * #OEDIP-CSV;version=2
 * GAMME;nom;code;fonction;fluide;fluide_label;gwp_custom;description;sources;departs
 * MACHINE;pac;tension;nb_comp;reversible;charge_kg;ref
 * COMPOSANT;type;id;ref;fabricant;modele;… (champs selon type, voir modèle)
 * LIEN;pac;role;comp_ref
 * PERF;pac;entree;sortie;p_chaud_kw;…
 *
 * types composant : circulateur | compresseur | echangeur_plaques | detendeur | reservoir_liquide | bouteille_anticoup | filtre | pot_boue
 * roles LIEN : compresseur | bouteilleAspiration | reservoirLiquide | echangeurB26 | echangeurF80 | echangeurFI22
 *              | detendeur | orificeDetendeur | circulateurFroid | filtreCaptage | potBoueCaptage
 *              | circulateurChaud | filtreChauffage | potBoueChauffage | circulateurEcs
 * comp_ref : référence du composant (colonne ref du COMPOSANT)
 */

const CSV_VERSION = 2;
const CSV_PERF_COLS = [
  ["p_chaud_kw", "chaud"], ["p_froid_kw", "froid"], ["p_absorbee_kw", "absorbee"], ["cop", "cop"],
  ["intensite_a", "intensite"], ["hp_barg", "hp"], ["bp_barg", "bp"], ["debit_fluide_gs", "debitR407C"],
  ["froid_m3h", "froidM3H"], ["pdc_evap_mce", "pdcEvapF"], ["pdc_tuy_f_mce", "pdcTuyF"], ["pdc_tot_f_mce", "pdcTotF"],
  ["chaud_m3h", "chaudM3H"], ["pdc_cond_mce", "pdcCondC"], ["pdc_tuy_c_mce", "pdcTuyC"], ["pdc_tot_c_mce", "pdcTotC"],
  ["capteur_horiz_m2", "capteurHoriz"], ["capteur_vert_m2", "capteurVert"], ["capteur_m2", "capteurM2"],
  ["capteur_ml", "capteurMl"], ["p_capt_w_ml", "pCaptSpec"], ["imax_230_a", "iMax230"], ["imax_400_a", "iMax400"],
  ["diam_coude_mm", "diamCoude"], ["diam_lyre_mm", "diamLyre"], ["etas_30", "etaS30"], ["etas_50", "etaS50"]
];

const CSV_COMP_COLS = (function () {
  const cols = ["type", "id"];
  const seen = new Set(["type", "id"]);
  if (typeof COMP_TYPES !== "undefined") {
    Object.keys(COMP_TYPES).forEach((type) => {
      COMP_TYPES[type].fields.forEach((f) => {
        if (!seen.has(f.key)) { seen.add(f.key); cols.push(f.key); }
      });
    });
  }
  return cols;
})();

const CSV_COMP_FIELD_META = (function () {
  const meta = {};
  if (typeof COMP_TYPES !== "undefined") {
    Object.keys(COMP_TYPES).forEach((type) => {
      COMP_TYPES[type].fields.forEach((f) => { meta[f.key] = f; });
    });
  }
  return meta;
})();

function csvDetectDelimiter(line) {
  const sc = (line.match(/;/g) || []).length;
  const cc = (line.match(/,/g) || []).length;
  return sc >= cc ? ";" : ",";
}

function csvParseLine(line, delim) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvNum(v) {
  if (v == null || v === "") return null;
  let s = String(v).trim().replace(/\s/g, "");
  if (/,/.test(s) && /\./.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,/.test(s) && !/\./.test(s)) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function csvEsc(v) {
  if (v == null) return "";
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvJoinRow(cells, delim) {
  return cells.map(csvEsc).join(delim);
}

function csvFmtNum(n) {
  if (n == null || n === "" || isNaN(n)) return "";
  return String(n).replace(".", ",");
}

function csvSplitList(s) {
  if (!s) return [];
  return String(s).split(/[|;,]/).map((x) => x.trim()).filter(Boolean);
}

function csvParseTension(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "230" || v === "230v") return 0;
  if (v === "400" || v === "400v") return 1;
  return 2;
}

function csvFmtTension(t) {
  return t === 0 ? "230" : t === 1 ? "400" : "indifferent";
}

function csvParseBool01(s) {
  const v = String(s || "").trim().toLowerCase();
  return v === "1" || v === "oui" || v === "yes" || v === "true" || v === "o" ? 1 : 0;
}

function csvCompRefKey(ref) {
  return String(ref || "").trim().toLowerCase();
}

function csvParseCompValue(key, raw) {
  if (raw == null || raw === "") return null;
  const meta = CSV_COMP_FIELD_META[key];
  if (meta && meta.type === "number") return csvNum(raw);
  return raw;
}

function csvUpsertComposant(catalog, item) {
  const type = item.type;
  if (!catalog[type]) catalog[type] = [];
  const refKey = csvCompRefKey(item.ref || item.modele);
  if (refKey) {
    const ex = catalog[type].findIndex((c) => csvCompRefKey(c.ref || c.modele) === refKey);
    if (ex >= 0) {
      catalog[type][ex] = { ...catalog[type][ex], ...item };
      return;
    }
  }
  catalog[type].push(item);
}

function csvCompRowToItem(cells, lineNo, errors) {
  const type = cells[1];
  if (!type || !COMP_TYPES[type]) {
    errors.push(`Ligne ${lineNo} : type composant « ${type || "?"} » invalide.`);
    return null;
  }
  const item = { type };
  CSV_COMP_COLS.forEach((col, i) => {
    const v = cells[1 + i];
    if (v == null || v === "") return;
    const parsed = csvParseCompValue(col, v);
    if (parsed != null) item[col] = parsed;
  });
  if (!item.ref && !item.modele) {
    errors.push(`Ligne ${lineNo} : ref ou modele requis pour le composant.`);
    return null;
  }
  if (!item.id) item.id = nextCompId();
  return item;
}

function csvCompItemToRow(item, delim) {
  return csvJoinRow(["COMPOSANT", ...CSV_COMP_COLS.map((col) => {
    const v = item[col];
    if (v == null || v === "") return "";
    const meta = CSV_COMP_FIELD_META[col];
    return meta && meta.type === "number" ? csvFmtNum(v) : v;
  })], delim);
}

function csvCollectGammeComposants(gammeCode) {
  const seen = new Set();
  const out = [];
  state.machines.filter((m) => m.gammeCode === gammeCode).forEach((m) => {
    Object.values(m.composantsLiens || {}).forEach((id) => {
      if (!id || seen.has(id)) return;
      const found = compFindById(id);
      if (found) { seen.add(id); out.push(found); }
    });
  });
  return out;
}

function csvResolveLiens(machines, liens, composants, errors) {
  const refByType = {};
  Object.keys(composants).forEach((type) => {
    refByType[type] = new Map();
    (composants[type] || []).forEach((c) => {
      const key = csvCompRefKey(c.ref || c.modele);
      if (key) refByType[type].set(key, c.id);
    });
  });
  const liensByPac = {};
  liens.forEach(({ pac, role, comp_ref, lineNo }) => {
    const slot = MACHINE_COMP_SLOTS.find((s) => s.role === role);
    if (!slot) {
      errors.push(`Ligne ${lineNo} : rôle « ${role} » inconnu.`);
      return;
    }
    const key = csvCompRefKey(comp_ref);
    const id = refByType[slot.type]?.get(key);
    if (!id) {
      errors.push(`Ligne ${lineNo} : composant « ${comp_ref} » introuvable (${slot.type} / ${pac}).`);
      return;
    }
    if (!liensByPac[pac]) liensByPac[pac] = {};
    liensByPac[pac][role] = id;
  });
  machines.forEach((m) => {
    if (liensByPac[m.pac]) m.composantsLiens = { ...liensByPac[m.pac] };
  });
}

function parseGammeCsvText(text) {
  const lines = String(text).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let delim = null;
  let version = null;
  const gamme = {};
  const machines = [];
  const perfs = {};
  const composants = defaultComposantsCatalog();
  const liens = [];
  const errors = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (!delim) delim = csvDetectDelimiter(line);
    const cells = csvParseLine(line, delim);
    const tag = (cells[0] || "").trim();
    const lineNo = idx + 1;

    if (tag.startsWith("#OEDIP-CSV")) {
      cells.forEach((c) => {
        const m = c.match(/version\s*=\s*(\d+)/i);
        if (m) version = +m[1];
      });
      return;
    }
    if (tag.startsWith("#")) return;

    if (tag === "GAMME") {
      gamme.nom = cells[1] || "";
      gamme.code = csvNum(cells[2]);
      gamme.fonction = (cells[3] || "geothermie").trim();
      gamme.fluide = (cells[4] || "R407C").trim();
      gamme.fluideLabel = cells[5] || "";
      gamme.gwpCustom = csvNum(cells[6]);
      gamme.desc = cells[7] || "";
      gamme.sources = csvSplitList(cells[8]).map(normSrc);
      gamme.departs = csvSplitList(cells[9]).map(normDep);
      return;
    }

    if (tag === "MACHINE") {
      const pac = cells[1];
      if (!pac) { errors.push(`Ligne ${lineNo} : nom PAC manquant.`); return; }
      machines.push({
        pac,
        tension: csvParseTension(cells[2]),
        nbComp: csvNum(cells[3]) ?? 1,
        reversible: csvParseBool01(cells[4]),
        chargeFluide: csvNum(cells[5]),
        ref: csvNum(cells[6]) ?? 0
      });
      return;
    }

    if (tag === "COMPOSANT") {
      const item = csvCompRowToItem(cells, lineNo, errors);
      if (item) csvUpsertComposant(composants, item);
      return;
    }

    if (tag === "LIEN") {
      const pac = cells[1], role = cells[2], comp_ref = cells[3];
      if (!pac || !role || !comp_ref) {
        errors.push(`Ligne ${lineNo} : LIEN incomplet (pac, role, comp_ref requis).`);
        return;
      }
      liens.push({ pac, role, comp_ref, lineNo });
      return;
    }

    if (tag === "PERF") {
      const pac = cells[1], src = normSrc(cells[2]), dep = normDep(cells[3]);
      if (!pac) { errors.push(`Ligne ${lineNo} : PAC manquant (PERF).`); return; }
      if (!PERF_SRC.includes(src)) { errors.push(`Ligne ${lineNo} : entrée « ${cells[2]} » invalide.`); return; }
      if (!PERF_DEP.includes(dep)) { errors.push(`Ligne ${lineNo} : sortie « ${cells[3]} » invalide.`); return; }
      const page = {};
      CSV_PERF_COLS.forEach(([col, key], i) => {
        const v = csvNum(cells[4 + i]);
        if (v != null) page[key] = v;
      });
      if (page.chaud == null) { errors.push(`Ligne ${lineNo} : p_chaud_kw requis.`); return; }
      if (page.cop == null && page.absorbee) page.cop = +(page.chaud / page.absorbee).toFixed(2);
      if (page.absorbee == null && page.cop) page.absorbee = +(page.chaud / page.cop).toFixed(2);
      if (!perfs[pac]) perfs[pac] = {};
      perfs[pac][pageKey(src, dep)] = mkPage(page);
    }
  });

  if (version != null && version > CSV_VERSION) errors.push(`Version CSV ${version} non supportée (max ${CSV_VERSION}).`);
  if (!gamme.nom) errors.push("Ligne GAMME manquante (nom requis).");
  if (gamme.code == null || gamme.code < 1) errors.push("Code gamme invalide (colonne code).");
  if (!gamme.sources.length) gamme.sources = PERF_SRC.slice();
  if (!gamme.departs.length) gamme.departs = PERF_DEP.slice();
  if (!machines.length) errors.push("Aucune ligne MACHINE trouvée.");

  machines.forEach((m) => { m.gammeCode = gamme.code; });
  if (liens.length) csvResolveLiens(machines, liens, composants, errors);

  const hasComposants = Object.keys(composants).some((k) => composants[k].length);
  return { gamme, machines, performances: perfs, composants: hasComposants ? composants : null, errors };
}

function buildGammeCsvPack(parsed) {
  const pack = {
    type: "oedip-gamme-pack",
    version: 4,
    date: new Date().toISOString(),
    source: "oedip-csv",
    gamme: {
      nom: parsed.gamme.nom,
      code: parsed.gamme.code,
      fonction: parsed.gamme.fonction,
      fluide: parsed.gamme.fluide,
      desc: parsed.gamme.desc,
      sources: parsed.gamme.sources,
      departs: parsed.gamme.departs,
      ...(parsed.gamme.fluide === "custom" ? {
        fluideLabel: parsed.gamme.fluideLabel || "Autre",
        gwpCustom: parsed.gamme.gwpCustom
      } : {})
    },
    machines: parsed.machines,
    performances: parsed.performances
  };
  if (parsed.composants) pack.composants = parsed.composants;
  return pack;
}

function exportGammeCsv(gammeCode) {
  const g = state.gammes.find((x) => +x.code === +gammeCode);
  if (!g) { alert("Gamme introuvable."); return; }
  const delim = ";";
  const list = state.machines.filter((m) => m.gammeCode === g.code);
  const srcs = (g.sources || PERF_SRC).map(normSrc);
  const deps = (g.departs || PERF_DEP).map(normDep);
  const compList = csvCollectGammeComposants(g.code);

  const lines = [
    `#OEDIP-CSV;version=${CSV_VERSION}`,
    `#GAMME;nom;code;fonction;fluide;fluide_label;gwp_custom;description;sources;departs`,
    csvJoinRow([
      "GAMME", g.nom, g.code, g.fonction || "geothermie", g.fluide || "R407C",
      g.fluide === "custom" ? (g.fluideLabel || "") : "",
      g.fluide === "custom" ? (g.gwpCustom ?? "") : "",
      g.desc || "",
      srcs.join("|"),
      deps.join("|")
    ], delim),
    "",
    `#MACHINES;pac;tension;nb_comp;reversible;charge_kg;ref`,
    ...list.map((m) => csvJoinRow([
      "MACHINE", m.pac, csvFmtTension(m.tension), m.nbComp ?? 1, m.reversible ? 1 : 0,
      csvFmtNum(m.chargeFluide), m.ref ?? ""
    ], delim))
  ];

  if (compList.length) {
    lines.push("", `#COMPOSANTS;${CSV_COMP_COLS.join(";")}`);
    compList.sort((a, b) => a.type.localeCompare(b.type) || (a.item.ref || "").localeCompare(b.item.ref || ""))
      .forEach(({ item }) => lines.push(csvCompItemToRow(item, delim)));
    lines.push("", `#LIENS;pac;role;comp_ref`);
    list.forEach((m) => {
      MACHINE_COMP_SLOTS.forEach((slot) => {
        const id = m.composantsLiens?.[slot.role];
        if (!id) return;
        const found = compFindById(id);
        const ref = found?.item?.ref || found?.item?.modele || id;
        lines.push(csvJoinRow(["LIEN", m.pac, slot.role, ref], delim));
      });
    });
  }

  lines.push("", `#PERF;pac;entree;sortie;${CSV_PERF_COLS.map(([c]) => c).join(";")}`);
  list.forEach((m) => {
    PERF_SRC.forEach((s) => PERF_DEP.forEach((d) => {
      const f = getFiche(state.performances, m.pac, s, d);
      if (!f || !f.chaud) return;
      lines.push(csvJoinRow([
        "PERF", m.pac, s, d,
        ...CSV_PERF_COLS.map(([, key]) => csvFmtNum(f[key]))
      ], delim));
    }));
  });

  const safeName = String(g.nom || g.code).replace(/[^\w\-+]+/g, "_").slice(0, 40);
  const filename = `oedip_gamme_${g.code}_${safeName}.csv`;
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast(`CSV exporté · ${filename}`);
}

function exportSelectedGammeCsv() {
  const g = state.gammes[+$("dbGamme").value];
  if (!g) { alert("Sélectionnez une gamme."); return; }
  exportGammeCsv(g.code);
}

function downloadGammeCsvTemplate() {
  const delim = ";";
  const lines = [
    `#OEDIP-CSV;version=${CSV_VERSION}`,
    `#GAMME;nom;code;fonction;fluide;fluide_label;gwp_custom;description;sources;departs`,
    csvJoinRow(["GAMME", "Ma gamme", 10, "geothermie", "R407C", "", "", "Description courte", "0/-3|5/2|9/6", "30/35|40/45|47/55"], delim),
    "",
    `#MACHINES;pac;tension;nb_comp;reversible;charge_kg;ref`,
    csvJoinRow(["MACHINE", "PAC 10 kW", "indifferent", 1, 1, "3,2", 1], delim),
    "",
    `#COMPOSANTS;${CSV_COMP_COLS.join(";")}`,
    csvCompItemToRow({ type: "compresseur", ref: "ZH04K1P-PFZ-524", fabricant: "Copeland", modele: "ZH04K1P-PFZ-524", typeComp: "scroll", fluide: "R410A" }, delim),
    csvCompItemToRow({ type: "echangeur_plaques", ref: "B26Hx30", fabricant: "SWEP", modele: "B26Hx30", materiau: "Cu brasé" }, delim),
    csvCompItemToRow({ type: "circulateur", ref: "Para 25-180", fabricant: "Wilo", modele: "Para 25-180/7-50", debitM3h: 7, hmtM: 7, puissanceW: 120, rendementPct: 85, tension: "2", fluide: "eau glycolée 30 %" }, delim),
    "",
    `#LIENS;pac;role;comp_ref`,
    csvJoinRow(["LIEN", "PAC 10 kW", "compresseur", "ZH04K1P-PFZ-524"], delim),
    csvJoinRow(["LIEN", "PAC 10 kW", "echangeurB26", "B26Hx30"], delim),
    csvJoinRow(["LIEN", "PAC 10 kW", "circulateurFroid", "Para 25-180"], delim),
    "",
    `#PERF;pac;entree;sortie;${CSV_PERF_COLS.map(([c]) => c).join(";")}`,
    csvJoinRow(["PERF", "PAC 10 kW", "0/-3", "40/45", "10,5", "7,2", "2,5", "4,2"], delim),
    csvJoinRow(["PERF", "PAC 10 kW", "0/-3", "47/55", "9,8", "6,8", "2,8", "3,5"], delim)
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "oedip_gamme_modele.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast("Modèle CSV téléchargé");
}

function importGammeCsv() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".csv,text/csv,text/plain";
  inp.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = parseGammeCsvText(rd.result);
        if (parsed.errors.length) {
          alert("Erreurs dans le CSV :\n\n" + parsed.errors.slice(0, 12).join("\n") + (parsed.errors.length > 12 ? `\n… et ${parsed.errors.length - 12} autre(s).` : ""));
          return;
        }
        const nbComp = parsed.composants
          ? Object.values(parsed.composants).reduce((n, arr) => n + arr.length, 0)
          : 0;
        const existing = state.gammes.find((g) => +g.code === +parsed.gamme.code);
        const compMsg = nbComp ? `, ${nbComp} composant(s)` : "";
        const msg = existing
          ? `La gamme « ${existing.nom} » (code ${parsed.gamme.code}) existe déjà.\nRemplacer par « ${parsed.gamme.nom} » (${parsed.machines.length} machines${compMsg}) ?`
          : `Importer la gamme « ${parsed.gamme.nom} » (code ${parsed.gamme.code}, ${parsed.machines.length} machines${compMsg}) ?`;
        if (!confirm(msg)) return;
        applyGammePackImport(buildGammeCsvPack(parsed));
      } catch (err) {
        alert("CSV invalide : " + err.message);
      }
    };
    rd.readAsText(f, "UTF-8");
  };
  inp.click();
}
