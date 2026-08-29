import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";

// GET: Listar alumnos de un grupo o un alumno individual
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const id = searchParams.get("id");

  if (id) {
    const student = await prisma.student.findFirst({
      where: { id, group: { userId: user!.id } },
      include: {
        customAssessments: {
          include: {
            trimester: true,
          },
        },
        grades: { include: { assessment: { include: { trimester: true } } } },
        exceptions: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    return NextResponse.json(student);
  }

  if (!groupId || !(await verifyGroupOwnership(groupId, user!.id))) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: { groupId },
    include: {
      grades: { include: { assessment: { include: { trimester: true } } } },
      absences: { orderBy: { date: "desc" } },
      exceptions: true,
      customAssessments: true,
      rubricScores: true,
      notes: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { listNumber: "asc" },
  });

  return NextResponse.json(students);
}

// POST: Crear alumno
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { groupId, listNumber, name, surname1, surname2, nia, email, phone } =
      await request.json();

    if (!(await verifyGroupOwnership(groupId, user!.id))) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (!name?.trim() || !surname1?.trim()) {
      return NextResponse.json(
        { error: "Nombre y primer apellido son obligatorios" },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        groupId,
        listNumber: parseInt(listNumber) || 1,
        name: name.trim(),
        surname1: surname1.trim(),
        surname2: surname2?.trim() || null,
        nia: nia?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el alumno" }, { status: 500 });
  }
}

// PUT: Editar alumno
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id, listNumber, name, surname1, surname2, nia, email, phone } =
      await request.json();

    const existing = await prisma.student.findFirst({
      where: { id, group: { userId: user!.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        listNumber: listNumber !== undefined ? parseInt(listNumber) : existing.listNumber,
        name: name?.trim() || existing.name,
        surname1: surname1?.trim() || existing.surname1,
        surname2: surname2 === undefined ? existing.surname2 : (surname2?.trim() || null),
        nia: nia === undefined ? existing.nia : (nia?.trim() || null),
        email: email === undefined ? existing.email : (email?.trim() || null),
        phone: phone === undefined ? existing.phone : (phone?.trim() || null),
      },
    });

    return NextResponse.json(student);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE: Eliminar alumno
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const existing = await prisma.student.findFirst({
      where: { id, group: { userId: user!.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    await prisma.student.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}