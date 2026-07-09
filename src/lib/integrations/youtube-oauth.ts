import fs from "fs";
import path from "path";
import { getDataDir } from "@/lib/db/paths";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type TokenStore = {
  accessToken: string;
  expiresAt: number;
  updatedAt: string;
};

function tokenFilePath(): string {
  return path.join(getDataDir(), "youtube-oauth.json");
}

function readStore(): TokenStore | null {
  try {
    const raw = fs.readFileSync(tokenFilePath(), "utf8");
    return JSON.parse(raw) as TokenStore;
  } catch {
    return null;
  }
}

function writeStore(store: TokenStore): void {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenFilePath(), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function isExpired(expiresAt: number): boolean {
  return expiresAt <= Date.now() + EXPIRY_BUFFER_MS;
}

export function youtubeOAuthConfigured(): boolean {
  return Boolean(
    process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim() &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.YOUTUBE_OAUTH_REFRESH_TOKEN?.trim(),
  );
}

let memoryAccessToken: string | null = null;
let memoryExpiresAt = 0;

async function refreshYoutubeAccessToken(): Promise<string | null> {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn(
      "YouTube OAuth refresh skipped: need YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET, YOUTUBE_OAUTH_REFRESH_TOKEN",
    );
    return null;
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("YouTube OAuth token refresh failed:", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    const accessToken = data.access_token?.trim();
    if (!accessToken) return null;

    const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    memoryAccessToken = accessToken;
    memoryExpiresAt = expiresAt;
    writeStore({ accessToken, expiresAt, updatedAt: new Date().toISOString() });
    return accessToken;
  } catch (err) {
    console.warn("YouTube OAuth token refresh error:", err);
    return null;
  }
}

/** Resolves a valid access token, refreshing as needed. Requires YOUTUBE_OAUTH_* env vars. */
export async function getYoutubeAccessToken(): Promise<string | null> {
  if (memoryAccessToken && !isExpired(memoryExpiresAt)) return memoryAccessToken;

  const store = readStore();
  if (store && !isExpired(store.expiresAt)) {
    memoryAccessToken = store.accessToken;
    memoryExpiresAt = store.expiresAt;
    return store.accessToken;
  }

  return refreshYoutubeAccessToken();
}

/** `fetch` with a Bearer YouTube OAuth token; refreshes once on 401 and retries. */
export async function youtubeAuthorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getYoutubeAccessToken();
  if (!token) {
    return new Response(null, { status: 401, statusText: "No YouTube OAuth access token" });
  }

  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${t}` },
  });

  let res = await fetch(url, withAuth(token));

  if (res.status === 401) {
    memoryAccessToken = null;
    const refreshed = await refreshYoutubeAccessToken();
    if (refreshed) res = await fetch(url, withAuth(refreshed));
  }

  return res;
}
