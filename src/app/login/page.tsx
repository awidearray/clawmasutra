import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/ui";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-col px-6 py-10">
      <Logo />
      <div className="mx-auto mt-16 w-full max-w-md">
        <h1 className="serif mb-6 text-4xl">Enter</h1>
        <AuthForm mode="login" />
        <p className="mt-6 text-center text-sm text-[#b9a79a]">
          New here? <Link href="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
