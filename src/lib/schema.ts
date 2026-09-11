import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }).notNull(),
  claimTokenHash: text("claim_token_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pairingCodes = pgTable("pairing_codes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  codeHash: text("code_hash").notNull(),
  codeDisplay: text("code_display").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentKeys = pgTable("agent_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  tokenHash: text("token_hash").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  gender: text("gender").notNull(),
  seeking: text("seeking").array().notNull(),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  country: text("country").notNull().default(""),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  photos: jsonb("photos").$type<Photo[]>().notNull().default([]),
  prompts: jsonb("prompts").$type<Prompt[]>().notNull().default([]),
  interests: text("interests").array().notNull().default([]),
  lookingFor: text("looking_for").notNull().default("dating"),
  heightCm: integer("height_cm"),
  occupation: text("occupation").notNull().default(""),
  agentName: text("agent_name").notNull().default(""),
  agentStyle: text("agent_style").notNull().default(""),
  autonomySwipe: text("autonomy_swipe").notNull().default("guarded"),
  autonomyMessage: text("autonomy_message").notNull().default("guarded"),
  autonomyDate: text("autonomy_date").notNull().default("guarded"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const swipes = pgTable(
  "swipes",
  {
    id: text("id").primaryKey(),
    fromProfileId: text("from_profile_id").notNull(),
    toProfileId: text("to_profile_id").notNull(),
    direction: text("direction").notNull(),
    reason: text("reason").notNull().default(""),
    source: text("source").notNull().default("clawmasutra"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("swipes_unique").on(t.fromProfileId, t.toProfileId)],
);

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    aProfileId: text("a_profile_id").notNull(),
    bProfileId: text("b_profile_id").notNull(),
    unmatchedAt: timestamp("unmatched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("matches_unique").on(t.aProfileId, t.bProfileId)],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id").notNull(),
    senderProfileId: text("sender_profile_id").notNull(),
    body: text("body").notNull(),
    kind: text("kind").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_match_idx").on(t.matchId, t.createdAt)],
);

export const dateProposals = pgTable("date_proposals", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  proposerProfileId: text("proposer_profile_id").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  venue: text("venue").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("pending_proposer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blocks = pgTable(
  "blocks",
  {
    id: text("id").primaryKey(),
    fromProfileId: text("from_profile_id").notNull(),
    toProfileId: text("to_profile_id").notNull(),
    reason: text("reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocks_unique").on(t.fromProfileId, t.toProfileId)],
);

export const connectors = pgTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    app: text("app").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    notes: text("notes").notNull().default(""),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connectors_unique").on(t.userId, t.app)],
);

export const connectorEvents = pgTable("connector_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  app: text("app").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Photo = { url: string; alt?: string };
export type Prompt = { question: string; answer: string };
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DateProposal = typeof dateProposals.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Connector = typeof connectors.$inferSelect;
export type ConnectorEvent = typeof connectorEvents.$inferSelect;
