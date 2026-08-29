import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// GET: Listar faltas de un estudiante (opcionalmente filtrado por trimestre)
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");
  const trimesterId = searchParams.get("trimesterId");

  const student = await prisma.student.findFirst({
    where: { id: studentId ?? "", group: { userId: user!.id } },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  const absences = await prisma.absence.findMany({
    where: {
      studentId: student!.id,
      ...(trimesterId ? { trimesterId } : {}),
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(absences);
}

// POST: Crear falta
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { studentId, date, type, notes, trimesterId } = await request.json();

    const student = await prisma.student.findFirst({
      where: { id: studentId, group: { userId: user!.id } },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    // Verificar que el trimestre pertenece al mismo grupo si se proporciona
    if (trimesterId) {
      const trimester = await prisma.trimester.findFirst({
        where: { id: trimesterId, group: { userId: user!.id } },
        select: { id: true },
      });
      if (!trimester) {
        return NextResponse.json({ error: "Trimestre no válido" }, { status: 400 });
      }
    }

    const absence = await prisma.absence.create({
      data: {
        studentId,
        trimesterId: trimesterId ?? null,
        date: date ? new Date(date) : new Date(),
        type: type || "ABSENT",
        notes: notes ?? null,
      },
    });

    return NextResponse.json(absence, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear la falta" }, { status: 500 });
  }
}

// DELETE: Eliminar falta
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const found = await prisma.absence.findFirst({
      where: { id, student: { group: { userId: user!.id } } },
    });

    if (!found) {
      return NextResponse.json({ error: "Falta no encontrada" }, { status: 404 });
    }

    await prisma.absence.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}