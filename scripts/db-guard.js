#!/usr/bin/env node
/**
 * db-guard: aplica el schema a la base de datos SIN permitir pérdida de datos.
 *
 * Por qué: `prisma db push --accept-data-loss` borra columnas y tablas sin
 * avisar. Con datos de alumnos eso es inaceptable.
 *
 * Principio de diseño: ESTE SCRIPT NUNCA IMPIDE QUE LA APLICACIÓN ARRANQUE.
 * Un despliegue caído es peor que un cambio de schema pendiente. Si algo falla,
 * el script avisa en el log y el proceso termina con 0; la web levanta con el
 * schema que ya había y las funciones nuevas solo fallan si se usan.
 *
 * Garantía que sí se mantiene: nunca se aplican cambios destructivos.
 *
 *   node scripts/db-guard.js push [--skip-generate]
 *   node scripts/db-guard.js status
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const OUT = path.join(ROOT, ".next", "db-diff.sql");
const STRICT = process.env.DB_GUARD_STRICT === "true";

function log(msg) {
  console.log(`[db-guard] ${msg}`);
}

function warn(msg) {
  console.error(`[db-guard] AVISO: ${msg}`);
}

function run(args) {
  return execFileSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Operaciones que destruyen datos o estructura. Si el diff contiene alguna,
 * no se aplican.
 */
const DESTRUCTIVE = [
  { re: /^\s*--\s*DropTable\b/mi, what: "se eliminaría una tabla" },
  { re: /^\s*DROP\s+TABLE\b/mi, what: "se eliminaría una tabla" },
  { re: /^\s*--\s*DropColumn\b/mi, what: "se eliminaría una columna" },
  { re: /^\s*ALTER\s+TABLE[\s\S]{0,200}?\bDROP\s+COLUMN\b/mi, what: "se eliminaría una columna" },
  { re: /^\s*--\s*DropIndex\b/mi, what: "se eliminaría un índice" },
  { re: /^\s*--\s*DropForeignKey\b/mi, what: "se eliminaría una clave foránea" },
  { re: /^\s*--\s*DropPrimaryKey\b/mi, what: "se eliminaría una clave primaria" },
  {
    re: /\bALTER\s+COLUMN\b[\s\S]{0,140}?\bTYPE\b[\s\S]{0,160}?\bUSING\b/mi,
    what: "cambiaría el tipo de una columna con conversión de datos",
  },
];

function firstLines(err) {
  return `${err.stdout || ""}${err.stderr || ""}`
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-6)
    .join(" | ") || err.message;
}

function diffDestructiveOps(sql) {
  return DESTRUCTIVE.filter((d) => d.re.test(sql)).map((d) => d.what);
}

/**
 * Calcula el diff. Devuelve { ok, sql, error } en vez de lanzar, para poder
 * degradar con elegancia en lugar de tumbar el arranque.
 */
function computeDiff() {
  try {
    const sql = run([
      "migrate",
      "diff",
      "--from-url",
      process.env.DATABASE_URL,
      "--to-schema-datamodel",
      SCHEMA,
      "--script",
    ]);
    return { ok: true, sql: sql || "" };
  } catch (err) {
    const msg = `${err.stdout || ""}${err.stderr || ""}`
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-6)
      .join(" | ");
    return { ok: false, sql: "", error: msg || err.message };
  }
}

function writeDiff(sql) {
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, sql);
  } catch {
    /* el diff es informativo; si no se puede guardar, no es crítico */
  }
}

function status() {
  const { ok, sql, error } = computeDiff();
  if (!ok) {
    warn(`No se pudo consultar la base de datos: ${error}`);
    process.exit(STRICT ? 1 : 0);
  }

  writeDiff(sql);
  const risky = diffDestructiveOps(sql);

  if (risky.length === 0) {
    log("Sin cambios destructivos pendientes.");
    return;
  }
  log("Hay cambios destructivos pendientes (NO se aplicarían automáticamente):");
  risky.forEach((r) => log(`  - ${r}`));
  log(`Diff en ${path.relative(ROOT, OUT)}`);
  process.exit(2);
}

function push(skipGenerate) {
  if (!process.env.DATABASE_URL) {
    warn(
      "DATABASE_URL no está definida. Se omite la actualización del schema y " +
        "la aplicación arranca con el schema actual."
    );
    return;
  }

  const { ok, sql, error } = computeDiff();

  if (!ok) {
    // No se pudo calcular el diff, así que no se puede comprobar si el push
    // sería destructivo. Aun así se intenta: `db push` SIN
    // --accept-data-loss sigue siendo seguro, porque Prisma aborta por su
    // cuenta si detectara pérdida de datos, y crea las tablas que falten.
    warn(`No se pudo calcular el diff: ${error}`);
    warn("Se intenta aplicar el schema igualmente en modo seguro.");
    try {
      run(["db", "push", "--skip-generate"]);
      log("Schema aplicado.");
      if (!skipGenerate) safeGenerate();
      return;
    } catch (err) {
      warn(`No se pudo aplicar el schema: ${firstLines(err)}`);
      warn("La aplicación arranca con el schema actual.");
      if (STRICT) process.exit(1);
      return;
    }
  }

  writeDiff(sql);
  const trimmed = sql.trim();

  if (!trimmed || /^\s*--\s*(This is an empty migration|No changes)/mi.test(trimmed)) {
    log("Sin cambios de schema pendientes.");
    if (!skipGenerate) safeGenerate();
    return;
  }

  const risky = diffDestructiveOps(trimmed);
  if (risky.length > 0) {
    warn("╔═══════════════════════════════════════════════════════════╗");
    warn("║  NO SE APLICA EL SCHEMA: se perderían datos                 ║");
    warn("╚═══════════════════════════════════════════════════════════╝");
    risky.forEach((r) => warn(`  - ${r}`));
    warn(`Diff para revisión manual en ${path.relative(ROOT, OUT)}`);
    warn("La aplicación arranca con el schema actual; corrige esto en caliente.");
    if (STRICT) process.exit(3);
    return;
  }

  log("Aplicando cambios de schema (aditivos)...");
  try {
    // Sin --accept-data-loss: si Prisma detecta riesgo, falla en lugar de borrar.
    run(["db", "push", "--skip-generate"]);
    log("Schema aplicado correctamente.");
    if (!skipGenerate) safeGenerate();
  } catch (err) {
    const msg = `${err.stdout || ""}${err.stderr || ""}`
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-6)
      .join(" | ");
    warn(`No se pudo aplicar el schema: ${msg}`);
    warn("La aplicación arranca con el schema actual.");
    if (STRICT) process.exit(1);
  }
}

function safeGenerate() {
  try {
    run(["generate"]);
  } catch (err) {
    warn(`No se pudo regenerar el cliente de Prisma: ${err.message}`);
  }
}

const cmd = process.argv[2];
if (cmd === "status") status();
else if (cmd === "push") push(process.argv.includes("--skip-generate"));
else {
  console.error("Uso: node scripts/db-guard.js <push|status>");
  process.exit(1);
}