import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";

// POST: Importar alumnos (ya mapeados por el wizard en el cliente)
export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { groupId, students, replace } = await request.json();

    if (!(await verifyGroupOwnership(groupId, user!.id))) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "No hay alumnos para importar" }, { status: 400 });
    }

    // Limpiar filas vacías
    const clean = (students as Array<Record<string, unknown>>).filter(
      (s) =>
        String(s.name || "").trim() &&
        String(s.surname1 || "").trim()
    );

    if (clean.length === 0) {
      return NextResponse.json({ error: "No hay alumnos válidos para importar" }, { status: 400 });
    }

    if (replace) {
      // Eliminar alumnos existentes del grupo
      const existingIds = await prisma.student.findMany({
        where: { groupId },
        select: { id: true },
      });
      if (existingIds.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: existingIds.map((s) => s.id) } } });
      }
    }

    // Crear alumnos
    const existing = replace
      ? []
      : await prisma.student.findMany({
          where: { groupId },
          select: { nia: true, listNumber: true, name: true, surname1: true },
        });

    let created = 0;
    let skipped = 0;
    let nextListNumber =
      (existing.length > 0 ? Math.max(...existing.map((e) => e.listNumber)) : 0) + 1;

    for (const raw of clean) {
      const nia = raw.nia ? String(raw.nia).trim() : null;
      const name = String(raw.name || "").trim();
      const surname1 = String(raw.surname1 || "").trim();
      const surname2 = raw.surname2 ? String(raw.surname2).trim() || null : null;
      let listNumber = raw.listNumber ? parseInt(String(raw.listNumber)) : 0;

      // Detectar duplicados
      const dup = existing.find(
        (e) =>
          (nia && e.nia === nia) ||
          (e.name === name && e.surname1 === surname1)
      );

      if (dup) {
        skipped++;
        continue;
      }

      if (!listNumber || isNaN(listNumber) || listNumber <= 0) {
        listNumber = nextListNumber++;
      }

      await prisma.student.create({
        data: {
          groupId,
          listNumber,
          name,
          surname1,
          surname2,
          nia,
          email: raw.email ? String(raw.email).trim() || null : null,
          phone: raw.phone ? String(raw.phone).trim() || null : null,
        },
      });
      created++;
    }

    return NextResponse.json({ created, skipped });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al importar alumnos" }, { status: 500 });
  }
}