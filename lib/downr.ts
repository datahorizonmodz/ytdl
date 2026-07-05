import axios from "axios";
import http from "http";
import https from "https";

const BASE = "https://downr.org";
const ANALYTICS = `${BASE}/.netlify/functions/analytics`;
const DOWNLOAD = `${BASE}/.netlify/functions/download`;
const NYT = `${BASE}/.netlify/functions/nyt`;

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 60_000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 10, timeout: 60_000 });

const apiClient = axios.create({ httpAgent, httpsAgent });

const userAgents = [
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

type EndpointResult = {
  endpoint: string;
  status: number;
  data: unknown;
};

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 1000 * 60 * 10;

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function normalizeUrl(url: string) {
  return url.trim();
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) cache.delete(key);
  }
}

function parseCookie(setCookie: string[] | string | undefined = []) {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function parseData(data: unknown) {
  if (typeof data !== "string") return data;
  const text = data.trim();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getHeaders(cookie = "") {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9,id;q=0.8",
    "content-type": "application/json",
    cookie,
    origin: BASE,
    referer: `${BASE}/`,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": getRandomUserAgent(),
  };
}

function isOk(status: number, data: unknown) {
  const asObject = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (status < 200 || status >= 300) return false;
  if (data === null || data === undefined || data === "") return false;
  if (typeof data === "string" && ["error", "failed", "user_retry_required"].includes(data.toLowerCase())) return false;
  if (asObject?.error === true) return false;
  if (asObject?.status === false) return false;
  if (asObject?.success === false) return false;
  return true;
}

function getError(data: unknown, status: number) {
  if (typeof data === "string") return data || `HTTP ${status}`;
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    return String(value.message || value.error || value.reason || `HTTP ${status}`);
  }
  return `HTTP ${status}`;
}

async function getCookie(retries = 2) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await apiClient.get(ANALYTICS, {
        timeout: 10_000,
        headers: getHeaders(),
        validateStatus: () => true,
      });
      return parseCookie((res.headers as Record<string, string[] | string | undefined>)["set-cookie"]);
    } catch {
      if (attempt === retries - 1) return "";
    }
  }
  return "";
}

async function postEndpoint(endpoint: string, url: string, cookie = ""): Promise<EndpointResult> {
  try {
    const res = await apiClient.post(
      endpoint,
      { url },
      {
        timeout: 35_000,
        validateStatus: () => true,
        responseType: "text",
        transformResponse: [(value) => value],
        headers: getHeaders(cookie),
      },
    );

    return {
      endpoint,
      status: res.status,
      data: parseData(res.data),
    };
  } catch (error: unknown) {
    const axiosError = error as { response?: { status?: number; data?: unknown }; message?: string };
    return {
      endpoint,
      status: axiosError.response?.status || 500,
      data: axiosError.response?.data || axiosError.message || null,
    };
  }
}

async function tryDownload(url: string) {
  let cookie = await getCookie();
  let result = await postEndpoint(DOWNLOAD, url, cookie);
  if (isOk(result.status, result.data)) return result;

  cookie = await getCookie();
  result = await postEndpoint(DOWNLOAD, url, cookie);
  if (isOk(result.status, result.data)) return result;

  return postEndpoint(NYT, url, cookie);
}

export async function downr(inputUrl: string) {
  const url = normalizeUrl(inputUrl);

  try {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("Invalid URL. Use a full http/https URL.");
    }

    cleanupCache();

    const cached = cache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const pending = pendingRequests.get(url);
    if (pending) return await pending;

    const requestPromise = (async () => {
      const result = await tryDownload(url);
      const ok = isOk(result.status, result.data);

      const output = {
        Status: ok,
        Code: result.status,
        Input: url,
        Endpoint: result.endpoint,
        Result: ok ? result.data : null,
        Error: ok ? null : getError(result.data, result.status),
      };

      if (ok) {
        cache.set(url, {
          data: output,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return output;
    })();

    pendingRequests.set(url, requestPromise);
    const data = await requestPromise;
    pendingRequests.delete(url);
    return data;
  } catch (error) {
    pendingRequests.delete(url);
    return {
      Status: false,
      Code: 500,
      Input: url || null,
      Endpoint: null,
      Result: null,
      Error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
