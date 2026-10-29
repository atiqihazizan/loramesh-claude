# Arahan untuk Claude Code — loramesh v1

## WAJIB: fail handoff kecemasan
Setiap kali sesi melakukan kerja bermakna (debug, ubah kod, deploy, ubah server/config),
**kemas kini `docs/HANDOFF.md`** sebelum tamat sesi dan sebelum setiap deploy/push.
Tujuannya: jika PC diformat / sesi hilang / disambung di PC lain, Claude baharu boleh
sambung tanpa memori sebelumnya.

`docs/HANDOFF.md` mesti lengkap dan berdiri sendiri, mengandungi:
1. Matlamat & konteks projek (satu perenggan).
2. Persekitaran: path, host, user SSH, servis, port, commit semasa di server vs repo.
3. Apa yang SUDAH disahkan (dengan bukti ringkas) — supaya tak diulang.
4. Apa yang diubah: fail, sebab, commit hash.
5. Apa yang dideploy ke server: tarikh, langkah tepat, lokasi backup, **cara rollback**.
6. Yang BELUM selesai / BELUM disahkan + langkah seterusnya yang tepat.
7. Hipotesis & risiko terbuka.
8. Cara sahkan (arahan sebenar).
9. Fail/artifak sementara yang wujud dan perlu dibersihkan.

Peraturan:
- JANGAN tulis rahsia (JWT_SECRET, password, token, kandungan .env). Rujuk nama pembolehubah sahaja.
- Jangan reka API/fungsi; tandakan "belum disahkan" jika tak pasti.
- Commit fail ini ke git bersama perubahan kod (push hanya bila pengguna benarkan).
- Bahasa: Bahasa Melayu, ringkas, pointer.

## Peraturan kerja (daripada pengguna)
- Server: baca-sahaja dahulu. Ubah .env server, restart servis, git push, deploy → minta satu pengesahan ringkas.
- Jangan cetak rahsia .env.
- Sentiasa sediakan jalan undo (backup + commit lama) sebelum deploy.
