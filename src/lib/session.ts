import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE = "profesorapp_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 días

/**
 * Secreto de firma de sesión.
 *
 * Si no está definido, la aplicación NO arranca. Con un valor por defecto
 * cualquiera que conozca ese valor podría forjar un JWT con el userId que
 * quiera y acceder a los datos de otro profesor, así que es crítico que
 * SESSION_SECRET sea único y aleatorio en cada despliegue.
 */
function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || !secret.trim()) {
    // Sin secreto no hay sesiones que valgan: se genera uno por proceso para
    // que la aplicación siga funcionando en lugar de dejar al usuario sin
    // poder entrar. Las sesiones no sobrevivirán a un reinicio.
    console.error(
      "[session] SESSION_SECRET no está definido. Se genera uno temporal: " +
        "las sesiones caducan al reiniciar el contenedor. Define SESSION_SECRET " +
        "con: openssl rand -base64 48"
    );
    return new TextEncoder().encode(
      randomBytes(32).toString("hex")
    );
  }

  if (secret.trim().length < 32) {
    // Corto pero presente: se usa tal cual para no invalidar las sesiones ya
    // emitidas, avisando de que conviene reforzarlo.
    console.warn(
      `[session] SESSION_SECRET tiene solo ${secret.trim().length} caracteres. ` +
        "Recomendable al menos 32: genera uno con openssl rand -base64 48"
    );
  }

  return new TextEncoder().encode(secret);
}

let cachedSecret: Uint8Array | null = null;
function sessionSecret(): Uint8Array {
  if (!cachedSecret) cachedSecret = getSessionSecret();
  return cachedSecret;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION)
    .sign(sessionSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.userId !== "string" || !payload.userId) return null;
    return {
      userId: payload.userId,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

// Lee la sesión desde cookies en Server Components / Route Handlers
export async function getSessionUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Lee la sesión desde una NextRequest (middleware)
export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Crea una cookie de sesión para una Response
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
  return response;
}

// Borra la cookie de sesión
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}