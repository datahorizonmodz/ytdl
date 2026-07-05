"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  FileVideo,
  Github,
  Link as LinkIcon,
  Loader2,
  Music2,
  ShieldCheck,
  Youtube,
} from "lucide-react";

type ApiResponse = {
  Status: boolean;
  Code?: number;
  Input?: string;
  Endpoint?: string;
  Result?: unknown;
  Error?: string | null;
};

type MediaLink = {
  label: string;
  url: string;
  path: string;
  type: "audio" | "video" | "image" | "media" | "link";
};

function isUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function prettyLabel(raw: string) {
  return raw
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function detectType(path: string, url: string): MediaLink["type"] {
  const text = `${path} ${url}`.toLowerCase();
  if (/audio|music|mp3|m4a|aac|opus|webm/.test(text)) return "audio";
  if (/video|mp4|mov|mkv|quality|resolution|720|1080|1440|2160/.test(text)) return "video";
  if (/thumbnail|image|jpg|jpeg|png|webp/.test(text)) return "image";
  if (/download|media|url|link/.test(text)) return "media";
  return "link";
}

function collectLinks(value: unknown, path = "Result"): MediaLink[] {
  const links: MediaLink[] = [];

  if (isUrl(value)) {
    const last = path.split(".").pop() || "Media Link";
    links.push({
      label: prettyLabel(last),
      url: value,
      path,
      type: detectType(path, value),
    });
    return links;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      links.push(...collectLinks(item, `${path}.${index + 1}`));
    });
    return links;
  }

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      links.push(...collectLinks(item, `${path}.${key}`));
    });
  }

  const seen = new Set<string>();
  return links.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function isYouTubeUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace("www.", "").toLowerCase();
    return ["youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function TypeIcon({ type }: { type: MediaLink["type"] }) {
  if (type === "audio") return <FileAudio className="h-5 w-5" />;
  if (type === "video") return <FileVideo className="h-5 w-5" />;
  return <LinkIcon className="h-5 w-5" />;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const links = useMemo(() => collectLinks(response?.Result), [response]);
  const audioLinks = links.filter((item) => item.type === "audio");
  const videoLinks = links.filter((item) => item.type === "video");
  const otherLinks = links.filter((item) => item.type !== "audio" && item.type !== "video");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopied(false);
    setResponse(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setResponse({ Status: false, Error: "Masukkan link YouTube dulu." });
      return;
    }

    if (!isUrl(trimmed)) {
      setResponse({ Status: false, Error: "Link tidak valid. Pakai URL lengkap, contoh: https://youtu.be/..." });
      return;
    }

    setLoading(true);

    try {
      const request = await fetch(`/api/download?url=${encodeURIComponent(trimmed)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await request.json()) as ApiResponse;
      setResponse(data);
    } catch (error) {
      setResponse({
        Status: false,
        Error: error instanceof Error ? error.message : "Request gagal. Servernya mungkin lagi drama.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copyPayload() {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function renderLinkGroup(title: string, items: MediaLink[], icon: "video" | "audio" | "other") {
    if (items.length === 0) return null;

    const Icon = icon === "video" ? FileVideo : icon === "audio" ? Music2 : LinkIcon;

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-100 text-orange-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-950">{title}</h3>
            <p className="text-sm text-slate-500">{items.length} link ditemukan</p>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map((item, index) => (
            <article key={`${item.url}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <TypeIcon type={item.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{item.label || `Media ${index + 1}`}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{item.path}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                    >
                      <Download className="h-4 w-4" />
                      Buka / Download
                    </a>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Link
                    </a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-orange-400 shadow-lg shadow-slate-300">
              <Youtube className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-black leading-tight">YT Media Test</p>
              <p className="text-xs text-slate-500">Video & musik downloader pribadi</p>
            </div>
          </div>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 sm:flex"
          >
            <Github className="h-4 w-4" />
            GitHub Ready
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
            <ShieldCheck className="h-4 w-4" />
            Testing build, berbasis source Downr API
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            YouTube Video & Music Downloader
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Tempel link YouTube, lalu website ini akan memanggil API server-side di <b>/api/download</b>.
            Pakai buat konten sendiri, Creative Commons, atau no copyright. Bukan buat jadi bajak laut digital, sudah cukup dunia ini penuh pop-up iklan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto mt-9 max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200 sm:p-6">
          <label htmlFor="url" className="mb-2 block text-sm font-bold text-slate-700">
            Link YouTube
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              id="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://youtu.be/xxxx atau https://www.youtube.com/watch?v=xxxx"
              className="h-14 rounded-2xl border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 text-base font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {loading ? "Processing" : "Extract Media"}
            </button>
          </div>
          {url.trim() && isUrl(url.trim()) && !isYouTubeUrl(url.trim()) ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <AlertCircle className="h-4 w-4" />
              Link ini bukan link YouTube. API mungkin tetap coba proses, tapi fokus test ini YouTube.
            </p>
          ) : null}
        </form>

        {response ? (
          <section className="mx-auto mt-8 max-w-5xl">
            <div className={`rounded-[2rem] border p-5 shadow-xl sm:p-6 ${response.Status ? "border-emerald-200 bg-emerald-50 shadow-emerald-100" : "border-red-200 bg-red-50 shadow-red-100"}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white ${response.Status ? "bg-emerald-600" : "bg-red-600"}`}>
                    {response.Status ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">
                      {response.Status ? "Extraction Complete" : "Extraction Failed"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {response.Status
                        ? `${links.length} link berhasil ditemukan dari response API.`
                        : response.Error || "API gagal balikin hasil. Ya, server pihak ketiga kadang memang suka hidup setengah niat."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={copyPayload}
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied" : "Copy JSON"}
                </button>
              </div>
            </div>

            {response.Status && links.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                API sukses, tapi website belum menemukan link media di payload. Buka bagian JSON mentah di bawah buat cek struktur response-nya.
              </div>
            ) : null}

            <div className="mt-5 grid gap-5">
              {renderLinkGroup("Video", videoLinks, "video")}
              {renderLinkGroup("Audio / Music", audioLinks, "audio")}
              {renderLinkGroup("Link Lain dari Payload", otherLinks, "other")}
            </div>

            <details className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-slate-100 shadow-xl">
              <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-white">
                View Technical Payload
              </summary>
              <pre className="max-h-[520px] overflow-auto border-t border-slate-800 p-5 text-xs leading-6 text-slate-200">
                {JSON.stringify(response, null, 2)}
              </pre>
            </details>
          </section>
        ) : null}

        <section className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          {[
            ["1", "Paste link", "Masukkan link YouTube yang mau dites."],
            ["2", "Extract", "Frontend memanggil API route server-side."],
            ["3", "Open result", "Klik link hasil untuk buka/download media."],
          ].map(([num, title, desc]) => (
            <div key={num} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 font-black text-white">{num}</div>
              <h3 className="font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
