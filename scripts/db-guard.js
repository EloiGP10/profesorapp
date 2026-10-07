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
 *
 * `prisma db push` no sirve aquí: se niega con "use --accept-data-loss"
 * aunque el diff sea 100 % aditivo, porque su aviso es conservador y no
 * permite distinguir. Por eso se usa `migrate diff`, que siempre imprime
 * el SQL, se revisa sentencia a sentencia y, solo si todas son seguras,
 * se ejecutan con `prisma db execute`.
 */
const DESTRUCTIVE = [
  { re: /^\s*DROP\s+(TABLE|COLUMN|INDEX|TYPE|SCHEMA)\b/im, what: "se eliminaría algo" },
  { re: /^\s*DROP\b/im, what: "se eliminaría algo" },
  { re: /^\s*ALTER\s+TABLE[\s\S]{0,300}?\bDROP\b/im, what: "ALTER TABLE ... DROP" },
  { re: /^\s*TRUNCATE\b/im, what: "se truncaría una tabla" },
  { re: /^\s*DELETE\s+FROM\b/im, what: "se borrarían filas" },
  {
    re: /ALTER\s+COLUMN\b[\s\S]{0,200}?\bSET\s+DATA\s+TYPE\b/im,
    what: "cambiaría el tipo de una columna",
  },
  { re: /ALTER\s+COLUMN\b[\s\S]{0,200}?\bDROP\b/im, what: "ALTER COLUMN ... DROP" },
];

function diffDestructiveOps(sql) {
  return DESTRUCTIVE.filter((d) => d.re.test(sql)).map((d) => d.what);
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
    // No se pudo calcular el diff contra la base de datos: normalmente la BD
    // no está accesible desde este contenedor. No se aplica nada y se avisa.
    warn(`No se pudo calcular el diff: ${error}`);
    warn("Se omite la actualización del schema. La aplicación arranca igual.");
    if (STRICT) process.exit(1);
    return;
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
    const script = path.join(ROOT, ".next", "db-apply.sql");
    fs.writeFileSync(script, trimmed);
    run(["db", "execute", "--file", script, "--schema", SCHEMA]);
    fs.rmSync(script, { force: true });
    log("Schema aplicado correctamente.");
    if (!skipGenerate) safeGenerate();
  } catch (err) {
    warn(`No se pudo aplicar el schema: ${firstLines(err)}`);
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