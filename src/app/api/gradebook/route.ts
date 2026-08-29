import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getQualitativeValue(score: number): string | null {
  if (score >= 9) return "SB";
  if (score >= 7) return "BI";
  if (score >= 5) return "SU";
  if (score >= 3) return "SU-";
  if (score >= 0) return "INS";
  return null;
}

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  const evaluationId = url.searchParams.get("evaluationId");

  if (!groupId) return NextResponse.json({ error: "groupId requerido" }, { status: 400 });

  const owns = await verifyGroupOwnership(groupId, user.id);
  if (!owns) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  const group = await prisma.group.findFirst({
    where: { id: groupId },
    include: { academicYear: true },
  });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  // Obtener evaluaciones del año académico
  const evalWhere: any = {};
  if (group.academicYearId) evalWhere.academicYearId = group.academicYearId;
  if (evaluationId) evalWhere.id = evaluationId;

  const evaluations = await prisma.evaluation.findMany({
    where: evalWhere,
    include: {
      activities: {
        include: { content: { select: { id: true, name: true } } },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Obtener alumnos del grupo
  const students = await prisma.student.findMany({
    where: { groupId },
    orderBy: { listNumber: "asc" },
  });

  // Obtener todas las notas del grupo
  const grades = await prisma.grade.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
    },
    include: {
      activity: { select: { id: true, name: true, weight: true, isExtra: true, contentId: true, evaluationId: true } },
    },
  });

  // Obtener faltas del grupo
  const absences = await prisma.absence.findMany({
    where: {
      studentId: { in: students.map((s) => s.id) },
    },
  });

  // Construir respuesta
  const gradebook = {
    group: {
      id: group.id,
      name: group.name,
      academicYear: group.academicYear ? { id: group.academicYear.id, name: group.academicYear.name } : null,
    },
    evaluations: evaluations.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      activities: e.activities.map((a) => ({
        id: a.id,
        name: a.name,
        weight: a.weight,
        isExtra: a.isExtra,
        contentId: a.contentId,
        contentName: a.content?.name || null,
      })),
    })),
    students: students.map((student) => {
      const studentGrades = grades.filter((g) => g.studentId === student.id);
      const studentAbsences = absences.filter((a) => a.studentId === student.id);

      const evaluationsData: any = {};
      for (const evaluation of evaluations) {
        const evalGrades = studentGrades.filter((g) => g.activity?.evaluationId === evaluation.id);
        const activities: any[] = [];
        let totalWeight = 0;
        let weightedSum = 0;

        for (const grade of evalGrades) {
          if (grade.activity && grade.numericValue !== null) {
            const weight = grade.activity.weight || 1;
            if (!grade.activity.isExtra) {
              weightedSum += grade.numericValue * weight;
              totalWeight += weight;
            }
            activities.push({
              activityId: grade.activityId,
              activityName: grade.activity.name,
              score: grade.numericValue,
              weight: grade.activity.weight,
              isExtra: grade.activity.isExtra,
            });
          }
        }

        const average = totalWeight > 0 ? weightedSum / totalWeight : null;
        evaluationsData[evaluation.id] = {
          evaluationId: evaluation.id,
          evaluationName: evaluation.name,
          grades: activities,
          average,
          qualitativeValue: average !== null ? getQualitativeValue(average) : null,
          gradeCount: activities.length,
        };
      }

      return {
        id: student.id,
        listNumber: student.listNumber,
        name: `${student.firstName || student.name} ${student.lastName1 || student.surname1}`,
        surname1: student.lastName1 || student.surname1,
        surname2: student.lastName2 || student.surname2,
        evaluations: evaluationsData,
        totalAbsences: studentAbsences.filter((a) => a.type === "ABSENT").length,
        totalLates: studentAbsences.filter((a) => a.type === "LATE").length,
      };
    }),
  };

  return NextResponse.json(gradebook);
}
