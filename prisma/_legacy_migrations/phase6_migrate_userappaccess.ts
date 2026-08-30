/**
 * FASE 6 — Migración de datos: UserAppAccess
 *
 * Este script:
 * 1. Crea UserAppAccess para cada usuario existente
 *
 * Ejecutar: npx tsx prisma/migrations/phase6_migrate_userappaccess.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FASE 6 — Migración de UserAppAccess ===\n");

  // Obtener todos los usuarios
  const users = await prisma.user.findMany();

  console.log(`Usuarios encontrados: ${users.length}`);

  let accessCreated = 0;

  for (const user of users) {
    // Verificar si ya existe
    const existing = await prisma.userAppAccess.findFirst({
      where: { userId: user.id },
    });

    if (existing) {
      continue;
    }

    await prisma.userAppAccess.create({
      data: {
        userId: user.id,
        isActive: true,
      },
    });

    accessCreated++;
    console.log(`  → UserAppAccess creado para ${user.email || user.name}`);
  }

  console.log(`\nUserAppAccess creados: ${accessCreated}`);

  // Resumen
  const count = await prisma.userAppAccess.count();
  console.log("\n=== Resumen ===");
  console.log(`  UserAppAccess: ${count}`);
  console.log("\nMigración FASE 6 completada.");
}

main()
  .catch((e) => {
    console.error("Error en migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
