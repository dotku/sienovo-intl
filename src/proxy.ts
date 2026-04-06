import { auth0 } from "@/lib/auth0";
import { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  return auth0.middleware(req);
}

export const config = {
  matcher: ["/auth/:path*", "/admin/:path*", "/dashboard/:path*"],
};
