import { heartbeatMarkdown } from "@/lib/skill-doc";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(heartbeatMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
