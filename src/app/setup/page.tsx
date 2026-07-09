"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  RequirementCheckResult,
  SetupRequirementsReport,
} from "@/lib/setup/types";
import { SEARCH_INTEGRATION } from "@/lib/ai/search-integration";

type Phase = "idle" | "checking" | "done";

export default function SetupPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [report, setReport] = useState<SetupRequirementsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);

  const runChecks = useCallback(async (options?: { resetPhase?: boolean }) => {
    if (options?.resetPhase) {
      setPhase("checking");
      setError(null);
    }
    try {
      const res = await fetch("/api/setup/check");
      const data = await res.json();
      setReport(data.report);
      setPhase("done");
    } catch {
      setError("Could not run requirement checks. Is the server running?");
      setPhase("done");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/setup/check");
        if (cancelled) return;
        const data = await res.json();
        setReport(data.report);
        setPhase("done");
      } catch {
        if (cancelled) return;
        setError("Could not run requirement checks. Is the server running?");
        setPhase("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueToOnboarding = async () => {
    if (!report?.allPassed) return;
    setContinuing(true);
    setError(null);
    const res = await fetch("/api/setup/check", { method: "POST" });
    const data = await res.json();
    setContinuing(false);

    if (!res.ok) {
      setReport(data.report ?? report);
      setError(data.message ?? "Requirements are not satisfied yet.");
      return;
    }

    router.push("/onboarding");
  };

  const requiredPassed = report?.requiredPassed ?? 0;
  const requiredTotal = report?.requiredTotal ?? 0;
  const optionalChecks =
    report?.checks.filter(
      (c) =>
        c.id === "reddit_optional" ||
        c.id === "linkedin_optional" ||
        c.id === "youtube_optional" ||
        c.id === "linkedin_publish_optional" ||
        c.id === "apify_optional" ||
        c.id === "youtube_publish_optional",
    ) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-white to-violet-50/30 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
          Before you start
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-800">
          System requirements
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          This app needs a working <strong>GEMINI_API_KEY</strong> and Gemini&apos;s
          built-in Google Search grounding. It does <strong>not</strong> use Google
          Custom Search API or Search Console (those require OAuth 2.0 / service
          accounts, not a simple API key).
        </p>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            {phase === "checking" && (
              <p className="text-sm text-violet-600">Running checks…</p>
            )}
            {phase === "done" && report && (
              <p className="text-sm text-slate-600">
                {report.allPassed ? (
                  <span className="font-medium text-emerald-700">
                    All {requiredTotal} required checks passed
                  </span>
                ) : (
                  <span>
                    <span className="font-medium text-amber-700">
                      {requiredPassed} of {requiredTotal} required passed
                    </span>
                    {" — fix required items to continue"}
                  </span>
                )}
                {optionalChecks.some((c) => c.state === "skipped") && (
                  <span className="mt-1 block text-xs text-slate-500">
                    Optional Reddit/LinkedIn skipped or not configured — add keys in
                    .env for fuller research.
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void runChecks({ resetPhase: true })}
            disabled={phase === "checking"}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {phase === "checking" ? "Checking…" : "Run checks again"}
          </button>
        </div>

        <ul className="mt-6 space-y-3">
          {phase === "checking" && !report && (
            <li className="rounded-xl border border-slate-100 bg-white p-5 text-sm text-slate-500">
              Verifying Gemini, Google Search, billing, storage, and optional
              Reddit/LinkedIn…
            </li>
          )}
          {report?.checks.map((item) => (
            <RequirementRow key={item.id} item={item} loading={phase === "checking"} />
          ))}
        </ul>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5">
            <h2 className="text-sm font-semibold text-slate-800">What you need</h2>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <li>
                <code className="rounded bg-white/80 px-1">GEMINI_API_KEY</code> from{" "}
                <ExternalLink href="https://aistudio.google.com/apikey">
                  Google AI Studio
                </ExternalLink>
              </li>
              <li>
                Generative Language API + billing on the linked Cloud project (for paid
                grounding)
              </li>
              <li>
                <ExternalLink href={SEARCH_INTEGRATION.docsUrl}>
                  Grounding with Google Search
                </ExternalLink>{" "}
                enabled via Gemini (built-in <code className="rounded bg-white/80 px-1">google_search</code> tool)
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-5">
            <h2 className="text-sm font-semibold text-slate-800">Optional</h2>
            <p className="mt-2 text-xs text-slate-500">
              Reddit and LinkedIn are checked only when credentials exist in{" "}
              <code className="rounded bg-white/80 px-1">.env</code>. Failures do not
              block onboarding.
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
              <li>Reddit — post signals in research</li>
              <li>LinkedIn — Advertising API ad spend in financials</li>
              <li>YouTube — real trending videos in Ads & Content</li>
              <li>LinkedIn publishing — post generated ideas directly from Ads & Content</li>
              <li>Apify — verified Instagram/LinkedIn post data (views/likes/comments) in Ads & Content</li>
              <li>YouTube publishing — upload video and read back stats from Ads & Content</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">Never used by this app:</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-600">
              {SEARCH_INTEGRATION.notRequired.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!report?.allPassed || continuing}
            onClick={() => void continueToOnboarding()}
            className="rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {continuing ? "Saving…" : "Continue to onboarding"}
          </button>
          {report && !report.allPassed && (
            <p className="self-center text-xs text-slate-500">
              All required Gemini and storage checks must pass. Optional integrations
              do not block continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RequirementRow({
  item,
  loading,
}: {
  item: RequirementCheckResult;
  loading: boolean;
}) {
  const icon =
    item.state === "passed" ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        ✓
      </span>
    ) : item.state === "skipped" ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        —
      </span>
    ) : item.state === "failed" ? (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        !
      </span>
    ) : (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        …
      </span>
    );

  return (
    <li
      className={`rounded-xl border bg-white p-5 transition-opacity ${
        item.state === "passed"
          ? "border-emerald-100"
          : item.state === "skipped"
            ? "border-slate-100 bg-slate-50/50"
            : item.state === "failed"
              ? "border-amber-200"
              : "border-slate-100"
      } ${loading ? "opacity-60" : ""}`}
    >
      <div className="flex gap-4">
        {icon}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">{item.label}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
          <p
            className={`mt-2 text-sm ${
              item.state === "passed"
                ? "text-emerald-800"
                : item.state === "skipped"
                  ? "text-slate-600"
                  : "text-slate-700"
            }`}
          >
            {item.message}
          </p>
          {item.detail && (
            <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
          )}
          {(item.state === "failed" || item.state === "skipped") && item.actionUrl && (
            <a
              href={item.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-medium text-sky-700 underline"
            >
              {item.actionLabel ?? "Open setup guide"}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sky-700 underline"
    >
      {children}
    </a>
  );
}
