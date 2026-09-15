-- ============================================================
-- Numune / Kartela Takip Sistemi - Cloudflare D1 Semasi
-- Bu dosyayi Cloudflare Dashboard > Workers & Pages > D1 >
-- (veritabaniniz) > Console sekmesine yapistirip calistirin.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- 1) KULLANICILAR: uygulamadaki rol bilgisi (editor / viewer).
--    Kimin siteye GIRIS yapabilecegi Cloudflare Access'te (Zero
--    Trust) ayarlanir; bu tablo sadice ICERIDEKI yetkiyi (rolu)
--    belirler. Access'ten gecen ama bu tabloda kaydi olmayan
--    biri, guvenli taraf secilerek otomatik "viewer" sayilir.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kullanicilar (
  email TEXT PRIMARY KEY,
  ad_soyad TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'viewer' CHECK (rol IN ('editor', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- 2) NUMUNELER: modelhaneden kesimhaneye gelen numune/kartela kayitlari
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS numuneler (
  id TEXT PRIMARY KEY,
  kod TEXT,
  numune_adi TEXT NOT NULL,
  musteri TEXT,
  model_siparis_no TEXT,
  renk TEXT,
  beden TEXT,
  modelhaneden_gelis_tarihi TEXT NOT NULL,
  aciklama TEXT,
  olusturan_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  guncellenme_tarihi TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- 3) DAGITIMLAR: kesimhaneden uretim / fasona yapilan (parcali
--    olabilen) dagitim kayitlari
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dagitimlar (
  id TEXT PRIMARY KEY,
  numune_id TEXT NOT NULL REFERENCES numuneler(id) ON DELETE CASCADE,
  dagitim_tarihi TEXT NOT NULL,
  tip TEXT NOT NULL CHECK (tip IN ('uretim', 'fason')),
  kime TEXT NOT NULL,
  miktar TEXT,
  not_ TEXT,
  olusturan_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dagitimlar_numune_id ON dagitimlar(numune_id);

-- ------------------------------------------------------------
-- BITTI. Simdi kendinizi ve ekibinizi ekleyin, orn:
--
--   INSERT INTO kullanicilar (email, ad_soyad, rol)
--   VALUES ('tufanelmas@narkonteks.com', 'Tufan Elmas', 'editor');
--
--   INSERT INTO kullanicilar (email, ad_soyad, rol)
--   VALUES ('takip@narkonteks.com', 'Takip', 'viewer');
--
-- Bu tablodaki e-posta adresleri, Cloudflare Access'te izin
-- verdiginiz e-posta adresleriyle AYNI olmalidir.
-- ------------------------------------------------------------
