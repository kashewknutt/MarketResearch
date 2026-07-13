import { ENTITY_LABELS, type AssignmentEntityType } from "@/lib/store/assignments";
import { getProfilesByIds } from "@/lib/store/profiles";
import { sendMentionEmail } from "@/lib/email/mention-email";

export interface NotifyMentionedUsersParams {
  orgId: string;
  entityType: AssignmentEntityType;
  commentBody: string;
  authorUserId: string;
  authorName: string;
  mentionedUserIds: string[];
}

export async function notifyMentionedUsers(params: NotifyMentionedUsersParams): Promise<void> {
  const recipientIds = params.mentionedUserIds.filter((id) => id !== params.authorUserId);
  if (recipientIds.length === 0) return;

  const profiles = await getProfilesByIds(recipientIds);
  const tasksUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/tasks`;
  const entityTypeLabel = ENTITY_LABELS[params.entityType];

  await Promise.allSettled(
    profiles
      .filter((profile): profile is typeof profile & { email: string } => Boolean(profile.email))
      .map((profile) =>
        sendMentionEmail({
          to: profile.email,
          mentionerName: params.authorName,
          entityTypeLabel,
          commentBody: params.commentBody,
          tasksUrl,
        }),
      ),
  );
}
