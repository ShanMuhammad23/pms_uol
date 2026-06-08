import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import {
  getUserProfileByEmail,
  UserProfileError,
} from "@/lib/queries/user-profile";
import ProfileViewClient from "./ProfileViewClient";

export default async function ProfileView() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!session || !email) {
    redirect("/");
  }

  try {
    const profile = await getUserProfileByEmail(email);
    return <ProfileViewClient profile={profile} />;
  } catch (error) {
    const message =
      error instanceof UserProfileError
        ? error.message
        : "Unable to fetch profile right now. Please try again later.";

    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[#E07A5F]/30 bg-[#E07A5F]/10 p-6">
          <h1 className="text-xl font-semibold text-text-primary">Profile Unavailable</h1>
          <p className="mt-2 text-sm text-foreground/80">{message}</p>
        </div>
      </section>
    );
  }
}
