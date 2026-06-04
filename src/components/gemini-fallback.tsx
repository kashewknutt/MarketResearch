"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GeminiConnectionStatus } from "@/lib/ai/gemini";

interface GeminiStatusResponse {
  gemini: {
    status: GeminiConnectionStatus;
    message: string;
    model: string;
  };
}

interface GeminiFallbackProps {
  title?: string;
  verify?: boolean;
  compact?: boolean;
}

const STATUS_LABELS: Record<GeminiConnectionStatus, string> = {
  ready: "Connected",
  missing_key: "API key required",
  invalid_key: "Invalid API key",
  expired_key: "API key expired",
  rate_limited: "Rate limited",
  billing_required: "Billing required",
  unavailable: "Unavailable",
};

export function GeminiFallback({
  title = "Gemini API required",
  verify = true,
  compact = false,
}: GeminiFallbackProps) {
  const [status, setStatus] = useState<GeminiStatusResponse["gemini"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/status?verify=${verify ? "true" : "false"}`)
      .then((r) => r.json())
      .then((d: GeminiStatusResponse) => setStatus(d.gemini))
      .finally(() => setLoading(false));
  }, [verify]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-500">
        Checking Gemini API…
      </div>
    );
  }

  if (!status || status.status === "ready") {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-rose-50/40 ${
        compact ? "p-4" : "p-6"
      }`}
      role="alert"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-amber-700/90">
        {STATUS_LABELS[status.status]}
      </p>
      <h2 className={`mt-1 font-semibold text-slate-800 ${compact ? "text-sm" : "text-base"}`}>
        {title}
      </h2>
      <p className={`mt-2 text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
        {status.message}
      </p>
      <ol className={`mt-4 list-decimal space-y-1 pl-4 text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
        <li>
          Copy <code className="rounded bg-white/80 px-1">.env.example</code> to{" "}
          <code className="rounded bg-white/80 px-1">.env.local</code>
        </li>
        <li>
          Set <code className="rounded bg-white/80 px-1">GEMINI_API_KEY</code> from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-700 underline"
          >
            Google AI Studio
          </a>
          (not Custom Search or Search Console OAuth)
        </li>
        <li>Restart the dev server or desktop app</li>
        <li>
          Open <Link href="/settings" className="text-violet-700 underline">Settings</Link> and
          re-run research
        </li>
      </ol>
    </div>
  );
}

export function useGeminiReady(verify = false) {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/status?verify=${verify ? "true" : "false"}`)
      .then((r) => r.json())
      .then((d: GeminiStatusResponse) =>
        setReady(d.gemini.status === "ready"),
      )
      .catch(() => setReady(false));
  }, [verify]);

  return ready;
}
