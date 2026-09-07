"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Banner shown at the top of the dashboard when an admin (HR / Board /
 * Super Admin) is viewing the dashboard as another user. Displays the
 * target user's name and an "Exit View Mode" button to return to the
 * admin's own dashboard.
 */
export function ViewModeBanner() {
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const viewAsUserId = session?.user?.viewAsUserId ?? null;
  const viewAsUserName = session?.user?.name ?? null;
  const realRole = session?.user?.realRole ?? null;

  if (!viewAsUserId) return null;

  async function handleExit() {
    if (exiting) return;
    setExiting(true);
    try {
      await update({ viewAsUserId: null });
      queryClient.clear();
      router.push("/dashboard");
    } catch {
      setExiting(false);
    }
  }

  return (
    <div
      className={cn(
        "no-print flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-700/40 dark:bg-amber-950/30",
      )}
    >
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <Eye className="size-4 shrink-0" />
        <span className="font-semibold">View Mode</span>
        <span className="text-amber-700/80 dark:text-amber-300/80">
          You are viewing the dashboard as{" "}
          <span className="font-bold">{viewAsUserName ?? "another user"}</span>.
          {realRole ? ` Your real role: ${realRole}.` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        disabled={exiting}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        <X className="size-3.5" />
        {exiting ? "Exiting..." : "Exit View Mode"}
      </button>
    </div>
  );
}
