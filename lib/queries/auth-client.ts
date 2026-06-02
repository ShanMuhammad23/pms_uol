"use client";

import { signIn } from "next-auth/react";

interface CredentialsInput {
  email: string;
  password: string;
}

const authErrorMap: Record<string, string> = {
  AccessDenied: "Your account is not allowed to sign in with Google.",
  CallbackRouteError: "We could not complete sign-in. Please try again.",
  CredentialsSignin: "Invalid email or password.",
  OAuthAccountNotLinked: "Please use the original provider for this account.",
};

export const getAuthErrorMessage = (code: string | null): string => {
  if (!code) {
    return "Unable to sign in right now. Please try again.";
  }

  return authErrorMap[code] ?? "Unable to sign in right now. Please try again.";
};

export async function signInWithCredentials(input: CredentialsInput) {
  const response = await signIn("credentials", {
    email: input.email,
    password: input.password,
    redirect: false,
    callbackUrl: "/dashboard",
  });

  if (!response || response.error) {
    throw new Error(getAuthErrorMessage(response?.error ?? null));
  }

  return response;
}

export async function signInWithGoogle() {
  await signIn("google", { callbackUrl: "/dashboard" });
}
