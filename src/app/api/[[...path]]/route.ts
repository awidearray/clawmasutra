import { getDb } from "@/lib/db";
import { handleHumanRequest } from "@/server/human-api";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  return handleHumanRequest(req, { db: getDb() });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
