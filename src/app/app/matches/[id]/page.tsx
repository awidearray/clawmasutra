import { MatchThread } from "@/components/MatchThread";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { getMatch } from "@/lib/dating";
import { redirect } from "next/navigation";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const data = await getMatch(getDb(), actor, id);
  return (
    <div>
      <p className="mark">Match</p>
      <h1 className="serif mb-8 mt-2 text-4xl">{data.other?.displayName}</h1>
      <MatchThread
        matchId={id}
        meId={actor.profile.id}
        messages={data.messages.map((m) => ({
          id: m.id,
          body: m.body,
          kind: m.kind,
          senderProfileId: m.senderProfileId,
          createdAt: m.createdAt.toISOString(),
        }))}
        dates={data.dates.map((d) => ({
          id: d.id,
          venue: d.venue,
          startsAt: d.startsAt.toISOString(),
          status: d.status,
          proposerProfileId: d.proposerProfileId,
        }))}
      />
    </div>
  );
}
