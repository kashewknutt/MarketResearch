"use client";

import { useEffect, useState } from "react";
import { CitationList } from "@/components/ui/citation-list";
import type {
  AdIdea,
  AdIdeaStatus,
  AdSourceType,
  AdTrendsSnapshot,
  EngagementMetrics,
  TrendingAdExample,
} from "@/lib/types/domain";

function VerifiedBadge({
  sourceType,
  platform,
  fetchedAt,
}: {
  sourceType?: AdSourceType;
  platform?: string;
  fetchedAt?: string;
}) {
  if (sourceType === "scraped") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
        ✓ Verified{platform ? ` via ${platform}` : ""}
        {fetchedAt ? ` · as of ${new Date(fetchedAt).toLocaleDateString()}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
      AI-estimated
    </span>
  );
}

function MetricsTable({ metrics }: { metrics?: EngagementMetrics }) {
  if (!metrics) return null;
  const rows: Array<[string, number | undefined]> = [
    ["Views", metrics.viewCount],
    ["Likes", metrics.likeCount],
    ["Comments", metrics.commentCount],
    ["Shares", metrics.shareCount],
  ].filter(([, v]) => v != null) as Array<[string, number]>;
  if (rows.length === 0) return null;

  return (
    <table className="mt-2 w-full text-xs">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-t border-slate-100">
            <td className="py-1 text-slate-500">{label}</td>
            <td className="py-1 text-right font-medium text-slate-800">
              {new Intl.NumberFormat().format(value as number)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface AdIdeaDetailSheetProps {
  idea: AdIdea | null;
  onClose: () => void;
  onIdeaUpdated: (ads: AdTrendsSnapshot) => void;
}

const STATUS_LABELS: Record<AdIdeaStatus, string> = {
  idea: "Idea",
  content_ready: "Content ready",
  posted: "Posted",
  published_linkedin: "Published (LinkedIn)",
};

export function AdIdeaDetailSheet({ idea, onClose, onIdeaUpdated }: AdIdeaDetailSheetProps) {
  const [constraintsNotes, setConstraintsNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [markingPosted, setMarkingPosted] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishText, setPublishText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrn, setPublishedUrn] = useState<string | null>(null);

  useEffect(() => {
    setConstraintsNotes(idea?.generatedContent?.constraints.notes ?? "");
    setGenerateError(null);
    setStatusError(null);
    setPublishOpen(false);
    setPublishError(null);
    setPublishedUrn(null);
    setPublishText(idea?.generatedContent?.captionOrPost ?? idea?.scriptOrCaption ?? "");
  }, [idea?.id]);

  if (!idea) return null;

  const hasContent = Boolean(idea.generatedContent);
  const isPosted = idea.status === "posted" || idea.status === "published_linkedin";

  async function generateContent() {
    if (!idea) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: constraintsNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.message ?? data.error ?? "Content generation failed");
        return;
      }
      onIdeaUpdated(data.ads);
    } catch {
      setGenerateError("Content generation failed — check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function markPosted() {
    if (!idea) return;
    setMarkingPosted(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "posted" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.message ?? data.error ?? "Could not update status");
        return;
      }
      onIdeaUpdated(data.ads);
    } catch {
      setStatusError("Could not update status — check your connection and try again.");
    } finally {
      setMarkingPosted(false);
    }
  }

  async function publishToLinkedIn() {
    if (!idea) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/publish/linkedin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentary: publishText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.message ?? data.error ?? "Publish failed");
        return;
      }
      onIdeaUpdated(data.ads);
      setPublishedUrn(data.postUrn);
    } catch {
      setPublishError("Publish failed — check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{idea.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">
            {idea.platform} · {idea.format.replace("_", " ")} · {idea.priority}
          </span>
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {STATUS_LABELS[idea.status]}
          </span>
        </div>

        <section>
          <p className="text-sm font-medium text-slate-800">Hook</p>
          <p className="mt-1 text-xs italic text-slate-700">&ldquo;{idea.hook}&rdquo;</p>
        </section>

        <section>
          <p className="text-sm font-medium text-slate-800">Concept</p>
          <p className="mt-1 text-xs text-slate-600">{idea.concept}</p>
        </section>

        <section className="rounded-lg bg-emerald-50/40 p-4">
          <p className="text-sm font-medium text-slate-800">Script / caption draft</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{idea.scriptOrCaption}</p>
        </section>

        <section className="rounded-lg bg-violet-50/40 p-4">
          <p className="text-sm font-medium text-slate-800">Why this works</p>
          <p className="mt-1 text-xs text-slate-700">{idea.whyThisWorks}</p>
        </section>

        {idea.sourceRef && (
          <section className="rounded-lg border border-amber-100 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">Source</p>
              <VerifiedBadge
                sourceType={idea.sourceRef.sourceType}
                platform={idea.sourceRef.platform}
                fetchedAt={idea.sourceRef.fetchedAt}
              />
            </div>
            {idea.sourceRef.url ? (
              <a
                href={idea.sourceRef.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs font-medium text-sky-700 underline"
              >
                {idea.sourceRef.title}
              </a>
            ) : (
              <p className="mt-1 text-xs font-medium text-slate-700">{idea.sourceRef.title}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">
              {[idea.sourceRef.brandName, idea.sourceRef.platform].filter(Boolean).join(" · ")}
              {idea.sourceRef.metrics ? "" : idea.sourceRef.engagementSignal ? ` · ${idea.sourceRef.engagementSignal}` : ""}
            </p>
            <MetricsTable metrics={idea.sourceRef.metrics} />
            <p className="mt-2 text-xs text-slate-700">{idea.sourceRef.whyPicked}</p>
          </section>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={idea.provenance.citations} />
        </section>

        <section className="rounded-lg border border-slate-100 p-4">
          <p className="text-sm font-medium text-slate-800">
            {hasContent ? "Regenerate content" : "Generate content"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Set your premise/constraints (locations, budget, props available) — the script and
            scenes will respect them.
          </p>
          <textarea
            value={constraintsNotes}
            onChange={(e) => setConstraintsNotes(e.target.value)}
            placeholder="e.g. I only have a bedroom, no other locations, small budget, no actors besides me"
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={generateContent}
            disabled={generating}
            className="mt-2 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {generating ? "Generating…" : hasContent ? "Regenerate" : "Generate content"}
          </button>
          {generateError && <p className="mt-2 text-xs text-rose-700">{generateError}</p>}

          {idea.generatedContent && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400">
                v{idea.generatedContent.version} · generated{" "}
                {new Date(idea.generatedContent.generatedAt).toLocaleString()}
              </p>
              <div>
                <p className="text-xs font-medium text-slate-800">Script</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                  {idea.generatedContent.script}
                </p>
              </div>
              {idea.generatedContent.scenes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-800">Scenes</p>
                  <ol className="mt-1 space-y-2">
                    {idea.generatedContent.scenes.map((s) => (
                      <li key={s.order} className="rounded-lg border border-slate-100 p-2 text-xs">
                        <p className="font-medium text-slate-700">
                          Scene {s.order}
                          {s.durationSec ? ` · ~${s.durationSec}s` : ""}
                        </p>
                        <p className="mt-1 text-slate-600">Shot: {s.shot}</p>
                        <p className="mt-1 text-slate-600">{s.dialogueOrText}</p>
                        {s.notes && <p className="mt-1 text-slate-400">{s.notes}</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-slate-800">Caption</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                  {idea.generatedContent.captionOrPost}
                </p>
              </div>
              {idea.generatedContent.hashtags && idea.generatedContent.hashtags.length > 0 && (
                <p className="text-xs text-sky-700">
                  {idea.generatedContent.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              )}
              {idea.generatedContent.assetNotes && (
                <div>
                  <p className="text-xs font-medium text-slate-800">Working with your constraints</p>
                  <p className="mt-1 text-xs text-slate-600">{idea.generatedContent.assetNotes}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-100 p-4">
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={isPosted}
              disabled={isPosted || markingPosted}
              onChange={markPosted}
            />
            Mark as posted
          </label>
          {statusError && <p className="mt-2 text-xs text-rose-700">{statusError}</p>}
        </section>

        {idea.platform.toLowerCase() === "linkedin" && (
          <section className="rounded-lg border border-sky-100 bg-sky-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Publish to LinkedIn</p>
            {idea.linkedInPublish ? (
              <p className="mt-1 text-xs text-emerald-700">
                Published {new Date(idea.linkedInPublish.publishedAt).toLocaleString()} —{" "}
                <a
                  href={`https://www.linkedin.com/feed/update/${idea.linkedInPublish.postUrn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  view post
                </a>
              </p>
            ) : !publishOpen ? (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="mt-2 rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50"
              >
                Publish to LinkedIn
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-500">
                  Review before posting — this publishes immediately and can&apos;t be undone from here.
                </p>
                <textarea
                  value={publishText}
                  onChange={(e) => setPublishText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={publishToLinkedIn}
                    disabled={publishing || !publishText.trim()}
                    className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                  >
                    {publishing ? "Publishing…" : "Confirm & publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishOpen(false)}
                    disabled={publishing}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                {publishError && <p className="text-xs text-rose-700">{publishError}</p>}
                {publishedUrn && (
                  <p className="text-xs text-emerald-700">Published — post URN {publishedUrn}</p>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

interface TrendingAdDetailSheetProps {
  example: TrendingAdExample | null;
  onClose: () => void;
}

export function TrendingAdDetailSheet({ example, onClose }: TrendingAdDetailSheetProps) {
  if (!example) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{example.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs ${
              example.isOwnBrand ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {example.isOwnBrand ? "Your brand" : example.brandName} · {example.platform} ·{" "}
            {example.format.replace("_", " ")}
          </span>
          <VerifiedBadge
            sourceType={example.sourceType}
            platform={example.platform}
            fetchedAt={example.fetchedAt}
          />
        </div>

        <p className="text-xs text-slate-600">{example.description}</p>

        {example.hook && (
          <section>
            <p className="text-sm font-medium text-slate-800">Hook</p>
            <p className="mt-1 text-xs italic text-slate-700">&ldquo;{example.hook}&rdquo;</p>
          </section>
        )}

        <section className="rounded-lg bg-violet-50/40 p-4">
          <p className="text-sm font-medium text-slate-800">Why it&apos;s trending</p>
          <p className="mt-1 text-xs text-slate-700">{example.whyTrending}</p>
        </section>

        {example.metrics ? (
          <MetricsTable metrics={example.metrics} />
        ) : (
          example.engagementSignal && (
            <p className="text-sm font-semibold text-violet-700">{example.engagementSignal}</p>
          )
        )}

        {example.url && (
          <a
            href={example.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-sky-700 underline"
          >
            View original
          </a>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={example.citations} />
        </section>
      </div>
    </div>
  );
}
