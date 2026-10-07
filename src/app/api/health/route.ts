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
 * Aplicar el diff, pero solo si es demostrablemente aditivo.
 *
 * `prisma db push` se niega con "use --accept-data-loss" incluso cuando el
 * diff no contiene nada destructivo: su aviso es conservador y no permite
 * distinguir. Aquí se calcula el diff con `migrate diff` (que siempre imprime
 * el SQL), se comprueba que no haya ninguna sentencia capaz de perder datos y,
 * solo entonces, se ejecuta sentencia a sentencia.
 *
 * Si alguna vez el diff trae un DROP o un cambio de tipo, se aborta y se dice
 * cuál era, sin tocar la base de datos.
 *
 * Temporal: expone DDL a cualquier usuario autenticado. Proteger con
 * REPAIR_TOKEN y QUITAR antes de publicar.
 */

// Cualquier sentencia capaz de perder datos o estructura.
const PELIGROSAS: { re: RegExp; motivo: string }[] = [
  { re: /^\s*DROP\s+(TABLE|COLUMN|INDEX|TYPE|SCHEMA)\b/im, motivo: "DROP" },
  { re: /^\s*ALTER\s+TABLE[\s\S]{0,300}?\bDROP\b/im, motivo: "ALTER TABLE ... DROP" },
  { re: /^\s*TRUNCATE\b/im, motivo: "TRUNCATE" },
  { re: /^\s*DELETE\s+FROM\b/im, motivo: "DELETE" },
  { re: /ALTER\s+COLUMN\b[\s\S]{0,200}?\bSET\s+DATA\s+TYPE\b/im, motivo: "cambio de tipo" },
  { re: /ALTER\s+COLUMN\b[\s\S]{0,200}?\bDROP\b/im, motivo: "ALTER COLUMN ... DROP" },
  { re: /^\s*DROP\b/im, motivo: "DROP" },
];

function partirSentencias(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

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

  // 1) Calcular el diff
  let diff: string;
  try {
    const { stdout } = await exec(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-url",
        process.env.DATABASE_URL!,
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      { timeout: 180_000, maxBuffer: 16 * 1024 * 1024, cwd: process.cwd() }
    );
    diff = stdout;
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      paso: "diff",
      error: String(e?.message ?? e).slice(0, 600),
    });
  }

  if (!diff.trim() || /empty migration|No changes/i.test(diff)) {
    return NextResponse.json({ ok: true, paso: "diff", mensaje: "El esquema ya está al día." });
  }

  // 2) Comprobar que no hay nada destructivo. Cualquier sentencia sospechosa
  //    aborta el proceso SIN tocar la base de datos.
  const sentencias = partirSentencias(diff);
  const peligrosas = sentencias.filter((s) => PELIGROSAS.some((p) => p.re.test(s)));
  if (peligrosas.length > 0) {
    return NextResponse.json({
      ok: false,
      paso: "validacion",
      mensaje:
        "El diff contiene operaciones que podrían perder datos. No se aplica nada.",
      detalle: peligrosas.slice(0, 5),
    });
  }

  // 3) Aplicar
  const aplicadas: string[] = [];
  const fallos: { sql: string; error: string }[] = [];
  for (const sql of sentencias) {
    try {
      await prisma.$executeRawUnsafe(sql);
      aplicadas.push(sql.slice(0, 80));
    } catch (e: any) {
      fallos.push({ sql: sql.slice(0, 120), error: String(e?.message ?? e).slice(0, 200) });
    }
  }

  return NextResponse.json({
    ok: fallos.length === 0,
    paso: "aplicado",
    aplicadas: aplicadas.length,
    total: sentencias.length,
    fallos,
  });
}