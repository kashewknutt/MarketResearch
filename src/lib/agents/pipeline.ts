import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { researchArtifacts } from "@/lib/db/schema";

export interface PipelineStep<TCtx> {
  id: string;
  label: string;
  run: (ctx: TCtx) => Promise<TCtx>;
}

export interface PipelineOptions<TCtx> {
  jobId?: string;
  stageId?: string;
  onStepComplete?: (stepId: string, ctx: TCtx) => void;
}

export async function runPipeline<TCtx>(
  steps: Array<PipelineStep<TCtx>>,
  initialCtx: TCtx,
  options: PipelineOptions<TCtx> = {},
): Promise<TCtx> {
  let ctx = initialCtx;

  for (const step of steps) {
    ctx = await step.run(ctx);
    options.onStepComplete?.(step.id, ctx);

    if (options.jobId && options.stageId) {
      const db = getDb();
      await db.insert(researchArtifacts).values({
        id: randomUUID(),
        jobId: options.jobId,
        stageId: options.stageId,
        stepId: step.id,
        data: JSON.stringify({ label: step.label, at: new Date().toISOString() }),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return ctx;
}
