/* OEDIP — constantes & départements — ne pas modifier l'ordre de chargement dans oedip.html */

const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) =>
  n == null || isNaN(n) || n === "" ? "—" : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   OEDIP · intégration DJU + modèle machine enrichi
   ============================================================ */

/* ---------- 1. DONNÉES (graine) ---------- */
const PERF_SRC = ["0/-3","5/2","9/6"];
const PERF_DEP = ["30/35","40/45","47/55"];
const REG = PERF_DEP.map(d=>d+"°C"); // compat. gammes / émetteurs

const FONCTIONS = [
  {id:"geothermie", label:"Géothermie"},
  {id:"aerothermie", label:"Aérothermie"},
  {id:"geothermie_aero", label:"Géothermie / Aérothermie"},
  {id:"hybride", label:"Hybride"},
  {id:"ecs", label:"Eau chaude sanitaire"},
  {id:"rafraichissement", label:"Rafraîchissement"},
  {id:"autre", label:"Autre"}
];
function fonctionLabel(id){ return (FONCTIONS.find(f=>f.id===id)||{label:id||"—"}).label; }
function nextGammeCode(){ const codes=state.gammes.map(g=>+g.code||0); return codes.length? Math.max(...codes)+1 : 1; }

/* Couleurs explicites (impression PDF — les var() CSS ne passent pas dans le SVG) */
const OEDIP_PALETTE={
  heat:"#cf4310", heatLight:"#e8703f",
  geo:"#0c7a8c", geoLight:"#3aa9bb",
  ink:"#1d2125", inkSoft:"#5b6066", line:"#d7d3c8",
  gray:"#6b7177", grayLight:"#9aa1a6", warn:"#b5740c"
};
const OEDIP_BAR_HEAT=`linear-gradient(90deg,${OEDIP_PALETTE.heat},${OEDIP_PALETTE.heatLight})`;
const OEDIP_BAR_GEO=`linear-gradient(90deg,${OEDIP_PALETTE.geo},${OEDIP_PALETTE.geoLight})`;
const OEDIP_BAR_GRAY=`linear-gradient(90deg,${OEDIP_PALETTE.gray},${OEDIP_PALETTE.grayLight})`;

/* GWP (AR5 / règlement F-Gas) — kg CO₂ éq. par kg de fluide */
const REFRIGERANTS = [
  {id:"R290", label:"R290 (propane)", gwp:3},
  {id:"R744", label:"R744 (CO₂)", gwp:1},
  {id:"R32", label:"R32", gwp:675},
  {id:"R454B", label:"R454B", gwp:466},
  {id:"R513A", label:"R513A", gwp:631},
  {id:"R134a", label:"R134a", gwp:1430},
  {id:"R407C", label:"R407C", gwp:1774},
  {id:"R410A", label:"R410A", gwp:2088},
  {id:"R404A", label:"R404A", gwp:3922},
  {id:"custom", label:"Autre (GWP manuel)", gwp:null}
];
function refrigerantLabel(id){ return (REFRIGERANTS.find(r=>r.id===id)||{label:id||"—"}).label; }
function gammeGwp(g){
  if(!g) return null;
  if(g.fluide==="custom") return num(g.gwpCustom);
  const r=REFRIGERANTS.find(x=>x.id===g.fluide);
  return r&&r.gwp!=null? r.gwp : null;
}
function gammeByCode(code){ return state.gammes.find(g=>g.code===code); }
function machineByPac(pac){ return state.machines.find(m=>m.pac===pac); }
function calcGwpImpact(m){
  const gam=gammeByCode(m&&m.gammeCode);
  const gwp=gammeGwp(gam), charge=num(m&&m.chargeFluide);
  if(gwp==null||!charge) return null;
  const fluide=gam.fluide==="custom"?(gam.fluideLabel||"Fluide personnalisé"):refrigerantLabel(gam.fluide);
  return {fluide,gwp,charge,co2eq:charge*gwp,co2eqT:charge*gwp/1000};
}
function gwpHtml(impact,compact){
  if(!impact) return compact?'':'<span class="note">Renseignez le fluide (gamme) et la charge (machine).</span>';
  const t=fmt(impact.co2eqT,3), kg=fmt(impact.co2eq,0);
  if(compact) return `${impact.fluide} · ${fmt(impact.charge,2)} kg · PRP ${fmt(impact.gwp,0)} · <b>${t} tCO₂eq</b>`;
  return `<div class="gwp-panel">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div><div style="font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.03em">Impact GWP (fuite totale théorique)</div>
        <div class="gwp-val">${t} <small style="font-size:14px;font-weight:400">tCO₂eq</small></div>
        <div class="gwp-sub">${fmt(impact.charge,2)} kg × PRP ${fmt(impact.gwp,0)} = ${kg} kg CO₂eq</div></div>
      <div style="text-align:right;font-size:12.5px;color:var(--ink-soft)"><b>${impact.fluide}</b><br>PRP (GWP) selon gamme</div>
    </div></div>`;
}

function normalizeGammes(){
  state.gammes.forEach(g=>{
    if(!g.fonction) g.fonction="geothermie";
    if(!g.fluide) g.fluide="R407C";
    if(!g.departs||!g.departs.length) g.departs=PERF_DEP.slice();
    if(!g.sources||!g.sources.length) g.sources=["0/-3°C"];
  });
}

const EMETTEURS_LEGACY_MAP={0:2,1:3,2:4,3:6};
function emetteurOptionLabel(em){
  if(!em) return "—";
  if(em.absent) return em.nom;
  return `${em.nom} (${em.regime}°C)`;
}
function normalizeEmetteurs(){
  const cur=state.emetteurs||[];
  const isLegacy=cur.length===4&&!cur.some(e=>e.absent);
  if(isLegacy&&typeof projet!=="undefined"&&projet.besoin){
    ["em1","em2"].forEach(k=>{
      const v=projet.besoin[k];
      if(EMETTEURS_LEGACY_MAP[v]!=null) projet.besoin[k]=EMETTEURS_LEGACY_MAP[v];
    });
  }
  if(!cur.length||isLegacy||!cur.some(e=>e.absent)){
    state.emetteurs=JSON.parse(JSON.stringify(SEED.emetteurs));
  }
}
function emitterDepartureTemp(regime){
  if(!regime) return 45;
  const m=String(regime).match(/(\d+)\s*\/\s*(\d+)/);
  return m?+m[2]:45;
}
/** Contexte émetteur : régime réel, point catalogue perf, température de départ. */
function resolveEmitterContext(bs){
  const zones=Array.isArray(bs.zones)?bs.zones:[];
  const active=zones
    .map(z=>state.emetteurs[z.emIdx])
    .filter(em=>em&&!em.absent&&em.regime);
  if(!active.length){
    return {regimeEmitter:"40/45",depPerf:"40/45",depTemp:45,emetteurLabel:"—",active:[]};
  }
  const highest=active.reduce((a,b)=>emitterDepartureTemp(a.regime)>=emitterDepartureTemp(b.regime)?a:b);
  const regimeEmitter=highest.regime;
  return {
    regimeEmitter,
    depPerf:normDep(regimeEmitter),
    depTemp:emitterDepartureTemp(regimeEmitter),
    emetteurLabel:emetteurOptionLabel(highest),
    active
  };
}
function resolveDepRegime(bs){ return resolveEmitterContext(bs).depPerf; }

/* Départements métropole : CP (préfixe), T° base référence (0 m) — DJU via data/oedip-dju-departements.js (SDES) */
const DEPT_CLIM_ZONES={
  oceanique:{tbase:-4},oceanique_deg:{tbase:-5},sud_ouest:{tbase:-5},
  continentale:{tbase:-7},continentale_sev:{tbase:-9},rhone:{tbase:-10},
  montagne:{tbase:-12},haute_mont:{tbase:-15},med:{tbase:-2},med_int:{tbase:-4}
};
const DEPT_LINES=`01|Ain|montagne
02|Aisne|continentale_sev
03|Allier|continentale
04|Alpes-de-Haute-Provence|haute_mont
05|Hautes-Alpes|haute_mont
06|Alpes-Maritimes|med
07|Ardèche|rhone
08|Ardennes|continentale_sev
09|Ariège|montagne
10|Aube|continentale
11|Aude|med_int
12|Aveyron|montagne
13|Bouches-du-Rhône|med
14|Calvados|oceanique_deg
15|Cantal|montagne
16|Charente|oceanique_deg
17|Charente-Maritime|oceanique_deg
18|Cher|continentale
19|Corrèze|continentale
21|Côte-d'Or|continentale
22|Côtes-d'Armor|oceanique
23|Creuse|continentale
24|Dordogne|sud_ouest
25|Doubs|montagne
26|Drôme|rhone
27|Eure|oceanique_deg
28|Eure-et-Loir|continentale
29|Finistère|oceanique
30|Gard|med_int
31|Haute-Garonne|montagne
32|Gers|sud_ouest
33|Gironde|oceanique_deg
34|Hérault|med_int
35|Ille-et-Vilaine|oceanique
36|Indre|continentale
37|Indre-et-Loire|continentale
38|Isère|montagne
39|Jura|montagne
40|Landes|oceanique_deg
41|Loir-et-Cher|continentale
42|Loire|rhone
43|Haute-Loire|montagne
44|Loire-Atlantique|oceanique
45|Loiret|continentale
46|Lot|sud_ouest
47|Lot-et-Garonne|sud_ouest
48|Lozère|montagne
49|Maine-et-Loire|oceanique_deg
50|Manche|oceanique_deg
51|Marne|continentale
52|Haute-Marne|continentale_sev
53|Mayenne|oceanique_deg
54|Meurthe-et-Moselle|continentale_sev
55|Meuse|continentale_sev
56|Morbihan|oceanique
57|Moselle|continentale_sev
58|Nièvre|continentale
59|Nord|continentale_sev
60|Oise|continentale
61|Orne|oceanique_deg
62|Pas-de-Calais|continentale_sev
63|Puy-de-Dôme|montagne
64|Pyrénées-Atlantiques|sud_ouest
65|Hautes-Pyrénées|montagne
66|Pyrénées-Orientales|med_int
67|Bas-Rhin|continentale_sev
68|Haut-Rhin|continentale_sev
69|Rhône|rhone
70|Haute-Saône|montagne
71|Saône-et-Loire|continentale
72|Sarthe|continentale
73|Savoie|haute_mont
74|Haute-Savoie|haute_mont
75|Paris|continentale
76|Seine-Maritime|oceanique_deg
77|Seine-et-Marne|continentale
78|Yvelines|continentale
79|Deux-Sèvres|oceanique_deg
80|Somme|continentale_sev
81|Tarn|sud_ouest
82|Tarn-et-Garonne|sud_ouest
83|Var|med
84|Vaucluse|med_int
85|Vendée|oceanique_deg
86|Vienne|oceanique_deg
87|Haute-Vienne|continentale
88|Vosges|continentale_sev
89|Yonne|continentale
90|Territoire de Belfort|continentale_sev
91|Essonne|continentale
92|Hauts-de-Seine|continentale
93|Seine-Saint-Denis|continentale
94|Val-de-Marne|continentale
95|Val-d'Oise|continentale
2A|Corse-du-Sud|med_int
2B|Haute-Corse|med_int`;
function buildDepartementsFrance(){
  const y=typeof OEDIP_DJU_DEFAULT_REF!=="undefined"?OEDIP_DJU_DEFAULT_REF:"moyenne";
  const b=typeof OEDIP_DJU_DEFAULT_BASE!=="undefined"?OEDIP_DJU_DEFAULT_BASE:17;
  return DEPT_LINES.trim().split("\n").map(line=>{
    const [code,nom,zone]=line.split("|");
    const z=DEPT_CLIM_ZONES[zone]||DEPT_CLIM_ZONES.continentale;
    const djuSd=djuForDepartment(code,y,b);
    return {code,nom,cp:code==="2A"||code==="2B"?"20":code,tbase:z.tbase,dju:djuSd??2200,zone,djuAnnee:y,djuBase:b};
  }).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
}
function refreshDjuOnDepartements(depts){
  const y=state.reglages?.djuAnnee??OEDIP_DJU_DEFAULT_REF??"moyenne";
  const b=state.reglages?.djuBase??OEDIP_DJU_DEFAULT_BASE??17;
  return depts.map(d=>{
    const v=djuForDepartment(d.code,y,b);
    return {...d,dju:v??d.dju,djuAnnee:y,djuBase:b};
  });
}
function mergeDepartements(imported){
  const map=new Map(buildDepartementsFrance().map(d=>[d.code,d]));
  (imported||[]).forEach(d=>{ if(d&&d.code) map.set(d.code,{...map.get(d.code),...d,nom:d.nom||map.get(d.code)?.nom}); });
  return refreshDjuOnDepartements([...map.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})));
}
function deptFromPostalCode(cp){
  const s=String(cp||"").replace(/\D/g,"");
  if(s.length<2) return null;
  if(s.startsWith("20")){ const n=parseInt(s.slice(0,5),10); return !isNaN(n)&&n>=20200?"2B":"2A"; }
  if(s.startsWith("97")) return s.slice(0,3);
  return s.slice(0,2);
}
function findDeptByCode(code){
  if(code==null||code==="") return null;
  const c=String(code);
  return state.departements.find(d=>d.code===c)||state.departements.find(d=>d.code===c.padStart(2,"0"));
}
function ensureDepartements(){ state.departements=mergeDepartements(state.departements); }

/** Seuil minimal de couverture affiché / sélectionnable (%, défaut 70). */
function selectionCouvMinPct() {
  const v = +(state.reglages?.selectionCouvMin ?? 70);
  if (!Number.isFinite(v)) return 70;
  return Math.max(50, Math.min(100, v));
}

/** DJU SDES + métadonnées pour le moteur (source unique : oedip-dju-departements.js). */
function resolveProjectDju(deptCode){
  const rg=state?.reglages||{};
  const y=rg.djuAnnee??OEDIP_DJU_DEFAULT_REF??"moyenne";
  const b=+rg.djuBase||OEDIP_DJU_DEFAULT_BASE||17;
  let dju=typeof djuForDepartment==="function"?djuForDepartment(deptCode,y,b):null;
  const d=findDeptByCode(deptCode);
  if(dju==null&&d) dju=d.dju;
  if(dju==null) dju=2200;
  const baseFactor=b===15?(rg.baseFactorDJU15??0.93):(rg.baseFactorDJU??0.702);
  return {dju,djuAnnee:y,djuBase:b,baseFactor,zone:d?.zone||"continentale",dept:d};
}

function djuRefLabel(ref){
  return ref==="moyenne"||ref==="avg"?"Moyenne 1990–2025":String(ref);
}

function zoneMeanDjuSdes(zone,year,base){
  if(typeof djuForDepartment!=="function") return null;
  const y=year??OEDIP_DJU_DEFAULT_REF??"moyenne";
  const b=base||OEDIP_DJU_DEFAULT_BASE;
  const vals=state.departements.filter(d=>d.zone===zone).map(d=>djuForDepartment(d.code,y,b)).filter(v=>v!=null);
  return vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:null;
}

