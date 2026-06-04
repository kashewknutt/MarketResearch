import fs from "fs";
import path from "path";
import { getDataDir } from "@/lib/db/paths";

const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type TokenStore = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  updatedAt: string;
};

function tokenFilePath(): string {
  return path.join(getDataDir(), "linkedin-oauth.json");
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

function refreshTokenFromEnvOrStore(store: TokenStore | null): string | undefined {
  return (
    process.env.LINKEDIN_REFRESH_TOKEN?.trim() ||
    store?.refreshToken?.trim() ||
    undefined
  );
}

function canRefresh(store: TokenStore | null = readStore()): boolean {
  return Boolean(
    process.env.LINKEDIN_CLIENT_ID?.trim() &&
      process.env.LINKEDIN_CLIENT_SECRET?.trim() &&
      refreshTokenFromEnvOrStore(store),
  );
}

let memoryAccessToken: string | null = null;

function isExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return expiresAt <= Date.now() + EXPIRY_BUFFER_MS;
}

function applyTokensToProcessEnv(accessToken: string, refreshToken?: string): void {
  process.env.LINKEDIN_ACCESS_TOKEN = accessToken;
  if (refreshToken) process.env.LINKEDIN_REFRESH_TOKEN = refreshToken;
}

/** Exchange refresh token for a new access token (LinkedIn OAuth 2.0). */
export async function refreshLinkedInAccessToken(): Promise<string | null> {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const store = readStore();
  const refreshToken = refreshTokenFromEnvOrStore(store);

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn(
      "LinkedIn refresh skipped: need LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REFRESH_TOKEN",
    );
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("LinkedIn token refresh failed:", res.status, text.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    const accessToken = data.access_token?.trim();
    if (!accessToken) return null;

    const expiresAt =
      typeof data.expires_in === "number"
        ? Date.now() + data.expires_in * 1000
        : undefined;
    const newRefresh = data.refresh_token?.trim() ?? refreshToken;

    applyTokensToProcessEnv(accessToken, newRefresh);
    writeStore({
      accessToken,
      refreshToken: newRefresh,
      expiresAt,
      updatedAt: new Date().toISOString(),
    });
    memoryAccessToken = accessToken;
    return accessToken;
  } catch (err) {
    console.warn("LinkedIn token refresh error:", err);
    return null;
  }
}

/** Resolve a valid access token (env, cache file, refresh if expired). */
export async function getLinkedInAccessToken(): Promise<string | null> {
  if (memoryAccessToken) return memoryAccessToken;

  const store = readStore();
  const envAccess = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const access = store?.accessToken?.trim() || envAccess;

  if (access && store?.expiresAt && !isExpired(store.expiresAt)) {
    memoryAccessToken = access;
    applyTokensToProcessEnv(access, store.refreshToken);
    return access;
  }

  if (access && store?.expiresAt && isExpired(store.expiresAt) && canRefresh(store)) {
    const refreshed = await refreshLinkedInAccessToken();
    if (refreshed) return refreshed;
  }

  if (access) {
    memoryAccessToken = access;
    return access;
  }

  if (canRefresh(store)) {
    return refreshLinkedInAccessToken();
  }

  return null;
}

/** `fetch` with Bearer token; refreshes once on 401 and retries. */
export async function linkedInAuthorizedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getLinkedInAccessToken();
  if (!token) {
    return new Response(null, { status: 401, statusText: "No LinkedIn access token" });
  }

  const withAuth = (t: string): RequestInit => ({
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${t}`,
    },
  });

  let res = await fetch(url, withAuth(token));

  if (res.status === 401 && canRefresh()) {
    memoryAccessToken = null;
    const refreshed = await refreshLinkedInAccessToken();
    if (refreshed) {
      res = await fetch(url, withAuth(refreshed));
    }
  }

  return res;
}

export function linkedInOAuthConfigured(): boolean {
  return Boolean(
    process.env.LINKEDIN_ACCESS_TOKEN?.trim() ||
      readStore()?.accessToken ||
      canRefresh(),
  );
}
