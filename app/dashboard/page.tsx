import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";

const page = async () => {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/");
  }

  return (
    <div className="text-text-primary">
      <h1 className="text-2xl font-bold">Welcome, {session.user?.name}</h1>
    </div>
  );
};

export default page;