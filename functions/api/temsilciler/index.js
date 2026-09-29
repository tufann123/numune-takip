import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM temsilciler ORDER BY ad COLLATE NOCASE ASC")
    .all();

  return json({ temsilciler: results });
}

// Musterilerin aksine, bu liste viewer'lar (fason/uretim ekibi) tarafindan da
// "Musteri Temsilcisine Iade Edildi" bildirimi sirasinda genisletilebilir.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  const ad = (body?.ad || "").trim();
  if (!ad) return json({ error: "Temsilci adı zorunludur." }, 400);

  const existing = await context.env.DB
    .prepare("SELECT * FROM temsilciler WHERE ad = ? COLLATE NOCASE")
    .bind(ad)
    .first();
  if (existing) {
    return json({ temsilci: existing }, 200);
  }

  const id = newId();
  try {
    await context.env.DB
      .prepare("INSERT INTO temsilciler (id, ad) VALUES (?, ?)")
      .bind(id, ad)
      .run();
  } catch (err) {
    // Eszamanli cakisma / unique kisitlamasi: mevcut kaydi bulup dondur.
    const again = await context.env.DB
      .prepare("SELECT * FROM temsilciler WHERE ad = ? COLLATE NOCASE")
      .bind(ad)
      .first();
    if (again) return json({ temsilci: again }, 200);
    return json({ error: "Temsilci eklenemedi." }, 500);
  }

  return json({ temsilci: { id, ad } }, 201);
}
