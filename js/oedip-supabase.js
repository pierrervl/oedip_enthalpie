/* OEDIP — client Supabase (auth + études cloud) — charger avant oedip-workspace.js */
let _sbClient = null;
let _sbSession = null;
let _sbReady = false;

function sbIsReady() {
  return _sbReady && !!_sbClient;
}

function sbGetSession() {
  return _sbSession;
}

function sbInit() {
  const cfg = window.OEDIP_SUPABASE;
  if (!cfg?.url || !cfg?.anonKey || typeof supabase === "undefined") {
    _sbReady = false;
    return false;
  }
  if (cfg.anonKey.includes("YOUR_ANON_KEY")) {
    _sbReady = false;
    return false;
  }
  _sbClient = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  _sbReady = true;
  _sbClient.auth.onAuthStateChange((_event, session) => {
    _sbSession = session;
    if (typeof updateSbAuthUI === "function") updateSbAuthUI();
  });
  return true;
}

async function sbBootstrapAuth() {
  if (!sbInit()) return null;
  const { data, error } = await _sbClient.auth.getSession();
  if (error) console.warn("Supabase session:", error.message);
  _sbSession = data?.session || null;
  if (typeof updateSbAuthUI === "function") updateSbAuthUI();
  return _sbSession;
}

async function sbSignIn(email, password) {
  if (!sbIsReady()) throw new Error("Supabase non configuré");
  const { data, error } = await _sbClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _sbSession = data.session;
  if (typeof updateSbAuthUI === "function") updateSbAuthUI();
  return data;
}

async function sbSignUp(email, password) {
  if (!sbIsReady()) throw new Error("Supabase non configuré");
  const { data, error } = await _sbClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignOut() {
  if (!_sbClient) return;
  await _sbClient.auth.signOut();
  _sbSession = null;
  if (typeof updateSbAuthUI === "function") updateSbAuthUI();
}

async function sbEnsureSession() {
  if (!sbIsReady()) return null;
  if (_sbSession) return _sbSession;
  const { data, error } = await _sbClient.auth.getSession();
  if (error) console.warn("Supabase session:", error.message);
  _sbSession = data?.session || null;
  if (typeof updateSbAuthUI === "function") updateSbAuthUI();
  return _sbSession;
}

function sbCloudActive() {
  return sbIsReady() && !!_sbSession;
}

async function sbCloudActiveAsync() {
  return sbIsReady() && !!(await sbEnsureSession());
}

async function sbListStudies(limit = 80) {
  if (!sbIsReady() || !(await sbEnsureSession())) return [];
  const { data, error } = await _sbClient
    .from("studies")
    .select("id,name,updated_at,created_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function sbFetchStudy(id) {
  if (!sbIsReady() || !_sbSession) throw new Error("Non connecté");
  const { data, error } = await _sbClient.from("studies").select("id,name,payload,updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Étude introuvable");
  return data;
}

async function sbSaveStudy({ id, name, payload }) {
  if (!sbIsReady() || !(await sbEnsureSession())) throw new Error("Non connecté");
  const userId = _sbSession.user.id;
  const row = {
    user_id: userId,
    name: (name || "Étude").trim() || "Étude",
    payload,
  };
  if (id) {
    const { data, error } = await _sbClient
      .from("studies")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id,name,updated_at")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await _sbClient.from("studies").insert(row).select("id,name,updated_at").single();
  if (error) throw error;
  if (!data?.id) throw new Error("Insert cloud sans identifiant retourné");
  return data;
}

async function sbDeleteStudy(id) {
  if (!sbIsReady() || !_sbSession) throw new Error("Non connecté");
  const { error } = await _sbClient.from("studies").delete().eq("id", id).eq("user_id", _sbSession.user.id);
  if (error) throw error;
}

async function sbCloudDiagnostics() {
  if (!(await sbEnsureSession())) return { ok: false, reason: "Session absente" };
  const { count, error } = await _sbClient.from("studies").select("*", { count: "exact", head: true });
  if (error) return { ok: false, reason: error.message, code: error.code };
  return { ok: true, studiesCount: count ?? 0 };
}

async function sbReportCloudStatus() {
  const diag = await sbCloudDiagnostics();
  if (!diag.ok) {
    toast("Cloud : accès refusé — " + diag.reason);
    return diag;
  }
  toast("Cloud OK · " + diag.studiesCount + " étude(s) en ligne");
  return diag;
}

async function sbSaveMachineLibrary(payload, name = "default") {
  if (!sbIsReady() || !(await sbEnsureSession())) throw new Error("Non connecté");
  const userId = _sbSession.user.id;
  const { data: existing, error: findErr } = await _sbClient
    .from("machine_libraries")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .maybeSingle();
  if (findErr) throw findErr;
  const row = { user_id: userId, name, is_default: true, payload };
  if (existing?.id) {
    const { error } = await _sbClient.from("machine_libraries").update(row).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await _sbClient.from("machine_libraries").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}

async function sbLoadDefaultMachineLibrary() {
  if (!sbIsReady() || !_sbSession) return null;
  const { data, error } = await _sbClient
    .from("machine_libraries")
    .select("payload,updated_at")
    .eq("user_id", _sbSession.user.id)
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function updateSbAuthUI() {
  const btn = $("btnSbAuth");
  const label = $("sbAuthLabel");
  if (!btn || !label) return;
  if (_sbSession?.user) {
    const email = _sbSession.user.email || "Compte";
    label.textContent = email.split("@")[0].slice(0, 12);
    btn.title = "Connecté · " + email + "\nCliquer pour se déconnecter";
    btn.classList.add("sb-on");
  } else {
    label.textContent = "Cloud";
    btn.title = "Se connecter à Supabase pour enregistrer vos études en ligne";
    btn.classList.remove("sb-on");
  }
}

function showSbAuthModal() {
  if (_sbSession?.user) {
    if (confirm("Se déconnecter de OEDIP Cloud ?")) sbSignOut().then(() => toast("Déconnecté"));
    return;
  }
  $("modalSbAuth")?.classList.add("show");
  setTimeout(() => $("sbAuthEmail")?.focus(), 50);
}

function closeSbAuthModal() {
  $("modalSbAuth")?.classList.remove("show");
}

async function confirmSbAuth(mode) {
  const email = ($("sbAuthEmail")?.value || "").trim();
  const password = ($("sbAuthPassword")?.value || "").trim();
  const errEl = $("sbAuthError");
  if (errEl) errEl.textContent = "";
  if (!email || !password) {
    if (errEl) errEl.textContent = "Email et mot de passe requis.";
    return;
  }
  try {
    if (mode === "signup") {
      const { session } = await sbSignUp(email, password);
      if (!session) {
        toast("Compte créé — confirmez votre email puis connectez-vous");
        closeSbAuthModal();
        return;
      }
      toast("Compte créé · connecté");
    } else {
      await sbSignIn(email, password);
      toast("Connecté · " + email);
    }
    closeSbAuthModal();
    if (typeof onSbAuthChanged === "function") await onSbAuthChanged();
    await sbReportCloudStatus();
  } catch (e) {
    if (errEl) errEl.textContent = e.message || String(e);
  }
}

$("modalSbAuth")?.addEventListener("click",e=>{ if(e.target.id==="modalSbAuth") closeSbAuthModal(); });
$("sbAuthPassword")?.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); confirmSbAuth("signin"); } });

sbBootstrapAuth();
