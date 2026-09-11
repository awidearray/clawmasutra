import { InviteLink } from "@/components/InviteLink";
import { currentActor } from "@/lib/current";
import { getDb } from "@/lib/db";
import { inbox } from "@/lib/dating";
import { recentActivity } from "@/lib/activity";
import { listConnectors } from "@/lib/connectors";
import { appUrl } from "@/lib/config";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function BriefingPage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  const db = getDb();
  const box = await inbox(db, actor);
  const feed = await recentActivity(db, actor.user.id, 12);
  const cons = await listConnectors(db, actor);
  const live = cons.filter((c) => c.enabled);
  return (
    <div className="space-y-8">
      <header>
        <p className="mark">Tonight</p>
        <h1 className="serif mt-2 text-4xl">{actor.profile.displayName}</h1>
        <p className="mt-2 text-[#b9a79a]">
          {actor.profile.isPublished ? "Live on the deck." : "Profile is unpublished — the claw cannot swipe yet."}
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        <Stat href="/app/approvals" label="Approvals" value={box.approvals.length} />
        <Stat href="/app/matches" label="Open matches" value={box.matches.length} />
        <Stat href="/app/connectors" label="Connectors on" value={live.length} />
      </section>
      <InviteLink url={`${appUrl()}/signup?from=${actor.profile.id}`} />
      <section className="panel p-6">
        <p className="mark">Recent</p>
        <ul className="mt-4 space-y-3">
          {feed.length === 0 ? <li className="text-[#b9a79a]">Nothing yet. Pair a claw or open the deck.</li> : null}
          {feed.map((row) => (
            <li key={row.id} className="flex justify-between gap-4 border-b border-[rgba(244,230,208,0.08)] pb-3">
              <span>{row.summary}</span>
              <span className="text-sm text-[#b9a79a]">{row.createdAt.toISOString().slice(0, 16)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="panel block p-6">
      <p className="mark">{label}</p>
      <p className="serif mt-2 text-4xl">{value}</p>
    </Link>
  );
}
