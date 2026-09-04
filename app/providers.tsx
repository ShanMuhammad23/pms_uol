"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Provider } from "react-redux";
import OfflineDialog from "./components/layout/OfflineDialog";
import { store } from "./store";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = storedTheme ? storedTheme === "dark" : prefersDark;

    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  return (
    <SessionProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 5000,
              success: { duration: 3500 },
              error: { duration: 7000 },
              style: {
                maxWidth: "28rem",
                fontSize: "18px",
                lineHeight: "1.4",
              },
            }}
          />
          <OfflineDialog />
        </QueryClientProvider>
      </Provider>
    </SessionProvider>
  );
}
