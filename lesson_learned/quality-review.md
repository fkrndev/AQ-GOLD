# Pelajaran dari quality review (reviewer, bukan validasi mekanis)

Setelah validasi mekanis lolos, task masih melewati review kualitas yang
menilai desain rubric, cakupan, dan kejujuran metadata. Delapan blocking
criteria gagal pada credential-revocation — semuanya pelajaran desain.

## 1. Pertanyaan rubric harus ATOMIK — tanpa "dan"

`tests-cover-refusal-paths` bertanya "test sukses DAN test refusal?" —
satu yes/no menyembunyikan bagian mana yang hilang; alternative.patch
menambah hanya kasus sukses. Pertanyaan majemuk harus dipecah:

- "Apakah perubahan menambah test untuk revocation yang berhasil?"
- "Apakah perubahan menambah test untuk jalur yang ditolak?"

## 2. Properti, bukan mekanisme (jangan overfit)

Tiga pertanyaan kami menuntut mekanisme spesifik dan menolak solusi valid:

- "requires SQL ORDER BY" → menolak pengurutan yang sah di Rust.
- "ties the fix to repos.rs" → menolak scoping di layer lain.
- "only credits tests in ops.rs" → menolak test refusal yang sah di http.rs.

Kata kunci yang benar: *apakah listing punya urutan deterministik*,
*apakah setiap akses credential di-scope per tenant* — tanpa menyebut
file, SQL, atau struktur internal. **Menyempitkan pertanyaan ke file
milik golden demi membuat judge menjawab yes = menukar satu kegagalan
dengan kegagalan lain.** Perbaikan yang benar saat judge menolak golden
sendiri: perbaiki test golden atau pecah pertanyaannya.

## 2b. Pertanyaan "buktikan tidak ada perubahan" rapuh terhadap judge sendiri

`existing-authentication-untouched` ("apakah path autentikasi tetap
bekerja seperti sebelumnya?") di-jawab NO oleh judge pada golden sendiri
— padahal perilakunya identik; diff memang (sah) merefactor fungsi
penyimpanan di sekitarnya. Meminta judge menyimpulkan *ketiadaan
perubahan perilaku* dari diff yang menyentuh kode tetangga = ambigu.

Aturan praktis: kalau requirement sudah diuji hidden test (di kasus ini:
"key yang sehat tetap bisa dipakai" ada di `hidden_revoking_one_key_
leaves_other_keys_working`), **hapus saja pertanyaan rubric-nya** —
panduan platform sendiri bilang requirement yang sudah diuji tidak perlu
ditanyakan lagi. Judge-variance pada pertanyaan ambigu persis seperti ini
yang membuat skor golden [0.88, ≥0.9] fluktuatif antar run.

## 3. Setiap kata requirement di deskripsi harus dicek di suatu tempat

Deskripsi bilang listing menampilkan "its label" — tidak ada test/rubric
yang memeriksa field label (test hanya memeriksa id, userId, keyPrefix,
revoked). Audit cakupan: peta setiap frasa deskripsi → kriteria.
Sisa yang tak terpetakan = kegagalan "comprehensiveness".

Termasuk peran: "Could an **admin** see" → mengekspos listing ke semua
role lolos dari semua blocker. Kalau kata peran ada di deskripsi,
blocker harus menguji penolakan role lain (hidden test > rubric).

## 4. Properti objektif → kriteria deterministik, bukan pertanyaan judge

`docs-list-the-new-surface` (docs menyebut route baru) bisa diperiksa
grep — jangan diberikan ke judge. Aturan praktis: kalau bisa grep/exit
code, itu `command` criterion di grader.yaml.

## 5. Metadata scope harus jujur — dan di-set eksplisit

Deskripsi protected_surfaces menjanjikan "no wholesale rewrite" tetapi
TIDAK meng-set `max_files`/`max_changed_lines` → rewrite besar lolos dan
reviewer menyebut pass-nya menyesatkan. Setiap klaim ukuran di deskripsi
scope harus dibarengi angka (panduan: longgar — file×10, baris×10 dari
golden).

## 6. Jangan bersandar pada kriteria platform yang ternyata kosong

Baseline environment mencatat semua check build/test/clippy platform
gagal di base (exit 101 — efek kaskus bug unprivileged `/build/target`)
→ `platform-check.py` mengecualikan semuanya → regression_safety dan
mechanical_cleanliness jadi otomatis-lolos, mechanical tinggal rustfmt.
Akibat: (a) blocker "validity" mereka lemah, (b) aturan guidelines
"clippy -D warnings" tak di-enforce siapa pun. Jika guidelines repo
mensyaratkan lint, sediakan kriteria command sendiri (clippy) — dan
kenali bahwa environment yang baseline-nya rusak mengosongkan kriteria
platform.

## 7. Skema output yang di-test persis → dokumentasikan di deskripsi

Hidden test memeriksa bentuk JSON detail (array telanjang di top-level,
kunci `id`/`userId`/`keyPrefix`, boolean `revoked`, body response revoke).
Deskripsi tidak menyebut satu pun. Pilihan: dokumentasikan skema di
deskripsi (lebih adil), atau longgarkan test ke properti yang bisa
disimpulkan. Advisory, tapi calon solver tidak boleh menebak nama kunci.

## 8. CLI yang hanya di-test parse-nya = celah

CLI hanya diuji `try_parse_from` (keterbatasan env-var edition 2024).
Reviewer menilai dispatch CLI tak tercakup. Kompensasi: test perilaku
CLI lewat jalur lain (mis. assert struktur args + facade sudah teruji),
atau rubric khusus dispatch — jangan dibiarkan kosong.

## 9. Hidden test hanya boleh terikat KONTRAK PUBLIK yang didokumentasikan

Review kedua menolak hidden test yang **terikat kompilasi** pada nama
internal: `list_credentials(&Principal, &str)` di facade, field
`tenant_id` pada struct listing (tak ada di daftar field deskripsi),
enum `CredentialCommand::Revoke { id }` + flag `--id`. Solver yang
menyimpang sedikit → seluruh file test gagal compile → f2p gagal,
bukan karena perilakunya salah.

Aturan yang lahir:

- Hidden test hanya mengandalkan: **API base** (yang sudah ada sebelum
  perubahan) + **kontrak baru yang tertulis di deskripsi** (route,
  field JSON, sintaks CLI).
- Lebih baik **gagal runtime** (route tak ada → 404/405, perintah tak
  dikenal → exit 2) daripada gagal compile — verifikasi eksplisit:
  jalankan hidden test di tree base; mereka harus COMPILE dan gagal
  karena assertion.
- Test behavioral pindah ke **HTTP** (route = kontrak); test CLI pakai
  **subprocess binary asli**: `env!("CARGO_BIN_EXE_<bin>")` +
  `Command::env(...)` (aman — `Command::env` bukan `unsafe`, beda dari
  `std::env::set_var` yang `unsafe` di edition 2024). Ini menguji
  dispatch penuh: parse → auth → facade → output + exit code.
- Deskripsi: hapus pengaman "something along the lines of" untuk
  permukaan yang dipatok test; tulis bentuk persisnya.

## 10. Data yang sudah ada di disk / format persisten wajib dijaga blocker

Review ketiga (credential-revocation): "backwards compatibility coverage"
dan "scope controls" gagal karena perubahan menyentuh tabel persisten
`cd_credentials` milik database live, namun:

- **semua test memakai database segar** — tidak ada test yang
  merepresentasikan data lama, sehingga tidak ada blocker yang
  melindungi deployment yang sudah berjalan;
- **migrasi ter-aplikasi (`sql/001_initial.sql`) tidak ada di denied
  paths** — solver bisa "menambah kolom" dengan mengedit migrasi yang
  sudah ter-aplikasi (melanggar aturan repo sendiri: "Never edit an
  applied statement; add a new version"), merusak semua DB existing,
  dan tetap lolos semua blocker.

Perbaikan: jadikan file migrasi ter-aplikasi **denied path pada
protected_surfaces (blocker)**. Penting: kunci **file spesifik yang
ter-aplikasi** (`001_initial.sql`), BUKAN `sql/**` — alternative yang sah
justru MENAMBAH migrasi baru (`002_*.sql`) dan harus tetap lolos.
Verifikasi: pastikan keenam patch (3 per task) tidak memuat diff header
untuk file itu; kemunculan nama file sebagai baris konteks di diff file
lain (mis. daftar MIGRATIONS di `migrations.rs`) tidak men-trigger scope.

Pertanyaan rubric untuk hal ini TIDAK perlu: perlindungan schema adalah
properti objektif → denied path di grader.yaml lebih kuat (blocking)
daripada pertanyaan judge.

## 11. Pelajaran dari review milestone-rebalancing (task API function-level)

Review ini gagal 8 kriteria — semuanya pelajaran untuk **task di mana
kontrak publiknya adalah TypeScript function API**, bukan HTTP route
atau CLI command. Empat pelajaran baru yang tidak tercakup sebelumnya:

### 11a. Untuk API function-level task, SIGNATURE adalah kontrak — dan wajib didokumentasikan

Di task HTTP/CLI (caldarium), kontraknya route + schema JSON — dan itu
terdokumentasi di description. Di task function-level (Tripal), kontraknya
adalah **module path, function signature, request/response shape, dan
literal string reason values** — dan SEMUANYA wajib tertulis di
description. Reviewer menolak karena hidden test mengimpor dari
`app/(site)/brief/rebalance` (module path tak tertulis), mengharapkan
shape `{ ok, milestones }` untuk sukses dan `{ ok:false, reason,
message, releaseCandidates }` untuk penolakan, dengan literal string
`"invalid-total"` dan `"unsatisfiable"` sebagai nilai reason — semuanya
nama/nilai yang hanya author tahu.

Aturan: kalau task menambah **fungsi murni baru** (bukan route/command),
description harus menyebutkan:
- nama module file (path relatif),
- nama fungsi + urutan dan tipe parameter,
- bentuk request object (nama field),
- bentuk response object (nama field + tipe),
- nilai literal string untuk enum/error reason.

### 11b. Alternative patch harus beda STRUKTUR, bukan cuma beda satu fungsi

Reviewer menandai alternative Tripal sebagai "near copy": hanya body
`distributeWithFloor` yang beda (greedy vs largest-remainder), sisanya
byte-identical. Di caldarium, alternative beda storage design
(revoked_at migration + DTO di app.rs) — dan lolos review. Aturan:
alternative harus berbeda minimal di **lokus solusi** (module placement,
struktur tipe, strategi penyimpanan), bukan hanya isi satu fungsi.

### 11c. UI yang dideskripsikan harus punya BLOCKER, bukan cuma rubric non-blocker

Description bilang "pin toggle + fit to launch button" tapi satu-satunya
cek adalah rubric non-blocker berbobot 2. Reviewer: "A maintainer would
refuse a PR that silently drops half of the requested feature, yet such
a change can still pass every blocker." Untuk fitur UI yang eksplisit
diminta, tambahkan hidden test lewat interface yang bisa diuji (render
test, snapshot, minimal grep untuk handler yang wired) — atau jangan
mensyaratkan UI di description kalau tidak bisa diblock.

### 11d. Rubric yang menyebut nama file/parameter MILIK golden = overfitting

Pertanyaan "Judge rebalance.ts" dan parameter "lockedIds" tidak muncul
di description maupun codebase — hanya di golden. Solusi valid yang
menaruh fungsi di module lain atau menamai parameter berbeda akan
dijawab "no" padahal benar. Aturan: kalau description tidak menyebut
nama file/parameter, rubric juga tidak boleh — atau tambahkan nama itu
ke description lebih dulu (lihat 11a).

### Tambahan: pertanyaan rubric yang menggabungkan lebih dari dua hal

Reviewer mencontohkan tiga pertanyaan yang masing-masing menggabungkan:
- pure-and-deterministic = purity + determinism (2 hal, bisa dipisah),
- workspace-exposes = pin toggle + fit button (2 hal),
- tests-cover-the-rules = 4 kasus test dalam satu pertanyaan.

Aturan: satu pertanyaan = satu property; kalau perlu mengecek banyak
hal, pecah jadi pertanyaan terpisah dengan bobot masing-masing.

## 12. Pelajaran dari review kedua milestone-rebalancing

### 12a. Hidden test tidak boleh menegaskan pilihan implementasi author

Dua hidden test menegaskan perilaku yang description tidak nyatakan:
`releaseCandidates[0]` harus pin terberat dulu (solusi valid dengan urutan
input akan gagal), dan `compressForLaunch` untuk launch sebelum kickoff
harus return `"unsatisfiable"` (padahal implementasi natural pass 0 ke
rebalanceMilestones → `"invalid-total"`). Aturan: kalau ada dua cara sah
yang berbeda, jangan test salah satunya — atau tambahkan ke description.

### 12b. Grep blocker untuk UI = weak proxy

`workspace_ui_wired` grep identifier spesifik. Reviewer: "A comment or
unused state variable passes it without any rendered checkbox. A real UI
using other names fails it." Aturan: untuk fitur UI yang tak bisa diuji
lewat interface terprogram, gunakan rubric non-blocker yang bertanya
integrasi secara umum — jangan grep identifier sebagai blocker.

### 12c. Pertanyaan rubric tidak boleh restatement API

Reviewer: "Most questions restate the prompt... negative.patch would get
yes on essentially every question." Aturan: rubric harus **diskriminatif**
— negative patch menjawab "no" (misal: apakah distribution menjamin floor?),
bukan sekadar menanyakan apakah API shape dipatuhi (itu f2p/p2p urusan).

### 12d. Alternative tidak boleh byte-identical di file sampingan

Reviewer: "BriefWorkspace.tsx and estimate.ts byte-for-byte identical...
close to a copy." Aturan: alternative harus berbeda di SEMUA file yang
disentuh — rename identifier di UI, restructure alur di integrasi,
bukan hanya beda di file inti.

## 13. Pelajaran dari review ketiga milestone-rebalancing

Review ini gagal 7 kriteria — campuran pola baru dan kelalaian.

### 13a. Grep blocker kalah oleh file base yang sudah punya pola itu (BARU)

BriefWorkspace.tsx base sudah pakai `Checkbox` dan `<button` untuk
navigasi. Grep untuk `checked=` dan `<button` lolos tanpa UI baru apapun.

Aturan: periksa file base SEBELUM menulis grep blocker. Kalau pola sudah
ada di base, grep tidak berguna. Untuk UI yang tak bisa diuji lewat
interface terprogram: rubric non-blocker berbobot tinggi adalah maximum.

### 13b. Preferensi struktural bukan blocker (KELALAIAN)

`engine-stays-self-contained` adalah preferensi arsitektur — reviewer
minta refactor, bukan refuse merge.

### 13c. Dua pertanyaan cek hal yang sama = duplicate (KELALAIAN)

`engine-stays-self-contained` dan `no-duplicated-feasibility-logic`
beririsan. Satu defect → dua "no".

### 13d. Pertanyaan trivial yang negative pun lulus (BARU)

4 dari 5 pertanyaan adalah "surface check". Negative patch dapat "yes"
di 6/11 poin bobot. Aturan: hitung berapa poin yang negative dapat
"yes" — kalau >50%, rubric tidak diskriminatif.

### 13e. File reference harus cocok dengan pertanyaan (KELALAIAN)

"(Judge rebalance.ts.)" tapi pertanyaannya tentang BriefWorkspace.tsx.

### 13f. Bobot: fitur user > preferensi teknis (BARU)

Pertanyaan struktural (w3) MENGALAHKAN fitur yang diminta user (w2).
Terbalik — user-facing harus lebih berat.

### 13g. Rubric untuk task yang behavior-complete di hidden tests (BARU)

Kalau hidden tests menguji semua perilaku, rubric TIDAK BOLEH
menduplikatinya. Fokus pada yang hanya pembaca bisa nilai:
keterbacaan, kualitas pesan, wiring UI, kualitas integrasi.

## Checklist sebelum submit berikutnya

- [ ] Setiap pertanyaan rubric: satu properti, tanpa "dan", tanpa nama
      file/mekanisme, bisa dijawab yes oleh solusi valid mana pun.
- [ ] Peta frasa deskripsi → kriteria; tidak ada frasa yatim
      (field, peran, format, kata kerja).
- [ ] Yang bisa grep → command criterion, bukan rubric.
- [ ] Scope: klaim ukuran selalu dengan `max_files`/`max_changed_lines`.
- [ ] Kriteria platform di environment ini bisa kosong — pastikan
      requirement guidelines (clippy) punya kriteria sendiri.
- [ ] Skema output yang diperiksa persis ditulis di deskripsi.
- [ ] Untuk task function-level: module path, signature, request/response
      shape, dan literal string reason values semua tertulis di description.
- [ ] Alternative patch beda STRUKTUR (module placement, tipe, storage),
      bukan cuma beda body satu fungsi.
- [ ] Fitur UI yang dideskripsikan punya blocker (hidden test), bukan
      cuma rubric non-blocker.
- [ ] Rubric tidak menyebut nama file/parameter yang hanya ada di golden
- [ ] Hidden test tidak menegaskan pilihan implementasi (urutan
      releaseCandidates, reason string untuk edge case ambigu) tanpa
      menyatakan pilihan itu di description.
- [ ] Blocker UI tidak grep identifier spesifik — gunakan rubric
      non-blocker yang bertanya integrasi umum.
- [ ] Rubric diskriminatif: negative patch menjawab "no" pada minimal
      satu pertanyaan — bukan restatement API shape.
- [ ] Alternative berbeda di SEMUA file yang disentuh
- [ ] Grep blocker: periksa file base sudah punya pola itu — kalau
      ya, grep tidak berguna; gunakan rubric non-blocker berbobot
      tinggi saja.
- [ ] Hitung poin bobot yang negative patch dapat "yes" — kalau >50%,
      tambah pertanyaan diskriminatif atau hapus yang trivial.
- [ ] Bobot: fitur user-facing (UI) > preferensi struktural/arsitektur.
- [ ] File reference rubric HARUS cocok dengan file yang ditanyakan.
- [ ] Kalau hidden tests behavior-complete: rubric fokus keterbacaan,
      pesan, wiring — bukan duplikasi behavior.
- [ ] Dua pertanyaan tidak boleh beririsan (satu defect → satu "no").
 (rename UI
      identifier, restructure integrasi), bukan hanya file inti.

      (kalau perlu, tambahkan nama itu ke description dulu).

