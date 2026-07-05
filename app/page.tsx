"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileAudio,
  FileVideo,
  History,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Music2,
  Scissors,
  ShieldCheck,
  Sparkles,
  Trash2,
  Youtube,
  Zap,
} from "lucide-react";

type ApiResponse = {
  Status: boolean;
  Code?: number;
  Input?: string | null;
  Endpoint?: string | null;
  Result?: unknown;
  Error?: string | null;
};

type MediaType = "audio" | "video" | "image" | "media" | "link";

type MediaLink = {
  label: string;
  url: string;
  path: string;
  type: MediaType;
  meta: string;
};

type TabKey = "video" | "music" | "promo" | "history";
type FilterKey = "all" | MediaType;
type RequestMode = "video" | "music";

type HistoryItem = {
  url: string;
  mode: RequestMode;
  at: number;
  links: number;
};

const HISTORY_KEY = "yt-6767-downloader-history-v1";

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isYouTubeUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    return ["youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function prettyLabel(raw: string) {
  return raw
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function detectType(path: string, url: string): MediaType {
  const text = `${path} ${url}`.toLowerCase();
  if (/thumbnail|thumb|image|cover|avatar|jpg|jpeg|png|webp/.test(text)) return "image";
  if (/audio|music|sound|song|mp3|m4a|aac|opus/.test(text)) return "audio";
  if (/video|mp4|mov|mkv|quality|resolution|720|1080|1440|2160|webm/.test(text)) return "video";
  if (/download|media|url|link/.test(text)) return "media";
  return "link";
}

function inferMeta(path: string, url: string) {
  const text = `${path} ${url}`;
  const quality = text.match(/(144p|240p|360p|480p|720p|1080p|1440p|2160p|4k|8k)/i)?.[0];
  const extension = url.split("?")[0].match(/\.([a-z0-9]{2,5})$/i)?.[1];
  const format = extension ? extension.toUpperCase() : "URL";
  return quality ? `${format} • ${quality}` : format;
}

function collectLinks(value: unknown, path = "Result"): MediaLink[] {
  const links: MediaLink[] = [];

  if (typeof value === "string" && isHttpUrl(value)) {
    const last = path.split(".").pop() || "Media Link";
    const type = detectType(path, value);
    links.push({
      label: prettyLabel(last) || "Media",
      url: value,
      path,
      type,
      meta: inferMeta(path, value),
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

function cleanYouTubeUrl(value: string) {
  if (!isHttpUrl(value)) return value.trim();

  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://youtu.be/${id}` : value.trim();
    }

    const videoId = parsed.searchParams.get("v");
    const list = parsed.searchParams.get("list");
    const base = `https://www.youtube.com${parsed.pathname === "/shorts" ? parsed.pathname : "/watch"}`;

    if (parsed.pathname.startsWith("/shorts/")) {
      const id = parsed.pathname.split("/").filter(Boolean)[1];
      return id ? `https://www.youtube.com/shorts/${id}` : value.trim();
    }

    if (videoId) {
      const clean = new URL(base);
      clean.searchParams.set("v", videoId);
      if (list) clean.searchParams.set("list", list);
      return clean.toString();
    }

    return value.trim();
  } catch {
    return value.trim();
  }
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function shortUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}`.slice(0, 64);
  } catch {
    return value.slice(0, 64);
  }
}

function TypeIcon({ type }: { type: MediaType }) {
  if (type === "audio") return <FileAudio />;
  if (type === "video") return <FileVideo />;
  if (type === "image") return <ImageIcon />;
  return <LinkIcon />;
}

const promoCards = [
  {
    kind: "website featured",
    title: "Website Landing Page DATZON",
    desc: "Cek landing page utama, project, store, dan pintu masuk layanan DATZON.",
    href: "https://datzon.my.id",
  },
  {
    kind: "whatsapp featured",
    title: "WA DATZON",
    desc: "Join saluran aplikasi MOD, update store, dan info terbaru DATZON.",
    href: "https://whatsapp.com/channel/0029VaLWvFyKWEKjhLtp0H3j",
  },
  {
    kind: "whatsapp",
    title: "WA DANZSHIKII",
    desc: "Channel preset Alight Motion dan bahan edit, biar nggak mulai dari nol terus-terusan.",
    href: "https://whatsapp.com/channel/0029VbBGRHB2phHSTGzF7v2C",
  },
  {
    kind: "tiktok",
    title: "TikTok Datzon",
    desc: "Follow dan support konten DATZON.",
    href: "https://www.tiktok.com/@datzonn?_r=1&_t=ZS-96GmThHXh5z",
  },
  {
    kind: "tiktok",
    title: "TikTok Danzshikii",
    desc: "Follow akun kreator dan update bahan edit.",
    href: "https://www.tiktok.com/@danzshiiki?_r=1&_t=ZS-96GmV4G7fku",
  },
  {
    kind: "store",
    title: "Alight Motion 1.5K",
    desc: "Order premium Alight Motion.",
    href: "https://wa.link/0s10b2",
  },
  {
    kind: "mod",
    title: "Wink Premium 4K",
    desc: "Order premium Wink untuk kebutuhan edit.",
    href: "https://wa.link/czzwuf",
  },
  {
    kind: "store featured",
    title: "Produk Lainnya",
    desc: "Kunjungi store DATZON untuk akun premium, aplikasi, dan item lain.",
    href: "https://datzon.vercel.app/#store",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("video");
  const [videoUrl, setVideoUrl] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState<RequestMode | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [lastMode, setLastMode] = useState<RequestMode>("video");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const links = useMemo(() => collectLinks(response?.Result), [response]);
  const counts = useMemo(
    () => ({
      all: links.length,
      video: links.filter((item) => item.type === "video").length,
      audio: links.filter((item) => item.type === "audio").length,
      image: links.filter((item) => item.type === "image").length,
      media: links.filter((item) => item.type === "media").length,
      link: links.filter((item) => item.type === "link").length,
    }),
    [links],
  );

  const visibleLinks = useMemo(() => {
    if (filter === "all") return links;
    return links.filter((item) => item.type === filter);
  }, [filter, links]);

  const groupedLinks = useMemo(() => {
    const order: MediaType[] = ["video", "audio", "image", "media", "link"];
    return order
      .map((type) => ({ type, items: visibleLinks.filter((item) => item.type === type) }))
      .filter((group) => group.items.length > 0);
  }, [visibleLinks]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored) as HistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
  }

  function saveHistory(item: HistoryItem) {
    setHistory((current) => {
      const next = [item, ...current.filter((saved) => saved.url !== item.url)].slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function pasteTo(mode: RequestMode) {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast("error", "Clipboard kosong.");
        return;
      }
      if (mode === "video") setVideoUrl(text.trim());
      else setMusicUrl(text.trim());
      showToast("success", "Link ditempel.");
    } catch {
      showToast("error", "Browser nggak kasih akses clipboard.");
    }
  }

  function cleanInput(mode: RequestMode) {
    if (mode === "video") setVideoUrl((value) => cleanYouTubeUrl(value));
    else setMusicUrl((value) => cleanYouTubeUrl(value));
    showToast("success", "URL dibersihkan.");
  }

  function clearInput(mode: RequestMode) {
    if (mode === "video") setVideoUrl("");
    else setMusicUrl("");
    setResponse(null);
    setFilter("all");
  }

  async function processUrl(input: string, mode: RequestMode) {
    const trimmed = input.trim();
    setCopied(false);
    setResponse(null);
    setFilter(mode === "music" ? "audio" : "all");
    setLastMode(mode);

    if (!trimmed) {
      const message = mode === "music" ? "Tempel link YouTube buat musik dulu." : "Tempel link YouTube buat video dulu.";
      setResponse({ Status: false, Error: message });
      showToast("error", message);
      return;
    }

    if (!isHttpUrl(trimmed)) {
      const message = "Link tidak valid. Pakai URL lengkap, contoh: https://youtu.be/...";
      setResponse({ Status: false, Error: message });
      showToast("error", message);
      return;
    }

    if (!isYouTubeUrl(trimmed)) {
      showToast("error", "Ini dibuat khusus YouTube, bukan segala isi internet.");
      setResponse({ Status: false, Error: "Masukkan link YouTube, YouTube Music, atau youtu.be." });
      return;
    }

    setLoading(mode);

    try {
      const cleaned = cleanYouTubeUrl(trimmed);
      if (mode === "video") setVideoUrl(cleaned);
      else setMusicUrl(cleaned);

      const request = await fetch(`/api/download?url=${encodeURIComponent(cleaned)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await request.json()) as ApiResponse;
      setResponse(data);

      const foundLinks = collectLinks(data.Result);
      if (data.Status) {
        saveHistory({ url: cleaned, mode, at: Date.now(), links: foundLinks.length });
        showToast("success", `${foundLinks.length} link ditemukan.`);
      } else {
        showToast("error", data.Error || "API gagal memproses link.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request gagal. Servernya lagi cosplay batu.";
      setResponse({ Status: false, Error: message });
      showToast("error", message);
    } finally {
      setLoading(null);
    }
  }

  function submitVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void processUrl(videoUrl, "video");
  }

  function submitMusic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void processUrl(musicUrl, "music");
  }

  async function copyPayload() {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      setCopied(true);
      showToast("success", "JSON disalin.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("error", "Gagal copy JSON.");
    }
  }

  function useHistoryItem(item: HistoryItem) {
    if (item.mode === "video") {
      setVideoUrl(item.url);
      setActiveTab("video");
    } else {
      setMusicUrl(item.url);
      setActiveTab("music");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
    showToast("success", "History dibersihkan.");
  }

  function renderResultBox(mode: RequestMode) {
    const musicModeWithoutAudio = mode === "music" && response?.Status && counts.audio === 0 && links.length > 0;

    return (
      <div className="panel result-panel" id={`${mode}ResultBox`}>
        <div className="section-head compact">
          <div>
            <h2 className="section-title">
              <span className="tool-icon">{response?.Status ? <CheckCircle2 /> : <Sparkles />}</span>
              Hasil Extract
            </h2>
            <p className="section-desc">
              {response
                ? response.Status
                  ? `${links.length} link ditemukan dari sistem API yang sudah berhasil tadi.`
                  : response.Error || "Gagal memproses link."
                : "Hasil akan muncul di sini setelah link diproses."}
            </p>
          </div>
          {response ? (
            <button className="btn btn-ghost" type="button" onClick={copyPayload}>
              <Copy />
              {copied ? "Copied" : "Copy JSON"}
            </button>
          ) : null}
        </div>

        {!response ? (
          <div className="empty-state">
            <Youtube />
            <strong>Belum ada hasil.</strong>
            <span>Tempel link YouTube lalu proses. Teknologi memang butuh dipancing dulu.</span>
          </div>
        ) : response.Status ? (
          <>
            <div className="success-card">
              <CheckCircle2 />
              <div>
                <strong>Extraction Complete</strong>
                <span>{links.length} link berhasil ditemukan.</span>
              </div>
            </div>

            {musicModeWithoutAudio ? (
              <div className="yt-help warn">
                API berhasil, tapi belum ngasih audio terpisah. Link lain tetap ditampilkan biar nggak mubazir, karena membuang link hasil API itu dosa kecil versi developer.
              </div>
            ) : null}

            <div className="filter-row" aria-label="Filter hasil">
              {([
                ["all", `Semua ${counts.all}`],
                ["video", `Video ${counts.video}`],
                ["audio", `Audio ${counts.audio}`],
                ["image", `Thumbnail ${counts.image}`],
                ["media", `Media ${counts.media}`],
                ["link", `Link ${counts.link}`],
              ] as [FilterKey, string][]).map(([key, label]) => (
                <button
                  className={`filter-btn ${filter === key ? "active" : ""}`}
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  disabled={key !== "all" && counts[key] === 0}
                >
                  {label}
                </button>
              ))}
            </div>

            {groupedLinks.length > 0 ? (
              <div className="format-grid">
                {groupedLinks.map((group) => (
                  <section className="format-section" key={group.type}>
                    <div className="format-head">
                      <span className="media-icon"><TypeIcon type={group.type} /></span>
                      <div>
                        <strong>{prettyLabel(group.type)}</strong>
                        <span>{group.items.length} item</span>
                      </div>
                    </div>
                    <div className="media-list">
                      {group.items.map((item, index) => (
                        <article className="media-row" key={`${item.url}-${index}`}>
                          <div className="media-row-top">
                            <span className="media-icon small"><TypeIcon type={item.type} /></span>
                            <div className="media-meta">
                              <strong>{item.label || `Media ${index + 1}`}</strong>
                              <span>{item.meta} • {item.path}</span>
                            </div>
                          </div>

                          {item.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="thumb-preview" src={item.url} alt="Preview thumbnail" loading="lazy" />
                          ) : null}

                          <div className="result-actions">
                            <a className="btn btn-primary" href={item.url} target="_blank" rel="noopener noreferrer">
                              <Download />
                              Buka / Download
                            </a>
                            <a className="btn btn-ghost" href={item.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink />
                              Open Link
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="empty-state">Filter ini kosong. API-nya pelit format, bukan tombolnya yang malas.</div>
            )}
          </>
        ) : (
          <div className="error-card">
            <AlertCircle />
            <div>
              <strong>Extraction Failed</strong>
              <span>{response.Error || "Gagal memproses link."}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="app-shell">
      <div id="toast-container" aria-live="polite">
        <div className={`toast ${toast?.type || ""} ${toast ? "show" : ""}`}>
          {toast?.type === "success" ? <CheckCircle2 /> : <AlertCircle />}
          <span>{toast?.text || ""}</span>
        </div>
      </div>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Youtube /></span>
          <div>
            <h1 className="brand-title">6767 YT</h1>
            <p className="brand-sub">Video • Music • Thumbnail • History</p>
          </div>
        </div>
        <div className="top-badges">
          <span className="badge"><Zap /> API LIVE</span>
          <span className="badge"><ShieldCheck /> VERCEL READY</span>
          <span className="badge"><Scissors /> EDITOR MODE</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-card">
          <span className="hero-kicker"><Sparkles /> DOWNR SYSTEM DIPERTAHANKAN</span>
          <h2 className="hero-title">YouTube <span>Media</span> Tools</h2>
          <p className="hero-desc">
            Tampilan ala 6767 Scrapper, tapi mesin download tetap sistem yang sudah berhasil di Vercel. Jadi bajunya cyber, mesinnya tidak diganti. Jarang-jarang manusia meminta hal masuk akal.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" type="button" onClick={() => setActiveTab("video")}>
              <FileVideo /> Video Downloader
            </button>
            <button className="btn btn-green" type="button" onClick={() => setActiveTab("music")}>
              <Music2 /> Music Extractor
            </button>
          </div>
        </div>

        <aside className="hero-card mini-dashboard">
          <h2 className="mini-title"><span className="tool-icon"><ShieldCheck /></span> Status Panel</h2>
          <div className="mini-stats">
            <div className="mini-stat"><strong>{counts.all}</strong><span>Link Aktif</span></div>
            <div className="mini-stat"><strong>{history.length}</strong><span>History</span></div>
            <div className="mini-stat"><strong>{response?.Status ? "OK" : "IDLE"}</strong><span>API State</span></div>
            <div className="mini-stat"><strong>{lastMode.toUpperCase()}</strong><span>Mode</span></div>
          </div>
          <div className="tips-card">
            UI ini dibuat ringan: no blur lebay, tombol rapi, history lokal, filter format, dan hasil JSON tetap bisa dicek. Kalau API luar mogok, minimal tampilannya tetap punya harga diri.
          </div>
        </aside>
      </section>

      <nav className="tabs" aria-label="Menu utama">
        {([
          ["video", "Video"],
          ["music", "Musik"],
          ["promo", "Promosi"],
          ["history", "History"],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`tab-btn ${activeTab === key ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeTab === "video" ? (
        <section className="tab-panel">
          <div className="yt-layout">
            <form className="panel" onSubmit={submitVideo}>
              <div className="section-head">
                <div>
                  <h2 className="section-title"><span className="tool-icon"><FileVideo /></span> Video Downloader</h2>
                  <p className="section-desc">Tempel link YouTube, Shorts, atau youtu.be. Sistem API tetap sama seperti versi yang sudah deploy.</p>
                </div>
              </div>

              <label className="input-box">
                <LinkIcon />
                <input
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="Tempel link YouTube video di sini..."
                  autoComplete="off"
                  inputMode="url"
                />
              </label>

              <div className="inline-tools">
                <button className="btn btn-ghost" type="button" onClick={() => pasteTo("video")}><Clipboard /> Paste</button>
                <button className="btn btn-ghost" type="button" onClick={() => cleanInput("video")}><Scissors /> Clean URL</button>
                <button className="btn btn-danger" type="button" onClick={() => clearInput("video")}><Trash2 /> Clear</button>
              </div>

              <button className="btn btn-primary btn-full" type="submit" disabled={loading !== null}>
                {loading === "video" ? <Loader2 className="spin" /> : <Zap />}
                {loading === "video" ? "Memproses..." : "Proses Video"}
              </button>
              <p className="compact-note">Pakai untuk konten yang memang boleh lu gunakan: no copyright, Creative Commons, atau karya sendiri. Hukum hak cipta itu membosankan, tapi tetap bisa menggigit.</p>
            </form>
            {renderResultBox("video")}
          </div>
        </section>
      ) : null}

      {activeTab === "music" ? (
        <section className="tab-panel">
          <div className="yt-layout">
            <form className="panel" onSubmit={submitMusic}>
              <div className="section-head">
                <div>
                  <h2 className="section-title"><span className="tool-icon"><Music2 /></span> Music Extractor</h2>
                  <p className="section-desc">Khusus ambil audio/musik dari link YouTube jika API menyediakan formatnya.</p>
                </div>
              </div>

              <label className="input-box">
                <LinkIcon />
                <input
                  value={musicUrl}
                  onChange={(event) => setMusicUrl(event.target.value)}
                  placeholder="Tempel link YouTube untuk ambil musik..."
                  autoComplete="off"
                  inputMode="url"
                />
              </label>

              <div className="inline-tools music-tools">
                <button className="btn btn-ghost wide-tool" type="button" onClick={() => setMusicUrl(videoUrl)}><FileVideo /> Ambil dari Video</button>
                <button className="btn btn-ghost" type="button" onClick={() => pasteTo("music")}><Clipboard /> Paste</button>
                <button className="btn btn-ghost" type="button" onClick={() => cleanInput("music")}><Scissors /> Clean URL</button>
                <button className="btn btn-danger" type="button" onClick={() => clearInput("music")}><Trash2 /> Clear</button>
              </div>

              <button className="btn btn-primary btn-full" type="submit" disabled={loading !== null}>
                {loading === "music" ? <Loader2 className="spin" /> : <Music2 />}
                {loading === "music" ? "Memproses..." : "Proses Musik"}
              </button>
              <p className="compact-note">Kalau API cuma ngasih video tanpa audio terpisah, halaman ini bakal bilang jujur. Tidak seperti judul clickbait.</p>
            </form>
            {renderResultBox("music")}
          </div>
        </section>
      ) : null}

      {activeTab === "promo" ? (
        <section className="tab-panel">
          <div className="panel">
            <div className="section-head">
              <div>
                <h2 className="section-title"><span className="tool-icon"><Sparkles /></span> Promosi</h2>
                <p className="section-desc">Bagian promo dipisah biar rapi, bukan ditumpuk di bawah hasil download seperti lemari kabel bekas.</p>
              </div>
            </div>
            <div className="promo-grid">
              {promoCards.map((card) => (
                <a className={`promo-card ${card.kind}`} href={card.href} target="_blank" rel="noopener noreferrer" key={card.title}>
                  <span className="promo-icon"><ExternalLink /></span>
                  <span>
                    <strong className="promo-title">{card.title}</strong>
                    <span className="promo-desc">{card.desc}</span>
                  </span>
                  <span className="promo-open"><ExternalLink /></span>
                </a>
              ))}
            </div>
            <div className="promo-note">Promosi tetap dipisah seperti style ZIP referensi. Lebih rapi, lebih gampang diklik, dan tidak berubah jadi pasar malam CSS.</div>
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="tab-panel">
          <div className="panel">
            <div className="section-head">
              <div>
                <h2 className="section-title"><span className="tool-icon"><History /></span> History</h2>
                <p className="section-desc">Riwayat tersimpan di browser HP lu. Bukan database, bukan mata-mata, cuma localStorage biasa.</p>
              </div>
              {history.length > 0 ? (
                <button className="btn btn-danger" type="button" onClick={clearHistory}><Trash2 /> Clear History</button>
              ) : null}
            </div>

            {history.length === 0 ? (
              <div className="empty-state"><History /><strong>History kosong.</strong><span>Proses satu link dulu, nanti muncul di sini.</span></div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <article className="history-card" key={`${item.url}-${item.at}`}>
                    <div>
                      <h4>{item.mode === "video" ? "Video Downloader" : "Music Extractor"}</h4>
                      <p className="history-text">{shortUrl(item.url)}</p>
                      <p>{formatTime(item.at)} • {item.links} link</p>
                    </div>
                    <div className="history-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => useHistoryItem(item)}>Pakai Lagi</button>
                      <button className="btn btn-primary" type="button" onClick={() => void processUrl(item.url, item.mode)}>Proses Ulang</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <p className="footer-note">6767 STYLE UI • DOWNR SYSTEM CORE • DATZON TEST BUILD</p>
    </main>
  );
}
