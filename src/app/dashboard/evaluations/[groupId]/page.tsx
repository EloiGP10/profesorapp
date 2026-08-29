"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Calendar, Clock, ArrowLeft } from "lucide-react";

interface Evaluation {
  id: string;
  name: string;
  type: string;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  _count: { activities: number; grades: number };
}

interface GroupInfo {
  id: string;
  name: string;
  year: number;
}

export default function EvaluationsPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [form, setForm] = useState({ name: "", type: "ORDINARY", code: "", startDate: "", endDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupRes, evalRes] = await Promise.all([
        fetch(`/api/groups?id=${groupId}`),
        fetch(`/api/evaluations?groupId=${groupId}`),
      ]);

      if (groupRes.ok) setGroup(await groupRes.json());
      if (evalRes.ok) setEvaluations(await evalRes.json());
    } catch {
      toast.error("Error al cargar evaluaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Nombre requerido");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/evaluations", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form, groupId } : { ...form, groupId }),
      });

      if (res.ok) {
        toast.success(editing ? "Evaluación actualizada" : "Evaluación creada");
        setDialogOpen(false);
        setEditing(null);
        setForm({ name: "", type: "ORDINARY", code: "", startDate: "", endDate: "" });
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta evaluación? Se eliminarán también sus actividades y notas.")) return;

    try {
      const res = await fetch("/api/evaluations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast.success("Evaluación eliminada");
        loadData();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const openEdit = (eval_: Evaluation) => {
    setEditing(eval_);
    setForm({
      name: eval_.name,
      type: eval_.type,
      code: eval_.code || "",
      startDate: eval_.startDate ? eval_.startDate.split("T")[0] : "",
      endDate: eval_.endDate ? eval_.endDate.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", type: "ORDINARY", code: "", startDate: "", endDate: "" });
    setDialogOpen(true);
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      ORDINARY: "Ordinaria",
      EXTRAORDINARY: "Extraordinaria",
      FINAL: "Final",
      PARTIAL: "Parcial",
      OTHER: "Otra",
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/group/${groupId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Evaluaciones</h1>
              <p className="text-xs text-muted-foreground">
                {group?.name} · Curso {group?.year}
              </p>
            </div>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {evaluations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay evaluaciones creadas</p>
              <Button variant="outline" onClick={openNew} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Crear primera evaluación
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {evaluations.map((eval_) => (
              <Card key={eval_.id} className="group relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{eval_.name}</CardTitle>
                      {eval_.code && <p className="text-sm text-muted-foreground">{eval_.code}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(eval_)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(eval_.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getTypeBadge(eval_.type)}
                    {(eval_.startDate || eval_.endDate) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {eval_.startDate && new Date(eval_.startDate).toLocaleDateString()}
                        {eval_.startDate && eval_.endDate && " - "}
                        {eval_.endDate && new Date(eval_.endDate).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{eval_._count?.activities || 0} actividades</span>
                      <span>{eval_._count?.grades || 0} notas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Evaluación" : "Nueva Evaluación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ej: 1ª Evaluación"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORDINARY">Ordinaria</SelectItem>
                    <SelectItem value="EXTRAORDINARY">Extraordinaria</SelectItem>
                    <SelectItem value="FINAL">Final</SelectItem>
                    <SelectItem value="PARTIAL">Parcial</SelectItem>
                    <SelectItem value="OTHER">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="E1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
