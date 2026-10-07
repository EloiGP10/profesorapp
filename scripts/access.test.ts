import { PrismaClient } from "@prisma/client";
import {
  accessibleGroups,
  writableGroups,
  canAccessGroup,
  groupRole,
} from "../src/lib/access";

/**
 * Valida la FORMA de las consultas de acceso sin tocar la base de datos real.
 *
 * Por qué existe: estos filtros se usan en 21 rutas y un error de forma
 * (por ejemplo, una relación mal nombrada) no se detecta al compilar; solo
 * falla en producción y devuelve cero filas. Un grupo invisible se parece
 * mucho a un grupo borrado, así que conviene comprobarlo aparte.
 *
 * Se conecta a una dirección inexistente a propósito: si lo único que falla
 * es la conexión, la consulta está bien formada. Si el error habla de
 * argumentos o de una relación desconocida, la consulta está mal.
 *
 * Ejecutar: npx tsx scripts/access.test.ts
 */

// Si no hay DATABASE_URL en el entorno, se usa una inalcanzable: así el
// único error posible es de conexión y la forma de la consulta queda aislada.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://u:p@127.0.0.1:9/inexistente?schema=profesorapp";
}

const prisma = new PrismaClient();

let failures = 0;

async function probe(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    console.log(`OK   ${label} (ejecutada de verdad: hay base de datos)`);
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    const soloConexion =
      /Can't reach database|P1001|P1012|Connection refused|timed out/i.test(msg);
    const detalle =
      msg
        .split("\n")
        .find((l) => /Unknown argument|Invalid .*invocation|Argument .* is not/i.test(l)) ?? "";
    if (soloConexion) {
      console.log(`OK   ${label} (forma válida; solo falló la conexión)`);
    } else {
      failures++;
      console.log(`FALLO ${label} -> ${detalle.trim() || msg.slice(0, 120)}`);
    }
  }
}

(async () => {
  await probe("writableGroups", () =>
    prisma.group.findMany({ where: writableGroups("u1"), take: 1 })
  );
  await probe("accessibleGroups", () =>
    prisma.group.findMany({ where: accessibleGroups("u1"), take: 1 })
  );
  await probe("id + writableGroups", () =>
    prisma.group.findMany({ where: { id: "x", ...writableGroups("u1") }, take: 1 })
  );
  await probe("canAccessGroup", () => canAccessGroup("u1", "g1"));
  await probe("canManageGroup", () =>
    import("../src/lib/access").then((m) => m.canManageGroup("u1", "g1"))
  );
  await probe("groupRole", () => groupRole("u1", "g1"));

  await prisma.$disconnect();
  console.log(failures === 0 ? "\nForma de las consultas: correcta." : `\n${failures} fallo(s).`);
  process.exit(failures === 0 ? 0 : 1);
})();