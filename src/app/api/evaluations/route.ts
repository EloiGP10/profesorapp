import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const groupId = url.searchParams.get("groupId");
  const academicYearId = url.searchParams.get("academicYearId");

  if (id) {
    const evaluation = await prisma.evaluation.findFirst({
      where: { id },
      include: {
        activities: { orderBy: { order: "asc" } },
        grades: true,
        academicYear: { select: { id: true, name: true } },
      },
    });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });
    return NextResponse.json(evaluation);
  }

  if (groupId) {
    const owns = await verifyGroupOwnership(groupId, user.id);
    if (!owns) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    const group = await prisma.group.findFirst({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    const where: any = {};
    if (group.academicYearId) where.academicYearId = group.academicYearId;
    if (academicYearId) where.academicYearId = academicYearId;

    const evaluations = await prisma.evaluation.findMany({
      where,
      include: {
        activities: { orderBy: { order: "asc" } },
        _count: { select: { grades: true, activities: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(evaluations);
  }

  if (academicYearId) {
    const evaluations = await prisma.evaluation.findMany({
      where: { academicYearId },
      include: {
        activities: { orderBy: { order: "asc" } },
        _count: { select: { grades: true, activities: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(evaluations);
  }

  return NextResponse.json({ error: "groupId o academicYearId requerido" }, { status: 400 });
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { name, type, code, academicYearId, educationId, startDate, endDate } = body;

    if (!name || !academicYearId) {
      return NextResponse.json({ error: "name y academicYearId requeridos" }, { status: 400 });
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        name,
        type: type || "ORDINARY",
        code,
        academicYearId,
        educationId: educationId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json(evaluation, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear evaluación" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, name, type, code, startDate, endDate } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.evaluation.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        name: name || existing.name,
        type: type || existing.type,
        code: code !== undefined ? code : existing.code,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : existing.startDate,
        endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar evaluación" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.evaluation.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    await prisma.evaluation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar evaluación" }, { status: 500 });
  }
}
