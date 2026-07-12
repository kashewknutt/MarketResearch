import { randomUUID } from "crypto";
import { and, eq, inArray, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { comments, commentMentions } from "@/lib/db/schema";
import { getProfilesByIds } from "@/lib/store/profiles";
import type { AssignmentEntityType } from "@/lib/store/assignments";

export type CommentEntityType = AssignmentEntityType;

export interface CommentAuthor {
  userId: string;
  fullName: string | null;
  email: string | null;
}

export interface CommentWithAuthor {
  id: string;
  orgId: string;
  entityType: CommentEntityType;
  entityId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  mentionedUserIds: string[];
}

export interface MentionEntry {
  commentId: string;
  orgId: string;
  entityType: CommentEntityType;
  entityId: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
}

async function attachAuthorsAndMentions(
  rows: (typeof comments.$inferSelect)[],
): Promise<CommentWithAuthor[]> {
  if (rows.length === 0) return [];

  const commentIds = rows.map((r) => r.id);
  const db = getDb();

  const [profiles, mentionRows] = await Promise.all([
    getProfilesByIds(rows.map((r) => r.authorUserId)),
    db
      .select()
      .from(commentMentions)
      .where(inArray(commentMentions.commentId, commentIds)),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const mentionsByComment = new Map<string, string[]>();
  for (const m of mentionRows) {
    const list = mentionsByComment.get(m.commentId) ?? [];
    list.push(m.mentionedUserId);
    mentionsByComment.set(m.commentId, list);
  }

  return rows.map((row) => {
    const profile = profileById.get(row.authorUserId);
    return {
      id: row.id,
      orgId: row.orgId,
      entityType: row.entityType as CommentEntityType,
      entityId: row.entityId,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: {
        userId: row.authorUserId,
        fullName: profile?.fullName ?? null,
        email: profile?.email ?? null,
      },
      mentionedUserIds: mentionsByComment.get(row.id) ?? [],
    };
  });
}

export async function createComment(
  orgId: string,
  entityType: CommentEntityType,
  entityId: string,
  authorUserId: string,
  body: string,
  mentionedUserIds: string[] = [],
): Promise<CommentWithAuthor> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(comments).values({
    id,
    orgId,
    entityType,
    entityId,
    authorUserId,
    body,
    createdAt: now,
    updatedAt: now,
  });

  const uniqueMentionedIds = [...new Set(mentionedUserIds)];
  if (uniqueMentionedIds.length > 0) {
    await db.insert(commentMentions).values(
      uniqueMentionedIds.map((mentionedUserId) => ({
        commentId: id,
        orgId,
        mentionedUserId,
      })),
    );
  }

  const [result] = await attachAuthorsAndMentions([
    {
      id,
      orgId,
      entityType,
      entityId,
      authorUserId,
      body,
      createdAt: now,
      updatedAt: now,
    },
  ]);
  return result;
}

export async function getComments(
  orgId: string,
  entityType: CommentEntityType,
  entityId: string,
): Promise<CommentWithAuthor[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.orgId, orgId),
        eq(comments.entityType, entityType),
        eq(comments.entityId, entityId),
      ),
    );

  const withAuthors = await attachAuthorsAndMentions(rows);
  return withAuthors.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getMentionsForUser(
  orgId: string,
  userId: string,
): Promise<MentionEntry[]> {
  const db = getDb();
  const mentionRows = await db
    .select()
    .from(commentMentions)
    .where(and(eq(commentMentions.orgId, orgId), eq(commentMentions.mentionedUserId, userId)));

  if (mentionRows.length === 0) return [];

  const commentIds = mentionRows.map((m) => m.commentId);
  const commentRows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.orgId, orgId), inArray(comments.id, commentIds)))
    .orderBy(desc(comments.createdAt));

  const profiles = await getProfilesByIds(commentRows.map((r) => r.authorUserId));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return commentRows.map((row) => {
    const profile = profileById.get(row.authorUserId);
    return {
      commentId: row.id,
      orgId: row.orgId,
      entityType: row.entityType as CommentEntityType,
      entityId: row.entityId,
      body: row.body,
      createdAt: row.createdAt,
      author: {
        userId: row.authorUserId,
        fullName: profile?.fullName ?? null,
        email: profile?.email ?? null,
      },
    };
  });
}
