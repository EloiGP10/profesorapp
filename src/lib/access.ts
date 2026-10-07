import { prisma } from "@/lib/prisma";

/**
 * Control de acceso a grupos y centros.
 *
 * Antes, un grupo tenía un único propietario y todas las consultas filtraban
 * por `group: { userId }`. Eso impedía que dos tutores trabajaran en el mismo
 * grupo. Ahora el acceso es:
 *
 *   - propietario del grupo (`Group.userId`), o
 *   - miembro del centro al que pertenece el grupo, o
 *   - acceso directo al grupo vía `AppAccess` (invitación puntual).
 *
 * Todos los filtros pasan por aquí para que la regla no se disperse por 20
 * rutas y acabe siendo inconsistente.
 */

export const ROLES = ["ADMIN", "COORDINATOR", "TEACHER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

const WRITE_ROLES: Role[] = ["ADMIN", "COORDINATOR", "TEACHER"];
const MANAGE_ROLES: Role[] = ["ADMIN", "COORDINATOR"];

/**
 * Fragmento `where` de Prisma: grupos a los que el usuario puede LEER.
 *
 * Uso: `prisma.group.findMany({ where: accessibleGroups(user.id) })`
 * o anidado: `prisma.student.findMany({ where: { group: accessibleGroups(id) } })`
 */
export function accessibleGroups(userId: string) {
  return {
    OR: [
      { userId },
      { appAccesses: { some: { userId, isActive: true } } },
      { school: { members: { some: { userId } } } },
    ],
  };
}

/** Filtro para operaciones de ESCRITURA: excluye al rol VIEWER. */
export function writableGroups(userId: string) {
  return {
    OR: [
      { userId },
      { appAccesses: { some: { userId, isActive: true, role: { in: WRITE_ROLES } } } },
      {
        school: {
          members: { some: { userId, role: { in: WRITE_ROLES } } },
        },
      },
    ],
  };
}

/** ¿Puede leer este grupo? */
export async function canAccessGroup(
  userId: string,
  groupId: string
): Promise<boolean> {
  if (!userId || !groupId) return false;
  const found = await prisma.group.findFirst({
    where: { id: groupId, ...accessibleGroups(userId) },
    select: { id: true },
  });
  return !!found;
}

/** ¿Puede modificar este grupo? (notas, alumnos, evaluaciones) */
export async function canWriteGroup(
  userId: string,
  groupId: string
): Promise<boolean> {
  if (!userId || !groupId) return false;
  const found = await prisma.group.findFirst({
    where: { id: groupId, ...writableGroups(userId) },
    select: { id: true },
  });
  return !!found;
}

/** ¿Puede gestionar el grupo (borrarlo, compartirlo, editarlo)? */
export async function canManageGroup(
  userId: string,
  groupId: string
): Promise<boolean> {
  if (!userId || !groupId) return false;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      userId: true,
      appAccesses: {
        where: { userId, isActive: true },
        select: { role: true },
      },
      school: {
        select: {
          members: { where: { userId }, select: { role: true } },
        },
      },
    },
  });
  if (!group) return false;
  // El propietario siempre puede.
  if (group.userId === userId) return true;
  const role =
    group.appAccesses[0]?.role ?? group.school?.members[0]?.role ?? null;
  return role === "ADMIN" || role === "COORDINATOR";
}

/** Rol efectivo del usuario sobre un grupo, para la interfaz. */
export async function groupRole(
  userId: string,
  groupId: string
): Promise<{ role: Role | "OWNER"; canWrite: boolean; canManage: boolean } | null> {
  if (!userId || !groupId) return null;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      userId: true,
      appAccesses: { where: { userId, isActive: true }, select: { role: true } },
      school: { select: { members: { where: { userId }, select: { role: true } } } },
    },
  });
  if (!group) return null;

  if (group.userId === userId) {
    return { role: "OWNER", canWrite: true, canManage: true };
  }

  const raw = group.appAccesses[0]?.role ?? group.school?.members[0]?.role;
  if (!raw || !(ROLES as readonly string[]).includes(raw)) return null;

  const role = raw as Role;
  return {
    role,
    canWrite: WRITE_ROLES.includes(role),
    canManage: MANAGE_ROLES.includes(role),
  };
}

/** ¿Es miembro del centro indicado? */
export async function isSchoolMember(
  userId: string,
  schoolId: string
): Promise<{ role: Role } | null> {
  if (!userId || !schoolId) return null;
  const m = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
    select: { role: true },
  });
  if (!m) return null;
  return { role: (m.role as Role) ?? "TEACHER" };
}

/** Filtro de centros visibles para el usuario (creados por él o donde es miembro). */
export function accessibleSchools(userId: string) {
  return {
    OR: [{ ownerId: userId }, { members: { some: { userId } } }],
  };
}