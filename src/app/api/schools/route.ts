import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { accessibleSchools, ROLES } from "@/lib/access";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

/** Centros del usuario: los que ha creado y en los que es miembro. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "schools-read", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const schools = await prisma.school.findMany({
    where: accessibleSchools(user!.id),
    select: {
      id: true,
      name: true,
      code: true,
      city: true,
      province: true,
      ownerId: true,
      createdAt: true,
      _count: { select: { groups: true, members: true } },
      members: {
        where: { userId: user!.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    schools.map((s) => ({
      ...s,
      myRole: s.ownerId === user!.id ? "ADMIN" : (s.members[0]?.role ?? "TEACHER"),
    }))
  );
}

/** Crear un centro. Quien lo crea queda como ADMIN. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "schools-write", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { name?: string; code?: string; city?: string; province?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json(
      { error: "El nombre del centro es obligatorio" },
      { status: 400 }
    );
  }

  const school = await prisma.school.create({
    data: {
      name,
      code: body.code?.trim() || null,
      city: body.city?.trim() || null,
      province: body.province?.trim() || null,
      ownerId: user!.id,
      members: {
        create: { userId: user!.id, role: "ADMIN" },
      },
    },
  });

  return NextResponse.json(school, { status: 201 });
}