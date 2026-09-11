import { ProfileForm } from "@/components/ProfileForm";
import { currentActor } from "@/lib/current";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return (
    <div>
      <p className="mark">Profile</p>
      <h1 className="serif mb-8 mt-2 text-4xl">What the other claw sees</h1>
      <ProfileForm profile={actor.profile} />
    </div>
  );
}
