import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const { groupId, newName } = await request.json();

    if (!groupId || !(await verifyGroupOwnership(groupId, user!.id))) {
      return NextResponse.json({ error: "Grupo de origen no encontrado" }, { status: 404 });
    }

    const sourceGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        trimesters: {
          include: {
            assessments: {
              include: {
                rubric: {
                  include: {
                    rows: { orderBy: { order: "asc" } },
                  },
                },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceGroup) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    const clonedName = newName?.trim() || `${sourceGroup.name} (Copia)`;

    const newGroup = await prisma.group.create({
      data: {
        name: clonedName,
        code: sourceGroup.code,
        year: sourceGroup.year,
        userId: user!.id,
        penaltyAbsence: sourceGroup.penaltyAbsence,
        penaltyLate: sourceGroup.penaltyLate,
        penaltyNegative: sourceGroup.penaltyNegative,
        trimesters: {
          create: sourceGroup.trimesters.map((t) => ({
            name: t.name,
            percentage: t.percentage,
            order: t.order,
            assessments: {
              create: t.assessments.map((a) => ({
                name: a.name,
                type: a.type,
                percentage: a.percentage,
                maxScore: a.maxScore,
                isExtra: a.isExtra,
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
              })),
            },
          })),
        },
      },
      include: {
        _count: { select: { students: true } },
        trimesters: {
          include: {
            assessments: {
              include: { rubric: { include: { rows: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(newGroup, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al clonar el grupo" }, { status: 500 });
  }
}
