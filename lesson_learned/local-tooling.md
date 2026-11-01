# Tooling lokal (Windows + Git Bash + Rust) — jebakan dan solusinya

## Heredoc merusak backslash

Pada Bash tool di Windows, heredoc `<<'EOF'` yang seharusnya literal
ternyata tetap menggandakan/memangkas backslash: `\\n` dalam script
python tiba di interpreter sebagai newline sungguhan, `\\\\` menjadi
`\\`. Dua kali membuat grader.yaml rusak karena ini.

Solusi: tulis script python sebagai **file** dengan tool Write, lalu
jalankan `python file.py`. Jangan menyusun string ber-escape lewat
heredoc.

## `printf` dan argumen berawalan `--`

`printf '-- komentar\n' ...` dianggap opsi → error. Gunakan
`printf '%s\n' '-- komentar'` atau rangkaian `echo`.

## Quoting path Windows

- `cp /tmp/x "D:\..."` bisa gagal aneh ("is not a directory") —
  gunakan path POSIX `/d/project/...` untuk tool Git Bash.
- Python (native Windows) tidak mengenal `/tmp` milik Git Bash —
  salin dulu ke path proyek, atau pakai path absolut Windows.
- `mv` folder yang berisi **cwd aktif** shell → "Device or resource
  busy". Pindahkan cwd sebelum rename, atau biarkan namanya.
- Path dengan spasi/kutip ganda di akhir perintah bisa memutus
  parsing — akhiri perintah dengan `&& ls` atau kutip penuh.

## Git untuk snapshot ZIP

- `git init` + commit awal pada snapshot = base lokal yang bisa
  dipakai `maintkit check --repo` untuk membuktikan ketiga patch
  apply bersih (applicability), meski verify penuh tak tersedia.
- `git config core.autocrlf false` sebelum commit agar file tetap
  LF — patch dihasilkan dan diterapkan dengan ending yang sama.
- Bekerja per-patch di **branch** (`golden`, `alternative`,
  `negative`) dari commit base; hasil patch = `git diff master <branch>`.
- `git stash` menyimpan pekerjaan setengah jadi dengan aman saat
  perlu pindah branch mendadak (reproduksi bug, dsb.).

## Rust lokal

- `rust-toolchain.toml` mem-pin 1.92.0 — rustup otomatis mengunduhnya
  saat `cargo` pertama dijalankan; pastikan itu selesai sebelum
  mengandalkan build.
- Instal `cargo-nextest --locked --version 0.9.143` (samakan dengan
  image environment) di background dari awal — kompilasinya lama.
- Rangkaian cepat sebelum commit patch: `cargo fmt --all`,
  `cargo clippy --workspace --all-targets`,
  `cargo test --workspace` (atau nextest dengan profile JUnit).

## Cache target dir bersama bisa rusak (lokal saja)

 yang dipakai berulang lintas perintah verifikasi bisa
menghasilkan error  pada libsqlite3-sys —
sisa build yang terputus. Bukan masalah grader (platform selalu container
segar). Cukup  folder target dan ulangi; kalau verifikasi lokal
tiba-tiba gagal di dependensi, curigai cache dulu sebelum kode.

## Cache target dir bersama bisa rusak (lokal saja)

/tmp/cargotarget yang dipakai berulang lintas perintah verifikasi bisa
menghasilkan error "couldn't read .../bindgen.rs" pada libsqlite3-sys,
sisa build yang terputus. Bukan masalah grader (platform selalu container
segar). Cukup hapus folder target dan ulangi; kalau verifikasi lokal
tiba-tiba gagal di dependensi, curigai cache dulu sebelum kode.

## Disiplin umum

- Setelah setiap eksperimen yang menyalin file test ke workspace,
  bersihkan dan pastikan `git status --short` kosong — rantai `&&`
  yang terputus di tengah (exit code != 0) menyisakan file.
- Simpan artefak sementara (id list JUnit, script generator) di luar
  folder task sebelum `maintkit pack` — pack memasukkan semua file
  yang ada di folder task.
