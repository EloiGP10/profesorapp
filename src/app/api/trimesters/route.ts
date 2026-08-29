import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";

// PUT: Actualizar trimestres de un grupo (nombre, porcentaje, orden) y crear nuevos
export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { groupId, trimesters } = await request.json();

    if (!(await verifyGroupOwnership(groupId, user!.id))) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const totalPct = (trimesters || []).reduce(
      (sum: number, t: { percentage: number }) => sum + (parseInt(String(t.percentage)) || 0),
      0
    );

    if (totalPct !== 100) {
      return NextResponse.json(
        { error: `Los porcentajes deben sumar 100% (suman ${totalPct}%)` },
        { status: 400 }
      );
    }

    for (const t of trimesters || []) {
      if (t.id && !t.id.startsWith("new_")) {
        await prisma.trimester.update({
          where: { id: t.id },
          data: {
            name: t.name?.trim() || "Trimestre",
            percentage: parseInt(String(t.percentage)) || 0,
            order: parseInt(String(t.order)) || 1,
          },
        });
      } else {
        await prisma.trimester.create({
          data: {
            groupId,
            name: t.name?.trim() || "Trimestre",
            percentage: parseInt(String(t.percentage)) || 0,
            order: parseInt(String(t.order)) || 1,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar trimestres" }, { status: 500 });
  }
}