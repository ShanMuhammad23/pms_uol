import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { getUserByEmail, getUserByIdForAuth } from "./lib/queries/auth";
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
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email?.toString().trim();
      if (!email) {
        // No email in Google profile — redirect with specific error.
        return `/?error=NoEmail`;
      }

      const existingUser = await getUserByEmail(email);
      if (!existingUser) {
        await logSecurityEvent({
          eventType: "LOGIN_FAILURE",
          meta: { email, reason: "google_user_not_found" },
        });
        return `/?error=UserNotFound`;
      }

      if (!existingUser.isActive) {
        await logSecurityEvent({
          eventType: "LOGIN_FAILURE",
          meta: { email, reason: "google_account_inactive" },
        });
        return `/?error=AccountInactive`;
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

        // Handle "view as user" — admin can view the dashboard as any user.
        const requestedUserId = (updateData as { viewAsUserId?: string | null }).viewAsUserId;
        if (requestedUserId === null || requestedUserId === undefined) {
          // Clearing view-as-user.
          token.viewAsUserId = undefined;
          token.viewAsUserName = undefined;
          token.viewAsUserEmail = undefined;
          token.viewAsUserRole = undefined;
          token.viewAsUserDesignation = undefined;
          token.viewAsUserEntityId = undefined;
        } else {
          // Only set the flag here; validation + user info fetch happens below
          // after the DB refresh confirms the real user is an admin.
          token.viewAsUserId = requestedUserId;
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

        // Validate + refresh viewAsUserId after DB refresh.
        // Only HR / BOARD / SUPER_ADMIN may view as another user.
        if (token.viewAsUserId) {
          const realRole = dbUser.systemRole;
          if (
            realRole === "HR" ||
            realRole === "BOARD" ||
            realRole === "SUPER_ADMIN"
          ) {
            const targetId = Number(token.viewAsUserId);
            if (Number.isFinite(targetId)) {
              const targetUser = await getUserByIdForAuth(targetId);
              if (targetUser?.isActive && isSystemRole(targetUser.systemRole)) {
                token.viewAsUserId = String(targetUser.id);
                token.viewAsUserName =
                  `${targetUser.firstName} ${targetUser.lastName}`.trim();
                token.viewAsUserEmail = targetUser.email;
                token.viewAsUserRole = targetUser.systemRole;
                token.viewAsUserDesignation = targetUser.designation ?? null;
                token.viewAsUserEntityId = targetUser.entityId ?? null;
              } else {
                // Target user not found or inactive — clear view-as.
                token.viewAsUserId = undefined;
                token.viewAsUserName = undefined;
                token.viewAsUserEmail = undefined;
                token.viewAsUserRole = undefined;
                token.viewAsUserDesignation = undefined;
                token.viewAsUserEntityId = undefined;
              }
            } else {
              token.viewAsUserId = undefined;
            }
          } else {
            // Not an admin — clear view-as-user.
            token.viewAsUserId = undefined;
            token.viewAsUserName = undefined;
            token.viewAsUserEmail = undefined;
            token.viewAsUserRole = undefined;
            token.viewAsUserDesignation = undefined;
            token.viewAsUserEntityId = undefined;
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

        // Apply "view as user" override — when an admin is viewing the
        // dashboard as another user, override all identity fields with the
        // target user's info. The real user's ID/role are preserved in
        // realId / realRole for authorization checks.
        session.user.viewAsUserId = token.viewAsUserId ?? null;
        session.user.realId = token.id as string | undefined ?? null;
        if (token.viewAsUserId) {
          session.user.id = token.viewAsUserId;
          session.user.name = token.viewAsUserName ?? undefined;
          session.user.email = token.viewAsUserEmail ?? undefined;
          session.user.role = token.viewAsUserRole ?? undefined;
          session.user.designation = token.viewAsUserDesignation ?? null;
          session.user.entityId =
            token.viewAsUserEntityId === null ||
            token.viewAsUserEntityId === undefined
              ? null
              : Number(token.viewAsUserEntityId);
          // Clear viewAsRole when viewing as a specific user — the target
          // user's actual role is used instead.
          session.user.viewAsRole = null;
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
