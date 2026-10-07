import { type NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/session";

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

/**
 * El informe familiar es público por diseño (lo abre la familia sin cuenta),
 * pero vive bajo /family-report/ y solo con el token correcto. Se comprueba
 * que la ruta sea exactamente /family-report/<token> y nada más, para que el
 * middleware no deje pasar rutas hijas que no deberían ser públicas.
 */
function isPublicFamilyReport(pathname: string): boolean {
  // 64 hex = 32 bytes de randomBytes, que es lo que genera el token.
  return /^\/family-report\/[a-f0-9]{64}$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

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
  const isPublic = PUBLIC_PATHS.includes(pathname) || isPublicFamilyReport(pathname);

  if (!session && !isPublic) {
    const url = new URL("/login", origin);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};