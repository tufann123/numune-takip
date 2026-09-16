import { json, verifyPassword, createSessionToken, sessionCookieHeader } from "../_lib.js";

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => null);
  if (!body || !body.email || !body.password) {
    return json({ error: "Kullanıcı adı ve şifre gerekli." }, 400);
  }

  const email = String(body.email).trim().toLowerCase();

  const row = await context.env.DB
    .prepare("SELECT email, ad_soyad, rol, pass_hash, pass_salt FROM kullanicilar WHERE email = ?")
    .bind(email)
    .first();

  if (!row || !row.pass_hash || !row.pass_salt) {
    return json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
  }

  const ok = await verifyPassword(body.password, row.pass_salt, row.pass_hash);
  if (!ok) {
    return json({ error: "Kullanıcı adı veya şifre hatalı." }, 401);
  }

  const secret = context.env.SESSION_SECRET;
  if (!secret) {
    return json({ error: "Sunucu yapılandırma hatası (SESSION_SECRET tanımlı değil)." }, 500);
  }

  const token = await createSessionToken(row.email, secret);

  return json(
    { email: row.email, ad_soyad: row.ad_soyad, rol: row.rol },
    200,
    { "Set-Cookie": sessionCookieHeader(token) }
  );
}
