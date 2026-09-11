import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

export type AppDb = PostgresJsDatabase<typeof schema>;

let sql: Sql | null = null;
let db: AppDb | null = null;

export function getSql(): Sql {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  sql = postgres(url, {
    max: 8,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") || url.includes(".railway.internal")
      ? false
      : "require",
  });
  return sql;
}

export function getDb(): AppDb {
  if (db) return db;
  db = drizzle(getSql(), { schema });
  return db;
}

export async function migrateSql(client: { unsafe: (q: string) => Promise<unknown> }, sqlText: string) {
  await client.unsafe(sqlText);
}

export function loadInitSql(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "drizzle/0000_init.sql"),
    join(here, "../../drizzle/0000_init.sql"),
  ];
  for (const path of candidates) {
    try {
      return readFileSync(/* turbopackIgnore: true */ path, "utf8");
    } catch {
      /* next */
    }
  }
  throw new Error("drizzle/0000_init.sql not found");
}

export async function applyMigrations(client: Sql): Promise<void> {
  const body = loadInitSql();
  await client.unsafe(body);
  await client`
    INSERT INTO schema_migrations (id)
    VALUES ('0000_init.sql')
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function pingDb(): Promise<boolean> {
  const rows = await getSql()`SELECT 1 AS ok`;
  return rows[0]?.ok === 1;
}
