/**
 * FASE 2 — Migración de datos: Trimester → Evaluation, Assessment → Activity
 *
 * Este script:
 * 1. Migra cada Trimester a Evaluation (períodos de evaluación)
 * 2. Migra cada Assessment a Activity (actividades dentro de evaluaciones)
 * 3. Crea TeachingContent a partir de las assessments existentes
 * 4. Migra los datos de Grade: score → numericValue, assessment → activity
 * 5. Migra datos de GradingScale → mapeo cualitativo
 *
 * Ejecutar: npx tsx prisma/migrations/phase2_migrate_content_evaluations.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapeo de scales cualitativos hardcodeados (de acuerdos de evaluación)
function getQualitativeValue(score: number): string | null {
  if (score >= 9) return "SB";
  if (score >= 7) return "BI";
  if (score >= 5) return "SU";
  if (score >= 3) return "SU-"; // suficiente bajo
  if (score >= 0) return "INS";
  return null;
}

async function main() {
  console.log("=== FASE 2 — Migración de contenidos y evaluaciones ===\n");

  // 1. Migrar Trimesters → Evaluations
  console.log("\n--- Migrando Trimesters → Evaluations ---");
  const trimesters = await prisma.trimester.findMany({
    include: { group: true },
    orderBy: { order: "asc" },
  });

  let evaluationsCreated = 0;
  const trimesterToEvaluationMap = new Map<string, string>();

  for (const t of trimesters) {
    const evaluation = await prisma.evaluation.create({
      data: {
        code: `E${evaluationsCreated + 1}`,
        name: t.name,
        type: "ORDINARY",
        academicYearId: t.group.academicYearId!,
        educationId: t.group.educationId || undefined,
      },
    });

    trimesterToEvaluationMap.set(t.id, evaluation.id);
    evaluationsCreated++;
    console.log(`  → Trimester "${t.name}" → Evaluation "${evaluation.name}" (${evaluation.id})`);
  }

  console.log(`  Evaluations creadas: ${evaluationsCreated}`);

  // 2. Migrar Assessments → Activities
  console.log("\n--- Migrando Assessments → Activities ---");
  const assessments = await prisma.assessment.findMany({
    include: { trimester: true },
    orderBy: { order: "asc" },
  });

  let activitiesCreated = 0;
  const assessmentToActivityMap = new Map<string, string>();

  for (const a of assessments) {
    const evaluationId = trimesterToEvaluationMap.get(a.trimesterId);
    if (!evaluationId) {
      console.log(`  ⚠ No se pudo migrar Assessment "${a.name}": sin evaluation`);
      continue;
    }

    const activity = await prisma.activity.create({
      data: {
        name: a.name,
        evaluationId,
        weight: a.percentage,
        maxScore: a.maxScore,
        type: a.type,
        isExtra: a.isExtra,
        order: a.order,
      },
    });

    assessmentToActivityMap.set(a.id, activity.id);
    activitiesCreated++;
  }

  console.log(`  Activities creadas: ${activitiesCreated}`);

  // 3. Crear TeachingContent a partir de assessments únicas
  console.log("\n--- Creando TeachingContent ---");
  const uniqueContentNames = Array.from(new Set(assessments.map((a) => a.name)));
  const contentMap = new Map<string, string>();

  // Obtener la primera educación y curso del primer grupo
  const firstGroup = await prisma.group.findFirst({
    include: { education: true, course: true },
  });

  if (!firstGroup?.educationId) {
    console.log("  ⚠ No se pudo crear TeachingContent: sin educación asociada");
    return;
  }

  for (const contentName of uniqueContentNames) {
    const content = await prisma.teachingContent.create({
      data: {
        code: contentName.substring(0, 10).toUpperCase(),
        name: contentName,
        educationId: firstGroup.educationId,
        courseId: firstGroup.courseId,
        type: "SUBJECT",
      },
    });

    contentMap.set(contentName, content.id);
  }

  console.log(`  TeachingContents creados: ${contentMap.size}`);

  // 4. Migrar Grades: score → numericValue, assessment → activity
  console.log("\n--- Migrando Grades ---");
  const grades = await prisma.grade.findMany({
    include: { student: true, assessment: true },
  });

  let gradesMigrated = 0;
  let gradesSkipped = 0;

  for (const grade of grades) {
    const activityId = assessmentToActivityMap.get(grade.assessmentId);
    if (!activityId) {
      gradesSkipped++;
      continue;
    }

    // Buscar el evaluationId del activity
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { evaluationId: true },
    });

    if (!activity) {
      gradesSkipped++;
      continue;
    }

    // Calcular valor cualitativo
    const qualitativeValue = grade.score !== null
      ? getQualitativeValue(grade.score)
      : null;

    await prisma.grade.update({
      where: { id: grade.id },
      data: {
        activityId,
        evaluationId: activity.evaluationId,
        numericValue: grade.score,
        qualitativeValue,
        rawValue: grade.score,
        status: "NORMAL",
        source: "MANUAL",
      },
    });

    gradesMigrated++;
  }

  console.log(`  Grades migradas: ${gradesMigrated}, saltadas: ${gradesSkipped}`);

  // 5. Resumen
  console.log("\n=== Resumen ===");
  const counts = await Promise.all([
    prisma.teachingContent.count(),
    prisma.evaluation.count(),
    prisma.activity.count(),
    prisma.grade.count({ where: { activityId: { not: null } } }),
  ]);

  console.log(`  TeachingContents: ${counts[0]}`);
  console.log(`  Evaluations: ${counts[1]}`);
  console.log(`  Activities: ${counts[2]}`);
  console.log(`  Grades con activityId: ${counts[3]}`);
  console.log("\nMigración FASE 2 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
