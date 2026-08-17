import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "./lib/queries/auth";
import { getAuthCookieSecure } from "./lib/env";
import { isSystemRole } from "./lib/auth/roles";
import { logSecurityEvent } from "./lib/auth/security-events";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8-hour workday

/**
 * Minimal JWT claims for PMS:
 * - id + email: identity anchors for DB re-authorization
 * - role / entityId / designation: UX cache only — authorize*() must re-fetch
 *
 * Never persist: Google image/picture, OAuth access/refresh tokens, password hashes.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: getAuthCookieSecure()
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: getAuthCookieSecure(),
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
          // Do not request unnecessary scopes beyond profile/email defaults.
        },
      },
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
          await logSecurityEvent({
            eventType: "LOGIN_FAILURE",
            meta: { email, reason: "missing_or_inactive" },
          });
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          await logSecurityEvent({
            eventType: "LOGIN_FAILURE",
            actorUserId: Number(user.id),
            meta: { email, reason: "bad_password" },
          });
          return null;
        }

        if (!isSystemRole(user.systemRole)) {
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
      if (!existingUser?.isActive) {
        await logSecurityEvent({
          eventType: "LOGIN_FAILURE",
          meta: { email, reason: "google_not_provisioned_or_inactive" },
        });
        return false;
      }

      return true;
    },
    async jwt({ token, user, account, trigger, session: updateData }) {
      // Strip provider profile image from the token on every write.
      delete (token as { picture?: unknown }).picture;
      delete (token as { image?: unknown }).image;

      // Handle session updates from the client (View As feature).
      // The updateData contains { viewAsRole: string | null }.
      if (trigger === "update" && updateData) {
        const requested = (updateData as { viewAsRole?: string | null }).viewAsRole;
        if (requested === null || requested === undefined) {
          // Clearing the view-as role — always allowed.
          token.viewAsRole = undefined;
        } else if (requested === "EMPLOYEE" || requested === "MANAGER") {
          // Only allow switching to EMPLOYEE or MANAGER (never escalate).
          // The real DB role is refreshed below and must be >= the requested role.
          // We'll validate after the DB refresh.
          token.viewAsRole = requested;
        }
      }

      if (user) {
        if (account?.provider === "google") {
          const email = user.email?.toString().trim();
          if (email) {
            const dbUser = await getUserByEmail(email);
            if (dbUser?.isActive && isSystemRole(dbUser.systemRole)) {
              token.id = dbUser.id;
              token.role = dbUser.systemRole;
              token.designation = dbUser.designation ?? null;
              token.entityId = dbUser.entityId ?? null;
              token.email = dbUser.email;
              token.name = `${dbUser.firstName} ${dbUser.lastName}`.trim();
              token.error = undefined;
              return token;
            }
          }
          token.error = "InactiveOrMissingUser";
          return token;
        }

        token.role = user.role;
        token.id = user.id;
        token.designation = user.designation ?? null;
        token.entityId = user.entityId ?? null;
        token.error = undefined;
      }

      // Refresh authoritative fields from DB; revoke session if inactive/missing.
      if (token.email) {
        const dbUser = await getUserByEmail(String(token.email));
        if (!dbUser?.isActive || !isSystemRole(dbUser.systemRole)) {
          if (token.role || token.id) {
            await logSecurityEvent({
              eventType: "INACTIVE_SESSION",
              actorUserId: token.id ? Number(token.id) : null,
              meta: { email: token.email },
            });
          }
          token.id = undefined;
          token.role = undefined;
          token.designation = undefined;
          token.entityId = undefined;
          token.error = "InactiveOrMissingUser";
          return token;
        }

        token.id = dbUser.id;
        token.role = dbUser.systemRole;
        token.designation = dbUser.designation ?? null;
        token.entityId = dbUser.entityId ?? null;
        token.name = `${dbUser.firstName} ${dbUser.lastName}`.trim();
        token.error = undefined;

        // Validate viewAsRole after DB refresh:
        // - EMPLOYEE: allowed for any non-employee role (MANAGER, HR, BOARD, SUPER_ADMIN)
        // - MANAGER: allowed for MANAGER, HR, BOARD, SUPER_ADMIN
        //   (HR/Board/Super Admin can view as Manager only if they are actually
        //   a manager1 or manager2 of some employee — checked in the API endpoint)
        if (token.viewAsRole) {
          const realRole = dbUser.systemRole;
          if (token.viewAsRole === "EMPLOYEE") {
            if (realRole === "EMPLOYEE") {
              token.viewAsRole = undefined;
            }
          } else if (token.viewAsRole === "MANAGER") {
            if (realRole === "EMPLOYEE") {
              token.viewAsRole = undefined;
            }
          } else {
            token.viewAsRole = undefined;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.error || !token.id || !token.role) {
        // Force client to treat as logged out.
        return {
          ...session,
          user: {
            ...session.user,
            name: undefined,
            email: undefined,
            image: undefined,
            id: undefined,
            role: undefined,
            designation: undefined,
            entityId: undefined,
          },
          error: token.error,
          expires: new Date(0).toISOString(),
        } as typeof session;
      }

      if (session.user) {
        session.user.role = token.role as string | undefined;
        session.user.id = token.id as string | undefined;
        session.user.designation = token.designation as string | undefined;
        session.user.entityId =
          token.entityId === null || token.entityId === undefined
            ? null
            : Number(token.entityId);
        // Never expose Google profile image URL via session.
        session.user.image = undefined;
        // Apply view-as role override so the entire app (client + server
        // components that call getServerSession) sees the switched role.
        // The real DB role remains in token.role for authorizeFromSessionUser.
        session.user.viewAsRole = token.viewAsRole ?? null;
        session.user.realRole = token.role as string | undefined ?? null;
        if (token.viewAsRole) {
          session.user.role = token.viewAsRole;
        }
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      const dashboardUrl = `${baseUrl}/dashboard`;

      if (url.startsWith(baseUrl)) {
        if (
          url.includes("/api/auth/signin") ||
          url === baseUrl ||
          url === `${baseUrl}/`
        ) {
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
