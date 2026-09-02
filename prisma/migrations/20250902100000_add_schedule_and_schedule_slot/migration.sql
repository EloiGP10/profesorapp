-- Migration: add_schedule_and_schedule_slot
-- Applied to: postgres DB, schema profesorapp

BEGIN;

CREATE TABLE "profesorapp"."Schedule" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Horario semanal',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profesorapp"."ScheduleSlot" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "day" INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "classroom" TEXT,
  "teacher" TEXT,
  "color" TEXT,
  "note" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ScheduleSlot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "profesorapp"."Schedule" ADD CONSTRAINT "Schedule_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "profesorapp"."Group"("id") ON DELETE CASCADE;

ALTER TABLE "profesorapp"."ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "profesorapp"."Schedule"("id") ON DELETE CASCADE;

CREATE INDEX "Schedule_groupId_idx" ON "profesorapp"."Schedule"("groupId");
CREATE INDEX "ScheduleSlot_scheduleId_idx" ON "profesorapp"."ScheduleSlot"("scheduleId");
CREATE INDEX "ScheduleSlot_day_idx" ON "profesorapp"."ScheduleSlot"("day");
CREATE INDEX "ScheduleSlot_order_idx" ON "profesorapp"."ScheduleSlot"("order");

COMMIT;
