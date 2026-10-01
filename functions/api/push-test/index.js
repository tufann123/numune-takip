import { getUser, json } from "../../_lib.js";
import { sendWebPush } from "../../_webpush.js";

// GECICI TESHIS ENDPOINT'I - push bildirimi gonderimini dogrudan test eder,
// gercek HTTP durum kodunu/hatayi gorunur kilar. Teshisten sonra silinecek.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const rows = await context.env.DB
    .prepare("SELECT id, endpoint, p256dh, auth, created_at FROM push_abonelikleri WHERE email = ? ORDER BY created_at DESC")
    .bind(user.email)
    .all();

  if (!rows.results || rows.results.length === 0) {
    return json({ error: "Bu kullanici icin kayitli push abonesi yok.", email: user.email }, 404);
  }

  const sonuclar = [];
  for (const row of rows.results) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      const result = await sendWebPush(subscription, { title: "Test Bildirimi", body: "Teshis: " + new Date().toISOString(), url: "/" }, context.env);
      sonuclar.push({ id: row.id, created_at: row.created_at, ...result });
    } catch (err) {
      sonuclar.push({ id: row.id, created_at: row.created_at, hata: String(err && err.stack ? err.stack : err) });
    }
  }

  return json({ email: user.email, sonuclar }, 200);
}
