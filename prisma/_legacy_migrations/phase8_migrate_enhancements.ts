/**
 * FASE 8 — Migración de datos: Enhancements
 *
 * Este script:
 * 1. Actualiza faltas existentes con source "MANUAL"
 * 2. Actualiza notas existentes con category "ACADEMIC"
 * 3. Actualiza recordatorios existentes con priority "MEDIUM"
 *
 * Ejecutar: npx tsx prisma/migrations/phase8_migrate_enhancements.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 8 — Migración de Enhancements ===\n");

  // 1. Actualizar faltas existentes
  const absences = await prisma.absence.findMany();
  console.log(`Faltas encontradas: ${absences.length}`);

  if (absences.length > 0) {
    await prisma.absence.updateMany({
      data: {
        source: "MANUAL",
        penalty: 0,
      },
    });
    console.log(`  → Faltas actualizadas con source="MANUAL"`);
  }

  // 2. Actualizar notas existentes
  const notes = await prisma.studentNote.findMany();
  console.log(`Notas encontradas: ${notes.length}`);

  if (notes.length > 0) {
    await prisma.studentNote.updateMany({
      data: {
        category: "ACADEMIC",
        isImportant: false,
        isPrivate: false,
      },
    });
    console.log(`  → Notas actualizadas con category="ACADEMIC"`);
  }

  // 3. Actualizar recordatorios existentes
  const reminders = await prisma.reminder.findMany();
  console.log(`Recordatorios encontrados: ${reminders.length}`);

  if (reminders.length > 0) {
    await prisma.reminder.updateMany({
      data: {
        priority: "MEDIUM",
      },
    });
    console.log(`  → Recordatorios actualizadas con priority="MEDIUM"`);
  }

  // Resumen
  console.log("\n=== Resumen ===");
  console.log(`  Faltas: ${absences.length}`);
  console.log(`  Notas: ${notes.length}`);
  console.log(`  Recordatorios: ${reminders.length}`);
  console.log("\nMigración FASE 8 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
