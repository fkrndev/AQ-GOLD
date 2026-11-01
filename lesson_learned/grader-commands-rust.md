# Perintah grader untuk Rust (cargo-nextest + JUnit)

Sumber bug validasi paling mahal di task credential-revocation.

## Bug #0 (akar masalah SEBENARNYA): verifier jalan sebagai user unprivileged

Log reference verification (`logs/task-1-reference-verification`) membuktikan
semua perintah cargo/nextest milik author mati dengan:

```
error: failed to create directory `/build/target/debug`
Caused by: Permission denied (os error 13)
```

`CARGO_TARGET_DIR=/build/target` milik image adalah root-owned; perintah
kriteria author dieksekusi sebagai user unprivileged (kriteria platform
tampaknya berjalan dengan hak lebih tinggi). Akibatnya: setiap perintah yang
perlu mengompilasi apa pun (menyalin test baru, patch mengubah sumber,
bahkan metadata nextest) gagal instan ~3 detik — dan laporan JUnit tak
pernah tercipta, sehingga SEMUA run (golden, alternative, no-change)
menunjukkan `share passed [0.00, 0.00]`.

**Perbaikan**: awali perintah cargo dengan target dir sendiri yang bisa
ditulis, dibagi antar kriteria supaya cache hangat:

```
CARGO_TARGET_DIR=/tmp/cargotarget cargo nextest run ...
```

Biaya: kompilasi dingin menempel pada timeout kriteria. Terukur lokal
dengan `-j 4`: subset 3 crate ≈ 61s, full workspace ≈ 63s → timeout
f2p 170s / p2p 140s (total 310 ≤ 315 budget) cukup aman.

**Diagnosis cepat untuk masa depan**: pola "semua run 0.00 merata" =
perintah tak menghasilkan report. Minta/periksa log per-check di folder
hasil verifikasi — satu baris `Permission denied` menjelaskan semuanya,
dan hook `pre_artifacts` di log juga membocorkan base commit 40 karakter
yang tidak pernah tampil penuh di UI.

## Bug #7 (JS/vitest): id JUnit wajib di-unescape — dan format `suite > test` memang benar

Probe empiris (12 kandidat id dalam satu dry run gratis) menutup
misteri tiga kegagalan beruntun: format yang benar adalah
`classname.name` dengan nama lengkap `"describe > test"` DAN karakter
`>` ASLI. Bug ekstraksi: nama di XML JUnit ter-escape (`&gt;`);
ekstraksi pertama tidak meng-unescape → id berisi literal `&gt;`
(tidak akan pernah cocok); ekstraksi kedua malah membuang prefiks
describe (juga salah). Koreksi ketiga lulus di probe.

Aturan:
- Selalu unescape SEMUA entity XML saat ekstraksi id:
  `&apos;→'`, `&gt;→>`, `&lt;→<`, `&quot;→"`, `&amp;→&` (amp terakhir).
  **`&apos;` mudah terlewat** — satu nama test yang berisi apostrof
  (`sorts recommendations with 'now'...`) cukup untuk membuat p2p
  189/190 dan membatalkan kalibrasi alternative.
- Verifikasi id mengandung ` > ` untuk test dalam describe, dan PASTIKAN
  tidak ada sisa entity (`&...;`) di daftar final: skrip pengecekan
  `any('&' in id and ';' in id for id in ids)` harus False sebelum pack.
- **Teknik probe**: kalau format id diragukan, taruh 8–12 kandidat
  ejaan berbeda sebagai daftar f2p dalam satu dry run gratis; angka
  `X/N passed` + daftar missing langsung mengungkap format yang benar —
  jangan tebak-tebak lewat submission.

## Bug #6 (JS/vitest): nama test di JUnit platform TANPA prefiks describe

Bukti forensik: dari 40 id f2p, satu-satunya yang cocok di report platform
adalah test yang berada di level akar (tanpa describe) — id-nya
`file.hidden_always_explains...` polos. Ekstraksi lokal menghasilkan
`file."describe > test"` (vitest junit lokal menyertakan rantai describe),
report platform memakai **nama test polos**. Semua id berkaitan describe
jadi "missing from the report" (f2p 1/40, p2p 0/190).

Aturan: saat ekstraksi id dari JUnit vitest, **buang prefiks describe**
(`name.rsplit(" > ", 1)[-1]`) dan pastikan hasilnya unik per file; taruh
minimal satu test di level akar saat debugging format — itu "canary" yang
langsung terlihat cocok/tidak di log platform.

## Bug #5 (JS/vitest): perintah harus mengikuti SEMUA file hidden + jangan
## bertaruh pada rm

Dua kegagalan run pertama task Tripal (f2p 1/40, p2p 0/190 semua "missing
from the report") berasal dari perintah, bukan format id:

1. Saat file hidden dipecah jadi dua, perintah f2p masih menyalin SATU
   nama file. Seluruh file kedua tak pernah masuk repo → id-nya absen
   dari report. **Aturan: perintah f2p menyalin glob
   `cp /tests/hidden/*.test.ts`**, bukan nama file manual.
2. p2p dibuka dengan `rm -rf tests/hidden && ...` — jika rm gagal (dir
   terkunci/dll) seluruh rantai mati dan report kosong. Untuk suite
   berbasis file, lebih kokoh menjalankan **glob eksplisit
   `npx vitest run tests/*.test.ts`** yang tak pernah menyentuh folder
   hidden — tanpa rm sama sekali.
3. Format id JUnit vitest = `classname.name` dengan pemisah
   `"describe > test"` — konsisten lintas versi 3.2.x; versi lokal harus
   disamakan dengan lockfile platform sebelum ekstraksi id.

Juga: pertanyaan rubric yang di-judge fluktuatif (jawaban beda antar
sampling) dipertegas dengan **menjangkarkan ke nama fungsi publik**
("Does rebalanceMilestones in rebalance.ts return...") — bukan ke file
saja; nama fungsi adalah kontrak publik yang deskripsi sebut, jadi bukan
overfit.

## Bug #4: kriteria timeout → run "ungraded" → tanpa file reward

Gejala (task hold-expiry, grader round-2): golden dan alternative
`RewardFileNotFoundError` / "produced no result", padahal nop dan negative
menghasilkan reward normal. Penjelasannya berlapis:

- Kriteria yang menembus timeout tidak sekadar "gagal" — ia *fails as not
  run* → criteria runner menandai run **ungraded** (menulis
  `ungraded.json`, bukan `reward.txt`) → harness melihat tidak ada file
  reward → trial error.
- Siapa yang kena: run yang **mengompilasi hidden test sampai selesai**
  (golden/alternative, compile penuh ~150-170s di runner 2-CPU) lebih
  rawan tembus timeout daripada run yang gagal compile cepat (nop) atau
  muat pas di bawah batas (negative). Jadi polanya menyesatkan: yang
  "paling benar" justru yang tanpa hasil.
- Pemicu tambahan: verifikasi ternyata memakai **upload-an lama** —
  zip round-3 (profil ramping) belum pernah ter-upload; terbukti dari
  metrik log yang menunjukkan 132 id p2p (daftar lama), bukan 84.

Pelajaran ganda:
1. **Margin timeout bukan kosmetik** — kena timeout bisa menghanguskan
   seluruh reward run, bukan sekadar menggagalkan satu kriteria.
2. **Zip terbaru di disk ≠ grader di task page.** Setelah upload,
   buka grader.yaml di task page dan cocokkan sidik jari: jumlah id
   (f2p/p2p), env var di perintah (`CARGO_PROFILE_TEST_OPT_LEVEL=0`),
   dan angka timeout. (Detail forensik log: verification-logs.md.)

## Bug #3: memangkas timeout yang sudah lolos = membunuh kriteria

Run ke-N: f2p lolos di timeout 170s. Run ke-N+1: timeout "direbalance"
turun ke 150s → f2p gagal [0,0]. Durasi kompilasi dingin di runner
2-CPU mereka ~150-170s untuk subset — jangan pernah menurunkan timeout
kriteria yang baru saja lolos; angka lulus adalah BUKTI batas bawah.

Solusi strukturalnya bukan menaikkan timeout (budget total 315s), tapi
**mempercepat kompilasinya**:

```
CARGO_PROFILE_TEST_OPT_LEVEL=0 CARGO_PROFILE_TEST_DEBUG=0 CARGO_TARGET_DIR=... cargo nextest ...
```

Terukur lokal -j2: subset 61s → **32s**; scoped-full 63s → **31s**.
Plus scope p2p dengan `-p` ke 6 crate di sekitar perubahan (skips
thermal/network/xtask + proptest) → p2p dingin ~31s. Timeout aman
155/155. Profil env BUKAN edit file Cargo.toml (yang jalan path
protected) — override env diperbolehkan.

## Bug #2: residu f2p meracuni p2p pada run no-change

f2p menyalin hidden test ke dalam tree. Pada run **golden** file itu valid
(kompilasi ✓), tapi pada run **no-change (base)** file itu TIDAK kompile
(method belum ada). Kalau kriteria berbagi tree, p2p lalu mencoba membangun
seluruh workspace termasuk file rusak itu → `could not compile (test
"hidden_...")` → tidak ada report → 132 test terdaftar dianggap gagal →
"no-change runs failed some of the tests listed as already passing
(share passed [0.00, 0.00])".

**Perbaikan**: perintah p2p dibuka dengan menghapus residu itu:

```
rm -f crates/<...>/tests/hidden_*.rs && ... cargo nextest run ...
```

**Protokol uji lokal yang seharusnya dari awal**: jalankan perintah persis
dari grader.yaml pada DUA skenario — tree golden (f2p lalu p2p) DAN tree
base yang sudah ditumpuki file hidden (p2p saja). Bug hanya muncul pada
kombinasi kedua.

## Bug #1: argumen setelah `--` bukan untuk nextest

Perintah salah (crash di verifier):

```
cargo nextest run --profile p2p-junit -- --skip hidden_ --no-tests=fail
```

Setelah `--`, semua argumen diteruskan ke **test binary** (emulasi
libtest). `--no-tests` adalah argumen nextest, bukan libtest →
`error: failed to parse test binary arguments '--no-tests=fail'` →
perintah gagal → **JUnit tidak pernah tercipta** → seluruh test yang
tercantum di `tests:` dianggap gagal → skor 0 untuk SEMUA run
(golden, alternative, no-change).

Gejala khasnya di pesan validasi platform:
`share passed [0.00, 0.00]` untuk semua jenis run. Angka 0.00 merata
berarti "perintah tidak menghasilkan report", bukan "kode salah".

Perbaikan: flag nextest ditaruh sebelum `--` — atau cukup hilangkan
`--no-tests=fail` (id test yang hilang dari report tetap menggagalkan
kriteria, jadi flag itu tidak diperlukan).

## Bug #2 (hampir): menguji perintah yang MIRIP, bukan yang PERSIS

Saat authoring, `-- --skip hidden_` dan `--no-tests=fail` masing-masing
pernah diuji lokal dan lulus — tetapi **kombinasinya** tidak pernah
dijalankan utuh sebelum submit. Pelajaran: sebelum masuk grader.yaml,
jalankan string perintah **persis bit-per-bit** (copy dari file, bukan
retik dari ingatan), pada kondisi cache yang paling mirip verifier.

## JUnit di nextest: lewat profile, bukan flag

- Tidak ada flag `--junit`. Konfigurasi lewat `.config/nextest.toml`:

  ```ini
  [profile.f2p-junit]
  retries = 0

  [profile.f2p-junit.junit]
  path = "/logs/verifier/f2p.xml"
  ```

- Karena repo tidak boleh memuat config itu di patch, perintah grader
  yang menuliskannya saat runtime (rangkaian `echo ... >>`), lalu
  `cargo nextest run --profile f2p-junit <filter>`.
- Path JUnit **absolut** ditulis apa adanya; path relatif malah
  diarahkan ke `target/nextest/<profile>/...`.

## Memilih hidden test vs test yang ada

- Filterset `-E 'test(nama_binary)'` tidak konsisten (run mode memilih 0
  test meski `list --verbose` menandai cocok). Yang andal: **filter
  posisional berdasarkan nama test**.
- Konvensi kami: semua fungsi test tersembunyi diberi prefiks `hidden_`.
  - f2p: `cargo nextest run -p <crate...> --profile f2p-junit hidden_`
  - p2p: `cargo nextest run --profile p2p-junit -- --skip hidden_`
  (`--skip` adalah argumen libtest yang sah setelah `--`.)
- Tambahkan `-p <crate>` pada f2p agar nextest tidak mem-build seluruh
  22 target test workspace — memangkas waktu kompilasi (terukur ~11
  detik hangat).

## Format id test di `tests:`

Id = `classname.name` dari testcase JUnit; classname nextest berbentuk
`package::binary`, contoh:
`caldarium-api::hidden_credential_http.hidden_revoke_unknown_credential_is_not_found`.
Ekstrak dengan menjalankan perintah sekali lalu memetakan XML-nya —
jangan menulis id dengan tangan (akhiran/salah ketik = kriteria gagal).

## Catatan environment

- Image environment memasang `cargo-nextest --locked --version 0.9.143`
  — samakan versinya lokal (`cargo install cargo-nextest --locked
  --version 0.9.143`) agar perilaku flag identik.
- `CARGO_TARGET_DIR=/build/target` di image; cache hangat dibagi antar
  kriteria, jadi perintah kita tinggal inkremental — tetap beri timeout
  wajar (220s untuk f2p cukup jauh dari bahaya).
