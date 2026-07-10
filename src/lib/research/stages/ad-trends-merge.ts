import type { AdIdea, AdTrendsSnapshot, CompetitorAdActivity, TrendingAdExample } from "@/lib/types/domain";

const TRASH_RETENTION_DAYS = 30;

/** Ideas the user has trashed more than 30 days ago are dropped for good — the only place data actually gets deleted. */
export function purgeExpiredTrash(snapshot: AdTrendsSnapshot): AdTrendsSnapshot {
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const ideasForYou = snapshot.ideasForYou.filter((idea) => {
    if (!idea.deletedAt) return true;
    return new Date(idea.deletedAt).getTime() > cutoff;
  });
  if (ideasForYou.length === snapshot.ideasForYou.length) return snapshot;
  return { ...snapshot, ideasForYou };
}

function mergeExamplesById(existing: TrendingAdExample[], fresh: TrendingAdExample[]): TrendingAdExample[] {
  const seen = new Set(existing.map((e) => e.id));
  const additions = fresh.filter((e) => !seen.has(e.id));
  return [...existing, ...additions];
}

function mergeCompetitorActivity(
  existing: CompetitorAdActivity[],
  fresh: CompetitorAdActivity[],
): CompetitorAdActivity[] {
  const merged = existing.map((c) => {
    const freshMatch = fresh.find((f) => f.competitorName === c.competitorName);
    return freshMatch ? { ...c, examples: mergeExamplesById(c.examples, freshMatch.examples) } : c;
  });
  for (const f of fresh) {
    if (!merged.some((c) => c.competitorName === f.competitorName)) {
      merged.push(f);
    }
  }
  return merged;
}

/**
 * Combines a freshly generated AdTrendsSnapshot with whatever is already
 * saved, instead of replacing it outright. Every refresh/re-run should add
 * to the workspace, never wipe out ideas the user has already started
 * working on (status, generated content, publish info, performance
 * history) or trending examples already discovered.
 */
export function mergeAdTrendsSnapshot(
  existing: AdTrendsSnapshot | null,
  fresh: AdTrendsSnapshot,
): AdTrendsSnapshot {
  if (!existing) return fresh;

  const ideasForYou: AdIdea[] = [...existing.ideasForYou, ...fresh.ideasForYou];
  const trendingNow = mergeExamplesById(existing.trendingNow, fresh.trendingNow);
  const competitorActivity = mergeCompetitorActivity(existing.competitorActivity, fresh.competitorActivity);
  const discoveredCompetitors = Array.from(
    new Set([...existing.discoveredCompetitors, ...fresh.discoveredCompetitors]),
  );

  return purgeExpiredTrash({
    ...existing,
    ...fresh,
    trackedCompetitors: existing.trackedCompetitors,
    competitorSocialHandles: existing.competitorSocialHandles,
    contentPresets: existing.contentPresets,
    ideasForYou,
    trendingNow,
    competitorActivity,
    discoveredCompetitors,
  });
}
