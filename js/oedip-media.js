/* OEDIP — URLs médias Supabase Storage (photos procédures, outils…) */
function oedipMediaBucket() {
  return window.OEDIP_SUPABASE?.mediaBucket || "procedure-photos";
}

function oedipMediaEnabled() {
  return !!(window.OEDIP_SUPABASE?.url && window.OEDIP_SUPABASE?.useCloudMedia !== false);
}

function oedipStorageSafeName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function oedipLocalPathToStorageKey(localPath) {
  if (!localPath) return "";
  let p = String(localPath).replace(/\\/g, "/");
  if (/^https?:\/\//i.test(p) || p.startsWith("data:") || p.startsWith("blob:")) return "";
  if (p.startsWith("img/procedures/geo/")) {
    return "geo/" + oedipStorageSafeName(p.slice("img/procedures/geo/".length));
  }
  if (p.startsWith("img/outils/")) {
    return "outils/" + oedipStorageSafeName(p.slice("img/outils/".length));
  }
  const slash = p.lastIndexOf("/");
  if (slash >= 0) return p.slice(0, slash + 1) + oedipStorageSafeName(p.slice(slash + 1));
  return oedipStorageSafeName(p.replace(/^\/+/, ""));
}

function oedipMediaUrl(src) {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (!oedipMediaEnabled()) return src;
  const key = oedipLocalPathToStorageKey(src);
  if (!key) return src;
  const base = window.OEDIP_SUPABASE.url.replace(/\/$/, "");
  const enc = key.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${base}/storage/v1/object/public/${oedipMediaBucket()}/${enc}`;
}
