import { getUser, json, newId } from "../../_lib.js";

// Tarayici push aboneligini (PushSubscription.toJSON() ciktisi) kaydeder/gunceller.
// Ayni endpoint ayni endpoint URL'si icin tekrar cagrilirsa (orn. anahtarlar
// yenilenmisse) mevcut kayit guncellenir, tekrar satir eklenmez.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  const endpoint = (body?.endpoint || "").trim();
  const p256dh = body?.keys?.p256dh || "";
  const auth = body?.keys?.auth || "";
  if (!endpoint || !p256dh || !auth) {
    return json({ error: "Geçersiz abonelik verisi." }, 400);
  }

  const existing = await context.env.DB
    .prepare("SELECT id FROM push_abonelikleri WHERE endpoint = ?")
    .bind(endpoint)
    .first();

  if (existing) {
    await context.env.DB
      .prepare("UPDATE push_abonelikleri SET email = ?, p256dh = ?, auth = ? WHERE id = ?")
      .bind(user.email, p256dh, auth, existing.id)
      .run();
    return json({ ok: true }, 200);
  }

  const id = newId();
  await context.env.DB
    .prepare("INSERT INTO push_abonelikleri (id, email, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)")
    .bind(id, user.email, endpoint, p256dh, auth)
    .run();

  return json({ ok: true }, 201);
}

// Kullanici bildirimleri kapatirsa veya tarayici aboneligi gecersiz kilarsa
// kaydi silmek icin.
export async function onRequestDelete(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  const endpoint = (body?.endpoint || "").trim();
  if (!endpoint) return json({ error: "endpoint zorunludur." }, 400);

  await context.env.DB
    .prepare("DELETE FROM push_abonelikleri WHERE endpoint = ?")
    .bind(endpoint)
    .run();

  return json({ ok: true });
}
