"use client";

import { CitationList } from "@/components/ui/citation-list";
import type { AdIdea, TrendingAdExample } from "@/lib/types/domain";

interface AdIdeaDetailSheetProps {
  idea: AdIdea | null;
  onClose: () => void;
}

export function AdIdeaDetailSheet({ idea, onClose }: AdIdeaDetailSheetProps) {
  if (!idea) return null;

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
        <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">
          {idea.platform} · {idea.format.replace("_", " ")} · {idea.priority}
        </span>

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

        {idea.inspiredBy && (
          <section>
            <p className="text-sm font-medium text-slate-800">Inspired by</p>
            <p className="mt-1 text-xs text-slate-600">{idea.inspiredBy}</p>
          </section>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={idea.provenance.citations} />
        </section>
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
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
            example.isOwnBrand ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
          }`}
        >
          {example.isOwnBrand ? "Your brand" : example.brandName} · {example.platform} ·{" "}
          {example.format.replace("_", " ")}
        </span>

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

        {example.engagementSignal && (
          <p className="text-sm font-semibold text-violet-700">{example.engagementSignal}</p>
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
