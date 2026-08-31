"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Download } from "lucide-react";

interface TrimesterAvg {
  trimesterId: string;
  trimesterName: string;
  percentage: number;
  average: number | null;
  rawAverage: number | null;
  penalty: number;
  gradedCount: number;
  totalAssessments: number;
  qualitativeValue: string | null;
}

interface StudentCal {
  studentId: string;
  listNumber: number;
  name: string;
  surname1: string;
  surname2: string | null;
  firstName: string | null;
  lastName1: string | null;
  trimesters: TrimesterAvg[];
  finalAverage: number | null;
  finalQualitative: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
  year: number;
}

export default function CalificacionesPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [calificaciones, setCalificaciones] = useState<StudentCal[]>([]);
  const [trimesters, setTrimesters] = useState<{ id: string; name: string; percentage: number }[]>([]);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTrimester, setSelectedTrimester] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupRes, calRes] = await Promise.all([
        fetch(`/api/groups?id=${groupId}`),
        fetch(`/api/averages?groupId=${groupId}`),
      ]);

      if (groupRes.ok) setGroup(await groupRes.json());
      if (calRes.ok) {
        const data = await calRes.json();
        setCalificaciones(data.students || []);
        setTrimesters(data.trimesters || []);
      }
    } catch {
      toast.error("Error al cargar calificaciones");
    } finally {
      setLoading(false);
    }
  };

  const getQualClass = (qual: string | null) => {
    const colors: Record<string, string> = {
      SB: "bg-green-100 text-green-800",
      BI: "bg-blue-100 text-blue-800",
      SU: "bg-yellow-100 text-yellow-800",
      "SU-": "bg-orange-100 text-orange-800",
      INS: "bg-red-100 text-red-800",
    };
    return colors[qual || ""] || "bg-gray-100 text-gray-800";
  };

  const filtered = calificaciones.map(s => {
    if (selectedTrimester === "all") return s;
    const t = s.trimesters.find(t => t.trimesterId === selectedTrimester);
    return {
      ...s,
      finalAverage: t?.average ?? null,
      finalQualitative: t?.qualitativeValue ?? null,
    };
  });

  const displayTrimesters = selectedTrimester === "all"
    ? trimesters
    : trimesters.filter(t => t.id === selectedTrimester);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/group/${groupId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Calificaciones</h1>
              <p className="text-xs text-muted-foreground">
                {group?.name} · Curso {group?.year}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedTrimester} onValueChange={setSelectedTrimester}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todos los trimestres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los trimestres</SelectItem>
                {trimesters.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.percentage}%)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href={`/group/${groupId}?tab=export`}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {calificaciones.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>No hay calificaciones calculadas</p>
              <p className="text-sm mt-2">Introduce notas en la tabla principal para verlas aquí</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium sticky left-0 bg-muted/50 z-10">Nº</th>
                      <th className="p-2 text-left font-medium sticky left-8 bg-muted/50 z-10">Alumno</th>
                      {displayTrimesters.map(t => (
                        <th key={t.id} className="p-2 text-center font-medium min-w-[90px]">
                          {t.name}
                          <span className="block text-[10px] text-muted-foreground font-normal">({t.percentage}%)</span>
                        </th>
                      ))}
                      <th className="p-2 text-center font-bold bg-primary/10 min-w-[90px]">Media</th>
                      <th className="p-2 text-center font-bold bg-primary/10 min-w-[70px]">Cualitativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((student, i) => (
                      <tr key={student.studentId} className={`border-b ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                        <td className="p-2 sticky left-0 bg-inherit z-10">{student.listNumber}</td>
                        <td className="p-2 sticky left-8 bg-inherit font-medium z-10">
                          {student.firstName || student.name} {student.surname1}
                          {student.surname2 && ` ${student.surname2}`}
                        </td>
                        {displayTrimesters.map(t => {
                          const tData = student.trimesters.find(tr => tr.trimesterId === t.id);
                          return (
                            <td key={t.id} className="p-2 text-center font-mono">
                              {tData?.average !== null && tData?.average !== undefined
                                ? <>
                                    {tData.average.toFixed(2)}
                                    {tData.penalty > 0 && (
                                      <span className="text-[10px] text-destructive ml-1" title={`Penalización: -${tData.penalty}`}>
                                        (-{tData.penalty})
                                      </span>
                                    )}
                                  </>
                                : <span className="text-muted-foreground">-</span>
                              }
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-mono font-bold bg-primary/5 text-base">
                          {student.finalAverage !== null
                            ? student.finalAverage.toFixed(2)
                            : <span className="text-muted-foreground">-</span>
                          }
                        </td>
                        <td className="p-2 text-center bg-primary/5">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${getQualClass(student.finalQualitative)}`}>
                            {student.finalQualitative || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
