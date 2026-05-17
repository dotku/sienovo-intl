import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { prisma } from "@/lib/prisma";
import { roleHasPermission, type Permission, type Role } from "@/lib/permissions";

export const auth0 = new Auth0Client();

// Bootstrap roles — assigns a specific role on first login (and re-asserts
// on every login, so a manual demotion can be undone by removing the entry
// here, or vice versa).
//
// To invite a new team member: add their email + role here, push to prod,
// share https://intl.sienovo.cn/login with them. On their first successful
// Auth0 login the upsert below promotes them automatically — no manual
// SQL or dashboard step needed.
const BOOTSTRAP_ROLES: Record<string, Role> = {
  "sienovoleo@gmail.com": "owner",
  "sienovojay@gmail.com": "owner",
  "yizhuo.chen@sienovo.cn": "marketing",
  // Jay's marketing-role test account — gmail "+marketing" alias lets him
  // experience the dashboard as a marketing user without losing his owner
  // session. Same inbox, different Auth0 user.
  "sienovojay+marketing@gmail.com": "marketing",
};

export async function getSession() {
  return auth0.getSession();
}

/** Get or create local User record for current session (JIT provisioning) */
export async function getUser() {
  const session = await auth0.getSession();
  if (!session?.user?.sub || !session?.user?.email) return null;

  const bootstrapRole = BOOTSTRAP_ROLES[session.user.email.toLowerCase()];

  return prisma.user.upsert({
    where: { auth0Sub: session.user.sub },
    update: {
      email: session.user.email,
      name: session.user.name || null,
      // Re-assert role on every login so the bootstrap map is the source
      // of truth (idempotent). Manual demotions via dashboard get reverted.
      ...(bootstrapRole ? { role: bootstrapRole } : {}),
    },
    create: {
      auth0Sub: session.user.sub,
      email: session.user.email,
      name: session.user.name || null,
      role: bootstrapRole ?? null,
    },
  });
}

/** Check if current session has admin access (any team role) */
export async function isAdmin() {
  const user = await getUser();
  if (!user?.role) return false;
  return roleHasPermission(user.role as Role, "admin.access");
}

/** Check if current session is owner (full access) */
export async function isOwner() {
  const user = await getUser();
  return user?.role === "owner";
}

/** Check if current user has a specific permission */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const user = await getUser();
  if (!user?.role) return false;
  return roleHasPermission(user.role as Role, permission);
}
