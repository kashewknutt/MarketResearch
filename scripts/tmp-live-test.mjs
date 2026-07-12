import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3000";
const EMAIL = "parthwanjari08@gmail.com";

function toBase64Url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const anon = createClient(SUPABASE_URL, ANON_KEY);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;

  const tokenHash = linkData.properties.hashed_token;
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (verifyErr) throw verifyErr;

  const session = verifyData.session;
  console.log("Authenticated as:", verifyData.user.email, verifyData.user.id);

  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookiePayload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user,
  });
  const cookieValue = "base64-" + toBase64Url(cookiePayload);

  // Chunk if too long (>3180 chars is @supabase/ssr's threshold)
  const chunkSize = 3180;
  const cookies = [];
  if (cookieValue.length > chunkSize) {
    for (let i = 0; i * chunkSize < cookieValue.length; i++) {
      cookies.push(`${cookieName}.${i}=${cookieValue.slice(i * chunkSize, (i + 1) * chunkSize)}`);
    }
  } else {
    cookies.push(`${cookieName}=${cookieValue}`);
  }
  const cookieHeader = cookies.join("; ");

  async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON response
    }
    return { status: res.status, json };
  }

  console.log("\n== /api/org (sanity: confirms real session works) ==");
  console.log(await call("GET", "/api/org"));

  console.log("\n== /api/leads (list) ==");
  const leadsRes = await call("GET", "/api/leads");
  console.log("status:", leadsRes.status, "count:", leadsRes.json?.leads?.length);
  const testLead = leadsRes.json?.leads?.[0];

  if (testLead) {
    console.log(`\nUsing real lead: ${testLead.id} (${testLead.company})`);

    console.log("\n== POST /api/leads/[id]/find-contact ==");
    console.log(await call("POST", `/api/leads/${testLead.id}/find-contact`));

    console.log("\n== POST /api/leads/[id]/draft-message ==");
    console.log(await call("POST", `/api/leads/${testLead.id}/draft-message`));

    console.log("\n== POST /api/leads/[id]/mark-sent ==");
    console.log(await call("POST", `/api/leads/${testLead.id}/mark-sent`));

    console.log("\n== POST /api/comments (create on this lead) ==");
    const commentRes = await call("POST", "/api/comments", {
      entityType: "lead",
      entityId: testLead.id,
      body: "Live-test comment — safe to ignore.",
      mentionedUserIds: [],
    });
    console.log(commentRes);

    console.log("\n== GET /api/comments (list for this lead) ==");
    console.log(await call("GET", `/api/comments?entityType=lead&entityId=${testLead.id}`));

    console.log("\n== GET /api/mentions ==");
    console.log(await call("GET", "/api/mentions"));

    // cleanup: delete the test comment directly from DB
    if (commentRes.json?.comment?.id) {
      const sql = postgres(process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL, { prepare: false });
      await sql`delete from comment_mentions where comment_id = ${commentRes.json.comment.id}`;
      await sql`delete from comments where id = ${commentRes.json.comment.id}`;
      await sql.end();
      console.log("\nCleaned up test comment from DB.");
    }
  } else {
    console.log("No existing leads found to test outreach/comments against.");
  }

  console.log("\n== GET /api/assignments (sanity for For You / tasks) ==");
  console.log(await call("GET", "/api/assignments"));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
