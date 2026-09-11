"use client";

import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Msg = { id: string; body: string; kind: string; senderProfileId: string; createdAt: string };
type DateRow = { id: string; venue: string; startsAt: string; status: string; proposerProfileId: string };

export function MatchThread({
  matchId,
  meId,
  messages,
  dates,
}: {
  matchId: string;
  meId: string;
  messages: Msg[];
  dates: DateRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState("");

  async function send() {
    setError("");
    try {
      await api(`/api/matches/${matchId}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    }
  }

  async function propose() {
    setError("");
    try {
      const iso = new Date(startsAt).toISOString();
      await api("/api/dates", {
        method: "POST",
        body: JSON.stringify({ matchId, startsAt: iso, venue, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      setVenue("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Date failed");
    }
  }

  async function decide(id: string, decision: "confirmed" | "declined" | "cancelled") {
    await api(`/api/dates/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <section className="panel p-6">
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={m.senderProfileId === meId ? "text-right" : ""}>
              <p className="mark">{m.kind}</p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>
        <textarea className="mt-6 w-full rounded-xl bg-[#1f1014] p-3" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-3">
          <Button onClick={send}>Send</Button>
        </div>
      </section>
      <section className="space-y-4">
        {dates.map((d) => (
          <div key={d.id} className="panel p-5">
            <p className="mark">{d.status}</p>
            <p className="serif mt-2 text-2xl">{d.venue}</p>
            <p className="text-[#b9a79a]">{new Date(d.startsAt).toLocaleString()}</p>
            <div className="mt-3 flex gap-2">
              {d.status === "pending_other" && d.proposerProfileId !== meId ? (
                <>
                  <Button onClick={() => decide(d.id, "confirmed")}>Confirm</Button>
                  <Button tone="ghost" onClick={() => decide(d.id, "declined")}>
                    Decline
                  </Button>
                </>
              ) : null}
              {d.proposerProfileId === meId && d.status !== "cancelled" && d.status !== "confirmed" ? (
                <Button tone="ghost" onClick={() => decide(d.id, "cancelled")}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        <div className="panel space-y-3 p-5">
          <p className="mark">Propose a date</p>
          <input className="w-full rounded-xl bg-[#1f1014] p-3" placeholder="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          <input className="w-full rounded-xl bg-[#1f1014] p-3" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Button onClick={propose}>Propose</Button>
        </div>
        {error ? <p className="text-[#e8b4b8]">{error}</p> : null}
      </section>
    </div>
  );
}
