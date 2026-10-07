-- ============================================================
-- Aplicar en el SQL Editor de Supabase (schema profesorapp).
-- Idempotente: se puede ejecutar varias veces sin romper nada.
--
-- Por qué: son las tablas del portal multiprofesor. Si faltan, las rutas
-- que las consultan devuelven 500 y el panel muestra el grupo vacio aunque
-- los datos esten ahi. Nada de esto BORRA datos: solo crea tablas nuevas
-- y anade columnas.
-- ============================================================

-- Tablas nuevas del portal multiprofesor. Idempotente: se puede repetir.
CREATE TABLE IF NOT EXISTS "profesorapp"."School" (

    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "city" TEXT,
    "province" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."SchoolMembership" (

    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."RubricTemplate" (

    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "level" TEXT,
    "rows" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RubricTemplate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."PendingGroupInvite" (

    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEACHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingGroupInvite_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."License" (

    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'PROFESOR',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionAtPurchase" TEXT,
    "paymentRef" TEXT,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."ContactMessage" (

    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."AnalyticsEvent" (

    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "profesorapp"."ClientError" (

    "id" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientError_pkey" PRIMARY KEY ("id")
);

-- Columnas nuevas
ALTER TABLE "profesorapp"."Group" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "profesorapp"."Student" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
ALTER TABLE "profesorapp"."Student" ADD COLUMN IF NOT EXISTS "shareEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "profesorapp"."Assessment" ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT false;

-- Indices
CREATE UNIQUE INDEX IF NOT EXISTS "Student_shareToken_key" ON "profesorapp"."Student"("shareToken");
CREATE INDEX IF NOT EXISTS "Group_schoolId_idx" ON "profesorapp"."Group"("schoolId");
CREATE INDEX IF NOT EXISTS "Student_shareToken_idx" ON "profesorapp"."Student"("shareToken");

-- Claves foráneas
ALTER TABLE "profesorapp"."PendingGroupInvite" ADD CONSTRAINT "PendingGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "profesorapp"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."School" ADD CONSTRAINT "School_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "profesorapp"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."SchoolMembership" DROP CONSTRAINT IF EXISTS "SchoolMembership_schoolId_fkey";
ALTER TABLE "profesorapp"."SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "profesorapp"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profesorapp"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."RubricTemplate" ADD CONSTRAINT "RubricTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profesorapp"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."RubricTemplate" ADD CONSTRAINT "RubricTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "profesorapp"."School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profesorapp"."License" ADD CONSTRAINT "License_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profesorapp"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "PendingGroupInvite_email_idx" ON "profesorapp"."PendingGroupInvite"("email");
CREATE INDEX IF NOT EXISTS "School_ownerId_idx" ON "profesorapp"."School"("ownerId");
CREATE INDEX IF NOT EXISTS "School_name_idx" ON "profesorapp"."School"("name");
CREATE INDEX IF NOT EXISTS "SchoolMembership_userId_idx" ON "profesorapp"."SchoolMembership"("userId");
CREATE INDEX IF NOT EXISTS "SchoolMembership_schoolId_idx" ON "profesorapp"."SchoolMembership"("schoolId");
CREATE INDEX IF NOT EXISTS "RubricTemplate_userId_idx" ON "profesorapp"."RubricTemplate"("userId");
CREATE INDEX IF NOT EXISTS "RubricTemplate_schoolId_idx" ON "profesorapp"."RubricTemplate"("schoolId");
CREATE INDEX IF NOT EXISTS "RubricTemplate_isShared_idx" ON "profesorapp"."RubricTemplate"("isShared");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "profesorapp"."AnalyticsEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_name_idx" ON "profesorapp"."AnalyticsEvent"("name");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_idx" ON "profesorapp"."AnalyticsEvent"("userId");
CREATE INDEX IF NOT EXISTS "ClientError_createdAt_idx" ON "profesorapp"."ClientError"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "profesorapp"."ContactMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactMessage_readAt_idx" ON "profesorapp"."ContactMessage"("readAt");
CREATE UNIQUE INDEX IF NOT EXISTS "License_userId_key" ON "profesorapp"."License"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "License_paymentRef_key" ON "profesorapp"."License"("paymentRef");
CREATE INDEX IF NOT EXISTS "License_status_idx" ON "profesorapp"."License"("status");