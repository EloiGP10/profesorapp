import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyStudentOwnership } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { writableGroups } from "@/lib/access";

/**
 * Gestión del enlace público del informe familiar.
 *
 * El acceso de la familia va por /family-report/[token], nunca por studentId.
 * El token son 32 bytes aleatorios: no se puede adivinar ni enumerar, y el
 * profesor puede revocarlo en cualquier momento poniendo shareEnabled a false.
 */

function siteUrl(): string {
  const base =
    process.env.APP_URL?.replace(/\/$/, "") ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  return base;
}

// GET: Estado del enlace de un alumno + URL si está activo
export async function GET(request: Request) {
  const limited = rateLimit(request, "family-share-read", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") || "";

  if (!(await verifyStudentOwnership(studentId, user!.id))) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, shareToken: true, shareEnabled: true },
  });

  const active = Boolean(student?.shareEnabled && student?.shareToken);
  return NextResponse.json({
    shareEnabled: active,
    url: active ? `${siteUrl()}/family-report/${student!.shareToken}` : null,
  });
}

// POST: Activar (o regenerar) el enlace del alumno indicado.
// Requiere `studentId` o `groupId` + `studentIds` para activar en bloque.
export async function POST(request: Request) {
  const limited = rateLimit(request, "family-share-write", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { studentId?: string; groupId?: string; studentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  // Alta en bloque para un grupo entero.
  if (body.groupId && Array.isArray(body.studentIds)) {
    const ids = body.studentIds.filter(Boolean).slice(0, 500);
    const students = await prisma.student.findMany({
      where: { id: { in: ids }, groupId: body.groupId, group: writableGroups(user!.id) },
      select: { id: true },
    });
    if (students.length !== ids.length) {
      return NextResponse.json(
        { error: "Uno o más alumnos no te pertenecen" },
        { status: 403 }
      );
    }

    // Token por fila: cada alumno necesita el suyo.
    for (const s of students) {
      await prisma.student.update({
        where: { id: s.id },
        data: { shareToken: randomBytes(32).toString("hex"), shareEnabled: true },
      });
    }

    const updated = await prisma.student.findMany({
      where: { id: { in: students.map((s) => s.id) } },
      select: { id: true, name: true, surname1: true, surname2: true, shareToken: true },
    });

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      links: updated.map((s) => ({
        studentId: s.id,
        name: `${s.name} ${s.surname1}${s.surname2 ? ` ${s.surname2}` : ""}`,
        url: `${siteUrl()}/family-report/${s.shareToken}`,
      })),
    });
  }

  if (!body.studentId) {
    return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
  }

  if (!(await verifyStudentOwnership(body.studentId, user!.id))) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  const student = await prisma.student.update({
    where: { id: body.studentId },
    data: { shareToken: randomBytes(32).toString("hex"), shareEnabled: true },
    select: { id: true, shareToken: true },
  });

  return NextResponse.json({
    ok: true,
    url: `${siteUrl()}/family-report/${student.shareToken}`,
  });
}

// DELETE: Revocar el enlace del alumno
export async function DELETE(request: Request) {
  const limited = rateLimit(request, "family-share-revoke", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") || "";

  if (!(await verifyStudentOwnership(studentId, user!.id))) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  // Se anula el token, no se borra la fila: revocar es instantáneo y reversible.
  await prisma.student.update({
    where: { id: studentId },
    data: { shareEnabled: false, shareToken: null },
  });

  return NextResponse.json({ ok: true });
}