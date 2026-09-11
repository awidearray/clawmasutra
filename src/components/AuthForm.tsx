"use client";

import { api } from "@/components/api";
import { Button, Field } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({
  mode,
  token = "",
}: {
  mode: "login" | "signup" | "claim";
  token?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      if (mode === "login") {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: String(form.get("email")),
            password: String(form.get("password")),
          }),
        });
      } else if (mode === "signup") {
        await api("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email: String(form.get("email")),
            password: String(form.get("password")),
            name: String(form.get("name")),
            age: Number(form.get("age")),
            ageConfirmed: true,
          }),
        });
      } else {
        await api("/api/auth/claim", {
          method: "POST",
          body: JSON.stringify({
            token: String(form.get("token")),
            email: String(form.get("email")),
            password: String(form.get("password")),
          }),
        });
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel mx-auto w-full max-w-md space-y-4 p-8">
      {mode === "signup" ? (
        <>
          <Field label="Name" name="name" required />
          <Field label="Age" name="age" type="number" required min={18} max={99} />
        </>
      ) : null}
      {mode === "claim" ? <input type="hidden" name="token" value={token} /> : null}
      <Field label="Email" name="email" type="email" required />
      <Field label="Password" name="password" type="password" required />
      {mode === "signup" ? (
        <label className="flex items-start gap-2 text-sm text-[#b9a79a]">
          <input type="checkbox" name="ageConfirmed" required className="mt-1" />
          I am 18 or older and this profile is me, not someone else.
        </label>
      ) : null}
      {error ? <p className="text-sm text-[#e8b4b8]">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Working…" : mode === "login" ? "Enter" : mode === "claim" ? "Claim account" : "Create account"}
      </Button>
    </form>
  );
}
