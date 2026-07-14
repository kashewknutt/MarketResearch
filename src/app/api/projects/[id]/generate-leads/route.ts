import { NextRequest } from "next/server";
import { runProjectLeadContext } from "@/lib/research/stages/project-lead-context";
import { getProfile } from "@/lib/store/settings";
import { getProjectById } from "@/lib/store/projects";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await getProfile();
  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const result = await runProjectLeadContext(profile, id, (update) => {
          send({ type: "progress", ...update });
        });

        send({
          type: "complete",
          project: result.project,
          leads: result.newLeads,
          addedCount: result.newLeads.length,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not generate project leads";
        send({ type: "error", error: message, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
