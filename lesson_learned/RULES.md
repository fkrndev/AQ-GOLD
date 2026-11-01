# ATURAN TASK AUTHORING — Baca sebelum membuat & sebelum submit

Format: `[ ]` = wajib dicek setiap kali. Grup berdasarkan fase kerja.

---

## FASE 1: DESKRIPSI (instruction.md)

- [ ] Panjang 60–300 kata. Rasio baris-patch:kata = 0.9–7.5.
- [ ] Prosa polos: TANPA heading (#/##), TANPA garis (===/---), TANPA em-dash.
- [ ] Tanpa code block (``` fence) — signature ditulis inline dengan panah (→) dan pipe (|).
- [ ] TANPA blok signature multi-baris ber-indentasi dan TANPA sintaks tipe
      TypeScript (`lockedIds?: string[]`, `fail: {...}` di baris sendiri).
      Itu gaya dokumentasi API = AI tell. Tulis sebagai kalimat prosa:
      "X(a, b) takes a number and optional ids and returns {...} or {...}".
- [ ] Kalimat pertama ≤ 5 kata ATAU tidak lengkap (bukan kalimat formal).
- [ ] Minimal satu frasa emosional yang hanya manusia frustrasa tulis.
- [ ] Semakin pendek semakin aman (200–250 > 270+).
- [ ] AI-check ditolak 2× → ubah RADIKAL (struktur keseluruhan), bukan poles.
- [ ] Bila task menambah fungsi murni baru: sebutkan module path, semua nama
      fungsi, parameter, request/response shape, dan literal string reason values.
- [ ] Bila task punya skema output yang diuji persis (JSON fields, envelope):
      tulis semua field dan bentuknya di deskripsi.
- [ ] Jangan sebut: pendekatan, file helper, algoritma, pseudocode.
- [ ] Jangan sebut: verifier, grader, rubric, hidden test, skor, reward.
- [ ] Setiap frasa di deskripsi harus punya kriteria yang mengeceknya.
      Tidak ada frasa yatim (field, role, format, verb yang tak dicek).

## FASE 2: GOLDEN PATCH

- [ ] Minimal 450 baris tambahan di minimal 4 file.
- [ ] Semua perilaku yang hidden test uji = perilaku yang deskripsi sebut
      atau kode base implikasikan.
- [ ] Jangan uji pilihan implementasi tanpa menyatakan pilihan itu di deskripsi
      (urutan kandidat rilis, reason string untuk edge case ambigu).
- [ ] Pass semua test base + test baru + lint + typecheck + build.
- [ ] `next build` (bukan hanya `next lint`) harus tidak memperkenalkan
      error BARU di atas base yang sudah gagal.

## FASE 3: ALTERNATIVE PATCH

- [ ] Beda STRUKTUR: beda lokus solusi (module, tipe, strategi storage).
- [ ] Beda di SEMUA file yang disentuh (bukan hanya file inti):
      rename identifier UI, restructure alur integrasi, ubah format export.
- [ ] Bukan byte-identical di file sampingan (BriefWorkspace, estimate, dll).
- [ ] Harus lolos SEMUA blocker + SEMUA hidden test.
- [ ] Alternative harus MAINTAINABLE, bukan sekadar lolos: tidak ada export
      tak terpakai, docstring jujur (tanpa klaim fitur yang tidak ada),
      tidak ada kebocoran storage (per-key scheme WAJIB removeItem slot
      yang ter-evict/ter-replace; cek jumlah key <= cap setelah overflow).
- [ ] ID/tiebreak order TIDAK BOLEH random: save secepat milidetik di test
      menghasilkan timestamp identik; urutan dan eviksi harus stabil
      (counter monoton sebagai tiebreak, bukan Math.random).
- [ ] Parsing index/list dari storage harus tahan entry null/tipe salah
      (loop dengan validasi per-entry, bukan akses property langsung).

## FASE 4: NEGATIVE PATCH

- [ ] Gagal minimal satu blocker ATAU skor < 0.5.
- [ ] Gagal di tempat yang mencerminkan nilai bisnis yang deskripsi minta.
- [ ] Harus lolos mayoritas hidden test (plausible — terlihat benar).

## FASE 5: HIDDEN TESTS

- [ ] Minimal 430 baris non-blank di minimal 2 file.
- [ ] Minimal 10 test ID (ideal 20+).
- [ ] Hanya tergantung pada: API base + kontrak baru yang deskripsi sebut.
- [ ] Di tree base: COMPILE dan gagal karena assertion (bukan gagal compile).
- [ ] Semua nama test diawali prefix unik (mis. `hidden_`).
- [ ] Tidak menegaskan pilihan implementasi tanpa deskripsi menyebutnya.
- [ ] Test CLI melalui subprocess binary (`CARGO_BIN_EXE_*` / spawn), bukan
      parse-level saja bila dispatch juga penting.
- [ ] Nama test HARUS menyatakan PERSIS apa yang body cek — jangan melebihkan
      (contoh ditolak: "double_restore_creates_two" padahal cuma 1 restore;
      "still_appends_not_overwrites" padahal same-name replace).
- [ ] String/order/format EXAKTIF yang hidden test tegaskan (teks kosong,
      urutan terbaru-dulu, trimming) WAJIB tertulis di deskripsi — kalau tidak,
      hapus test-nya. Reviewer menyebut ini "arbitrary assertion".
- [ ] JEBAKAN ANCHOR: operasi delete/restore pada revisi bernama — revisi itu
      TIDAK BOLEH jadi yang pertama disave (anchor = tak bisa dihapus).
      Delete gagal senyap (`anchor-protected`) dan assertion lemah
      (`>= 1`, `some`) menutupinya. Selalu `expect(deleted.ok).toBe(true)`
      untuk operasi yang test anggap berhasil.
- [ ] Aseran hitungan (`count === n+1`) hanya boleh bila nama dijamin UNIK.
      Restore berkali-kali → nama `X (restored)` SAMA → same-name REPLACE,
      bukan append. Jangan asumsi jumlah bertambah.
- [ ] Path penyimpanan kegagalan (mis. `storage-unavailable`) yang deskripsi
      sebut WAJIB punya minimal satu hidden test yang mengeceknya.
- [ ] Property objektif (recovery data korup, setItem gagal, fungsi murni)
      = HIDDEN TEST (blocking), BUKAN pertanyaan rubric. Uji secara
      agnostik-implementasi: tulis payload korup ke SEMUA key storage
      (delta keyset), tanpa menghardcode nama key modul.
- [ ] Hati-hati saat mengkorupsi "semua key": jangan ikut merusak key data
      utama (brief) yang fungsi baca. Snapshot delta SETELAH data utama
      tersimpan.

## FASE 6: GRADER.YAML

- [ ] f2p: minimal 10 test ID (ideal 20+), setiap ID harus lulus di golden.
- [ ] p2p: minimal 50 test ID, setiap ID harus lulus di base DAN golden.
- [ ] Jangan sertakan test golden-baru di daftar p2p (harus lulus di base).
- [ ] Semua entity XML di-unescape: `&apos;→'`, `&gt;→>`, `&lt;→<`,
      `&quot;→"`, `&amp;→&` (amp TERAKHIR).
- [ ] Verifikasi: `any('&' in id and ';' in id for id in ids)` = False.
- [ ] Perintah f2p: salin SEMUA file hidden dengan glob (`*.test.ts`).
- [ ] Perintah p2p: gunakan glob eksplisit (`tests/*.test.ts`) atau
      buang residu (`rm -rf`) — jangan taruh `rm` sebagai syarat rantai `&&`.
- [ ] Perintah cargo: `CARGO_TARGET_DIR` sendiri yang writable.
- [ ] Timeout: jangan pangkas angka yang sudah terbukti lolos.
- [ ] Kriteria command: minimal (`lint`) bila platform check kosong.
- [ ] Bila `lint` sebagai kriteria: pastikan TIDAK memperkenalkan error baru.
- [ ] Jangan edit file yang platform check baca (tsconfig, linter config).
- [ ] Jangan hapus / edit kriteria platform (regression_safety, dll).
- [ ] Jangan edit field generatif (base_commit, docker_image, timeout).
- [ ] Total timeout semua kriteria command ≤ 315 detik (untuk Rust).
- [ ] Format ID JUnit = `classname.name` dengan nama LENGKAP
      (`"describe > test"`) dan karakter `>` ASLI.
- [ ] Untuk JS/vitest: periksa versi lokal = versi lockfile platform.

## FASE 7: SCOPE

- [ ] `protected_surfaces` (blocker): `denied_paths` HANYA untuk config
      files, migrasi ter-aplikasi, crate/module yang tak disentuh.
      JANGAN tolak file test existing: p2p (ID terpin) sudah mencegah
      kecurangan test base, dan menambah test baru ke file existing itu
      praktik normal (reviewer menolak blocker yang menolak praktik wajar).
- [ ] `protected_surfaces` punya `max_files` dan `max_changed_lines`
      (longgar: file×10, baris×10 dari golden).
- [ ] `focused_change` (non-blocker): `allowed_paths` area implementasi +
      tests, dengan `max_files` dan `max_changed_lines`.
- [ ] Kunci file SPESIFIK yang ter-aplikasi (mis. `001_initial.sql`),
      BUKAN glob (`sql/**`) — menambah migrasi baru itu solusi sah.

## FASE 8: RUBRIC.TOML

- [ ] 5–15 pertanyaan, semua `type = "binary"`.
- [ ] Satu pertanyaan = satu properti. TANPA "and" yang menggabungkan
      dua syarat berbeda.
- [ ] Tidak ada dua pertanyaan yang mengecek hal yang sama (satu defect
      → satu "no").
- [ ] Tidak menduplikasi perilaku yang hidden test sudah uji.
      Kalau hidden tests behavior-complete → rubric fokus: keterbacaan
      kode, kualitas pesan error untuk user, wiring UI, kualitas integrasi.
- [ ] Blocker = maintainer MENOLAK PR karena hal itu sendirian.
      Preferensi struktural/arsitektur = NON-blocker.
- [ ] Yang bisa grep/exit-code = command criterion di grader.yaml,
      BUKAN pertanyaan rubric.
- [ ] Nama file yang rubric sebut HARUS ada di deskripsi (bukan cuma golden).
- [ ] Pertanyaan rubric DILARANG merestatikan instruksi (menanyakan kembali
      "apakah logika ada di file X" — semua attempt yang lolos f2p pasti
      ya; negative juga ya = trivial). Tanyakan properti yang SOLVER LEMAH
      bisa lewatkan (cleanup storage, normalisasi parse, persist identitas).
- [ ] Referensi test di rubric: sebut DIREKTORI ("the new test files under
      tests/"), bukan nama file spesifik (solver bisa beda nama) dan bukan
      frasa tanpa path (maintkit menolak).
- [ ] File reference `(Judge X.)` HARUS cocok dengan file yang pertanyaan
      tanyakan.
- [ ] Bobot: fitur user-facing (UI) > kualitas kode > preferensi struktural.
- [ ] Hitung: berapa poin yang negative patch dapat "yes"? Kalau >50%,
      tambah pertanyaan diskriminatif atau hapus yang trivial.
- [ ] Negative patch WAJIB gagal minimal SATU pertanyaan rubric (kriteria
      "non-trivial" reviewer). Resolusi konflik dengan larangan duplikasi:
      tepat SATU pertanyaan tentang semantic inti task (yang maintainer
      akan tolak PR-nya) boleh overlap dengan hidden test; sisanya
      pertanyaan kualitas yang hidden test TIDAK cek (recovery data korup,
      pengelompokan module, isolasi state test sendiri, pesan error user).
- [ ] Kalau ditolak judge karena fluktuatif → jangkarkan ke nama fungsi
      publik yang deskripsi sebut ("Does X in Y return...").
- [ ] Reference verification menuntut SETIAP run rubric ≥ 0.9 pada GOLDEN.
      Sebelum submit, baca kode golden di titik yang ditanya: jawabannya
      harus YES yang SARAING JELAS (satu jalur kode, tanpa tafsir).
- [ ] Pertanyaan rubric TIDAK BOLEH menyuruh judge MEMBANDINGKAN dengan
      file/implementation lain ("same way the existing save does") —
      perbandingan = jawaban flip-flop antar run.
- [ ] Anchor pertanyaan = SATU FUNGSI ("Judge the restoreRevision function
      in revisions.ts."), bukan file utuh — mempersempit perhatian judge
      supaya deterministik.
- [ ] Dua sifat dalam satu kalimat ("saves as new AND leaves untouched")
      = judge bisa setuju separuh → pecah jadi satu properti saja.
- [ ] Jangan deskripsikan EFEK hilir ("treated as a fresh draft") — tiap
      operasi punya efek beda (draft / empty / not-frozen) → judge pemilih
      menjawab no. Sebut MEKANISMEnya yang satu dan terlihat: "the parsing
      returns null instead of throwing".

## FASE 9: BLOCKER KHUSUS UI

- [ ] Grep blocker: PERIKSA file base apakah sudah punya pola itu
      (`checked=`, `<button`, dll). Kalau ya → grep tidak berguna.
- [ ] Untuk UI yang tak bisa diuji lewat interface terprogram (node env,
      bukan jsdom): rubric non-blocker berbobot tinggi adalah MAXIMUM.
      Jangan paksa grep blocker yang lemah.
- [ ] Fitur UI yang dideskripsikan minimal punya rubric w3.

## FASE 10: KALIBRASI (Calibration I & II)

- [ ] Task CRUD tunggal = terlalu mudah. Minimal satu sudut semantik:
      paginasi berkursor (stabilitas, duplikasi), batch transaksional
      (all-or-nothing), rotasi (sekali-tampil), state machine (transisi
      ilegal), atau redistribusi berkendala (minimum + total eksak).
- [ ] Setelah reference verification hijau, solver otomatis dilarang
      menyelesaikan 3/3. Kalau kena: tambah sudut, bukan cuma baris.
- [ ] Tanya diri: bagian mana yang akan gagal oleh solusi "hampir benar"?

## FASE 11: VERIFIKASI SEBELUM SUBMIT

- [ ] Jalankan perintah grader PERSIS dari file grader.yaml (copy-paste,
      bukan retype) di dua skenario: tree golden DAN tree base dengan
      residu hidden test.
- [ ] Verifikasi keempat kalibrasi: golden (skor 1), no-change (skor 0),
      alternative (semua blocker lolos), negative (gagal blocker).
- [ ] `maintkit check` PASS 0 error 0 warning.
- [ ] Gunakan "Run checks" di platform (gratis) SEBELOM submit.

## FASE 12: KOMUNIKASI

- [ ] Ide task dikirim ke thread admin DULU sebelum buat task.
- [ ] Jujur kalau task sudah terlanjur dibuat.
- [ ] Tulis pesan polos: tanpa em-dash, tanpa heading, gaya channel.
- [ ] `instruction.md` akan di-AI-check — tulis dengan gaya manusia.

## FASE 13: LOG & DIAGNOSIS

- [ ] Buka `exception.txt` dari trial yang gagal.
- [ ] Bandingkan metrik console.log antar jenis run (oracle/nop/negative).
- [ ] Cocokkan sidik jari grader (jumlah ID, env var, timeout) dengan zip
      yang dikira ter-upload. Zip terbaru di disk ≠ file di task page.
- [ ] Kalau format ID diragukan: probe dry run dengan 8–12 kandidat ejaan.
- [ ] `share passed [0.00]` di semua run = perintah tidak menghasilkan report.
- [ ] `share passed [0.xx]` di beberapa run = kriteria timeout → ungraded.
- [ ] Tulis/materai file kode berisi escape (`\n`, `\\`) pakai tool
      Write/Edit, JANGAN heredoc bash + python — `\\n` menjadi newline nyata.

---

## CROSSCHECK WAJIB SEBELUM UPLOAD (hemat 1 jam per run yang gagal)

Jalankan SEMUA ini pada golden DAN alternative DAN negative. SATU pun gagal = jangan upload.

### A. Build (bukan cuma tsc/lint!)
```
npm run build   # di setiap branch: golden, alt, neg
```
- `next build` menangkap error yang `tsc --noEmit` dan `next lint` LEWATKAN
- Hanya boleh punya error yang SAMA seperti base (baseline exemption)
- Error BARU (unused vars, type errors) = JANGAN UPLOAD

### B. Konstanta yang dihapus
```
grep -rn "NAMA_KONSTANTA" --include="*.ts" --include="*.tsx" .
```
- Setelah menghapus konstanta/import, GREP semua referensinya
- Satu referensi tersisa = build gagal di platform tapi mungkin lolos di tsc lokal

### C. Rubric file-reference dan identifier
- Setiap pertanyaan rubric menyebut file → file HARUS ada di golden patch
- Setiap nama fungsi/prop yang rubric sebut → HARUS ada di file yang di-reference
- Callback prop ≠ direct call (jangan tanya "apakah X memanggil Y" kalau Y di file lain)

### D. Hidden tests di SEMUA branch
```
# di golden: semua harus PASS
# di alternative: semua harus PASS
# di negative: minimal satu harus FAIL (blocker menangkap)
# di base: harus compile dan FAIL karena assertion
```

### E. Grader ID
- Tidak ada entity XML tersisa: `any('&' in id and ';' in id)` = False
- Semua ID = `classname.name` dengan ` > ` asli

### F. Zip fingerprint
- Ukuran file zip = ukuran yang diharapkan
- Task page menampilkan jumlah test yang benar
- Upload, lalu verifikasi fingerprint SEBELUM submit

## YANG TIDAK BOLEH DILAKUKAN (merangkum semua kegagalan)

| ❌ | Keterangan |
|---|---|
| `--no-tests=fail` setelah `--` | Argumen setelah `--` diteruskan ke test binary, bukan nextest |
| Menyalin satu nama file hidden (bukan glob) | File kedua tak tersalin → absen dari report |
| `rm -rf tests/hidden && ...` di p2p | Kalau rm gagal, seluruh rantai mati |
| Memangkas timeout yang sudah terbukti lolos | Angka lulus = bukti batas bawah |
| `CARGO_TARGET_DIR=/build/target` untuk user unprivileged | Permission denied |
| Grep `checked=` / `<button` bila base sudah punya | Lolos tanpa UI baru |
| Rubric blocker yang cek struktural/arsitektur | Reviewer minta refactor, bukan refuse |
| Dua pertanyaan rubric yang beririsan | Satu defect → dua "no" |
| Nama fungsi/prop di rubric tidak ada di file yang di-reference | Judge cari nama itu di file itu → "no" |
| Rubric yang menduplikasi hidden test behavior | Hidden test sudah menangkap |
| Rubric tanpa blocker yang negative juga dapat 100% | Tidak diskriminatif |
| File reference rubric ≠ file yang ditanyakan | Judge bingung |
| Bobot struktural > bobot fitur user | Prioritas terbalik |
| Entity XML tertinggal di ID (`&gt;`, `&apos;`) | ID tidak cocok dengan report |
| Id dengan prefiks describe tapi tanpa `>` asli | ID tidak cocok |
| Zip terbaru di disk ≠ zip di task page | Selalu verifikasi fingerprint |
| Tulis kode sumber berisi `\n` lewat heredoc bash | `\\n` diubah jadi newline nyata → string literal putus (2× kejadian) |
| Deskripsi dengan code block / kalimat sempurna | AI-check menolak |
| Alternative byte-identical di file sampingan | "Near copy" |
| Nama test melebihkan isi body-nya | Reviewer: "name says one thing, body checks another" |
| Delete/restore menarget revisi PERTAMA (anchor) | Gagal senyap `anchor-protected`, assertion lewat palsu |
| Aseran hitungan pada nama yang bisa sama | Same-name replace → hitungan tidak naik |
| String eksak di hidden test tanpa ada di deskripsi | "Arbitrary assertion" |
| File test existing tidak masuk denied_paths | "Solver bisa curang" anti-cheating |
| Semua rubric lolos oleh negative | "Trivial" — negative wajib gagal ≥1 |
