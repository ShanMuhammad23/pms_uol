"use client";

import { getSession, signIn, signOut } from "next-auth/react";
import { DEFAULT_HOME_PATH, getPostLoginPath } from "@/lib/auth/home-path";

export interface ViewAsOption {
  value: string;
  label: string;
}

export interface ViewAsOptionsResponse {
  options: ViewAsOption[];
  currentViewAsRole: string | null;
  realRole?: string;
}

const authErrorMap: Record<string, string> = {
  AccessDenied: "Your account is not allowed to sign in with Google.",
  CallbackRouteError: "We could not complete sign-in. Please try again.",
  CredentialsSignin: "No active user found with that email.",
  OAuthAccountNotLinked: "Please use the original provider for this account.",
};

export const getAuthErrorMessage = (code: string | null): string => {
  if (!code) {
    return "Unable to sign in right now. Please try again.";
  }

  return authErrorMap[code] ?? "Unable to sign in right now. Please try again.";
};

export async function resolvePostLoginPath(): Promise<string> {
  const session = await getSession();
  return getPostLoginPath(session?.user?.role);
}

export async function signInWithGoogle() {
  const destination = DEFAULT_HOME_PATH;
  await signIn("google", { callbackUrl: destination });
}

/**
 * Test-only SSO simulation (dev/staging only — the provider is not registered
 * in production). Signs in as the given employee email without a password,
 * producing a session identical to a real Google SSO login.
 */
export async function signInWithTestSso(email: string) {
  const response = await signIn("test-sso", {
    email,
    redirect: false,
    callbackUrl: DEFAULT_HOME_PATH,
  });

  if (!response || response.error) {
    throw new Error(
      response?.error === "CredentialsSignin"
        ? "No active user found with that email."
        : getAuthErrorMessage(response?.error ?? null),
    );
  }

  const destination = await resolvePostLoginPath();
  return {
    ...response,
    url: destination,
  };
}

export async function signOutAndRedirect() {
  await signOut({ callbackUrl: "/" });
}

/**
 * Fetch the available "View As" roles for the current user.
 */
export async function fetchViewAsOptions(): Promise<ViewAsOptionsResponse> {
  const response = await fetch("/api/auth/view-as");
  if (!response.ok) {
    throw new Error("Failed to fetch view-as options");
  }
  return response.json();
}
