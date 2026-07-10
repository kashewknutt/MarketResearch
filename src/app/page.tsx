import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOnboardingComplete } from "@/lib/store/settings";
import { isSetupComplete } from "@/lib/store/setup";

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50/40 via-white to-violet-50/30 px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          Market Research
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-800">
          Understand your market before you build.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          Demand signals, project opportunities, financial projections, and
          ad performance — researched, tracked, and kept up to date in one
          place.
        </p>

        <Link
          href="/login"
          className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
        >
          Get started
        </Link>

        <p className="mt-3 text-xs text-slate-400">
          Sign in with Google to continue.
        </p>
      </div>
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
