import { getUser, json, newId } from "../../_lib.js";
import { notifyEditors } from "../../_webpush.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM talepler ORDER BY created_at DESC")
    .all();

  return json({ talepler: results });
}

// Talep olusturma editor/viewer ayrimi yapilmaz: herhangi bir giris yapmis
// kullanici (tipik olarak viewer) bir numune icin talepte bulunabilir.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  if (!body || !body.numune_id) {
    return json({ error: "numune_id zorunludur." }, 400);
  }

  const existing = await context.env.DB
    .prepare("SELECT id FROM talepler WHERE numune_id = ? AND durum = 'bekliyor'")
    .bind(body.numune_id)
    .first();
  if (existing) {
    return json({ error: "Bu numune için zaten bekleyen bir talep var." }, 409);
  }

  const id = newId();
  await context.env.DB
    .prepare(
      `INSERT INTO talepler (id, numune_id, talep_eden_email, talep_eden_ad, not_)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, body.numune_id, user.email, user.ad_soyad, body.not || null)
    .run();

  // Editorlere push bildirimi gonder - basarisiz olursa talep olusturma yanitini etkilemesin.
  try {
    const numune = await context.env.DB
      .prepare("SELECT numune_adi FROM numuneler WHERE id = ?")
      .bind(body.numune_id)
      .first();
    const adi = numune?.numune_adi ? ` (${numune.numune_adi})` : "";
    await notifyEditors(context.env, {
      title: "Yeni numune talebi",
      body: `${user.ad_soyad} bir talep gönderdi${adi}.`,
      url: "/",
    });
  } catch (err) {
    // yoksay - push gonderimi basarisiz olsa da talep zaten olusturuldu
  }

  return json({ id }, 201);
}
