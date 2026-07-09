#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-time local setup: obtains a YouTube OAuth refresh token (youtube.upload +
 * youtube.readonly scopes) via Google's standard OAuth2 authorization-code flow,
 * using a temporary local HTTP server as the redirect target.
 *
 * Prerequisites:
 *  1. In Google Cloud Console (the same project as your YOUTUBE_API_KEY), create an
 *     OAuth Client ID of type "Desktop app".
 *  2. Run: node scripts/youtube-oauth-setup.cjs <CLIENT_ID> <CLIENT_SECRET>
 *  3. Open the printed URL, sign in, approve access.
 *  4. Copy the printed YOUTUBE_OAUTH_* values into your .env.local.
 */
const http = require("http");
const { URL } = require("url");

const PORT = 8912;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const [, , clientId, clientSecret] = process.argv;

if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/youtube-oauth-setup.cjs <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this URL, sign in, and approve access:\n");
console.log(authUrl.toString());
console.log(`\nWaiting for redirect on ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`OAuth error: ${error ?? "no code returned"}`);
    console.error("OAuth error:", error ?? "no code returned");
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Success — you can close this tab and return to the terminal.");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      console.error("Token exchange failed:", JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("\nAdd these to your .env.local:\n");
    console.log(`YOUTUBE_OAUTH_CLIENT_ID=${clientId}`);
    console.log(`YOUTUBE_OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log(`YOUTUBE_OAUTH_REFRESH_TOKEN=${data.refresh_token}\n`);
  } catch (err) {
    console.error("Token exchange request failed:", err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT);
