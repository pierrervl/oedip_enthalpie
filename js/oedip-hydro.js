/* OEDIP — estimation simplifiée pertes de charge chauffage */

const HYDRO_PC_ML_PAR_M2 = 8;
const HYDRO_PC_M2_PAR_BOUCLE = 10;
const HYDRO_PC_DIAM_MM = 13;
const HYDRO_PC_PDC_REF_KPA = 20;
const HYDRO_PC_L_BOUCLE_M = 80;
const HYDRO_PC_P_BOUCLE_KW = 0.8;
const HYDRO_PDC_RAD_KPA = 18;
const HYDRO_PDC_VENTILO_KPA = 14;
const HYDRO_PC_PDC_COLLECTEUR_KPA = 3;
const HYDRO_DEFAULT_SURFACE_PCT = 50;
/** Puissance surfacique indicative @ ΔT50 (W/m²) selon type panneau acier. */
const RAD_TYPE_Q50_WM2 = { 11: 1000, 21: 1600, 22: 2000, 33: 2500 };
const RAD_DT_REF_K = 50;
const RAD_DT_EXPONENT = 1.3;

function emitterReturnTemp(regime) {
  const m = String(regime || "").match(/(\d+)\s*\/\s*(\d+)/);
  return m ? +m[1] : 40;
}

function radiatorDeltaTAct(regime, tint) {
  const tmean = (emitterDepartureTemp(regime) + emitterReturnTemp(regime)) / 2;
  return Math.max(0, tmean - (+tint || 20));
}

function radiatorPnomDt50FromDims(hMm, wMm, type) {
  const h = Math.max(0, +(hMm || 0)) / 1000;
  const w = Math.max(0, +(wMm || 0)) / 1000;
  if (!h || !w) return 0;
  const q = RAD_TYPE_Q50_WM2[type] || RAD_TYPE_Q50_WM2[21];
  return (q * h * w) / 1000;
}

function radiatorUnitPnomDt50Kw(z) {
  if (!z || z.radSizing !== "pnom" && z.radSizing !== "dims") return 0;
  if (z.radSizing === "pnom") return Math.max(0, +(z.radPnomKw || 0));
  return radiatorPnomDt50FromDims(z.radHeightMm, z.radWidthMm, z.radType || 21);
}

function radiatorPowerAtRegime(pnomDt50Kw, regime, tint) {
  if (!pnomDt50Kw || pnomDt50Kw <= 0) return 0;
  const dt = radiatorDeltaTAct(regime, tint);
  if (!dt) return 0;
  return pnomDt50Kw * Math.pow(dt / RAD_DT_REF_K, RAD_DT_EXPONENT);
}

function computeRadiatorTransmission(bs, projet, emetteurs) {
  const tint = projet?.batiment?.tint ?? 20;
  const zones = bs?.zones || [];
  const rows = [];
  let totalKw = 0;
  zones.forEach((z, i) => {
    const em = emetteurs?.[z.emIdx];
    if (emitterHydroKind(em) !== "rad") return;
    const nb = Math.max(0, +(z.nbEmetteurs || 0));
    const pnomUnit = radiatorUnitPnomDt50Kw(z);
    if (!pnomUnit || !nb) return;
    const pUnit = radiatorPowerAtRegime(pnomUnit, em?.regime, tint);
    const pZone = pUnit * nb;
    totalKw += pZone;
    rows.push({
      index: i,
      nom: zoneDisplayName(z, i),
      nb,
      pnomUnitDt50Kw: pnomUnit,
      pUnitKw: pUnit,
      pZoneKw: pZone,
      regime: em?.regime,
      deltaT: radiatorDeltaTAct(em?.regime, tint),
      sizing: z.radSizing,
    });
  });
  return { active: rows.length > 0, totalKw, zones: rows };
}

function renderRadiatorTypeOptions(selected) {
  const sel = String(selected || 21);
  return [11, 21, 22, 33].map((t) =>
    `<option value="${t}"${String(t) === sel ? " selected" : ""}>Type ${t}</option>`
  ).join("");
}

function defaultZoneChauff(emIdx, nom) {
  return {
    nom: nom || "Zone 1",
    volMode: "surf",
    surfaceM2: 0,
    hauteur: 2.5,
    volumeM3: 0,
    emIdx: emIdx ?? 3,
    nbEmetteurs: 0,
    radSizing: "",
    radPnomKw: 0,
    radHeightMm: 600,
    radWidthMm: 1000,
    radType: 21
  };
}

function zoneEffectiveSurfaceM2(z) {
  if (!z) return 0;
  if (z.volMode === "vol") {
    const vol = Math.max(0, +(z.volumeM3 || 0));
    const h = +(z.hauteur || 0) > 0 ? +(z.hauteur || 0) : 2.5;
    return vol / h;
  }
  return Math.max(0, +(z.surfaceM2 || 0));
}

function zonesSurfaceM2(zones) {
  return (zones || []).reduce((s, z) => s + zoneEffectiveSurfaceM2(z), 0);
}

function zoneVolumeM3(z) {
  if (!z) return 0;
  if (z.volMode === "vol") return Math.max(0, +(z.volumeM3 || 0));
  return Math.max(0, +(z.surfaceM2 || 0)) * Math.max(0, +(z.hauteur || 0));
}

function zonesVolumeM3(zones) {
  return (zones || []).reduce((s, z) => s + zoneVolumeM3(z), 0);
}

function zoneDisplayName(z, index) {
  const n = String(z?.nom || "").trim();
  return n || `Zone ${(index ?? 0) + 1}`;
}

function migrateBatimentSurfacesToZones(projet) {
  const b = projet?.batiment || {};
  const bs = projet?.besoin;
  if (!bs) return [];
  const zones = [];
  if ((b.s1 || 0) > 0 || (b.h1 || 0) > 0) {
    zones.push(defaultZoneChauff(3, "RDC"));
    zones[0].surfaceM2 = +(b.s1 || 0);
    zones[0].hauteur = +(b.h1 || 2.5);
  }
  if ((b.s2 || 0) > 0) {
    const z = defaultZoneChauff(3, "Étage");
    z.surfaceM2 = +b.s2;
    z.hauteur = +(b.h2 || 2.5);
    zones.push(z);
  }
  if (b.volMode === "vol" && b.vol > 0 && !zones.length) {
    const z = defaultZoneChauff(3, "Zone 1");
    z.volMode = "vol";
    z.volumeM3 = +b.vol;
    zones.push(z);
  }
  if (!zones.length) zones.push(defaultZoneChauff(3, "Zone 1"));
  bs.zones = zones;
  return zones;
}

function migrateLegacyZonesToBesoin(projet) {
  const bs = projet?.besoin;
  if (!bs) return [];
  if (bs.em1 != null || bs.em2 != null) {
    const h = projet.hydraulique && typeof projet.hydraulique === "object" ? projet.hydraulique : {};
    migrateBatimentSurfacesToZones(projet);
    const bases = [...bs.zones];
    bs.zones = [];
    [[bs.em1, h.zone1, 0], [bs.em2, h.zone2, 1]].forEach(([emIdx, data, bi]) => {
      if (emIdx == null) return;
      const em = state.emetteurs?.[emIdx];
      if (!em || em.absent) return;
      const base = bases[bi] || defaultZoneChauff(+emIdx, `Zone ${bi + 1}`);
      const kind = emitterHydroKind(em);
      bs.zones.push({
        nom: base.nom,
        surfaceM2: +(base.surfaceM2 || 0),
        hauteur: +(base.hauteur || 2.5),
        emIdx: +emIdx,
        nbEmetteurs: kind !== "pc" ? +(data?.nbEmetteurs || 0) : 0
      });
    });
    if (!bs.zones.length) bs.zones = bases;
    delete bs.em1;
    delete bs.em2;
    return bs.zones;
  }
  return migrateBatimentSurfacesToZones(projet);
}

/** Normalise la liste de zones chauffage (migration em1/em2 → zones[]). */
function normalizeZonesChauffage(projet) {
  if (!projet?.besoin) return [];
  const bs = projet.besoin;
  if (!Array.isArray(bs.zones) || !bs.zones.length) migrateLegacyZonesToBesoin(projet);
  const n = Math.max(1, state.emetteurs?.length || 1);
  bs.zones = bs.zones.map((z, i) => {
    const volMode = z.volMode === "vol" ? "vol" : "surf";
    const surfaceM2 = Math.max(0, +(z.surfaceM2 || 0));
    const hauteur = Math.max(0, +(z.hauteur || 2.5));
    let volumeM3 = Math.max(0, +(z.volumeM3 || 0));
    if (volMode === "surf" && !volumeM3) volumeM3 = surfaceM2 * hauteur;
    return {
      nom: String(z.nom ?? "").trim() || `Zone ${i + 1}`,
      volMode,
      surfaceM2,
      hauteur,
      volumeM3,
      emIdx: Math.min(Math.max(0, +(z.emIdx ?? 3)), n - 1),
      nbEmetteurs: Math.max(0, +(z.nbEmetteurs || 0)),
      radSizing: z.radSizing === "pnom" || z.radSizing === "dims" ? z.radSizing : "",
      radPnomKw: Math.max(0, +(z.radPnomKw || 0)),
      radHeightMm: Math.max(0, +(z.radHeightMm || 0)),
      radWidthMm: Math.max(0, +(z.radWidthMm || 0)),
      radType: [11, 21, 22, 33].includes(+z.radType) ? +z.radType : 21
    };
  });
  if (projet.batiment) projet.batiment.vol = zonesVolumeM3(bs.zones);
  return bs.zones;
}

function zoneChauffDetailLabel(z, em) {
  if (!z) return "—";
  const nom = zoneDisplayName(z);
  const vol = zoneVolumeM3(z);
  const base = z.volMode === "vol"
    ? `${nom} · ${fmt(vol, 1)} m³ (volume direct)`
    : `${nom} · ${fmt(z.surfaceM2 || 0, 0)} m² × ${fmt(z.hauteur || 0, 1)} m · ${fmt(vol, 1)} m³`;
  if (!em || em.absent) return base;
  const kind = emitterHydroKind(em);
  if (kind === "ventilo") return `${base} · ${emetteurOptionLabel(em)} · ${fmt(z.nbEmetteurs || 0, 0)} u`;
  if (kind === "rad") {
    const nb = z.nbEmetteurs || 0;
    const pnom = radiatorUnitPnomDt50Kw(z);
    const tint = typeof projet !== "undefined" ? projet?.batiment?.tint : 20;
    if (pnom && nb) {
      const pZone = radiatorPowerAtRegime(pnom, em?.regime, tint) * nb;
      return `${base} · ${fmt(nb, 0)} rad · ${fmt(pZone, 1)} kW transm. max`;
    }
    return `${base} · ${emetteurOptionLabel(em)} · ${fmt(nb, 0)} u`;
  }
  return `${base} · ${emetteurOptionLabel(em)}`;
}

function defaultProjetHydraulique() {
  return {
    pdcEchangeurKpa: 0,
    pdcCollecteurBoucleKpa: HYDRO_PC_PDC_COLLECTEUR_KPA,
    pdcEchangeurAuto: true
  };
}

function ensureProjetHydraulique(projet) {
  if (!projet) return defaultProjetHydraulique();
  if (!projet.hydraulique || typeof projet.hydraulique !== "object") projet.hydraulique = defaultProjetHydraulique();
  normalizeZonesChauffage(projet);
  const h = projet.hydraulique;
  if (h.pdcCollecteurBoucleKpa == null) h.pdcCollecteurBoucleKpa = HYDRO_PC_PDC_COLLECTEUR_KPA;
  if (h.pdcEchangeurAuto == null) h.pdcEchangeurAuto = !(+(h.pdcEchangeurKpa || 0) > 0);
  delete h.zoneSplitPct;
  delete h.zone1;
  delete h.zone2;
  delete h.tuyaux;
  delete h.pcMlParM2;
  delete h.pcDiamMm;
  delete h.glycolPct;
  delete h.majorantPct;
  delete h.pcM2ParLoop;
  return h;
}

function emitterHydroKind(em) {
  if (!em || em.absent) return "absent";
  const n = String(em.nom || "").toLowerCase();
  if (n.includes("plancher")) return "pc";
  if (n.includes("ventilo")) return "ventilo";
  if (n.includes("radiateur")) return "rad";
  return "rad";
}

function emitterDeltaT(regime) {
  const t = emitterDepartureTemp(regime);
  if (t <= 25) return 5;
  if (t <= 45) return 10;
  if (t <= 55) return 12;
  return 15;
}

/** Débit optimal (m³/h) pour transmettre une puissance calorifique. */
function debitOptimalM3h(powerKw, deltaT) {
  if (!powerKw || powerKw <= 0 || !deltaT) return 0;
  return powerKw / (1.16 * deltaT);
}

function kpaToHeadM(kpa) {
  return kpa / 9.81;
}

function buildingSurfaceM2(batiment, besoin) {
  if (besoin?.zones?.length) return zonesSurfaceM2(besoin.zones);
  return Math.max(0, (batiment?.s1 || 0) + (batiment?.s2 || 0));
}

/** Surface totale du logement (m²) — somme des zones ou legacy bâtiment. */
function logementSurfaceM2(batiment, besoin) {
  if (besoin?.zones?.length) return zonesSurfaceM2(besoin.zones);
  if (!batiment) return 0;
  if (batiment.volMode === "vol" && batiment.vol > 0) {
    const h1 = batiment.h1 > 0 ? batiment.h1 : 2.5;
    const h2 = batiment.h2 > 0 ? batiment.h2 : 2.5;
    const hMoy = batiment.s2 > 0 ? (h1 + h2) / 2 : h1;
    return batiment.vol / (hMoy || 2.5);
  }
  return buildingSurfaceM2(batiment);
}

function zoneSurfaceFromPct(logementM2, surfacePct) {
  if (!logementM2 || !surfacePct) return 0;
  return logementM2 * Math.max(0, Math.min(100, surfacePct)) / 100;
}

function pcNbBoucles(surfaceM2) {
  if (!surfaceM2 || surfaceM2 <= 0) return 0;
  return Math.max(1, Math.ceil(surfaceM2 / HYDRO_PC_M2_PAR_BOUCLE));
}

function pcLongueurTotaleM(surfaceM2) {
  return Math.max(0, surfaceM2) * HYDRO_PC_ML_PAR_M2;
}

function flowM3s(m3h) {
  return m3h / 3600;
}

/** Pdc tube PE-RT Ø13 mm — Darcy-Weisbach (m CE → kPa). */
function darcyPdcKpa(diamMm, longM, flowM3h) {
  if (!longM || !diamMm || !flowM3h || flowM3h <= 0) return 0;
  const D = diamMm / 1000;
  const Q = flowM3s(flowM3h);
  const A = (Math.PI * D * D) / 4;
  const v = Q / A;
  const nu = 1.0e-6;
  const Re = (v * D) / Math.max(nu, 1e-9);
  const lambda = Re < 2300 ? 64 / Math.max(Re, 1) : 0.316 / Math.pow(Math.max(Re, 1), 0.25);
  const g = 9.81;
  const hM = lambda * (longM / D) * ((v * v) / (2 * g));
  return hM * g;
}

/** Calibré ~20 kPa pour 80 m · Ø13 mm au débit d'une boucle de référence (0,8 kW). */
function pcPdcBoucleKpa(debitBoucleM3h, deltaT) {
  if (!debitBoucleM3h || debitBoucleM3h <= 0 || !deltaT) return 0;
  const qRef = debitOptimalM3h(HYDRO_PC_P_BOUCLE_KW, deltaT);
  if (!qRef) return 0;
  const darcy = darcyPdcKpa(HYDRO_PC_DIAM_MM, HYDRO_PC_L_BOUCLE_M, debitBoucleM3h);
  const darcyRef = darcyPdcKpa(HYDRO_PC_DIAM_MM, HYDRO_PC_L_BOUCLE_M, qRef);
  if (darcyRef > 0) return darcy * (HYDRO_PC_PDC_REF_KPA / darcyRef);
  return HYDRO_PC_PDC_REF_KPA * Math.pow(debitBoucleM3h / qRef, 1.35);
}

function zoneHasInput(z) {
  if (z.kind === "pc") return z.surfaceM2 > 0;
  if (z.kind === "rad" || z.kind === "ventilo") return z.nbEmetteurs > 0;
  return false;
}

/** Puissance calo à transmettre par zone (kW). */
function assignZonePowers(pInst, zoneDefs, batiment, besoin) {
  const active = zoneDefs.filter((z) => z.kind !== "absent" && z.hasInput);
  if (!active.length) return [];

  const logementSurf = logementSurfaceM2(batiment, besoin);
  const otherZones = active.filter((z) => z.kind !== "pc");
  const sumNb = otherZones.reduce((s, z) => s + z.nbEmetteurs, 0);

  let pcAssigned = 0;
  const rows = active.map((z) => {
    if (z.kind === "pc") {
      const powerKw = logementSurf > 0 ? pInst * (z.surfaceM2 / logementSurf) : 0;
      pcAssigned += powerKw;
      return { ...z, powerKw };
    }
    return { ...z, powerKw: 0 };
  });

  const remain = Math.max(0, pInst - pcAssigned);
  otherZones.forEach((z) => {
    const row = rows.find((r) => r.key === z.key);
    if (!row) return;
    row.powerKw = sumNb > 0 ? remain * (z.nbEmetteurs / sumNb) : (otherZones.length ? remain / otherZones.length : 0);
  });

  return rows;
}

function computePcZone(z, deltaT, pdcCollecteurBoucleKpa) {
  const nb = pcNbBoucles(z.surfaceM2);
  const qOpt = debitOptimalM3h(z.powerKw, deltaT);
  const debitBoucleM3h = nb > 0 ? qOpt / nb : 0;
  const pdcTubeKpa = pcPdcBoucleKpa(debitBoucleM3h, deltaT);
  const pdcColUnitKpa = Math.max(0, +(pdcCollecteurBoucleKpa ?? HYDRO_PC_PDC_COLLECTEUR_KPA));
  const pdcColTotKpa = nb * pdcColUnitKpa;
  const pdcKpa = pdcTubeKpa + pdcColTotKpa;
  const longTot = pcLongueurTotaleM(z.surfaceM2);
  return {
    pdcKpa,
    pdcTubeKpa,
    pdcCollecteurKpa: pdcColTotKpa,
    pdcCollecteurUnitKpa: pdcColUnitKpa,
    nbBoucles: nb,
    debitOptimalM3h: qOpt,
    debitBoucleM3h,
    detail: `${nb} boucle(s) · ${fmt(HYDRO_PC_L_BOUCLE_M, 0)} m/boucle · ${fmt(longTot, 0)} m total · ${fmt(z.powerKw, 1)} kW · Q ${fmt(qOpt, 2)} m³/h (${fmt(debitBoucleM3h, 2)}/boucle) · ${fmt(pdcTubeKpa, 1)} tube + ${nb}×${fmt(pdcColUnitKpa, 1)} coll. → ${fmt(pdcKpa, 1)} kPa`
  };
}

function computeRadZone(z) {
  const pdc = z.kind === "ventilo"
    ? z.nbEmetteurs * HYDRO_PDC_VENTILO_KPA
    : z.nbEmetteurs * HYDRO_PDC_RAD_KPA;
  const unit = z.kind === "ventilo" ? HYDRO_PDC_VENTILO_KPA : HYDRO_PDC_RAD_KPA;
  return {
    pdcKpa: pdc,
    detail: `${z.nbEmetteurs} émetteur(s) × ${unit} kPa`
  };
}

function resolveEchangeurPdcRegime(ech, prefer50) {
  const curves = ech?.courbesPdc;
  if (!curves?.length) return prefer50 ? "50°C" : null;
  if (prefer50) {
    const m = curves.find((c) => /50\s*°?\s*c/i.test(String(c.regime || "")));
    if (m) return m.regime;
  }
  return curves[0].regime || null;
}

function findCondenseurEauForGamme(gammeCode) {
  if (!gammeCode || !state.machines?.length) return null;
  for (const m of state.machines) {
    if (m.gammeCode !== gammeCode) continue;
    const id = m.composantsLiens?.echangeurF80;
    if (!id) continue;
    const found = typeof compFindById === "function" ? compFindById(id) : null;
    if (found?.item) return found.item;
  }
  return null;
}

/** Condenseur eau chauffage (B26) — rôle echangeurF80 dans le schéma. */
function findCondenseurEauForMachine(pac) {
  const m = typeof machineByPac === "function" ? machineByPac(pac) : null;
  if (!m) return null;
  const id = m.composantsLiens?.echangeurF80;
  if (!id) return null;
  const found = typeof compFindById === "function" ? compFindById(id) : null;
  return found?.item || null;
}

/** PAC retenue pour la note, ou 1re machine recommandée (couverture ≥ 100 %, sinon 1re candidate). */
function resolvePreselectedMachinePac(projet, pInst, gamme, src, depRegime) {
  if (typeof chosen !== "undefined" && chosen?.pac) return chosen.pac;
  if (!gamme?.code || !src || !depRegime || !pInst) return null;
  const s = projet?.source || {};
  const sel = Engine.selection(
    state.machines,
    state.performances,
    gamme.code,
    s.tension ?? 2,
    s.reversible ?? 0,
    src,
    depRegime,
    pInst
  );
  const candidates = [...(sel.mono || []), ...(sel.multi || [])];
  if (!candidates.length) return null;
  return (candidates.find((m) => m.couverture >= 100) || candidates[0]).pac;
}

function syncProjetPdcEchangeurFromHydro(projet, hydro) {
  const h = ensureProjetHydraulique(projet);
  if (h.pdcEchangeurAuto === false || !hydro?.active) return;
  if (hydro.pdcEchangeurKpa > 0) h.pdcEchangeurKpa = hydro.pdcEchangeurKpa;
  if (hydro.pdcEchangeurPac) h.pdcEchangeurPac = hydro.pdcEchangeurPac;
  if (hydro.pdcEchangeurRef) h.pdcEchangeurRef = hydro.pdcEchangeurRef;
  const el = typeof $ === "function" ? $("b_hydro_pdc_ech") : null;
  if (el && hydro.pdcEchangeurKpa > 0) el.value = fmt(hydro.pdcEchangeurKpa, 1);
}

function computeHydrauliqueChauffage(pInst, bs, projet, emetteurs, ctx) {
  ctx = ctx || {};
  const h = ensureProjetHydraulique(projet);
  const autoMode = h.pdcEchangeurAuto !== false;
  let pdcEchangeurKpa = autoMode ? 0 : Math.max(0, +(h.pdcEchangeurKpa || 0));
  let pdcEchangeurSource = !autoMode && pdcEchangeurKpa > 0 ? "manual" : null;
  let pdcEchangeurRef = null;
  let pdcEchangeurRegime = null;
  let pdcEchangeurPac = null;
  const pdcCollecteurBoucleKpa = Math.max(0, +(h.pdcCollecteurBoucleKpa ?? HYDRO_PC_PDC_COLLECTEUR_KPA));
  const batiment = projet?.batiment || {};
  const zoneInputs = bs.zones || [];

  const zoneDefs = zoneInputs.map((z, i) => {
    const em = emetteurs[z.emIdx];
    const kind = emitterHydroKind(em);
    const row = {
      key: `z${i}`,
      index: i,
      nom: z.nom,
      em,
      kind,
      surfaceM2: kind === "pc" ? zoneEffectiveSurfaceM2(z) : 0,
      nbEmetteurs: kind !== "pc" ? +(z.nbEmetteurs || 0) : 0,
      hasInput: false
    };
    row.hasInput = zoneHasInput(row);
    return row;
  }).filter((z) => z.kind !== "absent");

  const powered = assignZonePowers(pInst, zoneDefs, batiment, bs);
  const zones = powered.map((z) => {
    const deltaT = emitterDeltaT(z.em?.regime);
    let loss;
    if (z.kind === "pc") loss = computePcZone(z, deltaT, pdcCollecteurBoucleKpa);
    else if (z.kind === "rad" || z.kind === "ventilo") loss = computeRadZone(z);
    else loss = { pdcKpa: 0, detail: "" };

    const debitM3h = z.kind === "pc"
      ? (loss.debitOptimalM3h || 0)
      : debitOptimalM3h(z.powerKw, deltaT);

    return {
      key: z.key,
      label: z.em ? `${zoneDisplayName(z, z.index)} · ${emetteurOptionLabel(z.em)}` : zoneDisplayName(z, z.index),
      kind: z.kind,
      powerKw: z.powerKw,
      surfaceM2: z.surfaceM2,
      nbEmetteurs: z.nbEmetteurs,
      nbBoucles: loss.nbBoucles || null,
      debitBoucleM3h: loss.debitBoucleM3h || null,
      debitOptimalM3h: loss.debitOptimalM3h || debitM3h,
      longueurPcM: z.kind === "pc" ? pcLongueurTotaleM(z.surfaceM2) : null,
      deltaT,
      debitM3h,
      pdcKpa: loss.pdcKpa,
      detail: loss.detail
    };
  });

  const pdcZonesKpa = zones.reduce((s, z) => s + (z.pdcKpa || 0), 0);
  const debitM3h = zones.reduce((s, z) => s + (z.debitM3h || 0), 0);

  if (autoMode && debitM3h > 0 && typeof echangeurPdcAt === "function") {
    const gamme = ctx.gamme || state.gammes?.[projet?.source?.gamme];
    pdcEchangeurPac = resolvePreselectedMachinePac(projet, pInst, gamme, ctx.src, ctx.depRegime);
    const ech = pdcEchangeurPac
      ? findCondenseurEauForMachine(pdcEchangeurPac)
      : (gamme ? findCondenseurEauForGamme(gamme.code) : null);
    if (ech) {
      pdcEchangeurRef = ech.ref || ech.modele;
      pdcEchangeurRegime = resolveEchangeurPdcRegime(ech, true) || "50°C";
      const auto = echangeurPdcAt(pdcEchangeurRef, pdcEchangeurRegime, debitM3h);
      if (auto != null && auto > 0) {
        pdcEchangeurKpa = +auto.toFixed(2);
        pdcEchangeurSource = "catalog";
      }
    }
  }

  const pdcTotalKpa = pdcZonesKpa + pdcEchangeurKpa;

  return {
    debitM3h,
    pdcZonesKpa,
    pdcEchangeurKpa,
    pdcEchangeurSource,
    pdcEchangeurRef,
    pdcEchangeurRegime,
    pdcEchangeurPac,
    pdcEchangeurAuto: autoMode,
    pdcCollecteurBoucleKpa,
    pdcTotalKpa,
    hmtM: kpaToHeadM(pdcTotalKpa),
    zones,
    active: zones.length > 0
  };
}

function circInterpHmt(circ, debitM3h) {
  const pts = circ?.courbeHmt;
  if (!pts?.length) return circ?.hmtM ?? null;
  const sorted = [...pts].sort((a, b) => a.debit - b.debit);
  const q = +debitM3h;
  if (q <= sorted[0].debit) return sorted[0].hmt;
  if (q >= sorted[sorted.length - 1].debit) return sorted[sorted.length - 1].hmt;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (q >= a.debit && q <= b.debit) {
      const t = (q - a.debit) / (b.debit - a.debit);
      return a.hmt + t * (b.hmt - a.hmt);
    }
  }
  return null;
}

function evaluateCirculateurForHydro(pac, hydro) {
  if (!hydro?.active || !hydro.debitM3h) return null;
  const m = machineByPac(pac);
  if (!m) return null;
  const compId = m.composantsLiens?.circulateurChaud;
  if (!compId) return null;
  const found = typeof compFindById === "function" ? compFindById(compId) : null;
  if (!found) return { ref: compId, missing: true };
  const circ = found.item;
  const hmtDispo = circInterpHmt(circ, hydro.debitM3h);
  const ok = hmtDispo != null && hmtDispo >= hydro.hmtM;
  return {
    ref: circ.ref || circ.modele || compId,
    hmtDispo,
    hmtRequis: hydro.hmtM,
    debitM3h: hydro.debitM3h,
    ok,
    hasCurve: !!(circ.courbeHmt?.length)
  };
}

function applyHydroEstimToMachine(pac) {
  const r = LAST?.hydro;
  if (!r?.active) {
    toast("Renseignez surface ou nombre d'émetteurs (onglet Projet · E)");
    return;
  }
  const m = machineByPac(pac);
  if (!m) return;
  const g = ensureMachineGeneral(m);
  g.hydraulique.debitChauffageM3h = +(r.debitM3h.toFixed(2));
  g.hydraulique.pdcChauffageKpa = +(r.pdcTotalKpa.toFixed(1));
  applyMachineGeneralToPerf(pac, g);
  if (MOPEN && MOPEN.pac === pac) renderMachineModal();
  toast(`Hydraulique : ${fmt(r.debitM3h, 2)} m³/h · ${fmt(r.pdcTotalKpa, 1)} kPa`);
}

function hydroZoneFieldVisibility(em) {
  const k = emitterHydroKind(em);
  return { nb: k === "rad" || k === "ventilo", rad: k === "rad" };
}

function renderHydrauliqueFormulasNote(h) {
  const dts = h?.zones?.length
    ? [...new Set(h.zones.map((z) => z.deltaT).filter(Boolean))].sort((a, b) => a - b)
    : [5, 10, 12, 15];
  const dtLbl = dts.map((d) => `${d} K`).join(", ");
  const qTot = h?.debitM3h != null ? `${fmt(h.debitM3h, 2)} m³/h` : "—";
  const pdcTot = h?.pdcTotalKpa != null ? `${fmt(h.pdcTotalKpa, 1)} kPa` : "—";
  const pdcCol = h?.pdcCollecteurBoucleKpa != null ? `${fmt(h.pdcCollecteurBoucleKpa, 1)} kPa/boucle` : `${fmt(HYDRO_PC_PDC_COLLECTEUR_KPA, 1)} kPa/boucle`;
  return `<details class="hydro-formulas-note">
    <summary>Formules · débit optimal &amp; pertes de charge</summary>
    <div class="hydro-formulas-body">
      <p><b>Débit optimal</b> (par zone, eau ≈ 1000 kg/m³) :</p>
      <p class="mono hydro-formula">Q = P / (1,16 × ΔT)</p>
      <ul>
        <li><b>Q</b> en m³/h · <b>P</b> puissance calorifique de la zone (kW)</li>
        <li><b>1,16</b> ≈ ρ×Cp (kWh/(m³·K)) pour l'eau · <b>ΔT</b> = T<sub>départ</sub> − T<sub>retour</sub> (K)</li>
        <li>ΔT selon régime émetteur : plancher ≤25°C → 5 K · 40/45°C → 10 K · 50/55°C → 12 K · ≥60°C → 15 K</li>
        <li>ΔT retenu(s) dans ce projet : ${escHtml(dtLbl)} · <b>Q total estimé : ${escHtml(qTot)}</b></li>
      </ul>
      <p><b>Pertes de charge zones</b></p>
      <ul>
        <li><b>Plancher chauffant</b> : boucles Ø13 mm (~80 m/boucle, 1 boucle / 10 m²) · Pdc tube (Darcy-Weisbach) + <b>N<sub>boucles</sub> × Pdc collecteur</b> (${escHtml(pdcCol)}/boucle, réglable) · Pdc zone = tube + Σ collecteur · total projet = Σ zones</li>
        <li><b>Radiateurs</b> : 18 kPa / unité · <b>Ventilo-convecteurs</b> : 14 kPa / unité</li>
        <li><b>Puissance transmissible radiateurs</b> : P = P<sub>nom,ΔT50</sub> × (ΔT / 50)<sup>1,3</sup> · ΔT = T<sub>moy eau</sub> − T<sub>pièce</sub> · P<sub>nom</sub> depuis dimensions (type 11/21/22/33) ou saisie directe @ ΔT50</li>
        <li><b>Total distribution</b> = Σ Pdc zones (+ échangeur si renseigné) → <b>${escHtml(pdcTot)}</b></li>
      </ul>
      <p><b>Échangeurs SWEP B26 / F80 / FI22</b> — courbes ΔP=f(Q) importées depuis <code>circu.xlsx</code> : <b>B26 @ 50°C</b> (eau chauffage) · F80 @ 0°C/15% glycol (captage) · FI22 (glycol + 50°C).</p>
      <ul>
        <li>Par défaut : Pdc échangeur interpolée sur le <b>B26</b> (condenseur eau) de la machine présélectionnée au débit total Q · régime 50°C</li>
        <li>Modifier le champ ci-dessus passe en saisie manuelle · bouton ↺ pour revenir à l'auto</li>
      </ul>
    </div>
  </details>`;
}

function renderRadiatorTransmissionBreakdown(rad, pInst) {
  if (!rad?.active) return "";
  const ok = pInst <= 0 || rad.totalKw >= pInst;
  const margin = rad.totalKw - (pInst || 0);
  let html = `<div class="hydro-rad-tx-block${ok ? "" : " hydro-rad-tx-warn"}">
    <div class="hydro-rad-tx-head"><b>Puissance transmissible radiateurs</b> <span class="mono">${fmt(rad.totalKw, 1)} kW</span>
    ${pInst > 0 ? `<span class="hint">· à installer ${fmt(pInst, 1)} kW · marge ${margin >= 0 ? "+" : ""}${fmt(margin, 1)} kW</span>` : ""}</div>`;
  rad.zones.forEach((z) => {
    html += `<div class="hydro-zone-mini"><span class="hydro-zone-lbl">${escHtml(z.nom)}</span>
      <span class="mono">${z.nb} × ${fmt(z.pUnitKw, 2)} kW · ΔT ${fmt(z.deltaT, 1)} K → ${fmt(z.pZoneKw, 1)} kW</span></div>`;
  });
  if (!ok) html += `<p class="hint hydro-rad-tx-alert">⚠ Puissance transmissible inférieure à la puissance à installer — augmenter les radiateurs ou le régime.</p>`;
  html += `</div>`;
  return html;
}

function renderHydrauliqueBreakdown(h) {
  if (!h?.active) {
    return `<p class="hint" style="margin:0">Renseignez la <b>surface</b> (plancher) ou le <b>nombre d'unités</b> pour chaque zone.</p>`
      + renderHydrauliqueFormulasNote(h);
  }
  let html = `<div class="hydro-sum-inline mono"><b>${fmt(h.pdcTotalKpa, 1)} kPa</b> · ${fmt(h.hmtM, 2)} m CE · Q ${fmt(h.debitM3h, 2)} m³/h</div>`;
  h.zones.forEach((z) => {
    html += `<div class="hydro-zone-mini"><span class="hydro-zone-lbl">${escHtml(z.label)}</span> <span class="mono">${escHtml(z.detail)} → ${fmt(z.pdcKpa, 1)} kPa</span></div>`;
  });
  if (h.pdcEchangeurKpa > 0) {
    const src = h.pdcEchangeurSource === "catalog"
      ? `auto · ${escHtml(h.pdcEchangeurPac || "—")} / B26 ${escHtml(h.pdcEchangeurRef || "—")} · ${escHtml(h.pdcEchangeurRegime || "—")} @ Q ${fmt(h.debitM3h, 2)} m³/h`
      : "Pdc saisie manuelle";
    html += `<div class="hydro-zone-mini"><span class="hydro-zone-lbl">Échangeur (eau)</span> <span class="mono">${src} → ${fmt(h.pdcEchangeurKpa, 1)} kPa</span></div>`;
  }
  if (h.pdcZonesKpa != null && h.pdcEchangeurKpa > 0) {
    html += `<div class="hydro-zone-mini hint" style="border:none;padding-top:0">Distribution ${fmt(h.pdcZonesKpa, 1)} kPa + échangeur ${fmt(h.pdcEchangeurKpa, 1)} kPa</div>`;
  }
  html += renderHydrauliqueFormulasNote(h);
  return html;
}

function renderHydroMachineEstim(pac) {
  const h = LAST?.hydro;
  if (!h?.active) return "";
  const evalC = evaluateCirculateurForHydro(pac, h);
  let circHtml = "";
  if (evalC) {
    if (evalC.missing) {
      circHtml = `<span class="hydro-circ-warn">Circulateur introuvable</span>`;
    } else if (evalC.hmtDispo != null) {
      const cls = evalC.ok ? "ok" : "ko";
      circHtml = `<span class="hydro-circ-${cls}">${evalC.ok ? "✓" : "⚠"} ${escHtml(evalC.ref)} : ${fmt(evalC.hmtDispo, 1)} m @ ${fmt(h.debitM3h, 2)} m³/h</span>`;
    }
  }
  return `<div class="hydro-estim-bar">
    <div class="hydro-estim-main"><span><b>${fmt(h.pdcTotalKpa, 1)} kPa</b> · Q ${fmt(h.debitM3h, 2)} m³/h</span>${circHtml}</div>
    <button type="button" class="btn-soft" onclick="applyHydroEstimToMachine(${JSON.stringify(pac)})">→ Fiche Général</button>
  </div>`;
}
