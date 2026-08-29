import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// POST: Crear o actualizar una calificación (upsert)
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { studentId, assessmentId, score } = await request.json();

    const found = await prisma.grade.findFirst({
      where: {
        studentId,
        assessmentId,
        student: { group: { userId: user!.id } },
      },
    });

    if (!found) {
      return NextResponse.json({ error: "No autorizado o no encontrado" }, { status: 404 });
    }

    const grade = await prisma.grade.upsert({
      where: { studentId_assessmentId: { studentId, assessmentId } },
      update: {
        score: score === null || score === undefined || score === "" ? null : parseFloat(score),
      },
      create: {
        studentId,
        assessmentId,
        score: score === null || score === undefined || score === "" ? null : parseFloat(score),
      },
    });

    return NextResponse.json(grade);
  } catch {
    return NextResponse.json({ error: "Error al guardar la nota" }, { status: 500 });
  }
}

// PUT: Actualizar calificación existente
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id, score } = await request.json();

    const found = await prisma.grade.findFirst({
      where: { id, student: { group: { userId: user!.id } } },
    });

    if (!found) {
      return NextResponse.json({ error: "No autorizado o no encontrado" }, { status: 404 });
    }

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        score: score === null || score === undefined || score === "" ? null : parseFloat(score),
      },
    });

    return NextResponse.json(grade);
  } catch {
    return NextResponse.json({ error: "Error al guardar la nota" }, { status: 500 });
  }
}