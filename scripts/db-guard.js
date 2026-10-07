#!/usr/bin/env node
/**
 * db-guard: aplica el schema a la base de datos SIN permitir pérdida de datos.
 *
 * Por qué: `prisma db push --accept-data-loss` borra columnas y tablas sin
 * avisar. Con datos de alumnos eso es inaceptable, así que antes de aplicar
 * nada se calcula el diff y, si contiene operaciones destructivas, se aborta.
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

function run(args, opts = {}) {
  return execFileSync("npx", ["prisma", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function log(msg) {
  console.log(`[db-guard] ${msg}`);
}

/**
 * Operaciones que destruyen datos o estructura. Si el diff contiene alguna,
 * abortamos en lugar de aplicarlas.
 */
const DESTRUCTIVE = [
  { re: /^\s*--\s*DropTable\b/mi, what: "una tabla sería eliminada" },
  { re: /^\s*DROP\s+TABLE\b/mi, what: "una tabla sería eliminada" },
  { re: /^\s*--\s*DropColumn\b/mi, what: "una columna sería eliminada" },
  { re: /^\s*ALTER\s+TABLE[\s\S]{0,200}?\bDROP\s+COLUMN\b/mi, what: "una columna sería eliminada" },
  { re: /^\s*--\s*DropIndex\b/mi, what: "un índice sería eliminado" },
  { re: /^\s*--\s*DropForeignKey\b/mi, what: "una clave foránea sería eliminada" },
  { re: /^\s*--\s*DropPrimaryKey\b/mi, what: "una clave primaria sería eliminada" },
  { re: /\bALTER\s+COLUMN\b[\s\S]{0,120}?\bTYPE\b[\s\S]{0,120}?\bUSING\b/mi, what: "el tipo de una columna cambiaría con conversión de datos (USING)" },
];

function computeDiff() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  try {
    return run(
      [
        "migrate",
        "diff",
        "--from-url",
        process.env.DATABASE_URL || "env(DATABASE_URL)",
        "--to-schema-datamodel",
        SCHEMA,
        "--script",
      ],
      { quiet: true }
    );
  } catch (err) {
    const msg = `${err.stdout || ""}${err.stderr || ""}`;
    log("No se pudo calcular el diff contra la base de datos.");
    log(msg.trim().split("\n").slice(0, 12).join("\n"));
    process.exit(1);
  }
}

function status() {
  const sql = computeDiff();
  fs.writeFileSync(OUT, sql || "");
  const risky = DESTRUCTIVE.filter((d) => d.re.test(sql));
  if (risky.length === 0) {
    log("Sin operaciones destructivas pendientes. Base de datos alineada o solo con cambios aditivos.");
    return;
  }
  log("ATENCIÓN: hay cambios destructivos pendientes. NO se aplicarán automáticamente:");
  risky.forEach((r) => log(`  - ${r.what}`));
  log("Diff completo guardado en .next/db-diff.sql");
  process.exit(2);
}

function push() {
  const skipGenerate = process.argv.includes("--skip-generate");
  const sql = computeDiff();
  fs.writeFileSync(OUT, sql || "");

  const trimmed = (sql || "").trim();

  // Sin cambios: no hay nada que hacer.
  if (!trimmed || /^\s*--\s*(This is an empty migration|No changes)/mi.test(trimmed)) {
    log("Sin cambios de schema pendientes.");
    if (!skipGenerate) run(["generate"]);
    return;
  }

  const risky = DESTRUCTIVE.filter((d) => d.re.test(trimmed));
  if (risky.length > 0) {
    log("╔══════════════════════════════════════════════════════════╗");
    log("║  APLICACIÓN ABORTADA: se perderían datos                  ║");
    log("╚══════════════════════════════════════════════════════════╝");
    risky.forEach((r) => log(`  - ${r.what}`));
    log("");
    log("El schema NO se ha aplicado. La base de datos está intacta.");
    log("Diff guardado en .next/db-diff.sql para revisión manual.");
    process.exit(3);
  }

  log("Aplicando cambios de schema (solo aditivos / no destructivos)...");
  const args = ["db", "push", "--skip-generate"];
  // Sin --accept-data-loss: si Prisma detecta riesgo, falla en lugar de borrar.
  run(args);
  if (!skipGenerate) run(["generate"]);
  log("Schema aplicado correctamente.");
}

const cmd = process.argv[2];
if (cmd === "status") status();
else if (cmd === "push") push();
else {
  console.error("Uso: node scripts/db-guard.js <push|status>");
  process.exit(1);
}