import { defaultProfile } from "./auth";
import { logActivity } from "./activity";
import { id, newAgentKey, randomToken, sha256 } from "./crypto";
import type { AppDb } from "./db";
import { badRequest } from "./errors";
import { agentKeys, profiles, users } from "./schema";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { agentRegisterInput } from "./validate";

export async function registerAgent(
  db: AppDb,
  input: z.infer<typeof agentRegisterInput>,
  now = new Date(),
) {
  if (input.human.email) {
    const taken = await db.select().from(users).where(eq(users.email, input.human.email)).limit(1);
    if (taken[0]) throw badRequest("That email is already claimed", "email_taken");
  }
  const userId = id("usr");
  const profileId = id("prf");
  const claimToken = `cms_claim_${randomToken(18)}`;
  const user = {
    id: userId,
    email: input.human.email ?? null,
    passwordHash: null as string | null,
    name: input.human.name,
    age: input.human.age,
    ageConfirmedAt: now,
    claimTokenHash: sha256(claimToken),
    createdAt: now,
    updatedAt: now,
  };
  const profile = {
    ...defaultProfile(profileId, userId, input.human.name, now),
    gender: input.human.gender,
    seeking: input.human.seeking,
    city: input.human.city ?? "",
    bio: input.human.bio ?? "",
    interests: input.human.interests ?? [],
    lookingFor: input.human.lookingFor ?? "dating",
    photos: input.human.photos ?? [],
    prompts: input.human.prompts ?? [],
    agentName: input.agentName,
    agentStyle: input.agentStyle ?? "",
    isPublished: Boolean(
      (input.human.bio && input.human.bio.length >= 8) || (input.human.prompts && input.human.prompts.length > 0),
    ),
  };
  const key = newAgentKey();
  await db.insert(users).values(user);
  await db.insert(profiles).values(profile);
  await db.insert(agentKeys).values({
    id: id("key"),
    userId,
    name: input.agentName,
    tokenPrefix: key.prefix,
    tokenHash: key.hash,
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
  });
  await logActivity(db, userId, "agent_registered", `Claw ${input.agentName} registered the human`, {}, now);
  return {
    apiKey: key.token,
    claimToken: user.email ? null : claimToken,
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      isPublished: profile.isPublished,
    },
  };
}
