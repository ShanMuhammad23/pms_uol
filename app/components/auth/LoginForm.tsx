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
          Sign in to the University of Lahore Performance Management System
        </p>
      </header>

      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Recommended
        </span>
      </div>

      <Button
        variant="social"
        isLoading={isGoogleLoading}
        disabled={isAnyLoading}
        onClick={handleGoogleSignIn}
        aria-label="Continue with Google — recommended sign-in method"
        className="!h-12 shadow-md border-slate-300 dark:border-white/20 " 
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="40" height="40" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg>
        }
      >
        Continue with Google
      </Button>

      <Divider text="OR" />

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

     

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isCredentialsLoading}
            disabled={isAnyLoading}
            icon={<GraduationCap className="h-4 w-4" />}
            aria-label="Sign in with email and password"
          >
            Sign In to Portal
          </Button>
        </div>
      </form>

  
    </motion.section>
  );
}