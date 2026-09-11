import { ApprovalsClient } from "@/components/ApprovalsClient";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { listApprovals } from "@/lib/dating";
import { redirect } from "next/navigation";

export default async function ApprovalsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const items = await listApprovals(getDb(), actor, "pending");
  return (
    <div>
      <p className="mark">Approvals</p>
      <h1 className="serif mb-8 mt-2 text-4xl">The claw needs a yes</h1>
      <ApprovalsClient
        items={items.map((i) => ({
          id: i.id,
          kind: i.kind,
          summary: i.summary,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
