import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  const evaluationId = url.searchParams.get("evaluationId");
  const studentId = url.searchParams.get("studentId");
  const contentId = url.searchParams.get("contentId");

  if (groupId) {
    const owns = await verifyGroupOwnership(groupId, user.id);
    if (!owns) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

    const where: any = {
      evaluation: { academicYear: { groups: { some: { id: groupId } } } },
    };
    if (evaluationId) where.evaluationId = evaluationId;
    if (studentId) where.studentId = studentId;
    if (contentId) where.contentId = contentId;

    const qualifications = await prisma.qualification.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, surname1: true, firstName: true, lastName1: true } },
        content: { select: { id: true, name: true } },
        evaluation: { select: { id: true, name: true } },
      },
      orderBy: [{ student: { surname1: "asc" } }, { evaluation: { name: "asc" } }],
    });

    return NextResponse.json(qualifications);
  }

  return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { studentId, contentId, evaluationId, academicYearId, numericValue, qualitativeValue, status, source, isRecovery } = body;

    if (!studentId || !evaluationId || !academicYearId) {
      return NextResponse.json({ error: "studentId, evaluationId y academicYearId requeridos" }, { status: 400 });
    }

    const existing = await prisma.qualification.findFirst({
      where: { studentId, contentId: contentId || null, evaluationId },
    });

    if (existing) {
      const updated = await prisma.qualification.update({
        where: { id: existing.id },
        data: {
          numericValue: numericValue !== undefined ? numericValue : existing.numericValue,
          qualitativeValue: qualitativeValue !== undefined ? qualitativeValue : existing.qualitativeValue,
          status: status || existing.status,
          source: source || existing.source,
          isRecovery: isRecovery !== undefined ? isRecovery : existing.isRecovery,
        },
      });
      return NextResponse.json(updated);
    }

    const qualification = await prisma.qualification.create({
      data: {
        studentId,
        contentId: contentId || null,
        evaluationId,
        academicYearId,
        numericValue,
        qualitativeValue,
        status: status || "ACTIVE",
        source: source || "MANUAL",
        isRecovery: isRecovery || false,
      },
    });

    return NextResponse.json(qualification, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear/actualizar qualification" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, numericValue, qualitativeValue, status, source, isRecovery, recoveryDate, finalDate } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.qualification.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Qualification no encontrada" }, { status: 404 });

    const updated = await prisma.qualification.update({
      where: { id },
      data: {
        numericValue: numericValue !== undefined ? numericValue : existing.numericValue,
        qualitativeValue: qualitativeValue !== undefined ? qualitativeValue : existing.qualitativeValue,
        status: status || existing.status,
        source: source || existing.source,
        isRecovery: isRecovery !== undefined ? isRecovery : existing.isRecovery,
        recoveryDate: recoveryDate !== undefined ? recoveryDate : existing.recoveryDate,
        finalDate: finalDate !== undefined ? finalDate : existing.finalDate,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar qualification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.qualification.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Qualification no encontrada" }, { status: 404 });

    await prisma.qualification.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar qualification" }, { status: 500 });
  }
}
