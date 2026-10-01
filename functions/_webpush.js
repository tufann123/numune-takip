// Web Push gonderimi: RFC 8291 (aes128gcm payload sifreleme) + RFC 8292 (VAPID).
// Sadece Cloudflare Workers runtime'inda (ve modern taraticilarda) native olarak var olan
// Web Crypto API (crypto.subtle, crypto.getRandomValues) ve btoa/atob kullanir - npm bagimliligi yok.

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concatBytes(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}
const te = new TextEncoder();

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}
async function hkdfExtract(salt, ikm) { return hmacSha256(salt, ikm); }
async function hkdfExpand(prk, info, length) {
  const input = concatBytes(info, new Uint8Array([1]));
  const out = await hmacSha256(prk, input);
  return out.slice(0, length);
}
async function generateP256KeyPair() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { publicKey: kp.publicKey, privateKey: kp.privateKey, rawPub };
}
async function importRawP256Public(rawBytes) {
  return crypto.subtle.importKey("raw", rawBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
}
async function deriveEcdhSecret(privateKey, publicKey) {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  return new Uint8Array(bits);
}

// Mesaji RFC 8291'e gore sifreler, aes128gcm govdesini (salt + record-size + keyid + sifreli metin) dondurur.
async function encryptPayload(plaintextBytes, uaPublicRaw, authSecretRaw) {
  const as = await generateP256KeyPair();
  const uaPublicKey = await importRawP256Public(uaPublicRaw);
  const ecdhSecret = await deriveEcdhSecret(as.privateKey, uaPublicKey);

  const prkKey = await hkdfExtract(authSecretRaw, ecdhSecret);
  const keyInfo = concatBytes(te.encode("WebPush: info\0"), uaPublicRaw, as.rawPub);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, te.encode("Content-Encoding: nonce\0"), 12);

  const padded = concatBytes(plaintextBytes, new Uint8Array([2])); // tek kayit, "son kayit" sinirlayicisi
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, padded));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([as.rawPub.length]);

  return concatBytes(salt, recordSize, idlen, as.rawPub, ciphertext);
}

async function importVapidPrivateKey(pkcs8B64) {
  const bytes = b64urlToBytesOrStdBase64(pkcs8B64);
  return crypto.subtle.importKey("pkcs8", bytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
// VAPID private key ortam degiskeninde standart base64 (padding'li, +/ karakterli) olarak saklaniyor.
function b64urlToBytesOrStdBase64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function buildVapidJwt(privateKey, audience, subjectMailto) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subjectMailto };
  const encHeader = bytesToB64url(te.encode(JSON.stringify(header)));
  const encPayload = bytesToB64url(te.encode(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, te.encode(signingInput));
  const encSig = bytesToB64url(new Uint8Array(sig));
  return `${signingInput}.${encSig}`;
}

// subscription: { endpoint, keys: { p256dh, auth } } (PushSubscription.toJSON() formati)
// payloadObj: JSON olarak gonderilecek herhangi bir obje, orn. {title, body, url}
// env: Cloudflare Pages ortam degiskenleri - VAPID_PRIVATE_KEY_PKCS8_B64, VAPID_PUBLIC_KEY_B64URL, VAPID_SUBJECT
// Donus: { ok: boolean, status: number, expired: boolean } - expired=true ise abonelik artik gecersiz (404/410), silinmeli.
export async function sendWebPush(subscription, payloadObj, env) {
  const { endpoint, keys } = subscription;
  const uaPublicRaw = b64urlToBytes(keys.p256dh);
  const authSecretRaw = b64urlToBytes(keys.auth);
  const plaintext = te.encode(JSON.stringify(payloadObj));

  const body = await encryptPayload(plaintext, uaPublicRaw, authSecretRaw);

  const audience = new URL(endpoint).origin;
  const privateKey = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY_PKCS8_B64);
  const jwt = await buildVapidJwt(privateKey, audience, env.VAPID_SUBJECT || "mailto:tufanelmas@narkonteks.com");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Urgency": "high",
      "Authorization": `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY_B64URL}`,
    },
    body,
  });

  return { ok: res.ok, status: res.status, expired: res.status === 404 || res.status === 410 };
}
