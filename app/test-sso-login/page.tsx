"use client";

import { useMutation } from "@tanstack/react-query";
import { Mail, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { signInWithTestSso } from "@/lib/queries/auth-client";

/**
 * Hidden test route for simulating SSO login by employee email.
 *
 * This page is NOT linked anywhere in the navigation. It must be accessed by
 * typing the URL directly: /test-sso-login
 *
 * The test-sso provider only exists outside production (see auth.ts), so this
 * page will fail with "CredentialsSignin" in production builds.
 */

interface TestSsoMessage {
  tone: "success" | "error";
  text: string;
}

export default function TestSsoLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<TestSsoMessage | null>(null);

  const mutation = useMutation({
    mutationFn: signInWithTestSso,
    onSuccess: (response) => {
      setMessage({
        tone: "success",
        text: "SSO login successful. Redirecting...",
      });
      const destination = response.url ?? "/dashboard";
      router.push(destination);
      router.refresh();
    },
    onError: (error) => {
      setMessage({
        tone: "error",
        text: error.message,
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setMessage({ tone: "error", text: "Please enter an email address." });
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      setMessage({ tone: "error", text: "Please enter a valid email address." });
      return;
    }

    mutation.mutate(trimmed);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" />
            Test Only
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Test SSO Login
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter any employee&apos;s email to simulate a Google SSO login.
            <br />
            This route is hidden and available only outside production.
          </p>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium ${
              message.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
            }`}
          >
            {message.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        <form
          noValidate
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <label
              htmlFor="test-sso-email"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Employee Email
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="test-sso-email"
                name="email"
                type="email"
                placeholder="name@uol.edu.pk"
                value={email}
                autoComplete="email"
                required
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Simulate SSO Login
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">
          Performance Management System &middot; University of Lahore
        </p>
      </div>
    </div>
  );
}
