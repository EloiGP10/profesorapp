import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { accessibleSchools } from "@/lib/access";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * Banco de rúbricas reutilizables.
 *
 * Evita reescribir los criterios cada curso. Hay plantillas privadas (solo del
 * autor) y plantillas compartidas con el centro, visibles para cualquier
 * miembro.
 */

interface RowInput {
  title: string;
  percentage: number;
  poorText?: string;
  fairText?: string;
  goodText?: string;
  excellentText?: string;
}

const MAX_ROWS = 20;

function sanitizeRows(input: unknown): RowInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_ROWS)
    .map((r) => {
      const row = r as Record<string, unknown>;
      const str = (v: unknown, fallback: string) =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : fallback;
      const pct = Number(row.percentage);
      return {
        title: str(row.title, "Criterio"),
        percentage: Number.isFinite(pct) && pct >= 0 ? pct : 25,
        poorText: str(row.poorText, "Mal"),
        fairText: str(row.fairText, "Regular"),
        goodText: str(row.goodText, "Bien"),
        excellentText: str(row.excellentText, "Genial"),
      };
    })
    .filter((r) => r.title.length > 0);
}

/** Listar plantillas: las propias y las compartidas de los centros del usuario. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "rubric-templates-read", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");

  const schools = await prisma.school.findMany({
    where: accessibleSchools(user!.id),
    select: { id: true },
  });
  const schoolIds = schools.map((s) => s.id);

  const templates = await prisma.rubricTemplate.findMany({
    where: {
      OR: [
        { userId: user!.id },
        { isShared: true, schoolId: { in: schoolIds.length ? schoolIds : [""] } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      subject: true,
      level: true,
      rows: true,
      isShared: true,
      schoolId: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = schoolId
    ? templates.filter((t) => t.schoolId === schoolId)
    : templates;

  return NextResponse.json(filtered);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "rubric-templates-write", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: {
    id?: string;
    name?: string;
    description?: string;
    subject?: string;
    level?: string;
    rows?: unknown;
    isShared?: boolean;
    schoolId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  if (name.length < 2) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const rows = sanitizeRows(body.rows);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Añade al menos un criterio" },
      { status: 400 }
    );
  }

  const isShared = Boolean(body.isShared);
  const schoolId = isShared ? (body.schoolId ?? null) : null;

  // Compartir exige pertenecer a un centro: si no, la plantilla sería privada.
  if (isShared) {
    if (!schoolId) {
      return NextResponse.json(
        { error: "Elige un centro para compartir la plantilla" },
        { status: 400 }
      );
    }
    const member = await prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId: user!.id } },
      select: { id: true },
    });
    const owned = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { ownerId: true },
    });
    if (!member && owned?.ownerId !== user!.id) {
      return NextResponse.json(
        { error: "No perteneces a ese centro" },
        { status: 403 }
      );
    }
  }

  const data = {
    name,
    description: body.description?.trim().slice(0, 500) || null,
    subject: body.subject?.trim().slice(0, 80) || null,
    level: body.level?.trim().slice(0, 80) || null,
    rows: rows as object,
    isShared,
    schoolId,
  };

  if (body.id) {
    // Solo el autor puede editar su plantilla.
    const existing = await prisma.rubricTemplate.findUnique({
      where: { id: body.id },
      select: { userId: true },
    });
    if (!existing || existing.userId !== user!.id) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    const updated = await prisma.rubricTemplate.update({
      where: { id: body.id },
      data,
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.rubricTemplate.create({
    data: { ...data, userId: user!.id },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, "rubric-templates-delete", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id") || "";

  const existing = await prisma.rubricTemplate.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== user!.id) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  await prisma.rubricTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}