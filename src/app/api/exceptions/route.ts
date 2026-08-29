import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// GET: Listar excepciones de un estudiante
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  const student = await prisma.student.findFirst({
    where: { id: studentId ?? "", group: { userId: user!.id } },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  const exceptions = await prisma.exception.findMany({
    where: { studentId: student!.id },
    include: { assessment: { include: { trimester: true } } },
  });

  return NextResponse.json(exceptions);
}

// POST: Crear excepción
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { studentId, assessmentId, isExcluded, notes } = await request.json();

    const found = await prisma.student.findFirst({
      where: { id: studentId, group: { userId: user!.id } },
      select: { id: true },
    });

    if (!found) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const exception = await prisma.exception.upsert({
      where: { studentId_assessmentId: { studentId, assessmentId } },
      update: { isExcluded, notes },
      create: { studentId, assessmentId, isExcluded, notes },
    });

    return NextResponse.json(exception, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear la excepción" }, { status: 500 });
  }
}

// DELETE: Eliminar excepción
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const found = await prisma.exception.findFirst({
      where: { id, student: { group: { userId: user!.id } } },
    });

    if (!found) {
      return NextResponse.json({ error: "Excepción no encontrada" }, { status: 404 });
    }

    await prisma.exception.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}