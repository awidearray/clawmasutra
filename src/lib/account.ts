import { eq } from "drizzle-orm";
import type { AppDb } from "./db";
import { users } from "./schema";
import { logActivity } from "./activity";

export async function deleteAccount(db: AppDb, userId: string) {
  await logActivity(db, userId, "account_deleted", "Human deleted the account");
  await db.delete(users).where(eq(users.id, userId));
}
