import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "./lib/queries/auth";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toString().trim() ?? "";
        const password = credentials?.password?.toString() ?? "";

        if (!email || !password) {
          return null;
        }

        const user = await getUserByEmail(email);
        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`.trim(),
          role: user.systemRole,
          designation: user.designation,
          entityId: user.entityId,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email?.toString().trim();
      if (!email) {
        return false;
      }

      const existingUser = await getUserByEmail(email);
      return Boolean(existingUser?.isActive);
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Google profile id/role are not our DB fields — hydrate from users table.
        if (account?.provider === "google") {
          const email = user.email?.toString().trim();
          if (email) {
            const dbUser = await getUserByEmail(email);
            if (dbUser?.isActive) {
              token.id = dbUser.id;
              token.role = dbUser.systemRole;
              token.designation = dbUser.designation ?? null;
              token.entityId = dbUser.entityId ?? null;
              token.email = dbUser.email;
              token.name = `${dbUser.firstName} ${dbUser.lastName}`.trim();
              return token;
            }
          }
        }

        token.role = user.role;
        token.id = user.id;
        token.designation = user.designation ?? null;
        token.entityId = user.entityId ?? null;
      }

      if (token.email && token.entityId == null) {
        const dbUser = await getUserByEmail(token.email);
        if (dbUser?.isActive) {
          token.designation = dbUser.designation ?? null;
          token.entityId = dbUser.entityId ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
        session.user.id = token.id as string | undefined;
        session.user.designation = token.designation as string | undefined;
        session.user.entityId =
          token.entityId === null || token.entityId === undefined
            ? null
            : Number(token.entityId);
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      const dashboardUrl = `${baseUrl}/dashboard`;

      if (url.startsWith(baseUrl)) {
        if (url.includes("/api/auth/signin") || url === baseUrl || url === `${baseUrl}/`) {
          return dashboardUrl;
        }

        return url;
      }

      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      return dashboardUrl;
    },
  },
};
