# Calibration I: task tidak boleh terlalu mudah untuk solver otomatis

Pesan platform: "The task was solved in 3 of 3 automated attempts, too
often to meet the difficulty bar. Increase the scope or complexity of the
required change and resubmit."

## Yang dipelajari

1. **Ada difficulty bar nyata.** Setelah reference verification hijau,
   platform menjalankan solver otomatis terhadap task. Kalau 3 dari 3
   berhasil, task terlalu mudah dan ditolak. Task CRUD satu permukaan
   (listing + satu operasi baru di 4 layer) ternyata terlalu mudah untuk
   model sekarang.

2. **Cara menaikkan kesulitan yang benar**: tambah **sudut semantik**
   yang harus dipikirkan, bukan sekadar menambah baris:
   - paginasi berkursor (kestabilan urutan, tidak boleh ada duplikat
     antar halaman, kursor opaque),
   - operasi batch transaksional (all-or-nothing lintas baris),
   - rotasi kunci (dua tulisan dalam satu langkah, kunci baru
     dikembalikan satu kali, label turunan, tolak rotasi yang sudah
     dipensiunkan).
   Ketiganya punya kegagalan halus yang khas (kursor mengulang entri,
   batch setengah jalan, kunci baru bocor di listing) — persis jenis
   kesalahan yang membedakan solusi teliti dari solusi asal jadi.

3. **Setiap sudut baru tetap tunduk pada semua lesson sebelumnya**:
   kontraknya didokumentasikan di deskripsi (skema envelope, param, aturan
   batch/rotasi), hidden test tetap hanya lewat route/binary, alternative
   tetap beda desain (storage revoked_at + kursor id-tunggal + batch
   per-baris), negative gagal tepat di atomisitas batch (24/25 lulus —
   tetap "plausible").

4. **Ukuran mengikuti**: golden 624 → 1214 baris tambahan; deskripsi
   170 → 257 kata (rasio ~4.7, aman). f2p 14 → 25 test — sekalian
   menghilangkan warning "aim for 20+".

5. Log kalibrasi yang diekspor pengguna hanya berisi bagian
   reference-verification; patch percobaan solver tidak disertakan —
   pesan ringkasan platform saja sudah cukup untuk diagnosis.

## Checklist tambahan sebelum submit task berikutnya

- [ ] Tanyakan pada diri sendiri: bagian mana dari task ini yang akan
      gagal oleh solusi yang "hampir benar"? Kalau tidak ada sudut
      semantik halus (kursor/atomisitas/sekali-tampil/status transisi),
      task mungkin terlalu mudah untuk calibration I.
- [ ] Ide task dengan satu operasi CRUD tunggal: gabungkan dengan sudut
      pendukung (paginasi/batch/rotasi) menjadi satu cerita ops yang
      koheren, jangan biarkan berdiri sendiri.
