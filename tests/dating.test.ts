import { describe, expect, it } from "vitest";
import { decideApproval, decideDate, getDeck, getMatch, proposeDate, sendMessage, swipe } from "@/lib/dating";
import { AppError } from "@/lib/errors";
import { createTestDb, publishedHuman } from "./harness";

describe("dating", () => {
  it("refuses swipe on unpublished profile", async () => {
    const db = await createTestDb();
    const a = await publishedHuman(db, { email: "a@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    a.profile.isPublished = false;
    await expect(swipe(db, a, { targetId: "prf_nope", direction: "like" })).rejects.toMatchObject({ status: 400 });
  });

  it("refuses self-swipe and missing targets", async () => {
    const db = await createTestDb();
    const a = await publishedHuman(db, { email: "a@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    await expect(swipe(db, a, { targetId: a.profile.id, direction: "like" })).rejects.toMatchObject({ status: 400 });
    await expect(swipe(db, a, { targetId: "prf_missing", direction: "like" })).rejects.toMatchObject({ status: 404 });
  });

  it("ranks the deck by shared interests and city", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, {
      email: "ada@x.com",
      name: "Ada",
      gender: "woman",
      seeking: ["man"],
      city: "Austin",
      interests: ["records", "climbing"],
    });
    await publishedHuman(db, {
      email: "ben@x.com",
      name: "Ben",
      gender: "man",
      seeking: ["woman"],
      city: "Austin",
      interests: ["records", "climbing"],
    });
    await publishedHuman(db, {
      email: "cal@x.com",
      name: "Cal",
      gender: "man",
      seeking: ["woman"],
      city: "Oslo",
      interests: ["chess"],
    });
    const deck = await getDeck(db, ada);
    expect(deck[0]?.profile.displayName).toBe("Ben");
    expect(deck.map((c) => c.profile.displayName)).toContain("Cal");
  });

  it("creates a match only on mutual like", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const first = await swipe(db, ada, { targetId: ben.profile.id, direction: "like", reason: "the records prompt" });
    expect(first.status).toBe("recorded");
    if (first.status !== "recorded") throw new Error("expected recorded");
    expect(first.match).toBeNull();
    const second = await swipe(db, ben, { targetId: ada.profile.id, direction: "like", reason: "she climbs" });
    expect(second.status).toBe("matched");
    if (second.status !== "matched") throw new Error("expected match");
    expect(second.match).toBeTruthy();
  });

  it("queues likes when the claw is in suggest mode", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    ada.profile.autonomySwipe = "suggest";
    const claw = { ...ada, via: "agent" as const };
    const result = await swipe(db, claw, { targetId: ben.profile.id, direction: "like", reason: "maybe" });
    expect(result.status).toBe("needs_approval");
    const decided = await decideApproval(db, ada, result.status === "needs_approval" ? result.approval.id : "", "approved");
    expect(decided.status).toBe("approved");
  });

  it("holds messages with contact details even in auto", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await swipe(db, ada, { targetId: ben.profile.id, direction: "like" });
    const matched = await swipe(db, ben, { targetId: ada.profile.id, direction: "like" });
    if (matched.status !== "matched" || !matched.match) throw new Error("expected match");
    const matchId = matched.match.id;
    ada.profile.autonomyMessage = "auto";
    const claw = { ...ada, via: "agent" as const };
    const held = await sendMessage(db, claw, matchId, "text me at 512-555-0199");
    expect(held.status).toBe("needs_approval");
  });

  it("requires the other human to confirm a date", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await swipe(db, ada, { targetId: ben.profile.id, direction: "like" });
    const matched = await swipe(db, ben, { targetId: ada.profile.id, direction: "like" });
    if (matched.status !== "matched" || !matched.match) throw new Error("expected match");
    const startsAt = new Date(Date.now() + 86400000);
    const proposed = await proposeDate(db, ada, {
      matchId: matched.match.id,
      startsAt,
      timezone: "America/Chicago",
      venue: "Hotel San Jose",
      notes: "one drink",
    });
    expect(proposed.status).toBe("pending_other");
    if (proposed.status !== "pending_other") throw new Error("expected proposal");
    await expect(decideDate(db, ada, proposed.date.id, "confirmed")).rejects.toBeInstanceOf(AppError);
    const confirmed = await decideDate(db, ben, proposed.date.id, "confirmed");
    expect(confirmed.status).toBe("confirmed");
    const thread = await getMatch(db, ada, matched.match.id);
    expect(thread.dates[0]?.status).toBe("confirmed");
  });

  it("rejects a second swipe on the same person", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    const ben = await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    await swipe(db, ada, { targetId: ben.profile.id, direction: "pass" });
    await expect(swipe(db, ada, { targetId: ben.profile.id, direction: "like" })).rejects.toMatchObject({
      status: 409,
    });
  });
});
