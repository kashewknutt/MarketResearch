"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GeminiFallback } from "@/components/gemini-fallback";
import type { ResearchJob } from "@/lib/types/domain";

const POLL_MS = 3000;

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function LoadingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const jobId = params.get("jobId");
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/research/status?id=${jobId}`);
        const data = await res.json();
        if (cancelled) return;
        const next = data.job as ResearchJob | null;
        setJob(next);

        if (next?.status === "completed" || next?.status === "failed") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        /* keep polling on transient errors */
      }
    };

    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId]);

  useEffect(() => {
    if (job?.status === "completed") {
      router.push("/dashboard");
    }
  }, [job?.status, router]);

  useEffect(() => {
    if (!job?.startedAt || job.status !== "running") return;
    const start = new Date(job.startedAt).getTime();
    const tick = () =>
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job?.startedAt, job?.status]);

  const completed = job?.stages.filter((s) => s.status === "completed").length ?? 0;
  const total = job?.stages.length ?? 1;
  const pct = Math.round((completed / total) * 100);
  const failedStage = job?.stages.find((s) => s.status === "failed");
  const runningStage = job?.stages.find((s) => s.status === "running");
  const isSlow = elapsedSec > 120 && job?.status === "running";

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
          The app checks progress every few seconds — repeated{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">/api/research/status</code>{" "}
          lines in the terminal are normal, not a hang.
        </p>
        {runningStage && (
          <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
            Current step: <strong>{runningStage.label}</strong>
            {job?.startedAt && (
              <span className="mt-1 block text-xs font-normal text-violet-700">
                Elapsed {formatElapsed(elapsedSec)}
              </span>
            )}
          </p>
        )}
        {isSlow && (
          <p className="mt-2 text-xs text-amber-700">
            This step calls Gemini (and sometimes LinkedIn/Reddit). Large profiles can
            take 5–15+ minutes. Leave this page open; it will redirect when finished.
          </p>
        )}
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {completed} of {total} stages ({pct}%)
        </p>
        <ul className="mt-6 max-h-64 space-y-3 overflow-y-auto">
          {job?.stages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  stage.status === "completed"
                    ? "bg-emerald-400"
                    : stage.status === "running"
                      ? "animate-pulse bg-violet-400"
                      : stage.status === "failed"
                        ? "bg-rose-400"
                        : "bg-slate-200"
                }`}
              />
              <span className="min-w-0 flex-1 text-slate-700">{stage.label}</span>
              {stage.error ? (
                <span className="text-xs text-rose-600">{stage.error}</span>
              ) : stage.message && stage.status !== "pending" ? (
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
