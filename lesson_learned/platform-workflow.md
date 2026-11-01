# Platform workflow: siklus task, base_commit, upload, timeout

## Pembaruan platform 1.3.3 (30 Okt, sore)

- **instruction.md wajib prosa polos**: tanpa heading Markdown (`#`/`##`),
  tanpa garis `===`/`---`. Submit dan maintkit check 1.3.3 menolaknya
  beserta nomor barisnya. Paragraf pendek dan daftar singkat boleh;
  heading di dalam code block boleh. Guidelines repo kini ditulis
  platform sebagai prosa polos otomatis.
- **Kit harus selalu terbaru** sebelum pack: unduh dari Build kit tab,
  `sh maintkit-build-kit-<v>-update/apply.sh <folder build-kit>` (tasks/
  tidak tersentuh), lalu re-run check + pack untuk task yang belum
  diupload. Bundle dari kit lama bisa ditolak.
- **Lint/format bawaan yang sudah rusak di base tidak dihitung**:
  cleanliness check kini hanya menilai file yang diubah; check yang
  sudah gagal di repo tak tersentuh di-skip (inilah asal baris
  "Baseline exemption" di log). Kriteria `lint` buatan sendiri tetap
  berguna karena reviewer tetap ingin clippy di-enforce nyata.
- **"Run checks" di draft = reference verification gratis**, tidak
  dihitung sebagai submission. Pakai sebelum setiap submit.
- **Kit 1.3.4: format task.toml berubah** — kini diawali
  `artifacts = ["/logs/artifacts/model.patch"]` dan diakhiri blok
  `[[verifier.collect]]` yang menjalankan `pre_artifacts.sh`.
  `maintkit pack` memigrasi folder lama ke format ini in-place (hanya
  task.toml yang berubah; zip yang di-pack TIDAK memuat task.toml —
  platform menyimpan salinannya sendiri, dan task yang sudah disubmit
  dimigrasi otomatis di sisi platform, tanpa perlu resubmit).
  Catatan higien: blok collect/pre_artifacts **menyematkan hash base
  commit** — folder lokal kita masih memuat hash snapshot lokal;
  tidak berbahaya (tidak ter-upload), tapi selalu samakan kalau base
  pernah berubah.
- Masalah paling sering (pengumuman admin): rubric overfit/gabungan/
  tidak mengkredit golden sendiri; deskripsi terdeteksi AI (tulis
  dengan kalimat sendiri!); mengedit file milik platform (menghapus
  kriteria platform, mengubah base_commit/docker_image/timeout); test
  f2p yang sudah lulus di base.

## Urutan kerja yang benar

1. **Buat task di platform dulu** (New task) — jangan mulai dari kit.
   Dari task page inilah `base_commit` (grader.yaml scaffold), nama task,
   dan environment version berasal.
2. `maintkit init tasks/<nama> --base <commit-40-karakter> [--category ...]`
   di folder kit. Kategori valid: `feature_request | bugfix | enhancement`.
3. Authoring lokal: `instruction.md` (deskripsi saja), 3 patch di
   `solution/`, `tests/grader/grader.yaml`, `tests/grader/rubric.toml`,
   `tests/hidden/`, dua field display di `task.toml`.
4. `maintkit check` → `maintkit pack` → upload zip → submit.

## base_commit: tiga jebakan sekaligus

- **UI menampilkan hash pendek** (`7bf6ded65b`), grader.yaml butuh **40
  karakter**. Kit menolak yang pendek dengan pesan
  `base must be the 40-character base commit`.
- **Upload zip MENIMPA grader.yaml termasuk `base_commit`** — platform
  TIDAK mengembalikan field generatif setelah upload. Jadi zip yang
  memuat placeholder akan mengembalikan error
  `grader-base-commit` setiap kali di-upload.
- Nilai yang benar ada di **grader.yaml scaffold task page** (atau draft
  task lain pada repo + environment yang sama). `.maintkit.json` di folder
  task juga menyimpan base — samakan ketiganya:
  `tests/grader/grader.yaml` (`base_commit`), `task.toml`
  (`base_commit_hash`), `.maintkit.json` (`base`), kalau tidak, `maintkit
  check` gagal.

Praktik: setelah tahu base platform, ganti ketiga file sekaligus, baru
`pack`. Kalau task page mendukung edit langsung, mengedit file di situ
lebih cepat daripada siklus upload.

## Anggaran timeout: 1800s total, sisa ~315s untuk kita

Platform menyuntik tiga kriteria sendiri ke grader.yaml saat submit:
`regression_safety` (720s), `mechanical_cleanliness` (360s),
`test_correctness` (360s) = **1440s**. Sisa untuk kriteria command kita
≈ **315 detik total**. Melebihi itu = error submit
`grader-timeout-budget`.

- Kit 1.3.2 memeriksa budget versi lamanya (1755s) — PASS di kit bukan
  jaminan lolos submit.
- Kriteria `build` kami (fmt + clippy) duplikasi `mechanical_cleanliness`
  platform dan gagal di environment platform — kriteria redundan hanya
  menambah permukaan gagal. Hapus.
- Alokasi akhir yang dipakai: f2p 220s + p2p 75s = 295s.

## Grader.yaml: apa yang boleh dan tidak disentuh

- Kriteria platform boleh diubah **blocker/weight-nya saja**; menghapus =
  gagal submit. Kriteria milik sendiri (mis. `build`) bebas dihapus.
- Platform menambahkan otomatis: `protected_ecosystems`, `max_files` /
  `max_changed_lines` pada scope (longgar: 10× golden), perluasan
  kalibrasi, `verifier_timeout_seconds`. Jangan tulis sendiri.
- `report:` harus di bawah `/logs/verifier/`; format default junit.

## Batasan borrowed ZIP (snapshot tanpa .git)

`maintkit verify` penuh tidak bisa dijalankan (butuh base commit platform
+ Dockerfile disetujui). Yang tetap bisa:
- Inisialisasi git lokal pada snapshot, commit awal = "base" —
  `maintkit check --repo <path>` lalu memeriksa **applicability ketiga
  patch** (berhasil dijalankan; ketiganya apply bersih).
- Menjalankan sendiri keempat skenario (base/golden/alternative/negative)
  dengan runner yang sama seperti grader (nextest + JUnit) — pengganti
  verify yang paling mendekati.
