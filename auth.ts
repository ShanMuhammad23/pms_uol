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
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string | undefined;
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
