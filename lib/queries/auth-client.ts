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
  // --- Google SSO errors (returned via ?error= in the redirect URL) ---
  AccessDenied:
    "Sign-in was denied. If this is unexpected, please contact HR at pms@hrd.uol.edu.pk.",
  NoEmail:
    "Google did not return an email address. Please make sure your Google account has a verified email and try again.",
  UserNotFound:
    "No PMS account is linked to your Google email. Please contact HR at pms@hrd.uol.edu.pk to provision your account.",
  AccountInactive:
    "Your account is currently inactive. Please contact HR at pms@hrd.uol.edu.pk to reactivate it.",

  // --- Generic / provider errors ---
  CallbackRouteError:
    "Something went wrong during sign-in. Please try again, or contact HR if the problem persists.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method. Please use the original provider.",
  OAuthCallback:
    "Google rejected the sign-in request. Please check your connection and try again.",
  OAuthSignin:
    "Could not start Google sign-in. Please check your connection and try again.",
  Configuration:
    "The sign-in system is not configured correctly. If this is the test login, make sure ALLOW_TEST_LOGIN=true is set.",
  Verification:
    "Sign-in verification failed. Please try again.",
  CredentialsSignin: "Sign-in failed. Please check your email and password and try again.",

  // --- Test credentials errors (returned by the pre-check endpoint) ---
  MissingEmail: "Please enter an email address.",
  MissingPassword: "Please enter a password.",
  InvalidEmail: "Please enter a valid email address.",
  InvalidPassword: "Incorrect password. Please check your password and try again.",
  InvalidRole:
    "Your account has an unrecognized role. Please contact HR to fix your account configuration.",
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
 * Test-only email/password sign-in (dev/staging only — the provider is not
 * registered in production unless ALLOW_TEST_LOGIN=true). Verifies the
 * password against the stored bcrypt hash and produces a session identical
 * to a real Google SSO login.
 *
 * A pre-check request is sent to /api/auth/test-credentials-check first so
 * that we can show a specific, user-readable error (e.g. "account inactive"
 * vs "user not found" vs "invalid password") instead of NextAuth's generic
 * "CredentialsSignin".
 */
export async function signInWithTestCredentials(email: string, password: string) {
  // --- Pre-check: validate inputs and get a specific error if any ---
  const checkResponse = await fetch("/api/auth/test-credentials-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!checkResponse.ok) {
    const data = await checkResponse.json().catch(() => null);
    const errorCode = data?.error ?? "CredentialsSignin";
    const customMessage = data?.message as string | undefined;
    throw new Error(customMessage ?? getAuthErrorMessage(errorCode ?? null));
  }

  // --- Pre-check passed — proceed with NextAuth signIn ---
  const response = await signIn("test-credentials", {
    email,
    password,
    redirect: false,
    callbackUrl: DEFAULT_HOME_PATH,
  });

  if (!response || response.error) {
    throw new Error(getAuthErrorMessage(response?.error ?? null));
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
