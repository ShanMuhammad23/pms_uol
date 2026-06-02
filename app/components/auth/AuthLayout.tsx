import type { ReactNode } from "react";
import { BrandingPanel } from "./BrandingPanel";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <BrandingPanel />
      <section className="flex w-full items-center justify-center bg-white px-6 py-10 sm:px-10 lg:w-1/2">
        {children}
      </section>
    </main>
  );
}
