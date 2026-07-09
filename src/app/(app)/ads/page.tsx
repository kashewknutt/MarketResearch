"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Tabs } from "@/components/ui/tabs";
import {
  AdIdeaDetailSheet,
  TrendingAdDetailSheet,
} from "@/components/ad-idea-detail-sheet";
import { GeminiFallback } from "@/components/gemini-fallback";
import type {
  AdIdea,
  AdTrendsSnapshot,
  CompetitorSocialHandle,
  TrendingAdExample,
} from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const ideaCol = createColumnHelper<AdIdea>();
const exampleCol = createColumnHelper<TrendingAdExample>();

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  content_ready: "Content ready",
  posted: "Posted",
  published_linkedin: "Published (LinkedIn)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ideaColumns: ColumnDef<AdIdea, any>[] = [
  ideaCol.accessor("platform", { header: "Platform" }),
  ideaCol.accessor("format", {
    header: "Format",
    cell: (i) => i.getValue().replace("_", " "),
  }),
  ideaCol.accessor("title", { header: "Idea" }),
  ideaCol.accessor("priority", { header: "Priority" }),
  ideaCol.accessor("status", {
    header: "Status",
    cell: (i) => STATUS_LABELS[i.getValue()] ?? i.getValue(),
  }),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exampleColumns: ColumnDef<TrendingAdExample, any>[] = [
  exampleCol.accessor("platform", { header: "Platform" }),
  exampleCol.display({
    id: "brand",
    header: "Brand",
    cell: ({ row }) => (row.original.isOwnBrand ? "You" : row.original.brandName),
  }),
  exampleCol.accessor("format", {
    header: "Format",
    cell: (i) => i.getValue().replace("_", " "),
  }),
  exampleCol.accessor("title", { header: "Title" }),
  exampleCol.accessor("engagementSignal", {
    header: "Engagement",
    cell: (i) => i.getValue() ?? "—",
  }),
  exampleCol.accessor("sourceType", {
    header: "Source",
    cell: (i) =>
      i.getValue() === "scraped" ? (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
          ✓ Verified
        </span>
      ) : (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
          AI-estimated
        </span>
      ),
  }),
];

export default function AdsPage() {
  const [tab, setTab] = useState("overview");
  const [ads, setAds] = useState<AdTrendsSnapshot | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<AdIdea | null>(null);
  const [selectedExample, setSelectedExample] = useState<TrendingAdExample | null>(null);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generateCount, setGenerateCount] = useState(10);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [generateMoreError, setGenerateMoreError] = useState<string | null>(null);
  const [handleDrafts, setHandleDrafts] = useState<Record<string, { instagramHandle: string; linkedinUrl: string }>>(
    {},
  );

  const load = useCallback(() => {
    fetch("/api/ads")
      .then((r) => r.json())
      .then((d) => setAds(d.ads));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["ads", "all"]);

  const saveTrackedCompetitors = useCallback(
    async (trackedCompetitors: string[]) => {
      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackedCompetitors }),
      });
      const data = await res.json();
      if (data.ads) setAds(data.ads);
    },
    [],
  );

  const saveCompetitorSocialHandles = useCallback(
    async (competitorSocialHandles: CompetitorSocialHandle[]) => {
      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorSocialHandles }),
      });
      const data = await res.json();
      if (data.ads) setAds(data.ads);
    },
    [],
  );

  const handleIdeaUpdated = useCallback(
    (updated: AdTrendsSnapshot) => {
      setAds(updated);
      setSelectedIdea((prev) =>
        prev ? (updated.ideasForYou.find((i) => i.id === prev.id) ?? prev) : prev,
      );
    },
    [],
  );

  const generateMoreIdeas = useCallback(async () => {
    setGeneratingMore(true);
    setGenerateMoreError(null);
    try {
      const res = await fetch("/api/ads/ideas/generate-more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateMoreError(data.message ?? data.error ?? "Could not generate more ideas");
        return;
      }
      setAds(data.ads);
    } catch {
      setGenerateMoreError("Could not generate more ideas — check your connection and try again.");
    } finally {
      setGeneratingMore(false);
    }
  }, [generateCount]);

  if (!ads) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Ads & Content</h1>
        <GeminiFallback title="Run research to generate ad trends and content ideas" verify />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Ads & Content</h1>
        <p className="mt-1 text-xs text-slate-500">
          Trending ads and content across LinkedIn, Instagram, YouTube and more — for your brand
          and your competitors.
        </p>
      </header>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "ideas", label: "Ideas for you" },
          { id: "trending", label: "Trending now" },
          { id: "competitors", label: "By competitor" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Trending examples</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">
                {ads.trendingNow.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Ideas generated</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">
                {ads.ideasForYou.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Competitors tracked</p>
              <p className="mt-1 text-xl font-semibold text-slate-800">
                {ads.trackedCompetitors.length}
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-100 p-5">
            <p className="text-sm font-medium text-slate-800">Tracked competitors</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ads.trackedCompetitors.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() =>
                      saveTrackedCompetitors(
                        ads.trackedCompetitors.filter((c) => c !== name),
                      )
                    }
                    className="text-slate-400 hover:text-rose-600"
                  >
                    ×
                  </button>
                </span>
              ))}
              {ads.trackedCompetitors.length === 0 && (
                <p className="text-xs text-slate-400">No competitors tracked yet.</p>
              )}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newCompetitor.trim();
                if (!name || ads.trackedCompetitors.includes(name)) return;
                saveTrackedCompetitors([...ads.trackedCompetitors, name]);
                setNewCompetitor("");
              }}
            >
              <input
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                placeholder="Add a brand or account to track"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
              >
                Add
              </button>
            </form>

            {ads.trackedCompetitors.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-600">
                  Social handles (optional — enables real Instagram/LinkedIn data for that
                  competitor instead of AI estimates)
                </p>
                {ads.trackedCompetitors.map((name) => {
                  const saved = (ads.competitorSocialHandles ?? []).find(
                    (h) => h.competitorName === name,
                  );
                  const draft = handleDrafts[name] ?? {
                    instagramHandle: saved?.instagramHandle ?? "",
                    linkedinUrl: saved?.linkedinUrl ?? "",
                  };
                  return (
                    <div key={name} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="w-32 shrink-0 truncate text-slate-600">{name}</span>
                      <input
                        value={draft.instagramHandle}
                        onChange={(e) =>
                          setHandleDrafts((prev) => ({
                            ...prev,
                            [name]: { ...draft, instagramHandle: e.target.value },
                          }))
                        }
                        placeholder="Instagram handle (e.g. brandname)"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1"
                      />
                      <input
                        value={draft.linkedinUrl}
                        onChange={(e) =>
                          setHandleDrafts((prev) => ({
                            ...prev,
                            [name]: { ...draft, linkedinUrl: e.target.value },
                          }))
                        }
                        placeholder="LinkedIn profile/company URL"
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const others = (ads.competitorSocialHandles ?? []).filter(
                            (h) => h.competitorName !== name,
                          );
                          saveCompetitorSocialHandles([
                            ...others,
                            { competitorName: name, ...draft },
                          ]);
                        }}
                        className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200"
                      >
                        Save
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {ads.discoveredCompetitors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-600">
                  Discovered — not yet tracked
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ads.discoveredCompetitors
                    .filter((name) => !ads.trackedCompetitors.includes(name))
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() =>
                          saveTrackedCompetitors([...ads.trackedCompetitors, name])
                        }
                        className="rounded-full border border-dashed border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100"
                      >
                        + {name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "ideas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {ads.ideasForYou.filter((i) => i.status !== "idea").length} of{" "}
              {ads.ideasForYou.length} actioned. Click a row for the full concept, script draft,
              and to generate content.
            </p>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="idea">Idea</option>
              <option value="content_ready">Content ready</option>
              <option value="posted">Posted</option>
              <option value="published_linkedin">Published (LinkedIn)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3">
            <span className="text-xs text-slate-600">Generate</span>
            <input
              type="number"
              min={1}
              max={25}
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value) || 1)}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs"
            />
            <span className="text-xs text-slate-600">more ideas</span>
            <button
              type="button"
              onClick={generateMoreIdeas}
              disabled={generatingMore}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {generatingMore ? "Generating…" : "Generate more ideas"}
            </button>
            {generateMoreError && <p className="text-xs text-rose-700">{generateMoreError}</p>}
          </div>

          <DataTable
            data={
              statusFilter === "all"
                ? ads.ideasForYou
                : ads.ideasForYou.filter((i) => i.status === statusFilter)
            }
            columns={ideaColumns}
            onRowClick={setSelectedIdea}
          />
          <AdIdeaDetailSheet
            idea={selectedIdea}
            onClose={() => setSelectedIdea(null)}
            onIdeaUpdated={handleIdeaUpdated}
          />
        </div>
      )}

      {tab === "trending" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Market-wide trending ads and content — your brand, competitors, and other relevant
            brands.
          </p>
          <DataTable
            data={ads.trendingNow}
            columns={exampleColumns}
            onRowClick={setSelectedExample}
          />
          <TrendingAdDetailSheet example={selectedExample} onClose={() => setSelectedExample(null)} />
        </div>
      )}

      {tab === "competitors" && (
        <div className="space-y-4">
          {ads.competitorActivity.length === 0 ? (
            <p className="text-sm text-slate-500">Run research to generate competitor ad activity.</p>
          ) : (
            ads.competitorActivity.map((c) => (
              <div key={c.competitorName} className="rounded-xl border border-slate-100 p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-800">{c.competitorName}</h3>
                  {c.isDiscovered && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                      Discovered
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {c.examples.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelectedExample(ex)}
                      className="block w-full rounded-lg border border-slate-100 p-3 text-left text-xs hover:bg-violet-50/30"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{ex.title}</p>
                        {ex.sourceType === "scraped" ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800">
                            ✓ Verified
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                            AI-estimated
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-500">
                        {ex.platform} · {ex.format.replace("_", " ")}
                        {ex.engagementSignal ? ` · ${ex.engagementSignal}` : ""}
                      </p>
                    </button>
                  ))}
                  {c.examples.length === 0 && (
                    <p className="text-xs text-slate-400">No examples found yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
          <TrendingAdDetailSheet example={selectedExample} onClose={() => setSelectedExample(null)} />
        </div>
      )}
    </div>
  );
}
