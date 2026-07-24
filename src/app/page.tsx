import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

const FAQS = [
  {
    question: "Who is Northstar for?",
    answer:
      "Service-based companies and teams who need a single, current picture of demand, pipeline, financials, and marketing performance instead of stitching it together across spreadsheets and tools.",
  },
  {
    question: "Is my organization's data private?",
    answer:
      "Yes. Every project, lead, and financial model is scoped to your organization. Other organizations on Northstar can never see it.",
  },
  {
    question: "How does the research stay current?",
    answer:
      "Northstar uses Google's Gemini with live Google Search grounding, plus direct integrations with Reddit, LinkedIn, YouTube, and Apify, so demand signals and performance numbers refresh from real sources on demand.",
  },
  {
    question: "Do you sell my data?",
    answer:
      "No. We don't sell your personal information or your organization's data. See our Privacy Policy for the full details.",
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

function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/70 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-violet-700">
          <Image
            src="/northstar-logo.png"
            alt="Northstar logo"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          Northstar
        </span>
        <div className="hidden items-center gap-8 text-sm text-slate-500 sm:flex">
          <a href="#features" className="hover:text-slate-800">
            Features
          </a>
          <a href="#integrations" className="hover:text-slate-800">
            Integrations
          </a>
          <a href="#faq" className="hover:text-slate-800">
            FAQ
          </a>
        </div>
        {isAuthenticated ? (
          <Link
            href="/tasks"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            Go to dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 via-white to-violet-50/30">
      <LandingNav isAuthenticated={isAuthenticated} />

      <section className="relative flex min-h-[calc(100vh-65px)] flex-col items-center justify-center overflow-hidden px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-200/40 blur-3xl"
        />

        <div className="relative w-full max-w-2xl text-center">
          <Image
            src="/northstar-logo.png"
            alt="Northstar logo"
            width={72}
            height={72}
            className="mx-auto rounded-2xl shadow-sm"
            priority
          />
          <span className="mt-6 inline-flex items-center rounded-full bg-violet-100 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-violet-700">
            Northstar
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-800 sm:text-6xl">
            Market research and business planning software for service companies.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Northstar is a web app that researches market demand for your
            business, tracks the leads and projects it finds, models the
            financial outcome, and helps you plan and run marketing around
            it, all from one dashboard tied to your account.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isAuthenticated ? (
              <Link
                href="/tasks"
                className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
                >
                  Get started
                </Link>
                <p className="text-xs text-slate-400">
                  Sign in with Google to continue.
                </p>
              </>
            )}
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
          What is Northstar?
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Northstar is a market research and business planning platform built
          for service-based companies. It automatically researches demand for
          your services in a given market, using live data from Google
          Search, Reddit, LinkedIn, YouTube, and Apify. It then helps you
          track the leads and projects that research surfaces, model the
          revenue, expenses, and profit each one could produce, and plan the
          marketing needed to win them. Every organization&apos;s data is
          private to its own account.
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

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24">
        <h2 className="text-center text-sm font-medium uppercase tracking-wide text-violet-600">
          Frequently asked questions
        </h2>
        <div className="mt-8 space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <h3 className="text-sm font-semibold text-slate-800">
                {faq.question}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 text-center">
        <Link
          href={isAuthenticated ? "/tasks" : "/login"}
          className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          {isAuthenticated ? "Go to dashboard" : "Get started"}
        </Link>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600 hover:underline">
            Privacy Policy
          </Link>
          <span className="h-3 w-px bg-slate-200" />
          <Link href="/terms" className="hover:text-slate-600 hover:underline">
            Terms of Service
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-400">
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

  return <LandingPage isAuthenticated={isAuthenticated} />;
}
