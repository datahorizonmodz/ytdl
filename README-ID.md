# 6767 YT Media Downloader - Vercel Test

Versi ini mempertahankan sistem/API dari project yang sudah berhasil deploy:

`Frontend -> /api/download -> lib/downr.ts -> downr.org -> hasil media`

Yang diubah adalah tampilan, gaya UI, dan fitur frontend agar mengikuti style `yt_6767_scrapper_style_v5_vercel_fixed`.

## Fitur

- Tab Video, Musik, Promosi, History
- Sistem API lama tetap dipakai
- Filter hasil: semua, video, audio, thumbnail, media, link
- Copy JSON response
- Paste, clean URL, clear input
- History lokal via localStorage
- Tampilan dark cyber/6767 style

## Deploy Vercel

Upload semua file ke GitHub, lalu import repo ke Vercel.

Setting:

- Framework: Next.js
- Build command: `npm run build`
- Install command: `npm install`
- Output directory: default/kosong

Kalau project ada di subfolder, set Root Directory ke folder tersebut.
