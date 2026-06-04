import { redirect } from "next/navigation";
import { isOnboardingComplete } from "@/lib/store/settings";
import { isSetupComplete } from "@/lib/store/setup";

export default async function Home() {
  if (await isOnboardingComplete()) {
    redirect("/dashboard");
  }
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }
  redirect("/onboarding");
}
