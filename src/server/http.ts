import { AppError } from "@/lib/errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  const message = err instanceof Error ? err.message : "Internal error";
  console.error(err);
  return json({ error: message, code: "internal" }, 500);
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  return JSON.parse(text) as unknown;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function bearer(req: Request): string | undefined {
  return req.headers.get("authorization") || undefined;
}

export function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") || "";
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}
