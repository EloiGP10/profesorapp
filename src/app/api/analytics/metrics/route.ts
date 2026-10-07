import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Métricas agregadas para decidir qué construir después.
 *
 * Solo devuelve datos del propio usuario (más los conteos globales de
 * errores, que no contienen identificadores). No hay endpoint público de
 * analítica: nadie externo ve cómo se usa la aplicación.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "analytics-read", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(7, Number(searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [events, errors, totalUsers] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { userId: user!.id, createdAt: { gte: since } },
      select: { name: true, path: true, createdAt: true },
      take: 20000,
    }),
    prisma.clientError.groupBy({
      by: ["message"],
      _count: { message: true },
      where: { createdAt: { gte: since } },
      orderBy: { _count: { message: "desc" } },
      take: 15,
    }),
    prisma.user.count(),
  ]);

  // Frecuencia por acción.
  const byAction: Record<string, number> = {};
  // Páginas más vistas.
  const byPath: Record<string, number> = {};
  // Sesiones aproximadas: distintos minutos con actividad.
  const activeMinutes = new Set<string>();

  for (const e of events) {
    byAction[e.name] = (byAction[e.name] ?? 0) + 1;
    if (e.path) byPath[e.path] = (byPath[e.path] ?? 0) + 1;
    activeMinutes.add(
      `${e.createdAt.getUTCFullYear()}-${e.createdAt.getUTCMonth()}-${e.createdAt.getUTCDate()}T${e.createdAt.getUTCHours()}:${e.createdAt.getUTCMinutes()}`
    );
  }

  const top = (o: Record<string, number>, n = 12) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return NextResponse.json({
    days,
    totalUsers,
    totalEvents: events.length,
    // Una "sesión" aquí es un minuto con actividad: da el orden de magnitud
    // sin enhacer un modelo de sesiones que no tenemos.
    activeSessions: activeMinutes.size,
    byAction: top(byAction),
    byPath: top(byPath),
    errors: errors.map((e) => ({ message: e.message, count: e._count.message })),
  });
}