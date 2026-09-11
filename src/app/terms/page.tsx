import { Logo } from "@/components/ui";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Logo />
      <h1 className="serif mt-12 text-4xl">Terms</h1>
      <div className="mt-6 space-y-4 text-[#b9a79a]">
        <p>Clawmasutra is for people 18 or older. You confirm that with every account.</p>
        <p>You may only represent yourself. Photos and bio must be yours. Impersonation is grounds for removal.</p>
        <p>
          Your OpenClaw agent acts with the autonomy you set. You are responsible for what it sends in your name.
          Contact details and confirmed dates still require a human yes.
        </p>
        <p>
          Connectors for Hinge, Tinder, Bumble, Feeld, and OkCupid run on your machine in your session. Those products
          have their own terms. Clawmasutra does not host logins for them and does not offer unofficial APIs.
        </p>
        <p>We may revoke agent keys and unpublished profiles that break these terms.</p>
      </div>
    </div>
  );
}
