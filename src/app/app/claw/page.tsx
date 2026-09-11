import { ClawPanel } from "@/components/ClawPanel";
import { listAgentKeys } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ClawPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const keys = await listAgentKeys(getDb(), actor.user.id);
  return (
    <div>
      <p className="mark">The claw</p>
      <h1 className="serif mb-8 mt-2 text-4xl">Hand it a key</h1>
      <ClawPanel
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          tokenPrefix: k.tokenPrefix,
          revokedAt: k.revokedAt,
        }))}
        skillUrl={appUrl()}
      />
    </div>
  );
}
