import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyTrimesterOwnership, verifyAssessmentOwnership } from "@/lib/auth";

// GET: Listar evaluaciones de un trimestre
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const trimesterId = searchParams.get("trimesterId");

  if (!trimesterId || !(await verifyTrimesterOwnership(trimesterId, user!.id))) {
    return NextResponse.json({ error: "Trimestre no encontrado" }, { status: 404 });
  }

  const assessments = await prisma.assessment.findMany({
    where: { trimesterId },
    include: { rubric: { include: { rows: { orderBy: { order: "asc" } } } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(assessments);
}

// POST: Crear evaluación
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { trimesterId, name, type, percentage, maxScore, isExtra, rubric, studentId, columnColor } =
      await request.json();

    if (!(await verifyTrimesterOwnership(trimesterId, user!.id))) {
      return NextResponse.json({ error: "Trimestre no encontrado" }, { status: 404 });
    }

    const count = await prisma.assessment.count({ where: { trimesterId } });

    const assessment = await prisma.assessment.create({
      data: {
        trimesterId,
        studentId: studentId || null,
        name: name?.trim() || "Evaluación",
        type: type || "EXAM",
        percentage: percentage !== undefined ? parseFloat(percentage) : 10,
        maxScore: maxScore !== undefined ? parseFloat(maxScore) : 10,
        isExtra: isExtra ?? false,
        order: count + 1,
        columnColor: columnColor || null,
        rubric:
          rubric?.rows?.length
            ? {
                create: {
                  rows: {
                    create: rubric.rows.map((row: { title?: string; percentage?: number; poorText?: string; fairText?: string; goodText?: string; excellentText?: string }, idx: number) => ({
                      title: row.title?.trim() || `Apartado ${idx + 1}`,
                      percentage: parseFloat(String(row.percentage)) || 25,
                      order: idx + 1,
                      poorText: row.poorText || "Mal",
                      fairText: row.fairText || "Regular",
                      goodText: row.goodText || "Bien",
                      excellentText: row.excellentText || "Genial",
                    })),
                  },
                },
              }
            : undefined,
      },
      include: { rubric: { include: { rows: true } } },
    });

    if (studentId) {
      // Crear entrada de calificación solo para el alumno personalizado
      await prisma.grade.create({
        data: {
          studentId,
          assessmentId: assessment.id,
          score: null,
        },
      });
    } else {
      // Crear calificaciones vacías para todos los alumnos del grupo
      const groupId = (
        await prisma.trimester.findUnique({
          where: { id: trimesterId },
          select: { groupId: true },
        })
      )?.groupId;

      if (groupId) {
        const students = await prisma.student.findMany({
          where: { groupId },
          select: { id: true },
        });
        await prisma.grade.createMany({
          data: students.map((s) => ({
            studentId: s.id,
            assessmentId: assessment.id,
            score: null,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json(assessment, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al crear la evaluación" }, { status: 500 });
  }
}

// PUT: Editar evaluación
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id, name, type, percentage, maxScore, isExtra, order, trimesterId, columnColor } = await request.json();

    if (!(await verifyAssessmentOwnership(id, user!.id))) {
      return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      name: name?.trim(),
      type,
      percentage: percentage !== undefined ? parseFloat(percentage) : undefined,
      maxScore: maxScore !== undefined ? parseFloat(maxScore) : undefined,
      isExtra,
      order,
      columnColor: columnColor === "" ? null : columnColor,
    };

    if (trimesterId) {
      if (!(await verifyTrimesterOwnership(trimesterId, user!.id))) {
        return NextResponse.json({ error: "Trimestre no encontrado" }, { status: 404 });
      }
      updateData.trimesterId = trimesterId;
    }

    const assessment = await prisma.assessment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(assessment);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE: Eliminar evaluación
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    if (!(await verifyAssessmentOwnership(id, user!.id))) {
      return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    }

    await prisma.assessment.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}