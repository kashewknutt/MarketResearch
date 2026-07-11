"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Tabs } from "@/components/ui/tabs";
import {
  AdIdeaDetailSheet,
  TrendingAdDetailSheet,
} from "@/components/ad-idea-detail-sheet";
import { LikeCell } from "@/components/like-cell";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import type { LikeCount } from "@/lib/store/likes";
import type {
  AdIdea,
  AdTrendsSnapshot,
  CompetitorSocialHandle,
  ContentConstraintPreset,
  TrendingAdExample,
} from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const ideaCol = createColumnHelper<AdIdea>();
const exampleCol = createColumnHelper<TrendingAdExample>();

const DEFAULT_CONTENT_PRESETS: ContentConstraintPreset[] = [
  {
    id: "kk-bedroom",
    name: "KK Bedroom",
    notes:
      "I have a table lamp, white for clean lighting. A blue bricked wallpaper with some wall plants, CDs and Vinyl records for decor. There is plenty of natural light with a choice to cover the windows with curtains. I have an iphone 17 to record for video quality. I have a video editor for post cleanup. I have a mic connected to an arm and a table chair which I'll sit on while narrating. I have 2 LED strips with leaves for decor.",
  },
];

function daysUntilPurge(deletedAt: string): number {
  const elapsedDays = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, 30 - elapsedDays);
}

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  content_ready: "Content ready",
  posted: "Posted",
  published_linkedin: "Published (LinkedIn)",
};

function buildIdeaColumns(
  likes: Record<string, LikeCount>,
  toggle: (id: string) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ColumnDef<AdIdea, any>[] {
  return [
    ideaCol.display({
      id: "liked",
      header: "Liked",
      cell: ({ row }) => (
        <LikeCell liked={likes[row.original.id]} onToggle={() => toggle(row.original.id)} />
      ),
    }),
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
}

function buildExampleColumns(
  likes: Record<string, LikeCount>,
  toggle: (id: string) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ColumnDef<TrendingAdExample, any>[] {
  return [
    exampleCol.display({
      id: "liked",
      header: "Liked",
      cell: ({ row }) => (
        <LikeCell liked={likes[row.original.id]} onToggle={() => toggle(row.original.id)} />
      ),
    }),
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
}

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

  const activeIdeaIds = useMemo(
    () => (ads?.ideasForYou.filter((i) => !i.deletedAt).map((i) => i.id) ?? []),
    [ads],
  );
  const trendingIds = useMemo(() => ads?.trendingNow.map((e) => e.id) ?? [], [ads]);
  const {
    likes: ideaLikes,
    toggle: toggleIdeaLike,
    refresh: refreshIdeaLikes,
  } = useLikeSummaries("ad_idea", activeIdeaIds);
  const {
    likes: trendingLikes,
    toggle: toggleTrendingLike,
    refresh: refreshTrendingLikes,
  } = useLikeSummaries("trending_ad", trendingIds);

  if (!ads) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Ads & Content</h1>
        <p className="text-sm text-slate-500">Run research to generate ad trends and content ideas.</p>
      </div>
    );
  }

  const contentPresets =
    ads.contentPresets && ads.contentPresets.length > 0 ? ads.contentPresets : DEFAULT_CONTENT_PRESETS;
  const activeIdeas = ads.ideasForYou.filter((i) => !i.deletedAt);
  const trashedIdeas = ads.ideasForYou.filter((i) => i.deletedAt);

  const restoreIdea = async (id: string) => {
    const res = await fetch(`/api/ads/ideas/${id}/restore`, { method: "POST" });
    const data = await res.json();
    if (data.ads) setAds(data.ads);
  };

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
          { id: "performance", label: "Performance" },
          { id: "trash", label: `Trash${trashedIdeas.length > 0 ? ` (${trashedIdeas.length})` : ""}` },
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
                {activeIdeas.length}
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
              {activeIdeas.filter((i) => i.status !== "idea").length} of{" "}
              {activeIdeas.length} actioned. Click a row for the full concept, script draft,
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
                ? activeIdeas
                : activeIdeas.filter((i) => i.status === statusFilter)
            }
            columns={buildIdeaColumns(ideaLikes, toggleIdeaLike)}
            onRowClick={setSelectedIdea}
            isLiked={(row) => ideaLikes[row.id]?.likedByMe ?? false}
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
            columns={buildExampleColumns(trendingLikes, toggleTrendingLike)}
            onRowClick={setSelectedExample}
            isLiked={(row) => trendingLikes[row.id]?.likedByMe ?? false}
          />
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
        </div>
      )}

      {tab === "performance" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            What&apos;s working — every idea you&apos;ve published, with its latest tracked
            metrics. Click a row to refresh or add stats.
          </p>
          {(() => {
            const published = activeIdeas.filter((i) => i.publishInfo);
            if (published.length === 0) {
              return (
                <p className="text-sm text-slate-500">
                  Nothing published yet — mark an idea as posted or publish it directly to see it
                  here.
                </p>
              );
            }
            return (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Idea</th>
                      <th className="px-4 py-2 font-medium">Platform</th>
                      <th className="px-4 py-2 font-medium">Latest metrics</th>
                      <th className="px-4 py-2 font-medium">Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {published.map((i) => {
                      const latest = i.performanceHistory?.[i.performanceHistory.length - 1];
                      return (
                        <tr
                          key={i.id}
                          className="cursor-pointer border-t border-slate-50 hover:bg-violet-50/30"
                          onClick={() => setSelectedIdea(i)}
                        >
                          <td className="px-4 py-2.5 text-slate-700">{i.title}</td>
                          <td className="px-4 py-2.5 text-slate-700">{i.publishInfo!.platform}</td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {latest
                              ? [
                                  latest.metrics.viewCount != null ? `${latest.metrics.viewCount} views` : null,
                                  latest.metrics.likeCount != null ? `${latest.metrics.likeCount} likes` : null,
                                  latest.metrics.commentCount != null
                                    ? `${latest.metrics.commentCount} comments`
                                    : null,
                                  latest.metrics.shareCount != null ? `${latest.metrics.shareCount} shares` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"
                              : "No stats yet"}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {latest ? new Date(latest.fetchedAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "trash" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Deleted ideas stay here for 30 days before being removed for good.
          </p>
          {trashedIdeas.length === 0 ? (
            <p className="text-sm text-slate-500">Trash is empty.</p>
          ) : (
            <div className="space-y-2">
              {trashedIdeas.map((idea) => {
                const deletedAt = new Date(idea.deletedAt!);
                const daysLeft = daysUntilPurge(idea.deletedAt!);
                return (
                  <div
                    key={idea.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-700">{idea.title}</p>
                      <p className="mt-0.5 text-slate-500">
                        {idea.platform} · {idea.format.replace("_", " ")} · deleted{" "}
                        {deletedAt.toLocaleDateString()} · {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreIdea(idea.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Restore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AdIdeaDetailSheet
        idea={selectedIdea}
        onClose={() => {
          setSelectedIdea(null);
          refreshIdeaLikes();
        }}
        onIdeaUpdated={handleIdeaUpdated}
        contentPresets={contentPresets}
      />
      <TrendingAdDetailSheet
        example={selectedExample}
        onClose={() => {
          setSelectedExample(null);
          refreshTrendingLikes();
        }}
        contentPresets={contentPresets}
        onContentGenerated={(updated, idea) => {
          setAds(updated);
          setSelectedExample(null);
          setSelectedIdea(idea);
        }}
      />
    </div>
  );
}
