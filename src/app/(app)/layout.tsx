import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isOnboardingComplete } from "@/lib/store/settings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const complete = await isOnboardingComplete();
  if (!complete) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
