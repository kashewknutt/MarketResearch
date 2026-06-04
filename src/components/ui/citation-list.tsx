import type { Citation } from "@/lib/types/domain";

export function CitationList({
  citations,
  compact = false,
}: {
  citations: Citation[];
  compact?: boolean;
}) {
  if (!citations?.length) {
    return (
      <p className="text-xs text-amber-700">No traceable source linked.</p>
    );
  }

  return (
    <ul className={compact ? "space-y-1" : "mt-2 space-y-2"}>
      {citations.map((c, i) => (
        <li key={`${c.title}-${i}`} className="text-xs text-slate-600">
          {c.uri ? (
            <a
              href={c.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-700 underline"
            >
              {c.title}
            </a>
          ) : (
            <span>{c.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
