import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "@/lib/config";
import { id } from "@/lib/crypto";
import { swipe, unmatch, blockProfile, getDeck, updateProfile, proposeDate } from "@/lib/dating";
import { users, profiles, swipes as swipeTable } from "@/lib/schema";
import { handleAgentRequest } from "@/server/agent-api";
import { handleHumanRequest } from "@/server/human-api";
import { createTestDb, publishedHuman } from "./harness";

function req(url: string, init: RequestInit = {}) {
  return new Request(`http://localhost:3000${url}`, init);
}

async function cookieFor(db: Awaited<ReturnType<typeof createTestDb>>, email: string, password = "correct-horse-battery") {
  const res = await handleHumanRequest(
    req("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    { db },
  );
  const header = res.headers.get("set-cookie") || "";
  return decodeURIComponent(header.split(";")[0].split("=")[1] || "");
}

function cookieHeader(token: string) {
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

describe("human HTTP flows", () => {
  it("matches two humans over HTTP, messages, unmatches, and blocks", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const adaTok = await cookieFor(db, "ada@x.com");
    const benTok = await cookieFor(db, "ben@x.com");

    const likeAda = await handleHumanRequest(
      req("/api/swipe", {
        method: "POST",
        headers: { ...cookieHeader(adaTok), "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: ben.profile.id, direction: "like", reason: "climbing" }),
      }),
      { db },
    );
    expect((await likeAda.json()).status).toBe("recorded");

    const likeBen = await handleHumanRequest(
      req("/api/swipe", {
        method: "POST",
        headers: { ...cookieHeader(benTok), "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: ada.profile.id, direction: "like", reason: "records" }),
      }),
      { db },
    );
    const matched = await likeBen.json();
    expect(matched.status).toBe("matched");
    const matchId = matched.match.id;

    const msg = await handleHumanRequest(
      req(`/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: { ...cookieHeader(adaTok), "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Thursday, Hotel San Jose patio?" }),
      }),
      { db },
    );
    expect((await msg.json()).status).toBe("sent");

    const thread = await handleHumanRequest(req(`/api/matches/${matchId}`, { headers: cookieHeader(adaTok) }), { db });
    const threadBody = await thread.json();
    expect(threadBody.messages.some((m: { body: string }) => m.body.includes("Hotel San Jose"))).toBe(true);

    const un = await handleHumanRequest(
      req(`/api/matches/${matchId}/unmatch`, { method: "POST", headers: cookieHeader(adaTok) }),
      { db },
    );
    expect(un.status).toBe(200);

    const blk = await handleHumanRequest(
      req("/api/block", {
        method: "POST",
        headers: { ...cookieHeader(adaTok), "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: ben.profile.id, reason: "nope" }),
      }),
      { db },
    );
    expect(blk.status).toBe(200);
    const deck = await getDeck(db, ada);
    expect(deck.map((c) => c.profile.id)).not.toContain(ben.profile.id);
  });

  it("logs out and then refuses /api/me", async () => {
    const db = await createTestDb();
    await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const token = await cookieFor(db, "ada@x.com");
    const out = await handleHumanRequest(req("/api/auth/logout", { method: "POST", headers: cookieHeader(token) }), { db });
    expect(out.status).toBe(200);
    const me = await handleHumanRequest(req("/api/me", { headers: cookieHeader(token) }), { db });
    expect(me.status).toBe(401);
  });

  it("deletes the account and cascades the profile", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const token = await cookieFor(db, "ada@x.com");
    const res = await handleHumanRequest(req("/api/me", { method: "DELETE", headers: cookieHeader(token) }), { db });
    expect(res.status).toBe(200);
    const leftover = await db.select().from(users).where(eq(users.id, ada.user.id));
    expect(leftover.length).toBe(0);
    const prof = await db.select().from(profiles).where(eq(profiles.id, ada.profile.id));
    expect(prof.length).toBe(0);
  });

  it("returns inviteUrl on /api/me", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const token = await cookieFor(db, "ada@x.com");
    const me = await handleHumanRequest(req("/api/me", { headers: cookieHeader(token) }), { db });
    const body = await me.json();
    expect(body.inviteUrl).toContain(`/signup?from=${ada.profile.id}`);
  });

  it("revokes an agent key so later calls 401", async () => {
    const db = await createTestDb();
    await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const token = await cookieFor(db, "ada@x.com");
    const { code } = await (
      await handleHumanRequest(req("/api/pairing-code", { method: "POST", headers: cookieHeader(token) }), { db })
    ).json();
    const { apiKey } = await (
      await handleAgentRequest(
        req("/api/v1/agents/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, agentName: "Pearl" }),
        }),
        { db },
      )
    ).json();
    const keys = await (
      await handleHumanRequest(req("/api/me", { headers: cookieHeader(token) }), { db })
    ).json();
    const keyId = keys.keys.find((k: { revokedAt: Date | null }) => !k.revokedAt).id;
    await handleHumanRequest(req(`/api/keys/${keyId}/revoke`, { method: "POST", headers: cookieHeader(token) }), { db });
    const me = await handleAgentRequest(req("/api/v1/me", { headers: { Authorization: `Bearer ${apiKey}` } }), { db });
    expect(me.status).toBe(401);
  });
});

describe("dating edges", () => {
  it("keeps gender-incompatible profiles off the deck", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["woman"] });
    await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const deck = await getDeck(db, ada);
    expect(deck.map((c) => c.profile.displayName)).not.toContain("Ben");
  });

  it("refuses to publish without bio or prompts", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    await expect(updateProfile(db, ada, { bio: "", prompts: [], isPublished: true })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("refuses a date in the past", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await swipe(db, ada, { targetId: ben.profile.id, direction: "like" });
    const matched = await swipe(db, ben, { targetId: ada.profile.id, direction: "like" });
    if (matched.status !== "matched" || !matched.match) throw new Error("expected match");
    await expect(
      proposeDate(db, ada, {
        matchId: matched.match.id,
        startsAt: new Date("2020-01-01T00:00:00Z"),
        timezone: "UTC",
        venue: "Then",
        notes: "",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rematches after unmatch when both like again", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await swipe(db, ada, { targetId: ben.profile.id, direction: "like" });
    const first = await swipe(db, ben, { targetId: ada.profile.id, direction: "like" });
    if (first.status !== "matched" || !first.match) throw new Error("expected match");
    await unmatch(db, ada, first.match.id);
    await swipe(db, ada, { targetId: ben.profile.id, direction: "like" });
    const again = await swipe(db, ben, { targetId: ada.profile.id, direction: "like" });
    expect(again.status).toBe("matched");
  });

  it("enforces the daily like cap", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const now = new Date();
    const rows = [];
    for (let i = 0; i < 100; i++) {
      const uid = id("usr");
      const pid = id("prf");
      await db.insert(users).values({
        id: uid,
        email: `u${i}@x.com`,
        passwordHash: "x",
        name: `U${i}`,
        age: 28,
        ageConfirmedAt: now,
        claimTokenHash: null,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(profiles).values({
        id: pid,
        userId: uid,
        displayName: `U${i}`,
        headline: "",
        bio: "enough bio text here",
        gender: "man",
        seeking: ["woman"],
        city: "Austin",
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
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });
      rows.push(pid);
    }
    await db.insert(swipeTable).values(
      rows.map((to) => ({
        id: id("swp"),
        fromProfileId: ada.profile.id,
        toProfileId: to,
        direction: "like",
        reason: "cap",
        source: "clawmasutra",
        createdAt: now,
      })),
    );
    const extra = await publishedHuman(db, { email: "zed@x.com", name: "Zed", gender: "man", seeking: ["woman"] });
    await expect(swipe(db, ada, { targetId: extra.profile.id, direction: "like" })).rejects.toMatchObject({
      status: 429,
    });
  });

  it("allows a pass after the like cap", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const now = new Date();
    for (let i = 0; i < 100; i++) {
      const uid = id("usr");
      const pid = id("prf");
      await db.insert(users).values({
        id: uid,
        email: `p${i}@x.com`,
        passwordHash: "x",
        name: `P${i}`,
        age: 28,
        ageConfirmedAt: now,
        claimTokenHash: null,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(profiles).values({
        id: pid,
        userId: uid,
        displayName: `P${i}`,
        headline: "",
        bio: "enough bio text here",
        gender: "man",
        seeking: ["woman"],
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
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(swipeTable).values({
        id: id("swp"),
        fromProfileId: ada.profile.id,
        toProfileId: pid,
        direction: "like",
        reason: "cap",
        source: "clawmasutra",
        createdAt: now,
      });
    }
    const passed = await swipe(db, ada, { targetId: ben.profile.id, direction: "pass" });
    expect(passed.status).toBe("recorded");
  });

  it("denies a queued like so no swipe is stored", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    ada.profile.autonomySwipe = "suggest";
    const claw = { ...ada, via: "agent" as const };
    const queued = await swipe(db, claw, { targetId: ben.profile.id, direction: "like" });
    if (queued.status !== "needs_approval") throw new Error("expected approval");
    const { decideApproval } = await import("@/lib/dating");
    const denied = await decideApproval(db, ada, queued.approval.id, "denied");
    expect(denied.status).toBe("denied");
    const stored = await db.select().from(swipeTable).where(eq(swipeTable.fromProfileId, ada.profile.id));
    expect(stored.length).toBe(0);
  });

  it("blocks a profile and hides it from the deck", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await blockProfile(db, ada, ben.profile.id, "no");
    const deck = await getDeck(db, ada);
    expect(deck.map((c) => c.profile.id)).not.toContain(ben.profile.id);
  });
});

describe("concurrent likes", () => {
  it("creates a single match when both like at the same time", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const [left, right] = await Promise.all([
      swipe(db, ada, { targetId: ben.profile.id, direction: "like" }),
      swipe(db, ben, { targetId: ada.profile.id, direction: "like" }),
    ]);
    const matched = [left, right].filter((r) => r.status === "matched");
    expect(matched.length).toBeGreaterThanOrEqual(1);
    const { matches } = await import("@/lib/schema");
    const rows = await db.select().from(matches);
    expect(rows.length).toBe(1);
  });
});
