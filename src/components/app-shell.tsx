"use client";

import { useEffect, useState } from "react";
import { AppTopBar } from "@/components/app-top-bar";
import { GeminiFallback } from "@/components/gemini-fallback";
import { Sidebar } from "@/components/sidebar";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import type { MarketProject } from "@/lib/types/domain";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [businessName, setBusinessName] = useState<string>();
  const [selectedProject, setSelectedProject] = useState<MarketProject | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.businessName) setBusinessName(d.profile.businessName);
      });
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MarketProject>).detail;
      setSelectedProject(detail);
    };
    window.addEventListener("open-project", handler);
    return () => window.removeEventListener("open-project", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar businessName={businessName} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-6">
            <GeminiFallback compact verify />
          </div>
          {children}
        </main>
      </div>
      <ProjectDetailSheet
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdated={(p) => setSelectedProject(p)}
      />
    </div>
  );
}

export function openProject(project: MarketProject) {
  window.dispatchEvent(new CustomEvent("open-project", { detail: project }));
}
