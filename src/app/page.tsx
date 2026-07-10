import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOnboardingComplete } from "@/lib/store/settings";
import { isSetupComplete } from "@/lib/store/setup";

const FEATURES = [
  {
    title: "Dashboard",
    description:
      "One overview of demand, active projects, and where things stand right now.",
  },
  {
    title: "Projects",
    description: "Every opportunity worth pursuing, ranked and organized by region.",
  },
  {
    title: "Leads",
    description: "Track prospects from first contact all the way through to close.",
  },
  {
    title: "Financial Analysis",
    description: "Model revenue, expenses, and profit scenarios for each region.",
  },
  {
    title: "Marketing",
    description: "Plan campaigns and messaging by segment and channel.",
  },
  {
    title: "Ads & Content",
    description: "Generate ad ideas, publish them, and watch how each one performs.",
  },
  {
    title: "Strategy",
    description: "See the bigger picture: positioning, pricing, and where to focus next.",
  },
  {
    title: "Investment Planner",
    description: "Plan funding needs and runway against your growth targets.",
  },
  {
    title: "Research Sources",
    description: "Every citation behind every claim, always one click away.",
  },
];

const INTEGRATIONS = [
  {
    name: "Gemini",
    description: "Research backed by live Google Search results, not guesses.",
  },
  {
    name: "Reddit",
    description: "Pull real conversations and sentiment straight from the source.",
  },
  {
    name: "LinkedIn",
    description: "Publish content and pull real performance stats for posts and ads.",
  },
  {
    name: "YouTube",
    description: "Fetch trending videos and publish new ones directly to your channel.",
  },
  {
    name: "Apify",
    description: "Verified, real engagement numbers from Instagram and LinkedIn.",
  },
];

function LandingNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/70 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-violet-700">
          Northstar
        </span>
        <div className="hidden items-center gap-8 text-sm text-slate-500 sm:flex">
          <a href="#features" className="hover:text-slate-800">
            Features
          </a>
          <a href="#integrations" className="hover:text-slate-800">
            Integrations
          </a>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-white to-violet-50/30">
      <LandingNav />

      <section className="relative flex min-h-[calc(100vh-65px)] flex-col items-center justify-center overflow-hidden px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-200/40 blur-3xl"
        />

        <div className="relative w-full max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-violet-100 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-violet-700">
            Northstar
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-800 sm:text-6xl">
            One clear guide through every market decision.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Demand signals, project opportunities, financial projections, and
            ad performance, researched, tracked, and kept current, all in one
            place.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
            >
              Get started
            </Link>
            <p className="text-xs text-slate-400">
              Sign in with Google to continue.
            </p>
          </div>

          <div className="mt-16 flex items-center justify-center gap-6 text-xs text-slate-400 sm:gap-10">
            <span>9 focused workspaces</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>5 live integrations</span>
            <span className="h-3 w-px bg-slate-200" />
            <span>Real time Google Search grounding</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-24 text-center">
        <h2 className="text-sm font-medium uppercase tracking-wide text-violet-600">
          What it does
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Northstar turns scattered signals into one clear picture. It finds
          demand, tracks the leads and projects worth pursuing, models the
          financial upside, and keeps a pulse on how your ads are doing.
          Everything refreshes on demand and stays tied to your own account.
        </p>
      </section>

      <section id="features" className="mx-auto max-w-4xl scroll-mt-20 px-6 pb-24">
        <h2 className="text-center text-sm font-medium uppercase tracking-wide text-violet-600">
          Features
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-100 bg-white p-5"
            >
              <h3 className="text-sm font-semibold text-slate-800">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="integrations" className="mx-auto max-w-4xl scroll-mt-20 px-6 pb-24">
        <h2 className="text-center text-sm font-medium uppercase tracking-wide text-violet-600">
          Integrations
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="rounded-2xl border border-slate-100 bg-white p-5"
            >
              <h3 className="text-sm font-semibold text-slate-800">
                {integration.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {integration.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 text-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          Get started
        </Link>
      </section>

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

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  if (await isOnboardingComplete()) {
    redirect("/dashboard");
  }
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }
  redirect("/onboarding");
}
