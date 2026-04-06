import { redirect } from "next/navigation";
import { isAdmin, getSession } from "@/lib/auth0";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login?returnTo=/admin");

  const admin = await isAdmin();
  if (!admin) redirect("/");

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar email={session.user.email || ""} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
