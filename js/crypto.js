async function deriveKey(pw, salt) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name:"PBKDF2", salt, iterations:310000, hash:"SHA-256" }, km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
}
async function enc(text, pw) {
  const s = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await deriveKey(pw, s);
  const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, k, new TextEncoder().encode(text));
  const b = new Uint8Array(28 + ct.byteLength); b.set(s,0); b.set(iv,16); b.set(new Uint8Array(ct),28);
  return btoa(String.fromCharCode(...b));
}
async function dec(b64, pw) {
  const b = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
  const k = await deriveKey(pw, b.slice(0,16));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:b.slice(16,28) }, k, b.slice(28)));
}
async function saveData() {
  if (APP_PW) {
    ENCRYPTED_PAYLOAD = await enc(JSON.stringify(appData), APP_PW);
  }
  try { localStorage.setItem('appDataCache', JSON.stringify(appData)); } catch(e) {}
}
