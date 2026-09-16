// Paylasilan yardimci fonksiyonlar. Dosya adi "_" ile basladigi icin
// Cloudflare Pages bunu bir API rotasi olarak degil, sadece diger
// fonksiyonlarin import edebilecegi bir modul olarak ele alir.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Cloudflare Access, kimligi dogrulanmis her istege bu basligi ekler.
// Bu fonksiyon cagrilmadan once istegin Access korumasindan gecmis
// olmasi gerekir (bkz. kurulum rehberi) - aksi halde bu baslik olmaz
// ve kullanici "unauthenticated" kabul edilir.
export async function getUser(context) {
  const email = context.request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return null;

  const row = await context.env.DB
    .prepare("SELECT ad_soyad, rol FROM kullanicilar WHERE email = ?")
    .bind(email)
    .first();

  return {
    email,
    ad_soyad: (row && row.ad_soyad) || email,
    // Tabloda kaydi olmayan biri, guvenli taraf secilerek "viewer" sayilir.
    rol: (row && row.rol) || "viewer",
  };
}

export function newId() {
  return crypto.randomUUID();
}
