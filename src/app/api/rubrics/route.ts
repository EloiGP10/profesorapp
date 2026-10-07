import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyAssessmentOwnership } from "@/lib/auth";
import { writableGroups } from "@/lib/access";

// GET: Obtener rúbrica de una evaluación + puntuaciones de un alumno
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const assessmentId = searchParams.get("assessmentId");
  const studentId = searchParams.get("studentId");

  if (!assessmentId || !(await verifyAssessmentOwnership(assessmentId, user!.id))) {
    return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
  }

  const rubric = await prisma.rubric.findUnique({
    where: { assessmentId },
    include: {
      rows: {
        orderBy: { order: "asc" },
        include: {
          scores: studentId ? { where: { studentId } } : false,
        },
      },
    },
  });

  return NextResponse.json(rubric || { rows: [] });
}

// PUT: Guardar rúbrica (asociar a evaluación y guardar filas)
// POST: Guardar puntuaciones de la rúbrica para un alumno
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { assessmentId, studentId, scores } = await request.json();

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, trimester: { group: writableGroups(user!.id) } },
      include: { rubric: { include: { rows: true } } },
    });

    if (!assessment?.rubric) {
      return NextResponse.json({ error: "Rúbrica no encontrada" }, { status: 404 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, group: writableGroups(user!.id) },
    });

    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    // Guardar cada score (upsert por fila)
    for (const row of assessment.rubric.rows) {
      const level = scores?.[row.id] || null;
      if (level) {
        await prisma.rubricScore.upsert({
          where: { rubricRowId_studentId: { rubricRowId: row.id, studentId } },
          update: { level },
          create: { rubricRowId: row.id, studentId, level },
        });
      } else {
        await prisma.rubricScore.deleteMany({
          where: { rubricRowId: row.id, studentId },
        });
      }
    }

    // Calcular la nota de la rúbrica y guardar en Grade
    let totalWeight = 0;
    let weightedSum = 0;
    for (const row of assessment.rubric.rows) {
      const level = scores?.[row.id];
      if (!level) continue;
      const value =
        level === "POOR" ? 1
        : level === "FAIR" ? 4
        : level === "GOOD" ? 7
        : 10;
      totalWeight += row.percentage;
      weightedSum += (value / 10) * row.percentage * assessment.maxScore;
    }

    const rubricScore =
      totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : null;

    await prisma.grade.upsert({
      where: { studentId_assessmentId: { studentId, assessmentId } },
      update: { score: rubricScore },
      create: { studentId, assessmentId, score: rubricScore },
    });

    return NextResponse.json({ ok: true, score: rubricScore });
  } catch {
    return NextResponse.json({ error: "Error al guardar la rúbrica" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { assessmentId, rows } = await request.json();

    if (!(await verifyAssessmentOwnership(assessmentId, user!.id))) {
      return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    }

    // Crear/actualizar la rúbrica
    let rubric = await prisma.rubric.findUnique({ where: { assessmentId } });

    if (!rubric) {
      rubric = await prisma.rubric.create({ data: { assessmentId } });
    }

    // Actualizar filas existentes por id (conserva sus evaluaciones),
    // crear las nuevas y eliminar solo las que ya no están
    const incoming = ((rows || []) as Array<{
      id?: string;
      title?: string;
      percentage?: number;
      poorText?: string;
      fairText?: string;
      goodText?: string;
      excellentText?: string;
    }>).map((row, idx) => ({
      id: typeof row.id === "string" ? row.id : undefined,
      title: row.title?.trim() || `Apartado ${idx + 1}`,
      percentage: parseFloat(String(row.percentage)) || 0,
      order: idx + 1,
      poorText: row.poorText || "Mal",
      fairText: row.fairText || "Regular",
      goodText: row.goodText || "Bien",
      excellentText: row.excellentText || "Genial",
    }));

    const existing = await prisma.rubricRow.findMany({
      where: { rubricId: rubric!.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));
    const keptIds = new Set(
      incoming.map((r) => r.id).filter((id): id is string => !!id && existingIds.has(id))
    );

    for (const row of incoming) {
      if (row.id && existingIds.has(row.id)) {
        await prisma.rubricRow.update({
          where: { id: row.id },
          data: {
            title: row.title,
            percentage: row.percentage,
            order: row.order,
            poorText: row.poorText,
            fairText: row.fairText,
            goodText: row.goodText,
            excellentText: row.excellentText,
          },
        });
      } else {
        await prisma.rubricRow.create({
          data: {
            rubricId: rubric!.id,
            title: row.title,
            percentage: row.percentage,
            order: row.order,
            poorText: row.poorText,
            fairText: row.fairText,
            goodText: row.goodText,
            excellentText: row.excellentText,
          },
        });
      }
    }

    const removedIds = Array.from(existingIds).filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      await prisma.rubricRow.deleteMany({ where: { id: { in: removedIds } } });
    }

    // Alumnos cuyas evaluaciones se conservan (notas en criterios no eliminados)
    let preservedStudents = 0;
    if (keptIds.size > 0) {
      const scored = await prisma.rubricScore.findMany({
        where: { rubricRowId: { in: Array.from(keptIds) } },
        select: { studentId: true },
        distinct: ["studentId"],
      });
      preservedStudents = scored.length;
    }

    return NextResponse.json({ ok: true, preservedStudents });
  } catch {
    return NextResponse.json({ error: "Error al guardar la rúbrica" }, { status: 500 });
  }
}