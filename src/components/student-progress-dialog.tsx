"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { trimesterAverage, type StatPenalties, type StatStudent, type StatTrimester } from "@/lib/student-stats";

export interface ProgressStudent extends StatStudent {
  name: string;
  surname1: string;
  surname2: string | null;
}

interface StudentProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: ProgressStudent[];
  trimesters: (StatTrimester & { name: string })[];
  penalties: StatPenalties;
  initialStudentId?: string | null;
}

function shortName(s: ProgressStudent) {
  return `${s.name} ${s.surname1}`;
}

export function StudentProgressDialog({
  open,
  onOpenChange,
  students,
  trimesters,
  penalties,
  initialStudentId,
}: StudentProgressDialogProps) {
  const [studentId, setStudentId] = useState<string>(initialStudentId ?? "");

  useEffect(() => {
    if (open) setStudentId(initialStudentId ?? "");
  }, [open, initialStudentId]);

  const student = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId]
  );

  const chartData = useMemo(() => {
    return trimesters.map((t) => {
      const mine = student ? trimesterAverage(student, t, penalties) : null;
      const groupAvgs = students
        .map((s) => trimesterAverage(s, t, penalties))
        .filter((v): v is number => v !== null);
      const group = groupAvgs.length > 0
        ? Number((groupAvgs.reduce((a, b) => a + b, 0) / groupAvgs.length).toFixed(2))
        : null;
      return {
        name: t.name.replace("Trimestre", "T"),
        Alumno: mine !== null ? Number(mine.toFixed(2)) : null,
        Grupo: group,
      };
    });
  }, [student, students, trimesters, penalties]);

  const hasData = chartData.some((d) => d.Alumno !== null || d.Grupo !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Evolución del alumno</DialogTitle>
          <DialogDescription>
            Media por trimestre del alumno frente a la media del grupo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Alumno</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Elige alumno" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {shortName(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!student ? (
          <p className="text-sm text-muted-foreground">Elige un alumno para ver su evolución.</p>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground">Aún no hay notas para mostrar la evolución.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 10]} fontSize={12} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}`, ""]}
                  labelStyle={{ color: "#09090b" }}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend />
                <Line type="monotone" dataKey="Alumno" stroke="hsl(var(--primary))" strokeWidth={2.5} dot connectNulls />
                <Line type="monotone" dataKey="Grupo" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span>
                    Alumno: <span className="font-semibold">{d.Alumno !== null ? d.Alumno.toFixed(2) : "—"}</span>
                    {" · "}
                    Grupo: <span className="text-muted-foreground">{d.Grupo !== null ? d.Grupo.toFixed(2) : "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
