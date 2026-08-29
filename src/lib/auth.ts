import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

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

export async function verifyGroupOwnership(groupId: string, userId: string): Promise<boolean> {
  if (!groupId) return false;
  const group = await prisma.group.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  return !!group;
}

export async function verifyStudentOwnership(studentId: string, userId: string): Promise<boolean> {
  if (!studentId) return false;
  const student = await prisma.student.findFirst({
    where: { id: studentId, group: { userId } },
    select: { id: true },
  });
  return !!student;
}

export async function verifyTrimesterOwnership(trimesterId: string, userId: string): Promise<boolean> {
  if (!trimesterId) return false;
  const trimester = await prisma.trimester.findFirst({
    where: { id: trimesterId, group: { userId } },
    select: { id: true },
  });
  return !!trimester;
}

export async function verifyAssessmentOwnership(assessmentId: string, userId: string): Promise<boolean> {
  if (!assessmentId) return false;
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, trimester: { group: { userId } } },
    select: { id: true },
  });
  return !!assessment;
}

export const errorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });