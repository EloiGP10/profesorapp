# Plan de Migración — Cuaderno Docente + ITACA

> **Objetivo:** Transformar la app actual en un cuaderno docente completo con integración ITACA.
> **Regla:** Avanzar fase por fase. Verificar que todo sigue funcionando después de cada cambio.
> **Seguridad:** No perder ningún dato existente (alumnos, notas, comentarios, evaluaciones).

---

## AUDITORÍA DEL ESTADO ACTUAL

### Modelo de datos actual (Prisma schema)

```
User
├── id, email, name, passwordHash
├── has many: Group, Reminder

Group
├── id, name, code?, year, penaltyAbsence/Late/Negative
├── belongs to: User
├── has many: Student, Trimester, Reminder

Student
├── id, groupId, listNumber, name, surname1, surname2?, nia?, email?, phone?
├── belongs to: Group
├── has many: Grade, Absence, Exception, RubricScore, StudentNote, Assessment (custom)

Trimester
├── id, groupId, name, percentage, order
├── belongs to: Group
├── has many: Assessment, Absence

Assessment
├── id, trimesterId, studentId? (custom), name, type, percentage, maxScore, isExtra, order
├── belongs to: Trimester, optionally Student
├── has many: Grade, Exception
├── has one: Rubric

Grade
├── id, studentId, assessmentId, score?
├── belongs to: Student, Assessment
├── unique: [studentId, assessmentId]

Rubric → RubricRow → RubricScore
Exception (student ↔ assessment exclusion)
Absence (student, date, type, trimester?)
StudentNote (student, content)
Reminder (user, group?, title, message?, dueDate?, completed)
```

### Datos que existen en producción

| Tipo de dato | Cómo se almacena | Volumen estimado |
|---|---|---|
| Alumnos | `Student` (name, surname1, surname2, nia) | 20-200 por grupo |
| Grupos | `Group` (name, year) | 1-10 por usuario |
| Trimestres | `Trimester` (name, percentage) | 3 por grupo (34/33/33) |
| Evaluaciones | `Assessment` (name, type, percentage, maxScore) | 3-15 por trimestre |
| Notas | `Grade` (score numérico) | 1 por alumno × evaluación |
| Rúbricas | `Rubric` → `RubricRow` → `RubricScore` | Opcional por evaluación |
| Exclusiones | `Exception` (isExcluded, notes) | Ocasional |
| Faltas | `Absence` (date, type) | Variable |
| Notas texto | `StudentNote` (content) | Opcional |
| Recordatorios | `Reminder` | Opcional |

### API routes actuales (19 archivos, 32 endpoints)

| Grupo | Endpoints | Funcionalidad |
|---|---|---|
| Auth | POST login/register/logout, GET/PUT profile/me | Autenticación JWT |
| Groups | GET/POST/PUT/DELETE, POST clone | CRUD grupos + clonar |
| Students | GET/POST/PUT/DELETE | CRUD alumnos |
| Assessments | GET/POST/PUT/DELETE, POST duplicate | CRUD evaluaciones + duplicar |
| Grades | POST (upsert), PUT | Calificaciones |
| Rubrics | GET/POST/PUT | Rúbricas |
| Absences | GET/POST/DELETE | Faltas |
| Exceptions | GET/POST/DELETE | Exclusiones |
| Notes | GET/POST/DELETE | Notas de texto |
| Trimesters | PUT (batch) | Actualizar trimestres |
| Export | POST | Excel, CSV iTaCa, XML iTaCa |
| Import | POST | Importar alumnos desde mapeo |
| Reminders | GET/POST/PUT/DELETE | Recordatorios |

### UI actual (14 componentes + 17 primitivos UI)

| Componente | Función |
|---|---|
| `grade-table.tsx` | Tabla principal de notas (alumnos × evaluaciones) |
| `student-dialog.tsx` | Crear/editar alumno |
| `assessment-dialog.tsx` | Crear/editar evaluación |
| `rubric-dialog.tsx` | Crear/editar estructura de rúbrica |
| `rubric-eval-dialog.tsx` | Evaluar alumno con rúbrica |
| `exception-dialog.tsx` | Exclusiones + tareas adaptadas |
| `absence-dialog.tsx` | Gestionar faltas |
| `notes-dialog.tsx` | Notas de texto del alumno |
| `import-dialog.tsx` | Wizard importación de alumnos |
| `export-dialog.tsx` | Exportar a Excel/CSV/XML |
| `group-settings-dialog.tsx` | Configuración del grupo |
| `group-stats.tsx` | Estadísticas con gráficas |
| `profile-dialog.tsx` | Perfil de usuario |
| `reminders-dialog.tsx` | Recordatorios |

### Exportación ITACA actual

**Formato soportado:**
1. **Excel** (.xlsx) — funciona correctamente
2. **CSV iTaCa** — separado por punto y coma, con BOM UTF-8
3. **XML iTaCa** — ⚠️ INVENTADO (no basado en especificación real)

**Problemas del XML actual:**
- Tags inventados (`<centro>`, `<alumno>`, `<trimestre>`, `<evaluacion>`)
- No respeta ningún formato oficial de ITACA
- No tiene namespaces
- No tiene validación
- Genera un XML que probablemente ITACA rechazaría

**Lo que SÍ funciona:**
- Cálculo de notas medias por trimestre
- Penalización por faltas
- Nota final ponderada
- Exportación Excel para revisión humana

---

## MODELO DE DATOS OBJETIVO

### Jerarquía académica nueva

```
User
└── AcademicYear (curso académico: 2025-2026)
    └── Education (enseñanza: ESO, Bachillerato, FP)
        └── Course (curso: 1º, 2º, 3º...)
            └── Group (grupo: A, B, C)
                ├── Student (alumno)
                │   └── Enrollment (matrícula: alumno ↔ grupo ↔ año)
                └── TeachingContent (materia/módulo)
                    └── StudentContentEnrollment (alumno ↔ contenido)
```

### Evaluaciones y notas

```
Evaluation (período de evaluación: 1ª Ev., 2ª Ev., Final)
├── tiene fechas (startDate, endDate)
├── tiene tipo (ORDINARY, EXTRAORDINARY, FINAL...)
└── tiene código ITACA (itacaId)

Activity (actividad dentro de una evaluación)
├── tiene peso (weight)
├── tiene nota máxima (maxScore)
└── pertenece a un TeachingContent

Grade (calificación)
├── student + content + evaluation
├── numericValue (nota numérica)
├── qualitativeValue (valor cualitativo)
├── rawValue (valor sin procesar)
├── status (NORMAL, EXEMPT, ADAPTED...)
├── source (MANUAL, CALCULATED, RUBRIC)
└── observationId (observación asociada)

GradeHistory (historial de cambios)
├── gradeId, previousValue, newValue
├── changedBy, changedAt

EvaluationObservation (observación general de evaluación)
├── studentId, evaluationId, text, language

GradeObservation (observación por materia)
├── studentId, contentId, evaluationId, text
```

### Tablas ITACA

```
ItacaMapping (mapeo interno ↔ ITACA)
├── entityType (STUDENT, GROUP, CONTENT, EVALUATION...)
├── internalId (nuestro ID)
├── itacaId (ID de ITACA)
├── itacaCode (código de ITACA)
└── metadata (JSON con datos adicionales)

ItacaExport (historial de exportaciones)
├── academicYearId, evaluationId
├── fileName, checksum, status
├── validationResult (JSON)
└── createdAt, createdBy
```

### Relación con el modelo actual

| Modelo actual | Modelo nuevo | Acción |
|---|---|---|
| `Group` | `Group` + `AcademicYear` + `Education` + `Course` | Añadir foreign keys |
| `Student` | `Student` + `Enrollment` | Renombrar campos + crear Enrollment |
| `Trimester` | `Evaluation` | Renombrar + ampliar campos |
| `Assessment` | `Activity` | Renombrar + vincular a TeachingContent |
| `Grade` | `Grade` | Ampliar con contentId, evaluationId, status... |
| `Rubric` | `Rubric` | Mantener + renombrar RubricRow → RubricCriterion |
| `Exception` | Se integra en `Grade.status` | Migrar datos |
| `Absence` | `Absence` | Mantener + vincular mejor |
| `StudentNote` | `EvaluationObservation` / `GradeObservation` | Separar por tipo |
| — | `TeachingContent` | Crear nuevo |
| — | `StudentContentEnrollment` | Crear nuevo |
| — | `ActivityGrade` | Crear nuevo |
| — | `GradeHistory` | Crear nuevo |
| — | `ItacaMapping` | Crear nuevo |
| — | `ItacaExport` | Crear nuevo |

---

## ESTRATEGIA DE MIGRACIÓN SEGURA

### Principios

1. **Nunca borrar datos:** Las migraciones añaden columnas/tablas, no eliminan
2. **Backwards compatible:** La app actual debe seguir funcionando durante la migración
3. **Migración de datos:** Scripts separados para mover datos al nuevo formato
4. **Verificación:** Checks post-migración para confirmar integridad
5. **Rollback:** Cada fase debe poder revertirse si algo falla

### Patrón de migración para cada fase

```
1. Crear nuevas tablas/columnas (ADDITIVE)
2. Ejecutar migración de datos (MOVE)
3. Actualizar API para usar nuevo modelo (ADAPT)
4. Verificar que la API anterior sigue funcionando (VERIFY)
5. Actualizar UI para usar nueva API (UPDATE)
6. Verificar que la UI sigue funcionando (VERIFY)
7. Limpiar modelo antiguo si es seguro (CLEANUP)
```

---

## PLAN POR FASES

---

### FASE 0 — Preparación y Schema Foundation

**Objetivo:** Crear la base del modelo de datos sin romper nada.

**Archivos que toca:**
- `prisma/schema.prisma` — añadir tablas nuevas
- `prisma/migrations/` — crear migración
- `src/lib/prisma.ts` — sin cambios

**Modelos nuevos a crear:**
- `AcademicYear` (id, itacaId?, name, startDate?, endDate?, status)
- `Education` (id, itacaId?, code?, name, type: ESO|BACHILLERATO|FP|OTHER)
- `Course` (id, itacaId?, educationId, code?, name)
- `ItacaMapping` (id, entityType, internalId, itacaId, itacaCode?, metadata?)

**Modificaciones a modelos existentes:**
- `Group`: añadir `academicYearId?`, `educationId?`, `courseId?`
- `Group`: mantener `year` (Int) para compatibilidad temporal

**Migración de datos:**
```sql
-- Para cada Group existente:
-- 1. Crear AcademicYear basado en group.year
-- 2. Crear Education "ESO" por defecto
-- 3. Crear Course "1º" por defecto
-- 4. Crear ItacaMapping vacío (pendiente de ITACA)
-- 5. Asignar group → academicYear, education, course
```

**Cómo evitar perder datos:**
- Las nuevas foreign keys son `?` (opcionales)
- Los datos existentes se migran automáticamente
- Los campos antiguos (`group.year`) se mantienen

**Tests/checks:**
- [ ] `prisma migrate dev` ejecuta sin errores
- [ ] Todos los grupos existentes tienen academicYear, education, course asignados
- [ ] La app actual sigue funcionando (CRUD grupos, alumnos, notas)
- [ ] No hay datos nulos en campos obligatorios nuevos

**Criterio de terminación:**
- Las 4 tablas nuevas existen en la BD
- Todos los grupos existentes están enlazados a academicYear/education/course
- La app funciona igual que antes

**Dependencias:** Ninguna (es la primera fase)

---

### FASE 1 — Modelo de Alumnos

**Objetivo:** Identidad de alumnos compatible con ITACA + sistema de matrícula.

**Archivos que toca:**
- `prisma/schema.prisma` — modificar Student, crear Enrollment
- `src/app/api/students/route.ts` — actualizar campos
- `src/components/student-dialog.tsx` — actualizar formulario
- `src/components/grade-table.tsx` — actualizar referencia a campos

**Modelos nuevos:**
- `Enrollment` (id, studentId, academicYearId, educationId?, courseId?, groupId, startDate?, endDate?, status, itacaId?)

**Modificaciones a Student:**
- `name` → mantener como `displayName` (calculado)
- Añadir `firstName` (String) — opcional al principio
- Añadir `lastName1` (String) — opcional al principio
- Añadir `lastName2` (String?) — opcional
- Añadir `itacaId` (String?) — para mapeo ITACA
- Añadir `status` (String, default "ACTIVE")
- Añadir `dateOfBirth` (DateTime?)

**Migración de datos:**
```sql
-- Para cada Student existente:
-- 1. firstName = student.name
-- 2. lastName1 = student.surname1
-- 3. lastName2 = student.surname2
-- 4. itacaId = null (pendiente de ITACA)
-- 5. status = "ACTIVE"
-- 6. Crear Enrollment vinculando student → group → academicYear
```

**Cómo evitar perder datos:**
- Los campos `name`, `surname1`, `surname2` se mantienen (no se borran todavía)
- Los nuevos campos se rellenan a partir de los existentes
- El Enrollment se crea automáticamente

**Tests/checks:**
- [ ] `prisma migrate dev` ejecuta sin errores
- [ ] Todos los alumnos tienen firstName, lastName1 calculados
- [ ] Todos los alumnos tienen Enrollment creado
- [ ] La app actual sigue funcionando (CRUD alumnos, notas)
- [ ] El formulario de alumno muestra los campos correctamente

**Criterio de terminación:**
- Student tiene identidad dual (interna + ITACA preparada)
- Enrollment existe para todos los alumnos
- La app funciona igual que antes

**Dependencias:** Fase 0

---

### FASE 2 — Contenidos y Evaluaciones

**Objetivo:** Separar materias/módulos de evaluaciones. Crear el modelo TeachingContent.

**Archivos que toca:**
- `prisma/schema.prisma` — crear TeachingContent, StudentContentEnrollment, Evaluation, Activity
- `src/app/api/assessments/route.ts` — adaptar para usar Activity + Evaluation
- `src/app/api/trimesters/route.ts` — adaptar para usar Evaluation
- `src/components/assessment-dialog.tsx` — adaptar
- `src/components/grade-table.tsx` — adaptar para mostrar contenidos

**Modelos nuevos:**
- `TeachingContent` (id, itacaId?, code?, name, educationId, courseId, type: SUBJECT|MODULE|OTHER)
- `StudentContentEnrollment` (id, studentId, contentId, academicYearId, status, itacaId?)
- `Evaluation` (id, itacaId?, code?, name, type, startDate?, endDate?, academicYearId, educationId?)
- `Activity` (id, name, description?, date?, contentId?, evaluationId, weight, maxScore, type, order)

**Modificaciones:**
- `Assessment` existente → migrar a `Activity` (asignar evaluationId y contentId)
- `Trimester` existente → migrar a `Evaluation` (o mantener como sinónimo temporal)

**Migración de datos:**
```sql
-- Para cada Trimester existente:
-- 1. Crear Evaluation con el mismo nombre y porcentaje
-- 2. evaluation.startDate/endDate = null (desconocido)

-- Para cada Assessment existente:
-- 1. Crear Activity con el mismo nombre, peso, nota máxima
-- 2. activity.contentId = null (pendiente de asignar materia)
-- 3. activity.evaluationId = evaluation creada desde el trimestre

-- TeachingContent: crear vacío (pendiente de importación ITACA)
-- StudentContentEnrollment: crear vacío (pendiente)
```

**Cómo evitar perder datos:**
- `Assessment` y `Trimester` se mantienen como tablas
- Las nuevas tablas se crean con foreign keys a las existentes
- La app actual sigue usando Assessment/Trimester

**Tests/checks:**
- [ ] Las 4 tablas nuevas existen
- [ ] Cada Trimester tiene su Evaluation equivalente
- [ ] Cada Assessment tiene su Activity equivalente
- [ ] La app actual sigue funcionando
- [ ] Las evaluaciones se muestran correctamente

**Criterio de terminación:**
- TeachingContent existe (aunque vacío)
- Evaluation y Activity tienen datos migrados
- La app funciona igual que antes

**Dependencias:** Fases 0, 1

---

### FASE 3 — Capa ITACA Mapping

**Objetivo:** Mapeo explícito entre IDs internos y IDs de ITACA.

**Archivos que toca:**
- `src/lib/itaca-mapping.ts` — servicio de mapeo (nuevo)
- `src/app/api/itaca/mapping/route.ts` — API de mapeo (nuevo)
- `src/app/api/students/route.ts` — incluir mapping en respuestas
- `src/app/api/groups/route.ts` — incluir mapping en respuestas

**Componentes nuevos:**
- `ItacaMappingService` con funciones:
  - `map(entityType, internalId, itacaId, itacaCode?)`
  - `getItacaId(entityType, internalId) → string | null`
  - `getInternalId(entityType, itacaId) → string | null`
  - `validateIdentity(entityType, internalId) → { valid, missing }`
  - `getAllMappings(entityType) → Mapping[]`

**API nueva:**
- `GET /api/itaca/mapping?entityType=...` — listar mappings
- `POST /api/itaca/mapping` — crear/actualizar mapping
- `DELETE /api/itaca/mapping?id=...` — eliminar mapping
- `GET /api/itaca/validate?groupId=...` — validar identidad de todos los alumnos del grupo

**Migración de datos:**
- No hay migración de datos (las tablas ya existen desde Fase 0)
- Se crean mappings vacíos para los alumnos que tengan NIA

**Tests/checks:**
- [ ] El servicio de mapeo funciona correctamente
- [ ] Se puede consultar: "¿Este alumno tiene itacaId?"
- [ ] La validación detecta alumnos sin itacaId
- [ ] La app actual sigue funcionando

**Criterio de terminación:**
- `ItacaMappingService` funciona
- Se puede validar la identidad de alumnos
- La app funciona igual que antes

**Dependencias:** Fase 0

---

### FASE 4 — Notas Enriquecidas

**Objetivo:** Notas con estado, historial y observaciones por materia.

**Archivos que toca:**
- `prisma/schema.prisma` — ampliar Grade, crear historial y observaciones
- `src/app/api/grades/route.ts` — ampliar con nuevos campos
- `src/lib/grade-calculation.ts` — servicio de cálculo (nuevo)
- `src/components/grade-table.tsx` — mostrar estado, historial

**Modelos nuevos:**
- `GradeHistory` (id, gradeId, previousValue?, newValue, previousStatus?, newStatus, changedBy?, changedAt)
- `GradeObservation` (id, studentId, contentId?, evaluationId?, text, authorId?, createdAt)
- `EvaluationObservation` (id, studentId, evaluationId, text, language?, authorId?, createdAt)

**Modificaciones a Grade:**
- `score` → mantener como legacy
- Añadir `numericValue` (Float?) — nota numérica
- Añadir `qualitativeValue` (String?) — valor cualitativo
- Añadir `rawValue` (Float?) — valor sin procesar
- Añadir `status` (String, default "NORMAL") — NORMAL|EXEMPT|ADAPTED|PASSED_PREVIOUSLY|OTHER
- Añadir `source` (String, default "MANUAL") — MANUAL|CALCULATED|RUBRIC|IMPORTED
- Añadir `contentId` (String?) — materia asociada
- Añadir `evaluationId` (String?) — evaluación asociada
- Añadir `observationId` (String?)

**Migración de datos:**
```sql
-- Para cada Grade existente:
-- 1. numericValue = grade.score
-- 2. rawValue = grade.score
-- 3. status = "NORMAL"
-- 4. source = "MANUAL"
-- 5. evaluationId = evaluation asociada al assessment
-- 6. contentId = null (pendiente de asignar materia)

-- Para cada StudentNote existente:
-- 1. Crear EvaluationObservation o GradeObservation
-- 2. text = note.content
-- 3. evaluationId = null (no se sabe)
```

**Tests/checks:**
- [ ] Las tablas nuevas existen
- [ ] Todas las notas existentes tienen numericValue = score
- [ ] El historial se registra al cambiar una nota
- [ ] Las observaciones se muestran correctamente
- [ ] La app actual sigue funcionando

**Criterio de terminación:**
- Grade tiene estado, fuente e historial
- Las observaciones funcionan por materia y por evaluación
- La app funciona igual que antes

**Dependencias:** Fases 0, 2

---

### FASE 5 — Motor de Cálculo

**Objetivo:** Servicio separado para calcular notas con distintos métodos.

**Archivos que toca:**
- `src/lib/grade-calculation.ts` — servicio de cálculo (nuevo)
- `src/app/api/grades/calculate/route.ts` — endpoint de cálculo (nuevo)
- `src/components/grade-table.tsx` — usar servicio de cálculo

**Componentes nuevos:**
- `GradeCalculationService` con métodos:
  - `calculateSimpleAverage(grades[]) → number`
  - `calculateWeightedAverage(grades[], weights[]) → number`
  - `calculateTrimesterAverage(student, trimester) → number`
  - `calculateFinalAverage(student, trimesters, penalties) → number`
  - `calculateWithPenalties(avg, absences, penalties) → number`
  - `calculateRubricScore(rubricScores[]) → number`
  - `calculateActivityGrade(activities[]) → Grade`

**Tests/checks:**
- [ ] Media simple funciona correctamente
- [ ] Media ponderada funciona correctamente
- [ ] Penalización por faltas funciona
- [ ] Rúbricas calculan correctamente
- [ ] La app actual sigue funcionando

**Criterio de terminación:**
- El servicio de cálculo produce los mismos resultados que el cálculo actual
- Se puede calcular nota final con distintos métodos
- La app funciona igual que antes

**Dependencias:** Fase 4

---

### FASE 6 — Importación ITACA

**Objetivo:** Subir XML de ITACA y poblar la app.

**Archivos que toca:**
- `src/lib/itaca/importer.ts` — importer genérico (nuevo)
- `src/lib/itaca/parser.ts` — parser XML seguro (nuevo)
- `src/lib/itaca/validator.ts` — validador de importación (nuevo)
- `src/app/api/itaca/import/route.ts` — API de importación (nuevo)
- `src/components/itaca-import-dialog.tsx` — wizard de importación (nuevo)

**Componentes nuevos:**
- `ItacaImporter` con:
  - `parseXml(xmlString) → ParsedData`
  - `validateStructure(data) → ValidationResult`
  - `mapToInternalModel(data) → MappedData`
  - `importData(mappedData) → ImportResult`
  - `generateSummary(result) → ImportSummary`

- `ItacaXmlParser` con:
  - Protección XXE
  - Límite de tamaño
  - Validación de XML bienformado
  - Detección de entidades

**API nueva:**
- `POST /api/itaca/import` — importar XML
- `GET /api/itaca/import/preview` — previsualizar importación

**Tests/checks:**
- [ ] El parser XML funciona con XML válido
- [ ] El parser rechaza XML malformado
- [ ] La importación crea/actualiza registros
- [ ] El resumen muestra correctamente qué se importó
- [ ] No se pierden datos existentes

**Criterio de terminación:**
- Se puede importar un XML de ITACA
- Se genera un resumen de la importación
- Los identificadores ITACA se guardan correctamente

**Dependencias:** Fases 0, 1, 2, 3

---

### FASE 7 — Exportación ITACA

**Objetivo:** Validar datos y generar modelo de exportación preparado para XML.

**Archivos que toca:**
- `src/lib/itaca/validation-service.ts` — validador completo (nuevo)
- `src/lib/itaca/export-model.ts` — modelo intermedio (nuevo)
- `src/lib/itaca/exporter.ts` — orquestador de exportación (nuevo)
- `src/lib/itaca/snapshot.ts` — snapshots de exportación (nuevo)
- `src/app/api/itaca/export/route.ts` — API de exportación (nuevo)
- `src/components/itaca-export-dialog.tsx` — wizard de exportación (nuevo)

**Componentes nuevos:**
- `ItacaValidationService` con validaciones:
  - Identidad: todos los alumnos tienen itacaId
  - Relaciones: alumno → matrícula → grupo → curso → enseñanza
  - Notas: tipo válido, rango válido, estado válido
  - Observaciones: longitud ≤ 4000
  - Bachillerato: modalidad/especialidad
  - FP: módulo, contenido, estado, convocatoria

- `ItacaExportModel` (modelo intermedio):
  - academicYear, education, course, group
  - students, enrollments, contents, evaluations
  - grades, observations, specialStatuses

- `ItacaExportSnapshot`:
  - Captura lógica del estado antes de exportar
  - Permite saber qué datos generaron cada exportación

**API nueva:**
- `POST /api/itaca/validate` — validar antes de exportar
- `POST /api/itaca/export` — generar exportación
- `GET /api/itaca/export/history` — historial de exportaciones

**Tests/checks:**
- [ ] La validación detecta alumnos sin itacaId
- [ ] La validación detecta notas fuera de rango
- [ ] La validación detecta observaciones demasiado largas
- [ ] El modelo de exportación se genera correctamente
- [ ] El snapshot se guarda correctamente

**Criterio de terminación:**
- La validación completa funciona
- El modelo de exportación se genera
- El historial de exportaciones se registra
- NO se genera XML todavía (pendiente de especificación real)

**Dependencias:** Fases 3, 4, 5

---

### FASE 8 — UI Cuaderno

**Objetivo:** Interfaz tipo cuaderno docente rápida y usable.

**Archivos que toca:**
- `src/components/gradebook.tsx` — nuevo componente cuaderno
- `src/components/gradebook-cell.tsx` — celda editable
- `src/components/gradebook-toolbar.tsx` — barra de herramientas
- `src/app/group/[id]/page.tsx` — integrar nuevo cuaderno
- `src/components/grade-table.tsx` — mantener como fallback

**Funcionalidades:**
- Vista tipo tabla: alumnos × actividades
- Navegación con teclado (Tab, Enter, flechas)
- Pegar varias celdas
- Plantillas de comentarios
- Autosave con debounce
- Vista por materia
- Vista por evaluación
- Undo/redo básico

**Tests/checks:**
- [ ] La tabla se carga correctamente
- [ ] Se puede editar una celda
- [ ] El autosave funciona
- [ ] La navegación con teclado funciona
- [ ] Se puede copiar/pegar
- [ ] La app anterior sigue funcionando

**Criterio de terminación:**
- El cuaderno muestra alumnos × actividades
- Se puede editar notas directamente
- Los cambios se guardan automáticamente
- La vista anterior sigue disponible

**Dependencias:** Fase 4, 5

---

### FASE 9 — UI Import/Export ITACA

**Objetivo:** Wizards completos de importación y exportación ITACA.

**Archivos que toca:**
- `src/components/itaca-import-dialog.tsx` — wizard importación
- `src/components/itaca-export-dialog.tsx` — wizard exportación
- `src/app/settings/itaca/page.tsx` — configuración ITACA
- `src/components/itaca-history.tsx` — historial de exportaciones

**Funcionalidades:**
- Configuración ITACA (sección en ajustes)
- Wizard importación: subir → validar → mapear → importar
- Wizard exportación: validar → previsualizar → generar → descargar
- Instrucciones post-descarga ("Abre ITACA, importa...")
- Historial de exportaciones

**Tests/checks:**
- [ ] El wizard de importación funciona de principio a fin
- [ ] El wizard de exportación funciona de principio a fin
- [ ] Se muestran errores y advertencias correctamente
- [ ] El historial muestra exportaciones anteriores

**Criterio de terminación:**
- Flujo ITACA completo en UI
- Importación funciona
- Exportación funciona (con XML placeholder)
- Historial se registra

**Dependencias:** Fases 6, 7

---

### FASE 10 — Tests y Validación Final

**Objetivo:** Cobertura mínima de calidad para todo el sistema.

**Archivos que toca:**
- `vitest.config.ts` — configuración de tests
- `tests/unit/` — tests unitarios
- `tests/integration/` — tests de integración
- `tests/fixtures/itaca/` — fixtures de ITACA
- `package.json` — añadir scripts de test

**Tests a crear:**
- Tests de migración: verificar que todos los datos existentes sobreviven
- Tests de identidad: alumno con/sin NIA, duplicados
- Tests de notas: 8, 8.5, 0, 10, valor vacío, estados especiales
- Tests de observaciones: vacía, 1 carácter, 4000 caracteres, 4001 caracteres
- Tests de evaluaciones: dentro/fuera de fecha, sin ID
- Tests de Bachillerato: modalidad presente/ausente
- Tests de FP: módulo, contenido, estado, convocatoria
- Tests de importación/exportación: cuando tengamos formato real

**Criterio de terminación:**
- Todos los tests pasan
- Cobertura mínima de 80% en servicios críticos
- Los fixtures de ITACA están documentados

**Dependencias:** Todas las fases anteriores

---

## RESUMEN DE DEPENDENCIAS

```
Fase 0 (Schema Foundation)
├── Fase 1 (Modelo Alumnos)
│   └── Fase 2 (Contenidos/Evaluaciones)
│       ├── Fase 4 (Notas Enriquecidas)
│       │   ├── Fase 5 (Motor de Cálculo)
│       │   │   └── Fase 7 (Export ITACA)
│       │   │       └── Fase 9 (UI Import/Export)
│       │   └── Fase 8 (UI Cuaderno)
│       └── Fase 6 (Import ITACA)
│           └── Fase 9 (UI Import/Export)
├── Fase 3 (ITACA Mapping)
│   ├── Fase 6 (Import ITACA)
│   └── Fase 7 (Export ITACA)
└── Fase 10 (Tests) — después de todas
```

## TIEMPOS ESTIMADOS

| Fase | Tiempo aprox | Prioridad |
|---|---|---|
| 0 — Schema Foundation | 2-3h | ALTA |
| 1 — Modelo Alumnos | 1-2h | ALTA |
| 2 — Contenidos/Evaluaciones | 2-3h | ALTA |
| 3 — ITACA Mapping | 1-2h | MEDIA |
| 4 — Notas Enriquecidas | 2-3h | ALTA |
| 5 — Motor de Cálculo | 2-3h | MEDIA |
| 6 — Import ITACA | 3-4h | BAJA (sin XML real) |
| 7 — Export ITACA | 3-4h | BAJA (sin XML real) |
| 8 — UI Cuaderno | 4-6h | ALTA |
| 9 — UI Import/Export | 3-4h | BAJA (sin XML real) |
| 10 — Tests | 3-4h | MEDIA |
| **TOTAL** | **~26-36h** | |

## RECOMENDACIÓN

**Empezar por Fases 0-4** (~8-12h). Son las bases:
- Schema con jerarquía académica
- Alumnos con identidad ITACA
- Contenidos y evaluaciones
- Mapeo ITACA
- Notas enriquecidas con historial

Con esas fases completadas, la app sigue funcionando igual pero con un modelo preparado para ITACA. Las fases de importación/exportación se pueden hacer después cuando tengamos el XML real.

**NO implementar todavía:**
- `ItacaXmlSerializer` (sin especificación real)
- Tags XML inventados
- Validaciones específicas de ITACA (sin XSD)
