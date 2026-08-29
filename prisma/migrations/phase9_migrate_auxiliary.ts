/**
 * FASE 9 — Migración de datos: ACImprenta y Exigible
 *
 * Este script:
 * 1. Crea ACImprenta para cada alumno existente
 * 2. Crea Exigible para cada alumno/materia
 *
 * Ejecutar: npx tsx prisma/migrations/phase9_migrate_auxiliary.ts
 */

import { PrismaClient } from "../../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 9 — Migración de tablas auxiliares ===\n");

  // Obtener el año académico activo
  const activeYear = await prisma.academicYear.findFirst({
    where: { status: "ACTIVE" },
  });

  if (!activeYear) {
    console.log("  ⚠ No se encontró año académico activo");
    return;
  }

  // 1. Crear ACImprenta para cada alumno
  const students = await prisma.student.findMany({
    include: { group: true },
  });

  console.log(`Alumnos encontrados: ${students.length}`);

  let acImprentasCreated = 0;

  for (const student of students) {
    const existing = await prisma.aCImprenta.findFirst({
      where: {
        studentId: student.id,
        academicYearId: activeYear.id,
      },
    });

    if (existing) continue;

    await prisma.aCImprenta.create({
      data: {
        studentId: student.id,
        academicYearId: activeYear.id,
        documentType: "DNI",
        documentNumber: student.nia || "00000000",
        fullName: `${student.firstName || student.name} ${student.lastName1 || student.surname1} ${student.lastName2 || student.surname2 || ""}`.trim(),
        birthDate: student.dateOfBirth,
        gender: null,
        nationality: "ES",
      },
    });

    acImprentasCreated++;
  }

  console.log(`  ACImprentas creadas: ${acImprentasCreated}`);

  // 2. Crear Exigible para cada alumno/materia
  const contents = await prisma.teachingContent.findMany();

  console.log(`\nMaterias encontradas: ${contents.length}`);

  let exigiblesCreated = 0;

  for (const student of students) {
    for (const content of contents) {
      const existing = await prisma.exigible.findFirst({
        where: {
          studentId: student.id,
          contentId: content.id,
          academicYearId: activeYear.id,
        },
      });

      if (existing) continue;

      await prisma.exigible.create({
        data: {
          studentId: student.id,
          contentId: content.id,
          academicYearId: activeYear.id,
          isRequired: true,
          isCompleted: false,
        },
      });

      exigiblesCreated++;
    }
  }

  console.log(`  Exigibles creados: ${exigiblesCreated}`);

  // Resumen
  const counts = await Promise.all([
    prisma.aCImprenta.count(),
    prisma.exigible.count(),
  ]);

  console.log("\n=== Resumen ===");
  console.log(`  ACImprentas: ${counts[0]}`);
  console.log(`  Exigibles: ${counts[1]}`);
  console.log("\nMigración FASE 9 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
