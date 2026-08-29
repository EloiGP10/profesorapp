import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const entityType = url.searchParams.get("entityType");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const where: any = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, name: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
  });

  return NextResponse.json(logs);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, groupId, action, entityType, entityId, oldData, newData, ipAddress, userAgent } = body;

    if (!action) {
      return NextResponse.json({ error: "action requerido" }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: {
        userId: userId || null,
        groupId: groupId || null,
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        oldData: oldData || undefined,
        newData: newData || undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear log de auditoría" }, { status: 500 });
  }
}
