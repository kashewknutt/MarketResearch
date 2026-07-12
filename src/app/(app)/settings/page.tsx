"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RevenueGoalFields } from "@/components/revenue-goal-fields";
import { SocialLinksFields } from "@/components/social-links-fields";
import { PageLoading } from "@/components/ui/page-loading";
import { DEFAULT_REGIONS, type OnboardingProfile, type RegionCode } from "@/lib/types/domain";
import type { GeminiConnectionStatus } from "@/lib/ai/gemini";

function SettingsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<GeminiConnectionStatus | null>(
    null,
  );
  const [geminiMessage, setGeminiMessage] = useState<string>("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile));
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setGeminiStatus(d.gemini?.status ?? null);
        setGeminiMessage(d.gemini?.message ?? "");
      });
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
  };

  const rerunResearch = async () => {
    setResearchError(null);
    setSaving(true);
    const res = await fetch("/api/research/start", { method: "POST" });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setResearchError(data.message ?? "Research could not start.");
      return;
    }

    router.push(`/loading?jobId=${data.job.id}`);
  };

  const resetOnboarding = () => router.push("/onboarding");

  const recheckRequirements = async () => {
    await fetch("/api/setup/reset", { method: "POST" });
    router.push("/setup");
  };

  if (!profile) {
    return <PageLoading label="Loading settings…" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Settings</h1>
        {params.get("error") === "research" && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Research did not complete. Review the Gemini API status below and try again.
          </p>
        )}
      </header>

      <section className="rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-700">API status</h2>
        <p className="mt-2 text-sm text-slate-600">
          {geminiStatus === "ready"
            ? "Connected — research and project generation are available."
            : geminiMessage || "Checking API status…"}
        </p>
        {researchError && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {researchError}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Business profile</h2>
        {(
          [
            ["businessName", "Business name"],
            ["website", "Website"],
            ["serviceDomain", "Service domain"],
            ["targetAudience", "Target audience"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className="text-xs text-slate-500">{label}</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={profile[key]}
              onChange={(e) =>
                setProfile({ ...profile, [key]: e.target.value })
              }
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-slate-500">Regions</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.regions.map((r) => (
              <span key={r} className="rounded-full bg-sky-50 px-3 py-1 text-xs">
                {r}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-sky-600"
            onClick={() =>
              setProfile({
                ...profile,
                regions: [...DEFAULT_REGIONS] as RegionCode[],
              })
            }
          >
            Reset to US + India
          </button>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Social profiles</h3>
          <div className="mt-3">
            <SocialLinksFields
              links={profile.socialLinks ?? []}
              onChange={(links) => setProfile({ ...profile, socialLinks: links })}
            />
          </div>
        </div>
        <RevenueGoalFields
          values={{
            currency: profile.currency,
            currentMrr: profile.currentMrr,
            targetMrr: profile.targetMrr,
            goalMonths: profile.goalMonths,
          }}
          onChange={(v) =>
            setProfile({
              ...profile,
              currency: v.currency,
              currentMrr: v.currentMrr,
              targetMrr: v.targetMrr,
              goalMonths: v.goalMonths,
            })
          }
        />
      </section>

      <p className="text-xs text-slate-500">
        Re-run research to refresh leads, financial model, and campaign dossiers after
        profile or integration changes.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={() => void rerunResearch()}
          disabled={saving || geminiStatus !== "ready"}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Re-run research
        </button>
        <button
          type="button"
          onClick={resetOnboarding}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
        >
          Edit onboarding flow
        </button>
        <button
          type="button"
          onClick={() => void recheckRequirements()}
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          Re-run requirement checks
        </button>
      </div>

      <p className="text-xs text-slate-400">
        All data is stored locally. Market research requires a valid Gemini API key.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
