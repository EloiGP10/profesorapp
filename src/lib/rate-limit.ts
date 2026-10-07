import { NextResponse } from "next/server";

/**
 * Limitación de peticiones en memoria, por IP y por ruta.
 *
 * Suficiente para una instancia única (la de Coolify). Si algún día se
 * escalan a varias réplicas, esto deja de ser global: habría que mover el
 * contador a Redis o a la base de datos.
 */

type Bucket = { count: number; resetAt: number };

// Map en lugar de objeto para no arrastrar prototipos ajenos.
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  // Detrás de Coolify hay un proxy inverso; estas cabeceras la traen fijadas.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

// Limpieza periódica para que el Map no crezca sin límite.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    buckets.forEach((v, k) => {
      if (v.resetAt <= now) buckets.delete(k);
    });
  }, WINDOW_MS).unref?.();
}

export interface RateLimit {
  limit: number;
  windowMs?: number;
}

/** Devuelve null si la petición pasa el límite, o una respuesta 429 si se excede. */
export function rateLimit(
  request: Request,
  scope: string,
  { limit, windowMs = WINDOW_MS }: RateLimit
): NextResponse | null {
  const ip = clientIp(request);
  const key = `${scope}:${ip}`;
  const now = Date.now();

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}

/** Presets por tipo de operación. */
export const LIMITS = {
  // Login: 10/min por IP. Suficiente para una persona real, corta el ataque.
  login: { limit: 10, windowMs: 60_000 },
  // Recuperación de contraseña: 5/min. Además evita bombardear correos ajenos.
  passwordReset: { limit: 5, windowMs: 60_000 },
  // Registro: 5/hora por IP.
  register: { limit: 5, windowMs: 60 * 60_000 },
  // Escrituras generales: 120/min.
  write: { limit: 120, windowMs: 60_000 },
  // Exportaciones e informes: 20/min (son operaciones pesadas).
  heavy: { limit: 20, windowMs: 60_000 },
} as const;