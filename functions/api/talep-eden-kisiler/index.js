import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM talep_eden_kisiler ORDER BY ad COLLATE NOCASE ASC")
    .all();

  return json({ kisiler: results });
}

// Temsilciler listesiyle ayni mantik: bu liste de viewer'lar (talep eden kisiler)
// tarafindan "Numune Talep Et" sirasinda genisletilebilir.
export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const body = await context.request.json().catch(() => null);
  const ad = (body?.ad || "").trim();
  if (!ad) return json({ error: "Ad zorunludur." }, 400);

  const existing = await context.env.DB
    .prepare("SELECT * FROM talep_eden_kisiler WHERE ad = ? COLLATE NOCASE")
    .bind(ad)
    .first();
  if (existing) {
    return json({ kisi: existing }, 200);
  }

  const id = newId();
  try {
    await context.env.DB
      .prepare("INSERT INTO talep_eden_kisiler (id, ad) VALUES (?, ?)")
      .bind(id, ad)
      .run();
  } catch (err) {
    // Eszamanli cakisma / unique kisitlamasi: mevcut kaydi bulup dondur.
    const again = await context.env.DB
      .prepare("SELECT * FROM talep_eden_kisiler WHERE ad = ? COLLATE NOCASE")
      .bind(ad)
      .first();
    if (again) return json({ kisi: again }, 200);
    return json({ error: "Kişi eklenemedi." }, 500);
  }

  return json({ kisi: { id, ad } }, 201);
}
