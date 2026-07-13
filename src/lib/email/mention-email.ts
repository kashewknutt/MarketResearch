import { getResendClient } from "@/lib/email/resend-client";

export interface MentionEmailParams {
  to: string;
  mentionerName: string;
  entityTypeLabel: string;
  commentBody: string;
  tasksUrl: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSubject(params: MentionEmailParams): string {
  return `${params.mentionerName} mentioned you in a ${params.entityTypeLabel} comment`;
}

function buildHtml(params: MentionEmailParams): string {
  return `
    <div style="font-family: sans-serif; font-size: 14px; color: #111;">
      <p><strong>${escapeHtml(params.mentionerName)}</strong> mentioned you in a ${escapeHtml(
        params.entityTypeLabel,
      )} comment:</p>
      <blockquote style="margin: 12px 0; padding: 8px 12px; border-left: 3px solid #7c3aed; background: #f5f3ff;">
        ${escapeHtml(params.commentBody)}
      </blockquote>
      <p><a href="${params.tasksUrl}" style="color: #7c3aed;">View in app</a></p>
    </div>
  `;
}

function buildText(params: MentionEmailParams): string {
  return `${params.mentionerName} mentioned you in a ${params.entityTypeLabel} comment:\n\n${params.commentBody}\n\nView in app: ${params.tasksUrl}`;
}

export async function sendMentionEmail(params: MentionEmailParams): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set, skipping mention email to", params.to);
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: params.to,
      subject: buildSubject(params),
      html: buildHtml(params),
      text: buildText(params),
    });
  } catch (err) {
    console.error("[email] failed to send mention email", err);
  }
}
