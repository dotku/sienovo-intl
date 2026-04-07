import { redirect } from "next/navigation";
import { getSession, getUser } from "@/lib/auth0";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // JIT create local user record
  await getUser();

  return (
    <DashboardShell
      email={session.user.email || ""}
      name={session.user.name || ""}
    >
      {children}
    </DashboardShell>
  );
}
