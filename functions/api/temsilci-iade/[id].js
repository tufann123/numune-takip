import { getUser, json } from "../../_lib.js";

// Editor bir musteri temsilcisine-iade talebini onaylar (numunenin ilgili
// dagitim kaydi "musteri temsilcisi" hedefiyle iade edilmis sayilir) ya da
// reddeder (dagitim kaydinda hicbir sey degismez).
export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;
  const body = await context.request.json().catch(() => null);
  const karar = body?.karar;
  if (!["onayla", "reddet"].includes(karar)) {
    return json({ error: "Geçersiz karar." }, 400);
  }

  const talep = await context.env.DB
    .prepare("SELECT * FROM temsilci_iade_talepleri WHERE id = ?")
    .bind(id)
    .first();
  if (!talep) return json({ error: "Talep bulunamadı." }, 404);
  if (talep.durum !== "bekliyor") {
    return json({ error: "Bu talep zaten karara bağlanmış." }, 409);
  }

  if (karar === "onayla") {
    await context.env.DB.batch([
      context.env.DB
        .prepare(
          `UPDATE dagitimlar
           SET iade_tarihi = date('now'), iade_hedef = 'musteri_temsilcisi', iade_notu = ?
           WHERE id = ?`
        )
        .bind(talep.not_, talep.dagitim_id),
      context.env.DB
        .prepare(
          `UPDATE temsilci_iade_talepleri
           SET durum = 'onaylandi', karar_tarihi = datetime('now'), karar_veren_email = ?
           WHERE id = ?`
        )
        .bind(user.email, id),
    ]);
  } else {
    await context.env.DB
      .prepare(
        `UPDATE temsilci_iade_talepleri
         SET durum = 'reddedildi', karar_tarihi = datetime('now'), karar_veren_email = ?
         WHERE id = ?`
      )
      .bind(user.email, id)
      .run();
  }

  return json({ ok: true });
}
