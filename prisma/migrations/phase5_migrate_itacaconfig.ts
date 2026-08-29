/**
 * FASE 5 — Migración de datos: ItacaConfig
 *
 * Este script:
 * 1. Crea ItacaConfig para cada AcademicYear existente
 *
 * Ejecutar: npx tsx prisma/migrations/phase5_migrate_itacaconfig.ts
 */

import { PrismaClient } from "../../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 5 — Migración de ItacaConfig ===\n");

  // Obtener todos los años académicos
  const academicYears = await prisma.academicYear.findMany({
    orderBy: { name: "desc" },
  });

  console.log(`Años académicos encontrados: ${academicYears.length}`);

  let configsCreated = 0;

  for (const year of academicYears) {
    // Verificar si ya existe config
    const existing = await prisma.itacaConfig.findFirst({
      where: { academicYearId: year.id },
    });

    if (existing) {
      continue;
    }

    await prisma.itacaConfig.create({
      data: {
        academicYearId: year.id,
        itacaUrl: "https://itaca.example.com", // URL por defecto
        syncEnabled: true,
        autoSync: false,
        syncInterval: 60,
      },
    });

    configsCreated++;
    console.log(`  → Config creada para "${year.name}"`);
  }

  console.log(`\nItacaConfigs creadas: ${configsCreated}`);

  // Resumen
  const count = await prisma.itacaConfig.count();
  console.log("\n=== Resumen ===");
  console.log(`  ItacaConfigs: ${count}`);
  console.log("\nMigración FASE 5 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
