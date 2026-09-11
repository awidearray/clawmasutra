"use client";

import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useRouter } from "next/navigation";

const APPS = ["hinge", "tinder", "bumble", "feeld", "okcupid"] as const;

export function ConnectorsClient({
  connectors,
  events,
}: {
  connectors: { app: string; enabled: boolean; lastEventAt: string | null }[];
  events: { id: string; app: string; type: string; createdAt: string }[];
}) {
  const router = useRouter();
  const byApp = new Map(connectors.map((c) => [c.app, c]));

  async function toggle(app: string, enabled: boolean) {
    await api("/api/connectors", { method: "POST", body: JSON.stringify({ app, enabled }) });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {APPS.map((app) => {
          const row = byApp.get(app);
          return (
            <article key={app} className="panel p-6">
              <p className="serif text-2xl capitalize">{app}</p>
              <p className="mt-2 text-sm text-[#b9a79a]">
                Runs in your OpenClaw browser while you are already logged in. Clawmasutra never stores that password.
              </p>
              <div className="mt-4">
                <Button tone={row?.enabled ? "ghost" : "gold"} onClick={() => toggle(app, !row?.enabled)}>
                  {row?.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel p-6">
        <p className="mark">Reported activity</p>
        <ul className="mt-4 space-y-2">
          {events.length === 0 ? <li className="text-[#b9a79a]">No connector events yet.</li> : null}
          {events.map((e) => (
            <li key={e.id} className="flex justify-between text-sm">
              <span>
                {e.app} · {e.type}
              </span>
              <span className="text-[#b9a79a]">{e.createdAt.slice(0, 16)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
