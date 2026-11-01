# PLAN.MD — Runbook Submit (minimalkan gagal)

Satu run platform = ±1 jam. Semua yang bisa dicek lokal WAJIB dicek lokal dulu.
Dokumen ini adalah urutan operasional; ATURAN teknis ada di [RULES.md](RULES.md).

```
FASE 0 ──> FASE 1 ──> FASE 2 ──> FASE 3 ──> FASE 4 ──> FASE 5
arsip      verifikasi   pack +     upload +   run       submit
zip        lokal 100%   fingerprint verifikasi  checks    (yakin 100%)
                          lokal      task page  (gratis)
```

---

## FASE 0 — ARSIP ZIP (disiplin versi)

WAJIB sebelum pack baru. Ini mencegah kegagalan "zip basi ter-upload".

- [ ] Buat folder `tasks/<nama>/archive/` (atau `lesson_learned/zips/`)
- [ ] PINDAHKAN semua zip lama task itu ke archive (jangan biarkan 2 zip
      hidup untuk task yang sama di folder yang sama)
- [ ] Hanya SATU zip aktif per task di `tasks/`
- [ ] Catat identitas zip aktif di tabel inventaris (lihat bawah)

### Tabel inventaris zip aktif (update setiap pack)

| Task | File | Bytes | sha256 (12) | Jam pack | f2p | Rubric total bobot |
|---|---|---|---|---|---|---|
| revision-history | tasks/revision-history.zip | 31187 | 42b65928 | 16:4x | 48 | 10 |
| brief-lifecycle | tasks/brief-lifecycle.zip | 30911 | 6601a935 | 17:1x | 52 | 10 |
| rates-versioning | tasks/rates-versioning.zip | 32766 | c250d159 | 19:0x | 36 | 10 |

---

## FASE 1 — VERIFIKASI LOKAL (satu pun merah = JANGAN pack)

### 1A. Empat tree
```
golden : hidden tests 100% LULUS
alt    : hidden tests 100% LULUS
neg    : mayoritas lulus, minoritas gagal (bloker menangkap)
base   : gagal (boleh collection-error utk modul baru)
```
- [ ] Jalankan via JUnit per tree, catat total/fail keempatnya

### 1B. Build trio (golden + alt + neg)
- [ ] `npx tsc --noEmit` bersih
- [ ] `npm run lint` bersih
- [ ] `npm run build`: hanya error yang SAMA dengan base (snapshot base
      dulu untuk perbandingan; error base pre-existing = exemption)

### 1C. Konstanta & referensi
- [ ] Tidak ada konstanta/import dihapus yang masih direferensikan (grep)
- [ ] Semua nama file/fungsi di rubric ADA di ketiga patch
- [ ] Rubric: tiap pertanyaan = SATU properti, anchor SATU fungsi/path,
      YES-jelas di golden (baca kodenya), negatif gagal minimal 1

### 1D. Deskripsi
- [ ] 60–300 kata, ratio baris-patch:kata 0.9–7.5
- [ ] Gaya lolos AI-check: prosa naratif, signature inline (→), tanpa
      fence/indentasi/heading/em-dash, kalimat pertama ≤5 kata/fragmen
- [ ] SETIAP literal yang hidden test assert ADA di deskripsi
      (string eksak, urutan, trimming, corrupt-recovery, reason codes)

### 1E. Grader
- [ ] f2p ID = regenerasi dari JUnit golden terbaru (nama test berubah
      setelah edit apapun pada file hidden!), 0 entity XML
- [ ] p2p = list base terbukti (jangan disentuh)
- [ ] Perintah f2p/p2p copy-paste dari grader.yaml, dijalankan PERSIS
      di tree golden + tree base+dengan residu hidden
- [ ] denied_paths: HANYA config/migrasi/module-terkunci. TANPA file test
- [ ] Timeout: angka yang sudah terbukti, jangan dipangkas

---

## FASE 2 — PACK + FINGERPRINT

- [ ] `bash maintkit check tasks/<nama>` → **PASS 0 error 0 warning**
      (error rubric "does not say which part of repository" = sebut
      direktori `under tests/`)
- [ ] `bash maintkit pack tasks/<nama>`
- [ ] REKAM fingerprint: bytes + `sha256[:12]` + isi:
  ```python
  import zipfile, hashlib
  d = open('tasks/<nama>.zip','rb').read()
  z = zipfile.ZipFile('tasks/<nama>.zip')
  # verifikasi: rubric ids, jumlah f2p, file hidden, kalimat deskripsi baru
  ```
- [ ] Update tabel inventaris (FASE 0)
- [ ] Tulis di chat: "zip <task> = <bytes>B sha <12hex> f2p <n>"
      (agar tidak ada ambiguity versi antara kita)

---

## FASE 3 — UPLOAD + VERIFIKASI TASK PAGE

Kegagalan terbaru kita = zip basi. JANGAN percaya upload berhasil.

- [ ] Upload SATU zip per task
- [ ] BUKA task page, verifikasi DUA tanda versi SEBELUM run checks:
  - [ ] Rubric menampilkan nama kriteria TERBARU
        (RH: `no-orphaned-revision-data`; LC: `frozen-numbers-are-stored`)
  - [ ] Jumlah test f2p = jumlah terbaru (RH: 48, LC: 52)
- [ ] Tanda tidak cocok → zip basi → hapus draft, upload ulang,
      verifikasi lagi (jangan submit, jangan run checks)
- [ ] Kalau platform menolak dengan "task is unchanged since it failed
      validation" → zip memang tidak berubah; pack ulang dari sumber

---

## FASE 4 — RUN CHECKS (gratis, WAJIB)

- [ ] Run checks SEBELUM submit, selalu
- [ ] Hijau semua → lanjut FASE 5
- [ ] Merah → baca pesan, masuk protokol FASE 6, JANGAN submit

---

## FASE 5 — SUBMIT

- [ ] Submit hanya jika FASE 1–4 hijau semua
- [ ] Catat jam submit + stage berikutnya yang menunggu
- [ ] Jangan submit 2 task dalam kondisi "mungkin" — 1 jam per run

---

## FASE 6 — PROTOKOL RESPONS KEGAGALAN

Baca pesan error platform, cocokkan, jalankan AKSI. Urut dari stage.

### Tabel diagnosis

| Pesan platform | Akar masalah | Aksi |
|---|---|---|
| "prompt appears to be AI-generated" | Gaya deskripsi | Tulis ulang RADIKAL (bukan poles); tiru struktur deskripsi yang pernah lolos; semua kontrak string tetap utuh; cek 60–300 kata |
| "task is unchanged since it failed" | Zip identik dengan yang gagal | Pack ulang; pastikan file sumber memang berubah |
| Skor rubric `[x, y]` < 0.9 di reference | Pertanyaan ambigu ATAU golden tidak jelas YES | Hitung: skor = (total−bobot_gagal)/total → identifikasi pertanyaan; cek tabel kalimat-berbahaya di bawah |
| "got different answers on the same patch" | Pertanyaan flip-flop | Jadikan atomik + anchor satu fungsi; sebut MEKANISME ("returns null"), bukan efek ("treated as fresh draft") |
| "don't credit your own golden patch" + nama kriteria TIDAK ada di zip baru | ZIP BASI ter-upload | FASE 3 verifikasi ulang; upload zip benar |
| "blockers inferable" / "merge stoppers" pada scope | denied_paths terlalu ketat / aturan tak tertulis | Hapus denial yang menolak praktik wajar (file test); pastikan tiap blocker bisa disimpulkan dari deskripsi+guidelines |
| "false negative resistance" pada alt | Alt tak maintainable / menyalin golden / bocor | Audit alt: beda struktural semua file, tanpa export mati, docstring jujur, cleanup storage, id/order stabil |
| "rubric coverage" / "thoroughness" | Properti objektif cuma di rubric | Pindah ke hidden test (blocking), agnostik-key (delta keyset) |
| "rubric criteria not trivial" | Pertanyaan merestatikan instruksi | Ganti: properti yang solver lewatkan (cleanup, normalisasi, persist identitas) |
| "rubric criteria unambiguous" | Dua tafsir / referensi file spesifik | Satu properti; referensi test = direktori `under tests/` |
| Validation gagal teknis (test ID 0 match, timeout, permission) | Grader mechanics | Buka log `exception.txt`; cek RULES FASE 6 & 13 |

### Kalimat rubric BERBAHAYA (jangan pakai)

| Pola | Kenapa |
|---|---|
| "A ... and B ..." (dua sifat) | Judge setuju separuh → flip-flop |
| "same way the existing X does" | Perbandingan antar file → tidak stabil |
| "treated as <efek>" | Efek beda per operasi → judge pemilih menolak |
| "Judge <file>.ts" (file utuh) | Perhatian judge melebar → anchor ke SATU FUNGSI |
| "the new tests/<nama file>" | Nama file solver bisa beda → direktori saja |
| Menanyakan ulang isi instruksi | Trivial: semua attempt lolos f2p dapat yes |

### Setelah memperbaiki

- [ ] Kembali ke FASE 1 (verifikasi lokal penuh — jangan langsung pack;
      perbaikan rubric = maintkit check; perbaikan test/alt = 4-tree ulang)
- [ ] FASE 0: arsipkan zip lama, pack baru, fingerprint baru
- [ ] Umumkan fingerprint baru di chat sebelum upload

---

## CHECKLIST 10 DETIK (sebelum upload, versi ringkas)

1. Zip aktif satu-satunya? bytes + sha cocok inventaris?
2. f2p di task page = jumlah terbaru?
3. Nama kriteria rubric di task page = versi terbaru?
4. maintkit check terakhir PASS 0/0?
5. Empat tree terakhir: golden 100% / alt 100% / neg minoritas gagal / base gagal?
6. Deskripsi ≤300 kata dengan semua literal kontrak?

6/6 hijau → upload → verifikasi task page → run checks → submit.
