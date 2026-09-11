export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;
  const { applyMigrations, getSql } = await import("./lib/db");
  await applyMigrations(getSql());
}
