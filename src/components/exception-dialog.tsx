"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { AlertCircle, Ban, FileEdit, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

interface ExceptionRow {
  id?: string;
  assessmentId: string;
  assessmentName: string;
  trimesterName: string;
  isExcluded: boolean;
  notes: string | null;
}

interface CustomAssessmentRow {
  id: string;
  name: string;
  trimesterId: string;
  trimesterName?: string;
  percentage: number;
  maxScore: number;
  type: string;
}

interface ExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  assessments: Array<{ id: string; name: string; type?: string; trimesterId?: string; trimester: { id?: string; name: string } }>;
  trimesters?: Array<{ id: string; name: string }>;
  onSaved?: () => void;
}

export function ExceptionDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  assessments,
  trimesters = [],
  onSaved,
}: ExceptionDialogProps) {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [customAssessments, setCustomAssessments] = useState<CustomAssessmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Exclude form
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [excludeMode, setExcludeMode] = useState(true);
  const [notes, setNotes] = useState("");

  // Custom assessment form
  const [customName, setCustomName] = useState("");
  const [customTrimesterId, setCustomTrimesterId] = useState(trimesters[0]?.id || "");
  const [customType, setCustomType] = useState("WORK");
  const [customPct, setCustomPct] = useState(15);
  const [customMax, setCustomMax] = useState(10);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);

  const available = useMemo(() => {
    const existing = new Set(exceptions.map((e) => e.assessmentId));
    return assessments.filter((a) => !existing.has(a.id) && a.type !== "RUBRIC_WORK");
  }, [exceptions, assessments]);

  useEffect(() => {
    if (open && studentId) {
      loadExceptions();
      if (trimesters.length > 0 && !customTrimesterId) {
        setCustomTrimesterId(trimesters[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId, trimesters]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exceptions?studentId=${studentId}`);
      if (res.ok) {
        const data = await res.json() as Array<{
          id: string;
          assessment: { id: string; name: string; trimester: { name: string } };
          isExcluded: boolean;
          notes: string | null;
        }>;
        setExceptions(
          data.map((e) => ({
            id: e.id,
            assessmentId: e.assessment.id,
            assessmentName: e.assessment.name,
            trimesterName: e.assessment.trimester?.name || "Trimestre",
            isExcluded: e.isExcluded,
            notes: e.notes,
          }))
        );
      } else {
        console.error("Error loading exceptions:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Error fetching exceptions:", err);
    }

    try {
      const customRes = await fetch(`/api/students?id=${studentId}`);
      if (customRes.ok) {
        const studentData = await customRes.json();
        if (studentData.customAssessments) {
          setCustomAssessments(
            studentData.customAssessments.map((ca: { id: string; name: string; trimesterId: string; percentage: number; maxScore: number; type: string; trimester?: { name?: string } }) => ({
              id: ca.id,
              name: ca.name,
              trimesterId: ca.trimesterId,
              trimesterName: ca.trimester?.name || "Trimestre",
              percentage: ca.percentage,
              maxScore: ca.maxScore,
              type: ca.type,
            }))
          );
        }
      } else {
        console.error("Error loading custom assessments:", customRes.status, await customRes.text());
      }
    } catch (err) {
      console.error("Error fetching custom assessments:", err);
    }

    setLoading(false);
  };

  const handleAdd = async () => {
    if (!selectedAssessment) {
      toast.error("Selecciona una evaluación");
      return;
    }
    setSavingId("new");
    try {
      const res = await fetch("/api/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId: selectedAssessment,
          isExcluded: excludeMode,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const assessment = assessments.find((a) => a.id === selectedAssessment)!;
        setExceptions((prev) => [
          ...prev,
          {
            id: data.id,
            assessmentId: selectedAssessment,
            assessmentName: assessment.name,
            trimesterName: assessment.trimester.name,
            isExcluded: excludeMode,
            notes,
          },
        ]);
        setSelectedAssessment("");
        setNotes("");
        setExcludeMode(true);
        onSaved?.();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al añadir");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggle = async (row: ExceptionRow) => {
    setSavingId(row.id || row.assessmentId);
    try {
      const res = await fetch("/api/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          assessmentId: row.assessmentId,
          isExcluded: !row.isExcluded,
          notes: row.notes,
        }),
      });
      if (res.ok) {
        setExceptions((prev) =>
          prev.map((e) =>
            e.assessmentId === row.assessmentId
              ? { ...e, isExcluded: !row.isExcluded }
              : e
          )
        );
        onSaved?.();
        router.refresh();
      } else {
        toast.error("Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (row: ExceptionRow) => {
    try {
      const res = await fetch("/api/exceptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      if (res.ok) {
        setExceptions((prev) => prev.filter((e) => e.assessmentId !== row.assessmentId));
        onSaved?.();
        router.refresh();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

const handleUpdateCustomAssessment = async (id: string, e: React.FormEvent) => {
  e.preventDefault();
  if (!customName.trim()) {
    toast.error("El nombre de la tarea adaptada es obligatorio");
    return;
  }
  const trimId = customTrimesterId || trimesters[0]?.id;
  if (!trimId) {
    toast.error("Selecciona un trimestre");
    return;
  }

  setSavingId(id);
  try {
    const res = await fetch(`/api/assessments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        trimesterId: trimId,
        studentId,
        name: customName.trim(),
        type: customType,
        percentage: Number(customPct) || 10,
        maxScore: Number(customMax) || 10,
        isExtra: false,
      }),
    });

      if (res.ok) {
        const updated = await res.json();
        const trimName = trimesters.find((t) => t.id === trimId)?.name || "Trimestre";
        setCustomAssessments((prev) =>
          prev.map((ca) => ca.id === id ? {
            ...ca,
            name: updated.name,
            trimesterId: trimId,
            trimesterName: trimName,
            percentage: updated.percentage,
            maxScore: updated.maxScore,
            type: updated.type,
          } : ca)
        );
        setCustomName("");
        setEditingCustomId(null);
        toast.success("Evaluación adaptada actualizada");
        onSaved?.();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

const handleStartEditCustom = (id: string) => {
  const ca = customAssessments.find((a) => a.id === id);
  if (ca) {
    setCustomName(ca.name);
    setCustomTrimesterId(ca.trimesterId);
    setCustomType(ca.type);
    setCustomPct(ca.percentage);
    setCustomMax(ca.maxScore);
    setEditingCustomId(id);
  }
};

const handleCancelEditCustom = () => {
  setCustomName("");
  setEditingCustomId(null);
  setCustomTrimesterId(trimesters[0]?.id || "");
  setCustomType("WORK");
  setCustomPct(15);
  setCustomMax(10);
};

  const handleCreateCustomAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error("El nombre de la tarea adaptada es obligatorio");
      return;
    }
    const trimId = customTrimesterId || trimesters[0]?.id;
    if (!trimId) {
      toast.error("Selecciona un trimestre");
      return;
    }

    setSavingId("new");
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimesterId: trimId,
          studentId,
          name: customName.trim(),
          type: customType,
          percentage: Number(customPct) || 10,
          maxScore: Number(customMax) || 10,
          isExtra: false,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        const trimName = trimesters.find((t) => t.id === trimId)?.name || "Trimestre";
        setCustomAssessments((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name,
            trimesterId: trimId,
            trimesterName: trimName,
            percentage: created.percentage,
            maxScore: created.maxScore,
            type: created.type,
          },
        ]);
        setCustomName("");
        toast.success("Evaluación adaptada creada");
        onSaved?.();
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    if (!confirm("¿Eliminar esta evaluación adaptada?")) return;
    try {
      const res = await fetch("/api/assessments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCustomAssessments((prev) => prev.filter((a) => a.id !== id));
        toast.success("Evaluación eliminada");
        onSaved?.();
        router.refresh();
      } else {
        toast.error("Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Caso Excepcional — {studentName}
          </DialogTitle>
          <DialogDescription>
            Configura adaptaciones curriculares, exclusiones de tareas o evaluaciones exclusivas.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="exclusions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="exclusions" className="flex items-center gap-1 text-xs">
              <Ban className="h-3.5 w-3.5" />
              Exclusiones ({exceptions.length})
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-1 text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Tareas Adaptadas ({customAssessments.length})
            </TabsTrigger>
          </TabsList>

          {/* Pestaña 1: Exclusión de tareas globales */}
          <TabsContent value="exclusions" className="space-y-4 pt-2">
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <Label className="text-xs font-semibold">Excluir evaluación global</Label>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecciona evaluación a excluir" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      Todas las evaluaciones ya tienen excepción
                    </p>
                  ) : (
                    available.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.trimester.name} — {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={excludeMode}
                  onCheckedChange={setExcludeMode}
                />
                <span className="text-xs text-muted-foreground">
                  {excludeMode ? "Excluido (no cuenta para su media)" : "Aplicar ponderación distinta"}
                </span>
              </div>
              <Textarea
                placeholder="Motivo o notas de la adaptación..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-xs"
              />
              <Button
                onClick={handleAdd}
                size="sm"
                className="w-full"
                disabled={savingId === "new" || !selectedAssessment}
              >
                {savingId === "new" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Añadir exclusión
              </Button>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Evaluación</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : exceptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-center text-muted-foreground text-xs">
                        No tiene tareas excluidas. Realiza las mismas evaluaciones que la clase.
                      </TableCell>
                    </TableRow>
                  ) : (
                    exceptions.map((row) => (
                      <TableRow key={row.assessmentId}>
                        <TableCell>
                          <p className="text-xs font-medium">{row.assessmentName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.trimesterName}</p>
                          {row.notes && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 italic">{row.notes}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={row.isExcluded}
                              onCheckedChange={() => handleToggle(row)}
                            />
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {row.isExcluded ? "Excluido" : "Distinto"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Pestaña 2: Tareas a medida / Tablita propia */}
          <TabsContent value="custom" className="space-y-4 pt-2">
            <form
              onSubmit={(e) => {
                if (editingCustomId) {
                  handleUpdateCustomAssessment(editingCustomId, e);
                } else {
                  handleCreateCustomAssessment(e);
                }
              }}
              className="space-y-3 rounded-lg border p-3 bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  {editingCustomId ? "Editando evaluación adaptada" : `Nueva evaluación adaptada para ${studentName}`}
                </h4>
                {editingCustomId && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditCustom} className="h-6 text-xs px-2">
                    Cancelar
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Nombre de la tarea</Label>
                  <Input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="ej: Examen adaptado Tema 1, Trabajo especial..."
                    className="text-xs h-8"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Trimestre</Label>
                  <Select value={customTrimesterId} onValueChange={setCustomTrimesterId}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Trimestre" />
                    </SelectTrigger>
                    <SelectContent>
                      {trimesters.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={customType} onValueChange={setCustomType}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXAM">Examen</SelectItem>
                      <SelectItem value="WORK">Trabajo</SelectItem>
                      <SelectItem value="NOTEBOOK">Libreta</SelectItem>
                      <SelectItem value="OTHER">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">% del trimestre</Label>
                  <Input
                    type="number"
                    min={0}
                    value={customPct}
                    onChange={(e) => setCustomPct(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Nota máxima</Label>
                  <Input
                    type="number"
                    min={1}
                    value={customMax}
                    onChange={(e) => setCustomMax(Number(e.target.value))}
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full" disabled={savingId !== null}>
                {savingId !== null && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {editingCustomId ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Actualizar tarea adaptada
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Crear tarea adaptada
                  </>
                )}
              </Button>
            </form>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tarea adaptada</TableHead>
                    <TableHead className="text-xs">Trimestre</TableHead>
                    <TableHead className="text-xs text-right">Peso</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customAssessments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground text-xs">
                        No tiene evaluaciones creadas exclusivamente para él.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customAssessments.map((ca) => (
                      <TableRow key={ca.id}>
                        <TableCell>
                          <p className="text-xs font-medium">{ca.name}</p>
                          <p className="text-[10px] text-muted-foreground">Sobre {ca.maxScore} pts</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ca.trimesterName || "Trimestre"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">
                          {ca.percentage}%
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleStartEditCustom(ca.id)}
                              title="Editar"
                            >
                              <FileEdit className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteCustom(ca.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}