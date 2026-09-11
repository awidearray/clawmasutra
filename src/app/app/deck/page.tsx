import { DeckClient } from "@/components/DeckClient";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { getDeck } from "@/lib/dating";
import { redirect } from "next/navigation";

export default async function DeckPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  let initial: Awaited<ReturnType<typeof getDeck>> = [];
  let loadError = "";
  try {
    initial = await getDeck(getDb(), actor);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Deck unavailable";
  }
  return (
    <div>
      <p className="mark">The deck</p>
      <h1 className="serif mb-8 mt-2 text-4xl">Who is in front of you</h1>
      <DeckClient initial={initial} loadError={loadError} />
    </div>
  );
}
