import { LogoutButton } from "@/components/LogoutButton";
import { Logo } from "@/components/ui";
import { currentActor } from "@/lib/current";
import Link from "next/link";
import { redirect } from "next/navigation";

const links = [
  ["Briefing", "/app"],
  ["Deck", "/app/deck"],
  ["Matches", "/app/matches"],
  ["Approvals", "/app/approvals"],
  ["Claw", "/app/claw"],
  ["Connectors", "/app/connectors"],
  ["Profile", "/app/profile"],
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return (
    <div className="min-h-full">
      <header className="border-b border-[rgba(244,230,208,0.12)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Logo href="/app" />
          <nav className="flex flex-wrap gap-4 text-sm text-[#b9a79a]">
            {links.map(([label, href]) => (
              <Link key={href} href={href} className="hover:text-[#f4e6d0]">
                {label}
              </Link>
            ))}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}


