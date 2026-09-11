import { describe, expect, it } from "vitest";
import { handleAgentRequest } from "@/server/agent-api";
import { handleHumanRequest } from "@/server/human-api";
import { SESSION_COOKIE } from "@/lib/config";
import { createTestDb, publishedHuman } from "./harness";
import { skillMarkdown } from "@/lib/skill-doc";

function req(url: string, init: RequestInit = {}) {
  return new Request(`http://localhost:3000${url}`, init);
}

async function signup(db: ReturnType<typeof createTestDb> extends Promise<infer T> ? T : never, email: string) {
  const res = await handleHumanRequest(
    req("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "abcdefghij",
        name: "Ada",
        age: 28,
        ageConfirmed: true,
      }),
    }),
    { db },
  );
  const cookie = res.headers.get("set-cookie") || "";
  const token = decodeURIComponent(cookie.split(";")[0].split("=")[1] || "");
  return { res, token };
}

describe("http api", () => {
  it("rejects underage signup", async () => {
    const db = await createTestDb();
    const res = await handleHumanRequest(
      req("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "kid@x.com", password: "abcdefghij", name: "Kid", age: 17, ageConfirmed: true }),
      }),
      { db },
    );
    expect(res.status).toBe(400);
  });

  it("signs up, sets a session cookie, and reads /api/me", async () => {
    const db = await createTestDb();
    const { res, token } = await signup(db, "ada@x.com");
    expect(res.status).toBe(201);
    expect(token.startsWith("cms_sess_")).toBe(true);
    const me = await handleHumanRequest(req("/api/me", { headers: { cookie: `${SESSION_COOKIE}=${token}` } }), { db });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.user.email).toBe("ada@x.com");
  });

  it("pairs via agent API and swipes through HTTP", async () => {
    const db = await createTestDb();
    const ada = await publishedHuman(db, { email: "ada@x.com", name: "Ada", gender: "woman", seeking: ["man"] });
    await publishedHuman(db, { email: "ben@x.com", name: "Ben", gender: "man", seeking: ["woman"] });
    const codeRes = await handleHumanRequest(
      req("/api/pairing-code", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=unused` },
      }),
      { db },
    );
    // pairing needs a real session; issue via human handler after login
    const login = await handleHumanRequest(
      req("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ada@x.com", password: "correct-horse-battery" }),
      }),
      { db },
    );
    const cookie = login.headers.get("set-cookie") || "";
    const session = decodeURIComponent(cookie.split(";")[0].split("=")[1] || "");
    const pairCode = await handleHumanRequest(
      req("/api/pairing-code", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session}` } }),
      { db },
    );
    expect(pairCode.status).toBe(200);
    const { code } = await pairCode.json();
    const paired = await handleAgentRequest(
      req("/api/v1/agents/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, agentName: "Pearl" }),
      }),
      { db },
    );
    const { apiKey } = await paired.json();
    const auth = { Authorization: `Bearer ${apiKey}` };
    const deck = await handleAgentRequest(req("/api/v1/deck", { headers: auth }), { db });
    const deckBody = await deck.json();
    expect(deckBody.deck[0].profile.displayName).toBe("Ben");
    const swipe = await handleAgentRequest(
      req("/api/v1/swipe", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: deckBody.deck[0].profile.id, direction: "like", reason: "records" }),
      }),
      { db },
    );
    expect(swipe.status).toBe(200);
    void ada;
    expect(codeRes.status).toBe(401);
  });

  it("rejects connector events when the app is off", async () => {
    const db = await createTestDb();
    const login = await handleHumanRequest(
      req("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@x.com",
          password: "abcdefghij",
          name: "Ada",
          age: 28,
          ageConfirmed: true,
        }),
      }),
      { db },
    );
    const session = decodeURIComponent((login.headers.get("set-cookie") || "").split(";")[0].split("=")[1] || "");
    const codeRes = await handleHumanRequest(
      req("/api/pairing-code", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session}` } }),
      { db },
    );
    const { code } = await codeRes.json();
    const paired = await handleAgentRequest(
      req("/api/v1/agents/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, agentName: "Pearl" }),
      }),
      { db },
    );
    const { apiKey } = await paired.json();
    const res = await handleAgentRequest(
      req("/api/v1/connectors/hinge/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "swipe", payload: { direction: "like" } }),
      }),
      { db },
    );
    expect(res.status).toBe(400);
  });

  it("records connector events after enable", async () => {
    const db = await createTestDb();
    const signupRes = await handleHumanRequest(
      req("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@x.com",
          password: "abcdefghij",
          name: "Ada",
          age: 28,
          ageConfirmed: true,
        }),
      }),
      { db },
    );
    const session = decodeURIComponent((signupRes.headers.get("set-cookie") || "").split(";")[0].split("=")[1] || "");
    await handleHumanRequest(
      req("/api/connectors", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${session}`, "Content-Type": "application/json" },
        body: JSON.stringify({ app: "hinge", enabled: true }),
      }),
      { db },
    );
    const { code } = await (
      await handleHumanRequest(
        req("/api/pairing-code", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session}` } }),
        { db },
      )
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
    const res = await handleAgentRequest(
      req("/api/v1/connectors/hinge/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "swipe", payload: { direction: "like", name: "Sam" } }),
      }),
      { db },
    );
    expect(res.status).toBe(200);
  });

  it("heartbeats after pairing", async () => {
    const db = await createTestDb();
    const signupRes = await handleHumanRequest(
      req("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@x.com",
          password: "abcdefghij",
          name: "Ada",
          age: 28,
          ageConfirmed: true,
        }),
      }),
      { db },
    );
    const session = decodeURIComponent((signupRes.headers.get("set-cookie") || "").split(";")[0].split("=")[1] || "");
    const { code } = await (
      await handleHumanRequest(
        req("/api/pairing-code", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${session}` } }),
        { db },
      )
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
    const beat = await handleAgentRequest(
      req("/api/v1/heartbeat", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } }),
      { db },
    );
    expect(beat.status).toBe(200);
    const body = await beat.json();
    expect(body.ok).toBe(true);
    expect(body.published).toBe(false);
  });

  it("embeds live endpoints in the skill document", () => {
    const md = skillMarkdown("https://clawmastura.com");
    expect(md).toContain("/api/v1/agents/pair");
    expect(md).toContain("/api/v1/swipe");
    expect(md).toContain("/api/v1/heartbeat");
    expect(md).toContain("cms_live_");
    expect(md).not.toContain("TODO");
  });

  it("rejects invalid JSON and unknown agent keys", async () => {
    const db = await createTestDb();
    const badJson = await handleAgentRequest(
      req("/api/v1/agents/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" }),
      { db },
    );
    expect(badJson.status).toBe(400);
    const badKey = await handleAgentRequest(req("/api/v1/me", { headers: { Authorization: "Bearer cms_live_nope" } }), {
      db,
    });
    expect(badKey.status).toBe(401);
  });
});
