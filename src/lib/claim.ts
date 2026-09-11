import { eq } from "drizzle-orm";
import { hashPassword, sha256 } from "./crypto";
import type { AppDb } from "./db";
import { badRequest, unauthorized } from "./errors";
import { users } from "./schema";
import { issueSession } from "./auth";
import { logActivity } from "./activity";

export async function claimAccount(
  db: AppDb,
  input: { token: string; email: string; password: string },
  now = new Date(),
) {
  const hash = sha256(input.token);
  const found = await db.select().from(users).where(eq(users.claimTokenHash, hash)).limit(1);
  const user = found[0];
  if (!user) throw unauthorized("Claim link is invalid");
  const emailTaken = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (emailTaken[0] && emailTaken[0].id !== user.id) throw badRequest("Email already in use");
  const passwordHash = await hashPassword(input.password);
  await db
    .update(users)
    .set({ email: input.email, passwordHash, claimTokenHash: null, updatedAt: now })
    .where(eq(users.id, user.id));
  await logActivity(db, user.id, "claimed", "Human claimed the claw-created account");
  const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0]!;
  return issueSession(db, fresh, now);
}
