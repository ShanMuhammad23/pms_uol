import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    error?: string;
    user: DefaultSession["user"] & {
      id?: string;
      role?: string;
      designation?: string | null;
      entityId?: number | null;
      /** Always undefined — Google image URLs must not be session-exposed. */
      image?: string | null;
      /** When set, the user is viewing as this role (EMPLOYEE or MANAGER). */
      viewAsRole?: string | null;
      /** The user's real DB role (unchanged by view-as). */
      realRole?: string | null;
    };
  }

  interface User {
    role?: string;
    designation?: string | null;
    entityId?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    designation?: string | null;
    entityId?: number | null;
    /** Set when DB says inactive/missing — session callback treats as logged out. */
    error?: "InactiveOrMissingUser" | string;
    /** View-as role (EMPLOYEE or MANAGER). Cleared to return to original role. */
    viewAsRole?: string | null;
  }
}

export {};
