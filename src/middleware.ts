import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { sessionSecretKey } from "@/lib/session-secret";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const token = req.cookies.get("offline_admin")?.value;
  const key = sessionSecretKey();
  // Falla cerrado: sin token o con secreto ausente/corto, se trata como no autenticado.
  if (!token || !key) return NextResponse.redirect(new URL("/admin/login", req.url));
  try {
    await jwtVerify(token, key);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}
export const config = { matcher: ["/admin/:path*"] };
