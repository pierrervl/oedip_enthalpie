/* OEDIP — données initiales (catalogue) — ne pas modifier l'ordre de chargement dans geoselect.html */
const SEED = {
  meta:{ outil:"OEDIP", version:"v2.0 web", millesime:2025, utilisateur:"" },
  reglages:{ tnc:14.58, baseFactorDJU:0.702, baseFactorDJU15:0.93, pasMatrice:1, djuAnnee:"moyenne", djuBase:17 }, // DJU SDES · "moyenne" = 1990–2025 ou année précise
  prix:{ elec:0.2100, fuelL:1.10, rdtFuel:92, gazKwh:0.1200, rdtGaz:93, granKg:0.45, rdtGran:90, bucheKwh:0.075, rdtBuche:75 },
  pci:{ fuelL:9.97, granKg:4.8 }, // kWh par unité
  co2:{ pac:60, joule:60, fuel:324, gaz:227, gran:30, buche:30 }, // gCO2/kWh utile (élec FR ~60)
  isolationTypes:[
    {nom:"RE 2020 / RT 2012 (très isolé)", g:0.60},
    {nom:"RT 2005 (bien isolé)", g:0.90},
    {nom:"Isolation moyenne (années 90)", g:1.20},
    {nom:"Ancien partiellement isolé", g:1.45},
    {nom:"Ancien non isolé", g:1.80}
  ],
  emetteurs:[
    {nom:"Absent", regime:null, absent:1},
    {nom:"Plancher chauffant", regime:"20/25"},
    {nom:"Plancher chauffant", regime:"30/35"},
    {nom:"Ventilo-convecteur", regime:"40/45"},
    {nom:"Radiateur basse température", regime:"40/45"},
    {nom:"Radiateur Moy température", regime:"50/55"},
    {nom:"Radiateur haute température", regime:"60/65"}
  ],
  captages:[
    {nom:"Captage horizontal", mlParKw:35},
    {nom:"Forage vertical", mlParKw:18},
    {nom:"Eau de nappe", mlParKw:0}
  ],
  departements:buildDepartementsFrance(),
  gammes:[
    {nom:"Aqua+", code:2, fonction:"geothermie", fluide:"R407C",
      sources:PERF_SRC.slice(), departs:PERF_DEP.slice(),
      desc:"PAC eau glycolée/eau · 65°C max · multi-compresseur · captage horizontal, forage ou nappe"},
    {nom:"GMG", code:5, fonction:"geothermie", fluide:"R410A",
      sources:PERF_SRC.slice(), departs:PERF_DEP.slice(),
      desc:"PAC mono-compresseur géothermique · 55°C max · 6,7 à 225 kW"}
  ],
  machines:[
    {pac:"Aqua+ 3",   gammeCode:2, tension:2, nbComp:1, ref:4,  reversible:1, chargeFluide:2.8},
    {pac:"Aqua+ 4",   gammeCode:2, tension:2, nbComp:1, ref:5,  reversible:1, chargeFluide:3.2},
    {pac:"Aqua+ 5",   gammeCode:2, tension:2, nbComp:1, ref:6,  reversible:1, chargeFluide:3.8},
    {pac:"Aqua+ 2.2", gammeCode:2, tension:2, nbComp:2, ref:19, reversible:1, chargeFluide:4.5},
    {pac:"Aqua+ 4.2", gammeCode:2, tension:2, nbComp:2, ref:20, reversible:1, chargeFluide:5.2},
    {pac:"Aqua+ 6.2", gammeCode:2, tension:2, nbComp:2, ref:21, reversible:1, chargeFluide:6.4},
    {pac:"GMG 5 10",  gammeCode:5, tension:2, nbComp:1, ref:3,  reversible:1, chargeFluide:3.0},
    {pac:"GMG 5 12",  gammeCode:5, tension:2, nbComp:1, ref:4,  reversible:1, chargeFluide:3.5}
  ],
  /* performances : performances[pac]["src|dep"] = fiche (9 pages / machine) */
  performances:{
    "Aqua+ 3": mk({
      chaud:9.51,froid:6.60,absorbee:2.91,intensite:4.92,cop:3.27,hp:18.40,bp:2.96,debitR407C:42.80,
      froidM3H:2.10,pdcEvapF:2.06,pdcTuyF:1.10,pdcTotF:3.16, chaudM3H:1.64,pdcCondC:0.71,pdcTuyC:0.63,pdcTotC:1.34,
      capteurM2:128.00,capteurMl:160.00, capteurHoriz:128.00,capteurVert:160.00, iMax230:4.92,iMax400:null,diamCoude:33,diamLyre:42,pCaptSpec:30,
      etaS30:176,etaS50:120,
      reg:{"30/35°C":[9.75,5.30,1.84],"40/45°C":[10.19,4.30,2.37],"50/55°C":[9.51,3.27,2.91]} }),
    "Aqua+ 4": mk({
      chaud:11.35,froid:7.93,absorbee:3.42,intensite:5.50,cop:3.32,hp:18.14,bp:2.98,debitR407C:50.10,
      froidM3H:2.52,pdcEvapF:1.79,pdcTuyF:1.47,pdcTotF:3.26, chaudM3H:1.95,pdcCondC:0.60,pdcTuyC:0.84,pdcTotC:1.44,
      capteurM2:150.80,capteurMl:180.00, capteurHoriz:150.80,capteurVert:180.00, iMax230:5.50,iMax400:null,diamCoude:33,diamLyre:42,pCaptSpec:30,
      etaS30:178,etaS50:121,
      reg:{"30/35°C":[11.35,5.59,2.03],"40/45°C":[11.72,4.25,2.76],"50/55°C":[11.35,3.32,3.42]} }),
    "Aqua+ 5": mk({
      chaud:14.47,froid:10.10,absorbee:3.85,intensite:7.10,cop:3.29,hp:18.30,bp:2.95,debitR407C:62.00,
      froidM3H:3.20,pdcEvapF:2.10,pdcTuyF:1.55,pdcTotF:3.65, chaudM3H:2.49,pdcCondC:0.80,pdcTuyC:0.95,pdcTotC:1.75,
      capteurM2:185.00,capteurMl:220.00, capteurHoriz:185.00,capteurVert:220.00, iMax230:7.10,iMax400:null,diamCoude:40,diamLyre:49,pCaptSpec:30,
      etaS30:175,etaS50:119,
      reg:{"30/35°C":[14.80,5.40,2.74],"40/45°C":[15.30,4.28,3.57],"50/55°C":[14.47,3.29,4.40]} }),
    "Aqua+ 2.2": mk({
      chaud:10.58,froid:8.72,absorbee:3.50,intensite:7.36,cop:3.02,hp:18.78,bp:2.83,debitR407C:29.20,
      froidM3H:2.77,pdcEvapF:0.75,pdcTuyF:0.59,pdcTotF:1.34, chaudM3H:1.82,pdcCondC:0.31,pdcTuyC:0.36,pdcTotC:0.67,
      capteurM2:172.40,capteurMl:200.00, capteurHoriz:172.40,capteurVert:200.00, iMax230:7.36,iMax400:null,diamCoude:33,diamLyre:42,pCaptSpec:30,
      etaS30:170,etaS50:118,
      reg:{"30/35°C":[13.24,4.83,2.74],"40/45°C":[11.60,4.03,2.88],"50/55°C":[10.58,3.02,3.50]} }),
    "Aqua+ 4.2": mk({
      chaud:15.02,froid:10.62,absorbee:4.34,intensite:7.36,cop:3.24,hp:18.88,bp:2.80,debitR407C:32.20,
      froidM3H:3.37,pdcEvapF:0.85,pdcTuyF:0.70,pdcTotF:1.55, chaudM3H:2.58,pdcCondC:0.36,pdcTuyC:0.42,pdcTotC:0.78,
      capteurM2:190.00,capteurMl:250.00, capteurHoriz:190.00,capteurVert:250.00, iMax230:7.36,iMax400:null,diamCoude:40,diamLyre:49,pCaptSpec:30,
      etaS30:172,etaS50:120,
      reg:{"30/35°C":[14.78,4.93,3.00],"40/45°C":[16.10,4.26,3.78],"50/55°C":[15.02,3.24,4.34]} }),
    "Aqua+ 6.2": mk({
      chaud:19.70,froid:14.00,absorbee:5.30,intensite:9.60,cop:3.18,hp:18.90,bp:2.78,debitR407C:42.00,
      froidM3H:4.40,pdcEvapF:1.10,pdcTuyF:0.90,pdcTotF:2.00, chaudM3H:3.39,pdcCondC:0.48,pdcTuyC:0.55,pdcTotC:1.03,
      capteurM2:235.00,capteurMl:300.00, capteurHoriz:235.00,capteurVert:300.00, iMax230:9.60,iMax400:null,diamCoude:40,diamLyre:49,pCaptSpec:30,
      etaS30:171,etaS50:119,
      reg:{"30/35°C":[19.50,4.85,4.02],"40/45°C":[21.20,4.18,5.07],"50/55°C":[19.70,3.18,6.20]} }),
    "GMG 5 10": mkSimple(9.25,4.30),
    "GMG 5 12": mkSimple(11.15,4.30)
  },
  frigoLayoutPresets:[],
  hydroLayoutPresets:[]
};
let state = JSON.parse(JSON.stringify(SEED));
ensureDepartements();
migratePerformances();
let projet = defaultProjet();
normalizeEmetteurs();
function defaultProjet(){
  return {
    client:{ref:"",type:"",nom:"",adr:"",cp:"",ville:"",installateur:"",referent:""},
    batiment:{dept:"51",littoral:0,alt:0,volMode:"surf",s1:200,h1:2.5,s2:0,h2:2.5,vol:500,tint:22,isoMode:"auto",isoType:0,gman:0.6},
    besoin:{pDirectMode:0,pDir:12,rdt:100,surp:0,zones:[{nom:"RDC",surfaceM2:200,hauteur:2.5,emIdx:3,nbEmetteurs:0}]},
    ecs:{present:0,nb:4,volPers:60},
    source:{gamme:0,regimeSource:1,tension:2,reversible:0,captage:1},
    hydraulique:{}
  };
}

