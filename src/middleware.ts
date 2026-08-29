import { type NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/session";

const PUBLIC_PATHS = ["/", "/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas API: no redirigir, devolver 401 si no hay sesión
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next();
    }
    const session = await getSessionUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const session = await getSessionUserFromRequest(request);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};