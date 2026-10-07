import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

/**
 * Diagnóstico del estado de la base de datos.
 *
 * Existe porque un fallo de esquema se manifestaba como "no tienes grupos",
 * que parece pérdida de datos. Esta ruta dice exactamente qué falla: si hay
 * conexión y qué tablas del schema faltan.
 *
 * Requiere sesión: no expone nada sin estar autenticado.
 */

const ESPERADAS = [
  "User",
  "Group",
  "Student",
  "Assessment",
  "Grade",
  "Absence",
  "Exception",
  "AppAccess",
  // Añadidas con el portal multiprofesor.
  "School",
  "SchoolMembership",
  "RubricTemplate",
  "PendingGroupInvite",
  "ContactMessage",
  "AnalyticsEvent",
  "ClientError",
  "License",
];

export async function GET(request: Request) {
  const { getSessionUserFromRequest } = await import("@/lib/session");
  const session = await getSessionUserFromRequest(request as never);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const resultado: {
    conectado: boolean;
    consultaGrupos?: string;
    errorConsulta?: string;
    error?: string;
    errorCode?: string;
    tablas: Record<string, boolean>;
    faltan: string[];
  } = {
    conectado: false,
    tablas: {},
    faltan: [],
  };

  try {
    // Consulta trivial: si esto falla, no hay conexión.
    await prisma.$queryRaw`SELECT 1`;
    resultado.conectado = true;
  } catch (e: any) {
    resultado.error = String(e?.message ?? e).slice(0, 400);
    resultado.errorCode = e?.code ?? undefined;
    return NextResponse.json(resultado);
  }

  // Qué tablas existen realmente, sin depender de Prisma: si falta una tabla
  // nueva, el cliente generado por Prisma sigue consultando y falla.
  try {
    const rows = await prisma.$queryRaw<{ t: string }[]>`
      SELECT table_name AS t
      FROM information_schema.tables
      WHERE table_schema = 'profesorapp'
    `;
    const existentes = new Set(rows.map((r) => r.t));
    for (const t of ESPERADAS) resultado.tablas[t] = existentes.has(t);
    resultado.faltan = ESPERADAS.filter((t) => !existentes.has(t));
  } catch (e: any) {
    resultado.error = String(e?.message ?? e).slice(0, 400);
  }

  // Prueba real de la consulta que usa el panel.
  try {
    await prisma.group.count();
    resultado.consultaGrupos = "ok";
  } catch (e: any) {
    resultado.consultaGrupos = "fallo";
    resultado.errorConsulta = String(e?.message ?? e).slice(0, 400);
  }

  return NextResponse.json(resultado);
}
