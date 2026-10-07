import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { writableGroups } from "@/lib/access";

const CATEGORY = "FAMILY_REPORT";

type Annotations = Record<string, string>;

function parseAnnotations(content: string | null): Annotations {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Annotations) : {};
  } catch {
    return {};
  }
}

// GET: Obtener las anotaciones del informe familiar de un alumno
export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, group: writableGroups(user!.id) },
    select: { id: true },
  });

  if (!student) {
    return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
  }

  const note = await prisma.studentNote.findFirst({
    where: { studentId: student.id, category: CATEGORY },
  });

  return NextResponse.json({ annotations: parseAnnotations(note?.content ?? null) });
}

// POST: Guardar (sobrescribir) las anotaciones del informe familiar
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { studentId, annotations } = (await request.json()) as {
      studentId?: string;
      annotations?: Annotations;
    };

    if (!studentId) {
      return NextResponse.json({ error: "studentId requerido" }, { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, group: writableGroups(user!.id) },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });
    }

    const clean: Annotations = {};
    if (annotations && typeof annotations === "object") {
      for (const [key, value] of Object.entries(annotations)) {
        if (typeof value === "string" && value.trim() !== "") {
          clean[key] = value;
        }
      }
    }

    const existing = await prisma.studentNote.findFirst({
      where: { studentId: student.id, category: CATEGORY },
      select: { id: true },
    });

    if (existing) {
      await prisma.studentNote.update({
        where: { id: existing.id },
        data: { content: JSON.stringify(clean) },
      });
    } else {
      await prisma.studentNote.create({
        data: {
          studentId: student.id,
          content: JSON.stringify(clean),
          category: CATEGORY,
        },
      });
    }

    return NextResponse.json({ ok: true, annotations: clean });
  } catch {
    return NextResponse.json({ error: "Error al guardar el informe" }, { status: 500 });
  }
}