import { and, eq, gt, isNull } from "drizzle-orm";
import { SESSION_COOKIE, SESSION_TTL_MS, isProduction } from "./config";
import { hashPassword, id, newAgentKey, newSessionToken, pairingCode, sha256, verifyPassword } from "./crypto";
import type { AppDb } from "./db";
import { badRequest, unauthorized } from "./errors";
import { agentKeys, pairingCodes, profiles, sessions, users } from "./schema";
import type { User } from "./schema";
import { logActivity } from "./activity";

export type Actor = {
  user: User;
  profile: typeof profiles.$inferSelect;
  via: "human" | "agent";
  agentKeyId?: string;
};

export async function createHuman(
  db: AppDb,
  input: { email: string; password: string; name: string; age: number },
  now = new Date(),
): Promise<{ user: User; profile: typeof profiles.$inferSelect }> {
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing[0]) throw badRequest("An account with that email already exists", "email_taken");
  const userId = id("usr");
  const profileId = id("prf");
  const user = {
    id: userId,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    name: input.name,
    age: input.age,
    ageConfirmedAt: now,
    claimTokenHash: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
  const profile = defaultProfile(profileId, userId, input.name, now);
  await db.insert(users).values(user);
  await db.insert(profiles).values(profile);
  await logActivity(db, userId, "account_created", "Human account created");
  const stored = (await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1))[0]!;
  return { user, profile: stored };
}

export function defaultProfile(
  profileId: string,
  userId: string,
  name: string,
  now: Date,
): typeof profiles.$inferInsert {
  return {
    id: profileId,
    userId,
    displayName: name,
    headline: "",
    bio: "",
    gender: "other",
    seeking: ["woman", "man", "nonbinary", "other"],
    city: "",
    region: "",
    country: "",
    latitude: null,
    longitude: null,
    photos: [],
    prompts: [],
    interests: [],
    lookingFor: "dating",
    heightCm: null,
    occupation: "",
    agentName: "",
    agentStyle: "",
    autonomySwipe: "guarded",
    autonomyMessage: "guarded",
    autonomyDate: "guarded",
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function loginHuman(
  db: AppDb,
  input: { email: string; password: string },
): Promise<{ user: User; token: string; expiresAt: Date }> {
  const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const user = found[0];
  if (!user?.passwordHash) throw unauthorized("Invalid email or password");
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid email or password");
  return issueSession(db, user);
}

export async function issueSession(db: AppDb, user: User, now = new Date()) {
  const { token, hash } = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: id("ses"),
    userId: user.id,
    tokenHash: hash,
    expiresAt,
    createdAt: now,
  });
  return { user, token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    expires: expiresAt,
  };
}

export async function actorFromSession(db: AppDb, token: string | undefined, now = new Date()): Promise<Actor | null> {
  if (!token) return null;
  const hash = sha256(token);
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, now)))
    .limit(1);
  const session = rows[0];
  if (!session) return null;
  return loadActor(db, session.userId, "human");
}

export async function actorFromAgentKey(db: AppDb, bearer: string | undefined, now = new Date()): Promise<Actor | null> {
  if (!bearer) return null;
  const token = bearer.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("cms_live_")) return null;
  const hash = sha256(token);
  const keys = await db
    .select()
    .from(agentKeys)
    .where(and(eq(agentKeys.tokenHash, hash), isNull(agentKeys.revokedAt)))
    .limit(1);
  const key = keys[0];
  if (!key) return null;
  await db.update(agentKeys).set({ lastSeenAt: now }).where(eq(agentKeys.id, key.id));
  const actor = await loadActor(db, key.userId, "agent");
  return actor ? { ...actor, agentKeyId: key.id } : null;
}

export async function loadActor(db: AppDb, userId: string, via: "human" | "agent"): Promise<Actor | null> {
  const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = found[0];
  if (!user) return null;
  const pr = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const profile = pr[0];
  if (!profile) return null;
  return { user, profile, via };
}

export async function issuePairingCode(db: AppDb, userId: string, now = new Date()) {
  const code = pairingCode();
  await db.insert(pairingCodes).values({
    id: id("pair"),
    userId,
    codeHash: sha256(code.toUpperCase()),
    codeDisplay: code,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    usedAt: null,
    createdAt: now,
  });
  return code;
}

export async function pairAgent(
  db: AppDb,
  input: { code: string; agentName: string },
  now = new Date(),
) {
  const normalized = input.code.trim().toUpperCase().replace(/\s+/g, "");
  const hash = sha256(normalized);
  const found = await db.select().from(pairingCodes).where(eq(pairingCodes.codeHash, hash)).limit(1);
  const row = found[0];
  if (!row || row.usedAt || row.expiresAt <= now) throw unauthorized("Pairing code is invalid or expired");
  await db.update(pairingCodes).set({ usedAt: now }).where(eq(pairingCodes.id, row.id));
  const key = newAgentKey();
  await db.insert(agentKeys).values({
    id: id("key"),
    userId: row.userId,
    name: input.agentName,
    tokenPrefix: key.prefix,
    tokenHash: key.hash,
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
  });
  await db.update(profiles).set({ agentName: input.agentName, updatedAt: now }).where(eq(profiles.userId, row.userId));
  await logActivity(db, row.userId, "claw_paired", `Claw paired as ${input.agentName}`);
  const actor = await loadActor(db, row.userId, "agent");
  if (!actor) throw unauthorized("Profile missing after pairing");
  return { apiKey: key.token, actor };
}

export async function revokeAgentKey(db: AppDb, userId: string, keyId: string, now = new Date()) {
  await db
    .update(agentKeys)
    .set({ revokedAt: now })
    .where(and(eq(agentKeys.id, keyId), eq(agentKeys.userId, userId)));
}

export async function listAgentKeys(db: AppDb, userId: string) {
  return db.select().from(agentKeys).where(eq(agentKeys.userId, userId));
}

export async function destroySession(db: AppDb, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}
