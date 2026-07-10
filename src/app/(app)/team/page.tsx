"use client";

import { useCallback, useEffect, useState } from "react";

interface OrgMember {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

interface OrgResponse {
  org: { id: string; name: string; slug: string } | null;
  role: "owner" | "member";
  currentUserId?: string;
  members: OrgMember[] | null;
}

export default function TeamPage() {
  const [data, setData] = useState<OrgResponse | null>(null);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((d) => setData(d));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMember = async () => {
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? "Could not add that person");
      }
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that person");
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/org/members/${userId}`, { method: "DELETE" });
    load();
  };

  if (!data) {
    return <p className="text-sm text-slate-500">Loading team…</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.org?.name ?? "Your organization"} · {data.role === "owner" ? "Owner" : "Member"}
        </p>
      </header>

      {data.role === "owner" && (
        <div className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-sm font-medium text-slate-800">Add a team member</p>
          <p className="mt-1 text-xs text-slate-500">
            They must have already signed in with Google at least once.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={addMember}
              disabled={adding || !email.trim()}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
        </div>
      )}

      {data.members && (
        <div className="rounded-xl border border-slate-100 bg-white">
          {data.members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between border-b border-slate-50 px-5 py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {m.fullName ?? m.email ?? m.userId}
                </p>
                <p className="text-xs text-slate-500">{m.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {m.role === "owner" ? "Owner" : "Member"}
                </span>
                {data.role === "owner" && m.userId !== data.currentUserId && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.userId)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
