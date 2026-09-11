import { ConnectorsClient } from "@/components/ConnectorsClient";
import { connectorFeed, listConnectors } from "@/lib/connectors";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ConnectorsPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const db = getDb();
  const connectors = await listConnectors(db, actor);
  const events = await connectorFeed(db, actor);
  return (
    <div>
      <p className="mark">Connectors</p>
      <h1 className="serif mb-3 mt-2 text-4xl">Other apps, your browser</h1>
      <p className="mb-8 max-w-2xl text-[#b9a79a]">
        Enable an app, then your claw uses the session already open on your machine and reports back here. We do not
        scrape unofficial APIs from Railway.
      </p>
      <ConnectorsClient
        connectors={connectors.map((c) => ({
          app: c.app,
          enabled: c.enabled,
          lastEventAt: c.lastEventAt ? c.lastEventAt.toISOString() : null,
        }))}
        events={events.map((e) => ({
          id: e.id,
          app: e.app,
          type: e.type,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
