"use client";

import { useEffect, useState } from "react";
import type { LeadRecord } from "@/lib/types/domain";

interface ColdCallLeadsFormProps {
  regions: string[];
  onClose: () => void;
  onFetched: (leads: LeadRecord[]) => void;
}

const CUSTOM_REGION_VALUE = "__custom__";
export const MAX_COLD_CALL_FETCH_COUNT = 20;

const CACHE_KEY = "coldCallLeadsForm:v1";

interface CachedFormValues {
  regionChoice: string;
  customRegion: string;
  city: string;
  keyword: string;
  campaignContext: string;
  count: string;
}

function loadCachedValues(): Partial<CachedFormValues> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Partial<CachedFormValues>) : {};
  } catch {
    return {};
  }
}

interface FetchProgress {
  completed: number;
  total: number;
  title: string;
}

export function ColdCallLeadsForm({ regions, onClose, onFetched }: ColdCallLeadsFormProps) {
  const [regionChoice, setRegionChoice] = useState(regions[0] ?? CUSTOM_REGION_VALUE);
  const [customRegion, setCustomRegion] = useState("");
  const region = regionChoice === CUSTOM_REGION_VALUE ? customRegion : regionChoice;
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [campaignContext, setCampaignContext] = useState("");
  const [count, setCount] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  // Pre-fill from the last submission, once, after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    const cached = loadCachedValues();
    if (cached.regionChoice) setRegionChoice(cached.regionChoice);
    if (cached.customRegion) setCustomRegion(cached.customRegion);
    if (cached.city) setCity(cached.city);
    if (cached.keyword) setKeyword(cached.keyword);
    if (cached.campaignContext) setCampaignContext(cached.campaignContext);
    if (cached.count) setCount(cached.count);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const values: CachedFormValues = {
      regionChoice,
      customRegion,
      city,
      keyword,
      campaignContext,
      count,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(values));
  }, [regionChoice, customRegion, city, keyword, campaignContext, count]);

  const numericCount = Number(count);
  const canSubmit =
    region.trim() &&
    city.trim() &&
    keyword.trim() &&
    campaignContext.trim() &&
    Number.isFinite(numericCount) &&
    numericCount >= 1 &&
    numericCount <= MAX_COLD_CALL_FETCH_COUNT;

  const submit = async () => {
    setError(null);
    setSaving(true);
    setProgress({ completed: 0, total: numericCount, title: "" });

    try {
      const res = await fetch("/api/leads/cold-call/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          city: city.trim(),
          keyword: keyword.trim(),
          campaignContext: campaignContext.trim(),
          count: numericCount,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? "Could not fetch cold-call leads.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fetched: LeadRecord[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            completed?: number;
            total?: number;
            title?: string;
            leads?: LeadRecord[];
            message?: string;
            error?: string;
          };

          if (event.type === "progress") {
            setProgress({
              completed: event.completed ?? 0,
              total: event.total ?? numericCount,
              title: event.title ?? "",
            });
          } else if (event.type === "complete") {
            fetched = event.leads ?? [];
          } else if (event.type === "error") {
            setError(event.message ?? "Could not fetch cold-call leads.");
          }
        }
      }

      if (fetched.length > 0) {
        onFetched(fetched);
      } else {
        setError(
          "No businesses matched that search. Google Maps search works best with a concrete " +
            "business category (e.g. \"business brokers\" or \"IT consulting agencies\"), not an " +
            "audience description — try a narrower keyword or a different city.",
        );
      }
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Find cold-call leads</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Pulls real businesses from Google Maps that have a listed phone number but no
          website — an easy cold-calling segment. Separate from your regular lead lists.
        </p>

        {saving && progress ? (
          <FetchProgressView progress={progress} />
        ) : (
          <>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Region</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={regionChoice}
                  onChange={(e) => setRegionChoice(e.target.value)}
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={CUSTOM_REGION_VALUE}>Custom region…</option>
                </select>
                {regionChoice === CUSTOM_REGION_VALUE && (
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    placeholder="e.g. Germany"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">City</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">
                  Business type / keyword
                </label>
                <p className="mt-0.5 text-xs text-slate-400">
                  One or more concrete Google Maps categories, comma-separated — each runs as its
                  own search. Not an audience description; who you&apos;re targeting and why goes
                  in the campaign field below.
                </p>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. digital marketing agencies, IT consulting firms"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">
                  Campaign / target — what are these numbers for?
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={campaignContext}
                  onChange={(e) => setCampaignContext(e.target.value)}
                  rows={3}
                  placeholder="e.g. Cold-calling local retailers without a website to pitch our starter website + Google Business Profile setup package"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">
                  Number of leads (max {MAX_COLD_CALL_FETCH_COUNT} at a time)
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_COLD_CALL_FETCH_COUNT}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={count}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next) && next > MAX_COLD_CALL_FETCH_COUNT) {
                      setCount(String(MAX_COLD_CALL_FETCH_COUNT));
                    } else {
                      setCount(e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Find leads
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FetchProgressView({ progress }: { progress: FetchProgress }) {
  const { completed, total, title } = progress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <span className="font-medium">
          {completed} of {total} done
        </span>
        <span className="text-slate-400">{remaining} left</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
        {completed === 0
          ? "Searching Google Maps…"
          : completed >= total
            ? "Finishing up…"
            : `Just finished “${title}”. Researching next…`}
      </div>
      <ul className="space-y-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
              i < completed
                ? "bg-emerald-50 text-emerald-700"
                : i === completed
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-400"
            }`}
          >
            <span>{i < completed ? "✓" : i === completed ? "…" : "○"}</span>
            Lead {i + 1}
            {i === completed && total > 0 && completed < total && " — in progress"}
          </li>
        ))}
      </ul>
    </div>
  );
}
