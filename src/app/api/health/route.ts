import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    diff?: string;
    diffError?: string;
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

  // Diff real entre la base de datos y el schema. `migrate diff` no exige
  //Flags y siempre imprime el SQL, así que deja ver QUÉ se considera
  // destructivo y por qué `db push` se niega.
  if (resultado.faltan.length > 0 && process.env.DATABASE_URL) {
    try {
      const { stdout } = await exec(
        "npx",
        [
          "prisma",
          "migrate",
          "diff",
          "--from-url",
          process.env.DATABASE_URL,
          "--to-schema-datamodel",
          "prisma/schema.prisma",
          "--script",
        ],
        { timeout: 180_000, maxBuffer: 16 * 1024 * 1024, cwd: process.cwd() }
      );
      resultado.diff = stdout.slice(0, 12000);
    } catch (e: any) {
      resultado.diffError = `${e?.message ?? e}`.slice(0, 500);
    }
  }

  return NextResponse.json(resultado);
}

/**
 * Reparar el esquema a petición.
 *
 * Temporal: sirve para una situación concreta (tablas nuevas que el
 * despliegue no llegó a crear) sin depender de que alguien abra el editor
 * SQL a mano. Ejecuta `prisma db push` SIN --accept-data-loss, así que si
 * Prisma detectara pérdida de datos aborta igualmente y no borra nada.
 *
 * QUITAR antes de publicar: expone una vía de ejecución de DDL a cualquier
 * usuario autenticado. Se protege con REPAIR_TOKEN.
 */
export async function POST(request: Request) {
  const { getSessionUserFromRequest } = await import("@/lib/session");
  const session = await getSessionUserFromRequest(request as never);
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const token = process.env.REPAIR_TOKEN;
  if (token) {
    const given = request.headers.get("x-repair-token");
    if (given !== token) {
      return NextResponse.json({ error: "Token incorrecto" }, { status: 403 });
    }
  }

  try {
    // Sin --accept-data-loss: Prisma aborta si la operacion destruyera datos.
    const { stdout, stderr } = await exec(
      "npx",
      ["prisma", "db", "push", "--skip-generate"],
      { timeout: 180_000, maxBuffer: 16 * 1024 * 1024, cwd: process.cwd() }
    );
    return NextResponse.json({ ok: true, salida: `${stdout}\n${stderr}`.slice(0, 2000) });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: String(e?.message ?? e).slice(0, 600),
      salida: `${e?.stdout ?? ""}\n${e?.stderr ?? ""}`.slice(0, 2000),
    });
  }
}