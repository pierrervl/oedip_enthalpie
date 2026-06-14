/* OEDIP — outils installation : PDC linéaire, circulateurs, volume tuyauterie, vase d'expansion */

let INSTALL_TOOL = "pdc";
let _instCircChartMeta = null;

const WATER_RHO_TABLE = [
  [0, 999.8], [10, 999.7], [20, 998.2], [30, 995.7], [40, 992.2],
  [50, 988.0], [60, 983.2], [65, 980.45], [70, 977.8], [80, 971.8], [90, 965.3], [100, 958.4]
];

const WATER_NU_TABLE = [
  [0, 1.792e-6], [10, 1.306e-6], [20, 1.004e-6], [30, 8.02e-7], [40, 6.58e-7],
  [50, 5.54e-7], [60, 4.75e-7], [70, 4.13e-7], [80, 3.65e-7], [90, 3.27e-7], [100, 2.94e-7]
];

function tableInterp(table, tempC) {
  const t = Math.max(table[0][0], Math.min(table[table.length - 1][0], +tempC));
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, v0] = table[i];
    const [t1, v1] = table[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return v0 + k * (v1 - v0);
    }
  }
  return table[table.length - 1][1];
}

function waterDensityKgM3(tempC) {
  return tableInterp(WATER_RHO_TABLE, tempC);
}

function waterKinematicViscosityM2s(tempC) {
  return tableInterp(WATER_NU_TABLE, tempC);
}

/** Viscosité cinématique eau + glycol (corrélation calibrée sur feuille PDC linéaires). */
function glycolMixKinematicViscosityM2s(tempC, glycolPct) {
  const nuW = waterKinematicViscosityM2s(tempC);
  const x = Math.max(0, Math.min(100, +glycolPct || 0)) / 100;
  if (x <= 0) return nuW;
  const factor = 1 + x * 4.82 * Math.exp(-0.018 * Math.max(0, tempC));
  return nuW * factor;
}

function defaultProjetInstallation() {
  return {
    tool: "pdc",
    pdc: { debitM3h: 2.8, glycolPct: 33, tempC: 0, lengthM: 40, diamMm: 34 },
    volume: {
      segments: [
        { label: "Aller", lengthM: 40, diamMm: 34 },
        { label: "Retour", lengthM: 40, diamMm: 34 }
      ]
    },
    vase: { temp1: 0, temp2: 65, volumeL: 440, hStatic: 6, pSoupape: 3 },
    glycol: { volumeTotalL: 440, volumeExtraL: 400, targetPct: 33, productPct: 100, tMinC: -10 },
    circ: { debitM3h: 2.8, hmtM: 5, useHydro: false, pdcExtraM: 0 }
  };
}

function ensureProjetInstallation(p) {
  if (!p) return defaultProjetInstallation();
  const d = defaultProjetInstallation();
  if (!p.installation || typeof p.installation !== "object") p.installation = d;
  const ins = p.installation;
  ins.pdc = { ...d.pdc, ...(ins.pdc || {}) };
  ins.vase = { ...d.vase, ...(ins.vase || {}) };
  ins.glycol = { ...d.glycol, ...(ins.glycol || {}) };
  ins.circ = { ...d.circ, ...(ins.circ || {}) };
  if (!Array.isArray(ins.volume?.segments) || !ins.volume.segments.length) {
    ins.volume = { segments: d.volume.segments.map((s) => ({ ...s })) };
  }
  if (!ins.tool) ins.tool = d.tool;
  return ins;
}

function installState() {
  return ensureProjetInstallation(typeof projet !== "undefined" ? projet : null);
}

function calcLinearPdc({ debitM3h, glycolPct, tempC, lengthM, diamMm }) {
  const q = Math.max(0, +debitM3h || 0);
  const L = Math.max(0, +lengthM || 0);
  const D = Math.max(0.001, (+diamMm || 0) / 1000);
  const area = Math.PI * (D / 2) ** 2;
  const qM3s = q / 3600;
  const velocity = area > 0 ? qM3s / area : 0;
  const nu = glycolMixKinematicViscosityM2s(tempC, glycolPct);
  const re = nu > 0 ? (velocity * D) / nu : 0;
  let lambda = null;
  if (re >= 4000 && re <= 1e5) lambda = 0.316 * re ** -0.25;
  else if (re > 0 && re < 2300) lambda = 64 / re;
  else if (re >= 2300) lambda = 0.316 * re ** -0.25;
  const g = 9.80665;
  const headM = lambda != null && D > 0 ? lambda * (L / D) * (velocity ** 2) / (2 * g) : null;
  return { velocity, nu, re, lambda, headM, pdcKpa: headM != null ? headM * 9.80665 : null };
}

function calcPipeVolumeLiters(segments) {
  let total = 0;
  const rows = (segments || []).map((s) => {
    const L = Math.max(0, +s.lengthM || 0);
    const D = Math.max(0, +s.diamMm || 0) / 1000;
    const volL = Math.PI * (D / 2) ** 2 * L * 1000;
    total += volL;
    return { ...s, volL };
  });
  return { rows, totalL: total };
}

/** Dosage glycol — remplissage à vide : % vol. cible sur volume total installation. */
function calcGlycolDose({ volumeTotalL, targetPct, productPct }) {
  const v = Math.max(0, +volumeTotalL || 0);
  const target = Math.max(0, Math.min(100, +targetPct || 0));
  const prod = Math.max(1, Math.min(100, +productPct || 100));
  const pureGlycolL = v * target / 100;
  const waterL = v - pureGlycolL;
  const productL = (v * target) / prod;
  const waterAddL = Math.max(0, v - productL);
  return { volumeTotalL: v, targetPct: target, productPct: prod, pureGlycolL, waterL, productL, waterAddL };
}

function installVolumeTotalLiters(ins) {
  const pipeL = calcPipeVolumeLiters(ins.volume?.segments).totalL;
  const extraL = Math.max(0, +ins.glycol?.volumeExtraL || 0);
  return pipeL + extraL;
}

function glycolProtectionHint(tMinC) {
  const t = +tMinC;
  if (isNaN(t)) return "";
  if (t >= -5) return "Eau ou faible concentration souvent suffisante (≥ −5 °C).";
  if (t >= -10) return "Indicatif propylène glycol : environ 22 à 28 % vol.";
  if (t >= -15) return "Indicatif propylène glycol : environ 28 à 33 % vol.";
  if (t >= -20) return "Indicatif propylène glycol : environ 33 à 40 % vol.";
  return "Indicatif propylène glycol : vérifier la courbe fabricant (≤ −20 °C).";
}

function calcExpansionVessel({ temp1, temp2, volumeL, hStatic, pSoupape }) {
  const rho1 = waterDensityKgM3(temp1);
  const rho2 = waterDensityKgM3(temp2);
  const coeffPct = rho2 > 0 ? (rho1 / rho2 - 1) * 100 : 0;
  const vSys = Math.max(0, +volumeL || 0);
  const volDilat = vSys * coeffPct / 100;
  const volReserve = vSys * 0.005;
  const h = Math.max(0, +hStatic || 0);
  const pValve = Math.max(0.5, +pSoupape || 0);
  const pGonflage = Math.max(0.5, Math.max(1, h / 10));
  const effetUtile = Math.max(0.01, 1 - (pGonflage + 1) / (pValve + 1));
  const besoinL = (volDilat + volReserve) / effetUtile;
  return { rho1, rho2, coeffPct, volDilat, volReserve, pGonflage, effetUtile, besoinL };
}

function rankCirculateursForInstall(debitM3h, hmtM) {
  const q = +debitM3h || 0;
  const hReq = +hmtM || 0;
  if (!q || !hReq) return [];
  const pumps = typeof circulateursWithCurve === "function" ? circulateursWithCurve() : [];
  return pumps
    .map((p) => {
      const hDisp = typeof circInterpHmt === "function" ? circInterpHmt(p, q) : p.hmtM;
      const margin = hDisp != null ? hDisp - hReq : null;
      return {
        ref: p.ref || p.modele || "—",
        fabricant: p.fabricant || "",
        hDisp,
        margin,
        ok: hDisp != null && hDisp >= hReq,
        item: p
      };
    })
    .filter((r) => r.hDisp != null)
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return (b.margin ?? -999) - (a.margin ?? -999);
    });
}

function instNumInput(id, val, step, min, onchange) {
  return `<input type="number" id="${id}" class="inst-inp" value="${val}" step="${step}"${min != null ? ` min="${min}"` : ""} oninput="${onchange}">`;
}

function instResultRow(label, value, unit, highlight) {
  return `<tr class="${highlight ? "inst-row-result" : "inst-row-calc"}"><td>${label}</td><td class="mono${highlight ? " inst-val-main" : ""}">${value}</td><td>${unit || ""}</td></tr>`;
}

function renderInstallPdcPanel(ins) {
  const p = ins.pdc;
  const r = calcLinearPdc(p);
  return `<div class="inst-panel">
    <p class="hint">Pertes de charge linéaires — tuyauterie lisse (Blasius, Re 4 000–100 000).</p>
    <table class="inst-calc-tbl">
      <tbody>
        <tr class="inst-row-in"><td>Débit volumique</td><td>${instNumInput("instPdcQ", p.debitM3h, "0.1", 0, "onInstallField()")}</td><td>m³/h</td></tr>
        <tr class="inst-row-in"><td>Taux de glycol</td><td>${instNumInput("instPdcGly", p.glycolPct, "1", 0, "onInstallField()")}</td><td>%</td></tr>
        <tr class="inst-row-in"><td>Température moyenne</td><td>${instNumInput("instPdcT", p.tempC, "1", -20, "onInstallField()")}</td><td>°C</td></tr>
        <tr><td colspan="3" class="inst-section">Tuyauterie lisse</td></tr>
        <tr class="inst-row-in"><td>Longueur de la conduite</td><td>${instNumInput("instPdcL", p.lengthM, "0.5", 0, "onInstallField()")}</td><td>m</td></tr>
        <tr class="inst-row-in"><td>Diamètre de la conduite</td><td>${instNumInput("instPdcD", p.diamMm, "1", 1, "onInstallField()")}</td><td>mm</td></tr>
        ${instResultRow("Vitesse dans la conduite", fmt(r.velocity, 2), "m/s")}
        ${instResultRow("Viscosité cinématique", r.nu ? r.nu.toExponential(2) : "—", "m²/s")}
        ${instResultRow("Nbr de Reynolds", r.re ? fmt(r.re, 0) : "—", "")}
        ${instResultRow("Rugosité relative", "—", "")}
        ${instResultRow("Coef pertes de charge linéaire", r.lambda != null ? fmt(r.lambda, 3) : "—", "Blasius")}
        ${instResultRow("Pertes de charges linéaires", r.headM != null ? fmt(r.headM, 2) : "—", "mCE", true)}
      </tbody>
    </table>
    <div class="inst-actions">
      <button type="button" class="btn-soft" onclick="applyPdcToCirc()">→ Transférer HMT au choix circulateur</button>
      ${typeof LAST !== "undefined" && LAST?.hydro?.active ? `<button type="button" class="btn-ghost" onclick="prefillInstallFromHydro()">Préremplir depuis le projet</button>` : ""}
    </div>
  </div>`;
}

function renderInstallVolumePanel(ins) {
  const segs = ins.volume.segments;
  const { rows, totalL } = calcPipeVolumeLiters(segs);
  const body = rows.map((s, i) => `
    <tr>
      <td><input type="text" class="inst-inp" value="${escHtml(s.label || "")}" placeholder="Tronçon ${i + 1}" oninput="onInstallVolumeRow(${i}, 'label', this.value)"></td>
      <td><input type="number" class="inst-inp" value="${s.lengthM ?? ""}" step="0.5" min="0" oninput="onInstallVolumeRow(${i}, 'lengthM', this.value)"></td>
      <td><input type="number" class="inst-inp" value="${s.diamMm ?? ""}" step="1" min="1" oninput="onInstallVolumeRow(${i}, 'diamMm', this.value)"></td>
      <td class="mono">${fmt(s.volL, 2)}</td>
      <td><button type="button" class="btn-ghost inst-rm" onclick="removeInstallVolumeRow(${i})" title="Supprimer">✕</button></td>
    </tr>`).join("");
  return `<div class="inst-panel">
    <p class="hint">Volume d'eau dans la tuyauterie : V = π × (D/2)² × L — somme des tronçons (aller, retour, boucles…).</p>
    <table class="inst-vol-tbl">
      <thead><tr><th>Désignation</th><th>Longueur (m)</th><th>Diamètre (mm)</th><th>Volume (L)</th><th></th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td colspan="3"><b>Volume total tuyauterie</b></td><td class="mono inst-val-main">${fmt(totalL, 2)} L</td><td></td></tr></tfoot>
    </table>
    <div class="inst-actions">
      <button type="button" class="btn-soft" onclick="addInstallVolumeRow()">+ Tronçon</button>
      <button type="button" class="btn-ghost" onclick="applyVolumeToGlycol()">→ Reprendre volume tuyauterie pour le glycol</button>
      <button type="button" class="btn-ghost" onclick="applyVolumeToVase()">→ Reprendre volume total pour le vase</button>
    </div>
  </div>`;
}

function renderInstallGlycolPanel(ins) {
  const g = ins.glycol;
  const pipeL = calcPipeVolumeLiters(ins.volume.segments).totalL;
  const totalL = Math.max(0, +g.volumeTotalL || 0) || installVolumeTotalLiters(ins);
  const r = calcGlycolDose({ volumeTotalL: totalL, targetPct: g.targetPct, productPct: g.productPct });
  const hint = glycolProtectionHint(g.tMinC);
  return `<div class="inst-panel">
    <p class="hint">Calcul du taux de glycol en fonction du volume d'installation — remplissage à vide (% vol.). Volume total = tuyauterie + appoint (émetteurs, buffer, échangeurs…).</p>
    <table class="inst-calc-tbl">
      <tbody>
        <tr class="inst-row-calc"><td>Volume tuyauterie (calculé)</td><td class="mono">${fmt(pipeL, 1)}</td><td>L</td></tr>
        <tr class="inst-row-in"><td>Volume appoint</td><td>${instNumInput("instGlyExtra", g.volumeExtraL, "1", 0, "onInstallField()")}</td><td>L · émetteurs, buffer, PAC…</td></tr>
        <tr class="inst-row-in"><td>Volume total installation</td><td>${instNumInput("instGlyVol", totalL, "1", 0, "onInstallField()")}</td><td>L</td></tr>
        <tr class="inst-row-in"><td>Taux de glycol cible</td><td>${instNumInput("instGlyPct", g.targetPct, "1", 0, "onInstallField()")}</td><td>% vol.</td></tr>
        <tr class="inst-row-in"><td>Concentration produit</td><td>${instNumInput("instGlyProd", g.productPct, "1", 1, "onInstallField()")}</td><td>% vol. · 100 = glycol pur</td></tr>
        <tr class="inst-row-in"><td>Température protection min.</td><td>${instNumInput("instGlyTmin", g.tMinC, "1", -40, "onInstallField()")}</td><td>°C</td></tr>
        ${hint ? `<tr><td colspan="3" class="hint" style="padding:8px 10px;font-size:12px">${hint}</td></tr>` : ""}
        ${instResultRow("Volume glycol pur", fmt(r.pureGlycolL, 1), "L", true)}
        ${instResultRow("Volume eau", fmt(r.waterL, 1), "L")}
        ${instResultRow("Produit commercial à verser", fmt(r.productL, 1), "L", true)}
        ${instResultRow("Eau à compléter", fmt(r.waterAddL, 1), "L")}
        ${instResultRow("Taux obtenu", fmt(r.targetPct, 1), "% vol.")}
      </tbody>
    </table>
    <div class="inst-actions">
      <button type="button" class="btn-soft" onclick="syncInstallVolumeToGlycol()">↺ Recalculer depuis tuyauterie + appoint</button>
      <button type="button" class="btn-ghost" onclick="applyGlycolToPdc()">→ Reprendre le taux pour PDC linéaires</button>
      <button type="button" class="btn-ghost" onclick="applyGlycolVolumeToVase()">→ Reprendre volume total pour le vase</button>
    </div>
  </div>`;
}

function renderInstallVasePanel(ins) {
  const v = ins.vase;
  const r = calcExpansionVessel(v);
  return `<div class="inst-panel">
    <p class="hint">Dimensionnement vase d'expansion — eau (masse volumique 0–100 °C) · réserve 0,5 % · effet utile selon pressions de gonflage et tarage soupape.</p>
    <table class="inst-calc-tbl">
      <tbody>
        <tr class="inst-row-in"><td>Température 1</td><td>${instNumInput("instVaseT1", v.temp1, "1", 0, "onInstallField()")}</td><td>°C · ρ = ${fmt(r.rho1, 2)} kg/m³</td></tr>
        <tr class="inst-row-in"><td>Température 2</td><td>${instNumInput("instVaseT2", v.temp2, "1", 0, "onInstallField()")}</td><td>°C · ρ = ${fmt(r.rho2, 2)} kg/m³</td></tr>
        ${instResultRow("Coeff. de dilatation", fmt(r.coeffPct, 2), "%")}
        <tr class="inst-row-in"><td>Volume du système</td><td>${instNumInput("instVaseVol", v.volumeL, "1", 0, "onInstallField()")}</td><td>L</td></tr>
        ${instResultRow("Volume de dilatation", fmt(r.volDilat, 2), "L", true)}
        ${instResultRow("Volume de réserve", fmt(r.volReserve, 2), "L", true)}
        <tr class="inst-row-in"><td>Hauteur statique</td><td>${instNumInput("instVaseH", v.hStatic, "0.5", 0, "onInstallField()")}</td><td>m</td></tr>
        <tr class="inst-row-in"><td>Tarage soupape</td><td>${instNumInput("instVaseP", v.pSoupape, "0.1", 0.5, "onInstallField()")}</td><td>bar</td></tr>
        ${instResultRow("Pression de gonflage", fmt(r.pGonflage, 1), "bar")}
        ${instResultRow("Effet utile", fmt(r.effetUtile, 2), "")}
        ${instResultRow("Besoin vase d'expansion", fmt(r.besoinL, 1), "L", true)}
      </tbody>
    </table>
  </div>`;
}

function renderInstallCircPanel(ins) {
  const c = ins.circ;
  const pdc = calcLinearPdc(ins.pdc);
  const pdcHead = pdc.headM ?? 0;
  const extra = +c.pdcExtraM || 0;
  const hmtFromPdc = pdcHead + extra;
  const hReq = c.useHydro && typeof LAST !== "undefined" && LAST?.hydro?.active
    ? LAST.hydro.hmtM
    : (+c.hmtM || 0);
  const qReq = c.useHydro && LAST?.hydro?.active
    ? LAST.hydro.debitM3h
    : (+c.debitM3h || 0);
  const ranked = rankCirculateursForInstall(qReq, hReq);
  const okList = ranked.filter((r) => r.ok);
  const listHtml = ranked.length
    ? `<table class="inst-circ-rank"><thead><tr><th>Circulateur</th><th>HMT @ Q</th><th>Marge</th><th></th></tr></thead><tbody>${
        ranked.slice(0, 12).map((r) => `<tr class="${r.ok ? "inst-circ-ok" : "inst-circ-ko"}">
          <td><b>${escHtml(r.ref)}</b>${r.fabricant ? `<span class="hint"> · ${escHtml(r.fabricant)}</span>` : ""}</td>
          <td class="mono">${fmt(r.hDisp, 2)} m @ ${fmt(qReq, 2)} m³/h</td>
          <td class="mono">${r.margin != null ? (r.margin >= 0 ? "+" : "") + fmt(r.margin, 2) + " m" : "—"}</td>
          <td>${r.ok ? '<span class="tag">OK</span>' : ""}</td>
        </tr>`).join("")
      }</tbody></table>`
    : `<p class="hint circ-curves-empty">Aucun circulateur avec courbe HMT dans le catalogue — renseignez des fiches (onglet Composants) ou importez le pack Wilo.</p>`;
  return `<div class="inst-panel">
    <p class="hint">Comparaison des circulateurs du catalogue à un point de fonctionnement (débit + HMT requis).</p>
    <div class="row inst-circ-fields">
      <div><label class="subhead">Débit</label>${instNumInput("instCircQ", c.useHydro && LAST?.hydro?.active ? LAST.hydro.debitM3h : c.debitM3h, "0.1", 0, "onInstallField()")} <span class="unit">m³/h</span></div>
      <div><label class="subhead">HMT requis</label>${instNumInput("instCircH", c.useHydro && LAST?.hydro?.active ? LAST.hydro.hmtM : c.hmtM, "0.1", 0, "onInstallField()")} <span class="unit">mCE</span></div>
      <div><label class="subhead">PDC complémentaire</label>${instNumInput("instCircExtra", c.pdcExtraM, "0.1", 0, "onInstallField()")} <span class="unit">mCE</span></div>
    </div>
    <label class="inst-check"><input type="checkbox" id="instCircHydro" ${c.useHydro ? "checked" : ""} onchange="onInstallField()"> Utiliser l'estimation hydraulique du projet (onglet Saisie)</label>
    <p class="hint">PDC linéaire actuelle : <b>${fmt(pdcHead, 2)} mCE</b>${extra ? ` + ${fmt(extra, 2)} m compl. = <b>${fmt(hmtFromPdc, 2)} mCE</b>` : ""}</p>
    <p class="inst-circ-summary">${okList.length ? `<span class="hydro-circ-ok">${okList.length} circulateur(s) adapté(s)</span>` : ranked.length ? `<span class="hydro-circ-ko">Aucun circulateur ne couvre le point</span>` : ""}</p>
    <div class="circ-curves-panel" style="margin:14px 0">
      <div class="circ-chart-wrap" id="instCircChartWrap"><div class="circ-chart-tooltip" id="instCircChartTooltip" hidden></div><svg id="instCircChartSvg" role="img" aria-label="Courbes HMT circulateurs"></svg></div>
      <div class="circ-legend" id="instCircChartLegend"></div>
    </div>
    ${listHtml}
  </div>`;
}

function readInstallForm() {
  const ins = installState();
  const g = (id) => $(id);
  if (g("instPdcQ")) {
    ins.pdc.debitM3h = +(g("instPdcQ").value || 0);
    ins.pdc.glycolPct = +(g("instPdcGly").value || 0);
    ins.pdc.tempC = +(g("instPdcT").value || 0);
    ins.pdc.lengthM = +(g("instPdcL").value || 0);
    ins.pdc.diamMm = +(g("instPdcD").value || 0);
  }
  if (g("instVaseT1")) {
    ins.vase.temp1 = +(g("instVaseT1").value || 0);
    ins.vase.temp2 = +(g("instVaseT2").value || 0);
    ins.vase.volumeL = +(g("instVaseVol").value || 0);
    ins.vase.hStatic = +(g("instVaseH").value || 0);
    ins.vase.pSoupape = +(g("instVaseP").value || 0);
  }
  if (g("instGlyVol")) {
    ins.glycol.volumeExtraL = +(g("instGlyExtra")?.value || 0);
    ins.glycol.volumeTotalL = +(g("instGlyVol").value || 0);
    ins.glycol.targetPct = +(g("instGlyPct")?.value || 0);
    ins.glycol.productPct = +(g("instGlyProd")?.value || 100);
    ins.glycol.tMinC = +(g("instGlyTmin")?.value || 0);
  }
  if (g("instCircQ")) {
    ins.circ.useHydro = !!g("instCircHydro")?.checked;
    if (!ins.circ.useHydro) {
      ins.circ.debitM3h = +(g("instCircQ").value || 0);
      ins.circ.hmtM = +(g("instCircH").value || 0);
    }
    ins.circ.pdcExtraM = +(g("instCircExtra")?.value || 0);
  }
  ins.tool = INSTALL_TOOL;
}

function onInstallField() {
  readInstallForm();
  renderInstallationTab(false);
}

function setInstallTool(t) {
  readInstallForm();
  INSTALL_TOOL = t;
  installState().tool = t;
  renderInstallationTab(false);
}

function onInstallVolumeRow(idx, key, val) {
  const ins = installState();
  const row = ins.volume.segments[idx];
  if (!row) return;
  row[key] = key === "label" ? val : +val;
  renderInstallationTab(false);
}

function addInstallVolumeRow() {
  readInstallForm();
  installState().volume.segments.push({ label: "", lengthM: 10, diamMm: 28 });
  renderInstallationTab(false);
}

function removeInstallVolumeRow(idx) {
  readInstallForm();
  const segs = installState().volume.segments;
  if (segs.length <= 1) return;
  segs.splice(idx, 1);
  renderInstallationTab(false);
}

function applyPdcToCirc() {
  readInstallForm();
  const ins = installState();
  const r = calcLinearPdc(ins.pdc);
  ins.circ.debitM3h = ins.pdc.debitM3h;
  ins.circ.hmtM = +(r.headM || 0) + (ins.circ.pdcExtraM || 0);
  ins.circ.useHydro = false;
  INSTALL_TOOL = "circ";
  ins.tool = "circ";
  toast(`HMT ${fmt(r.headM, 2)} mCE → choix circulateur`);
  renderInstallationTab(false);
}

function applyVolumeToVase() {
  readInstallForm();
  const { totalL } = calcPipeVolumeLiters(installState().volume.segments);
  installState().vase.volumeL = Math.round(totalL * 10) / 10;
  INSTALL_TOOL = "vase";
  installState().tool = "vase";
  toast(`Volume système ${fmt(totalL, 1)} L → vase d'expansion`);
  renderInstallationTab(false);
}

function syncInstallVolumeToGlycol() {
  readInstallForm();
  const ins = installState();
  ins.glycol.volumeTotalL = Math.round(installVolumeTotalLiters(ins) * 10) / 10;
  toast(`Volume installation ${fmt(ins.glycol.volumeTotalL, 1)} L`);
  renderInstallationTab(false);
}

function applyVolumeToGlycol() {
  readInstallForm();
  const ins = installState();
  const pipeL = calcPipeVolumeLiters(ins.volume.segments).totalL;
  ins.glycol.volumeTotalL = Math.round((pipeL + (+ins.glycol.volumeExtraL || 0)) * 10) / 10;
  INSTALL_TOOL = "glycol";
  ins.tool = "glycol";
  toast(`Volume tuyauterie ${fmt(pipeL, 1)} L → dosage glycol`);
  renderInstallationTab(false);
}

function applyGlycolToPdc() {
  readInstallForm();
  const ins = installState();
  ins.pdc.glycolPct = +ins.glycol.targetPct || 0;
  INSTALL_TOOL = "pdc";
  ins.tool = "pdc";
  toast(`Taux glycol ${fmt(ins.pdc.glycolPct, 1)} % → PDC linéaires`);
  renderInstallationTab(false);
}

function applyGlycolVolumeToVase() {
  readInstallForm();
  const ins = installState();
  const totalL = Math.max(0, +ins.glycol.volumeTotalL || 0) || installVolumeTotalLiters(ins);
  ins.vase.volumeL = Math.round(totalL * 10) / 10;
  INSTALL_TOOL = "vase";
  ins.tool = "vase";
  toast(`Volume ${fmt(totalL, 1)} L → vase d'expansion`);
  renderInstallationTab(false);
}

function prefillInstallFromHydro() {
  const h = typeof LAST !== "undefined" ? LAST?.hydro : null;
  if (!h?.active) {
    toast("Estimation hydraulique inactive — onglet Saisie projet");
    return;
  }
  readInstallForm();
  const ins = installState();
  ins.pdc.debitM3h = h.debitM3h;
  ins.circ.debitM3h = h.debitM3h;
  ins.circ.hmtM = h.hmtM;
  toast(`Projet : ${fmt(h.debitM3h, 2)} m³/h · HMT ${fmt(h.hmtM, 2)} m`);
  renderInstallationTab(false);
}

function drawInstallCircChart() {
  const wrap = $("instCircChartWrap");
  const svg = $("instCircChartSvg");
  if (!wrap || !svg) return;
  const pumps = typeof circulateursWithCurve === "function" ? circulateursWithCurve() : [];
  if (!pumps.length) {
    svg.innerHTML = "";
    return;
  }
  const ins = installState();
  const c = ins.circ;
  const qOp = c.useHydro && LAST?.hydro?.active ? LAST.hydro.debitM3h : (+c.debitM3h || 0);
  const hOp = c.useHydro && LAST?.hydro?.active ? LAST.hydro.hmtM : (+c.hmtM || 0);

  const W = Math.max(640, wrap.clientWidth || 800);
  const H = 380;
  const pad = { l: 52, r: 24, t: 28, b: 48 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  let maxD = 0;
  let maxH = 0;
  pumps.forEach((p) => {
    p.courbeHmt.forEach((pt) => {
      if (pt.debit > maxD) maxD = pt.debit;
      if (pt.hmt > maxH) maxH = pt.hmt;
    });
  });
  if (qOp > maxD) maxD = qOp;
  if (hOp > maxH) maxH = hOp;
  maxD = Math.max(maxD * 1.05, 1);
  maxH = Math.max(maxH * 1.08, 1);
  const xAt = (d) => pad.l + (d / maxD) * plotW;
  const yAt = (h) => pad.t + plotH - (h / maxH) * plotH;

  let grid = "";
  for (let i = 0; i <= 5; i++) {
    const v = (maxH * i) / 5;
    const y = yAt(v);
    grid += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
    grid += `<text x="${pad.l - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="var(--ink-soft)" font-size="9">${fmt(v, 1)}</text>`;
  }
  for (let i = 0; i <= 5; i++) {
    const v = (maxD * i) / 5;
    const x = xAt(v);
    grid += `<line x1="${x.toFixed(1)}" y1="${pad.t}" x2="${x.toFixed(1)}" y2="${pad.t + plotH}" stroke="var(--line)" stroke-dasharray="3 4" opacity=".5"/>`;
    grid += `<text x="${x.toFixed(1)}" y="${(H - 14).toFixed(1)}" text-anchor="middle" fill="var(--ink-soft)" font-size="9">${fmt(v, 1)}</text>`;
  }

  const colors = typeof CIRC_CURVE_COLORS !== "undefined" ? CIRC_CURVE_COLORS : ["#0c7a8c", "#cf4310", "#5b6066"];
  let curves = "";
  let legendHtml = "";
  pumps.forEach((p, i) => {
    const col = colors[i % colors.length];
    const pts = [...p.courbeHmt].sort((a, b) => a.debit - b.debit);
    const poly = pts.map((pt) => `${xAt(pt.debit).toFixed(1)},${yAt(pt.hmt).toFixed(1)}`).join(" ");
    curves += `<polyline points="${poly}" fill="none" stroke="${col}" stroke-width="2" opacity=".85"/>`;
    legendHtml += `<span class="circ-leg-item"><span class="circ-leg-swatch" style="background:${col}"></span>${escHtml(p.ref || p.modele || "—")}</span>`;
  });

  let opSvg = "";
  if (qOp > 0 && hOp > 0) {
    const ox = xAt(qOp);
    const oy = yAt(hOp);
    opSvg = `<line x1="${pad.l}" y1="${oy.toFixed(1)}" x2="${(W - pad.r).toFixed(1)}" y2="${oy.toFixed(1)}" stroke="var(--heat)" stroke-dasharray="6 4" opacity=".55"/>
      <line x1="${ox.toFixed(1)}" y1="${pad.t}" x2="${ox.toFixed(1)}" y2="${(pad.t + plotH).toFixed(1)}" stroke="var(--heat)" stroke-dasharray="6 4" opacity=".55"/>
      <circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="6" fill="var(--heat)" stroke="#fff" stroke-width="2"/>
      <text x="${(ox + 8).toFixed(1)}" y="${(oy - 8).toFixed(1)}" fill="var(--heat)" font-size="10" font-weight="600">${fmt(qOp, 2)} m³/h · ${fmt(hOp, 2)} m</text>`;
  }

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `${grid}${curves}${opSvg}
    <text x="${pad.l + plotW / 2}" y="${H - 4}" text-anchor="middle" fill="var(--ink-soft)" font-size="10">Débit (m³/h)</text>
    <text x="14" y="${pad.t + plotH / 2}" text-anchor="middle" fill="var(--ink-soft)" font-size="10" transform="rotate(-90 14 ${pad.t + plotH / 2})">HMT (mCE)</text>`;
  const leg = $("instCircChartLegend");
  if (leg) leg.innerHTML = legendHtml;
}

function renderInstallationTab(scrollTop) {
  const root = $("v-installation");
  if (!root) return;
  const ins = installState();
  if (ins.tool) INSTALL_TOOL = ins.tool;
  const tools = [
    ["pdc", "PDC linéaires"],
    ["circ", "Circulateurs"],
    ["volume", "Volume tuyauterie"],
    ["glycol", "Taux glycol"],
    ["vase", "Vase d'expansion"]
  ];
  const tabs = tools.map(([id, lbl]) =>
    `<button type="button" class="comp-subtab${INSTALL_TOOL === id ? " on" : ""}" onclick="setInstallTool('${id}')">${lbl}</button>`
  ).join("");
  let panel = "";
  if (INSTALL_TOOL === "pdc") panel = renderInstallPdcPanel(ins);
  else if (INSTALL_TOOL === "circ") panel = renderInstallCircPanel(ins);
  else if (INSTALL_TOOL === "volume") panel = renderInstallVolumePanel(ins);
  else if (INSTALL_TOOL === "glycol") panel = renderInstallGlycolPanel(ins);
  else if (INSTALL_TOOL === "vase") panel = renderInstallVasePanel(ins);

  root.innerHTML = `<div class="panel blk-geo" style="margin-bottom:18px">
    <div class="head"><h3>Outils chantier</h3><span class="tag">Hydraulique &amp; dimensionnement</span></div>
    <div class="body">
      <div class="hint">Calculs pour l'installateur : pertes de charge linéaires, circulateurs, volumes, dosage glycol et vase d'expansion. Les valeurs sont enregistrées avec l'étude.</div>
      <div class="comp-tabs inst-tabs">${tabs}</div>
    </div>
  </div>
  <div id="instToolBody">${panel}</div>`;

  if (INSTALL_TOOL === "circ") requestAnimationFrame(() => drawInstallCircChart());
  if (scrollTop !== false) window.scrollTo(0, 0);
}

function initInstallationTab() {
  ensureProjetInstallation(typeof projet !== "undefined" ? projet : null);
  renderInstallationTab();
}
