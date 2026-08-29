import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// GET: Listar notas de un estudiante
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

  const notes = await prisma.studentNote.findMany({
    where: { studentId: student!.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

// POST: Crear nota
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { studentId, content } = await request.json();

    const student = await prisma.student.findFirst({
      where: { id: studentId, group: { userId: user!.id } },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "El contenido es obligatorio" }, { status: 400 });
    }

    const note = await prisma.studentNote.create({
      data: { studentId, content: content.trim() },
    });

    return NextResponse.json(note, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear la nota" }, { status: 500 });
  }
}

// DELETE: Eliminar nota
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const found = await prisma.studentNote.findFirst({
      where: { id, student: { group: { userId: user!.id } } },
    });

    if (!found) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }

    await prisma.studentNote.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}