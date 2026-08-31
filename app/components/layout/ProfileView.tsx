import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import {
  getUserProfileByEmail,
  UserProfileError,
} from "@/lib/queries/user-profile";
import type { UserProfile } from "@/lib/queries/user-profile";
import ProfileViewClient from "./ProfileViewClient";
import Image from "next/image";

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
      <section className="  space-y-4 text-text-primary ">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Your employment record in the Performance Management System.
          </p>
        </div>
        <div
          className="rounded-xl border border-secondary/30 bg-secondary/10 p-6"
          role="alert"
        >
          <h2 className="text-lg font-semibold">Profile unavailable</h2>
          <p className="mt-2 text-sm text-foreground/80">{result.message}</p>
          <p className="mt-3 text-sm text-foreground/60">
            If this continues, contact HR so your record can be restored.
          </p>
        </div>
      </section>
    );
  }

  return <ProfileViewClient profile={result.profile} />;
}
