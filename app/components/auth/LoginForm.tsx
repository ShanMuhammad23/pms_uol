// LoginForm.tsx
"use client";

import { useMutation } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAuthErrorMessage,
  signInWithGoogle,
} from "@/lib/queries/auth-client";
import { Button } from "./Button";

type AuthMessageTone = "success" | "error";

interface AuthMessage {
  tone: AuthMessageTone;
  text: string;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submissionMessage, setSubmissionMessage] = useState<AuthMessage | null>(null);
  const oauthErrorCode = searchParams.get("error");
  const oauthMessage = useMemo<AuthMessage | null>(() => {
    if (!oauthErrorCode) return null;
    return { tone: "error", text: getAuthErrorMessage(oauthErrorCode) };
  }, [oauthErrorCode]);
  const authMessage = submissionMessage ?? oauthMessage;

  const googleMutation = useMutation({
    mutationFn: async () => {
      setSubmissionMessage({
        tone: "success",
        text: "Redirecting to Google...",
      });
      await signInWithGoogle();
    },
    onError: () => {
      setSubmissionMessage({
        tone: "error",
        text: "Could not start Google sign-in. Please try again.",
      });
    },
  });

  const isGoogleLoading = googleMutation.isPending;

  const handleGoogleSignIn = async () => {
    setSubmissionMessage(null);
    googleMutation.mutate();
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-md"
    >
      {/* Card container with rich border + shadow */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:border-white/10 dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
        {/* Top accent gradient bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500" />

        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative p-8 sm:p-10">
          <header className="mb-8 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Secure SSO
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back
            </h2>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Sign in to the University of Lahore{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Performance Management System
              </span>
            </p>
          </header>

          <Button
            variant="social"
            isLoading={isGoogleLoading}
            disabled={isGoogleLoading}
            onClick={handleGoogleSignIn}
            aria-label="Continue with Google — SSO sign-in"
            className="!h-13 shadow-md border-slate-300 transition-all hover:shadow-lg hover:border-slate-400 dark:border-white/20 dark:hover:border-white/30"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="40" height="40" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
              </svg>
            }
          >
            Continue with Google
          </Button>

          <AnimatePresence>
            {authMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`mt-4 overflow-hidden rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  authMessage.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                    : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
                }`}
              >
                {authMessage.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider with trust indicators */}
          <div className="mt-8 flex items-center justify-center gap-6 border-t border-slate-100 pt-6 dark:border-white/5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <svg className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Encrypted
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Verified
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              SSO
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
        University of Lahore &middot; Performance Management System
      </p>
    </motion.section>
  );
}
