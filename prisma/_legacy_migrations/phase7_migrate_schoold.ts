/**
 * FASE 7 — Migración de datos: SchoolData y AcademicYearData
 *
 * Este script:
 * 1. Crea SchoolData con datos por defecto del centro
 * 2. Crea AcademicYearData para cada año académico existente
 *
 * Ejecutar: npx tsx prisma/migrations/phase7_migrate_schoold.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 7 — Migración de SchoolData ===\n");

  // 1. Crear SchoolData si no existe
  let schoolData = await prisma.schoolData.findFirst();

  if (!schoolData) {
    schoolData = await prisma.schoolData.create({
      data: {
        name: "IES Ejemplo",
        code: "CENTRO001",
        address: "Calle Principal, 1",
        city: "Madrid",
        province: "Madrid",
        postalCode: "28001",
        phone: "912 345 678",
        email: "info@iesejemplo.edu",
        website: "https://iesejemplo.edu",
        director: "Director/a del Centro",
        educationType: "MIXED",
      },
    });
    console.log(`  → SchoolData creada: ${schoolData.name} (${schoolData.id})`);
  } else {
    console.log(`  → SchoolData ya existe: ${schoolData.name}`);
  }

  // 2. Crear AcademicYearData para cada año académico
  const academicYears = await prisma.academicYear.findMany();

  console.log(`\nAños académicos encontrados: ${academicYears.length}`);

  let yearDataCreated = 0;

  for (const year of academicYears) {
    const existing = await prisma.academicYearData.findFirst({
      where: { academicYearId: year.id },
    });

    if (existing) {
      continue;
    }

    await prisma.academicYearData.create({
      data: {
        schoolDataId: schoolData.id,
        academicYearId: year.id,
        calendar: {
          startDate: year.startDate || "2026-09-01",
          endDate: year.endDate || "2027-06-30",
          trimesters: [
            { name: "1ª Evaluación", start: "2026-09-01", end: "2026-12-22" },
            { name: "2ª Evaluación", start: "2027-01-07", end: "2027-03-26" },
            { name: "3ª Evaluación", start: "2027-04-07", end: "2027-06-30" },
          ],
        },
        rules: {
          passingScore: 5,
          evaluationPeriods: 3,
          recoveryEnabled: true,
        },
      },
    });

    yearDataCreated++;
    console.log(`  → AcademicYearData creada para "${year.name}"`);
  }

  console.log(`\nAcademicYearData creadas: ${yearDataCreated}`);

  // Resumen
  const counts = await Promise.all([
    prisma.schoolData.count(),
    prisma.academicYearData.count(),
  ]);

  console.log("\n=== Resumen ===");
  console.log(`  SchoolData: ${counts[0]}`);
  console.log(`  AcademicYearData: ${counts[1]}`);
  console.log("\nMigración FASE 7 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
