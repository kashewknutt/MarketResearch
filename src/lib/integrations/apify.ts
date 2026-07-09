export function apifyEnvPresence(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

/**
 * Runs an Apify actor synchronously and returns its dataset items.
 * Returns [] if APIFY_API_TOKEN is unset, so callers degrade gracefully
 * rather than fail (mirrors the youtube.ts / reddit.ts pattern).
 */
export async function runApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return [];

  try {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.warn(`Apify actor ${actorId} failed: ${res.status}`);
      return [];
    }
    return (await res.json()) as T[];
  } catch (err) {
    console.warn(`Apify actor ${actorId} request failed:`, err);
    return [];
  }
}

/** Used by setup checks — free call, no actor run, no cost. */
export async function verifyApifyConnection(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    return { ok: false, message: "No Apify API token configured." };
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      return { ok: false, message: `Apify token check failed (${res.status}).` };
    }
    const data = (await res.json()) as { data?: { username?: string; plan?: { id?: string } } };
    return {
      ok: true,
      message: "Apify API token verified.",
      detail: data.data?.username ? `Account: ${data.data.username}` : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apify API request failed";
    return { ok: false, message };
  }
}
