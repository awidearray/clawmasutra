import { recentActivity } from "@/lib/activity";
import {
  actorFromSession,
  createHuman,
  destroySession,
  issuePairingCode,
  listAgentKeys,
  loginHuman,
  revokeAgentKey,
  sessionCookieOptions,
} from "@/lib/auth";
import { claimAccount } from "@/lib/claim";
import { SESSION_COOKIE, appUrl } from "@/lib/config";
import { connectorFeed, listConnectors, setConnector } from "@/lib/connectors";
import type { AppDb } from "@/lib/db";
import {
  blockProfile,
  decideApproval,
  decideDate,
  getDeck,
  getMatch,
  inbox,
  listApprovals,
  listMatches,
  proposeDate,
  sendMessage,
  swipe,
  unmatch,
  updateProfile,
} from "@/lib/dating";
import { deleteAccount } from "@/lib/account";
import { badRequest, unauthorized } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  claimInput,
  connectorToggleInput,
  dateInput,
  loginInput,
  messageInput,
  parse,
  profileInput,
  registerHumanInput,
  swipeInput,
} from "@/lib/validate";
import { clientIp, cookieValue, errorResponse, json, readJson } from "./http";

type Ctx = { db: AppDb; now?: Date };

function setSession(res: Response, token: string, expiresAt: Date): Response {
  const opts = sessionCookieOptions(expiresAt);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `HttpOnly`,
    `SameSite=${opts.sameSite}`,
    `Expires=${opts.expires.toUTCString()}`,
  ];
  if (opts.secure) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
  return res;
}

function clearSession(res: Response): Response {
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return res;
}

async function requireHuman(db: AppDb, req: Request) {
  const actor = await actorFromSession(db, cookieValue(req, SESSION_COOKIE));
  if (!actor) throw unauthorized("Sign in");
  return actor;
}

function pathOf(req: Request) {
  const url = new URL(req.url);
  return { method: req.method, path: url.pathname.replace(/\/$/, "") || "/", url };
}

export async function handleHumanRequest(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { method, path, url } = pathOf(req);
    const db = ctx.db;
    const ip = clientIp(req);

    if (method === "POST" && path === "/api/auth/signup") {
      rateLimit(`signup:${ip}`, 8, 60 * 60 * 1000);
      const body = parse(registerHumanInput, await readJson(req));
      const { user } = await createHuman(db, body, ctx.now);
      const session = await loginHuman(db, { email: body.email, password: body.password });
      return setSession(json({ ok: true, userId: user.id }, 201), session.token, session.expiresAt);
    }

    if (method === "POST" && path === "/api/auth/login") {
      rateLimit(`login:${ip}`, 20, 60 * 60 * 1000);
      const body = parse(loginInput, await readJson(req));
      const session = await loginHuman(db, body);
      return setSession(json({ ok: true }), session.token, session.expiresAt);
    }

    if (method === "POST" && path === "/api/auth/logout") {
      const token = cookieValue(req, SESSION_COOKIE);
      if (token) await destroySession(db, token);
      return clearSession(json({ ok: true }));
    }

    if (method === "POST" && path === "/api/auth/claim") {
      const body = parse(claimInput, await readJson(req));
      const session = await claimAccount(db, body, ctx.now);
      return setSession(json({ ok: true }), session.token, session.expiresAt);
    }

    const actor = await requireHuman(db, req);

    if (method === "GET" && path === "/api/me") {
      return json({
        user: { id: actor.user.id, name: actor.user.name, email: actor.user.email, age: actor.user.age },
        profile: actor.profile,
        keys: await listAgentKeys(db, actor.user.id),
        inbox: await inbox(db, actor),
        inviteUrl: `${appUrl()}/signup?from=${actor.profile.id}`,
      });
    }

    if (method === "DELETE" && path === "/api/me") {
      await deleteAccount(db, actor.user.id);
      return clearSession(json({ ok: true }));
    }

    if (method === "PATCH" && path === "/api/profile") {
      const profile = await updateProfile(db, actor, parse(profileInput, await readJson(req)), ctx.now);
      return json({ profile });
    }

    if (method === "GET" && path === "/api/deck") {
      return json({ deck: await getDeck(db, actor) });
    }

    if (method === "POST" && path === "/api/swipe") {
      return json(await swipe(db, actor, parse(swipeInput, await readJson(req)), ctx.now));
    }

    if (method === "GET" && path === "/api/matches") {
      return json({ matches: await listMatches(db, actor) });
    }

    if (method === "GET" && path.startsWith("/api/matches/") && url.pathname.split("/").length === 4) {
      const id = url.pathname.split("/")[3];
      return json(await getMatch(db, actor, id));
    }

    if (method === "POST" && /\/api\/matches\/[^/]+\/messages$/.test(path)) {
      const matchId = path.split("/")[3];
      const body = parse(messageInput, await readJson(req));
      return json(await sendMessage(db, actor, matchId, body.body, ctx.now));
    }

    if (method === "POST" && /\/api\/matches\/[^/]+\/unmatch$/.test(path)) {
      await unmatch(db, actor, path.split("/")[3], ctx.now);
      return json({ ok: true });
    }

    if (method === "POST" && path === "/api/dates") {
      const body = parse(dateInput, await readJson(req));
      return json(
        await proposeDate(
          db,
          actor,
          {
            matchId: body.matchId,
            startsAt: new Date(body.startsAt),
            timezone: body.timezone || "UTC",
            venue: body.venue,
            notes: body.notes || "",
          },
          ctx.now,
        ),
      );
    }

    if (method === "POST" && /\/api\/dates\/[^/]+\/decide$/.test(path)) {
      const body = (await readJson(req)) as { decision?: "confirmed" | "declined" | "cancelled" };
      if (!body.decision) throw badRequest("decision required");
      return json(await decideDate(db, actor, path.split("/")[3], body.decision, ctx.now));
    }

    if (method === "GET" && path === "/api/approvals") {
      return json({ approvals: await listApprovals(db, actor, url.searchParams.get("status") || "pending") });
    }

    if (method === "POST" && /\/api\/approvals\/[^/]+\/decide$/.test(path)) {
      const body = (await readJson(req)) as { decision?: "approved" | "denied" };
      if (body.decision !== "approved" && body.decision !== "denied") {
        return json({ error: "decision must be approved or denied", code: "validation_error" }, 400);
      }
      return json(await decideApproval(db, actor, path.split("/")[3], body.decision, ctx.now));
    }

    if (method === "POST" && path === "/api/pairing-code") {
      const code = await issuePairingCode(db, actor.user.id, ctx.now);
      return json({ code, expiresInSeconds: 900 });
    }

    if (method === "POST" && /\/api\/keys\/[^/]+\/revoke$/.test(path)) {
      await revokeAgentKey(db, actor.user.id, path.split("/")[3], ctx.now);
      return json({ ok: true });
    }

    if (method === "GET" && path === "/api/connectors") {
      return json({
        connectors: await listConnectors(db, actor),
        events: await connectorFeed(db, actor),
      });
    }

    if (method === "POST" && path === "/api/connectors") {
      return json({ connectors: await setConnector(db, actor, parse(connectorToggleInput, await readJson(req)), ctx.now) });
    }

    if (method === "POST" && path === "/api/block") {
      const body = (await readJson(req)) as { targetId?: string; reason?: string };
      if (!body.targetId) return json({ error: "targetId required", code: "validation_error" }, 400);
      await blockProfile(db, actor, body.targetId, body.reason || "", ctx.now);
      return json({ ok: true });
    }

    if (method === "GET" && path === "/api/activity") {
      return json({ activity: await recentActivity(db, actor.user.id) });
    }

    return json({ error: "Not found", code: "not_found" }, 404);
  } catch (err) {
    if (err instanceof SyntaxError) return json({ error: "Invalid JSON", code: "invalid_json" }, 400);
    return errorResponse(err);
  }
}
