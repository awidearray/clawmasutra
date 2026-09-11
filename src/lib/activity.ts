import { desc, eq } from "drizzle-orm";
import { id } from "./crypto";
import type { AppDb } from "./db";
import { activity } from "./schema";

export async function logActivity(
  db: AppDb,
  userId: string,
  type: string,
  summary: string,
  payload: Record<string, unknown> = {},
  now = new Date(),
) {
  await db.insert(activity).values({
    id: id("act"),
    userId,
    type,
    summary,
    payload,
    createdAt: now,
  });
}

export async function recentActivity(db: AppDb, userId: string, limit = 40) {
  return db.select().from(activity).where(eq(activity.userId, userId)).orderBy(desc(activity.createdAt)).limit(limit);
}
