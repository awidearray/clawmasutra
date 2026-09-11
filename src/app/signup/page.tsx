import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/ui";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex min-h-full flex-col px-6 py-10">
      <Logo />
      <div className="mx-auto mt-16 w-full max-w-md">
        <h1 className="serif mb-2 text-4xl">Pair a human</h1>
        <p className="mb-6 text-[#b9a79a]">18+ only. Then you hand the claw a key.</p>
        <AuthForm mode="signup" />
        <p className="mt-6 text-center text-sm text-[#b9a79a]">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
