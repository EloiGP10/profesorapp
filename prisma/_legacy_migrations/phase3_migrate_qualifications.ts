/**
 * FASE 3 — Migración de datos: Qualifications y TargetGrades
 *
 * Este script:
 * 1. Crea Qualification para cada alumno/materia/evaluación basándose en las notas existentes
 * 2. No crea TargetGrades (se crean manualmente o por ITACA)
 *
 * Ejecutar: npx tsx prisma/migrations/phase3_migrate_qualifications.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getQualitativeValue(score: number): string | null {
  if (score >= 9) return "SB";
  if (score >= 7) return "BI";
  if (score >= 5) return "SU";
  if (score >= 3) return "SU-";
  if (score >= 0) return "INS";
  return null;
}

async function main() {
  console.log("=== FASE 3 — Migración de Qualifications ===\n");

  // Obtener todas las grades con activityId
  const grades = await prisma.grade.findMany({
    where: { activityId: { not: null } },
    select: {
      studentId: true,
      numericValue: true,
      activity: {
        select: {
          contentId: true,
          evaluationId: true,
          evaluation: {
            select: {
              academicYearId: true,
            },
          },
        },
      },
    },
  });

  console.log(`Grades con activityId: ${grades.length}`);

  // Agrupar por student + content + evaluation
  const grouped = new Map<string, {
    studentId: string;
    contentId: string | null;
    evaluationId: string;
    academicYearId: string;
    scores: number[];
  }>();

  for (const grade of grades) {
    if (!grade.activity || !grade.activity.evaluation) continue;

    const contentId = grade.activity.contentId;
    const evaluationId = grade.activity.evaluationId;
    const academicYearId = grade.activity.evaluation.academicYearId;

    if (!academicYearId) continue;

    const key = `${grade.studentId}-${contentId || 'none'}-${evaluationId}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        studentId: grade.studentId,
        contentId,
        evaluationId,
        academicYearId,
        scores: [],
      });
    }

    const entry = grouped.get(key)!;
    if (grade.numericValue !== null) {
      entry.scores.push(grade.numericValue);
    }
  }

  console.log(`\nAgrupaciones: ${grouped.size}`);

  // Crear Qualifications en batch
  const qualificationsToCreate: Array<{
    studentId: string;
    contentId: string | null;
    evaluationId: string;
    academicYearId: string;
    numericValue: number | null;
    qualitativeValue: string | null;
    rawValue: number | null;
  }> = [];

  const qualificationsData = Array.from(grouped.values());
  for (const data of qualificationsData) {
    // Verificar si ya existe
    const existing = await prisma.qualification.findFirst({
      where: {
        studentId: data.studentId,
        contentId: data.contentId,
        evaluationId: data.evaluationId,
      },
    });

    if (existing) continue;

    const avgScore = data.scores.length > 0
      ? data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length
      : null;

    const qualitativeValue = avgScore !== null ? getQualitativeValue(avgScore) : null;

    qualificationsToCreate.push({
      studentId: data.studentId,
      contentId: data.contentId,
      evaluationId: data.evaluationId,
      academicYearId: data.academicYearId,
      numericValue: avgScore,
      qualitativeValue,
      rawValue: avgScore,
    });
  }

  // Insertar en batch
  if (qualificationsToCreate.length > 0) {
    await prisma.qualification.createMany({
      data: qualificationsToCreate.map(q => ({
        ...q,
        status: "ACTIVE",
        source: "CALCULATED",
      })),
    });
  }

  console.log(`  Qualifications creadas: ${qualificationsToCreate.length}`);

  // Resumen
  const counts = await Promise.all([
    prisma.qualification.count(),
    prisma.targetGrade.count(),
  ]);

  console.log("\n=== Resumen ===");
  console.log(`  Qualifications: ${counts[0]}`);
  console.log(`  TargetGrades: ${counts[1]}`);
  console.log("\nMigración FASE 3 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
