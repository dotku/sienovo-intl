import { redirect } from "next/navigation";
import Link from "next/link";
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
  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500 mb-1">
            You are logged in as <strong>{session.user.email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This account does not have admin access.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
              Back to Site
            </Link>
            <a href="/auth/logout" className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800">
              Logout
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar email={session.user.email || ""} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
