#!/usr/bin/env node
/**
 * Diagnóstico + reparación de grupos huérfanos de cuenta.
 *
 * Contexto: la web solo muestra los grupos cuyo `Group.userId` coincide con
 * el usuario de la sesión. Si los grupos pertenecen a otro id (por ejemplo,
 * una cuenta anterior) el panel aparece vacío aunque los datos estén bien.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node scripts/repair-group-ownership.js
 *
 * Por defecto solo diagnostica. Para aplicar el arreglo:
 *   ... node scripts/repair-group-ownership.js --apply --to-email "correo@x.com"
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const toIdx = process.argv.indexOf("--to-email");
const toEmail = toIdx >= 0 ? process.argv[toIdx + 1] : null;

function fmt(n) {
  return String(n).padStart(3, " ");
}

(async () => {
  console.log("=== Cuentas y grupos ===\n");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, _count: { select: { groups: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const u of users) {
    console.log(
      `${fmt(u._count.groups)} grupos  ${u.email}  ${u.name ?? ""}  (${u.id})`
    );
  }

  const target = toEmail
    ? users.find((u) => u.email.toLowerCase() === toEmail.toLowerCase())
    : null;

  if (toEmail && !target) {
    console.error(`\nNo existe ninguna cuenta con el email ${toEmail}`);
    process.exit(1);
  }

  const orphans = users.filter((u) => u._count.groups === 0);

  console.log(`\nCuentas sin grupos: ${orphans.length}`);

  // Grupos cuyo propietario no corresponde a la cuenta indicada.
  const misplaced = target
    ? await prisma.group.findMany({
        where: { userId: { not: target.id } },
        select: { id: true, name: true, userId: true, _count: { select: { students: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  console.log(
    `\nGrupos que NO pertenecen a ${target ? target.email : "<cuenta indicada>"}: ${misplaced.length}`
  );
  misplaced.forEach((g) => {
    console.log(
      `  ${g.name}  · ${g._count.students} alumnos  · actual: ${g.userId}`
    );
  });

  if (!apply) {
    console.log(
      "\nSolo diagnóstico. Para mover los grupos, repite con --apply --to-email ..."
    );
    await prisma.$disconnect();
    return;
  }

  if (!target) {
    console.error("\nFalta --to-email");
    process.exit(1);
  }

  if (misplaced.length === 0) {
    console.log("\nNo hay nada que hacer: los grupos ya son de esa cuenta.");
    await prisma.$disconnect();
    return;
  }

  // Los alumnos cuelgan del grupo, no del usuario, así que mover el grupo
  // arrastra notas, faltas y excepciones sin tocar nada más.
  console.log(`\nMoviendo ${misplaced.length} grupos a ${target.email}...`);
  for (const g of misplaced) {
    await prisma.group.update({
      where: { id: g.id },
      data: { userId: target.id },
    });
    console.log(`  movido: ${g.name}`);
  }

  const after = await prisma.user.findUnique({
    where: { id: target.id },
    select: { _count: { select: { groups: true } } },
  });
  console.log(`\nListo. ${target.email} tiene ahora ${after._count.groups} grupos.`);

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("Error:", e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});