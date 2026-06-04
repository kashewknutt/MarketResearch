"use client";

import type { SocialLink } from "@/lib/types/domain";
import { SOCIAL_PLATFORMS } from "@/lib/types/domain";

const PLATFORM_FIELDS = SOCIAL_PLATFORMS.map((p) => ({
  platform: p,
  placeholder:
    p === "LinkedIn"
      ? "https://linkedin.com/company/..."
      : p === "X"
        ? "https://x.com/..."
        : `https://${p.toLowerCase()}.com/...`,
}));

export function getSocialUrl(links: SocialLink[], platform: string): string {
  return links.find((l) => l.platform === platform)?.url ?? "";
}

export function setSocialUrl(
  links: SocialLink[],
  platform: string,
  url: string,
): SocialLink[] {
  const trimmed = url.trim();
  const rest = links.filter((l) => l.platform !== platform);
  if (!trimmed) return rest;
  return [...rest, { platform, url: trimmed }];
}

export function SocialLinksFields({
  links,
  onChange,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Add every profile your company uses. These feed competitor research, social strategy,
        and lead finding.
      </p>
      {PLATFORM_FIELDS.map(({ platform, placeholder }) => (
        <div key={platform}>
          <label className="text-xs font-medium text-slate-500">{platform}</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={getSocialUrl(links, platform)}
            onChange={(e) => onChange(setSocialUrl(links, platform, e.target.value))}
            placeholder={placeholder}
          />
        </div>
      ))}
    </div>
  );
}
