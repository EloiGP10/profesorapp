import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyAssessmentOwnership, verifyTrimesterOwnership } from "@/lib/auth";

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { assessmentId, targetTrimesterId, name } = await request.json();

    if (!assessmentId || !(await verifyAssessmentOwnership(assessmentId, user!.id))) {
      return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    }

    const source = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        rubric: {
          include: {
            rows: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    }

    const trimesterId = targetTrimesterId || source.trimesterId;
    if (targetTrimesterId && !(await verifyTrimesterOwnership(targetTrimesterId, user!.id))) {
      return NextResponse.json({ error: "Trimestre de destino no válido" }, { status: 403 });
    }

    const count = await prisma.assessment.count({ where: { trimesterId } });

    const newAssessment = await prisma.assessment.create({
      data: {
        trimesterId,
        name: name?.trim() || `${source.name} (Copia)`,
        type: source.type,
        percentage: source.percentage,
        maxScore: source.maxScore,
        isExtra: source.isExtra,
        studentId: source.studentId,
        order: count + 1,
        rubric: source.rubric
          ? {
              create: {
                rows: {
                  create: source.rubric.rows.map((row) => ({
                    title: row.title,
                    percentage: row.percentage,
                    order: row.order,
                    poorText: row.poorText,
                    fairText: row.fairText,
                    goodText: row.goodText,
                    excellentText: row.excellentText,
                  })),
                },
              },
            }
          : undefined,
      },
      include: {
        rubric: {
          include: { rows: true },
        },
      },
    });

    // Crear entradas vacías en Grade para los alumnos del grupo
    const trimester = await prisma.trimester.findUnique({
      where: { id: trimesterId },
      select: { groupId: true },
    });

    if (trimester?.groupId) {
      const students = await prisma.student.findMany({
        where: { groupId: trimester.groupId },
        select: { id: true },
      });

      await prisma.grade.createMany({
        data: students.map((s) => ({
          studentId: s.id,
          assessmentId: newAssessment.id,
          score: null,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(newAssessment, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al duplicar la evaluación" }, { status: 500 });
  }
}
