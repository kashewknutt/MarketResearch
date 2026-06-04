"use client";

import { useEffect, useState } from "react";

interface Citation {
  title: string;
  uri?: string;
  from: string;
}

interface AiLog {
  id: number;
  task: string;
  createdAt: string;
}

export default function ResearchSourcesPage() {
  const [citations, setCitations] = useState<Citation[]>([]);
  const [logs, setLogs] = useState<AiLog[]>([]);

  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => {
        setCitations(d.citations ?? []);
        setLogs(d.logs ?? []);
      });
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Research Sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Citations from Google Search grounding and AI research logs.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Citations</h2>
        {citations.length === 0 ? (
          <p className="text-sm text-slate-400">
            No citations yet. Complete a successful research run with a valid Gemini API key.
          </p>
        ) : (
          <ul className="space-y-2">
            {citations.map((c, i) => (
              <li
                key={`${c.from}-${i}`}
                className="rounded-lg border border-slate-100 px-4 py-3 text-sm"
              >
                <span className="text-xs text-slate-400">{c.from}</span>
                <p className="font-medium text-slate-800">{c.title}</p>
                {c.uri && (
                  <a
                    href={c.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-600 hover:underline"
                  >
                    {c.uri}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">AI activity log</h2>
        <ul className="space-y-1 text-xs text-slate-500">
          {logs.map((log) => (
            <li key={log.id} className="rounded bg-slate-50 px-3 py-2">
              {log.task} — {new Date(log.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
