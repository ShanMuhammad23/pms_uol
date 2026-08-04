import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout } from "./components/auth/AuthLayout";
import { LoginForm } from "./components/auth/LoginForm";
import { getPostLoginPath } from "@/lib/auth/home-path";
import { authOptions } from "@/auth";
import { getServerSession } from "next-auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect(getPostLoginPath(session.user.role));
  }

  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
