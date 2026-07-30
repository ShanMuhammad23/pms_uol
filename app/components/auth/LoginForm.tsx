// LoginForm.tsx
"use client";

import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Mail, GraduationCap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAuthErrorMessage,
  signInWithCredentials,
  signInWithGoogle,
} from "@/lib/queries/auth-client";
import { Button } from "./Button";
import { Divider } from "./Divider";
import { InputField } from "./InputField";

interface LoginErrors {
  email?: string;
  password?: string;
}

interface Credentials {
  email: string;
  password: string;
}

type AuthMessageTone = "success" | "error";

interface AuthMessage {
  tone: AuthMessageTone;
  text: string;
}

const initialCredentials: Credentials = {
  email: "",
  password: "",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credentials, setCredentials] = useState<Credentials>(initialCredentials);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<AuthMessage | null>(null);
  const oauthErrorCode = searchParams.get("error");
  const oauthMessage = useMemo<AuthMessage | null>(() => {
    if (!oauthErrorCode) return null;
    return { tone: "error", text: getAuthErrorMessage(oauthErrorCode) };
  }, [oauthErrorCode]);
  const authMessage = submissionMessage ?? oauthMessage;

  const credentialsMutation = useMutation({
    mutationFn: signInWithCredentials,
    onSuccess: async (response) => {
      setSubmissionMessage({
        tone: "success",
        text: "Signed in successfully. Redirecting...",
      });
      setCredentials(initialCredentials);

      const destination = response.url ?? "/dashboard";
      router.push(destination);
      router.refresh();
    },
    onError: (error) => {
      setSubmissionMessage({
        tone: "error",
        text: error.message,
      });
    },
  });

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

  const isCredentialsLoading = credentialsMutation.isPending;
  const isGoogleLoading = googleMutation.isPending;
  const isAnyLoading = isCredentialsLoading || isGoogleLoading;

  const validate = (): LoginErrors => {
    const nextErrors: LoginErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!credentials.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailPattern.test(credentials.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!credentials.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (credentials.password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }

    return nextErrors;
  };

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmissionMessage(null);

    if (Object.keys(nextErrors).length > 0) return;

    credentialsMutation.mutate(credentials);
  };

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
      <header className="mb-8 space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome back
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in to the University of Lahore faculty portal
        </p>
      </header>

      <Button
        variant="social"
        isLoading={isGoogleLoading}
        disabled={isAnyLoading}
        onClick={handleGoogleSignIn}
        aria-label="Continue with Google"
        icon={
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M21.8 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.5c-.2 1.3-.9 2.5-2 3.3v2.8h3.2c1.9-1.8 3.1-4.4 3.1-8.1Z" />
            <path d="M12 22c2.7 0 5-1 6.7-2.6l-3.2-2.8c-.9.6-2 .9-3.5.9-2.6 0-4.8-1.8-5.6-4.2H3.1v2.9A10 10 0 0 0 12 22Z" />
            <path d="M6.4 13.3A6 6 0 0 1 6.1 12c0-.5.1-.9.2-1.3V7.8H3.1A10 10 0 0 0 2 12c0 1.7.4 3.3 1.1 4.7l3.3-2.9Z" />
            <path d="M12 6.5c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 3.4 14.7 2.5 12 2.5A10 10 0 0 0 3.1 7.8l3.3 2.9c.8-2.4 3-4.2 5.6-4.2Z" />
          </svg>
        }
      >
        Continue with Google
      </Button>

      <Divider text="Or sign in with email" />

      <AnimatePresence>
        {authMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
              authMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-950/20 dark:text-red-300"
            }`}
          >
            {authMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        noValidate
        className="space-y-4"
        onSubmit={handleCredentialsSubmit}
        aria-label="Sign in with email and password"
      >
        <InputField
          id="email"
          name="email"
          label="University Email"
          type="email"
          placeholder="name@uol.edu.pk"
          value={credentials.email}
          autoComplete="email"
          required
          icon={<Mail className="h-4 w-4" aria-hidden="true" />}
          error={errors.email}
          onChange={(event) =>
            setCredentials((prev) => ({ ...prev, email: event.target.value }))
          }
        />

        <InputField
          id="password"
          name="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          value={credentials.password}
          autoComplete="current-password"
          required
          icon={<Lock className="h-4 w-4" aria-hidden="true" />}
          error={errors.password}
          onChange={(event) =>
            setCredentials((prev) => ({ ...prev, password: event.target.value }))
          }
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="rounded-sm text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:hover:text-slate-300"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          }
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20 dark:border-white/10 dark:bg-slate-950"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">Keep me signed in</span>
          </label>
          <a
            href="/forgot-password"
            className="text-xs font-medium text-slate-500 transition-colors hover:text-amber-700 dark:text-slate-400 dark:hover:text-amber-400"
          >
            Forgot password?
          </a>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isCredentialsLoading}
            disabled={isAnyLoading}
            icon={<GraduationCap className="h-4 w-4" />}
            aria-label="Sign in with credentials"
          >
            Sign In to Portal
          </Button>
        </div>
      </form>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600"
      >
        Protected by university authentication protocols. Need help?{" "}
        <a href="/support" className="text-amber-600 hover:underline dark:text-amber-400">
          Contact IT Support
        </a>
      </motion.p>
    </motion.section>
  );
}