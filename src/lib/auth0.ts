import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client();

const ADMIN_EMAILS = ["sienovoleo@gmail.com"];

export async function getSession() {
  return auth0.getSession();
}

export async function isAdmin() {
  const session = await auth0.getSession();
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email);
}
