import { getUser, json, newId } from "../../_lib.js";

export async function onRequestGet(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { results } = await context.env.DB
    .prepare("SELECT * FROM numuneler ORDER BY modelhaneden_gelis_tarihi DESC, created_at DESC")
    .all();

  return json({ numuneler: results });
}

export async function onRequestPost(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const body = await context.request.json().catch(() => null);
  if (!body || !body.numune_adi || !body.modelhaneden_gelis_tarihi) {
    return json({ error: "Numune adı ve geliş tarihi zorunludur." }, 400);
  }

  const id = newId();
  await context.env.DB
    .prepare(
      `INSERT INTO numuneler
        (id, kod, numune_adi, musteri, model_siparis_no, renk, beden, modelhaneden_gelis_tarihi, aciklama, olusturan_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      body.kod || null,
      body.numune_adi,
      body.musteri || null,
      body.model_siparis_no || null,
      body.renk || null,
      body.beden || null,
      body.modelhaneden_gelis_tarihi,
      body.aciklama || null,
      user.email
    )
    .run();

  return json({ id }, 201);
}
