import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership, verifyTrimesterOwnership } from "@/lib/auth";

// POST: Copiar un trimestre completo (evaluaciones + rúbricas, sin notas)
// a otro grupo. Las evaluaciones personales de alumnos se omiten.
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { sourceTrimesterId, targetGroupId } = await request.json();

    if (!sourceTrimesterId || !(await verifyTrimesterOwnership(sourceTrimesterId, user!.id))) {
      return NextResponse.json({ error: "Trimestre de origen no válido" }, { status: 404 });
    }
    if (!targetGroupId || !(await verifyGroupOwnership(targetGroupId, user!.id))) {
      return NextResponse.json({ error: "Grupo de destino no válido" }, { status: 403 });
    }

    const source = await prisma.trimester.findUnique({
      where: { id: sourceTrimesterId },
      include: {
        assessments: {
          orderBy: { order: "asc" },
          include: { rubric: { include: { rows: { orderBy: { order: "asc" } } } } },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Trimestre de origen no válido" }, { status: 404 });
    }

    const targetCount = await prisma.trimester.count({ where: { groupId: targetGroupId } });

    const newTrimester = await prisma.trimester.create({
      data: {
        groupId: targetGroupId,
        name: source.name,
        percentage: source.percentage,
        order: targetCount + 1,
      },
    });

    const targetStudents = await prisma.student.findMany({
      where: { groupId: targetGroupId },
      select: { id: true },
    });

    let copied = 0;
    let skippedPersonal = 0;

    for (const a of source.assessments) {
      if (a.studentId) {
        skippedPersonal++;
        continue;
      }
      const created = await prisma.assessment.create({
        data: {
          trimesterId: newTrimester.id,
          name: a.name,
          type: a.type,
          percentage: a.percentage,
          maxScore: a.maxScore,
          isExtra: a.isExtra,
          isOptional: a.isOptional,
          columnColor: a.columnColor,
          order: a.order,
          rubric: a.rubric
            ? {
                create: {
                  rows: {
                    create: a.rubric.rows.map((row) => ({
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
      });
      copied++;

      if (targetStudents.length > 0) {
        await prisma.grade.createMany({
          data: targetStudents.map((s) => ({
            studentId: s.id,
            assessmentId: created.id,
            score: null,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json(
      { ok: true, trimesterId: newTrimester.id, copied, skippedPersonal },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al copiar el trimestre" }, { status: 500 });
  }
}
