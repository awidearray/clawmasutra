import { pingDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await pingDb();
  return Response.json({ ok: db, service: "clawmasutra", db });
}
