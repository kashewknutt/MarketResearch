"use client";

import { useEffect, useState } from "react";
import { AssignTaskButton } from "@/components/assign-task-button";
import { CitationList } from "@/components/ui/citation-list";
import type {
  AdIdea,
  AdIdeaStatus,
  AdSourceType,
  AdTrendsSnapshot,
  ContentConstraintPreset,
  EngagementMetrics,
  TrendingAdExample,
} from "@/lib/types/domain";

const TIME_OF_DAY_OPTIONS = ["Early morning", "Morning", "Midday", "Afternoon", "Evening", "Night"];

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
  contentPresets: ContentConstraintPreset[];
}

const STATUS_LABELS: Record<AdIdeaStatus, string> = {
  idea: "Idea",
  content_ready: "Content ready",
  posted: "Posted",
  published_linkedin: "Published (LinkedIn)",
};

export function AdIdeaDetailSheet({ idea, onClose, onIdeaUpdated, contentPresets }: AdIdeaDetailSheetProps) {
  const [constraintsNotes, setConstraintsNotes] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [markPostedOpen, setMarkPostedOpen] = useState(false);
  const [markPostedPlatform, setMarkPostedPlatform] = useState("LinkedIn");
  const [markPostedUrl, setMarkPostedUrl] = useState("");
  const [markingPosted, setMarkingPosted] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishText, setPublishText] = useState("");
  const [publishFile, setPublishFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrn, setPublishedUrn] = useState<string | null>(null);

  const [ytOpen, setYtOpen] = useState(false);
  const [ytFile, setYtFile] = useState<File | null>(null);
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [ytPrivacy, setYtPrivacy] = useState<"public" | "unlisted" | "private">("unlisted");
  const [ytUploading, setYtUploading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualViews, setManualViews] = useState("");
  const [manualLikes, setManualLikes] = useState("");
  const [manualComments, setManualComments] = useState("");
  const [manualShares, setManualShares] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  useEffect(() => {
    setConstraintsNotes(idea?.generatedContent?.constraints.notes ?? "");
    setTimeOfDay(idea?.generatedContent?.constraints.timeOfDay ?? "");
    setSelectedPresetId("");
    setNewPresetName("");
    setPresetError(null);
    setGenerateError(null);
    setMarkPostedOpen(false);
    setMarkPostedUrl("");
    setStatusError(null);
    setPublishOpen(false);
    setPublishFile(null);
    setPublishError(null);
    setPublishedUrn(null);
    setPublishText(idea?.generatedContent?.captionOrPost ?? idea?.scriptOrCaption ?? "");
    setYtOpen(false);
    setYtFile(null);
    setYtTitle(idea?.title ?? "");
    setYtDescription(idea?.generatedContent?.captionOrPost ?? idea?.scriptOrCaption ?? "");
    setYtError(null);
    setRefreshError(null);
    setManualOpen(false);
    setManualViews("");
    setManualLikes("");
    setManualComments("");
    setManualShares("");
  }, [idea?.id]);

  if (!idea) return null;

  const hasContent = Boolean(idea.generatedContent);

  async function generateContent() {
    if (!idea) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: constraintsNotes, timeOfDay: timeOfDay || undefined }),
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

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const preset = contentPresets.find((p) => p.id === presetId);
    if (preset) setConstraintsNotes(preset.notes);
  }

  async function saveCurrentAsPreset() {
    if (!newPresetName.trim() || !constraintsNotes.trim()) return;
    setPresetSaving(true);
    setPresetError(null);
    try {
      const preset: ContentConstraintPreset = {
        id: crypto.randomUUID(),
        name: newPresetName.trim(),
        notes: constraintsNotes,
      };
      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentPresets: [...contentPresets, preset] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPresetError(data.message ?? data.error ?? "Could not save preset");
        return;
      }
      onIdeaUpdated(data.ads);
      setSelectedPresetId(preset.id);
      setNewPresetName("");
    } catch {
      setPresetError("Could not save preset — check your connection and try again.");
    } finally {
      setPresetSaving(false);
    }
  }

  async function deletePreset(presetId: string) {
    setPresetSaving(true);
    setPresetError(null);
    try {
      const res = await fetch("/api/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentPresets: contentPresets.filter((p) => p.id !== presetId) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPresetError(data.message ?? data.error ?? "Could not delete preset");
        return;
      }
      onIdeaUpdated(data.ads);
      if (selectedPresetId === presetId) setSelectedPresetId("");
    } catch {
      setPresetError("Could not delete preset — check your connection and try again.");
    } finally {
      setPresetSaving(false);
    }
  }

  async function submitMarkPosted() {
    if (!idea) return;
    setMarkingPosted(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "posted", platform: markPostedPlatform, url: markPostedUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.message ?? data.error ?? "Could not update status");
        return;
      }
      onIdeaUpdated(data.ads);
      setMarkPostedOpen(false);
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
      let res: Response;
      if (publishFile) {
        const form = new FormData();
        form.set("commentary", publishText);
        form.set("media", publishFile);
        res = await fetch(`/api/ads/ideas/${idea.id}/publish/linkedin`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/ads/ideas/${idea.id}/publish/linkedin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentary: publishText }),
        });
      }
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

  async function publishToYoutube() {
    if (!idea || !ytFile) return;
    setYtUploading(true);
    setYtError(null);
    try {
      const form = new FormData();
      form.set("media", ytFile);
      form.set("title", ytTitle);
      form.set("description", ytDescription);
      form.set("privacyStatus", ytPrivacy);
      const res = await fetch(`/api/ads/ideas/${idea.id}/publish/youtube`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setYtError(data.message ?? data.error ?? "YouTube upload failed");
        return;
      }
      onIdeaUpdated(data.ads);
    } catch {
      setYtError("YouTube upload failed — check your connection and try again.");
    } finally {
      setYtUploading(false);
    }
  }

  async function refreshPerformance() {
    if (!idea) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/ads/ideas/${idea.id}/performance/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(data.message ?? data.error ?? "Refresh failed");
        if (data.error === "linkedin_permission_denied" || data.error === "no_automatic_source") {
          setManualOpen(true);
        }
        return;
      }
      onIdeaUpdated(data.ads);
    } catch {
      setRefreshError("Refresh failed — check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitManualPerformance() {
    if (!idea) return;
    setManualSubmitting(true);
    setRefreshError(null);
    try {
      const toNum = (v: string) => (v.trim() ? Number(v) : undefined);
      const res = await fetch(`/api/ads/ideas/${idea.id}/performance/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewCount: toNum(manualViews),
          likeCount: toNum(manualLikes),
          commentCount: toNum(manualComments),
          shareCount: toNum(manualShares),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(data.message ?? data.error ?? "Could not save stats");
        return;
      }
      onIdeaUpdated(data.ads);
      setManualViews("");
      setManualLikes("");
      setManualComments("");
      setManualShares("");
      setManualOpen(false);
    } catch {
      setRefreshError("Could not save stats — check your connection and try again.");
    } finally {
      setManualSubmitting(false);
    }
  }

  const canAutoRefresh =
    (idea.publishInfo?.platform === "LinkedIn" && idea.publishInfo.linkedInPostUrn) ||
    (idea.publishInfo?.platform === "YouTube" && idea.publishInfo.youtubeVideoId);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{idea.title}</h2>
        <div className="flex items-center gap-2">
          <AssignTaskButton
            entityType="ad_idea"
            entityId={idea.id}
            defaultTitle={idea.title}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
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
            Set your premise/constraints (locations, budget, props available) — used as a menu of
            what&apos;s available, not a checklist forced into every scene.
          </p>

          {contentPresets.length > 0 && (
            <select
              value={selectedPresetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="">Custom (write below)</option>
              {contentPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <textarea
            value={constraintsNotes}
            onChange={(e) => setConstraintsNotes(e.target.value)}
            placeholder="e.g. I only have a bedroom, no other locations, small budget, no actors besides me"
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Save these notes as a preset named…"
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={saveCurrentAsPreset}
              disabled={presetSaving || !newPresetName.trim() || !constraintsNotes.trim()}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Save as preset
            </button>
            {selectedPresetId && (
              <button
                type="button"
                onClick={() => deletePreset(selectedPresetId)}
                disabled={presetSaving}
                className="rounded-lg px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                Delete preset
              </button>
            )}
          </div>
          {presetError && <p className="mt-1 text-xs text-rose-700">{presetError}</p>}

          <div className="mt-2">
            <label className="text-xs text-slate-500">Time of day (sets natural light)</label>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              <option value="">Not specified</option>
              {TIME_OF_DAY_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

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
          <p className="text-sm font-medium text-slate-800">Publishing status</p>
          {idea.publishInfo ? (
            <div className="mt-2 text-xs text-slate-700">
              <p>
                Posted on <strong>{idea.publishInfo.platform}</strong>
                {idea.publishInfo.url && (
                  <>
                    {" — "}
                    <a href={idea.publishInfo.url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
                      view post
                    </a>
                  </>
                )}
              </p>
            </div>
          ) : !markPostedOpen ? (
            <button
              type="button"
              onClick={() => setMarkPostedOpen(true)}
              className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Mark as posted
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={markPostedPlatform}
                  onChange={(e) => setMarkPostedPlatform(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option>LinkedIn</option>
                  <option>Instagram</option>
                  <option>YouTube</option>
                  <option>X</option>
                  <option>Other</option>
                </select>
                <input
                  value={markPostedUrl}
                  onChange={(e) => setMarkPostedUrl(e.target.value)}
                  placeholder="Post URL (optional)"
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitMarkPosted}
                  disabled={markingPosted}
                  className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {markingPosted ? "Saving…" : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setMarkPostedOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
                <div>
                  <label className="text-xs text-slate-500">
                    Attach the final image/video (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setPublishFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs"
                  />
                </div>
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

        {idea.platform.toLowerCase() === "youtube" && (
          <section className="rounded-lg border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Publish to YouTube</p>
            {idea.publishInfo?.youtubeVideoId ? (
              <p className="mt-1 text-xs text-emerald-700">
                Uploaded —{" "}
                <a href={idea.publishInfo.url} target="_blank" rel="noopener noreferrer" className="underline">
                  view video
                </a>
              </p>
            ) : !ytOpen ? (
              <button
                type="button"
                onClick={() => setYtOpen(true)}
                className="mt-2 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-50"
              >
                Publish to YouTube
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setYtFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs"
                />
                <input
                  value={ytTitle}
                  onChange={(e) => setYtTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
                <textarea
                  value={ytDescription}
                  onChange={(e) => setYtDescription(e.target.value)}
                  rows={3}
                  placeholder="Description"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
                <select
                  value={ytPrivacy}
                  onChange={(e) => setYtPrivacy(e.target.value as typeof ytPrivacy)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={publishToYoutube}
                    disabled={ytUploading || !ytFile}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50"
                  >
                    {ytUploading ? "Uploading…" : "Upload & publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setYtOpen(false)}
                    disabled={ytUploading}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                {ytError && <p className="text-xs text-rose-700">{ytError}</p>}
              </div>
            )}
          </section>
        )}

        {idea.publishInfo && (
          <section className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-800">Performance</p>

            {idea.performanceHistory && idea.performanceHistory.length > 0 && (
              <div className="mt-2 space-y-2">
                {[...idea.performanceHistory].reverse().map((s) => (
                  <div key={s.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{new Date(s.fetchedAt).toLocaleString()}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        {s.source === "manual" ? "Manual" : s.source === "linkedin_api" ? "LinkedIn" : "YouTube"}
                      </span>
                    </div>
                    <MetricsTable metrics={s.metrics} />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {canAutoRefresh && (
                <button
                  type="button"
                  onClick={refreshPerformance}
                  disabled={refreshing}
                  className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {refreshing ? "Refreshing…" : `Refresh from ${idea.publishInfo.platform}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {manualOpen ? "Cancel manual entry" : "Add stats manually"}
              </button>
            </div>

            {refreshError && <p className="mt-2 text-xs text-rose-700">{refreshError}</p>}

            {manualOpen && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={manualViews}
                    onChange={(e) => setManualViews(e.target.value)}
                    placeholder="Views"
                    inputMode="numeric"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={manualLikes}
                    onChange={(e) => setManualLikes(e.target.value)}
                    placeholder="Likes"
                    inputMode="numeric"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={manualComments}
                    onChange={(e) => setManualComments(e.target.value)}
                    placeholder="Comments"
                    inputMode="numeric"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={manualShares}
                    onChange={(e) => setManualShares(e.target.value)}
                    placeholder="Shares"
                    inputMode="numeric"
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={submitManualPerformance}
                  disabled={manualSubmitting}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {manualSubmitting ? "Saving…" : "Save snapshot"}
                </button>
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
