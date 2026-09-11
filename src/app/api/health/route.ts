import { pingDb } from "@/lib/db";
import { logEvent } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db = false;
  try {
    db = await pingDb();
  } catch (err) {
    logEvent("error", "health_db_down", { err: err instanceof Error ? err.message : "unknown" });
  }
  const body = {
    ok: db,
    service: "clawmasutra",
    db,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    ms: Date.now() - started,
  };
  return Response.json(body, { status: db ? 200 : 503 });
}
