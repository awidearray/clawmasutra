import { recentActivity } from "@/lib/activity";
import {
  actorFromAgentKey,
  issuePairingCode,
  listAgentKeys,
  loadActor,
  pairAgent,
} from "@/lib/auth";
import { CONNECTOR_APPS, appUrl } from "@/lib/config";
import { connectorFeed, listConnectors, recordConnectorEvent, setConnector } from "@/lib/connectors";
import type { AppDb } from "@/lib/db";
import {
  blockProfile,
  decideDate,
  getDeck,
  getMatch,
  inbox,
  listMatches,
  proposeDate,
  sendMessage,
  swipe,
  unmatch,
  updateProfile,
} from "@/lib/dating";
import { AppError, unauthorized } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { registerAgent } from "@/lib/register-agent";
import {
  agentRegisterInput,
  connectorEventInput,
  connectorToggleInput,
  dateInput,
  messageInput,
  pairInput,
  parse,
  profileInput,
  swipeInput,
} from "@/lib/validate";
import { bearer, clientIp, errorResponse, json, readJson } from "./http";

type Ctx = { db: AppDb; now?: Date };

function pathOf(req: Request): { method: string; path: string; parts: string[] } {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  return { method: req.method, path, parts: path.split("/").filter(Boolean) };
}

async function requireAgent(db: AppDb, req: Request) {
  const actor = await actorFromAgentKey(db, bearer(req));
  if (!actor) throw unauthorized("Provide Authorization: Bearer cms_live_…");
  return actor;
}

export async function handleAgentRequest(req: Request, ctx: Ctx): Promise<Response> {
  try {
    const { method, path, parts } = pathOf(req);
    const db = ctx.db;
    const ip = clientIp(req);

    if (method === "GET" && path === "/api/v1/health") {
      return json({ ok: true, service: "clawmasutra" });
    }

    if (method === "POST" && path === "/api/v1/agents/register") {
      rateLimit(`reg:${ip}`, 10, 60 * 60 * 1000);
      const body = parse(agentRegisterInput, await readJson(req));
      const result = await registerAgent(db, body, ctx.now);
      return json(result, 201);
    }

    if (method === "POST" && path === "/api/v1/agents/pair") {
      rateLimit(`pair:${ip}`, 20, 60 * 60 * 1000);
      const body = parse(pairInput, await readJson(req));
      const result = await pairAgent(db, body, ctx.now);
      return json({
        apiKey: result.apiKey,
        profileId: result.actor.profile.id,
        displayName: result.actor.profile.displayName,
      });
    }

    const actor = await requireAgent(db, req);
    rateLimit(`agent:${actor.user.id}`, 120, 60 * 1000);

    if (method === "GET" && path === "/api/v1/me") {
      const keys = await listAgentKeys(db, actor.user.id);
      return json({
        user: { id: actor.user.id, name: actor.user.name, age: actor.user.age, email: actor.user.email },
        profile: actor.profile,
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.tokenPrefix,
          lastSeenAt: k.lastSeenAt,
          revokedAt: k.revokedAt,
        })),
        inviteUrl: `${appUrl()}/signup?from=${actor.profile.id}`,
      });
    }

    if (method === "GET" && path === "/api/v1/inbox") {
      return json(await inbox(db, actor));
    }

    if (method === "PATCH" && path === "/api/v1/profile") {
      const body = parse(profileInput, await readJson(req));
      const profile = await updateProfile(db, actor, body, ctx.now);
      return json({ profile });
    }

    if (method === "GET" && path === "/api/v1/deck") {
      return json({ deck: await getDeck(db, actor) });
    }

    if (method === "POST" && path === "/api/v1/swipe") {
      const body = parse(swipeInput, await readJson(req));
      return json(await swipe(db, actor, body, ctx.now));
    }

    if (method === "GET" && path === "/api/v1/matches") {
      return json({ matches: await listMatches(db, actor) });
    }

    if (method === "GET" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "matches" && parts[3] && !parts[4]) {
      return json(await getMatch(db, actor, parts[3]));
    }

    if (method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "matches" && parts[3] && parts[4] === "messages") {
      const body = parse(messageInput, await readJson(req));
      return json(await sendMessage(db, actor, parts[3], body.body, ctx.now));
    }

    if (method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "matches" && parts[3] && parts[4] === "unmatch") {
      await unmatch(db, actor, parts[3], ctx.now);
      return json({ ok: true });
    }

    if (method === "POST" && path === "/api/v1/block") {
      const body = (await readJson(req)) as { targetId?: string; reason?: string };
      if (!body.targetId) throw new AppError(400, "targetId required", "validation_error");
      await blockProfile(db, actor, body.targetId, body.reason || "", ctx.now);
      return json({ ok: true });
    }

    if (method === "POST" && path === "/api/v1/dates") {
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

    if (method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "dates" && parts[3] && parts[4] === "decide") {
      const body = (await readJson(req)) as { decision?: string };
      const decision = body.decision;
      if (decision !== "confirmed" && decision !== "declined" && decision !== "cancelled") {
        throw new AppError(400, "decision must be confirmed, declined, or cancelled", "validation_error");
      }
      return json(await decideDate(db, actor, parts[3], decision, ctx.now));
    }

    if (method === "GET" && path === "/api/v1/connectors") {
      return json({ connectors: await listConnectors(db, actor) });
    }

    if (method === "POST" && path === "/api/v1/connectors") {
      const body = parse(connectorToggleInput, await readJson(req));
      return json({ connectors: await setConnector(db, actor, body, ctx.now) });
    }

    if (method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "connectors" && parts[3] && parts[4] === "events") {
      const app = parts[3];
      if (!CONNECTOR_APPS.includes(app as (typeof CONNECTOR_APPS)[number])) {
        throw new AppError(400, "Unknown dating app", "validation_error");
      }
      const body = parse(connectorEventInput, await readJson(req));
      return json(await recordConnectorEvent(db, actor, app, body, ctx.now));
    }

    if (method === "GET" && path === "/api/v1/connectors/events") {
      return json({ events: await connectorFeed(db, actor) });
    }

    if (method === "GET" && path === "/api/v1/activity") {
      return json({ activity: await recentActivity(db, actor.user.id) });
    }

    if (method === "POST" && path === "/api/v1/heartbeat") {
      const box = await inbox(db, actor);
      return json({
        ok: true,
        pendingApprovals: box.approvals.length,
        matches: box.matches.length,
        published: box.published,
        next: box.approvals.length
          ? "Ask your human to review pending approvals in the dashboard."
          : box.published
            ? "Pull /api/v1/deck and swipe with a written reason."
            : "Finish and publish the profile before swiping.",
      });
    }

    if (method === "POST" && path === "/api/v1/pairing-code") {
      const actorHuman = await loadActor(db, actor.user.id, "human");
      if (!actorHuman) throw unauthorized();
      const code = await issuePairingCode(db, actor.user.id, ctx.now);
      return json({ code, expiresInSeconds: 900 });
    }

    return json({ error: "Not found", code: "not_found" }, 404);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return json({ error: "Invalid JSON", code: "invalid_json" }, 400);
    }
    return errorResponse(err);
  }
}
