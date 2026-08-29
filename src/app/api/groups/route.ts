import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

// GET: Listar grupos del usuario, o un grupo con datos completos (por id)
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const stats = searchParams.get("stats") === "1";

  if (id) {
    const group = await prisma.group.findFirst({
      where: { id, userId: user!.id },
      include: {
        students: {
          include: {
            grades: { include: { assessment: { include: { trimester: true } } } },
            absences: true,
            exceptions: true,
          },
          orderBy: { listNumber: "asc" },
        },
        trimesters: {
          include: {
            assessments: {
              include: { rubric: { include: { rows: { include: { scores: true } } } } },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (stats) {
      return NextResponse.json(calculateStats(group));
    }

    return NextResponse.json(group);
  }

  const groups = await prisma.group.findMany({
    where: { userId: user!.id },
    include: {
      _count: { select: { students: true } },
      trimesters: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(groups);
}

type GroupWithData = {
  id: string;
  name: string;
  code: string | null;
  year: number;
  userId: string;
  trimesters: Array<{ id: string; name: string; percentage: number; order: number }>;
  students: Array<{
    id: string;
    listNumber: number;
    grades: Array<{ score: number | null; assessment: { trimesterId: string } }>;
  }>;
};

function calculateStats(group: GroupWithData) {
  const trimesterStats = group.trimesters.map((trimester) => {
    const studentAvgs = group.students.map((student) => {
      const grades = student.grades.filter(
        (g) => g.assessment.trimesterId === trimester.id && g.score !== null
      );
      if (grades.length === 0) return null;
      return grades.reduce((acc, g) => acc + (g.score ?? 0), 0) / grades.length;
    }).filter((v): v is number => v !== null);

    const avg = studentAvgs.length > 0
      ? studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length
      : null;

    const passRate = studentAvgs.length > 0
      ? (studentAvgs.filter((v) => v >= 5).length / studentAvgs.length) * 100
      : null;

    return {
      name: trimester.name,
      percentage: trimester.percentage,
      avg,
      passRate,
    };
  });

  const weights = group.trimesters.map((t) => t.percentage / 100);
  const overalls = group.students.map((student) => {
    let sum = 0;
    let weightSum = 0;
    trimesterStats.forEach((ts, idx) => {
      if (ts.avg === null) return;
      const w = weights[idx] ?? 0;
      // Media del alumno en ese trimestre pero solo trimes. con notas
      const grades = student.grades.filter(
        (g) => g.assessment.trimesterId === group.trimesters[idx]?.id && g.score !== null
      );
      if (grades.length === 0) return;
      const avg = grades.reduce((acc, g) => acc + (g.score ?? 0), 0) / grades.length;
      sum += avg * w;
      weightSum += w;
    });
    return weightSum > 0 ? sum / weightSum : null;
  }).filter((v): v is number => v !== null);

  const overallAvg = overalls.length > 0
    ? overalls.reduce((a, b) => a + b, 0) / overalls.length
    : null;

  return { trimesterStats, overallAvg };
}

// POST: Crear grupo
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { name, code } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        userId: user!.id,
        trimesters: {
          create: [
            { name: "Trimestre 1", percentage: 34, order: 1 },
            { name: "Trimestre 2", percentage: 33, order: 2 },
            { name: "Trimestre 3", percentage: 33, order: 3 },
          ],
        },
      },
      include: {
        _count: { select: { students: true } },
        trimesters: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear el grupo" }, { status: 500 });
  }
}

// PUT: Editar grupo
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id, name, code, penaltyAbsence, penaltyLate, penaltyNegative } = await request.json();

    const group = await prisma.group.findFirst({
      where: { id, userId: user!.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: {
        name: name?.trim() || group.name,
        code: code === undefined ? group.code : (code?.trim() || null),
        penaltyAbsence: penaltyAbsence !== undefined ? parseFloat(String(penaltyAbsence)) : undefined,
        penaltyLate: penaltyLate !== undefined ? parseFloat(String(penaltyLate)) : undefined,
        penaltyNegative: penaltyNegative !== undefined ? parseFloat(String(penaltyNegative)) : undefined,
      },
      include: {
        _count: { select: { students: true } },
        trimesters: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// DELETE: Eliminar grupo
export async function DELETE(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { id } = await request.json();

    const group = await prisma.group.findFirst({
      where: { id, userId: user!.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    await prisma.group.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}