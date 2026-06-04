"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GeminiFallback } from "@/components/gemini-fallback";
import type { ResearchJob } from "@/lib/types/domain";

function LoadingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("jobId");
  const [job, setJob] = useState<ResearchJob | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      const res = await fetch(`/api/research/status?id=${jobId}`);
      const data = await res.json();
      setJob(data.job);
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [jobId]);

  useEffect(() => {
    if (job?.status === "completed") {
      router.push("/dashboard");
    }
  }, [job?.status, router]);

  const completed = job?.stages.filter((s) => s.status === "completed").length ?? 0;
  const total = job?.stages.length ?? 6;
  const pct = Math.round((completed / total) * 100);
  const failedStage = job?.stages.find((s) => s.status === "failed");

  if (job?.status === "failed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-rose-50/30 to-white px-6 py-12">
        <div className="w-full max-w-lg space-y-6">
          <div className="rounded-2xl border border-rose-100 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">Research stopped</h1>
            <p className="mt-2 text-sm text-slate-600">
              {failedStage?.error ??
                "Research could not complete. Check your Gemini API key and try again."}
            </p>
            {failedStage && (
              <p className="mt-2 text-xs text-slate-400">
                Failed at: {failedStage.label}
              </p>
            )}
            <Link
              href="/settings"
              className="mt-6 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
            >
              Open Settings
            </Link>
          </div>
          <GeminiFallback title="Fix Gemini API to continue" verify />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50/50 to-white px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">Research in progress</h1>
        <p className="mt-2 text-sm text-slate-500">
          Running market research, projections, and recommendations in parallel where possible.
        </p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">{pct}% complete</p>
        <ul className="mt-6 space-y-3">
          {job?.stages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  stage.status === "completed"
                    ? "bg-emerald-400"
                    : stage.status === "running"
                      ? "bg-violet-400 animate-pulse"
                      : stage.status === "failed"
                        ? "bg-rose-400"
                        : "bg-slate-200"
                }`}
              />
              <span className="min-w-0 flex-1 text-slate-700">{stage.label}</span>
              {stage.error ? (
                <span className="text-xs text-rose-600">{stage.error}</span>
              ) : stage.message ? (
                <span className="text-xs text-slate-400">{stage.message}</span>
              ) : null}
            </li>
          )) ?? (
            <li className="text-sm text-slate-400">Initializing…</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function LoadingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <LoadingContent />
    </Suspense>
  );
}
