import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Recogida de errores de cliente.
 *
 * Solo para diagnosticar fallos en producción (pantalla en blanco, botón que
 * no responde). Se guarda el mensaje y el stack, nunca el contenido de los
 * formularios: si un error incluyera lo que el profesor estaba escribiendo,
 * acabaríamos con una copia de datos de alumnos en el log de errores.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "client-error", { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = (await request.json()) as {
      message?: string;
      stack?: string;
      path?: string;
    };

    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ ok: true });

    await prisma.clientError.create({
      data: {
        userId: user!.id,
        message: message.slice(0, 500),
        stack: body.stack ? String(body.stack).slice(0, 4000) : null,
        path: body.path ? String(body.path).slice(0, 200) : null,
        userAgent: (request.headers.get("user-agent") || "").slice(0, 300),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}