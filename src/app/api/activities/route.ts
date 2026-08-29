import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const evaluationId = url.searchParams.get("evaluationId");
  const contentId = url.searchParams.get("contentId");

  if (id) {
    const activity = await prisma.activity.findFirst({
      where: { id },
      include: {
        content: { select: { id: true, name: true } },
        evaluation: { select: { id: true, name: true } },
        rubric: true,
        grades: { include: { student: { select: { id: true, name: true, firstName: true, lastName1: true } } } },
      },
    });
    if (!activity) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
    return NextResponse.json(activity);
  }

  const where: any = {};
  if (evaluationId) where.evaluationId = evaluationId;
  if (contentId) where.contentId = contentId;

  const activities = await prisma.activity.findMany({
    where,
    include: {
      content: { select: { id: true, name: true } },
      evaluation: { select: { id: true, name: true } },
      _count: { select: { grades: true } },
    },
    orderBy: [{ evaluation: { name: "asc" } }, { order: "asc" }],
  });

  return NextResponse.json(activities);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { name, description, date, contentId, evaluationId, weight, maxScore, type, isExtra, order } = body;

    if (!name || !evaluationId) {
      return NextResponse.json({ error: "name y evaluationId requeridos" }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        name,
        description: description || null,
        date: date ? new Date(date) : null,
        contentId: contentId || null,
        evaluationId,
        weight: weight || 1,
        maxScore: maxScore || 10,
        type: type || "EXAM",
        isExtra: isExtra || false,
        order: order || 1,
      },
    });

    // Crear grades vacías para todos los alumnos del grupo si hay contentId
    if (contentId) {
      const content = await prisma.teachingContent.findFirst({ where: { id: contentId } });
      if (content) {
        const evaluations = await prisma.evaluation.findFirst({ where: { id: evaluationId } });
        if (evaluations) {
          const groups = await prisma.group.findMany({
            where: { academicYearId: evaluations.academicYearId },
          });

          for (const group of groups) {
            const students = await prisma.student.findMany({ where: { groupId: group.id } });
            for (const student of students) {
              await prisma.grade.create({
                data: {
                  studentId: student.id,
                  assessmentId: (await prisma.assessment.findFirst({ where: { trimesterId: (await prisma.trimester.findFirst({ where: { groupId: group.id } }))?.id || "" } }))?.id || "",
                  activityId: activity.id,
                  evaluationId,
                  contentId,
                },
              });
            }
          }
        }
      }
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear actividad" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, name, description, date, contentId, weight, maxScore, type, isExtra, order } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.activity.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });

    const updated = await prisma.activity.update({
      where: { id },
      data: {
        name: name || existing.name,
        description: description !== undefined ? description : existing.description,
        date: date !== undefined ? (date ? new Date(date) : null) : existing.date,
        contentId: contentId !== undefined ? contentId : existing.contentId,
        weight: weight !== undefined ? weight : existing.weight,
        maxScore: maxScore !== undefined ? maxScore : existing.maxScore,
        type: type || existing.type,
        isExtra: isExtra !== undefined ? isExtra : existing.isExtra,
        order: order !== undefined ? order : existing.order,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar actividad" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.activity.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });

    await prisma.activity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar actividad" }, { status: 500 });
  }
}
