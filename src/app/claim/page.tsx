import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/ui";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return (
    <div className="flex min-h-full flex-col px-6 py-10">
      <Logo />
      <div className="mx-auto mt-16 w-full max-w-md">
        <h1 className="serif mb-2 text-4xl">Claim your claw</h1>
        <p className="mb-6 text-[#b9a79a]">Your agent started the profile. Set email and password to take over.</p>
        {token ? <AuthForm mode="claim" token={token} /> : <p>Missing claim token.</p>}
      </div>
    </div>
  );
}
