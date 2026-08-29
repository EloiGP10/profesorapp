
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  passwordHash: 'passwordHash',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GroupScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  year: 'year',
  penaltyAbsence: 'penaltyAbsence',
  penaltyLate: 'penaltyLate',
  penaltyNegative: 'penaltyNegative',
  userId: 'userId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  academicYearId: 'academicYearId',
  educationId: 'educationId',
  courseId: 'courseId'
};

exports.Prisma.StudentScalarFieldEnum = {
  id: 'id',
  groupId: 'groupId',
  listNumber: 'listNumber',
  name: 'name',
  surname1: 'surname1',
  surname2: 'surname2',
  nia: 'nia',
  email: 'email',
  phone: 'phone',
  firstName: 'firstName',
  lastName1: 'lastName1',
  lastName2: 'lastName2',
  itacaId: 'itacaId',
  status: 'status',
  dateOfBirth: 'dateOfBirth',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TrimesterScalarFieldEnum = {
  id: 'id',
  groupId: 'groupId',
  name: 'name',
  percentage: 'percentage',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AssessmentScalarFieldEnum = {
  id: 'id',
  trimesterId: 'trimesterId',
  studentId: 'studentId',
  name: 'name',
  type: 'type',
  percentage: 'percentage',
  maxScore: 'maxScore',
  isExtra: 'isExtra',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GradeScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  assessmentId: 'assessmentId',
  score: 'score',
  activityId: 'activityId',
  contentId: 'contentId',
  evaluationId: 'evaluationId',
  numericValue: 'numericValue',
  qualitativeValue: 'qualitativeValue',
  rawValue: 'rawValue',
  status: 'status',
  source: 'source',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RubricScalarFieldEnum = {
  id: 'id',
  assessmentId: 'assessmentId',
  activityId: 'activityId'
};

exports.Prisma.RubricRowScalarFieldEnum = {
  id: 'id',
  rubricId: 'rubricId',
  title: 'title',
  percentage: 'percentage',
  order: 'order',
  poorText: 'poorText',
  fairText: 'fairText',
  goodText: 'goodText',
  excellentText: 'excellentText'
};

exports.Prisma.RubricScoreScalarFieldEnum = {
  id: 'id',
  rubricRowId: 'rubricRowId',
  studentId: 'studentId',
  level: 'level'
};

exports.Prisma.ExceptionScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  assessmentId: 'assessmentId',
  isExcluded: 'isExcluded',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.AbsenceScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  trimesterId: 'trimesterId',
  date: 'date',
  type: 'type',
  notes: 'notes',
  justified: 'justified',
  penalty: 'penalty',
  evaluationId: 'evaluationId',
  contentId: 'contentId',
  source: 'source',
  itacaId: 'itacaId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentNoteScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  content: 'content',
  category: 'category',
  isImportant: 'isImportant',
  isPrivate: 'isPrivate',
  authorId: 'authorId',
  evaluationId: 'evaluationId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReminderScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  groupId: 'groupId',
  studentId: 'studentId',
  title: 'title',
  message: 'message',
  category: 'category',
  priority: 'priority',
  dueDate: 'dueDate',
  completed: 'completed',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicYearScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EducationScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  code: 'code',
  name: 'name',
  type: 'type',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CourseScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  educationId: 'educationId',
  code: 'code',
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItacaMappingScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  internalId: 'internalId',
  itacaId: 'itacaId',
  itacaCode: 'itacaCode',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EnrollmentScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  academicYearId: 'academicYearId',
  educationId: 'educationId',
  courseId: 'courseId',
  groupId: 'groupId',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  itacaId: 'itacaId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeachingContentScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  code: 'code',
  name: 'name',
  description: 'description',
  subjectArea: 'subjectArea',
  educationId: 'educationId',
  courseId: 'courseId',
  type: 'type',
  driveLink: 'driveLink',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StudentContentEnrollmentScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  contentId: 'contentId',
  academicYearId: 'academicYearId',
  status: 'status',
  itacaId: 'itacaId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EvaluationScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  code: 'code',
  name: 'name',
  type: 'type',
  startDate: 'startDate',
  endDate: 'endDate',
  academicYearId: 'academicYearId',
  educationId: 'educationId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ActivityScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  date: 'date',
  contentId: 'contentId',
  evaluationId: 'evaluationId',
  weight: 'weight',
  maxScore: 'maxScore',
  type: 'type',
  isExtra: 'isExtra',
  order: 'order',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.GradeObservationScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  contentId: 'contentId',
  evaluationId: 'evaluationId',
  gradeId: 'gradeId',
  text: 'text',
  authorId: 'authorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EvaluationObservationScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  evaluationId: 'evaluationId',
  text: 'text',
  language: 'language',
  authorId: 'authorId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QualificationScalarFieldEnum = {
  id: 'id',
  itacaId: 'itacaId',
  studentId: 'studentId',
  contentId: 'contentId',
  evaluationId: 'evaluationId',
  academicYearId: 'academicYearId',
  numericValue: 'numericValue',
  qualitativeValue: 'qualitativeValue',
  rawValue: 'rawValue',
  status: 'status',
  source: 'source',
  isRecovery: 'isRecovery',
  recoveryDate: 'recoveryDate',
  finalDate: 'finalDate',
  itacaSyncDate: 'itacaSyncDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TargetGradeScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  contentId: 'contentId',
  academicYearId: 'academicYearId',
  targetScore: 'targetScore',
  targetQualitative: 'targetQualitative',
  itacaId: 'itacaId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppAccessScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  groupId: 'groupId',
  role: 'role',
  permissions: 'permissions',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItacaConfigScalarFieldEnum = {
  id: 'id',
  academicYearId: 'academicYearId',
  itacaUrl: 'itacaUrl',
  apiKey: 'apiKey',
  schoolCode: 'schoolCode',
  schoolName: 'schoolName',
  syncEnabled: 'syncEnabled',
  autoSync: 'autoSync',
  syncInterval: 'syncInterval',
  lastSyncAt: 'lastSyncAt',
  lastSyncStatus: 'lastSyncStatus',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItacaPendingSyncScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  entityType: 'entityType',
  entityId: 'entityId',
  operation: 'operation',
  status: 'status',
  payload: 'payload',
  response: 'response',
  errorMessage: 'errorMessage',
  retryCount: 'retryCount',
  maxRetries: 'maxRetries',
  nextRetryAt: 'nextRetryAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItacaImportLogScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  importType: 'importType',
  status: 'status',
  recordsTotal: 'recordsTotal',
  recordsCreated: 'recordsCreated',
  recordsUpdated: 'recordsUpdated',
  recordsFailed: 'recordsFailed',
  conflicts: 'conflicts',
  errors: 'errors',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.ItacaExportLogScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  exportType: 'exportType',
  status: 'status',
  recordsTotal: 'recordsTotal',
  recordsExported: 'recordsExported',
  recordsFailed: 'recordsFailed',
  errors: 'errors',
  xmlContent: 'xmlContent',
  startedAt: 'startedAt',
  completedAt: 'completedAt'
};

exports.Prisma.ItacaConflictResolutionScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  entityType: 'entityType',
  entityId: 'entityId',
  localData: 'localData',
  remoteData: 'remoteData',
  resolution: 'resolution',
  mergedData: 'mergedData',
  resolvedAt: 'resolvedAt',
  resolvedBy: 'resolvedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ItacaAuditLogScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  userId: 'userId',
  details: 'details',
  ipAddress: 'ipAddress',
  createdAt: 'createdAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  groupId: 'groupId',
  action: 'action',
  entityType: 'entityType',
  entityId: 'entityId',
  oldData: 'oldData',
  newData: 'newData',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.UserAppAccessScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SchoolDataScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  address: 'address',
  city: 'city',
  province: 'province',
  postalCode: 'postalCode',
  phone: 'phone',
  email: 'email',
  website: 'website',
  director: 'director',
  directorDni: 'directorDni',
  communityCode: 'communityCode',
  educationType: 'educationType',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicYearDataScalarFieldEnum = {
  id: 'id',
  schoolDataId: 'schoolDataId',
  academicYearId: 'academicYearId',
  calendar: 'calendar',
  schedule: 'schedule',
  rules: 'rules',
  keyDates: 'keyDates',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ACImprentaScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  academicYearId: 'academicYearId',
  documentType: 'documentType',
  documentNumber: 'documentNumber',
  fullName: 'fullName',
  birthDate: 'birthDate',
  gender: 'gender',
  nationality: 'nationality',
  address: 'address',
  city: 'city',
  postalCode: 'postalCode',
  phone: 'phone',
  email: 'email',
  parentName: 'parentName',
  parentPhone: 'parentPhone',
  parentEmail: 'parentEmail',
  config: 'config',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ExigibleScalarFieldEnum = {
  id: 'id',
  studentId: 'studentId',
  contentId: 'contentId',
  academicYearId: 'academicYearId',
  evaluationId: 'evaluationId',
  isRequired: 'isRequired',
  isCompleted: 'isCompleted',
  completedAt: 'completedAt',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  User: 'User',
  Group: 'Group',
  Student: 'Student',
  Trimester: 'Trimester',
  Assessment: 'Assessment',
  Grade: 'Grade',
  Rubric: 'Rubric',
  RubricRow: 'RubricRow',
  RubricScore: 'RubricScore',
  Exception: 'Exception',
  Absence: 'Absence',
  StudentNote: 'StudentNote',
  Reminder: 'Reminder',
  AcademicYear: 'AcademicYear',
  Education: 'Education',
  Course: 'Course',
  ItacaMapping: 'ItacaMapping',
  Enrollment: 'Enrollment',
  TeachingContent: 'TeachingContent',
  StudentContentEnrollment: 'StudentContentEnrollment',
  Evaluation: 'Evaluation',
  Activity: 'Activity',
  GradeObservation: 'GradeObservation',
  EvaluationObservation: 'EvaluationObservation',
  Qualification: 'Qualification',
  TargetGrade: 'TargetGrade',
  AppAccess: 'AppAccess',
  ItacaConfig: 'ItacaConfig',
  ItacaPendingSync: 'ItacaPendingSync',
  ItacaImportLog: 'ItacaImportLog',
  ItacaExportLog: 'ItacaExportLog',
  ItacaConflictResolution: 'ItacaConflictResolution',
  ItacaAuditLog: 'ItacaAuditLog',
  AuditLog: 'AuditLog',
  UserAppAccess: 'UserAppAccess',
  SchoolData: 'SchoolData',
  AcademicYearData: 'AcademicYearData',
  ACImprenta: 'ACImprenta',
  Exigible: 'Exigible'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
