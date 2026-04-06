import { auth0 } from "@/lib/auth0";
import Link from "next/link";

export default async function AuthButton() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <a
        href="/auth/login"
        className="text-sm text-gray-600 hover:text-accent transition-colors"
      >
        Login
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className="text-sm text-gray-600 hover:text-accent transition-colors"
      >
        Dashboard
      </Link>
      <a
        href="/auth/logout"
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        Logout
      </a>
    </div>
  );
}
