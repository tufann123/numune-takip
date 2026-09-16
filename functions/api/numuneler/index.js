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
  const numune_adi = (body?.numune_adi || "").trim();
  const musteri = (body?.musteri || "").trim();
  const model_siparis_no = (body?.model_siparis_no || "").trim();
  const renk = (body?.renk || "").trim();
  const modelhaneden_gelis_tarihi = (body?.modelhaneden_gelis_tarihi || "").trim();
  const aciklama = (body?.aciklama || "").trim();

  if (!numune_adi || !musteri || !model_siparis_no || !renk || !modelhaneden_gelis_tarihi) {
    return json(
      { error: "Numune adı, müşteri, model/sipariş no, renk ve geliş tarihi zorunludur." },
      400
    );
  }

  // Ayni musteri + model/siparis no + renk kombinasyonuyla zaten bir kayit
  // varsa coklamayi engelle (buyuk/kucuk harf ve bosluk farki gozetilmez).
  const existing = await context.env.DB
    .prepare(
      `SELECT id, numune_adi FROM numuneler
       WHERE lower(trim(musteri)) = lower(?)
         AND lower(trim(model_siparis_no)) = lower(?)
         AND lower(trim(renk)) = lower(?)`
    )
    .bind(musteri, model_siparis_no, renk)
    .first();
  if (existing) {
    return json(
      {
        error: `Bu müşteri, model/sipariş no ve renk kombinasyonuyla zaten bir kayıt var: "${existing.numune_adi}"`,
      },
      409
    );
  }

  const id = newId();
  await context.env.DB
    .prepare(
      `INSERT INTO numuneler
        (id, numune_adi, musteri, model_siparis_no, renk, modelhaneden_gelis_tarihi, aciklama, olusturan_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      numune_adi,
      musteri,
      model_siparis_no,
      renk,
      modelhaneden_gelis_tarihi,
      aciklama || null,
      user.email
    )
    .run();

  return json({ id }, 201);
}
