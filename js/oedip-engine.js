/* OEDIP — moteur de calcul — ne pas modifier l'ordre de chargement dans oedip.html */
/* ---------- 2. MOTEUR (fonctions pures) ---------- */
const Engine = {
  volumeRetenu(b, bs){
    if(bs?.zones?.length&&typeof zonesVolumeM3==="function") return zonesVolumeM3(bs.zones);
    return b.volMode==="surf" ? (b.s1*b.h1+b.s2*b.h2) : (+b.vol||0);
  },
  coeffG(b,iso){ return b.isoMode==="manuel" ? (+b.gman||0) : (iso[b.isoType]?iso[b.isoType].g:0.6); },
  tbaseRef(b,depts){ const d=depts.find(x=>x.code===b.dept); return d?d.tbase:-7; },
  tbase(b,depts){
    let t=Engine.tbaseRef(b,depts);
    t-=(b.alt>200?Math.floor(b.alt/200):0);
    if(b.littoral==1) t+=1;
    return t;
  },
  deperditions(G,V,Tint,Tbase,rdt,pm,pd){ if(pm==1) return +pd||0; const r=(rdt||100)/100||1; return (G*V*(Tint-Tbase))/1000/r; },
  puissanceECS(ecs){ return ecs.present ? ecs.nb*0.06 : 0; },
  volumeBallon(ecs){ return ecs.present ? ecs.nb*ecs.volPers : 0; },
  puissanceAInstaller(dep,surp,pECS){ return dep*(1+(surp||0)/100)+pECS; },
  pCalo(perf,pac,src,dep){ const f=getFiche(perf,pac,src,dep); return f&&f.chaud>0?f.chaud:null; },
  copReg(perf,pac,src,dep){ const f=getFiche(perf,pac,src,dep); return f&&f.cop?f.cop:null; },

  /* ----- MATRICE D'INTÉGRATION DJU PAR TRANCHES DE TEMPÉRATURE ----- */
  matriceDJU(Tbase,tnc,dju,baseFactor,pas){
    const djuTnc=dju*baseFactor, targetDH=djuTnc*24, bins=[]; let dhProv=0;
    pas=pas||1;
    for(let t=Math.ceil(Tbase); t<=Math.floor(tnc); t+=pas){
      const w=(t-Tbase+1); bins.push({t,w}); dhProv+=w*(tnc-t);
    }
    const s = dhProv>0? targetDH/dhProv : 0;
    bins.forEach(b=>{ b.hours=b.w*s; delete b.w; });
    return bins;
  },
  /* intègre besoin, conso élec, SCOP, heures, point de bivalence, appoint */
  integrer(G,V,Tint,Tbase,rdt,tnc,dju,baseFactor,pas, copParRegime, Ppac){
    const r=(rdt||100)/100||1;
    const cop=copParRegime||3.5;
    const bins=Engine.matriceDJU(Tbase,tnc,dju,baseFactor,pas);
    let besoin=0,elec=0,heures=0,appoint=0,heuresAppoint=0,Tbiv=null;
    let cumBesoin=0,cumElec=0;
    bins.forEach(b=>{
      const depNet = G*V*(tnc-b.t)/1000/r;
      const depGross = G*V*(Tint-b.t)/1000/r;
      const e = depNet*b.hours;
      const kwhElec=e/cop;
      let kwhAppoint=0;
      if(Ppac && depGross>Ppac){
        if(Tbiv===null) Tbiv=b.t;
        const partPac=Ppac/depGross;
        kwhAppoint=e*(1-partPac);
        appoint += kwhAppoint;
        heuresAppoint += b.hours;
      }
      cumBesoin+=e;
      cumElec+=kwhElec;
      b.kwhBesoin=e;
      b.kwhElec=kwhElec;
      b.kwhAppoint=kwhAppoint;
      b.cumBesoin=cumBesoin;
      b.cumElec=cumElec;
      besoin += e;
      elec += kwhElec;
      heures += b.hours;
    });
    return {besoin,elec,scop: elec>0?besoin/elec:0,heures,appoint,heuresAppoint,Tbiv,bins,cop};
  },
  /* sélection mono/multi — affiche les machines entre couvMin % et ~150 % du besoin */
  selection(machines, perf, gammeCode, tension, reversible, src, dep, cible, opts) {
    opts = opts || {};
    const minPct = opts.couvMinPct != null ? +opts.couvMinPct : 70;
    const maxPct = opts.couvMaxPct != null ? +opts.couvMaxPct : 150;
    const minP = cible * minPct / 100;
    const maxP = cible * maxPct / 100;
    const matchT = (mt) => mt === 2 || tension === 2 || mt === tension;
    const cand = machines.filter((m) => m.gammeCode === gammeCode && matchT(m.tension) && m.reversible >= reversible)
      .map((m) => {
        const pc = Engine.pCalo(perf, m.pac, src, dep);
        const gamme = typeof gammeByCode === "function" ? gammeByCode(gammeCode) : null;
        const depTemp = opts.depTemp != null ? opts.depTemp : emitterDepartureTemp(dep);
        const cop = typeof resolveMachineCop === "function"
          ? resolveMachineCop(perf, m.pac, src, dep, depTemp, gamme)
          : Engine.copReg(perf, m.pac, src, dep);
        return { ...m, pCalo: pc, cop, couverture: pc ? pc / cible * 100 : null };
      }).filter((m) => m.pCalo != null && m.pCalo > 0);
    const pick = (arr) => {
      arr.sort((a, b) => a.pCalo - b.pCalo);
      let band = arr.filter((m) => m.pCalo >= minP && m.pCalo <= maxP);
      if (!band.length) {
        const below = arr.filter((m) => m.pCalo < cible).slice(-2);
        const above = arr.filter((m) => m.pCalo >= cible).slice(0, 2);
        band = [...below, ...above].filter((m, i, a) => a.findIndex((x) => x.pac === m.pac) === i);
      }
      if (!band.length) return [];
      const i100 = band.findIndex((m) => m.pCalo >= cible);
      if (i100 === -1) return band.slice(-4);
      const start = Math.max(0, i100 - 2);
      const end = Math.min(band.length, i100 + 3);
      return band.slice(start, end);
    };
    return { mono: pick(cand.filter((m) => m.nbComp === 1)), multi: pick(cand.filter((m) => m.nbComp >= 2)), couvMinPct: minPct };
  },

  /* Répartition journalière : totaux annuels DJU → kWh par jour (profil climatique mensuel) */
  MONTH_HDD:{
    oceanique:[20,18,16,9,4,1,0.4,0.5,2,7,14,19],
    oceanique_deg:[21,19,17,10,4,1,0.4,0.5,2,8,15,20],
    sud_ouest:[18,16,14,8,3,1,0.3,0.4,2,6,12,17],
    continentale:[22,20,18,11,5,1.2,0.5,0.6,2.5,9,16,22],
    continentale_sev:[24,22,20,12,5,1.2,0.5,0.6,2.5,10,17,24],
    rhone:[23,21,19,11,5,1,0.4,0.5,2,9,16,22],
    montagne:[26,24,22,13,6,1.5,0.6,0.7,3,10,18,25],
    haute_mont:[28,26,24,14,7,2,0.8,0.9,3.5,11,19,27],
    med:[12,10,9,6,3,1,0.8,1,2,5,9,13],
    med_int:[16,14,12,8,4,1.2,0.5,0.6,2,6,11,16]
  },
  /** Poids mensuels : profil saison + intensité DJU SDES du département vs moyenne zone. */
  monthlyWeightsSdes(deptCode,zone,year,base){
    const baseW=Engine.MONTH_HDD[zone]||Engine.MONTH_HDD.continentale;
    const deptDju=typeof djuForDepartment==="function"?djuForDepartment(deptCode,year,base):null;
    const zoneAvg=typeof zoneMeanDjuSdes==="function"?zoneMeanDjuSdes(zone,year,base):null;
    const k=deptDju&&zoneAvg?deptDju/zoneAvg:1;
    const winter=[0,1,11], mid=[2,3,4,9,10], summer=[5,6,7,8];
    return baseW.map((w,i)=>{
      if(winter.includes(i)) return w*k;
      if(summer.includes(i)) return w/Math.max(k,0.85);
      return w*Math.sqrt(k);
    });
  },
  repartitionJournaliere(deptCode,zone,year,base,besoin,elec,appoint,cop){
    const weights=Engine.monthlyWeightsSdes(deptCode,zone,year,base);
    const sumW=weights.reduce((a,b)=>a+b,0)||1;
    const dim=[31,28,31,30,31,30,31,31,30,31,30,31];
    const mois=["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];
    const ratioApp=besoin>0?(appoint||0)/besoin:0;
    const days=[];
    let doy=0;
    for(let m=0;m<12;m++){
      const mB=besoin*weights[m]/sumW;
      const dB=mB/dim[m], dE=(elec*weights[m]/sumW)/dim[m];
      for(let d=1;d<=dim[m];d++){
        doy++;
        days.push({
          doy, month:m+1, day:d, label:d+" "+mois[m],
          kwhBesoin:dB, kwhElec:dE, kwhAppoint:dB*ratioApp
        });
      }
    }
    let cb=0, ce=0, ca=0;
    days.forEach(x=>{
      cb+=x.kwhBesoin; ce+=x.kwhElec; ca+=x.kwhAppoint;
      x.cumBesoin=cb; x.cumElec=ce; x.cumAppoint=ca;
    });
    const sB=cb, sE=ce;
    if(sB>0&&Math.abs(sB-besoin)>0.01){
      const kB=besoin/sB, kE=elec/(sE||1);
      cb=0; ce=0; ca=0;
      days.forEach(x=>{
        x.kwhBesoin*=kB;
        x.kwhElec*=kE;
        x.kwhAppoint=x.kwhBesoin*ratioApp;
        cb+=x.kwhBesoin; ce+=x.kwhElec; ca+=x.kwhAppoint;
        x.cumBesoin=cb; x.cumElec=ce; x.cumAppoint=ca;
      });
    }
    const last=days[days.length-1];
    if(last){
      const diffB=besoin-days.reduce((a,x)=>a+x.kwhBesoin,0);
      const diffE=elec-days.reduce((a,x)=>a+x.kwhElec,0);
      last.kwhBesoin+=diffB;
      last.kwhElec+=diffE;
      last.kwhAppoint=Math.max(0,last.kwhBesoin*ratioApp);
      let cb=0, ce=0, ca=0;
      days.forEach(x=>{
        cb+=x.kwhBesoin; ce+=x.kwhElec; ca+=x.kwhAppoint;
        x.cumBesoin=cb; x.cumElec=ce; x.cumAppoint=ca;
      });
    }
    return days;
  }
};

/* ---------- 3. CALCUL GLOBAL ---------- */
let LAST={};
function compute(){
  const b=projet.batiment,bs=projet.besoin,ecs=projet.ecs,s=projet.source,rg=state.reglages;
  const V=Engine.volumeRetenu(b,bs), G=Engine.coeffG(b,state.isolationTypes), Tbase=Engine.tbase(b,state.departements);
  const dep=Engine.deperditions(G,V,b.tint,Tbase,bs.rdt,bs.pDirectMode,bs.pDir);
  const pECS=Engine.puissanceECS(ecs), pInst=Engine.puissanceAInstaller(dep,bs.surp,pECS);
  const dj=resolveProjectDju(b.dept);
  const gamme=state.gammes[s.gamme]||state.gammes[0];
  if(!gamme) return {V,G,Tbase,TbaseRef:Engine.tbaseRef(b,state.departements),dep,pECS,pInst,dju:dj.dju,djuAnnee:dj.djuAnnee,djuBase:dj.djuBase,cop:3.5,src:"0/-3",depRegime:"40/45",gamme:null,zone:dj.zone,besoin:0,elec:0,scop:0,heures:0,appoint:0,Tbiv:null,economie:0,integ:{besoin:0,elec:0,scop:0,heures:0,appoint:0,heuresAppoint:0,Tbiv:null,bins:[],daily:[]}};
  const srcRaw=gamme.sources[s.regimeSource]||gamme.sources[0];
  const src=normSrc(srcRaw);
  const emCtx=resolveEmitterContext(bs);
  const depRegime=emCtx.depPerf;
  let pacForCop=(typeof chosen!=="undefined"&&chosen?.pac)?chosen.pac:null;
  if(pacForCop){
    const m=typeof machineByPac==="function"?machineByPac(pacForCop):null;
    if(!m||m.gammeCode!==gamme.code) pacForCop=null;
  }
  const copCatalog=medianeCop(gamme,src,depRegime);
  const cop=resolveStudyCop(state.performances,gamme,src,emCtx,pacForCop)||copCatalog||3.5;
  const integ=Engine.integrer(G,V,b.tint,Tbase,bs.rdt,rg.tnc,dj.dju,dj.baseFactor,rg.pasMatrice,cop,pInst);
  integ.daily=Engine.repartitionJournaliere(b.dept,dj.zone,dj.djuAnnee,dj.djuBase,integ.besoin,integ.elec,integ.appoint,cop);
  const economie = integ.besoin>0 ? (integ.besoin-integ.elec)/integ.besoin*100 : 0;
  const hydro=typeof computeHydrauliqueChauffage==="function"?computeHydrauliqueChauffage(pInst,bs,projet,state.emetteurs,{gamme,src,depRegime}):null;
  const radTx=typeof computeRadiatorTransmission==="function"?computeRadiatorTransmission(bs,projet,state.emetteurs):null;
  LAST={V,G,Tbase,TbaseRef:Engine.tbaseRef(b,state.departements),dep,pECS,pInst,dju:dj.dju,djuAnnee:dj.djuAnnee,djuBase:dj.djuBase,
        cop,copCatalog,copPac:pacForCop,copFromMachine:!!pacForCop,src,depRegime,regimeEmitter:emCtx.regimeEmitter,depTemp:emCtx.depTemp,emetteurLabel:emCtx.emetteurLabel,gamme,zone:dj.zone,
        besoin:integ.besoin,elec:integ.elec,scop:integ.scop,heures:integ.heures,
        appoint:integ.appoint,Tbiv:integ.Tbiv,economie,hydro,radTransmission:radTx,integ};
  return LAST;
}
function medianeCop(gamme,srcPerf,dep){
  const c=[]; state.machines.filter(m=>m.gammeCode===gamme.code).forEach(m=>{const v=Engine.copReg(state.performances,m.pac,srcPerf,dep);if(v)c.push(v);});
  if(!c.length)return null; c.sort((a,b)=>a-b); return c[Math.floor(c.length/2)];
}
function perfDeparts(gamme){
  const d=(gamme?.departs?.length?gamme.departs:PERF_DEP).map(normDep);
  return [...new Set(d)];
}
function machineCopPoints(perf,pac,src,gamme){
  return perfDeparts(gamme).map(dep=>({t:emitterDepartureTemp(dep),cop:Engine.copReg(perf,pac,src,dep)})).filter(p=>p.cop!=null);
}
/** Interpolation COP sur la température de départ émetteur (points catalogue). */
function interpolateCopByDepTemp(pts,targetTemp){
  if(!pts.length) return null;
  pts=pts.slice().sort((a,b)=>a.t-b.t);
  const t=+targetTemp;
  if(t<=pts[0].t){
    const slope=pts.length>1?(pts[1].cop-pts[0].cop)/(pts[1].t-pts[0].t):0;
    return +Math.max(1,pts[0].cop+slope*(t-pts[0].t)).toFixed(2);
  }
  if(t>=pts[pts.length-1].t){
    const n=pts.length-1;
    const slope=n>0?(pts[n].cop-pts[n-1].cop)/(pts[n].t-pts[n-1].t):0;
    return +Math.max(1,pts[n].cop+slope*(t-pts[n].t)).toFixed(2);
  }
  for(let i=0;i<pts.length-1;i++){
    if(t>=pts[i].t&&t<=pts[i+1].t){
      const f=(t-pts[i].t)/(pts[i+1].t-pts[i].t);
      return +(pts[i].cop+f*(pts[i+1].cop-pts[i].cop)).toFixed(2);
    }
  }
  return pts[0].cop;
}
/** COP catalogue d'une machine : régime source étude + émetteur le plus exigeant (interpolation sur T° départ). */
function resolveMachineCop(perf,pac,src,depPerf,depTemp,gamme){
  const t=depTemp!=null?depTemp:emitterDepartureTemp(depPerf);
  const interp=interpolateCopByDepTemp(machineCopPoints(perf,pac,src,gamme),t);
  if(interp!=null) return interp;
  return Engine.copReg(perf,pac,src,depPerf)||null;
}
/** COP retenu pour l'étude : machine sélectionnée si présente, sinon médiane gamme. */
function resolveStudyCop(perf,gamme,src,emCtx,pac){
  if(pac) return resolveMachineCop(perf,pac,src,emCtx.depPerf,emCtx.depTemp,gamme)||medianeCop(gamme,src,emCtx.depPerf);
  return copInterpolateByDepTemp(gamme,src,emCtx.depTemp)||medianeCop(gamme,src,emCtx.depPerf);
}
/** COP médiane gamme en fonction de la température de départ émetteur. */
function copInterpolateByDepTemp(gamme,src,targetTemp){
  const pts=perfDeparts(gamme).map(dep=>({t:emitterDepartureTemp(dep),cop:medianeCop(gamme,src,dep)})).filter(p=>p.cop!=null);
  return interpolateCopByDepTemp(pts,targetTemp);
}

