import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const body = readFileSync(join(root, "drizzle/0000_init.sql"), "utf8");
const sql = postgres(url, {
  max: 1,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") || url.includes(".railway.internal") ? false : "require",
});

await sql.unsafe(body);
await sql`
  INSERT INTO schema_migrations (id)
  VALUES ('0000_init.sql')
  ON CONFLICT (id) DO NOTHING
`;
await sql.end();
console.log("migrations applied");
