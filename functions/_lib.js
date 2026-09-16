// Paylasilan yardimci fonksiyonlar. Dosya adi "_" ile basladigi icin
// Cloudflare Pages bunu bir API rotasi olarak degil, sadece diger
// fonksiyonlarin import edebilecegi bir modul olarak ele alir.

const encoder = new TextEncoder();

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function b64urlEncode(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

// ---------------------------- OTURUM (SESSION) ----------------------------

export async function createSessionToken(email, secret, days = 30) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = b64urlEncode(encoder.encode(JSON.stringify({ email, exp })));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expectedSig = await hmacSign(payload, secret);
  if (sig !== expectedSig) return null;

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
  if (!data.email || !data.exp || Date.now() > data.exp) return null;
  return data.email;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token, days = 30) {
  const maxAge = days * 24 * 60 * 60;
  return `session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader() {
  return `session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Cagiran fonksiyonun, kullaniciyi tanimak icin cagirdigi ana fonksiyon.
// Basarili girisin ardindan tarayiciya yazilan "session" cookie'sini
// okuyup dogrular, ardindan guncel rol/ad bilgisini D1'den ceker.
export async function getUser(context) {
  const token = getCookie(context.request, "session");
  const secret = context.env.SESSION_SECRET;
  if (!token || !secret) return null;

  const email = await verifySessionToken(token, secret);
  if (!email) return null;

  const row = await context.env.DB
    .prepare("SELECT email, ad_soyad, rol FROM kullanicilar WHERE email = ?")
    .bind(email)
    .first();
  if (!row) return null;

  return {
    email: row.email,
    ad_soyad: row.ad_soyad || row.email,
    rol: row.rol || "viewer",
  };
}

export function newId() {
  return crypto.randomUUID();
}

// ---------------------------- SIFRE HASHLEME ----------------------------
// PBKDF2-HMAC-SHA256, 100.000 iterasyon. Cloudflare Workers'in destekledigi
// Web Crypto (SubtleCrypto) API'si ile calisir, ek kutuphane gerekmez.

async function pbkdf2(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await pbkdf2(password, salt);
  return { hash: b64urlEncode(hashBytes), salt: b64urlEncode(salt) };
}

export async function verifyPassword(password, saltB64, hashB64) {
  const salt = b64urlDecode(saltB64);
  const hashBytes = await pbkdf2(password, salt);
  return b64urlEncode(hashBytes) === hashB64;
}
