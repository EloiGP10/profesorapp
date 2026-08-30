/**
 * FASE 4 — Migración de datos: AppAccess
 *
 * Este script:
 * 1. Crea AppAccess para cada usuario que ya tiene grupos
 * 2. Otorga rol TEACHER por defecto
 *
 * Ejecutar: npx tsx prisma/migrations/phase4_migrate_appaccess.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 4 — Migración de AppAccess ===\n");

  // Obtener todos los usuarios con sus grupos
  const users = await prisma.user.findMany({
    include: { groups: true },
  });

  console.log(`Usuarios encontrados: ${users.length}`);

  let accessCreated = 0;

  for (const user of users) {
    for (const group of user.groups) {
      // Verificar si ya existe
      const existing = await prisma.appAccess.findFirst({
        where: {
          userId: user.id,
          groupId: group.id,
        },
      });

      if (existing) {
        continue;
      }

      await prisma.appAccess.create({
        data: {
          userId: user.id,
          groupId: group.id,
          role: "TEACHER",
          isActive: true,
        },
      });

      accessCreated++;
      console.log(`  → ${user.email || user.name} → Grupo "${group.name}" (TEACHER)`);
    }
  }

  console.log(`\nAppAccess creados: ${accessCreated}`);

  // Resumen
  const count = await prisma.appAccess.count();
  console.log("\n=== Resumen ===");
  console.log(`  AppAccess: ${count}`);
  console.log("\nMigración FASE 4 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
