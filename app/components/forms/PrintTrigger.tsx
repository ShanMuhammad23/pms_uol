"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    const timeout = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}
