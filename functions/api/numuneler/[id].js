import { getUser, json } from "../../_lib.js";

export async function onRequestPut(context) {
  const user = await getUser(context);
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (user.rol !== "editor") return json({ error: "forbidden" }, 403);

  const id = context.params.id;

  const existingRow = await context.env.DB
    .prepare("SELECT id FROM numuneler WHERE id = ?")
    .bind(id)
    .first();
  if (!existingRow) return json({ error: "Numune bulunamadı." }, 404);

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

  // Ayni musteri + model/siparis no + renk kombinasyonuyla baska bir kayit
  // varsa (kendisi haric) coklamayi engelle.
  const duplicate = await context.env.DB
    .prepare(
      `SELECT id, numune_adi FROM numuneler
       WHERE lower(trim(musteri)) = lower(?)
         AND lower(trim(model_siparis_no)) = lower(?)
         AND lower(trim(renk)) = lower(?)
         AND id != ?`
    )
    .bind(musteri, model_siparis_no, renk, id)
    .first();
  if (duplicate) {
    return json(
      {
        error: `Bu müşteri, model/sipariş no ve renk kombinasyonuyla zaten bir kayıt var: "${duplicate.numune_adi}"`,
      },
      409
    );
  }

  await context.env.DB
    .prepare(
      `UPDATE numuneler
       SET numune_adi = ?, musteri = ?, model_siparis_no = ?, renk = ?, modelhaneden_gelis_tarihi = ?, aciklama = ?
       WHERE id = ?`
    )
    .bind(numune_adi, musteri, model_siparis_no, renk, modelhaneden_gelis_tarihi, aciklama || null, id)
    .run();

  return json({ ok: true });
}
