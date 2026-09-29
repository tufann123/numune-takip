import { getUser, json } from "../../_lib.js";

export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  const existingRow = await context.env.DB
    .prepare("SELECT id, iade_tarihi, iade_hedef, kesimhane_donus_tarihi FROM dagitimlar WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Dağıtım kaydı bulunamadı." }, 404);

  const body = await context.request.json().catch(() => null);

  // Ikinci asama: musteri temsilciliginden kesimhaneye geri alma
  if (body?.kesimhane_donus_tarihi !== undefined) {
    const kesimhaneDonusTarihi = (body?.kesimhane_donus_tarihi || "").trim();
    const kesimhaneDonusNotu = (body?.kesimhane_donus_notu || "").trim();

    if (!kesimhaneDonusTarihi) {
      return json({ error: "Kesimhaneye dönüş tarihi zorunludur." }, 400);
    }
    if (existingRow.iade_hedef !== "musteri_temsilcisi" || !existingRow.iade_tarihi) {
      return json({ error: "Bu dağıtım müşteri temsilciliğinde değil." }, 400);
    }
    if (existingRow.kesimhane_donus_tarihi) {
      return json({ error: "Bu dağıtım zaten kesimhaneye geri alınmış." }, 400);
    }

    await context.env.DB
      .prepare("UPDATE dagitimlar SET kesimhane_donus_tarihi = ?, kesimhane_donus_notu = ? WHERE id = ?")
      .bind(kesimhaneDonusTarihi, kesimhaneDonusNotu || null, id)
      .run();

    return json({ ok: true });
  }

  // Birinci asama: disaridan (fason/uretim) kesimhaneye ya da musteri temsilciligine iade
  const iade_tarihi = (body?.iade_tarihi || "").trim();
  const iade_notu = (body?.iade_notu || "").trim();

  if (!iade_tarihi) {
    return json({ error: "İade tarihi zorunludur." }, 400);
  }

  await context.env.DB
    .prepare("UPDATE dagitimlar SET iade_tarihi = ?, iade_notu = ? WHERE id = ?")
    .bind(iade_tarihi, iade_notu || null, id)
    .run();

  return json({ ok: true });
}
