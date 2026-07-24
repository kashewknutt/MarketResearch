import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/70 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-700"
        >
          <Image
            src="/northstar-logo.png"
            alt="Northstar logo"
            width={28}
            height={28}
            className="rounded-md"
          />
          Northstar
        </Link>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <LegalHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-800">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: {updated}</p>
        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-slate-600">
          {children}
        </div>
      </main>
      <footer className="border-t border-slate-100 px-6 py-8 text-center">
        <p className="text-xs text-slate-400">
          Created and maintained by{" "}
          <a
            href="https://valnee.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-600 hover:text-violet-700 hover:underline"
          >
            Valnee Solutions
          </a>
        </p>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
