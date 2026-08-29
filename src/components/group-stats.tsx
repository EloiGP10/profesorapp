"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Loader2 } from "lucide-react";

interface TrimesterStat {
  name: string;
  percentage: number;
  avg: number | null;
  passRate: number | null;
}

interface GroupStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  trimesterStats: TrimesterStat[];
  overallAvg: number | null;
}

export function GroupStatsDialog({ open, onOpenChange, groupName, trimesterStats, overallAvg }: GroupStatsDialogProps) {
  const chartData = trimesterStats.map((t) => ({
    name: t.name.replace("Trimestre", "T"),
    Media: t.avg !== null ? Number(t.avg.toFixed(2)) : 0,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estadísticas de {groupName}</DialogTitle>
          <DialogDescription>
            Resumen de calificaciones del grupo
          </DialogDescription>
        </DialogHeader>

        {overallAvg !== null && (
          <div className="rounded-lg border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">Nota media del grupo</p>
            <p className="text-3xl font-bold text-primary">{overallAvg.toFixed(2)}</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={12} strokeLinecap="round" />
            <YAxis domain={[0, 10]} fontSize={12} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(2)}`, "Media"]}
              labelStyle={{ color: "#09090b" }}
              contentStyle={{ borderRadius: 8, fontSize: 13 }}
            />
            <Bar dataKey="Media" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-2">
          {trimesterStats.map((t) => (
            <div key={t.name} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">Peso: {t.percentage}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {t.avg !== null ? t.avg.toFixed(2) : "—"}
                </p>
                <p className={`text-xs ${t.passRate !== null && t.passRate >= 50 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {t.passRate !== null ? `${t.passRate.toFixed(0)}% aprobados` : "Sin notas"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function loadGroupStats(groupId: string) {
  try {
    const res = await fetch(`/api/groups?id=${groupId}&stats=1`);
    if (res.ok) return await res.json();
  } catch (error) {
    console.error("Error loading stats:", error);
  }
  return null;
}