import { NextResponse } from "next/server";
import { getAuthenticatedUser, verifyGroupOwnership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");
  const trimesterId = url.searchParams.get("trimesterId");

  if (!groupId) return NextResponse.json({ error: "groupId requerido" }, { status: 400 });

  const owns = await verifyGroupOwnership(groupId, user.id);
  if (!owns) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  const group = await prisma.group.findFirst({
    where: { id: groupId },
    include: {
      students: {
        orderBy: { listNumber: "asc" },
        include: {
          grades: true,
          absences: true,
          exceptions: { where: { isExcluded: true } },
        },
      },
      trimesters: {
        orderBy: { order: "asc" },
        include: {
          assessments: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });

  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  const targetTrimesters = trimesterId
    ? group.trimesters.filter(t => t.id === trimesterId)
    : group.trimesters;

  const results = group.students.map(student => {
    const evalResults: any[] = [];

    for (const trimester of targetTrimesters) {
      const assessments = trimester.assessments.filter(a => !a.isExtra);
      const gradedAssessments = assessments.filter(a => {
        const grade = student.grades.find(g => g.assessmentId === a.id);
        const isExcluded = student.exceptions.some(e => e.assessmentId === a.id && e.isExcluded);
        return !isExcluded && grade && grade.score !== null;
      });

      let avg: number | null = null;
      if (gradedAssessments.length > 0) {
        const sum = gradedAssessments.reduce((acc, a) => {
          const grade = student.grades.find(g => g.assessmentId === a.id);
          return acc + (grade?.score ?? 0);
        }, 0);
        avg = sum / gradedAssessments.length;
      }

      // Apply absence penalties
      const tAbs = student.absences.filter(a => !a.trimesterId || a.trimesterId === trimester.id);
      const absCount = tAbs.filter(a => a.type === "ABSENT" || a.type === "A").length;
      const lateCount = tAbs.filter(a => a.type === "LATE" || a.type === "R").length;
      const negCount = tAbs.filter(a => a.type === "NEGATIVE" || a.type === "N").length;
      const penalty =
        (absCount * (group.penaltyAbsence ?? 0)) +
        (lateCount * (group.penaltyLate ?? 0)) +
        (negCount * (group.penaltyNegative ?? 0));

      const penalizedAvg = avg !== null && penalty > 0 ? Math.max(0, avg - penalty) : avg;

      evalResults.push({
        trimesterId: trimester.id,
        trimesterName: trimester.name,
        percentage: trimester.percentage,
        average: penalizedAvg,
        rawAverage: avg,
        penalty,
        gradedCount: gradedAssessments.length,
        totalAssessments: assessments.length,
        qualitativeValue: getQualitative(penalizedAvg),
      });
    }

    // Calculate final average across all trimesters
    let finalSum = 0;
    let weightSum = 0;
    for (const er of evalResults) {
      if (er.average !== null) {
        finalSum += er.average * (er.percentage / 100);
        weightSum += er.percentage / 100;
      }
    }
    const finalAverage = weightSum > 0 ? finalSum / weightSum : null;

    return {
      studentId: student.id,
      listNumber: student.listNumber,
      name: student.name,
      surname1: student.surname1,
      surname2: student.surname2,
      firstName: student.firstName,
      lastName1: student.lastName1,
      trimesters: evalResults,
      finalAverage,
      finalQualitative: getQualitative(finalAverage),
    };
  });

  return NextResponse.json({
    groupId,
    groupName: group.name,
    trimesters: targetTrimesters.map(t => ({
      id: t.id,
      name: t.name,
      percentage: t.percentage,
      assessments: t.assessments.map(a => ({
        id: a.id,
        name: a.name,
        maxScore: a.maxScore,
        percentage: a.percentage,
      })),
    })),
    students: results,
  });
}

function getQualitative(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 9) return "SB";
  if (score >= 7) return "BI";
  if (score >= 5) return "SU";
  if (score >= 3) return "SU-";
  return "INS";
}
