import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { createHuman, type Actor } from "@/lib/auth";
import type { AppDb } from "@/lib/db";
import * as schema from "@/lib/schema";
import { updateProfile } from "@/lib/dating";
import { resetRateLimits } from "@/lib/rate-limit";

export async function createTestDb(): Promise<AppDb> {
  const client = new PGlite();
  const sql = readFileSync("drizzle/0000_init.sql", "utf8");
  await client.exec(sql);
  resetRateLimits();
  return drizzle(client, { schema }) as unknown as AppDb;
}

export async function publishedHuman(
  db: AppDb,
  input: {
    email: string;
    name: string;
    gender: "woman" | "man" | "nonbinary" | "other";
    seeking: Array<"woman" | "man" | "nonbinary" | "other">;
    city?: string;
    interests?: string[];
  },
): Promise<Actor> {
  const { user, profile } = await createHuman(db, {
    email: input.email,
    password: "correct-horse-battery",
    name: input.name,
    age: 29,
  });
  const actor: Actor = { user, profile, via: "human" };
  const next = await updateProfile(db, actor, {
    gender: input.gender,
    seeking: input.seeking,
    city: input.city ?? "Austin",
    bio: `${input.name} likes coffee and walking.`,
    interests: input.interests ?? ["coffee", "walking"],
    lookingFor: "dating",
    isPublished: true,
  });
  return { user, profile: next, via: "human" };
}
