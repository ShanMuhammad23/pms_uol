import { useState } from "react";

export function useResettingPage(resetKey: string, totalPages: number) {
  const [page, setPage] = useState(1);
  const [prevKey, setPrevKey] = useState(resetKey);

  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setPage(1);
  }

  return [Math.min(page, Math.max(1, totalPages)), setPage] as const;
}
