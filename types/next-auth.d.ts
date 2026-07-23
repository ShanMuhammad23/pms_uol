import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role?: string;
      designation?: string | null;
      entityId?: number | null;
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
  }
}

export {};
