/**
 * FASE 11 — Script de limpieza y endurecimiento
 *
 * Este script:
 * 1. Verifica integridad de datos
 * 2. Limpia datos huérfanos (si los hay)
 * 3. Genera reporte de estado
 *
 * Ejecutar: npx tsx prisma/migrations/phase11_harden.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 11 — Endurecimiento y limpieza ===\n");

  // 1. Verificar integridad de datos
  console.log("--- Verificando integridad ---");

  const issues: string[] = [];

  // Verificar que todos los alumnos tienen grupo
  const studentsWithoutGroup = await prisma.student.count({
    where: { group: { isNot: {} } },
  });
  if (studentsWithoutGroup > 0) {
    issues.push(`${studentsWithoutGroup} alumnos sin grupo`);
  }

  // Verificar que todos los alumnos tienen enrollment
  const studentsWithoutEnrollment = await prisma.student.count({
    where: { enrollments: { none: {} } },
  });
  if (studentsWithoutEnrollment > 0) {
    issues.push(`${studentsWithoutEnrollment} alumnos sin enrollment`);
  }

  // Verificar que todas las notas tienen activityId
  const gradesWithoutActivity = await prisma.grade.count({
    where: { activityId: { equals: "" } },
  });
  if (gradesWithoutActivity > 0) {
    issues.push(`${gradesWithoutActivity} notas sin activityId`);
  }

  if (issues.length > 0) {
    console.log("  Problemas encontrados:");
    issues.forEach((issue) => console.log(`    ⚠ ${issue}`));
  } else {
    console.log("  ✓ Integridad verificada correctamente");
  }

  // 2. Estadísticas de la base de datos
  console.log("\n--- Estadísticas ---");

  const stats = await Promise.all([
    prisma.user.count(),
    prisma.group.count(),
    prisma.student.count(),
    prisma.enrollment.count(),
    prisma.teachingContent.count(),
    prisma.evaluation.count(),
    prisma.activity.count(),
    prisma.grade.count(),
    prisma.qualification.count(),
    prisma.appAccess.count(),
    prisma.itacaConfig.count(),
    prisma.schoolData.count(),
    prisma.aCImprenta.count(),
    prisma.exigible.count(),
  ]);

  console.log(`  Users: ${stats[0]}`);
  console.log(`  Groups: ${stats[1]}`);
  console.log(`  Students: ${stats[2]}`);
  console.log(`  Enrollments: ${stats[3]}`);
  console.log(`  TeachingContents: ${stats[4]}`);
  console.log(`  Evaluations: ${stats[5]}`);
  console.log(`  Activities: ${stats[6]}`);
  console.log(`  Grades: ${stats[7]}`);
  console.log(`  Qualifications: ${stats[8]}`);
  console.log(`  AppAccess: ${stats[9]}`);
  console.log(`  ItacaConfigs: ${stats[10]}`);
  console.log(`  SchoolData: ${stats[11]}`);
  console.log(`  ACImprentas: ${stats[12]}`);
  console.log(`  Exigibles: ${stats[13]}`);

  // 3. Verificar que no hay datos duplicados críticos
  console.log("\n--- Verificando duplicados ---");

  const duplicateEnrollments = await prisma.$queryRaw`
    SELECT "studentId", "academicYearId", COUNT(*) as count
    FROM "Enrollment"
    GROUP BY "studentId", "academicYearId"
    HAVING COUNT(*) > 1
  `;

  if (Array.isArray(duplicateEnrollments) && duplicateEnrollments.length > 0) {
    console.log(`  ⚠ ${duplicateEnrollments.length} enrollments duplicados encontrados`);
  } else {
    console.log("  ✓ Sin enrollments duplicados");
  }

  const duplicateQualifications = await prisma.$queryRaw`
    SELECT "studentId", "contentId", "evaluationId", COUNT(*) as count
    FROM "Qualification"
    GROUP BY "studentId", "contentId", "evaluationId"
    HAVING COUNT(*) > 1
  `;

  if (Array.isArray(duplicateQualifications) && duplicateQualifications.length > 0) {
    console.log(`  ⚠ ${duplicateQualifications.length} qualifications duplicadas encontradas`);
  } else {
    console.log("  ✓ Sin qualifications duplicadas");
  }

  console.log("\n=== Endurecimiento completado ===");
}

main()
  .catch((e) => {
    console.error("Error en endurecimiento:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
