/* OEDIP — impression fiche procédure (template_fiche_procedure.html) + édition champs fiche */

const PROC_EPI_CATALOG = [
  { id: "lunettes", label: "Lunettes", svg: '<path d="M2 11a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v1a3 3 0 0 1-3 3h-2.2a3 3 0 0 1-2.6-1.5L13 12h-2l-1.4 1.5A3 3 0 0 1 7 15H5a3 3 0 0 1-3-3z"/>' },
  { id: "gants", label: "Gants cuir", svg: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6m0 0V4a1.5 1.5 0 0 1 3 0v7m0 0V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1.5a4 4 0 0 1-3.2-1.6L5 16a1.6 1.6 0 0 1 2.4-2L8 14"/>' },
  { id: "masque", label: "Masque brasage", svg: '<path d="M6 5h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"/><path d="M9 18h6m-3 0v2"/>' },
  { id: "auditif", label: "Protection auditive", svg: '<path d="M4 13a8 8 0 0 1 16 0v3a2 2 0 0 1-2 2h-1v-6m-10 6H6a2 2 0 0 1-2-2z"/>' },
  { id: "chaussures", label: "Chaussures sécu.", svg: '<path d="M3 16v-3l5-1 2-3h3v7m-13 0h18a1 1 0 0 1 1 1v1H2v-1a1 1 0 0 1 1-1z"/>' },
  { id: "vetement", label: "Vêtement travail", svg: '<path d="M8 4l-4 3v5l3-1v9h10v-9l3 1V7l-4-3-2 2h-2z"/>' }
];

const PROC_FICHE_DEFAULT_RISKS = [
  "Brasage : flamme nue, points chauds, projections — éloigner produits inflammables, extincteur à portée.",
  "Fumées de brasage : travailler en zone ventilée / sous aspiration.",
  "Azote sous pression (balayage) : ne jamais dépasser la pression d'épreuve, purger avant intervention.",
  "Arêtes vives après coupe : ébavurer systématiquement."
];

const PROC_FICHE_DEFAULT_OUTILLAGE = [
  "Tube cuivre (diamètre selon §5)",
  "Cintreuse + galets adaptés",
  "Coupe-tube / ébavureur",
  "Poste de brasage + baguettes argent 15 %",
  "Décapant / flux",
  "Bouteille azote + détendeur",
  "Mètre / pied à coulisse",
  "Raccords (réductions, coudes, Schrader, pressostat…)"
];

const PROC_FICHE_PRINT_CSS = `:root{--ink:#1a1f24;--ink-soft:#454e57;--line:#d4d8dd;--line-strong:#9aa1a9;--slate:#1d242c;--slate-2:#2a333d;--paper:#fff;--paper-2:#f6f7f8;--copper:#b5642f;--copper-soft:#f3e6db;--warn:#b54a2f;--mono:'IBM Plex Mono',monospace;--sans:'IBM Plex Sans',sans-serif;--display:'Archivo',sans-serif}*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e9ebed;font-family:var(--sans);color:var(--ink);font-size:11px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{max-width:820px;margin:18px auto 0;display:flex;gap:10px;align-items:center;font-family:var(--sans)}.toolbar p{margin:0;color:#5b636b;font-size:12px}.btn{font-family:var(--display);font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:11px;background:var(--slate);color:#fff;border:none;border-radius:6px;padding:9px 16px;cursor:pointer}.btn:hover{background:var(--copper)}.sheet{width:210mm;min-height:297mm;margin:18px auto;background:var(--paper);box-shadow:0 4px 24px rgba(0,0,0,.14);padding:13mm 13mm 11mm;display:flex;flex-direction:column;page-break-after:always}.sheet:last-child{page-break-after:auto}.cartouche{border:1.5px solid var(--ink);display:grid;grid-template-columns:150px 1fr 180px}.cart-logo{border-right:1px solid var(--line-strong);padding:10px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;text-align:center}.logo-box{width:100%;height:42px;border:1.5px dashed var(--line-strong);border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9aa1a9;font-family:var(--mono);font-size:9px;letter-spacing:.1em;overflow:hidden}.logo-box img{max-width:100%;max-height:40px;object-fit:contain}.cart-logo .co{font-family:var(--display);font-weight:800;font-size:12px;letter-spacing:.02em;color:var(--ink)}.cart-title{padding:10px 14px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--line-strong)}.cart-title .kicker{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--copper);text-transform:uppercase;margin-bottom:3px}.cart-title h1{font-family:var(--display);font-weight:800;font-size:19px;line-height:1.1;margin:0;letter-spacing:-.01em}.cart-title .sub{margin-top:4px;color:var(--ink-soft);font-size:11px}.cart-meta{display:flex;flex-direction:column;font-family:var(--mono)}.cart-meta .mrow{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)}.cart-meta .mrow:last-child{border-bottom:none}.cart-meta .mk{padding:4px 7px;background:var(--paper-2);font-size:8px;letter-spacing:.06em;color:#5b636b;text-transform:uppercase;border-right:1px solid var(--line)}.cart-meta .mv{padding:4px 7px;font-size:10px;font-weight:500}.valid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--ink);border-top:none}.valid .cell{padding:7px 10px 22px;border-right:1px solid var(--line-strong);position:relative}.valid .cell:last-child{border-right:none}.valid .role{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#5b636b}.valid .name{font-weight:600;margin-top:2px}.valid .ph{color:#aeb4bb;font-weight:400}.valid .sig{position:absolute;left:10px;bottom:5px;font-family:var(--mono);font-size:8px;color:#9aa1a9;letter-spacing:.06em}.section{margin-top:14px}.sec-head{display:flex;align-items:center;gap:9px;margin-bottom:7px}.sec-num{font-family:var(--display);font-weight:800;font-size:11px;color:#fff;background:var(--slate);width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.sec-head h2{font-family:var(--display);font-weight:700;font-size:12.5px;letter-spacing:.04em;text-transform:uppercase;margin:0}.sec-head .rule{flex:1;height:1px;background:var(--line)}.epi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.epi{border:1px solid var(--line);border-radius:6px;padding:8px 6px 7px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;background:var(--paper-2);position:relative}.epi.req{border-color:var(--copper);background:var(--copper-soft)}.epi svg{width:30px;height:30px}.epi .lab{font-size:9px;font-weight:600;line-height:1.2}.epi .chk{position:absolute;top:5px;right:6px;width:11px;height:11px;border:1.4px solid var(--line-strong);border-radius:3px}.epi.req .chk{background:var(--copper);border-color:var(--copper)}.epi.req .chk::after{content:"";position:absolute;left:2.6px;top:0;width:3px;height:6px;border:solid #fff;border-width:0 1.6px 1.6px 0;transform:rotate(45deg)}.risks{border:1px solid var(--warn);border-left:4px solid var(--warn);border-radius:5px;padding:9px 12px;background:#fcf4f1}.risks .rt{font-family:var(--display);font-weight:700;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--warn);display:flex;align-items:center;gap:6px;margin-bottom:4px}.risks ul{margin:0;padding-left:16px}.risks li{margin:1px 0}.two-col{columns:2;column-gap:24px}.checklist{list-style:none;margin:0;padding:0}.checklist li{padding:2.5px 0 2.5px 20px;position:relative;break-inside:avoid;border-bottom:1px dotted var(--line)}.checklist li::before{content:"";position:absolute;left:0;top:4px;width:11px;height:11px;border:1.3px solid var(--line-strong);border-radius:3px}table.meas{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:9.5px}table.meas thead th{background:var(--slate);color:#fff;font-family:var(--display);font-weight:600;font-size:9px;letter-spacing:.05em;text-transform:uppercase;padding:6px 7px;text-align:left;border-right:1px solid var(--slate-2)}table.meas tbody td{padding:5px 7px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)}table.meas tbody td:first-child{font-family:var(--sans);font-weight:600;background:var(--paper-2)}table.meas tbody tr:nth-child(even) td:not(:first-child){background:#fbfbfc}table.meas tbody tr.default-row td{background:var(--copper-soft)}table.meas tbody tr.default-row td:first-child{background:#ecd8c8}.note{border:1px solid var(--copper);border-left:4px solid var(--copper);border-radius:5px;background:var(--copper-soft);padding:8px 12px;margin-bottom:10px;font-size:10.5px}ol.steps{counter-reset:st;list-style:none;margin:0;padding:0}ol.steps li{counter-increment:st;display:grid;grid-template-columns:28px 1fr;gap:8px 12px;align-items:start;padding:14px 0;border-bottom:1px solid var(--line);break-inside:avoid}ol.steps li .num{font-family:var(--display);font-weight:700;font-size:10px;color:#fff;background:var(--copper);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-top:2px;grid-row:1;grid-column:1}ol.steps li .num::before{content:counter(st)}ol.steps li .txt{padding-top:3px;grid-row:1;grid-column:2}ol.steps li b{font-weight:600}ol.steps li .shot{grid-column:1/-1;margin-top:6px;border:1px solid var(--line-strong);border-radius:8px;min-height:220px;padding:14px 16px;background:var(--paper-2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;overflow:visible}ol.steps li .shot.shot-multi{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;align-items:center;justify-items:center}ol.steps li .shot .shot-inner{display:flex;align-items:center;justify-content:center;width:100%;max-width:100%}ol.steps li .shot img{display:block;max-width:100%;width:auto;height:auto;max-height:340px;object-fit:contain;border-radius:5px;margin:0 auto}.footer{margin-top:auto;padding-top:12px}table.rev{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:8.5px}table.rev th{background:var(--paper-2);text-align:left;padding:4px 7px;border:1px solid var(--line);font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#5b636b}table.rev td{padding:4px 7px;border:1px solid var(--line)}.foot-bar{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:7px;border-top:1.5px solid var(--ink);font-family:var(--mono);font-size:8px;letter-spacing:.06em;color:#6b727a;text-transform:uppercase}@page{size:A4;margin:0}@media print{body{background:#fff}.toolbar{display:none}.sheet{box-shadow:none;margin:0;width:auto;min-height:auto}.section,.epi,.photo,ol.steps li,.checklist li{break-inside:avoid}}`;

function ensureProcFiche(proc, gam) {
  if (!proc.fiche || typeof proc.fiche !== "object") proc.fiche = {};
  const f = proc.fiche;
  const fluide = gam?.fluide === "custom" ? (gam?.fluideLabel || "Autre") : (gam?.fluide || "");
  if (!f.docRef) f.docRef = proc.id.replace(/^geo-/, "PRC-").replace(/-/g, "-").toUpperCase();
  if (!f.revIndex) f.revIndex = "A";
  if (!f.company) f.company = "Enthalpie";
  if (!f.kicker) f.kicker = proc.id.startsWith("geo-annex") ? "Fiche de montage · Atelier" : "Fiche de fabrication · Tube";
  if (!f.subtitle) f.subtitle = [gam?.nom, fluide, "Atelier cintrage / brasage"].filter(Boolean).join(" · ");
  if (!f.objet) {
    f.objet = proc.printIntro || `Fabrication et contrôle : ${proc.title}. Machines de la gamme ${gam?.nom || ""}.`;
  }
  if (!Array.isArray(f.epiRequired)) f.epiRequired = ["lunettes", "gants", "masque", "chaussures"];
  if (!Array.isArray(f.risks) || !f.risks.length) f.risks = PROC_FICHE_DEFAULT_RISKS.slice();
  if (!Array.isArray(f.outillage) || !f.outillage.length) f.outillage = PROC_FICHE_DEFAULT_OUTILLAGE.slice();
  if (!Array.isArray(f.revisions) || !f.revisions.length) {
    f.revisions = [{ indice: f.revIndex || "A", date: f.updatedDate || "", modif: "Création du document", auteur: f.redigePar || "" }];
  }
  if (!f.footerNote) f.footerNote = `${f.company} — Document interne`;
  return f;
}

function ficheLinesToText(arr) {
  return (arr || []).join("\n");
}

function ficheTextToLines(text) {
  return String(text || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
}

function formatPrintStepText(text) {
  let s = escHtml(text || "");
  s = s.replace(/(\d+[,.]?\d*\s*(?:cm|mm|°))/gi, "<b>$1</b>");
  s = s.replace(/(\d+\/\d+"|\d+[,.]?\d*")/g, "<b>$1</b>");
  s = s.replace(/(«\s*[OL]\s*»)/g, "<b>$1</b>");
  return s;
}

function renderPrintMeasTable(proc, gammeCode) {
  const cols = collectProcedureDimColumns(proc);
  if (!cols.length) return `<p style="margin:0;font-size:10px;color:#6b727a">Aucune mesure variable pour cette procédure.</p>`;
  if (proc.tubeRef && proc.variants?.length) {
    const head = `<tr><th>Variante</th>${cols.map((c) => `<th>${escHtml(c.label)}</th>`).join("")}</tr>`;
    const rows = proc.variants.map((v) => `<tr class="${normalizeVariantVer(v.ver) === "01" ? "default-row" : ""}">
      <td class="mono">${escHtml(v.ref || `${proc.tubeRef}-${v.ver}`)}</td>
      ${cols.map((c) => `<td>${escHtml(effectiveDimFromVariant(v, c.stepIndex, c.dimKey) || "—")}</td>`).join("")}
    </tr>`).join("");
    return `<table class="meas"><thead>${head}</thead><tbody>${rows}</tbody></table>
      <p style="margin:5px 0 0;font-family:var(--mono);font-size:8.5px;color:#6b727a">Réf. ${escHtml(proc.tubeRef)} · version par machine sur schéma frigo (défaut 01).</p>`;
  }
  const machines = machinesInGamme(gammeCode);
  const head = `<tr><th>Machine</th>${cols.map((c) => `<th>${escHtml(c.label)}</th>`).join("")}</tr>`;
  const defRow = `<tr class="default-row"><td>Défaut</td>${cols.map((c) => {
    const v = stepDimDefault(proc.steps[c.stepIndex], c.dimKey);
    return `<td>${escHtml(v || "—")}</td>`;
  }).join("")}</tr>`;
  const mRows = machines.map((m) => `<tr><td>${escHtml(m.pac)}</td>${cols.map((c) => {
    const eff = effectiveDim(m, proc, c.stepIndex, c.dimKey);
    return `<td>${escHtml(eff || "—")}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="meas"><thead>${head}</thead><tbody>${defRow}${mRows}</tbody></table>
    <p style="margin:5px 0 0;font-family:var(--mono);font-size:8.5px;color:#6b727a">L = longueur (cm) · diam = diamètre (pouces) · É = étape. La ligne « Défaut » s'applique si la machine n'est pas surchargée.</p>`;
}

function renderPrintStepShot(mediaItems) {
  if (!mediaItems?.length) return "";
  const renderOne = (m) => {
    const innerStyle = procImgInnerStyle(m);
    const img = `<img src="${escAttr(typeof oedipMediaUrl === "function" ? oedipMediaUrl(m.src) : m.src)}" alt="">`;
    return `<div class="shot-inner"${innerStyle ? ` style="${escVal(innerStyle)}"` : ""}>${img}</div>`;
  };
  if (mediaItems.length === 1) return `<div class="shot">${renderOne(mediaItems[0])}</div>`;
  return `<div class="shot shot-multi">${mediaItems.map(renderOne).join("")}</div>`;
}

function renderPrintStepsList(proc, sampleCtx) {
  return (proc.steps || []).map((s, i) => {
    const text = resolveProcedureText(s.text || "", sampleCtx, mergedStepDims(proc, s, i, sampleCtx));
    const media = normalizeStepMedia(s);
    const shot = renderPrintStepShot(media);
    return `<li><span class="num"></span><div class="txt">${formatPrintStepText(text)}</div>${shot}</li>`;
  }).join("");
}

function renderPrintEpiGrid(fiche) {
  const req = new Set(fiche.epiRequired || []);
  return `<div class="epi-grid">${PROC_EPI_CATALOG.map((e) => {
    const cls = req.has(e.id) ? "epi req" : "epi";
    return `<div class="${cls}"><span class="chk"></span><svg viewBox="0 0 24 24" fill="none" stroke="#1a1f24" stroke-width="1.6">${e.svg}</svg><div class="lab">${escHtml(e.label)}</div></div>`;
  }).join("")}</div>`;
}

function renderPrintRevisionsTable(fiche) {
  const rows = (fiche.revisions || []).map((r) =>
    `<tr><td>${escHtml(r.indice || "—")}</td><td>${escHtml(r.date || "—")}</td><td>${escHtml(r.modif || "—")}</td><td>${escHtml(r.auteur || "—")}</td></tr>`
  ).join("");
  return `<table class="rev"><thead><tr><th style="width:60px">Indice</th><th style="width:90px">Date</th><th>Modification</th><th style="width:120px">Auteur</th></tr></thead><tbody>${rows || "<tr><td colspan=\"4\">—</td></tr>"}</tbody></table>`;
}

function buildProcedureFicheSheet(proc, gammeCode, gam, pageNum, totalPages) {
  const f = ensureProcFiche(proc, gam);
  const machines = machinesInGamme(gammeCode);
  const sampleCtx = machines[0] ? buildMachineProcContext(machines[0].pac) : { gamme: { nom: gam?.nom } };
  const hasDims = collectProcedureDimColumns(proc).length > 0;
  const logoHtml = f.logoUrl
    ? `<img src="${escAttr(f.logoUrl)}" alt="">`
    : "LOGO";
  const noteDims = hasDims
    ? `<div class="note">⚠ Cotes <b>par défaut</b> — celles-ci correspondent à la ligne « Défaut » et ne sont <b>pas forcément identiques pour toutes les machines</b>. Avant fabrication, vérifier le tableau « Mesures par machine » (§5).</div>`
    : "";

  return `<div class="sheet">
  <div class="cartouche">
    <div class="cart-logo"><div class="logo-box">${logoHtml}</div><div class="co">${escHtml(f.company)}</div></div>
    <div class="cart-title">
      <div class="kicker">${escHtml(f.kicker)}</div>
      <h1>${escHtml(proc.title)}</h1>
      <div class="sub">${escHtml(f.subtitle)}</div>
    </div>
    <div class="cart-meta">
      <div class="mrow"><div class="mk">Réf. doc.</div><div class="mv">${escHtml(f.docRef)}</div></div>
      <div class="mrow"><div class="mk">Indice rév.</div><div class="mv">${escHtml(f.revIndex)}</div></div>
      <div class="mrow"><div class="mk">Créé le</div><div class="mv">${escHtml(f.createdDate || "—")}</div></div>
      <div class="mrow"><div class="mk">MàJ le</div><div class="mv">${escHtml(f.updatedDate || "—")}</div></div>
      <div class="mrow"><div class="mk">Page</div><div class="mv">${pageNum} / ${totalPages}</div></div>
    </div>
  </div>
  <div class="valid">
    <div class="cell"><div class="role">Rédigé par</div><div class="name${f.redigePar ? "" : " ph"}">${escHtml(f.redigePar || "Prénom Nom")}</div><div class="sig">Date / Visa : ____________</div></div>
    <div class="cell"><div class="role">Vérifié par</div><div class="name${f.verifiePar ? "" : " ph"}">${escHtml(f.verifiePar || "Prénom Nom")}</div><div class="sig">Date / Visa : ____________</div></div>
    <div class="cell"><div class="role">Approuvé par</div><div class="name${f.approuvePar ? "" : " ph"}">${escHtml(f.approuvePar || "Prénom Nom")}</div><div class="sig">Date / Visa : ____________</div></div>
  </div>
  <div class="section"><div class="sec-head"><span class="sec-num">1</span><h2>Objet &amp; domaine d'application</h2><span class="rule"></span></div><p style="margin:0">${escHtml(f.objet)}</p></div>
  <div class="section"><div class="sec-head"><span class="sec-num">2</span><h2>Équipements de protection individuelle</h2><span class="rule"></span></div>${renderPrintEpiGrid(f)}</div>
  <div class="section"><div class="sec-head"><span class="sec-num">3</span><h2>Sécurité &amp; risques</h2><span class="rule"></span></div><div class="risks"><div class="rt">⚠ Points de vigilance</div><ul>${f.risks.map((r) => `<li>${escHtml(r)}</li>`).join("")}</ul></div></div>
  <div class="section"><div class="sec-head"><span class="sec-num">4</span><h2>Outillage &amp; matière</h2><span class="rule"></span></div><ul class="checklist two-col">${f.outillage.map((o) => `<li>${escHtml(o)}</li>`).join("")}</ul></div>
  <div class="section"><div class="sec-head"><span class="sec-num">5</span><h2>Cotes par variante</h2><span class="rule"></span></div>${renderPrintMeasTable(proc, gammeCode)}</div>
  <div class="section"><div class="sec-head"><span class="sec-num">6</span><h2>Mode opératoire par défaut</h2><span class="rule"></span></div>${noteDims}<ol class="steps">${renderPrintStepsList(proc, sampleCtx)}</ol></div>
  <div class="footer"><div class="sec-head"><span class="sec-num">7</span><h2>Historique des révisions</h2><span class="rule"></span></div>${renderPrintRevisionsTable(f)}<div class="foot-bar"><span>${escHtml(f.footerNote)}</span><span>Réf. ${escHtml(f.docRef)} · Ind. ${escHtml(f.revIndex)}</span><span>Page ${pageNum} / ${totalPages}</span></div></div>
</div>`;
}

function buildGammePrintDocument(gammeCode) {
  const gam = gammeByCode(gammeCode);
  const cat = getProcedureCatalog(gammeCode);
  const procs = (cat?.procedures || []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const total = procs.length || 1;
  const sheets = procs.map((p, i) => buildProcedureFicheSheet(p, gammeCode, gam, i + 1, total)).join("\n");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Procédures ${escHtml(gam?.nom || "")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PROC_FICHE_PRINT_CSS}</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.print()">Imprimer / PDF</button><p>${procs.length} fiche(s) — ${escHtml(gam?.nom || "")}</p></div>
${sheets || `<div class="sheet"><p>Aucune procédure.</p></div>`}
</body></html>`;
}

function renderProcedureFicheEditor(proc, gam) {
  const f = ensureProcFiche(proc, gam);
  const epiChecks = PROC_EPI_CATALOG.map((e) => {
    const on = (f.epiRequired || []).includes(e.id);
    return `<label class="proc-fiche-epi-chk"><input type="checkbox" data-epi-id="${escVal(e.id)}"${on ? " checked" : ""}> ${escHtml(e.label)}</label>`;
  }).join("");
  const revRows = (f.revisions || []).map((r, i) => `<tr>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="indice" value="${escVal(r.indice || "")}"></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="date" value="${escVal(r.date || "")}"></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="modif" value="${escVal(r.modif || "")}"></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="auteur" value="${escVal(r.auteur || "")}"></td>
  </tr>`).join("");
  return `<h4 class="subhead" style="margin-top:18px">Fiche atelier (impression)</h4>
  <p class="hint">Format <span class="mono">template_fiche_procedure.html</span> — une page A4 par procédure.</p>
  <div class="proc-fiche-edit-grid">
    <label>Société<input type="text" id="procFicheCompany" value="${escVal(f.company)}"></label>
    <label>Réf. document<input type="text" id="procFicheDocRef" class="mono" value="${escVal(f.docRef)}"></label>
    <label>Indice rév.<input type="text" id="procFicheRevIndex" class="mono" value="${escVal(f.revIndex)}" style="max-width:80px"></label>
    <label>Créé le<input type="text" id="procFicheCreated" placeholder="jj/mm/aa" value="${escVal(f.createdDate || "")}"></label>
    <label>MàJ le<input type="text" id="procFicheUpdated" placeholder="jj/mm/aa" value="${escVal(f.updatedDate || "")}"></label>
    <label>Logo (URL)<input type="text" id="procFicheLogo" class="mono" placeholder="img/…" value="${escVal(f.logoUrl || "")}"></label>
    <label style="grid-column:1/-1">Accroche cartouche<input type="text" id="procFicheKicker" value="${escVal(f.kicker)}"></label>
    <label style="grid-column:1/-1">Sous-titre (plan, fluide…)<input type="text" id="procFicheSubtitle" value="${escVal(f.subtitle)}"></label>
    <label style="grid-column:1/-1">Pied de page<input type="text" id="procFicheFooter" value="${escVal(f.footerNote)}"></label>
  </div>
  <label class="subhead" style="margin-top:12px;border:none">Responsables</label>
  <div class="proc-fiche-edit-grid proc-fiche-edit-grid-3">
    <label>Rédigé par<input type="text" id="procFicheRedige" value="${escVal(f.redigePar || "")}"></label>
    <label>Vérifié par<input type="text" id="procFicheVerifie" value="${escVal(f.verifiePar || "")}"></label>
    <label>Approuvé par<input type="text" id="procFicheApprouve" value="${escVal(f.approuvePar || "")}"></label>
  </div>
  <label class="subhead" style="margin-top:12px;border:none">Objet &amp; domaine d'application</label>
  <textarea id="procFicheObjet" rows="3">${escHtml(f.objet)}</textarea>
  <label class="subhead" style="margin-top:12px;border:none">EPI obligatoires</label>
  <div class="proc-fiche-epi-grid">${epiChecks}</div>
  <label class="subhead" style="margin-top:12px;border:none">Sécurité &amp; risques <span class="hint" style="display:inline;padding:2px 6px">une ligne = un point</span></label>
  <textarea id="procFicheRisks" rows="5">${escHtml(ficheLinesToText(f.risks))}</textarea>
  <label class="subhead" style="margin-top:12px;border:none">Outillage &amp; matière <span class="hint" style="display:inline;padding:2px 6px">une ligne = un item</span></label>
  <textarea id="procFicheOutillage" rows="5">${escHtml(ficheLinesToText(f.outillage))}</textarea>
  <label class="subhead" style="margin-top:12px;border:none">Historique révisions</label>
  <table class="proc-gamme-tbl proc-fiche-rev-tbl"><thead><tr><th>Indice</th><th>Date</th><th>Modification</th><th>Auteur</th></tr></thead><tbody id="procFicheRevBody">${revRows}</tbody></table>
  <button type="button" class="btn-ghost" onclick="procFicheAddRevisionRow()">+ Ligne révision</button>`;
}

function gatherProcedureFicheFromForm(proc) {
  if (!proc.fiche) proc.fiche = {};
  const f = proc.fiche;
  const g = (id) => $(id)?.value?.trim() ?? "";
  f.company = g("procFicheCompany") || f.company;
  f.docRef = g("procFicheDocRef") || f.docRef;
  f.revIndex = g("procFicheRevIndex") || f.revIndex;
  f.createdDate = g("procFicheCreated");
  f.updatedDate = g("procFicheUpdated");
  f.logoUrl = g("procFicheLogo");
  f.kicker = g("procFicheKicker") || f.kicker;
  f.subtitle = g("procFicheSubtitle") || f.subtitle;
  f.footerNote = g("procFicheFooter") || f.footerNote;
  f.redigePar = g("procFicheRedige");
  f.verifiePar = g("procFicheVerifie");
  f.approuvePar = g("procFicheApprouve");
  f.objet = g("procFicheObjet") || f.objet;
  f.epiRequired = [...document.querySelectorAll("[data-epi-id]:checked")].map((el) => el.dataset.epiId);
  f.risks = ficheTextToLines(g("procFicheRisks"));
  f.outillage = ficheTextToLines(g("procFicheOutillage"));
  const revMap = {};
  document.querySelectorAll(".proc-fiche-rev").forEach((inp) => {
    const i = +inp.dataset.revI;
    const k = inp.dataset.revK;
    if (!revMap[i]) revMap[i] = {};
    revMap[i][k] = inp.value.trim();
  });
  f.revisions = Object.keys(revMap).sort((a, b) => +a - +b).map((i) => revMap[i]).filter((r) => r.indice || r.modif || r.date || r.auteur);
}

function procFicheAddRevisionRow() {
  if (typeof gatherProcedureEditForm === "function") gatherProcedureEditForm();
  const proc = procedureEditDraft?.proc;
  if (!proc) return;
  ensureProcFiche(proc, gammeByCode(procedureEditDraft.gammeCode));
  proc.fiche.revisions.push({ indice: "", date: "", modif: "", auteur: "" });
  const i = proc.fiche.revisions.length - 1;
  const r = proc.fiche.revisions[i];
  const tbody = $("procFicheRevBody");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="indice" value="${escVal(r.indice || "")}"></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="date" value=""></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="modif" value=""></td>
    <td><input type="text" class="proc-fiche-rev" data-rev-i="${i}" data-rev-k="auteur" value=""></td>`;
  tbody.appendChild(tr);
}

function printSingleProcedure(gammeCode, procId) {
  const gam = gammeByCode(gammeCode);
  const proc = getProcedureCatalog(gammeCode)?.procedures?.find((p) => p.id === procId);
  if (!proc) return;
  const w = window.open("", "_blank");
  if (!w) { alert("Autorisez les fenêtres popup pour imprimer."); return; }
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${escHtml(proc.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PROC_FICHE_PRINT_CSS}</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.print()">Imprimer / PDF</button></div>
${buildProcedureFicheSheet(proc, gammeCode, gam, 1, 1)}
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
