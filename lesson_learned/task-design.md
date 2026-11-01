# Desain task: hidden tests, patch kalibrasi, p2p

## Hidden test harus lewat layer yang stabil di semua solusi valid

Golden patch menaruh logika di **domain** (fungsi `blocks_at(now)`),
alternative menaruhnya di **application**. Jika hidden test memanggil
fungsi domain secara langsung, salah satu desain akan gagal compile /
berperilaku beda → kriteria jadi "ter-fit ke solusi sendiri".

Aturan praktis: hidden test hanya boleh menyentuh surface yang **pasti
sama** di semua solusi yang benar — untuk task berbasis facade seperti
caldarium: `CaldariumApp` (application) dan route HTTP. Untuk task
hold-expiry: seluruh hidden test lewat app + HTTP dengan clock yang
bisa dimajukan, meski golden mengubah domain.

## Daftar p2p hanya boleh berisi test yang LULUS di base

Kesalahan yang tertangkap saat review mandiri: dari 139 id hasil
ekstraksi, 7 di antaranya adalah test baru milik golden patch (belum
ada di base) — akan melanggar "pass-to-pass harus lulus sebelum dan
sesudah". Cara aman: ekstrak id p2p dari **run di tree base**, atau
saring keluar test yang ditambah patch. Base caldarium = 132 id.

## Desain alternative patch: beda lokus, bukan beda gaya

- Golden (credential): flag `revoked` yang sudah ada di schema +
  DTO `CredentialSummary` di `dto.rs` + signature `insert_credential`
  diubah.
- Alternative: **migrasi baru** `002_credential_revoked_at.sql`
  (kolom timestamp `revoked_at`), summary didefinisikan di dalam
  `app.rs`, signature `insert_credential` tak disentuh.

Perbedaan desain penyimpanan yang sesungguhnya (bukan sekadar
penggantian nama) membuat kalibrasi "alternative harus lolos semua
blocker" punya arti.

## Desain negative patch: jalan pintas yang masuk akal

Negative = revoke dengan **menghapus baris** credential. Terlihat
benar: 19 dari 21 hidden test LULUS (kunci memang tak bisa dipakai
lagi). Yang gagal: dua test "credential yang di-revoke tetap tampil di
listing" — persis nilai bisnis yang diminta deskripsi task. Pelajaran:
gagalnya negative harus menunjuk **persepsi bisnis** yang dilanggar,
bukan detail teknis.

## Deskripsi task (instruction.md)

- 60–300 kata; rasio baris patch:kata 0.9–7.5 (golden 566 baris ↔
  deskripsi 152 kata ≈ 3.7 — aman).
- Sebutkan **hanya** nama publik baru yang hidden test andalkan
  (route/CLI command); jangan sebut pendekatan, file, atau helper.
- Hal yang "bisa disimpulkan maintainer" (admin-only, tenant scoping,
  no-secret-leak, audit entry) TIDAK ditulis — biarkan jadi blocker
  via hidden test dari pola kode yang sudah ada (mis. `issue_user`
  sudah admin-only → revoke pun demikian).
- Tulis dengan kalimat sendiri — platform menolak deskripsi yang
  terdeteksi AI-generated.

## Jebakan khusus Rust yang ketemu

- **Edition 2024 + `#![forbid(unsafe_code)]`**: `std::env::set_var`
  jadi `unsafe` → test CLI **tidak bisa** menyetel `CD_API_KEY` dalam
  proses. Solusi: uji CLI di level parse (`Cli::try_parse_from`
  matching `Command::Credential{...}`); perilaku autentikasi diuji di
  layer app/HTTP.
- **Prefix kunci bertabrakan**: dua kunci berurutan (`cd_apikeytest0003`,
  `cd_apikeytest0006`) punya `key_prefix` 12 karakter IDENTIK. Dalam
  test, pilih credential berdasarkan `user_id`, bukan prefix.
- **`Router` di axum**: `oneshot` mengonsumsi router — gunakan
  `router.clone()` per request dalam satu test, dan lakukan semua
  assertion HTTP lewat router (bangan simpan app lalu panggil lagi).
- Lint workspace men-deny `unwrap/expect/panic` di kode produksi —
  file test perlu `#![allow(clippy::unwrap_used, ...)]` di atas
  (sudah jadi pola repo).
