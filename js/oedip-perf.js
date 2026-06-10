/* OEDIP — performances (mk, migration) — ne pas modifier l'ordre de chargement dans oedip.html */
function normSrc(s){
  if(!s) return "0/-3";
  s=String(s).replace(/°C/gi,"").trim();
  if(/0\s*\/\s*-?3/.test(s)) return "0/-3";
  if(/5\s*\/\s*2|6\s*\/\s*2/.test(s)) return "5/2";
  if(/9\s*\/\s*6|-2\s*\/\s*-?5/.test(s)) return "9/6";
  const m=s.match(/(-?\d+\s*\/\s*-?\d+)/); return m?m[1].replace(/\s/g,""):s;
}
function normDep(d){
  if(!d) return "40/45";
  d=String(d).replace(/°C/gi,"").trim();
  if(/60\s*\/\s*65/.test(d)) return "47/55";
  if(/47\s*\/\s*55|50\s*\/\s*55/.test(d)) return "47/55";
  if(/40\s*\/\s*45/.test(d)) return "40/45";
  if(/30\s*\/\s*35|20\s*\/\s*25/.test(d)) return "30/35";
  return d.replace(/\s/g,"");
}
function pageKey(src,dep){ return normSrc(src)+"|"+normDep(dep); }
function parsePageKey(k){ const i=k.indexOf("|"); return {src:k.slice(0,i),dep:k.slice(i+1)}; }
function syncCop(f){
  if(!f) return;
  if(f.chaud&&f.absorbee) f.cop=+(f.chaud/f.absorbee).toFixed(2);
  else if(f.chaud&&f.cop) f.absorbee=+(f.chaud/f.cop).toFixed(2);
}
function mkPage(o){
  const f=Object.assign({
    chaud:0,froid:0,absorbee:0,intensite:0,cop:0,
    hp:null,bp:null,debitR407C:null,froidM3H:null,pdcEvapF:null,pdcTuyF:null,pdcTotF:null,
    chaudM3H:null,pdcCondC:null,pdcTuyC:null,pdcTotC:null,
    capteurM2:null,capteurMl:null,capteurHoriz:null,capteurVert:null,
    iMax230:null,iMax400:null,diamCoude:null,diamLyre:null,pCaptSpec:30,etaS30:null,etaS50:null
  },o||{});
  syncCop(f); return f;
}
function copyThermoBase(f){
  if(!f) return {};
  const {chaud,froid,absorbee,intensite,cop,hp,bp,debitR407C,froidM3H,pdcEvapF,pdcTuyF,pdcTotF,chaudM3H,pdcCondC,pdcTuyC,pdcTotC,
    capteurM2,capteurMl,capteurHoriz,capteurVert,iMax230,iMax400,diamCoude,diamLyre,pCaptSpec,etaS30,etaS50}=f;
  return {chaud,froid,absorbee,intensite,cop,hp,bp,debitR407C,froidM3H,pdcEvapF,pdcTuyF,pdcTotF,chaudM3H,pdcCondC,pdcTuyC,pdcTotC,
    capteurM2,capteurMl,capteurHoriz,capteurVert,iMax230,iMax400,diamCoude,diamLyre,pCaptSpec,etaS30,etaS50};
}
/** Données « description générale » (import gamme) → champs hydrauliques des fiches perf */
function perfBaseFromGeneral(g){
  if(!g||typeof g!=="object") return {};
  const h=g.hydraulique||{}, e=g.electrique||{};
  const base={};
  if(h.debitCaptageM3h) base.froidM3H=h.debitCaptageM3h;
  if(h.pdcCaptageKpa) base.pdcTotF=h.pdcCaptageKpa;
  if(h.debitChauffageM3h) base.chaudM3H=h.debitChauffageM3h;
  if(h.pdcChauffageKpa) base.pdcTotC=h.pdcChauffageKpa;
  if(e.appointElectriqueKw) base.appointKW=e.appointElectriqueKw;
  return base;
}
function applyMachineGeneralToPerf(pac,general){
  const base=perfBaseFromGeneral(general);
  if(!base||!Object.keys(base).length) return;
  const pm=state.performances[pac];
  if(!pm) return;
  Object.keys(pm).forEach(k=>{
    if(k.startsWith("_")) return;
    pm[k]=mkPage({...pm[k],...base});
  });
}
function defaultMachineGeneral(){
  return {
    dimensions:{poidsKg:null,hauteurMm:null,largeurMm:null,profondeurMm:null},
    acoustique:{puissanceAcoustiqueDb:null},
    hydraulique:{connexion:null,debitCaptageM3h:null,pdcCaptageKpa:null,circulateurFroid:null,debitChauffageM3h:null,pdcChauffageKpa:null,circulateurChaud:null},
    ecs:{ballonL:null,ballon:null,circulateurEcs:null},
    electrique:{tension:null,cableAlimentation:null,protection:null,appointElectriqueKw:null}
  };
}
function ensureMachineGeneral(m){
  if(!m) return null;
  if(!m.general||typeof m.general!=="object") m.general=defaultMachineGeneral();
  const d=m.general;
  if(!d.dimensions) d.dimensions=defaultMachineGeneral().dimensions;
  if(!d.acoustique) d.acoustique=defaultMachineGeneral().acoustique;
  if(!d.hydraulique) d.hydraulique=defaultMachineGeneral().hydraulique;
  if(!d.ecs) d.ecs=defaultMachineGeneral().ecs;
  if(!d.electrique) d.electrique=defaultMachineGeneral().electrique;
  return d;
}
function initMachinePages(pac){
  state.performances[pac]=state.performances[pac]||{};
  PERF_SRC.forEach(s=>PERF_DEP.forEach(d=>{
    const k=pageKey(s,d);
    if(!state.performances[pac][k]) state.performances[pac][k]=mkPage({});
  }));
}
function getFiche(perf,pac,src,dep){
  if(!perf||!perf[pac]) return null;
  return perf[pac][pageKey(src,dep)]||null;
}
function migratePerformances(){
  const perfs=state.performances;
  Object.keys(perfs).forEach(pac=>{
    const pm=perfs[pac]; if(!pm||typeof pm!=="object") return;
    const next={};
    let migrated=false;
    Object.keys(pm).forEach(key=>{
      if(key==="_migrated") return;
      const f=pm[key];
      if(!f||typeof f!=="object") return;
      if(f.reg){
        migrated=true;
        const base=copyThermoBase(f);
        Object.keys(f.reg).forEach(dep=>{
          const r=f.reg[dep];
          const pk=pageKey(key,dep);
          next[pk]=mkPage({...base,chaud:r.puissance||0,cop:r.cop||0,absorbee:r.consoElec||0});
        });
      } else if(key.includes("|")){
        next[key]=mkPage(f);
      } else {
        migrated=true;
        PERF_DEP.forEach(dep=>{ next[pageKey(key,dep)]=mkPage(copyThermoBase(f)); });
      }
    });
    if(migrated||Object.keys(next).length){
      PERF_SRC.forEach(s=>PERF_DEP.forEach(d=>{
        const pk=pageKey(s,d); if(!next[pk]) next[pk]=mkPage({});
      }));
      perfs[pac]=next;
    } else initMachinePages(pac);
  });
}
function cleanPerformancesForExport(perf){
  const out={};
  Object.keys(perf).forEach(pac=>{
    out[pac]={};
    Object.keys(perf[pac]).forEach(k=>{
      if(k!=="_migrated") out[pac][k]=perf[pac][k];
    });
  });
  return out;
}
/* fabrique une fiche (seed) à partir d'un objet partiel + tableau reg legacy */
function regToPerfDep(dep){
  if(/50\s*\/\s*55|60\s*\/\s*65/.test(dep)) return "47/55";
  return normDep(dep);
}
function mk(o){
  const pages={}, base=copyThermoBase(o);
  if(o.reg){
    Object.keys(o.reg).forEach(dep=>{
      const a=o.reg[dep], pd=regToPerfDep(dep);
      if(!PERF_DEP.includes(pd)) return;
      const a0=a[0]||0, a1=a[1]||0, a2=a[2]||0;
      pages[pageKey("0/-3",pd)]=mkPage({...base,chaud:a0,cop:a1,absorbee:a2|| (a1?a0/a1:0)});
    });
  }
  PERF_SRC.forEach(s=>PERF_DEP.forEach(d=>{
    const k=pageKey(s,d); if(!pages[k]) pages[k]=mkPage({...base});
  }));
  return pages;
}
function mkSimple(p4045,cop4045){
  const pages={};
  const facteurs={"30/35":[1.08,1.25],"40/45":[1,1],"47/55":[0.92,0.78]};
  PERF_SRC.forEach(s=>{
    PERF_DEP.forEach(dep=>{
      const f=facteurs[dep]||[1,1];
      const p=+(p4045*f[0]).toFixed(2), cop=+(cop4045*f[1]).toFixed(2);
      pages[pageKey(s,dep)]=mkPage({chaud:p,cop,absorbee:cop?+(p/cop).toFixed(2):0,froid:p*0.7});
    });
  });
  return pages;
}

