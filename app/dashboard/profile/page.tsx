import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getSapEmployeeProfile, SapProfileError } from "@/lib/queries/sap-profile";
import ProfileView from "@/app/components/layout/ProfileView";
const ProfilePage = async () => {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!session || !email) {
    redirect("/");
  }

  try {
    const profile = await getSapEmployeeProfile(email);

    return <ProfileView profile={profile} />;
  } catch (error) {
    const message =
      error instanceof SapProfileError
        ? error.message
        : "Unable to fetch profile from SAP right now. Please try again later.";

    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[#E07A5F]/30 bg-[#E07A5F]/10 p-6">
          <h1 className="text-xl font-semibold text-text-primary">Profile Unavailable</h1>
          <p className="mt-2 text-sm text-foreground/80">{message}</p>
        </div>
      </section>
    );
  }
};

export default ProfilePage;
