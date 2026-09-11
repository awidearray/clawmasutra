import { getDb } from "@/lib/db";
import { handleAgentRequest } from "@/server/agent-api";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  return handleAgentRequest(req, { db: getDb() });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
