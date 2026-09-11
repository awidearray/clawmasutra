import { desc, eq } from "drizzle-orm";
import { logActivity } from "./activity";
import type { Actor } from "./auth";
import { CONNECTOR_APPS, type ConnectorApp } from "./config";
import { id } from "./crypto";
import type { AppDb } from "./db";
import { badRequest } from "./errors";
import { connectorEvents, connectors } from "./schema";

export async function listConnectors(db: AppDb, actor: Actor) {
  const rows = await db.select().from(connectors).where(eq(connectors.userId, actor.user.id));
  const byApp = new Map(rows.map((r) => [r.app, r]));
  return CONNECTOR_APPS.map((app) => byApp.get(app) ?? {
    id: null,
    userId: actor.user.id,
    app,
    enabled: false,
    notes: "",
    lastEventAt: null,
    createdAt: null,
  });
}

export async function setConnector(
  db: AppDb,
  actor: Actor,
  input: { app: ConnectorApp; enabled: boolean; notes?: string },
  now = new Date(),
) {
  const existing = await db
    .select()
    .from(connectors)
    .where(eq(connectors.userId, actor.user.id));
  const row = existing.find((r) => r.app === input.app);
  if (row) {
    await db
      .update(connectors)
      .set({ enabled: input.enabled, notes: input.notes ?? row.notes })
      .where(eq(connectors.id, row.id));
  } else {
    await db.insert(connectors).values({
      id: id("con"),
      userId: actor.user.id,
      app: input.app,
      enabled: input.enabled,
      notes: input.notes ?? "",
      lastEventAt: null,
      createdAt: now,
    });
  }
  await logActivity(
    db,
    actor.user.id,
    "connector",
    `${input.app} ${input.enabled ? "enabled" : "disabled"}`,
    { app: input.app },
    now,
  );
  return listConnectors(db, actor);
}

export async function recordConnectorEvent(
  db: AppDb,
  actor: Actor,
  app: string,
  input: { type: string; payload: Record<string, unknown> },
  now = new Date(),
) {
  if (!CONNECTOR_APPS.includes(app as ConnectorApp)) throw badRequest("Unknown dating app");
  const enabled = (await listConnectors(db, actor)).find((c) => c.app === app);
  if (!enabled?.enabled) throw badRequest(`${app} connector is not enabled by the human`);
  await db.insert(connectorEvents).values({
    id: id("cev"),
    userId: actor.user.id,
    app,
    type: input.type,
    payload: input.payload,
    createdAt: now,
  });
  const rows = await db.select().from(connectors).where(eq(connectors.userId, actor.user.id));
  const con = rows.find((r) => r.app === app);
  if (con) {
    await db.update(connectors).set({ lastEventAt: now }).where(eq(connectors.id, con.id));
  }
  await logActivity(
    db,
    actor.user.id,
    "connector_event",
    `${app}: ${input.type}`,
    { app, type: input.type },
    now,
  );
  return { status: "recorded" as const };
}

export async function connectorFeed(db: AppDb, actor: Actor, limit = 50) {
  return db
    .select()
    .from(connectorEvents)
    .where(eq(connectorEvents.userId, actor.user.id))
    .orderBy(desc(connectorEvents.createdAt))
    .limit(limit);
}
