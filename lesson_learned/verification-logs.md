# Membaca log reference verification (forensik)

Folder log yang diberikan platform (mis. `logs/task-2-hold-expiry`) adalah
sumber diagnosis terbaik — asal tahu di mana melihat.

## Peta folder

| Lokasi | Isi |
|---|---|
| `oracle/` | Run golden (reference solution), 2 trial |
| `nop/` | Run no-change (baseline), 2 trial |
| `negative/`, `alternative/` | Run kalibrasi masing-masing |
| `legacy-baseline/check_*.log` | Output per-check platform di tree base |
| `*-console.log` | Tabel ringkasan metrik per job |
| `<run>/task-*/exception.txt` | Traceback Python saat trial gagal |
| `<run>/task-*/trial.log` | Kronologi trial (patch, collect hook) |
| `<run>/task-*/config.json` | Env verifier (judge, dsb.) |

## Temuan penting dari kasus nyata

1. **`exception.txt` adalah tempat pertama dibuka.** Kasus: `RewardFileNotFoundError` — verifier selesai tapi tanpa file reward.

2. **Hook `pre_artifacts` di trial.log membocorkan base commit 40 karakter** yang tidak pernah tampil penuh di UI — berguna saat grader.yaml butuh nilai persis itu.

3. **Tabel `Reward │ Count` di console.log adalah sidik jari versi grader.** Angka-angka di situ (jumlah id f2p, jumlah id p2p) menunjukkan daftar mana yang benar-benar jalan. Kasus nyata: log menunjukkan `132` untuk p2p padahal zip terbaru memuat 84 → terbukti verifikasi berjalan dengan **upload-an lama**, bukan zip yang baru di-pack. Kesimpulan praktis: setelah upload, buka grader.yaml di task page dan cocokkan sidik jarinya (jumlah id, env var, timeout) sebelum submit.

4. **Pesan ringkasan UI ≠ kegagalan sebenarnya.** "2 of 2 reference-solution runs produced no result" terlihat seperti misteri infra, tapi metrik + config di log menunjukkan pola yang bisa dijelaskan (lihat Bug #4 di grader-commands-rust.md).

## Protokol diagnosis ulang

1. Buka `exception.txt` dari trial yang gagal.
2. Bandingkan metrik console.log antar jenis run (oracle/nop/negative) —
   perbedaan pola menunjukkan fase mana yang berbeda.
3. Cocokkan sidik jari grader (jumlah id test, isi perintah) dengan zip
   yang dikira ter-upload.
4. Baru berteori tentang kode; log dulu, teori kemudian.
