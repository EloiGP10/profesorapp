import {
  usefulAssessments,
  trimesterRawAverage,
  trimesterAverage,
  studentFinalAverage,
} from "../src/lib/student-stats";

/**
 * Comprueba las reglas de media, que es donde un cambio silencioso cambia las
 * notas de los alumnos sin que nadie se entere.
 *
 * Ejecutar: npx tsx scripts/stats.test.ts
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FALLO"} ${label}`);
  if (!ok) console.log(`      esperado: ${JSON.stringify(expected)}`);
  if (!ok) console.log(`      obtenido: ${JSON.stringify(actual)}`);
}

const student = {
  id: "stu1",
  grades: [
    { assessmentId: "e1", score: 10 }, // normal con nota -> cuenta
    { assessmentId: "o1", score: 8 }, // opcional con nota -> cuenta
    { assessmentId: "x1", score: 2 }, // voluntario con nota -> NO cuenta
    { assessmentId: "n1", score: null }, // normal sin nota -> no cuenta
    { assessmentId: "c1", score: null }, // opcional sin nota -> no penaliza
    { assessmentId: "z1", score: 10 }, // excluida por excepción
  ],
  absences: [],
  exceptions: [{ assessmentId: "z1", isExcluded: true }],
};

const trimester = {
  id: "t1",
  percentage: 100,
  assessments: [
    { id: "e1", percentage: 10, maxScore: 10, isExtra: false },
    { id: "o1", percentage: 10, maxScore: 10, isExtra: false, isOptional: true },
    { id: "x1", percentage: 10, maxScore: 10, isExtra: true },
    { id: "n1", percentage: 10, maxScore: 10, isExtra: false },
    { id: "c1", percentage: 10, maxScore: 10, isExtra: false, isOptional: true },
    { id: "z1", percentage: 10, maxScore: 10, isExtra: false },
  ],
};

// El voluntario (x1) queda fuera de las computables; el resto entra y luego la
// media descarta los que no tienen nota.
const useful = usefulAssessments(student, trimester).map((a) => a.id).sort();
check("evaluaciones computables", useful, ["c1", "e1", "n1", "o1"]);

// Media = (10 + 8) / 2. El voluntario con un 2 no lo baja.
check("media del trimestre", trimesterRawAverage(student, trimester), 9);

const empty = {
  id: "stu2",
  grades: [{ assessmentId: "x1", score: 5 }],
  absences: [],
  exceptions: [],
};
check("solo voluntarios no da media", trimesterRawAverage(empty, trimester), null);

// Media final ponderada entre trimestres.
const t1 = {
  id: "t1",
  percentage: 50,
  assessments: [{ id: "e1", percentage: 100, maxScore: 10, isExtra: false }],
};
const t2 = {
  id: "t2",
  percentage: 50,
  assessments: [{ id: "o1", percentage: 100, maxScore: 10, isExtra: false }],
};
const dos = {
  id: "stu3",
  grades: [
    { assessmentId: "e1", score: 10 },
    { assessmentId: "o1", score: 6 },
  ],
  absences: [],
  exceptions: [],
};
check(
  "media final ponderada 50/50",
  studentFinalAverage(dos, [t1, t2], { absence: 0, late: 0, negative: 0 }),
  8
);

// Penalización por faltas: la resta la hace trimesterAverage, no la media bruta.
const conFaltas = {
  id: "stu4",
  grades: [{ assessmentId: "e1", score: 8 }],
  absences: [{ type: "ABSENT", trimesterId: "t1" }],
  exceptions: [],
};
check(
  "sin penalizacion la media no cambia",
  trimesterAverage(conFaltas, trimester, { absence: 0, late: 0, negative: 0 }),
  8
);
check(
  "una falta resta la penalizacion del centro",
  trimesterAverage(conFaltas, trimester, { absence: 1, late: 0, negative: 0 }),
  7
);
check(
  "la media nunca baja de 0",
  trimesterAverage(conFaltas, trimester, { absence: 20, late: 0, negative: 0 }),
  0
);

console.log(failures === 0 ? "\nTodo correcto." : `\n${failures} fallo(s).`);
process.exit(failures === 0 ? 0 : 1);