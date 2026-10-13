import { getUser, json } from "../../../_lib.js";
import { notifyUser } from "../../../_webpush.js";

// Bir talebi elle "tamamlandi" isaretlemek icin (editor'un dagitim eklemeden
// de bir talebi kapatabilmesi icin, orn. ekiple sozlu konusulduysa).
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  // Bildirim icin bekleyen talebi ve numune bilgisini onceden al.
  const talep = await context.env.DB
    .prepare(
      `SELECT t.id, t.talep_eden_email, t.talep_eden_ad, n.numune_adi, n.musteri
       FROM talepler t
       LEFT JOIN numuneler n ON n.id = t.numune_id
       WHERE t.id = ? AND t.durum = 'bekliyor'`
    )
    .bind(id)
    .first();

  await context.env.DB
    .prepare(
      `UPDATE talepler
       SET durum = 'tamamlandi', tamamlanma_tarihi = datetime('now'), tamamlayan_email = ?
       WHERE id = ? AND durum = 'bekliyor'`
    )
    .bind(user.email, id)
    .run();

  // Talep eden hesaba "numune hazir" bildirimi - basarisiz olursa yaniti etkilemesin.
  if (talep && talep.talep_eden_email) {
    try {
      const ad = talep.numune_adi || "Talep ettiğiniz numune";
      await notifyUser(context.env, talep.talep_eden_email, {
        title: "Numune hazır",
        body: `${ad}${talep.musteri ? " (" + talep.musteri + ")" : ""} hazırlandı.${talep.talep_eden_ad ? " Talep eden: " + talep.talep_eden_ad : ""}`,
        url: "/",
      });
    } catch (err) {
      // yoksay
    }
  }

  return json({ ok: true });
}
