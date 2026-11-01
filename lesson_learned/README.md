# Lesson Learned — Direktor Aturan

Baca [RULES.md](RULES.md) SEBELUM membuat task (aturan teknis per fase) dan
[PLAN.MD](PLAN.MD) SETIAP KALI akan upload/submit (runbook operasional:
arsip zip, verifikasi lokal, fingerprint, verifikasi task page, protokol
kegagalan).

File lain adalah arsip konteks (untuk memahami MENGAPA aturan itu ada):

| File | Isi |
|---|---|
| [RULES.md](RULES.md) | **← Mulai di sini saat MEMBUAT task. Semua aturan, checklist format.** |
| [PLAN.MD](PLAN.MD) | **← Pakai ini saat SUBMIT. Runbook 6 fase + tabel diagnosis kegagalan.** |
| [platform-workflow.md](platform-workflow.md) | Konteks: siklus platform, base_commit, update kit |
| [grader-commands-rust.md](grader-commands-rust.md) | Konteks: bug #0–#7 (mengapa aturan grader ada) |
| [quality-review.md](quality-review.md) | Konteks: review §1–§13 (mengapa aturan rubric ada) |
| [calibration.md](calibration.md) | Konteks: difficulty bar (mengapa aturan sudut semantik ada) |
| [pipeline-and-process.md](pipeline-and-process.md) | Konteks: tahap pipeline, pola AI-check, komunikasi admin |
| [verification-logs.md](verification-logs.md) | Cara membaca log validasi |
| [task-design.md](task-design.md) | Desain hidden test / alt / neg |
| [local-tooling.md](local-tooling.md) | Jebakan Git Bash / heredoc / git |

## Prinsip

Kalau ada ilmu baru → langsung tambahkan ke RULES.md di fase yang sesuai.
Arsip konteks boleh menambah "mengapa" tapi aturan actionable selalu di RULES.md.
