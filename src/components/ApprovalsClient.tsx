"use client";

import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Approval = { id: string; kind: string; summary: string; createdAt: string };

export function ApprovalsClient({ items }: { items: Approval[] }) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function decide(id: string, decision: "approved" | "denied") {
    setError("");
    try {
      await api(`/api/approvals/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (items.length === 0) {
    return <p className="text-[#b9a79a]">Nothing waiting. The claw is either quiet or already trusted.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article key={item.id} className="panel flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="mark">{item.kind}</p>
            <p className="mt-2 text-lg">{item.summary}</p>
          </div>
          <div className="flex gap-2">
            <Button tone="ghost" onClick={() => decide(item.id, "denied")}>
              Deny
            </Button>
            <Button onClick={() => decide(item.id, "approved")}>Approve</Button>
          </div>
        </article>
      ))}
      {error ? <p className="text-[#e8b4b8]">{error}</p> : null}
    </div>
  );
}
