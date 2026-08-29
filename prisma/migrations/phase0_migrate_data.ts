/**
 * FASE 0 — Migración de datos existentes
 *
 * Este script crea los registros iniciales en:
 * - AcademicYear (a partir de Group.year)
 * - Education (ESO por defecto)
 * - Course (1º por defecto)
 * - ItacaMapping (vacío, pendiente de ITACA)
 *
 * Y enlaza los Group existentes con estos nuevos registros.
 *
 * Ejecutar: npx tsx prisma/migrations/phase0_migrate_data.ts
 */

import { PrismaClient } from "../../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 0 — Migración de datos ===\n");

  // 1. Obtener todos los grupos existentes
  const groups = await prisma.group.findMany({
    orderBy: { year: "asc" },
  });

  console.log(`Grupos encontrados: ${groups.length}`);

  if (groups.length === 0) {
    console.log("No hay grupos que migrar. Fin.");
    return;
  }

  // 2. Obtener años únicos de los grupos
  const uniqueYears = Array.from(new Set(groups.map((g) => g.year))).sort((a, b) => a - b);
  console.log(`Años únicos: ${uniqueYears.join(", ")}\n`);

  // 3. Para cada año, crear AcademicYear si no existe
  const academicYearMap = new Map<number, string>();

  for (const year of uniqueYears) {
    const existing = await prisma.academicYear.findFirst({
      where: { name: `${year}-${year + 1}` },
    });

    if (existing) {
      console.log(`  ✓ AcademicYear "${year}-${year + 1}" ya existe (${existing.id})`);
      academicYearMap.set(year, existing.id);
    } else {
      const created = await prisma.academicYear.create({
        data: {
          name: `${year}-${year + 1}`,
          startDate: new Date(`${year}-09-01`),
          endDate: new Date(`${year + 1}-06-30`),
          status: "ACTIVE",
        },
      });
      console.log(`  + AcademicYear "${year}-${year + 1}" creado (${created.id})`);
      academicYearMap.set(year, created.id);
    }
  }

  // 4. Crear Education "ESO" por defecto (si no existe)
  let defaultEducation = await prisma.education.findFirst({
    where: { name: "ESO" },
  });

  if (!defaultEducation) {
    defaultEducation = await prisma.education.create({
      data: {
        name: "ESO",
        type: "ESO",
        code: "ESO",
      },
    });
    console.log(`\n  + Education "ESO" creado (${defaultEducation.id})`);
  } else {
    console.log(`\n  ✓ Education "ESO" ya existe (${defaultEducation.id})`);
  }

  // 5. Crear Courses "1º" a "4º" por defecto
  const defaultCourses = ["1º", "2º", "3º", "4º"];
  const courseMap = new Map<string, string>();

  for (const courseName of defaultCourses) {
    let course = await prisma.course.findFirst({
      where: {
        educationId: defaultEducation.id,
        name: courseName,
      },
    });

    if (!course) {
      course = await prisma.course.create({
        data: {
          educationId: defaultEducation.id,
          name: courseName,
          code: courseName,
        },
      });
      console.log(`  + Course "${courseName}" creado (${course.id})`);
    } else {
      console.log(`  ✓ Course "${courseName}" ya existe (${course.id})`);
    }
    courseMap.set(courseName, course.id);
  }

  // 6. Enlazar cada Group con AcademicYear, Education y Course
  console.log("\n--- Enlazando grupos ---");

  for (const group of groups) {
    const academicYearId = academicYearMap.get(group.year);

    // Inferir curso del nombre del grupo (ej: "3º ESO A" → "3º")
    const courseMatch = group.name.match(/(\d)º/);
    const courseName = courseMatch ? `${courseMatch[1]}º` : "1º";
    const courseId = courseMap.get(courseName) || courseMap.get("1º")!;

    if (group.academicYearId === academicYearId && group.educationId === defaultEducation.id && group.courseId === courseId) {
      console.log(`  ✓ Grupo "${group.name}" ya enlazado correctamente`);
      continue;
    }

    await prisma.group.update({
      where: { id: group.id },
      data: {
        academicYearId,
        educationId: defaultEducation.id,
        courseId,
      },
    });

    console.log(`  → Grupo "${group.name}" enlazado: year=${group.year}, edu=ESO, course=${courseName}`);
  }

  // 7. Resumen
  const counts = await Promise.all([
    prisma.academicYear.count(),
    prisma.education.count(),
    prisma.course.count(),
    prisma.itacaMapping.count(),
  ]);

  console.log("\n=== Resumen ===");
  console.log(`  AcademicYears: ${counts[0]}`);
  console.log(`  Educations:    ${counts[1]}`);
  console.log(`  Courses:       ${counts[2]}`);
  console.log(`  ItacaMappings: ${counts[3]}`);
  console.log("\nMigración FASE 0 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
