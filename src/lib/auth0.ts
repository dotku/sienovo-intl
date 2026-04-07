import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { prisma } from "@/lib/prisma";
import { roleHasPermission, type Permission, type Role } from "@/lib/permissions";

export const auth0 = new Auth0Client();

// Bootstrap owners — these emails always get the "owner" role on first login
const BOOTSTRAP_OWNERS = ["sienovoleo@gmail.com", "sienovojay@gmail.com"];

export async function getSession() {
  return auth0.getSession();
}

/** Get or create local User record for current session (JIT provisioning) */
export async function getUser() {
  const session = await auth0.getSession();
  if (!session?.user?.sub || !session?.user?.email) return null;

  const isBootstrapOwner = BOOTSTRAP_OWNERS.includes(session.user.email);

  return prisma.user.upsert({
    where: { auth0Sub: session.user.sub },
    update: {
      email: session.user.email,
      name: session.user.name || null,
      // Promote bootstrap owners on every login (idempotent)
      ...(isBootstrapOwner ? { role: "owner" } : {}),
    },
    create: {
      auth0Sub: session.user.sub,
      email: session.user.email,
      name: session.user.name || null,
      role: isBootstrapOwner ? "owner" : null,
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
