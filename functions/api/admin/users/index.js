import { json, hashPassword } from "../../../_lib.js";

// Bu uc nokta Cloudflare Access yerine, basit bir "yonetici anahtari"
// (ADMIN_KEY ortam degiskeni) ile korunur. Yalnizca bu anahtari bilen
// kisi (siz) kullanici ekleyebilir/guncelleyebilir.
function checkAdminKey(context) {
  const key = context.request.headers.get("X-Admin-Key");
  return Boolean(key) && Boolean(context.env.ADMIN_KEY) && key === context.env.ADMIN_KEY;
}

export async function onRequestGet(context) {
  if (!checkAdminKey(context)) return json({ error: "forbidden" }, 403);

  const { results } = await context.env.DB
    .prepare("SELECT email, ad_soyad, rol, created_at FROM kullanicilar ORDER BY created_at DESC")
    .all();

  return json({ kullanicilar: results });
}

export async function onRequestPost(context) {
  if (!checkAdminKey(context)) return json({ error: "forbidden" }, 403);

  const body = await context.request.json().catch(() => null);
  if (!body || !body.email || !body.ad_soyad || !body.rol) {
    return json({ error: "email, ad_soyad ve rol zorunludur." }, 400);
  }
  if (!["editor", "viewer"].includes(body.rol)) {
    return json({ error: "Geçersiz rol (editor veya viewer olmalı)." }, 400);
  }

  const email = String(body.email).trim().toLowerCase();

  const existing = await context.env.DB
    .prepare("SELECT email FROM kullanicilar WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    if (body.password) {
      const { hash, salt } = await hashPassword(body.password);
      await context.env.DB
        .prepare("UPDATE kullanicilar SET ad_soyad = ?, rol = ?, pass_hash = ?, pass_salt = ? WHERE email = ?")
        .bind(body.ad_soyad, body.rol, hash, salt, email)
        .run();
    } else {
      await context.env.DB
        .prepare("UPDATE kullanicilar SET ad_soyad = ?, rol = ? WHERE email = ?")
        .bind(body.ad_soyad, body.rol, email)
        .run();
    }
    return json({ ok: true, updated: true });
  }

  if (!body.password) {
    return json({ error: "Yeni kullanıcı için şifre zorunludur." }, 400);
  }

  const { hash, salt } = await hashPassword(body.password);
  await context.env.DB
    .prepare(
      "INSERT INTO kullanicilar (email, ad_soyad, rol, pass_hash, pass_salt) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(email, body.ad_soyad, body.rol, hash, salt)
    .run();

  return json({ ok: true, created: true }, 201);
}
