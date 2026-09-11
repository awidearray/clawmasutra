import { skillMarkdown } from "@/lib/skill-doc";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(skillMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
