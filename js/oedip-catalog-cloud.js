/* OEDIP — chargement catalogues de référence depuis Supabase — avant oedip-workspace.js */
async function loadReferenceCatalogFromCloud() {
  if (typeof sbIsReady !== "function" || !sbIsReady()) return false;
  try {
    const { data: rows, error } = await _sbClient
      .from("reference_catalogs")
      .select("key,payload,updated_at")
      .eq("published", true);
    if (error) throw error;
    if (!rows?.length) return false;

    const map = Object.fromEntries(rows.map((r) => [r.key, r.payload]));
    if (!map.catalog_full && !map.catalog_db) return false;

    if (map.catalog_full) {
      applyCatalogImport(map.catalog_full, { silent: true, keepStudyName: true });
    } else {
      applyCatalogImport(map.catalog_db, { silent: true, keepStudyName: true });
    }

    if (map.catalog_dju) applyDjuCatalogPayload(map.catalog_dju);

    if (map.catalog_circulateurs_wilo && typeof mergeCirculateursCatalog === "function") {
      mergeCirculateursCatalog(map.catalog_circulateurs_wilo);
    }

    if (map.catalog_echangeurs_pdc?.byRef) {
      window.OEDIP_ECHANGEURS_PDC = map.catalog_echangeurs_pdc.byRef;
      if (typeof mergeEchangeursPdcIntoComposants === "function") {
        mergeEchangeursPdcIntoComposants(state.composants);
      }
    }

    if (map.catalog_procedures_geo && Array.isArray(state.procedureCatalogs)) {
      const geo = map.catalog_procedures_geo;
      const picked = typeof pickProcedureCatalog === "function"
        ? pickProcedureCatalog(geo, geo.gammeCode)
        : geo;
      if (picked) {
        const idx = state.procedureCatalogs.findIndex((c) => +c.gammeCode === +geo.gammeCode);
        if (idx >= 0) state.procedureCatalogs[idx] = picked;
        else state.procedureCatalogs.push(picked);
      }
    }

    if (typeof ensureProcedureCatalogPhotos === "function") ensureProcedureCatalogPhotos();
    if (typeof ensureBundledComposants === "function") ensureBundledComposants();

    ensureDepartements();
    if (typeof ensureComposants === "function") ensureComposants();
    if (typeof ensureOutils === "function") ensureOutils();
    migratePerformances();
    normalizeGammes();
    normalizeEmetteurs();
    fillSelects();
    fillDbPerfSelects();
    writeForm();
    recalc();
    renderGammes();
    syncDeptFromCp(true);

    const nGam = state.gammes?.length || 0;
    const nMach = state.machines?.length || 0;
    toast("Catalogue cloud chargé · " + nGam + " gammes · " + nMach + " machines");
    return true;
  } catch (e) {
    console.warn("Catalogue cloud:", e.message);
    return false;
  }
}

function applyDjuCatalogPayload(payload) {
  if (!payload?.byCode) return;
  window.OEDIP_DJU_BY_CODE = payload.byCode;
  if (payload.meta) {
    window.OEDIP_DJU_META = payload.meta;
    window.OEDIP_DJU_YEARS = payload.meta.years;
    window.OEDIP_DJU_DEFAULT_YEAR = payload.meta.defaultYear;
    window.OEDIP_DJU_DEFAULT_BASE = payload.meta.defaultBase;
  }
  if (typeof ensureDepartements === "function") ensureDepartements();
}
