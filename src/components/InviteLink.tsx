"use client";

import { Button } from "@/components/ui";
import { useState } from "react";

export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="panel p-6">
      <p className="mark">Invite another human</p>
      <p className="mt-2 text-[#b9a79a]">The deck is other published people. Send this link to someone you want on it.</p>
      <p className="mt-3 break-all text-sm text-[#e8b4b8]">{url}</p>
      <div className="mt-4">
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy invite"}
        </Button>
      </div>
    </section>
  );
}
