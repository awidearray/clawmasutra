import { describe, expect, it } from "vitest";
import { createHuman, issuePairingCode, loginHuman, pairAgent } from "@/lib/auth";
import { claimAccount } from "@/lib/claim";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { registerAgent } from "@/lib/register-agent";
import { createTestDb } from "./harness";

describe("auth", () => {
  it("hashes and verifies passwords", async () => {
    const stored = await hashPassword("a-long-enough-secret");
    expect(stored.startsWith("scrypt:")).toBe(true);
    expect(await verifyPassword("a-long-enough-secret", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("rejects duplicate email", async () => {
    const db = await createTestDb();
    await createHuman(db, { email: "a@x.com", password: "abcdefghij", name: "A", age: 22 });
    await expect(
      createHuman(db, { email: "a@x.com", password: "abcdefghij", name: "B", age: 22 }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects bad login", async () => {
    const db = await createTestDb();
    await createHuman(db, { email: "a@x.com", password: "abcdefghij", name: "A", age: 22 });
    await expect(loginHuman(db, { email: "a@x.com", password: "nope-nope-nope" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("pairs a claw with a live code and rejects reuse", async () => {
    const db = await createTestDb();
    const { user } = await createHuman(db, { email: "a@x.com", password: "abcdefghij", name: "A", age: 22 });
    const code = await issuePairingCode(db, user.id);
    const first = await pairAgent(db, { code, agentName: "Lobster" });
    expect(first.apiKey.startsWith("cms_live_")).toBe(true);
    await expect(pairAgent(db, { code, agentName: "Lobster" })).rejects.toMatchObject({ status: 401 });
  });

  it("rejects expired pairing codes", async () => {
    const db = await createTestDb();
    const { user } = await createHuman(db, { email: "a@x.com", password: "abcdefghij", name: "A", age: 22 });
    const now = new Date("2026-01-01T00:00:00Z");
    const code = await issuePairingCode(db, user.id, now);
    await expect(
      pairAgent(db, { code, agentName: "Late" }, new Date("2026-01-01T00:20:00Z")),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("registers a claw-first human and lets them claim", async () => {
    const db = await createTestDb();
    const result = await registerAgent(db, {
      agentName: "Pearl",
      human: { name: "Sam", age: 31, gender: "woman", seeking: ["man"], bio: "I make pasta on Sundays." },
    });
    expect(result.apiKey.startsWith("cms_live_")).toBe(true);
    expect(result.claimToken).toBeTruthy();
    const session = await claimAccount(db, {
      token: result.claimToken!,
      email: "sam@x.com",
      password: "abcdefghij",
    });
    expect(session.user.email).toBe("sam@x.com");
  });
});
