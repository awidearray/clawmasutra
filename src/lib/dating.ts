import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { logActivity } from "./activity";
import type { Actor } from "./auth";
import { DAILY_LIKE_CAP } from "./config";
import { id } from "./crypto";
import type { AppDb } from "./db";
import { badRequest, conflict, forbidden, notFound, tooMany } from "./errors";
import {
  approvals,
  blocks,
  dateProposals,
  matches,
  messages,
  profiles,
  swipes,
  type Profile,
} from "./schema";
import { containsContact, profileInput } from "./validate";
import type { z } from "zod";

export async function updateProfile(db: AppDb, actor: Actor, patch: z.infer<typeof profileInput>, now = new Date()) {
  const next = { ...patch, updatedAt: now };
  if (next.isPublished) {
    const merged = { ...actor.profile, ...patch };
    if (!merged.displayName || !merged.gender || !merged.seeking?.length) {
      throw badRequest("Publish requires a name, gender, and who you seek");
    }
    if (!merged.bio && !(merged.prompts && merged.prompts.length)) {
      throw badRequest("Publish requires a bio or at least one prompt");
    }
  }
  await db.update(profiles).set(next).where(eq(profiles.id, actor.profile.id));
  const rows = await db.select().from(profiles).where(eq(profiles.id, actor.profile.id)).limit(1);
  return rows[0]!;
}

export function publicCard(profile: Profile) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    gender: profile.gender,
    seeking: profile.seeking,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    photos: profile.photos,
    prompts: profile.prompts,
    interests: profile.interests,
    lookingFor: profile.lookingFor,
    occupation: profile.occupation,
    agentName: profile.agentName,
  };
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function compatibility(a: Profile, b: Profile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 10;
  if (a.seeking.includes(b.gender) && b.seeking.includes(a.gender)) {
    score += 20;
    reasons.push("seeking overlap");
  }
  if (a.lookingFor === b.lookingFor) {
    score += 15;
    reasons.push(`both looking for ${a.lookingFor}`);
  }
  const shared = a.interests.filter((i) => b.interests.map((x) => x.toLowerCase()).includes(i.toLowerCase()));
  if (shared.length) {
    score += Math.min(30, shared.length * 6);
    reasons.push(`shared: ${shared.slice(0, 4).join(", ")}`);
  }
  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
    score += 12;
    reasons.push(`same city (${a.city})`);
  }
  if (a.country && b.country && a.country.toLowerCase() === b.country.toLowerCase()) {
    score += 6;
    reasons.push("same country");
  }
  return { score, reasons };
}

export async function getDeck(db: AppDb, actor: Actor, limit = 20) {
  if (!actor.profile.isPublished) {
    throw badRequest("Publish your profile before opening the deck");
  }
  const mine = actor.profile;
  const already = await db.select({ id: swipes.toProfileId }).from(swipes).where(eq(swipes.fromProfileId, mine.id));
  const blocked = await db
    .select({ id: blocks.toProfileId })
    .from(blocks)
    .where(eq(blocks.fromProfileId, mine.id));
  const blockedBy = await db
    .select({ id: blocks.fromProfileId })
    .from(blocks)
    .where(eq(blocks.toProfileId, mine.id));
  const skip = new Set([
    mine.id,
    ...already.map((r) => r.id),
    ...blocked.map((r) => r.id),
    ...blockedBy.map((r) => r.id),
  ]);

  const candidates = await db.select().from(profiles).where(eq(profiles.isPublished, true));
  const ranked = candidates
    .filter((p) => !skip.has(p.id))
    .filter((p) => mine.seeking.includes(p.gender) && p.seeking.includes(mine.gender))
    .map((p) => {
      const { score, reasons } = compatibility(mine, p);
      return { profile: publicCard(p), score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return ranked;
}

async function likesToday(db: AppDb, profileId: string, now: Date): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(swipes)
    .where(
      and(
        eq(swipes.fromProfileId, profileId),
        inArray(swipes.direction, ["like", "superlike"]),
        gt(swipes.createdAt, start),
      ),
    );
  return Number(rows[0]?.n || 0);
}

export async function swipe(
  db: AppDb,
  actor: Actor,
  input: { targetId: string; direction: "like" | "pass" | "superlike"; reason?: string },
  now = new Date(),
) {
  if (!actor.profile.isPublished) throw badRequest("Publish your profile before swiping");
  if (input.targetId === actor.profile.id) throw badRequest("You cannot swipe yourself");
  const targetRows = await db.select().from(profiles).where(eq(profiles.id, input.targetId)).limit(1);
  const target = targetRows[0];
  if (!target?.isPublished) throw notFound("That profile is not available");

  const existing = await db
    .select()
    .from(swipes)
    .where(and(eq(swipes.fromProfileId, actor.profile.id), eq(swipes.toProfileId, target.id)))
    .limit(1);
  if (existing[0]) throw conflict("You already swiped this profile");

  if (input.direction !== "pass") {
    const used = await likesToday(db, actor.profile.id, now);
    if (used >= DAILY_LIKE_CAP) throw tooMany(`Daily like cap of ${DAILY_LIKE_CAP} reached`);
  }

  const needsApproval =
    actor.via === "agent" &&
    input.direction !== "pass" &&
    actor.profile.autonomySwipe === "suggest";

  if (needsApproval) {
    return createApproval(db, actor, {
      kind: "swipe",
      summary: `${actor.profile.agentName || "Your claw"} wants to ${input.direction} ${target.displayName}`,
      payload: { targetId: target.id, direction: input.direction, reason: input.reason || "" },
    }, now);
  }

  return executeSwipe(db, actor, target, input.direction, input.reason || "", now);
}

async function executeSwipe(
  db: AppDb,
  actor: Actor,
  target: Profile,
  direction: "like" | "pass" | "superlike",
  reason: string,
  now: Date,
) {
  await db.insert(swipes).values({
    id: id("swp"),
    fromProfileId: actor.profile.id,
    toProfileId: target.id,
    direction,
    reason,
    source: "clawmasutra",
    createdAt: now,
  });
  await logActivity(
    db,
    actor.user.id,
    "swipe",
    `${direction} ${target.displayName}`,
    { targetId: target.id, direction, reason },
    now,
  );

  if (direction === "pass") {
    return { status: "recorded" as const, direction, targetId: target.id, match: null };
  }

  const reciprocal = await db
    .select()
    .from(swipes)
    .where(
      and(
        eq(swipes.fromProfileId, target.id),
        eq(swipes.toProfileId, actor.profile.id),
        inArray(swipes.direction, ["like", "superlike"]),
      ),
    )
    .limit(1);

  if (!reciprocal[0]) {
    return { status: "recorded" as const, direction, targetId: target.id, match: null };
  }

  const [a, b] = orderedPair(actor.profile.id, target.id);
  const existingMatch = await db
    .select()
    .from(matches)
    .where(and(eq(matches.aProfileId, a), eq(matches.bProfileId, b)))
    .limit(1);
  if (existingMatch[0] && !existingMatch[0].unmatchedAt) {
    return { status: "matched" as const, direction, targetId: target.id, match: existingMatch[0] };
  }

  const matchRow = {
    id: id("mch"),
    aProfileId: a,
    bProfileId: b,
    unmatchedAt: null,
    createdAt: now,
  };
  if (existingMatch[0]) {
    await db.update(matches).set({ unmatchedAt: null, createdAt: now }).where(eq(matches.id, existingMatch[0].id));
    matchRow.id = existingMatch[0].id;
  } else {
    await db.insert(matches).values(matchRow).onConflictDoNothing();
    const created = await db
      .select()
      .from(matches)
      .where(and(eq(matches.aProfileId, a), eq(matches.bProfileId, b)))
      .limit(1);
    if (created[0]) matchRow.id = created[0].id;
  }
  await db.insert(messages).values({
    id: id("msg"),
    matchId: matchRow.id,
    senderProfileId: actor.profile.id,
    body: "It's a match. The claws may speak.",
    kind: "system",
    createdAt: now,
  });
  await logActivity(db, actor.user.id, "match", `Matched with ${target.displayName}`, { matchId: matchRow.id }, now);
  await logActivity(db, target.userId, "match", `Matched with ${actor.profile.displayName}`, { matchId: matchRow.id }, now);
  return { status: "matched" as const, direction, targetId: target.id, match: matchRow };
}

export async function listMatches(db: AppDb, actor: Actor) {
  const rows = await db
    .select()
    .from(matches)
    .where(
      and(
        isNull(matches.unmatchedAt),
        or(eq(matches.aProfileId, actor.profile.id), eq(matches.bProfileId, actor.profile.id)),
      ),
    )
    .orderBy(desc(matches.createdAt));
  const otherIds = rows.map((m) => (m.aProfileId === actor.profile.id ? m.bProfileId : m.aProfileId));
  const others = otherIds.length
    ? await db.select().from(profiles).where(inArray(profiles.id, otherIds))
    : [];
  const byId = new Map(others.map((p) => [p.id, p]));
  return rows.map((m) => {
    const other = byId.get(m.aProfileId === actor.profile.id ? m.bProfileId : m.aProfileId);
    return { match: m, other: other ? publicCard(other) : null };
  });
}

export async function getMatch(db: AppDb, actor: Actor, matchId: string) {
  const rows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  const match = rows[0];
  if (!match || match.unmatchedAt) throw notFound("Match not found");
  if (match.aProfileId !== actor.profile.id && match.bProfileId !== actor.profile.id) {
    throw forbidden("Not your match");
  }
  const otherId = match.aProfileId === actor.profile.id ? match.bProfileId : match.aProfileId;
  const otherRows = await db.select().from(profiles).where(eq(profiles.id, otherId)).limit(1);
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.matchId, match.id))
    .orderBy(messages.createdAt);
  const dates = await db
    .select()
    .from(dateProposals)
    .where(eq(dateProposals.matchId, match.id))
    .orderBy(desc(dateProposals.createdAt));
  return { match, other: otherRows[0] ? publicCard(otherRows[0]) : null, messages: thread, dates };
}

export async function sendMessage(
  db: AppDb,
  actor: Actor,
  matchId: string,
  body: string,
  now = new Date(),
) {
  const { match } = await getMatch(db, actor, matchId);
  if (containsContact(body) && actor.via === "agent") {
    return createApproval(db, actor, {
      kind: "contact",
      summary: "Message looks like it shares contact details",
      payload: { matchId, body },
    }, now);
  }
  const needsApproval = actor.via === "agent" && actor.profile.autonomyMessage !== "auto";
  if (needsApproval) {
    return createApproval(db, actor, {
      kind: "message",
      summary: `Send a message in a match`,
      payload: { matchId, body },
    }, now);
  }
  const row = {
    id: id("msg"),
    matchId: match.id,
    senderProfileId: actor.profile.id,
    body,
    kind: actor.via === "human" ? "human" : "agent",
    createdAt: now,
  };
  await db.insert(messages).values(row);
  await logActivity(db, actor.user.id, "message", "Sent a message", { matchId }, now);
  return { status: "sent" as const, message: row };
}

export async function proposeDate(
  db: AppDb,
  actor: Actor,
  input: { matchId: string; startsAt: Date; timezone: string; venue: string; notes: string },
  now = new Date(),
) {
  const { match } = await getMatch(db, actor, input.matchId);
  if (input.startsAt.getTime() < now.getTime() - 60_000) throw badRequest("Date must be in the future");
  const needsApproval = actor.via === "agent" && actor.profile.autonomyDate !== "auto";
  if (needsApproval) {
    return createApproval(db, actor, {
      kind: "date",
      summary: `Propose ${input.venue} on ${input.startsAt.toISOString()}`,
      payload: {
        matchId: match.id,
        startsAt: input.startsAt.toISOString(),
        timezone: input.timezone,
        venue: input.venue,
        notes: input.notes,
      },
    }, now);
  }
  const row = {
    id: id("dte"),
    matchId: match.id,
    proposerProfileId: actor.profile.id,
    startsAt: input.startsAt,
    timezone: input.timezone,
    venue: input.venue,
    notes: input.notes,
    status: "pending_other",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(dateProposals).values(row);
  await db.insert(messages).values({
    id: id("msg"),
    matchId: match.id,
    senderProfileId: actor.profile.id,
    body: `Date proposed: ${input.venue} at ${input.startsAt.toISOString()} (${input.timezone})`,
    kind: "system",
    createdAt: now,
  });
  await logActivity(db, actor.user.id, "date_proposed", `Proposed ${input.venue}`, { dateId: row.id }, now);
  return { status: "pending_other" as const, date: row };
}

export async function decideDate(
  db: AppDb,
  actor: Actor,
  dateId: string,
  decision: "confirmed" | "declined" | "cancelled",
  now = new Date(),
) {
  const rows = await db.select().from(dateProposals).where(eq(dateProposals.id, dateId)).limit(1);
  const date = rows[0];
  if (!date) throw notFound("Date not found");
  const { match } = await getMatch(db, actor, date.matchId);
  const isProposer = date.proposerProfileId === actor.profile.id;
  if (decision === "cancelled") {
    if (!isProposer) throw forbidden("Only the proposer can cancel");
    await db.update(dateProposals).set({ status: "cancelled", updatedAt: now }).where(eq(dateProposals.id, date.id));
    return { status: "cancelled" as const };
  }
  if (isProposer) throw forbidden("The other human decides this proposal");
  if (date.status !== "pending_other") throw conflict(`Date is ${date.status}`);
  await db.update(dateProposals).set({ status: decision, updatedAt: now }).where(eq(dateProposals.id, date.id));
  await db.insert(messages).values({
    id: id("msg"),
    matchId: match.id,
    senderProfileId: actor.profile.id,
    body: decision === "confirmed" ? "Date confirmed. See you there." : "Date declined.",
    kind: "system",
    createdAt: now,
  });
  return { status: decision };
}

export async function unmatch(db: AppDb, actor: Actor, matchId: string, now = new Date()) {
  const { match } = await getMatch(db, actor, matchId);
  const otherId = match.aProfileId === actor.profile.id ? match.bProfileId : match.aProfileId;
  await db.update(matches).set({ unmatchedAt: now }).where(eq(matches.id, match.id));
  await db
    .delete(swipes)
    .where(
      or(
        and(eq(swipes.fromProfileId, actor.profile.id), eq(swipes.toProfileId, otherId)),
        and(eq(swipes.fromProfileId, otherId), eq(swipes.toProfileId, actor.profile.id)),
      ),
    );
  await logActivity(db, actor.user.id, "unmatch", "Unmatched", { matchId }, now);
}

export async function blockProfile(db: AppDb, actor: Actor, targetId: string, reason: string, now = new Date()) {
  if (targetId === actor.profile.id) throw badRequest("Cannot block yourself");
  await db.insert(blocks).values({
    id: id("blk"),
    fromProfileId: actor.profile.id,
    toProfileId: targetId,
    reason,
    createdAt: now,
  }).onConflictDoNothing();
  const [a, b] = orderedPair(actor.profile.id, targetId);
  await db
    .update(matches)
    .set({ unmatchedAt: now })
    .where(and(eq(matches.aProfileId, a), eq(matches.bProfileId, b), isNull(matches.unmatchedAt)));
  await logActivity(db, actor.user.id, "block", "Blocked a profile", { targetId }, now);
}

export async function createApproval(
  db: AppDb,
  actor: Actor,
  input: { kind: string; summary: string; payload: Record<string, unknown> },
  now = new Date(),
) {
  const row = {
    id: id("apr"),
    userId: actor.user.id,
    kind: input.kind,
    summary: input.summary,
    payload: input.payload,
    status: "pending",
    decidedAt: null,
    createdAt: now,
  };
  await db.insert(approvals).values(row);
  await logActivity(db, actor.user.id, "approval_needed", input.summary, { approvalId: row.id }, now);
  return { status: "needs_approval" as const, approval: row };
}

export async function listApprovals(db: AppDb, actor: Actor, status = "pending") {
  return db
    .select()
    .from(approvals)
    .where(and(eq(approvals.userId, actor.user.id), eq(approvals.status, status)))
    .orderBy(desc(approvals.createdAt));
}

export async function decideApproval(
  db: AppDb,
  actor: Actor,
  approvalId: string,
  decision: "approved" | "denied",
  now = new Date(),
) {
  if (actor.via !== "human") throw forbidden("Only the human can decide approvals");
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.id, approvalId), eq(approvals.userId, actor.user.id)))
    .limit(1);
  const approval = rows[0];
  if (!approval) throw notFound("Approval not found");
  if (approval.status !== "pending") throw conflict("Approval already decided");
  await db
    .update(approvals)
    .set({ status: decision, decidedAt: now })
    .where(eq(approvals.id, approval.id));
  if (decision === "denied") return { status: "denied" as const, result: null };

  const payload = approval.payload;
  if (approval.kind === "swipe") {
    const targetId = String(payload.targetId);
    const direction = payload.direction as "like" | "pass" | "superlike";
    const targetRows = await db.select().from(profiles).where(eq(profiles.id, targetId)).limit(1);
    const target = targetRows[0];
    if (!target) throw notFound("Target gone");
    const result = await executeSwipe(db, actor, target, direction, String(payload.reason || ""), now);
    return { status: "approved" as const, result };
  }
  if (approval.kind === "message" || approval.kind === "contact") {
    const result = await sendMessage(db, { ...actor, via: "human" }, String(payload.matchId), String(payload.body), now);
    return { status: "approved" as const, result };
  }
  if (approval.kind === "date") {
    const result = await proposeDate(
      db,
      { ...actor, via: "human" },
      {
        matchId: String(payload.matchId),
        startsAt: new Date(String(payload.startsAt)),
        timezone: String(payload.timezone || "UTC"),
        venue: String(payload.venue),
        notes: String(payload.notes || ""),
      },
      now,
    );
    return { status: "approved" as const, result };
  }
  return { status: "approved" as const, result: payload };
}

export async function inbox(db: AppDb, actor: Actor) {
  const pending = await listApprovals(db, actor, "pending");
  const openMatches = await listMatches(db, actor);
  return {
    profile: publicCard(actor.profile),
    published: actor.profile.isPublished,
    autonomy: {
      swipe: actor.profile.autonomySwipe,
      message: actor.profile.autonomyMessage,
      date: actor.profile.autonomyDate,
    },
    approvals: pending,
    matches: openMatches,
  };
}
