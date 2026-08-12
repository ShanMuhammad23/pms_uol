"use client";

import { useSession } from "next-auth/react";
import AskHrButton from "@/app/components/employee-forms/AskHrButton";

/**
 * Global "Ask HR" floating action button, mounted once in the authenticated
 * dashboard layout so it stays visible across every authenticated screen.
 *
 * Visibility is gated on the user's primary system role only:
 *   EMPLOYEE → visible
 *   MANAGER  → visible
 *   HR / BOARD / SUPER_ADMIN → hidden
 *
 * Additional Access never grants visibility. While the session is loading the
 * button is not rendered, so it is never briefly exposed to unauthorized roles.
 *
 * The button itself opens the user's own email client via `mailto:` with the HR
 * address pre-populated — the application never sends the email.
 */
export default function GlobalAskHrButton() {
  const { data: session, status } = useSession();

  if (status !== "authenticated") {
    return null;
  }

  const role = session?.user?.role;
  if (role !== "EMPLOYEE" && role !== "MANAGER") {
    return null;
  }

  return <AskHrButton />;
}
