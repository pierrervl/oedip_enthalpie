/* OEDIP — procédures atelier par gamme (frigo)
   Variables machine : {{pac}}, {{pipe.aspBotComp.longM}}, {{comp.compresseur.ref}}
   Cotes par variante tube : {{L}}, {{diam}}… — proc.variants[].stepDims · machine.frigoTubeVariants[tubeRef] */

function ensureProcedureCatalogs() {
  if (!Array.isArray(state.procedureCatalogs)) state.procedureCatalogs = [];
}

function procedureCatalogImageStepCount(cat) {
  if (!cat?.procedures) return 0;
  let n = 0;
  cat.procedures.forEach((p) => (p.steps || []).forEach((s) => {
    if (s.image || (s.images && s.images.length)) n++;
  }));
  return n;
}

function bundledProcedureCatalogFor(gammeCode) {
  const root = typeof OEDIP_DEFAULT_CATALOG !== "undefined" ? OEDIP_DEFAULT_CATALOG : null;
  if (!root) return null;
  const list = root.data?.procedureCatalogs || root.procedureCatalogs || [];
  return list.find((c) => +c.gammeCode === +gammeCode) || null;
}

/** Conserve la version la plus riche en photos (catalogue embarqué vs cloud / import). */
function pickProcedureCatalog(candidate, gammeCode) {
  const bundled = bundledProcedureCatalogFor(gammeCode);
  if (!candidate) return bundled ? JSON.parse(JSON.stringify(bundled)) : null;
  if (!bundled) return candidate;
  const candN = candidate.procedures?.length || 0;
  const bundN = bundled.procedures?.length || 0;
  if (candN >= bundN) return candidate;
  return procedureCatalogImageStepCount(candidate) >= procedureCatalogImageStepCount(bundled)
    ? candidate
    : JSON.parse(JSON.stringify(bundled));
}

function procedureEditAllowed() {
  return typeof sbIsAdmin === "function" && sbIsAdmin();
}

function updateProcedureAdminUI() {
  const host = $("v-procedures");
  if (host) host.classList.toggle("proc-admin", procedureEditAllowed());
  if ($("procList") && typeof renderProceduresTab === "function") renderProceduresTab();
}

function ensureProcedureCatalogPhotos() {
  ensureProcedureCatalogs();
  const bundledList = (typeof OEDIP_DEFAULT_CATALOG !== "undefined" && OEDIP_DEFAULT_CATALOG?.data?.procedureCatalogs) || [];
  bundledList.forEach((bundled) => {
    const picked = pickProcedureCatalog(
      state.procedureCatalogs.find((c) => +c.gammeCode === +bundled.gammeCode),
      bundled.gammeCode
    );
    if (!picked) return;
    const idx = state.procedureCatalogs.findIndex((c) => +c.gammeCode === +bundled.gammeCode);
    if (idx >= 0) state.procedureCatalogs[idx] = picked;
    else state.procedureCatalogs.push(picked);
  });
}

function getProcedureCatalog(gammeCode) {
  ensureProcedureCatalogs();
  return state.procedureCatalogs.find((c) => +c.gammeCode === +gammeCode) || null;
}

function machinesInGamme(gammeCode) {
  return state.machines.filter((m) => +m.gammeCode === +gammeCode);
}

function findCatalogCompByRef(ref) {
  if (!ref) return null;
  const key = String(ref);
  for (const type of Object.keys(state.composants || {})) {
    const list = state.composants[type];
    if (!Array.isArray(list)) continue;
    const found = list.find((c) => String(c.ref || c.modele || c.id) === key);
    if (found) return found;
  }
  return null;
}

function buildMachineProcContext(pac) {
  const m = machineByPac(pac);
  if (!m) return {};
  const gam = gammeByCode(m.gammeCode);
  const t = typeof ensureFrigoTuyaux === "function" ? ensureFrigoTuyaux(m) : m.frigoTuyaux || {};
  const pipe = {};
  (typeof FRIGO_PIPES !== "undefined" ? FRIGO_PIPES : []).forEach((p) => {
    const cur = t[p.id] || {};
    pipe[p.id] = {
      diamMm: cur.diamMm != null ? cur.diamMm : "—",
      longM: cur.longM != null ? cur.longM : "—",
      label: p.label,
      circuit: p.circuit
    };
  });
  const comp = {};
  Object.entries(m.composantsLiens || {}).forEach(([role, ref]) => {
    const item = findCatalogCompByRef(ref);
    comp[role] = {
      ref: ref || "—",
      modele: item?.modele || item?.ref || "—"
    };
  });
  return {
    pac: m.pac || "—",
    chargeFluide: m.chargeFluide != null ? m.chargeFluide : "—",
    nbComp: m.nbComp != null ? m.nbComp : "—",
    gamme: {
      nom: gam?.nom || "—",
      fluide: gam?.fluide === "custom" ? (gam?.fluideLabel || "Autre") : (gam?.fluide || "—"),
      desc: gam?.desc || ""
    },
    pipe,
    comp,
    procDims: m.frigoProcDims && typeof m.frigoProcDims === "object" ? m.frigoProcDims : {}
  };
}

function procPathValue(ctx, path) {
  if (!path) return "";
  return String(path.split(".").reduce((o, k) => (o != null && o[k] !== undefined ? o[k] : undefined), ctx) ?? "—");
}

function ensureFrigoTubeVariants(m) {
  if (!m) return {};
  if (!m.frigoTubeVariants || typeof m.frigoTubeVariants !== "object") m.frigoTubeVariants = {};
  return m.frigoTubeVariants;
}

function normalizeVariantVer(ver) {
  const s = String(ver ?? "01").replace(/\D/g, "") || "1";
  return String(+s).padStart(2, "0");
}

function getProcedureVariant(proc, ver) {
  if (!proc?.variants?.length) return null;
  const v = normalizeVariantVer(ver);
  return proc.variants.find((x) => normalizeVariantVer(x.ver) === v || x.ref === `${proc.tubeRef}-${v}`) || proc.variants[0];
}

function getMachineTubeVariantVer(m, tubeRef) {
  if (!tubeRef) return "01";
  return normalizeVariantVer(ensureFrigoTubeVariants(m)[tubeRef]);
}

function tubeProceduresForGamme(gammeCode) {
  const cat = getProcedureCatalog(gammeCode);
  return (cat?.procedures || []).filter((p) => p.tubeRef).sort((a, b) => (a.tubeNum ?? 999) - (b.tubeNum ?? 999));
}

function migrateProcedureVariants(proc) {
  if (!proc?.tubeRef || proc.variants?.length) return;
  const stepDims = {};
  (proc.steps || []).forEach((s, i) => {
    if (s.dims && Object.keys(s.dims).length) stepDims[`e${i + 1}`] = { ...s.dims };
  });
  if (Object.keys(stepDims).length) {
    proc.variants = [{ ver: "01", ref: `${proc.tubeRef}-01`, stepDims }];
    proc.steps.forEach((s) => { delete s.dims; });
  }
}

function migrateProcedureCatalogVariants(cat) {
  (cat?.procedures || []).forEach(migrateProcedureVariants);
}

function procedureStepKey(stepIndex) {
  return `e${stepIndex + 1}`;
}

function variantStepDims(variant, stepIndex) {
  return variant?.stepDims?.[procedureStepKey(stepIndex)] || {};
}

function mergedStepDims(proc, step, stepIndex, ctx) {
  const key = procedureStepKey(stepIndex);
  if (proc.tubeRef && proc.variants?.length) {
    const m = ctx.pac && ctx.pac !== "—" ? machineByPac(ctx.pac) : null;
    const ver = m ? getMachineTubeVariantVer(m, proc.tubeRef) : "01";
    const variant = getProcedureVariant(proc, ver);
    const fromVar = variantStepDims(variant, stepIndex);
    if (Object.keys(fromVar).length) return { ...fromVar };
  }
  const defaults = step.dims && typeof step.dims === "object" ? step.dims : {};
  const over = ctx.procDims?.[proc.id]?.[key];
  return over && typeof over === "object" ? { ...defaults, ...over } : defaults;
}

function resolveProcedureText(text, ctx, stepDims = null) {
  if (!text) return "";
  const dims = stepDims && typeof stepDims === "object" ? stepDims : {};
  return String(text).replace(/\{\{([^}]+)\}\}/g, (_, p) => {
    const k = p.trim();
    if (dims[k] !== undefined && dims[k] !== null && dims[k] !== "") return String(dims[k]);
    return procPathValue(ctx, k);
  });
}

function escVal(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const PROC_IMG_SCALE_MIN = 0.25;
const PROC_IMG_SCALE_MAX = 3;
let procEditPhotoPick = { stepIdx: -1, photoIdx: -1 };

function normalizeMediaItem(item) {
  if (typeof item === "string") return { src: item, rotate: 0, scale: 1 };
  const o = item && typeof item === "object" ? item : {};
  let rotate = +(o.rotate || 0);
  if (![0, 90, 180, 270].includes(rotate)) rotate = 0;
  let scale = +(o.scale) || 1;
  scale = Math.max(PROC_IMG_SCALE_MIN, Math.min(PROC_IMG_SCALE_MAX, scale));
  return { src: o.src || "", rotate, scale };
}

function normalizeStepMedia(step) {
  if (!step) return [];
  const raw = step.images?.length ? step.images : step.image ? [step.image] : [];
  return raw.map(normalizeMediaItem).filter((m) => m.src);
}

function ensureStepMedia(step) {
  if (!step._media) step._media = normalizeStepMedia(step);
  return step._media;
}

function applyMediaToStep(step, media) {
  delete step.image;
  delete step.images;
  delete step._media;
  const list = (media || []).filter((m) => m.src);
  if (!list.length) return;
  const compact = list.map((m) => {
    if (!m.rotate && m.scale === 1 && !String(m.src).startsWith("data:")) return m.src;
    const o = { src: m.src };
    if (m.rotate) o.rotate = m.rotate;
    if (m.scale !== 1) o.scale = m.scale;
    return o;
  });
  if (compact.length === 1 && typeof compact[0] === "string") step.image = compact[0];
  else step.images = compact;
}

function procImgInnerStyle(item) {
  const rot = item.rotate || 0;
  const sc = item.scale || 1;
  if (!rot && sc === 1) return "";
  return `transform:rotate(${rot}deg) scale(${sc});transform-origin:center center`;
}

function readImageFileAsDataUrl(file, maxSide = 1600, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      const m = Math.max(w, h);
      if (m > maxSide) {
        const s = maxSide / m;
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("read")); };
    img.src = url;
  });
}

function extractDimVarsFromText(text) {
  const found = [];
  String(text || "").replace(/\{\{([^}]+)\}\}/g, (_, p) => {
    const k = p.trim();
    if (k && !k.includes(".")) found.push(k);
    return "";
  });
  return [...new Set(found)];
}

function collectProcedureDimColumns(proc) {
  const cols = [];
  const seen = new Set();
  const addVars = (stepIndex, dimKey) => {
    const stepKey = procedureStepKey(stepIndex);
    const colId = `${stepKey}.${dimKey}`;
    if (seen.has(colId)) return;
    seen.add(colId);
    cols.push({ stepIndex, stepKey, dimKey, colId, label: `É${stepIndex + 1} · ${dimKey}` });
  };
  const scanStep = (stepIndex, dimsObj, stepText) => {
    const vars = new Set(Object.keys(dimsObj || {}));
    extractDimVarsFromText(stepText).forEach((v) => vars.add(v));
    [...vars].sort().forEach((dimKey) => addVars(stepIndex, dimKey));
  };
  if (proc?.variants?.length) {
    proc.variants.forEach((v) => {
      Object.entries(v.stepDims || {}).forEach(([sk, dims]) => {
        const stepIndex = parseInt(sk.slice(1), 10) - 1;
        scanStep(stepIndex, dims, proc.steps?.[stepIndex]?.text);
      });
    });
    (proc.steps || []).forEach((step, i) => {
      extractDimVarsFromText(step.text).forEach((dimKey) => addVars(i, dimKey));
    });
  } else {
    (proc?.steps || []).forEach((step, i) => scanStep(i, step.dims, step.text));
  }
  return cols;
}

function effectiveDimFromVariant(variant, stepIndex, dimKey) {
  return variantStepDims(variant, stepIndex)[dimKey] ?? "";
}

function stepDimDefault(step, dimKey) {
  return step?.dims?.[dimKey] ?? "";
}

function machineDimOverride(m, procId, stepKey, dimKey) {
  return m.frigoProcDims?.[procId]?.[stepKey]?.[dimKey] ?? "";
}

function effectiveDim(m, proc, stepIndex, dimKey) {
  const stepKey = procedureStepKey(stepIndex);
  const def = stepDimDefault(proc.steps[stepIndex], dimKey);
  const over = machineDimOverride(m, proc.id, stepKey, dimKey);
  return over !== "" ? over : def;
}

function setMachineProcDim(m, procId, stepKey, dimKey, value, defaultVal) {
  if (!m.frigoProcDims) m.frigoProcDims = {};
  const branch = m.frigoProcDims[procId] || (m.frigoProcDims[procId] = {});
  const stepBranch = branch[stepKey] || (branch[stepKey] = {});
  const v = String(value ?? "").trim();
  const def = String(defaultVal ?? "").trim();
  if (!v || v === def) {
    delete stepBranch[dimKey];
    if (!Object.keys(stepBranch).length) delete branch[stepKey];
    if (!Object.keys(branch).length) delete m.frigoProcDims[procId];
    if (m.frigoProcDims && !Object.keys(m.frigoProcDims).length) delete m.frigoProcDims;
  } else {
    stepBranch[dimKey] = v;
  }
}

function cleanupMachineProcDims(m, procId) {
  const b = m.frigoProcDims?.[procId];
  if (!b) return;
  Object.keys(b).forEach((sk) => { if (!Object.keys(b[sk]).length) delete b[sk]; });
  if (!Object.keys(b).length) delete m.frigoProcDims[procId];
}

function renderProcedureVariantsTableHtml(proc, opts = {}) {
  const cols = collectProcedureDimColumns(proc);
  if (!proc.tubeRef || !proc.variants?.length) {
    if (!cols.length) return `<p class="hint">Aucune cote variable.</p>`;
    return renderProcedureDimsTableHtml(proc, null, opts);
  }
  if (!cols.length) return `<p class="hint">Réf. <span class="mono">${escHtml(proc.tubeRef)}</span> — aucune cote dans les variantes.</p>`;
  const mode = opts.mode || "view";
  const head = `<tr><th>Variante</th>${cols.map((c) => `<th>${escHtml(c.label)}</th>`).join("")}</tr>`;
  if (mode === "edit") {
    const rows = proc.variants.map((v, vi) => `<tr data-var-i="${vi}">
      <td class="mono"><input type="text" class="proc-var-ref-inp" value="${escVal(v.ref || "")}" style="width:100%"><input type="hidden" class="proc-var-ver-inp" value="${escVal(v.ver || "01")}"></td>
      ${cols.map((c) => {
        const val = effectiveDimFromVariant(v, c.stepIndex, c.dimKey);
        return `<td><input type="text" class="mono proc-var-dim-inp" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(val)}"></td>`;
      }).join("")}
    </tr>`).join("");
    return `<div class="proc-dims-wrap"><p class="hint">Base <span class="mono">${escHtml(proc.tubeRef)}</span> — une ligne = une variante (<span class="mono">${escHtml(proc.tubeRef)}-01</span>, <span class="mono">-02</span>…).</p>
      <table class="proc-dims-tbl proc-gamme-tbl proc-variants-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table>
      <button type="button" class="btn-ghost" onclick="procedureEditAddVariant()">+ Variante ${String(proc.variants.length + 1).padStart(2, "0")}</button></div>`;
  }
  const rows = proc.variants.map((v) => `<tr class="${normalizeVariantVer(v.ver) === "01" ? "proc-dims-def" : ""}">
    <td class="mono"><b>${escHtml(v.ref || `${proc.tubeRef}-${v.ver}`)}</b></td>
    ${cols.map((c) => `<td class="mono">${escHtml(effectiveDimFromVariant(v, c.stepIndex, c.dimKey) || "—")}</td>`).join("")}
  </tr>`).join("");
  return `<div class="proc-dims-wrap"><p class="hint">Réf. base <span class="mono">${escHtml(proc.tubeRef)}</span> · version choisie par machine sur le schéma frigo.</p>
    <table class="proc-dims-tbl proc-gamme-tbl proc-variants-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function renderProcedureDimsTableHtml(proc, gammeCode, opts = {}) {
  if (proc.tubeRef && proc.variants?.length) return renderProcedureVariantsTableHtml(proc, opts);
  const cols = collectProcedureDimColumns(proc);
  if (!cols.length) {
    return `<p class="hint">Aucune variable de mesure (<span class="mono">{{L}}</span>, <span class="mono">{{diam}}</span>…) — ajoutez-les dans le texte des étapes.</p>`;
  }
  const machines = machinesInGamme(gammeCode);
  const mode = opts.mode || "view";
  const head = `<tr><th>Machine</th>${cols.map((c) => `<th title="${escVal(c.colId)}">${escHtml(c.label)}</th>`).join("")}</tr>`;

  if (mode === "edit") {
    const defRow = `<tr class="proc-dims-def"><td><b>Défaut gamme</b></td>${cols.map((c) => {
      const v = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
      return `<td><input type="text" class="mono proc-dim-inp" data-dim-scope="default" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(v)}"></td>`;
    }).join("")}</tr>`;
    const mRows = machines.map((m, mi) => `<tr>
      <td class="mono">${escHtml(m.pac)}</td>
      ${cols.map((c) => {
        const def = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
        const over = machineDimOverride(m, proc.id, c.stepKey, c.dimKey);
        return `<td><input type="text" class="mono proc-dim-inp" data-dim-scope="machine" data-mi="${mi}" data-step-key="${escVal(c.stepKey)}" data-dim-key="${escVal(c.dimKey)}" value="${escVal(over)}" placeholder="${escVal(def)}"></td>`;
      }).join("")}
    </tr>`).join("");
    return `<div class="proc-dims-wrap"><table class="proc-dims-tbl proc-gamme-tbl"><thead>${head}</thead><tbody>${defRow}${mRows}</tbody></table></div>`;
  }

  const defRow = `<tr class="proc-dims-def"><td><span class="tag">Défaut</span></td>${cols.map((c) => {
    const v = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
    return `<td class="mono">${escHtml(v || "—")}</td>`;
  }).join("")}</tr>`;
  const mRows = machines.map((m) => `<tr>
    <td class="mono">${escHtml(m.pac)}</td>
    ${cols.map((c) => {
      const eff = effectiveDim(m, proc, c.stepIndex, c.dimKey);
      const over = machineDimOverride(m, proc.id, c.stepKey, c.dimKey);
      const cls = over !== "" ? "proc-dim-override" : "";
      return `<td class="mono ${cls}" title="${over !== "" ? "Surcharge machine" : ""}">${escHtml(eff || "—")}</td>`;
    }).join("")}
  </tr>`).join("");
  return `<div class="proc-dims-wrap"><table class="proc-dims-tbl proc-gamme-tbl"><thead>${head}</thead><tbody>${defRow}${mRows}</tbody></table></div>`;
}

let procedureEditDraft = null;

function renderProcedureEditPhotosInner(step, stepIdx) {
  const media = ensureStepMedia(step);
  const cards = media.map((m, pi) => {
    const scPct = Math.round((m.scale || 1) * 100);
    const innerStyle = procImgInnerStyle(m);
    const preview = m.src
      ? `<span class="proc-step-img-inner"${innerStyle ? ` style="${escVal(innerStyle)}"` : ""}><img src="${escVal(oedipMediaUrl(m.src))}" alt=""></span>`
      : `<span class="hint">Aucune image</span>`;
    return `<div class="proc-edit-photo-card" data-photo-idx="${pi}">
      <div class="proc-edit-photo-preview">${preview}</div>
      <div class="proc-edit-photo-tools">
        <button type="button" class="btn-ghost" title="Pivoter à gauche" onclick="procEditPhotoRotate(${stepIdx},${pi},-90)">↺</button>
        <button type="button" class="btn-ghost" title="Pivoter à droite" onclick="procEditPhotoRotate(${stepIdx},${pi},90)">↻</button>
        <button type="button" class="btn-ghost" title="Réduire" onclick="procEditPhotoScale(${stepIdx},${pi},-0.1)">−</button>
        <span class="mono proc-edit-photo-scale-lbl">${scPct}%</span>
        <button type="button" class="btn-ghost" title="Agrandir" onclick="procEditPhotoScale(${stepIdx},${pi},0.1)">+</button>
        <button type="button" class="btn-ghost" title="Changer l'image" onclick="procEditPhotoPickFile(${stepIdx},${pi})">🖼</button>
        <button type="button" class="btn-ghost" title="Supprimer" onclick="procEditPhotoRemove(${stepIdx},${pi})">✕</button>
      </div>
      <input type="text" class="mono proc-edit-photo-path" value="${escVal(m.src)}" placeholder="img/procedures/geo/…" title="Chemin relatif ou image importée">
    </div>`;
  }).join("");
  return `${cards ? `<div class="proc-edit-photos-grid">${cards}</div>` : ""}
    <div class="proc-edit-photos-actions">
      <button type="button" class="btn-soft" onclick="procEditPhotoPickFile(${stepIdx},-1)">+ Ajouter une photo</button>
    </div>`;
}

function refreshProcedureEditPhotos(stepIdx) {
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  const host = document.querySelector(`.proc-edit-step[data-step-i="${stepIdx}"] .proc-edit-photos-body`);
  if (step && host) host.innerHTML = renderProcedureEditPhotosInner(step, stepIdx);
}

function syncProcedureEditTextsOnly() {
  if (!procedureEditDraft) return;
  const proc = procedureEditDraft.proc;
  const titleInp = $("procEditTitleInp");
  const introInp = $("procEditIntroInp");
  const orderInp = $("procEditOrderInp");
  if (titleInp) proc.title = titleInp.value.trim() || proc.title;
  if (introInp) {
    const intro = introInp.value.trim();
    if (intro) proc.printIntro = intro;
    else delete proc.printIntro;
  }
  if (orderInp) proc.order = +orderInp.value || proc.order || 999;
  [...document.querySelectorAll(".proc-edit-step")].forEach((el, i) => {
    const step = proc.steps[i];
    if (!step) return;
    step.text = el.querySelector(".proc-edit-step-text")?.value ?? "";
    if (!step.dims) step.dims = {};
    el.querySelectorAll("[data-proc-dim-key]").forEach((inp) => {
      const k = inp.dataset.procDimKey;
      const v = inp.value.trim();
      if (v) step.dims[k] = v;
      else delete step.dims[k];
    });
    if (!Object.keys(step.dims).length) delete step.dims;
    const media = ensureStepMedia(step);
    el.querySelectorAll(".proc-edit-photo-card").forEach((card, pi) => {
      if (!media[pi]) return;
      const pathInp = card.querySelector(".proc-edit-photo-path");
      if (pathInp?.value.trim()) media[pi].src = pathInp.value.trim();
    });
  });
}

function procEditPhotoApply(stepIdx) {
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  applyMediaToStep(step, media);
  step._media = media;
}

function procEditPhotoRotate(stepIdx, photoIdx, delta) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  if (!media[photoIdx]) return;
  media[photoIdx].rotate = (media[photoIdx].rotate + delta + 360) % 360;
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoScale(stepIdx, photoIdx, delta) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  if (!media[photoIdx]) return;
  const sc = (media[photoIdx].scale || 1) + delta;
  media[photoIdx].scale = Math.max(PROC_IMG_SCALE_MIN, Math.min(PROC_IMG_SCALE_MAX, Math.round(sc * 100) / 100));
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoRemove(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  const step = procedureEditDraft?.proc?.steps?.[stepIdx];
  if (!step) return;
  const media = ensureStepMedia(step);
  media.splice(photoIdx, 1);
  procEditPhotoApply(stepIdx);
  refreshProcedureEditPhotos(stepIdx);
}

function procEditPhotoPickFile(stepIdx, photoIdx) {
  syncProcedureEditTextsOnly();
  procEditPhotoPick = { stepIdx, photoIdx };
  $("procEditPhotoFileInput")?.click();
}

async function onProcEditPhotoFileChange(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file || !procedureEditDraft) return;
  const { stepIdx, photoIdx } = procEditPhotoPick;
  const step = procedureEditDraft.proc.steps[stepIdx];
  if (!step) return;
  try {
    const dataUrl = await readImageFileAsDataUrl(file);
    const media = ensureStepMedia(step);
    if (photoIdx >= 0 && media[photoIdx]) media[photoIdx].src = dataUrl;
    else media.push({ src: dataUrl, rotate: 0, scale: 1 });
    procEditPhotoApply(stepIdx);
    refreshProcedureEditPhotos(stepIdx);
    toast("Photo importée");
  } catch (e) {
    toast("Impossible de lire l'image");
  }
}

function renderProcedureEditSteps(proc) {
  const useVariants = !!(proc.tubeRef && proc.variants?.length);
  return (proc.steps || []).map((step, i) => {
    ensureStepMedia(step);
    const dimInputs = !useVariants ? (() => {
      const vars = new Set(Object.keys(step.dims || {}));
      extractDimVarsFromText(step.text).forEach((v) => vars.add(v));
      return [...vars].sort().map((dk) =>
        `<label class="proc-edit-dim-lbl"><span class="mono">{{${escHtml(dk)}}}</span>
          <input type="text" class="mono proc-edit-dim-inp" data-proc-dim-key="${escVal(dk)}" value="${escVal(stepDimDefault(step, dk))}"></label>`
      ).join("");
    })() : "";
    const last = (proc.steps || []).length - 1;
    return `<div class="proc-edit-step" data-step-i="${i}">
      <div class="proc-edit-step-head">
        <span class="tag mono">Étape ${i + 1}</span>
        <span class="grow"></span>
        <button type="button" class="btn-ghost" onclick="procedureEditMoveStep(${i},-1)"${i === 0 ? " disabled" : ""}>↑</button>
        <button type="button" class="btn-ghost" onclick="procedureEditMoveStep(${i},1)"${i === last ? " disabled" : ""}>↓</button>
        <button type="button" class="btn-ghost" onclick="procedureEditRemoveStep(${i})" title="Supprimer">✕</button>
      </div>
      <textarea class="proc-edit-step-text" rows="3" placeholder="Texte — {{L}}, {{diam}}, {{pac}}, {{comp.compresseur.ref}}…">${escHtml(step.text || "")}</textarea>
      ${dimInputs ? `<div class="proc-edit-dims-row">${dimInputs}</div>` : ""}
      <div class="proc-edit-photos">
        <span class="subhead" style="margin:10px 0 6px;border:none">Photos</span>
        <p class="hint" style="margin:0 0 8px">↺ ↻ pivoter · − + taille (25–300 %) · 🖼 remplacer · chemin modifiable</p>
        <div class="proc-edit-photos-body">${renderProcedureEditPhotosInner(step, i)}</div>
      </div>
    </div>`;
  }).join("");
}

function gatherProcedureVariantsFromForm(proc) {
  if (!proc.tubeRef) return;
  const rows = [...document.querySelectorAll("tr[data-var-i]")];
  if (!rows.length) return;
  proc.variants = rows.map((row) => {
    const refInp = row.querySelector(".proc-var-ref-inp")?.value.trim() || "";
    const ver = normalizeVariantVer(row.querySelector(".proc-var-ver-inp")?.value || refInp.split("-").pop() || "01");
    const stepDims = {};
    row.querySelectorAll(".proc-var-dim-inp").forEach((inp) => {
      const sk = inp.dataset.stepKey;
      const dk = inp.dataset.dimKey;
      const v = inp.value.trim();
      if (!sk || !dk || !v) return;
      if (!stepDims[sk]) stepDims[sk] = {};
      stepDims[sk][dk] = v;
    });
    return { ver, ref: refInp || `${proc.tubeRef}-${ver}`, stepDims };
  });
}

function procedureEditAddVariant() {
  gatherProcedureEditForm();
  const proc = procedureEditDraft?.proc;
  if (!proc?.tubeRef) return;
  const n = (proc.variants?.length || 0) + 1;
  const ver = String(n).padStart(2, "0");
  const base = proc.variants?.[0];
  proc.variants = proc.variants || [];
  proc.variants.push({
    ver,
    ref: `${proc.tubeRef}-${ver}`,
    stepDims: base?.stepDims ? JSON.parse(JSON.stringify(base.stepDims)) : {}
  });
  renderProcedureEditor();
}

function gatherProcedureEditForm() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  const titleInp = $("procEditTitleInp");
  const introInp = $("procEditIntroInp");
  const orderInp = $("procEditOrderInp");
  if (titleInp) proc.title = titleInp.value.trim() || proc.title;
  if (introInp) {
    const intro = introInp.value.trim();
    if (intro) proc.printIntro = intro;
    else delete proc.printIntro;
  }
  if (orderInp) proc.order = +orderInp.value || proc.order || 999;

  const stepEls = [...document.querySelectorAll(".proc-edit-step")];
  const prevSteps = proc.steps || [];
  proc.steps = stepEls.map((el, i) => {
    const text = el.querySelector(".proc-edit-step-text")?.value ?? "";
    const dims = {};
    el.querySelectorAll("[data-proc-dim-key]").forEach((inp) => {
      const k = inp.dataset.procDimKey;
      const v = inp.value.trim();
      if (v) dims[k] = v;
    });
    const step = { text };
    if (Object.keys(dims).length) step.dims = dims;
    const prev = prevSteps[i] || {};
    const media = [...ensureStepMedia(prev)];
    el.querySelectorAll(".proc-edit-photo-card").forEach((card, pi) => {
      if (!media[pi]) return;
      const pathInp = card.querySelector(".proc-edit-photo-path");
      if (pathInp) {
        const v = pathInp.value.trim();
        if (v) media[pi].src = v;
      }
    });
    applyMediaToStep(step, media);
    return step;
  });

  document.querySelectorAll("[data-dim-scope=default]").forEach((inp) => {
    const stepKey = inp.dataset.stepKey;
    const dimKey = inp.dataset.dimKey;
    const stepIndex = parseInt(stepKey.slice(1), 10) - 1;
    const v = inp.value.trim();
    if (!proc.steps[stepIndex]) return;
    if (!proc.steps[stepIndex].dims) proc.steps[stepIndex].dims = {};
    if (v) proc.steps[stepIndex].dims[dimKey] = v;
    else delete proc.steps[stepIndex].dims[dimKey];
    if (!Object.keys(proc.steps[stepIndex].dims).length) delete proc.steps[stepIndex].dims;
  });
  if ($("procFicheDocRef") && typeof gatherProcedureFicheFromForm === "function") gatherProcedureFicheFromForm(proc);
  gatherProcedureVariantsFromForm(proc);
}

function applyProcedureEditMachineDims() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  machinesInGamme(d.gammeCode).forEach((m, mi) => {
    document.querySelectorAll(`[data-dim-scope=machine][data-mi="${mi}"]`).forEach((inp) => {
      const stepKey = inp.dataset.stepKey;
      const dimKey = inp.dataset.dimKey;
      const stepIndex = parseInt(stepKey.slice(1), 10) - 1;
      const def = stepDimDefault(proc.steps[stepIndex], dimKey);
      setMachineProcDim(m, proc.id, stepKey, dimKey, inp.value.trim(), def);
    });
    cleanupMachineProcDims(m, proc.id);
  });
}

function renderProcedureEditor() {
  const d = procedureEditDraft;
  if (!d) return;
  const proc = d.proc;
  const gam = gammeByCode(d.gammeCode);
  ensureProcFiche(proc, gam);
  $("procedureEditHead").textContent = `Édition · ${proc.title}`;
  $("procedureEditBody").innerHTML = `<div class="proc-edit-form">
    <label class="subhead">Titre</label>
    <input type="text" id="procEditTitleInp" class="mono" value="${escVal(proc.title)}">
    <label class="subhead">Introduction (note mode opératoire §6)</label>
    <textarea id="procEditIntroInp" rows="2" placeholder="Affichée dans la note du §6 si mesures variables">${escHtml(proc.printIntro || "")}</textarea>
    <label class="subhead">Ordre d'affichage</label>
    <input type="number" id="procEditOrderInp" class="mono" style="max-width:96px" value="${proc.order ?? 999}">
    <div id="procFicheEditHost">${renderProcedureFicheEditor(proc, gam)}</div>
    <h4 class="subhead" style="margin-top:18px">Étapes &amp; texte</h4>
    <p class="hint">Variables de mesure : <span class="mono">{{L}}</span>, <span class="mono">{{diam}}</span>, <span class="mono">{{L1}}</span>… — renseignez les valeurs sous chaque étape ou dans le tableau.</p>
    <div id="procEditSteps">${renderProcedureEditSteps(proc)}</div>
    <button type="button" class="btn-soft" onclick="procedureEditAddStep()">+ Ajouter une étape</button>
    <button type="button" class="btn-ghost" onclick="procedureEditRefreshDimsTable()">↻ Actualiser le tableau variantes</button>
    <h4 class="subhead" style="margin-top:22px">Variantes &amp; cotes <span class="mono">${escVal(proc.tubeRef || "—")}</span></h4>
    <p class="hint">Une ligne = une variante (<span class="mono">${escVal(proc.tubeRef || "T?")}-01</span>, <span class="mono">-02</span>…). La machine choisit la version sur le schéma frigo.</p>
    <div id="procEditDims">${renderProcedureVariantsTableHtml(proc, { mode: "edit" })}</div>
    <input type="file" id="procEditPhotoFileInput" accept="image/*" hidden onchange="onProcEditPhotoFileChange(event)">
  </div>`;
}

function openProcedureEditor(gammeCode, procId) {
  if (!procedureEditAllowed()) {
    toast("Édition réservée aux administrateurs OEDIP");
    return;
  }
  const cat = getProcedureCatalog(gammeCode);
  const proc = cat?.procedures?.find((p) => p.id === procId);
  if (!proc) return;
  procedureEditDraft = { gammeCode: +gammeCode, procId, proc: JSON.parse(JSON.stringify(proc)) };
  (procedureEditDraft.proc.steps || []).forEach((s) => { s._media = normalizeStepMedia(s); });
  ensureProcFiche(procedureEditDraft.proc, gammeByCode(+gammeCode));
  renderProcedureEditor();
  $("modalProcedureEdit")?.classList.add("show");
}

function closeProcedureEditor() {
  $("modalProcedureEdit")?.classList.remove("show");
  procedureEditDraft = null;
}

function saveProcedureEditor() {
  if (!procedureEditDraft) return;
  if (!procedureEditAllowed()) {
    toast("Édition réservée aux administrateurs OEDIP");
    return;
  }
  gatherProcedureEditForm();
  const d = procedureEditDraft;
  const cat = getProcedureCatalog(d.gammeCode);
  const idx = cat?.procedures?.findIndex((p) => p.id === d.procId);
  if (idx < 0) return;
  cat.procedures[idx] = d.proc;
  closeProcedureEditor();
  renderProceduresTab();
  if (typeof sbPublishProcedureCatalogsFromState === "function" && sbCloudActive()) {
    sbPublishProcedureCatalogsFromState(d.gammeCode)
      .then(() => toast("Procédure publiée · visible pour tous les utilisateurs"))
      .catch((e) => {
        markDirty();
        toast("Enregistrée localement · publication cloud : " + (e.message || e));
      });
  } else {
    markDirty();
    toast("Procédure enregistrée localement — connectez-vous en admin pour publier");
  }
}

function procedureEditAddStep() {
  gatherProcedureEditForm();
  if (!procedureEditDraft) return;
  procedureEditDraft.proc.steps.push({ text: "", _media: [] });
  renderProcedureEditor();
}

function procedureEditRemoveStep(i) {
  if (!procedureEditDraft) return;
  if (!confirm("Supprimer cette étape ?")) return;
  gatherProcedureEditForm();
  procedureEditDraft.proc.steps.splice(i, 1);
  renderProcedureEditor();
}

function procedureEditMoveStep(i, dir) {
  if (!procedureEditDraft) return;
  gatherProcedureEditForm();
  const steps = procedureEditDraft.proc.steps;
  const j = i + dir;
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]];
  renderProcedureEditor();
}

function procedureEditRefreshDimsTable() {
  gatherProcedureEditForm();
  const el = $("procEditDims");
  if (el && procedureEditDraft) {
    el.innerHTML = renderProcedureVariantsTableHtml(procedureEditDraft.proc, { mode: "edit" });
  }
}

function findProceduresForTarget(gammeCode, target) {
  const cat = getProcedureCatalog(gammeCode);
  if (!cat?.procedures?.length || !target) return [];
  return cat.procedures.filter((pr) => {
    const t = pr.target || {};
    if (target.type === "pipe") return t.type === "pipe" && t.pipeId === target.pipeId;
    if (target.type === "role") return t.type === "role" && t.role === target.role;
    return false;
  });
}

function procedureSchemaBtn(pac, target) {
  const m = machineByPac(pac);
  const procs = findProceduresForTarget(m?.gammeCode, target);
  if (!procs.length) return "";
  const pacAttr = escAttr(pac);
  const typeAttr = escAttr(target.type);
  const idAttr = escAttr(target.pipeId || target.role || "");
  return `<button type="button" class="schema-proc-btn" title="Procédure (${procs.length})" onclick="openProcedureFromSchema('${pacAttr}','${typeAttr}','${idAttr}')">📋</button>`;
}

function openProcedureFromSchema(pac, type, id) {
  const target = type === "pipe" ? { type: "pipe", pipeId: id } : { type: "role", role: id };
  const m = machineByPac(pac);
  const procs = findProceduresForTarget(m?.gammeCode, target);
  if (!procs.length) {
    toast("Aucune procédure pour cet élément");
    return;
  }
  if (procs.length === 1) openProcedureViewer(procs[0].id, pac);
  else showProcedurePicker(procs, pac);
}

function showProcedurePicker(procs, pac) {
  const list = procs.map((p) =>
    `<button type="button" class="btn-soft proc-pick-btn" onclick="closeProcedurePicker();openProcedureViewer('${escAttr(p.id)}','${escAttr(pac)}')">${escHtml(p.title)}</button>`
  ).join("");
  const m = $("modalProcedurePicker");
  if (!m) {
    openProcedureViewer(procs[0].id, pac);
    return;
  }
  $("procedurePickerList").innerHTML = list;
  $("procedurePickerTitle").textContent = machineByPac(pac)?.pac || pac;
  m.classList.add("show");
}
function closeProcedurePicker() { $("modalProcedurePicker")?.classList.remove("show"); }

function openProcedureViewer(procedureId, pac) {
  const m = machineByPac(pac);
  const cat = getProcedureCatalog(m?.gammeCode);
  const proc = cat?.procedures?.find((p) => p.id === procedureId);
  if (!proc) return;
  const ctx = buildMachineProcContext(pac);
  $("procedureModalTitle").textContent = proc.title;
  $("procedureModalSub").textContent = (() => {
    const v = getMachineTubeVariantVer(m, proc.tubeRef);
    const ref = proc.tubeRef ? getProcedureVariant(proc, v)?.ref || `${proc.tubeRef}-${v}` : "";
    return `${ctx.pac} · ${ctx.gamme.nom}${ref ? ` · ${ref}` : ""}`;
  })();
  $("procedureModalBody").innerHTML = renderProcedureBodyHtml(proc, ctx);
  $("modalProcedure")?.classList.add("show");
}
function closeProcedureViewer() { $("modalProcedure")?.classList.remove("show"); }

function procedureStepImagesBlock(step) {
  const list = normalizeStepMedia(step);
  if (!list.length) return "";
  const figures = list.map((item) => {
    const innerStyle = procImgInnerStyle(item);
    const inner = innerStyle
      ? `<span class="proc-step-img-inner" style="${escVal(innerStyle)}"><img src="${escAttr(oedipMediaUrl(item.src))}" alt="" loading="lazy"></span>`
      : `<img src="${escAttr(oedipMediaUrl(item.src))}" alt="" loading="lazy">`;
    return `<figure class="proc-step-img">${inner}</figure>`;
  }).join("");
  const multi = list.length > 1 ? " proc-step-imgs-multi" : "";
  return `<div class="proc-step-imgs${multi}">${figures}</div>`;
}

function renderProcedureStepContent(step, text) {
  const imgs = procedureStepImagesBlock(step);
  const para = text ? `<p class="proc-step-text">${escHtml(text)}</p>` : "";
  return `${para}${imgs}`;
}

function renderProcedureStepHtml(step, ctx, proc, stepIndex) {
  const dims = proc != null && stepIndex != null ? mergedStepDims(proc, step, stepIndex, ctx) : {};
  const text = resolveProcedureText(step.text || "", ctx, dims);
  return `<li class="proc-step">${renderProcedureStepContent(step, text)}</li>`;
}

function renderProcedureBodyHtml(proc, ctx) {
  const steps = (proc.steps || []).map((s, i) => renderProcedureStepHtml(s, ctx, proc, i)).join("");
  return `<ol class="proc-steps">${steps || "<li>Aucune étape.</li>"}</ol>`;
}

function defaultGammeTableColumns(proc) {
  const t = proc.target || {};
  if (t.type === "pipe" && t.pipeId) {
    return [
      { key: "pac", label: "Machine" },
      { key: `pipe.${t.pipeId}.diamMm`, label: "Ø mm" },
      { key: `pipe.${t.pipeId}.longM`, label: "L m" }
    ];
  }
  if (t.type === "role" && t.role) {
    return [
      { key: "pac", label: "Machine" },
      { key: `comp.${t.role}.ref`, label: "Réf." },
      { key: `comp.${t.role}.modele`, label: "Modèle" }
    ];
  }
  return [{ key: "pac", label: "Machine" }];
}

function renderGammeTableHtml(proc, gammeCode) {
  const cols = (proc.gammeTable && proc.gammeTable.length)
    ? proc.gammeTable.map((c) => (typeof c === "string" ? { key: c, label: c } : c))
    : defaultGammeTableColumns(proc);
  const machines = machinesInGamme(gammeCode);
  if (!machines.length) return `<p class="hint">Aucune machine dans cette gamme.</p>`;
  const head = cols.map((c) => `<th>${escHtml(c.label || c.key)}</th>`).join("");
  const rows = machines.map((m) => {
    const ctx = buildMachineProcContext(m.pac);
    return `<tr>${cols.map((c) => `<td class="mono">${escHtml(procPathValue(ctx, c.key))}</td>`).join("")}</tr>`;
  }).join("");
  return `<table class="proc-gamme-tbl"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function printGammeProcedures() {
  const sel = $("procGamme");
  const code = sel?.value != null ? +sel.value : NaN;
  if (!Number.isFinite(code)) {
    alert("Sélectionnez une gamme.");
    return;
  }
  const w = window.open("", "_blank");
  if (!w) {
    alert("Autorisez les fenêtres popup pour imprimer.");
    return;
  }
  w.document.write(buildGammePrintDocument(code));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function procedureAllMedia(proc) {
  const out = [];
  (proc.steps || []).forEach((s) => ensureStepMedia(s).forEach((m) => { if (m.src) out.push(m); }));
  return out;
}

function procedureCoverMedia(proc) {
  const all = procedureAllMedia(proc);
  return all.length ? all[all.length - 1] : null;
}

function procedureRefPattern(proc) {
  if (proc.tubeRef) return `${proc.tubeRef}-xx`;
  const id = proc.id || "";
  if (id.startsWith("geo-annex-")) return id.replace("geo-annex-", "ANN-").toUpperCase();
  if (id.startsWith("geo-")) return id.replace("geo-", "").toUpperCase();
  return id.toUpperCase() || "—";
}

function procedureShortName(proc) {
  const t = proc.title || "";
  return t.replace(/^Tube \d+ — /, "").trim() || t || "—";
}

function renderProcedureCoverHtml(proc) {
  const cover = procedureCoverMedia(proc);
  if (!cover?.src) {
    return `<div class="proc-gallery-ph"><span>${proc.tubeNum ? `T${proc.tubeNum}` : "📋"}</span></div>`;
  }
  const innerStyle = procImgInnerStyle(cover);
  const inner = innerStyle
    ? `<span class="proc-gallery-img-inner" style="${escVal(innerStyle)}"><img src="${escVal(oedipMediaUrl(cover.src))}" alt=""></span>`
    : `<img src="${escVal(oedipMediaUrl(cover.src))}" alt="">`;
  return inner;
}

function fillProcGammeSelect() {
  const sel = $("procGamme");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = state.gammes.map((g) =>
    `<option value="${g.code}">${escHtml(g.nom)} (code ${g.code})</option>`
  ).join("");
  if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  else {
    const withProc = state.procedureCatalogs.find((c) => procedureCatalogImageStepCount(c) > 0);
    if (withProc && [...sel.options].some((o) => o.value === String(withProc.gammeCode))) sel.value = String(withProc.gammeCode);
    else if (state.gammes[0]) sel.value = state.gammes[0].code;
  }
}

function renderProceduresTab() {
  fillProcGammeSelect();
  const list = $("procList");
  if (!list) return;
  const code = +($("procGamme")?.value || state.gammes[0]?.code);
  const gam = gammeByCode(code);
  const cat = getProcedureCatalog(code);
  const procs = (cat?.procedures || []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const machines = machinesInGamme(code);
  if (!procs.length) {
    list.innerHTML = `<div class="empty">Aucune procédure pour <b>${escHtml(gam?.nom || "cette gamme")}</b>. Ajoutez-les dans le catalogue (<span class="mono">procedureCatalogs</span> du projet).</div>`;
    return;
  }
  const previewPac = machines[0]?.pac;
  const pacAttr = previewPac ? escAttr(previewPac) : "";
  const canEdit = procedureEditAllowed();
  list.innerHTML = `<div class="proc-gallery">${procs.map((p) => {
    const idAttr = escAttr(p.id);
    const onPreview = previewPac
      ? `onclick="openProcedureViewer('${idAttr}','${pacAttr}')"`
      : canEdit
        ? `onclick="openProcedureEditor(${code},'${idAttr}')" title="Aucune machine — ouverture en édition"`
        : "";
    return `<article class="proc-gallery-card" ${onPreview}>
      <div class="proc-gallery-cover">${renderProcedureCoverHtml(p)}
        <div class="proc-gallery-actions noprint" onclick="event.stopPropagation()">
          ${canEdit ? `<button type="button" class="btn-heat" onclick="openProcedureEditor(${code},'${idAttr}')">Édition</button>` : ""}
          <button type="button" class="btn-soft" onclick="printSingleProcedure(${code},'${idAttr}')">🖶</button>
          ${previewPac ? `<button type="button" class="btn-soft" onclick="openProcedureViewer('${idAttr}','${pacAttr}')">Aperçu</button>` : ""}
        </div>
      </div>
      <div class="proc-gallery-meta">
        <h3 class="proc-gallery-ref mono">${escHtml(procedureRefPattern(p))}</h3>
        <p class="proc-gallery-name">${escHtml(procedureShortName(p))}</p>
      </div>
    </article>`;
  }).join("")}</div>`;
}

function initProceduresTab() {
  ensureProcedureCatalogPhotos();
  state.procedureCatalogs.forEach(migrateProcedureCatalogVariants);
  updateProcedureAdminUI();
  renderProceduresTab();
}

function editFrigoTubeVariant(pac, tubeRef, ver) {
  const m = machineByPac(pac);
  if (!m || !tubeRef) return;
  ensureFrigoTubeVariants(m)[tubeRef] = normalizeVariantVer(ver);
  markDirty();
  if (MOPEN && MOPEN.pac === pac && MOPEN.tab === "composants-frigo") renderMachineModal();
}

function renderFrigoTubeVariantsTable(pac) {
  const m = machineByPac(pac);
  if (!m) return "";
  const procs = tubeProceduresForGamme(m.gammeCode);
  if (!procs.length) return "";
  ensureFrigoTubeVariants(m);
  const pacAttr = escAttr(pac);
  const rows = procs.map((p) => {
    const cur = getMachineTubeVariantVer(m, p.tubeRef);
    const opts = (p.variants?.length ? p.variants : [{ ver: "01", ref: `${p.tubeRef}-01` }]).map((v) => {
      const ver = normalizeVariantVer(v.ver);
      const ref = v.ref || `${p.tubeRef}-${ver}`;
      return `<option value="${escVal(ver)}"${ver === cur ? " selected" : ""}>${escHtml(ref)}</option>`;
    }).join("");
    return `<tr>
      <td class="mono">${escHtml(p.tubeRef)}</td>
      <td>${escHtml(p.title.replace(/^Tube \d+ — /, ""))}</td>
      <td><select class="mono schema-tube-var-sel" onchange="editFrigoTubeVariant('${pacAttr}','${escAttr(p.tubeRef)}',this.value)">${opts}</select></td>
      <td class="schema-pipe-proc"><button type="button" class="schema-proc-btn" title="Procédure" onclick="openProcedureViewer('${escAttr(p.id)}','${pacAttr}')">📋</button></td>
    </tr>`;
  }).join("");
  return `<div class="schema-pipes-wrap schema-tube-vars-wrap">
    <div class="schema-pipes-head">Versions tubes atelier</div>
    <table class="schema-pipes-tbl proc-variants-tbl">
      <thead><tr><th>Réf.</th><th>Tronçon</th><th>Version machine</th><th>Proc.</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

$("modalProcedure")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedure") closeProcedureViewer(); });
$("modalProcedurePicker")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedurePicker") closeProcedurePicker(); });
$("modalProcedureEdit")?.addEventListener("click", (e) => { if (e.target.id === "modalProcedureEdit") closeProcedureEditor(); });
