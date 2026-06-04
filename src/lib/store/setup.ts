import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type {
  SetupRequirementsReport,
  SetupVerificationRecord,
} from "@/lib/setup/types";

const SETUP_KEY = "setup_requirements";

export async function getSetupVerification(): Promise<SetupVerificationRecord | null> {
  return getSnapshot<SetupVerificationRecord>(SETUP_KEY);
}

export async function isSetupComplete(): Promise<boolean> {
  const record = await getSetupVerification();
  return Boolean(record?.passedAt && record.report.allPassed);
}

export async function saveSetupVerification(
  report: SetupRequirementsReport,
): Promise<void> {
  const record: SetupVerificationRecord = {
    passedAt: new Date().toISOString(),
    report,
  };
  await saveSnapshot(SETUP_KEY, record);
}

export async function clearSetupVerification(): Promise<void> {
  await saveSnapshot(SETUP_KEY, {
    passedAt: "",
    report: { allPassed: false, checkedAt: "", checks: [] },
  });
}
