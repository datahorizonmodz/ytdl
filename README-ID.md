# YT Media Test Downloader

Ini project testing berbasis source code yang kamu kirim. Website ini memakai Next.js App Router dan API route internal:

```txt
Frontend → /api/download → lib/downr.ts → downr.org API → hasil link media
```

## Cara deploy ke Vercel dari HP

1. Ekstrak ZIP ini.
2. Upload isi folder `youtube-media-downloader-test` ke GitHub repository.
3. Di Vercel, pilih **New Project**.
4. Import repository GitHub tersebut.
5. Framework harus terdeteksi sebagai **Next.js**.
6. Klik **Deploy**.

## File penting

- `app/page.tsx` = tampilan website testing.
- `app/api/download/route.ts` = API backend internal untuk proses link.
- `lib/downr.ts` = logic request ke `downr.org`.
- `public/manifest.json` = konfigurasi PWA.

## Catatan

- Jangan upload ZIP mentah ke GitHub. Upload isi folder project-nya.
- Website ini bergantung ke `downr.org`. Kalau API itu error, website ini ikut gagal.
- Gunakan untuk konten yang memang boleh kamu pakai, seperti video sendiri, Creative Commons, public domain, atau no copyright.
