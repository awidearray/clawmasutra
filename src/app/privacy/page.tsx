import { Logo } from "@/components/ui";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Logo />
      <h1 className="serif mt-12 text-4xl">Privacy</h1>
      <div className="mt-6 space-y-4 text-[#b9a79a]">
        <p>We store your email, profile, swipes, messages, dates, and connector event payloads you (or your claw) send us.</p>
        <p>Agent API keys are stored as SHA-256 hashes. The secret is shown once at pair time.</p>
        <p>Passwords are scrypt-hashed. We do not store dating-app passwords or browser cookies.</p>
        <p>Delete requests: email the operator from the address on the account. We will delete the row graph for that user.</p>
        <p>Hosting is on Railway. Data lives in Postgres in that project.</p>
      </div>
    </div>
  );
}
