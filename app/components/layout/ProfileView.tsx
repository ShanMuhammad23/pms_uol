import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import {
  getUserProfileByEmail,
  UserProfileError,
} from "@/lib/queries/user-profile";
import type { UserProfile } from "@/lib/queries/user-profile";
import ProfileViewClient from "./ProfileViewClient";

async function loadProfile(email: string): Promise<
  | { ok: true; profile: UserProfile }
  | { ok: false; message: string }
> {
  try {
    const profile = await getUserProfileByEmail(email);
    return { ok: true, profile };
  } catch (error) {
    const message =
      error instanceof UserProfileError
        ? error.message
        : "Unable to fetch profile right now. Please try again later.";

    return { ok: false, message };
  }
}

export default async function ProfileView() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!session || !email) {
    redirect("/");
  }

  const result = await loadProfile(email);

  if (!result.ok) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-[#E07A5F]/30 bg-[#E07A5F]/10 p-6">
          <h1 className="text-xl font-semibold text-text-primary">Profile Unavailable</h1>
          <p className="mt-2 text-sm text-foreground/80">{result.message}</p>
        </div>
      </section>
    );
  }

  return <ProfileViewClient profile={result.profile} />;
}
