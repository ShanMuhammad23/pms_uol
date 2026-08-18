"use client";

import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export default function OfflineDialog() {
  const isOnline = useSyncExternalStore(
    subscribe,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  if (!isOnline) {
    if (!wasOffline) {
      setWasOffline(true);
    }
    if (showReconnected) {
      setShowReconnected(false);
    }
  } else if (wasOffline && !showReconnected) {
    setShowReconnected(true);
  }

  useEffect(() => {
    if (!showReconnected) {
      return;
    }
    const timer = window.setTimeout(() => {
      setShowReconnected(false);
      setWasOffline(false);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [showReconnected]);

  const isOpen = !isOnline || showReconnected;

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="offline-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-dialog-title"
          aria-describedby="offline-dialog-description"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-black/60"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-300/80 bg-surface shadow-2xl shadow-slate-900/10 dark:border-white/15 dark:shadow-black/40"
          >
            <div
              className={`h-1 w-full ${
                showReconnected
                  ? "bg-success"
                  : "bg-linear-to-r from-warning via-secondary to-warning"
              }`}
            />

            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  className={`mb-5 flex size-16 items-center justify-center rounded-xl ${
                    showReconnected
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning"
                  }`}
                >
                  {showReconnected ? (
                    <Wifi className="size-8" strokeWidth={1.75} />
                  ) : (
                    <WifiOff className="size-8" strokeWidth={1.75} />
                  )}
                </motion.div>

                <h2
                  id="offline-dialog-title"
                  className="text-xl font-bold tracking-tight text-text-primary"
                >
                  {showReconnected ? "Back online" : "You're offline"}
                </h2>

                <p
                  id="offline-dialog-description"
                  className="mt-2 max-w-sm text-sm leading-relaxed text-foreground/70"
                >
                  {showReconnected
                    ? "Your connection has been restored. You can continue working."
                    : "It looks like you've lost your internet connection. Check your network and try again."}
                </p>

                {!showReconnected ? (
                  <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => window.location.reload()}
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:text-slate-950"
                    >
                      <RefreshCw className="size-4" />
                      Try again
                    </motion.button>
                  </div>
                ) : null}
              </div>
            </div>

            {!showReconnected ? (
              <div className="border-t border-slate-300/80 bg-slate-50/80 px-6 py-3 text-center text-xs text-foreground/55 dark:border-white/10 dark:bg-white/3">
                Changes made while offline may not be saved.
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
