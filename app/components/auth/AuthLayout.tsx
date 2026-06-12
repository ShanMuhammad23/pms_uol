// AuthLayout.tsx
"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { BrandingPanel } from "./BrandingPanel";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <BrandingPanel />
      <motion.section
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        className="flex w-full items-center justify-center bg-white px-6 py-10 sm:px-10 lg:w-1/2 dark:bg-slate-900"
      >
        {children}
      </motion.section>
    </main>
  );
}