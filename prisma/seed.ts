import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("🌱 Generando cuenta de test y datos de prueba...");

  const testEmail = "demo@profesor.com";
  const testPassword = "password123";

  // Limpiar usuario existente si ya existe
  const existingUser = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (existingUser) {
    console.log("🗑️ Eliminando datos de prueba antiguos...");
    await prisma.user.delete({
      where: { id: existingUser.id },
    });
  }

  const passwordHash = await bcrypt.hash(testPassword, 10);

  // 1. Crear Usuario
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Prof. Carlos García",
      passwordHash,
    },
  });

  console.log(`👤 Usuario creado: ${user.email} (Contraseña: ${testPassword})`);

  // 2. Crear Grupo 1: 1º ESO A
  const group1 = await prisma.group.create({
    data: {
      userId: user.id,
      name: "1º ESO A",
      code: "MAT-1A",
      year: 2026,
      penaltyAbsence: 0.1,
      penaltyLate: 0.05,
      penaltyNegative: 0.25,
      trimesters: {
        create: [
          { name: "Trimestre 1", percentage: 35, order: 1 },
          { name: "Trimestre 2", percentage: 35, order: 2 },
          { name: "Trimestre 3", percentage: 30, order: 3 },
        ],
      },
    },
    include: { trimesters: { orderBy: { order: "asc" } } },
  });

  const t1_g1 = group1.trimesters[0];
  const t2_g1 = group1.trimesters[1];
  const t3_g1 = group1.trimesters[2];

  // 3. Crear Alumnos Grupo 1
  const studentNames = [
    { name: "Sofía", surname1: "Alonso", surname2: "Martín", nia: "10982341" },
    { name: "Lucas", surname1: "Blanco", surname2: "Sanz", nia: "10982342" },
    { name: "Elena", surname1: "Cano", surname2: "Navarro", nia: "10982343" },
    { name: "David", surname1: "Díaz", surname2: "Gómez", nia: "10982344" },
    { name: "Lucía", surname1: "Fernández", surname2: "López", nia: "10982345" },
    { name: "Mateo", surname1: "García", surname2: "Ruiz", nia: "10982346" },
    { name: "Carmen", surname1: "Hernández", surname2: "Pérez", nia: "10982347" },
    { name: "Daniel", surname1: "Jiménez", surname2: "Romero", nia: "10982348" },
    { name: "Paula", surname1: "Lozano", surname2: "Torres", nia: "10982349" },
    { name: "Hugo", surname1: "Marín", surname2: "Vázquez", nia: "10982350" },
    { name: "Sara", surname1: "Moreno", surname2: "Gil", nia: "10982351" },
    { name: "Álvaro", surname1: "Navarro", surname2: "Serrano", nia: "10982352" },
    { name: "Valeria", surname1: "Ortiz", surname2: "Castro", nia: "10982353" },
    { name: "Pablo", surname1: "Pascual", surname2: "Molina", nia: "10982354" },
    { name: "Alba", surname1: "Ramos", surname2: "Suárez", nia: "10982355" },
  ];

  const studentsG1 = [];
  for (let i = 0; i < studentNames.length; i++) {
    const s = studentNames[i];
    const created = await prisma.student.create({
      data: {
        groupId: group1.id,
        listNumber: i + 1,
        name: s.name,
        surname1: s.surname1,
        surname2: s.surname2,
        nia: s.nia,
        email: `${s.name.toLowerCase()}.${s.surname1.toLowerCase()}@alu.edu`,
      },
    });
    studentsG1.push(created);
  }

  // 4. Evaluaciones del Trimestre 1 en Grupo 1
  const exam1 = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      name: "Examen 1 - Números enteros",
      type: "EXAM",
      percentage: 30,
      maxScore: 10,
      order: 1,
    },
  });

  const exam2 = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      name: "Examen 2 - Fracciones",
      type: "EXAM",
      percentage: 30,
      maxScore: 10,
      order: 2,
    },
  });

  const notebook = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      name: "Libreta y Tareas diarias",
      type: "NOTEBOOK",
      percentage: 15,
      maxScore: 10,
      order: 3,
    },
  });

  // Tarea con Rúbrica
  const rubricWork = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      name: "Exposición Oral - Geometría",
      type: "RUBRIC_WORK",
      percentage: 25,
      maxScore: 10,
      order: 4,
      rubric: {
        create: {
          rows: {
            create: [
              {
                title: "Contenido y Rigor Matemático",
                percentage: 30,
                order: 1,
                poorText: "Conceptos incorrectos o incompletos",
                fairText: "Conceptos básicos pero con imprecisiones",
                goodText: "Buena explicación de los conceptos",
                excellentText: "Dominio absoluto, ejemplos claros y rigurosos",
              },
              {
                title: "Expresión Oral y Claridad",
                percentage: 25,
                order: 2,
                poorText: "Lectura directa, difícil de entender",
                fairText: "Ritmo irregular o volumen bajo",
                goodText: "Fluido, claro y con buen tono",
                excellentText: "Excelente oratoria, capta la atención del grupo",
              },
              {
                title: "Material Visual y Apoyo",
                percentage: 25,
                order: 3,
                poorText: "Sin apoyo visual o con errores",
                fairText: "Diapositivas saturadas de texto",
                goodText: "Diapositivas visuales y ordenadas",
                excellentText: "Diseño impecable, modelos 3D y gráficos atractivos",
              },
              {
                title: "Respuestas a Preguntas",
                percentage: 20,
                order: 4,
                poorText: "No responde a las preguntas",
                fairText: "Responde con dudas evidentes",
                goodText: "Responde correctamente a la mayoría",
                excellentText: "Responde con soltura y profundidad",
              },
            ],
          },
        },
      },
    },
    include: { rubric: { include: { rows: true } } },
  });

  // Tarea Voluntaria
  const extraWork = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      name: "Reto Matemático (Voluntario)",
      type: "WORK",
      percentage: 10,
      maxScore: 10,
      isExtra: true,
      order: 5,
    },
  });

  // Tarea Adaptada para Alumno 12 (Álvaro Navarro)
  const customExam = await prisma.assessment.create({
    data: {
      trimesterId: t1_g1.id,
      studentId: studentsG1[11].id,
      name: "Examen Adaptado Fracciones",
      type: "EXAM",
      percentage: 30,
      maxScore: 10,
      order: 6,
    },
  });

  // 5. Asignar Calificaciones realistas
  const exam1Scores = [8.5, 6.0, 9.5, 4.0, 7.25, 8.0, 5.5, 9.0, 6.75, 3.5, 7.0, 5.0, 8.75, 6.5, 9.0];
  const exam2Scores = [9.0, 5.5, 9.0, null, 7.5, 8.5, 6.0, 9.5, 7.0, 4.0, 6.5, null, 8.0, 7.0, 9.5];
  const notebookScores = [9.5, 7.0, 10.0, 6.0, 8.0, 8.5, 7.5, 9.5, 8.0, 5.0, 8.0, 7.0, 9.0, 7.5, 10.0];

  for (let i = 0; i < studentsG1.length; i++) {
    const s = studentsG1[i];

    // Examen 1
    await prisma.grade.create({
      data: { studentId: s.id, assessmentId: exam1.id, score: exam1Scores[i] },
    });

    // Examen 2
    if (exam2Scores[i] !== null) {
      await prisma.grade.create({
        data: { studentId: s.id, assessmentId: exam2.id, score: exam2Scores[i] },
      });
    }

    // Libreta
    await prisma.grade.create({
      data: { studentId: s.id, assessmentId: notebook.id, score: notebookScores[i] },
    });

    // Rúbrica: Calificar los primeros 6 alumnos con rúbrica
    if (i < 6 && rubricWork.rubric) {
      const levels: Array<"POOR" | "FAIR" | "GOOD" | "EXCELLENT"> =
        i === 0 ? ["EXCELLENT", "EXCELLENT", "GOOD", "EXCELLENT"] // ~9.25
        : i === 1 ? ["FAIR", "GOOD", "FAIR", "GOOD"] // ~5.5
        : i === 2 ? ["EXCELLENT", "EXCELLENT", "EXCELLENT", "EXCELLENT"] // 10.0
        : i === 3 ? ["POOR", "FAIR", "FAIR", "POOR"] // ~2.5
        : i === 4 ? ["GOOD", "GOOD", "GOOD", "EXCELLENT"] // ~7.6
        : ["GOOD", "FAIR", "GOOD", "GOOD"]; // ~6.7

      let weightedSum = 0;
      let totalW = 0;
      for (let rIdx = 0; rIdx < rubricWork.rubric.rows.length; rIdx++) {
        const row = rubricWork.rubric.rows[rIdx];
        const lvl = levels[rIdx];
        await prisma.rubricScore.create({
          data: {
            rubricRowId: row.id,
            studentId: s.id,
            level: lvl,
          },
        });
        const val = lvl === "POOR" ? 1 : lvl === "FAIR" ? 4 : lvl === "GOOD" ? 7 : 10;
        weightedSum += (val / 10) * row.percentage * 10;
        totalW += row.percentage;
      }
      const finalRubricScore = Number((weightedSum / totalW).toFixed(2));
      await prisma.grade.create({
        data: { studentId: s.id, assessmentId: rubricWork.id, score: finalRubricScore },
      });
    } else {
      await prisma.grade.create({
        data: { studentId: s.id, assessmentId: rubricWork.id, score: null },
      });
    }

    // Trabajo voluntario (algunos alumnos)
    if (i === 0 || i === 2 || i === 7 || i === 14) {
      await prisma.grade.create({
        data: { studentId: s.id, assessmentId: extraWork.id, score: 9.5 },
      });
    }
  }

  // Nota del examen adaptado para Álvaro (Alumno 12)
  await prisma.grade.create({
    data: { studentId: studentsG1[11].id, assessmentId: customExam.id, score: 7.5 },
  });

  // 6. Excepciones: Alumnos 4 (David Díaz) y 12 (Álvaro Navarro) excluyen Examen 2
  await prisma.exception.create({
    data: {
      studentId: studentsG1[3].id,
      assessmentId: exam2.id,
      isExcluded: true,
      notes: "Adaptación curricular: sustituido por proyecto de cálculo.",
    },
  });

  await prisma.exception.create({
    data: {
      studentId: studentsG1[11].id,
      assessmentId: exam2.id,
      isExcluded: true,
      notes: "Adaptación curricular: realiza examen adaptado.",
    },
  });

  // 7. Faltas e incidencias de prueba
  // David Díaz (Alumno 4) tiene 2 faltas y 1 parte negativo
  await prisma.absence.createMany({
    data: [
      { studentId: studentsG1[3].id, type: "ABSENT", notes: "Falta injustificada", date: new Date("2026-02-10") },
      { studentId: studentsG1[3].id, type: "ABSENT", notes: "Falta injustificada", date: new Date("2026-02-17") },
      { studentId: studentsG1[3].id, type: "NEGATIVE", notes: "No trae el material e interrumpe la clase", date: new Date("2026-02-18") },
    ],
  });

  // Hugo Marín (Alumno 10) tiene 2 retrasos
  await prisma.absence.createMany({
    data: [
      { studentId: studentsG1[9].id, type: "LATE", notes: "Llega 15 min tarde", date: new Date("2026-02-12") },
      { studentId: studentsG1[9].id, type: "LATE", notes: "Llega 10 min tarde", date: new Date("2026-02-20") },
    ],
  });

  // 8. Notas textuales por alumno
  await prisma.studentNote.createMany({
    data: [
      { studentId: studentsG1[0].id, content: "Excelente actitud y participación en los debates matemáticos." },
      { studentId: studentsG1[3].id, content: "Reunión mantenida con los padres el 15/02 para coordinar refuerzo." },
      { studentId: studentsG1[11].id, content: "Progreso muy positivo con la adaptación curricular de fracciones." },
    ],
  });

  // 9. Grupo 2: 2º ESO B
  const group2 = await prisma.group.create({
    data: {
      userId: user.id,
      name: "2º ESO B",
      code: "MAT-2B",
      year: 2026,
      trimesters: {
        create: [
          { name: "Trimestre 1", percentage: 34, order: 1 },
          { name: "Trimestre 2", percentage: 33, order: 2 },
          { name: "Trimestre 3", percentage: 33, order: 3 },
        ],
      },
    },
    include: { trimesters: { orderBy: { order: "asc" } } },
  });

  const studentsG2Names = [
    { name: "Adrián", surname1: "Abad", surname2: "Cruz" },
    { name: "Berta", surname1: "Bellido", surname2: "Pons" },
    { name: "Carlos", surname1: "Casas", surname2: "Vila" },
    { name: "Diana", surname1: "Domingo", surname2: "Soler" },
    { name: "Eric", surname1: "Esteban", surname2: "Giner" },
    { name: "Fátima", surname1: "Ferrer", surname2: "Mora" },
    { name: "Gonzalo", surname1: "Guerrero", surname2: "Calvo" },
    { name: "Helena", surname1: "Hidalgo", surname2: "Rios" },
  ];

  for (let i = 0; i < studentsG2Names.length; i++) {
    const s = studentsG2Names[i];
    await prisma.student.create({
      data: {
        groupId: group2.id,
        listNumber: i + 1,
        name: s.name,
        surname1: s.surname1,
        surname2: s.surname2,
      },
    });
  }

  // Evaluaciones Grupo 2
  await prisma.assessment.create({
    data: {
      trimesterId: group2.trimesters[0].id,
      name: "Examen 1 - Álgebra Básica",
      type: "EXAM",
      percentage: 50,
      maxScore: 10,
      order: 1,
    },
  });

  await prisma.assessment.create({
    data: {
      trimesterId: group2.trimesters[0].id,
      name: "Trabajo en Grupo - Ecuaciones",
      type: "WORK",
      percentage: 50,
      maxScore: 10,
      order: 2,
    },
  });

  // 10. Grupo 3: 4º ESO A - TIC / Programación
  const group3 = await prisma.group.create({
    data: {
      userId: user.id,
      name: "4º ESO A - TIC",
      code: "TIC-4A",
      year: 2026,
      trimesters: {
        create: [
          { name: "Trimestre 1", percentage: 34, order: 1 },
          { name: "Trimestre 2", percentage: 33, order: 2 },
          { name: "Trimestre 3", percentage: 33, order: 3 },
        ],
      },
    },
  });

  // 11. Recordatorios del profesor
  await prisma.reminder.createMany({
    data: [
      {
        userId: user.id,
        groupId: group1.id,
        title: "Revisar libretas de 1º ESO A",
        message: "Comprobar los ejercicios del Tema 2 de números enteros.",
        completed: false,
      },
      {
        userId: user.id,
        groupId: group1.id,
        title: "Reunión de departamento de Matemáticas",
        message: "Llevar la propuesta de exámenes trimestrales.",
        completed: true,
      },
      {
        userId: user.id,
        title: "Subir actas preliminares a Itaca",
        message: "Exportar el archivo XML para validación de secretaría.",
        completed: false,
      },
    ],
  });

  console.log("✅ Datos de prueba sembrados con éxito.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
