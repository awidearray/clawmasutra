"use client";

import { api } from "@/components/api";
import { Button, Field } from "@/components/ui";
import { useState } from "react";

export function ProfileForm({
  profile,
}: {
  profile: {
    displayName: string;
    headline: string;
    bio: string;
    gender: string;
    seeking: string[];
    city: string;
    region: string;
    country: string;
    interests: string[];
    lookingFor: string;
    occupation: string;
    agentName: string;
    agentStyle: string;
    autonomySwipe: string;
    autonomyMessage: string;
    autonomyDate: string;
    isPublished: boolean;
    photos: { url: string }[];
    prompts: { question: string; answer: string }[];
  };
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const seeking = form.getAll("seeking").map(String);
    const photos = String(form.get("photos") || "")
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
    const prompts = [1, 2, 3]
      .map((n) => ({
        question: String(form.get(`q${n}`) || "").trim(),
        answer: String(form.get(`a${n}`) || "").trim(),
      }))
      .filter((p) => p.question && p.answer);
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.get("displayName"),
          headline: form.get("headline"),
          bio: form.get("bio"),
          gender: form.get("gender"),
          seeking,
          city: form.get("city"),
          region: form.get("region"),
          country: form.get("country"),
          interests: String(form.get("interests") || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          lookingFor: form.get("lookingFor"),
          occupation: form.get("occupation"),
          agentName: form.get("agentName"),
          agentStyle: form.get("agentStyle"),
          autonomySwipe: form.get("autonomySwipe"),
          autonomyMessage: form.get("autonomyMessage"),
          autonomyDate: form.get("autonomyDate"),
          photos,
          prompts,
          isPublished: form.get("isPublished") === "on",
        }),
      });
      setSaved("Saved");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const p = profile.prompts;
  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <Field label="Name" name="displayName" defaultValue={profile.displayName} required />
      <Field label="Headline" name="headline" defaultValue={profile.headline} />
      <label className="md:col-span-2">
        <span className="mark">Bio</span>
        <textarea name="bio" defaultValue={profile.bio} className="mt-2 w-full rounded-xl bg-[#1f1014] p-3" rows={5} />
      </label>
      <label>
        <span className="mark">Gender</span>
        <select name="gender" defaultValue={profile.gender} className="mt-2 w-full rounded-xl bg-[#1f1014] p-3">
          <option value="woman">Woman</option>
          <option value="man">Man</option>
          <option value="nonbinary">Nonbinary</option>
          <option value="other">Other</option>
        </select>
      </label>
      <fieldset>
        <legend className="mark">Seeking</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {["woman", "man", "nonbinary", "other"].map((g) => (
            <label key={g} className="flex items-center gap-2">
              <input type="checkbox" name="seeking" value={g} defaultChecked={profile.seeking.includes(g)} />
              {g}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="City" name="city" defaultValue={profile.city} />
      <Field label="Region" name="region" defaultValue={profile.region} />
      <Field label="Country" name="country" defaultValue={profile.country} />
      <Field label="Occupation" name="occupation" defaultValue={profile.occupation} />
      <Field label="Interests (comma)" name="interests" defaultValue={profile.interests.join(", ")} />
      <label>
        <span className="mark">Looking for</span>
        <select name="lookingFor" defaultValue={profile.lookingFor} className="mt-2 w-full rounded-xl bg-[#1f1014] p-3">
          <option value="dating">Dating</option>
          <option value="relationship">Relationship</option>
          <option value="friends">Friends</option>
          <option value="figuring-out">Figuring out</option>
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="mark">Photo URLs (https, one per line)</span>
        <textarea
          name="photos"
          defaultValue={profile.photos.map((p) => p.url).join("\n")}
          className="mt-2 w-full rounded-xl bg-[#1f1014] p-3"
          rows={3}
        />
      </label>
      {[0, 1, 2].map((i) => (
        <div key={i} className="md:col-span-2 grid gap-2 md:grid-cols-2">
          <Field label={`Prompt ${i + 1}`} name={`q${i + 1}`} defaultValue={p[i]?.question} />
          <Field label="Answer" name={`a${i + 1}`} defaultValue={p[i]?.answer} />
        </div>
      ))}
      <Field label="Claw name" name="agentName" defaultValue={profile.agentName} />
      <Field label="Claw style" name="agentStyle" defaultValue={profile.agentStyle} />
      {(["autonomySwipe", "autonomyMessage", "autonomyDate"] as const).map((name) => (
        <label key={name}>
          <span className="mark">{name.replace("autonomy", "Autonomy ")}</span>
          <select name={name} defaultValue={profile[name]} className="mt-2 w-full rounded-xl bg-[#1f1014] p-3">
            <option value="suggest">Suggest</option>
            <option value="guarded">Guarded</option>
            <option value="auto">Auto</option>
          </select>
        </label>
      ))}
      <label className="flex items-center gap-2 md:col-span-2">
        <input type="checkbox" name="isPublished" defaultChecked={profile.isPublished} />
        Publish this profile to the deck
      </label>
      {error ? <p className="text-[#e8b4b8]">{error}</p> : null}
      {saved ? <p className="text-[#c9a36a]">{saved}</p> : null}
      <div>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
