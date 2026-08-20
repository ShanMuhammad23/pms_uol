"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A drop-in replacement for `useState` that persists the value to
 * `sessionStorage` so it survives client-side navigation (e.g. moving
 * between dashboard tabs or visiting another page and coming back) but is
 * cleared when the browser tab is closed.
 *
 * The value is serialised as JSON. On first render the stored value is
 * returned (or `initialValue` if nothing is stored / the stored JSON is
 * invalid), avoiding a flash of the default state.
 *
 * @param key          sessionStorage key (must be stable across renders)
 * @param initialValue value used when nothing is stored
 */
export function useSessionStorageState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Lazily read the stored value on first render only.
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const stored = window.sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored) as T;
      }
    } catch {
      // Ignore parse / access errors — fall back to initialValue.
    }
    return initialValue;
  });

  // Keep a ref to the key so the effect doesn't re-run when the caller
  // passes a new string literal each render (it shouldn't, but be safe).
  const keyRef = useRef(key);
  keyRef.current = key;

  // Persist on every change.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(keyRef.current, JSON.stringify(state));
    } catch {
      // Quota exceeded or sessionStorage disabled — silently ignore.
    }
  }, [state]);

  // The setter signature matches React's useState setter so it can be used
  // as a direct replacement.
  const setter = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  return [state, setter];
}
