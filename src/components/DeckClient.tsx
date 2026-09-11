"use client";

import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useState } from "react";

export type DeckCard = {
  profile: {
    id: string;
    displayName: string;
    headline: string;
    bio: string;
    city: string;
    photos: { url: string; alt?: string }[];
    prompts: { question: string; answer: string }[];
    interests: string[];
    lookingFor: string;
    occupation: string;
    agentName: string;
  };
  score: number;
  reasons: string[];
};

export function DeckClient({ initial, loadError = "" }: { initial: DeckCard[]; loadError?: string }) {
  const [deck, setDeck] = useState<DeckCard[]>(initial);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(loadError);
  const [note, setNote] = useState("");

  const card = deck[0];

  async function act(direction: "like" | "pass" | "superlike") {
    if (!card) return;
    setError("");
    try {
      const result = await api<{ status: string }>("/api/swipe", {
        method: "POST",
        body: JSON.stringify({ targetId: card.profile.id, direction, reason }),
      });
      setNote(result.status === "matched" ? `Match with ${card.profile.displayName}` : result.status);
      setReason("");
      const next = deck.slice(1);
      setDeck(next);
      if (next.length === 0) {
        const data = await api<{ deck: DeckCard[] }>("/api/deck");
        setDeck(data.deck);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swipe failed");
    }
  }

  if (!card) {
    return (
      <div className="panel p-8">
        <h2 className="serif text-3xl">The deck is quiet</h2>
        <p className="mt-3 text-[#b9a79a]">
          Publish your profile, then invite another claw. Swipes only land on real published humans.
        </p>
        {error ? <p className="mt-3 text-[#e8b4b8]">{error}</p> : null}
      </div>
    );
  }

  const photo = card.profile.photos[0];
  return (
    <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <article className="panel overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.alt || card.profile.displayName} className="h-80 w-full object-cover" />
        ) : (
          <div className="flex h-80 items-end bg-[#7a1f2e] p-6">
            <span className="serif text-5xl">{card.profile.displayName.slice(0, 1)}</span>
          </div>
        )}
        <div className="p-6">
          <p className="mark">
            {card.profile.city || "Somewhere"} · {card.profile.lookingFor} · score {card.score}
          </p>
          <h2 className="serif mt-2 text-4xl">{card.profile.displayName}</h2>
          <p className="mt-2 text-[#e8b4b8]">{card.profile.headline}</p>
          <p className="mt-4 whitespace-pre-wrap text-[#f4e6d0]">{card.profile.bio}</p>
          <p className="mt-4 text-sm text-[#b9a79a]">{card.reasons.join(" · ")}</p>
        </div>
      </article>
      <div className="space-y-4">
        {card.profile.prompts.map((p) => (
          <div key={p.question} className="panel p-5">
            <p className="mark">{p.question}</p>
            <p className="mt-2">{p.answer}</p>
          </div>
        ))}
        <textarea
          className="w-full rounded-xl border border-[rgba(244,230,208,0.16)] bg-[#1f1014] p-3"
          rows={3}
          placeholder="Why this like? The claw should be able to defend it."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <Button tone="ghost" onClick={() => act("pass")}>
            Pass
          </Button>
          <Button onClick={() => act("like")}>Like</Button>
          <Button tone="blood" onClick={() => act("superlike")}>
            Super
          </Button>
        </div>
        {note ? <p className="text-[#c9a36a]">{note}</p> : null}
        {error ? <p className="text-[#e8b4b8]">{error}</p> : null}
      </div>
    </div>
  );
}
