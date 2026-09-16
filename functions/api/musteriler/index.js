import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM musteriler ORDER BY ad COLLATE NOCASE ASC")
    .all();

  return json({ musteriler: results });
}

export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const body = await context.request.json().catch(() => null);
  const ad = (body?.ad || "").trim();
  if (!ad) return json({ error: "Müşteri adı zorunludur." }, 400);

  const existing = await context.env.DB
    .prepare("SELECT * FROM musteriler WHERE ad = ? COLLATE NOCASE")
    .bind(ad)
    .first();
  if (existing) {
    return json({ musteri: existing }, 200);
  }

  const id = newId();
  try {
    await context.env.DB
      .prepare("INSERT INTO musteriler (id, ad) VALUES (?, ?)")
      .bind(id, ad)
      .run();
  } catch (err) {
    // Eszamanli cakisma / unique kisitlamasi: mevcut kaydi bulup dondur.
    const again = await context.env.DB
      .prepare("SELECT * FROM musteriler WHERE ad = ? COLLATE NOCASE")
      .bind(ad)
      .first();
    if (again) return json({ musteri: again }, 200);
    return json({ error: "Müşteri eklenemedi." }, 500);
  }

  return json({ musteri: { id, ad } }, 201);
}
