import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const academicYearId = url.searchParams.get("academicYearId");

  if (id) {
    const config = await prisma.itacaConfig.findFirst({
      where: { id },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: { select: { pendingSyncs: true, importLogs: true, exportLogs: true } },
      },
    });
    if (!config) return NextResponse.json({ error: "Configuración no encontrada" }, { status: 404 });
    return NextResponse.json(config);
  }

  if (academicYearId) {
    const config = await prisma.itacaConfig.findFirst({
      where: { academicYearId },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: { select: { pendingSyncs: true, importLogs: true, exportLogs: true } },
      },
    });
    return NextResponse.json(config || null);
  }

  const configs = await prisma.itacaConfig.findMany({
    include: {
      academicYear: { select: { id: true, name: true } },
      _count: { select: { pendingSyncs: true, importLogs: true, exportLogs: true } },
    },
  });

  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { academicYearId, itacaUrl, apiKey, schoolCode, schoolName, syncEnabled, autoSync, syncInterval } = body;

    if (!academicYearId || !itacaUrl) {
      return NextResponse.json({ error: "academicYearId y itacaUrl requeridos" }, { status: 400 });
    }

    const existing = await prisma.itacaConfig.findFirst({ where: { academicYearId } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe configuración para este año académico" }, { status: 409 });
    }

    const config = await prisma.itacaConfig.create({
      data: {
        academicYearId,
        itacaUrl,
        apiKey: apiKey || null,
        schoolCode: schoolCode || null,
        schoolName: schoolName || null,
        syncEnabled: syncEnabled !== undefined ? syncEnabled : true,
        autoSync: autoSync || false,
        syncInterval: syncInterval || 60,
      },
    });

    return NextResponse.json(config, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error al crear configuración ITACA" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  try {
    const body = await request.json();
    const { id, itacaUrl, apiKey, schoolCode, schoolName, syncEnabled, autoSync, syncInterval } = body;

    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.itacaConfig.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Configuración no encontrada" }, { status: 404 });

    const updated = await prisma.itacaConfig.update({
      where: { id },
      data: {
        itacaUrl: itacaUrl || existing.itacaUrl,
        apiKey: apiKey !== undefined ? apiKey : existing.apiKey,
        schoolCode: schoolCode !== undefined ? schoolCode : existing.schoolCode,
        schoolName: schoolName !== undefined ? schoolName : existing.schoolName,
        syncEnabled: syncEnabled !== undefined ? syncEnabled : existing.syncEnabled,
        autoSync: autoSync !== undefined ? autoSync : existing.autoSync,
        syncInterval: syncInterval || existing.syncInterval,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Error al actualizar configuración ITACA" }, { status: 500 });
  }
}
