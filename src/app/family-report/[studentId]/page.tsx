"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  countAbsences,
  studentFinalAverage,
} from "@/lib/student-stats";

interface FamilyReportStudent {
  id: string;
  name: string;
  surname1: string;
  surname2: string | null;
  listNumber: number;
  nia: string | null;
}

function fullName(s: FamilyReportStudent) {
  return `${s.name} ${s.surname1}${s.surname2 ? ` ${s.surname2}` : ""}`;
}

function fmt(n: number | null, digits = 1) {
  return n === null ? "—" : n.toFixed(digits);
}

export default function FamilyReportPage({
  params,
}: {
  params: { studentId: string };
}) {
  const studentId = params.studentId;
  const router = useRouter();

  const [student, setStudent] = useState<FamilyReportStudent | null>(null);
  const [trimesters, setTrimesters] = useState<
    Array<{
      id: string;
      name: string;
      percentage: number;
      assessments: any[];
    }>
  >([]);
  const [annotations, setAnnotations] = useState<any>({});

  useEffect(() => {
    async function loadData() {
      const studentRes = await fetch(
        `/api/students/profile?studentId=${studentId}`,
        { cache: "no-store" }
      );
      if (studentRes.ok) {
        const s = await studentRes.json() as FamilyReportStudent;
        setStudent(s);
      }

      const trimRes = await fetch(
        `/api/trimesters/family?studentId=${studentId}`,
        { cache: "no-store" }
      );
      if (trimRes.ok) {
        const t = await trimRes.json();
        setTrimesters(t);
      }

      const annRes = await fetch(
        `/api/reports/annotations?studentId=${studentId}`,
        { cache: "no-store" }
      );
      if (annRes.ok) {
        const a = await annRes.json();
        setAnnotations(a.annotations || {});
      }
    }

    loadData();
  }, [studentId]);

  if (!student) {
    return <div className="p-8 text-center">Cargando alumno...</div>;
  }

  // Datos para el gráfico (calculado directamente, sin useMemo para evitar reglas de hooks)
  const chartData = trimesters.map((t) => {
    const allAssessments = t.assessments.flatMap((a: any) => [
      { name: a.name, maxScore: a.maxScore, score: a.score },
    ]);
    const graded = allAssessments.filter((a: any) => a.score !== null);
    const avg =
      graded.length > 0
        ? graded.reduce((sum: number, a: any) => sum + a.score, 0) / graded.length
        : null;
    return {
      name: t.name.replace("Trimestre", "T"),
      Alumno: avg !== null ? Number(avg.toFixed(2)) : null,
    };
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <p className="text-xs text-muted-foreground">
            Enlace personal e intransferible. Los datos se actualizan automáticamente.
          </p>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
        </div>

        <h1 className="text-2xl font-bold mb-6">Informes — {fullName(student)}</h1>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Nº {student.listNumber}{student.nia ? ` · NIA ${student.nia}` : ""} · Grupo
          </p>
        </div>

        {/* Resumen de anotaciones del profesor */}
        {annotations && Object.keys(annotations).length > 0 && (
          <div className="rounded-lg border p-4 mb-6 bg-muted/30">
            <h3 className="font-semibold mb-3">Observaciones del profesor</h3>
            <div className="space-y-2">
              {Object.entries(annotations).map(([trimesterKey, text]) => (
                <div key={trimesterKey} className="p-3 rounded bg-white">
                  <p className="font-medium text-sm">{trimesterKey}</p>
                  <p className="text-truncate whitespace-pre-wrap">
                    {(text || "--") as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gráfico de evolución */}
        {trimesters.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 10]} fontSize={12} />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}`}
                  labelStyle={{ color: "#09090b" }}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend />
                <Line type="monotone" dataKey="Alumno" stroke="hsl(var(--primary))" strokeWidth={2.5} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 text-sm">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="font-medium">{d.name}</span>
                  <span>
                    Media: {d.Alumno !== null ? d.Alumno.toFixed(2) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Lista de evaluaciones por trimestre */}
        {trimesters.map((t, ti) => (
          <div key={t.id} className="rounded-lg border p-4 mb-4">
            <h3 className="font-semibold text-sm mb-3">{t.name}</h3>
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-2 py-1">Evaluación</th>
                  <th className="text-center px-2 py-1">Peso</th>
                  <th className="text-center px-2 py-1">Nota</th>
                </tr>
              </thead>
              <tbody>
                {t.assessments.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">{a.name}</td>
                    <td className="px-2 py-1 text-center">{a.percentage}%</td>
                    <td className="px-2 py-1 text-center">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Media final */}
        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <p className="font-medium text-lg">Media final</p>
          <p className="text-3xl font-bold mt-2">
            {fmt(
              studentFinalAverage(student as any, trimesters as any, {
                absence: 0,
                late: 0,
                negative: 0,
              }))
            }
          </p>
        </div>

        {/* Faltas */}
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Faltas totales: {countAbsences(student as any).absent}
            · Retrasos: {countAbsences(student as any).late}
            · Negativos: {countAbsences(student as any).negative}
          </p>
        </div>
      </div>
    </div>
  );
}