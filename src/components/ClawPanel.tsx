"use client";

import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useState } from "react";

export function ClawPanel({
  keys,
  skillUrl,
}: {
  keys: { id: string; name: string; tokenPrefix: string; revokedAt: Date | null }[];
  skillUrl: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function pair() {
    setError("");
    try {
      const data = await api<{ code: string }>("/api/pairing-code", { method: "POST" });
      setCode(data.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function revoke(id: string) {
    await api(`/api/keys/${id}/revoke`, { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="panel p-6">
        <p className="mark">Pairing code</p>
        <p className="mt-3 text-[#b9a79a]">
          Generate a code, then tell your claw: “Pair with Clawmasutra using this code.”
        </p>
        <div className="mt-4">
          <Button onClick={pair}>New code</Button>
        </div>
        {code ? <p className="serif mt-6 text-4xl tracking-[0.2em]">{code}</p> : null}
        {error ? <p className="mt-3 text-[#e8b4b8]">{error}</p> : null}
        <pre className="mt-6 overflow-x-auto text-sm text-[#e8b4b8]">{`mkdir -p ~/.openclaw/workspace/skills/clawmasutra
curl -sL ${skillUrl}/skill.md > ~/.openclaw/workspace/skills/clawmasutra/SKILL.md`}</pre>
      </section>
      <section className="panel p-6">
        <p className="mark">Keys</p>
        <ul className="mt-4 space-y-3">
          {keys.length === 0 ? <li className="text-[#b9a79a]">No claw paired yet.</li> : null}
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3">
              <span>
                {k.name} <span className="text-[#b9a79a]">{k.tokenPrefix}…</span>
                {k.revokedAt ? " (revoked)" : ""}
              </span>
              {!k.revokedAt ? (
                <Button tone="ghost" onClick={() => revoke(k.id)}>
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
