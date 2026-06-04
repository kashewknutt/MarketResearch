"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RevenueGoalFields } from "@/components/revenue-goal-fields";
import { SocialLinksFields } from "@/components/social-links-fields";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { DEFAULT_REGIONS, type OnboardingProfile, type RegionCode } from "@/lib/types/domain";

const STEPS = ["Business", "Online presence", "Market", "Financials", "Goals"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardingProfile>({
    businessName: "",
    website: "",
    serviceDomain: "",
    targetAudience: "",
    regions: [...DEFAULT_REGIONS],
    socialLinks: [],
    currency: DEFAULT_CURRENCY,
    currentMrr: 0,
    targetMrr: 0,
    goalMonths: 12,
    strategicGoals: "",
    constraints: "",
  });
  const [regionInput, setRegionInput] = useState("");

  const update = <K extends keyof OnboardingProfile>(
    key: K,
    value: OnboardingProfile[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const addRegion = () => {
    const r = regionInput.trim();
    if (r && !form.regions.includes(r)) {
      update("regions", [...form.regions, r as RegionCode]);
      setRegionInput("");
    }
  };

  const removeRegion = (r: RegionCode) => {
    if (form.regions.length > 1) {
      update(
        "regions",
        form.regions.filter((x) => x !== r),
      );
    }
  };

  const submit = async () => {
    setApiError(null);
    setSaving(true);

    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const res = await fetch("/api/research/start", { method: "POST" });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setApiError(data.message ?? "Could not start research.");
      return;
    }

    router.push(`/loading?jobId=${data.job.id}`);
  };

  const canNext =
    step === 0
      ? form.businessName && form.serviceDomain
      : step === 1
        ? true
        : step === 2
          ? form.targetAudience && form.regions.length > 0
          : step === 3
            ? form.currentMrr >= 0 && form.targetMrr > 0
            : form.goalMonths >= 1 && form.goalMonths <= 50;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-white px-6 py-12">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-400">
          Welcome
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-800">
          Set up your market research
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Tell us about your service business. Defaults: US & India.
        </p>

        <div className="mt-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-violet-300" : "bg-slate-100"}`}
            />
          ))}
        </div>

        <div className="mt-8 space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {step === 0 && (
            <>
              <Field label="Business name" value={form.businessName} onChange={(v) => update("businessName", v)} />
              <Field label="Website" value={form.website} onChange={(v) => update("website", v)} placeholder="https://" />
              <Field label="Service domain" value={form.serviceDomain} onChange={(v) => update("serviceDomain", v)} placeholder="e.g. IT consulting, legal, design" />
            </>
          )}
          {step === 1 && (
            <SocialLinksFields
              links={form.socialLinks}
              onChange={(links) => update("socialLinks", links)}
            />
          )}
          {step === 2 && (
            <>
              <Field label="Target audience" value={form.targetAudience} onChange={(v) => update("targetAudience", v)} />
              <div>
                <label className="text-xs font-medium text-slate-500">Regions</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.regions.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-800"
                    >
                      {r}
                      <button type="button" onClick={() => removeRegion(r)} className="text-sky-500 hover:text-sky-700">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={regionInput}
                    onChange={(e) => setRegionInput(e.target.value)}
                    placeholder="Add region"
                  />
                  <button type="button" onClick={addRegion} className="rounded-lg bg-slate-100 px-3 text-sm">Add</button>
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <RevenueGoalFields
              values={{
                currency: form.currency,
                currentMrr: form.currentMrr,
                targetMrr: form.targetMrr,
                goalMonths: form.goalMonths,
              }}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  currency: v.currency,
                  currentMrr: v.currentMrr,
                  targetMrr: v.targetMrr,
                  goalMonths: v.goalMonths,
                }))
              }
            />
          )}
          {step === 4 && (
            <>
              <Field label="Strategic goals" value={form.strategicGoals} onChange={(v) => update("strategicGoals", v)} multiline />
              <Field label="Constraints (optional)" value={form.constraints} onChange={(v) => update("constraints", v)} multiline />
            </>
          )}
        </div>

        {apiError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {apiError}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 disabled:opacity-40"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg bg-violet-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext || saving}
              onClick={() => void submit()}
              className="rounded-lg bg-violet-500 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {saving ? "Starting…" : "Start research"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {multiline ? (
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : (
        <input
          type={type}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
