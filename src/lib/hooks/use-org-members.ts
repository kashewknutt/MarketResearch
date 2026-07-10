"use client";

import { useEffect, useState } from "react";

export interface OrgMemberOption {
  userId: string;
  role: "owner" | "member";
  email: string | null;
  fullName: string | null;
}

interface OrgMembersState {
  role: "owner" | "member" | null;
  members: OrgMemberOption[];
  loading: boolean;
}

let cache: { role: "owner" | "member"; members: OrgMemberOption[] } | null = null;
let inflight: Promise<{ role: "owner" | "member"; members: OrgMemberOption[] }> | null = null;

async function loadOrgMembers() {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch("/api/org")
      .then((res) => res.json())
      .then((body) => {
        const result = {
          role: (body.role ?? "member") as "owner" | "member",
          members: (body.members ?? []) as OrgMemberOption[],
        };
        cache = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Fetches the org's role/member list once per page session (module-level cache). */
export function useOrgMembers(): OrgMembersState {
  const [state, setState] = useState<OrgMembersState>(() =>
    cache ? { role: cache.role, members: cache.members, loading: false } : { role: null, members: [], loading: true },
  );

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadOrgMembers().then((result) => {
      if (cancelled) return;
      setState({ role: result.role, members: result.members, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
