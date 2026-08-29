import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const educationId = url.searchParams.get("educationId");

  if (id) {
    const content = await prisma.teachingContent.findFirst({
      where: { id },
      include: {
        education: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        activities: { orderBy: { order: "asc" } },
        _count: { select: { grades: true, qualifications: true } },
      },
    });
    if (!content) return NextResponse.json({ error: "Contenido no encontrado" }, { status: 404 });
    return NextResponse.json(content);
  }

  const where: any = {};
  if (educationId) where.educationId = educationId;

  const contents = await prisma.teachingContent.findMany({
    where,
    include: {
      education: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      _count: { select: { activities: true, grades: true, qualifications: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(contents);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { name, code, educationId, courseId, type, description, subjectArea, driveLink } = body;

    if (!name || !educationId) {
      return NextResponse.json({ error: "name y educationId requeridos" }, { status: 400 });
    }

    const content = await prisma.teachingContent.create({
      data: {
        name,
        code: code || null,
        educationId,
        courseId: courseId || null,
        type: type || "SUBJECT",
        description: description || null,
        subjectArea: subjectArea || null,
        driveLink: driveLink || null,
      },
    });

    return NextResponse.json(content, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear contenido" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, name, code, courseId, type, description, subjectArea, driveLink } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.teachingContent.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Contenido no encontrado" }, { status: 404 });

    const updated = await prisma.teachingContent.update({
      where: { id },
      data: {
        name: name || existing.name,
        code: code !== undefined ? code : existing.code,
        courseId: courseId !== undefined ? courseId : existing.courseId,
        type: type || existing.type,
        description: description !== undefined ? description : existing.description,
        subjectArea: subjectArea !== undefined ? subjectArea : existing.subjectArea,
        driveLink: driveLink !== undefined ? driveLink : existing.driveLink,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar contenido" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.teachingContent.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Contenido no encontrado" }, { status: 404 });

    await prisma.teachingContent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Error al eliminar contenido" }, { status: 500 });
  }
}
