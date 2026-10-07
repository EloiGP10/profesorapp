import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { canManageGroup, ROLES, type Role } from "@/lib/access";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

/**
 * Compartir un grupo con otros profesores.
 *
 * Tres vías, de más a menos permanente:
 *   - El grupo pertenece a un centro y los miembros heredan acceso.
 *   - Invitación por email a un profesor concreto (AppAccess).
 *   - Acceso directo de un profesor que ya tienes en un centro (AppAccess).
 *
 * Quien puede compartir es el propietario del grupo o un ADMIN/COORDINATOR.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const limited = rateLimit(request, "group-share-read", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const groupId = new URL(request.url).searchParams.get("groupId") || "";
  if (!(await canManageGroup(user!.id, groupId))) {
    return NextResponse.json({ error: "No puedes ver los accesos de este grupo" }, { status: 403 });
  }

  const access = await prisma.appAccess.findMany({
    where: { groupId, isActive: true },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(access);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "group-share-write", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  let body: { groupId?: string; email?: string; role?: string; schoolId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const groupId = String(body.groupId ?? "");
  if (!groupId) {
    return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
  }
  if (!(await canManageGroup(user!.id, groupId))) {
    return NextResponse.json(
      { error: "Solo el propietario o un coordinador pueden compartir el grupo" },
      { status: 403 }
    );
  }

  const role = (body.role ?? "TEACHER") as Role;
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
  }

  // --- Invitar por email (el profesor puede no tener cuenta todavía) ---
  const email = String(body.email ?? "").trim().toLowerCase();
  if (email) {
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }

    const invited = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    // Si el profesor aún no se ha registrado, guardamos la invitación para que
    // se aplique al registrarse con ese correo.
    if (!invited) {
      const pending = await prisma.pendingGroupInvite.upsert({
        where: { email_groupId: { email, groupId } },
        create: { email, groupId, role },
        update: { role },
      });
      return NextResponse.json({
        ok: true,
        pending: true,
        message:
          "Ese profesor todavía no tiene cuenta. Se le dará acceso automáticamente al registrarse con ese correo.",
        inviteId: pending.id,
      });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { userId: true },
    });
    if (group?.userId === invited.id) {
      return NextResponse.json(
        { error: "Ya eres propietario de este grupo" },
        { status: 400 }
      );
    }

    const access = await prisma.appAccess.upsert({
      where: { userId_groupId: { userId: invited.id, groupId } },
      create: { userId: invited.id, groupId, role, isActive: true },
      update: { role, isActive: true },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, userId: invited.id, accessId: access.id });
  }

  // --- Dar acceso a un profesor que ya está en el centro ---
  const schoolId = String(body.schoolId ?? "");
  if (schoolId) {
    const member = await prisma.schoolMembership.findUnique({
      where: { schoolId_userId: { schoolId, userId: user!.id } },
      select: { role: true },
    });
    if (!member || (member.role !== "ADMIN" && member.role !== "COORDINATOR")) {
      return NextResponse.json({ error: "No puedes gestionar este centro" }, { status: 403 });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { schoolId: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }

    await prisma.group.update({
      where: { id: groupId },
      data: { schoolId },
    });

    // Los miembros del centro heredan el acceso por `school.members`, pero se
    // materializa también en AppAccess para que el permiso no dependa de un
    // cambio de rol posterior en el centro.
    const members = await prisma.schoolMembership.findMany({
      where: { schoolId },
      select: { userId: true, role: true },
    });

    for (const m of members) {
      const g = await prisma.group.findUnique({
        where: { id: groupId },
        select: { userId: true },
      });
      if (g?.userId === m.userId) continue;
      await prisma.appAccess.upsert({
        where: { userId_groupId: { userId: m.userId, groupId } },
        create: { userId: m.userId, groupId, role: m.role, isActive: true },
        update: { isActive: true },
      });
    }

    return NextResponse.json({ ok: true, members: members.length });
  }

  return NextResponse.json({ error: "Indica un email o un centro" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, "group-share-remove", LIMITS.write);
  if (limited) return limited;

  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const accessId = searchParams.get("accessId") || "";
  const pendingId = searchParams.get("pendingId") || "";

  if (pendingId) {
    const pending = await prisma.pendingGroupInvite.findUnique({
      where: { id: pendingId },
      select: { groupId: true },
    });
    if (!pending || !(await canManageGroup(user!.id, pending.groupId))) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    await prisma.pendingGroupInvite.delete({ where: { id: pendingId } });
    return NextResponse.json({ ok: true });
  }

  const access = await prisma.appAccess.findUnique({
    where: { id: accessId },
    select: { groupId: true },
  });
  if (!access || !(await canManageGroup(user!.id, access.groupId))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.appAccess.delete({ where: { id: accessId } });
  return NextResponse.json({ ok: true });
}