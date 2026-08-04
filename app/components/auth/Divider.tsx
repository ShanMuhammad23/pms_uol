// Divider.tsx
"use client";

import { motion } from "framer-motion";

interface DividerProps {
  text: string;
}

export function Divider({ text }: DividerProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="relative my-6"
      role="separator"
      aria-label={text}
    >
      <div className="absolute inset-0 flex items-center">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="w-full origin-left border-t border-slate-200 dark:border-white/10"
        />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:bg-slate-900 dark:text-slate-500">
          {text}
        </span>
      </div>
    </motion.div>
  );
}