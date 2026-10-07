import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  accessibleGroups,
  canAccessGroup,
  canWriteGroup,
  writableGroups,
} from "@/lib/access";

type AuthResult =
  | { user: { id: string; email: string | null }; error: null }
  | { user: null; error: NextResponse };

export async function getAuthenticatedUser(): Promise<AuthResult> {
  const session = await getSessionUser();

  if (!session) {
    return {
      user: null,
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });

  if (!dbUser) {
    return {
      user: null,
      error: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  return { user: { id: dbUser.id, email: dbUser.email }, error: null };
}

/**
 * Verificaciones de pertenencia.
 *
 * Delegan en `access.ts` para que la regla de "quién puede tocar qué" esté
 * en un solo sitio. Antes solo existía el propietario del grupo, así que
 * estos helpers se llaman igual pero ahora aceptan también a compañeros de
 * centro y a invitados.
 */
export async function verifyGroupOwnership(groupId: string, userId: string): Promise<boolean> {
  return canWriteGroup(userId, groupId);
}

export async function verifyGroupRead(groupId: string, userId: string): Promise<boolean> {
  return canAccessGroup(userId, groupId);
}

export async function verifyStudentOwnership(studentId: string, userId: string): Promise<boolean> {
  if (!studentId) return false;
  const student = await prisma.student.findFirst({
    where: { id: studentId, group: writableGroups(userId) },
    select: { id: true },
  });
  return !!student;
}

export async function verifyTrimesterOwnership(trimesterId: string, userId: string): Promise<boolean> {
  if (!trimesterId) return false;
  const trimester = await prisma.trimester.findFirst({
    where: { id: trimesterId, group: writableGroups(userId) },
    select: { id: true },
  });
  return !!trimester;
}

export async function verifyAssessmentOwnership(assessmentId: string, userId: string): Promise<boolean> {
  if (!assessmentId) return false;
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, trimester: { group: writableGroups(userId) } },
    select: { id: true },
  });
  return !!assessment;
}

export const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });