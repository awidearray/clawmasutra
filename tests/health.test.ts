import { describe, expect, it } from "vitest";
import { pingDb } from "@/lib/db";
import { heartbeatMarkdown, skillMarkdown } from "@/lib/skill-doc";
import { compatibility } from "@/lib/dating";
import type { Profile } from "@/lib/schema";

describe("health and skill contract", () => {
  it("reports db down when DATABASE_URL is missing", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await pingDb()).toBe(false);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });

  it("heartbeat markdown points at the live heartbeat route", () => {
    const md = heartbeatMarkdown("https://example.test");
    expect(md).toContain("https://example.test/api/v1/heartbeat");
    expect(md).toContain("pendingApprovals");
  });

  it("skill markdown lists every mutating agent route", () => {
    const md = skillMarkdown("https://example.test");
    for (const path of [
      "/api/v1/agents/register",
      "/api/v1/agents/pair",
      "/api/v1/deck",
      "/api/v1/swipe",
      "/api/v1/matches",
      "/api/v1/dates",
      "/api/v1/connectors",
      "/api/v1/block",
      "/api/v1/heartbeat",
    ]) {
      expect(md).toContain(path);
    }
  });
});

describe("compatibility", () => {
  function stub(partial: Partial<Profile>): Profile {
    return {
      id: "prf_x",
      userId: "usr_x",
      displayName: "X",
      headline: "",
      bio: "",
      gender: "woman",
      seeking: ["man"],
      city: "Austin",
      region: "",
      country: "US",
      latitude: null,
      longitude: null,
      photos: [],
      prompts: [],
      interests: ["records"],
      lookingFor: "dating",
      heightCm: null,
      occupation: "",
      agentName: "",
      agentStyle: "",
      autonomySwipe: "guarded",
      autonomyMessage: "guarded",
      autonomyDate: "guarded",
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...partial,
    };
  }

  it("scores shared city and interests above a stranger", () => {
    const a = stub({ interests: ["records", "climbing"], city: "Austin" });
    const close = stub({
      id: "prf_b",
      gender: "man",
      seeking: ["woman"],
      interests: ["records", "climbing"],
      city: "Austin",
    });
    const far = stub({
      id: "prf_c",
      gender: "man",
      seeking: ["woman"],
      interests: ["chess"],
      city: "Oslo",
      country: "NO",
    });
    expect(compatibility(a, close).score).toBeGreaterThan(compatibility(a, far).score);
  });
});
