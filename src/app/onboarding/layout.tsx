import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/store/setup";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setupDone = await isSetupComplete();
  if (!setupDone) {
    redirect("/setup");
  }
  return children;
}
