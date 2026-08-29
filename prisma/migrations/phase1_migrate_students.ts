/**
 * FASE 1 — Migración de datos de alumnos
 *
 * Este script:
 * 1. Migra name → firstName, surname1 → lastName1, surname2 → lastName2
 * 2. Crea Enrollment para cada alumno existente
 *
 * Ejecutar: npx tsx prisma/migrations/phase1_migrate_students.ts
 */

import { PrismaClient } from "../../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 1 — Migración de alumnos ===\n");

  // 1. Obtener todos los alumnos con su grupo
  const students = await prisma.student.findMany({
    include: { group: { include: { academicYear: true, education: true, course: true } } },
    orderBy: { listNumber: "asc" },
  });

  console.log(`Alumnos encontrados: ${students.length}`);

  if (students.length === 0) {
    console.log("No hay alumnos que migrar. Fin.");
    return;
  }

  // 2. Migrar campos de identidad
  console.log("\n--- Migrando campos de identidad ---");
  let migrated = 0;
  let alreadyMigrated = 0;

  for (const student of students) {
    // Solo migrar si firstName es null (no migrado aún)
    if (student.firstName) {
      alreadyMigrated++;
      continue;
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        firstName: student.name,
        lastName1: student.surname1,
        lastName2: student.surname2,
        status: "ACTIVE",
      },
    });

    console.log(`  → ${student.name} ${student.surname1} ${student.surname2 || ""} migrado`);
    migrated++;
  }

  console.log(`  Migrados: ${alreadyMigrated} ya existían, ${migrated} nuevos`);

  // 3. Crear Enrollment para cada alumno
  console.log("\n--- Creando enrollments ---");
  let enrollmentsCreated = 0;
  let enrollmentsSkipped = 0;

  for (const student of students) {
    // Determinar academicYearId del grupo
    let academicYearId = student.group.academicYearId;

    // Si el grupo no tiene academicYear, buscar el más reciente
    if (!academicYearId) {
      const latestYear = await prisma.academicYear.findFirst({
        orderBy: { name: "desc" },
      });
      if (latestYear) {
        academicYearId = latestYear.id;
      } else {
        console.log(`  ⚠ No se pudo crear enrollment para ${student.name}: sin academicYear`);
        continue;
      }
    }

    const ayId = academicYearId;

    // Verificar si ya tiene enrollment
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: student.id,
        academicYearId: ayId,
      },
    });

    if (existingEnrollment) {
      enrollmentsSkipped++;
      continue;
    }

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        academicYearId: ayId,
        educationId: student.group.educationId,
        courseId: student.group.courseId,
        groupId: student.group.id,
        startDate: student.group.academicYear?.startDate || new Date("2026-09-01"),
        status: "ACTIVE",
      },
    });

    enrollmentsCreated++;
  }

  console.log(`  Enrollments creados: ${enrollmentsCreated}, ya existían: ${enrollmentsSkipped}`);

  // 4. Resumen
  const counts = await Promise.all([
    prisma.student.count(),
    prisma.enrollment.count(),
  ]);

  console.log("\n=== Resumen ===");
  console.log(`  Students: ${counts[0]}`);
  console.log(`  Enrollments: ${counts[1]}`);
  console.log("\nMigración FASE 1 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
