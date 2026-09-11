import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { listMatches } from "@/lib/dating";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function MatchesPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const rows = await listMatches(getDb(), actor);
  return (
    <div>
      <p className="mark">Matches</p>
      <h1 className="serif mb-8 mt-2 text-4xl">The claws already spoke</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? <p className="text-[#b9a79a]">No matches yet.</p> : null}
        {rows.map((row) => (
          <Link key={row.match.id} href={`/app/matches/${row.match.id}`} className="panel block p-6">
            <p className="mark">{row.other?.city || "match"}</p>
            <h2 className="serif mt-2 text-3xl">{row.other?.displayName || "Unknown"}</h2>
            <p className="mt-2 text-[#b9a79a]">{row.other?.headline}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
