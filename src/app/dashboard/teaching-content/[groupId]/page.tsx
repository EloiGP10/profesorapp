"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Plus, Pencil, Trash2, BookOpen, ArrowLeft, ExternalLink, FolderOpen,
} from "lucide-react";

interface TeachingContent {
  id: string;
  name: string;
  description: string | null;
  code: string | null;
  subjectArea: string | null;
  term: string | null;
  weeklyHours: number | null;
  competencies: string | null;
  knowledgeArea: string | null;
  driveLink: string | null;
  _count: { evaluations: number; activities: number; enrollments: number };
}

interface GroupInfo {
  id: string;
  name: string;
  year: number;
}

export default function TeachingContentPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [contents, setContents] = useState<TeachingContent[]>([]);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeachingContent | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", code: "", subjectArea: "", term: "",
    weeklyHours: "", competencies: "", knowledgeArea: "", driveLink: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [groupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupRes, contentsRes] = await Promise.all([
        fetch(`/api/groups?id=${groupId}`),
        fetch("/api/teaching-content"),
      ]);
      if (groupRes.ok) setGroup(await groupRes.json());
      if (contentsRes.ok) setContents(await contentsRes.json());
    } catch { toast.error("Error al cargar datos"); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.name) { toast.error("Nombre requerido"); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        weeklyHours: form.weeklyHours ? parseInt(form.weeklyHours) : null,
        driveLink: form.driveLink || null,
      };
      const res = await fetch("/api/teaching-content", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...body } : body),
      });
      if (res.ok) {
        toast.success(editing ? "Contenido actualizado" : "Contenido creado");
        setDialogOpen(false); setEditing(null);
        setForm({ name: "", description: "", code: "", subjectArea: "", term: "", weeklyHours: "", competencies: "", knowledgeArea: "", driveLink: "" });
        loadData();
      } else { const data = await res.json(); toast.error(data.error || "Error al guardar"); }
    } catch { toast.error("Error de conexión"); }
    finally { setSaving(false); }
  };

  const handleDeleteContent = async (id: string) => {
    if (!confirm("¿Eliminar este contenido?")) return;
    try {
      const res = await fetch("/api/teaching-content", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { toast.success("Contenido eliminado"); loadData(); }
      else { toast.error("Error al eliminar"); }
    } catch { toast.error("Error de conexión"); }
  };

  const openEdit = (content: TeachingContent) => {
    setEditing(content);
    setForm({
      name: content.name, description: content.description || "", code: content.code || "",
      subjectArea: content.subjectArea || "", term: content.term || "",
      weeklyHours: content.weeklyHours?.toString() || "", competencies: content.competencies || "",
      knowledgeArea: content.knowledgeArea || "", driveLink: content.driveLink || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", code: "", subjectArea: "", term: "", weeklyHours: "", competencies: "", knowledgeArea: "", driveLink: "" });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/group/${groupId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div>
              <h1 className="text-xl font-bold">Contenidos / Materias</h1>
              <p className="text-xs text-muted-foreground">{group?.name} · Curso {group?.year}</p>
            </div>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {contents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay contenidos creados</p>
              <Button variant="outline" onClick={openNew} className="mt-4">
                <Plus className="h-4 w-4 mr-2" /> Crear primer contenido
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contents.map((content) => (
              <Card key={content.id} className="group relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{content.name}</CardTitle>
                      {content.code && <p className="text-sm text-muted-foreground">{content.code}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(content)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteContent(content.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {content.subjectArea && <Badge variant="secondary">{content.subjectArea}</Badge>}
                    {content.description && <p className="text-sm text-muted-foreground line-clamp-2">{content.description}</p>}
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {content.weeklyHours && <span>{content.weeklyHours}h/sem</span>}
                      {content.term && <span>{content.term}</span>}
                    </div>
                    {content.driveLink && (
                      <a
                        href={content.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Abrir carpeta en Drive
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Contenido" : "Nuevo Contenido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ej: Matemáticas" /></div>
              <div><Label>Código</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MAT-1" /></div>
            </div>
            <div><Label>Descripción</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del contenido..." /></div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Área</Label>
                <Select value={form.subjectArea} onValueChange={(v) => setForm({ ...form, subjectArea: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguna</SelectItem>
                    <SelectItem value="MATEMATICAS">Matemáticas</SelectItem>
                    <SelectItem value="LENGUA">Lengua</SelectItem>
                    <SelectItem value="CIENCIAS">Ciencias</SelectItem>
                    <SelectItem value="HISTORIA">Historia</SelectItem>
                    <SelectItem value="INGLES">Inglés</SelectItem>
                    <SelectItem value="EDUCACION_FISICA">Ed. Física</SelectItem>
                    <SelectItem value="TECNOLOGIA">Tecnología</SelectItem>
                    <SelectItem value="OTRO">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Trimestre</Label>
                <Select value={form.term} onValueChange={(v) => setForm({ ...form, term: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="PRIMERO">1º Trimestre</SelectItem>
                    <SelectItem value="SEGUNDO">2º Trimestre</SelectItem>
                    <SelectItem value="TERCERO">3º Trimestre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Horas/sem</Label><Input type="number" min="1" value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })} placeholder="4" /></div>
            </div>
            <div><Label>Competencias</Label><Textarea value={form.competencies} onChange={(e) => setForm({ ...form, competencies: e.target.value })} placeholder="Competencias clave..." /></div>

            <div className="border-t pt-4">
              <Label className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Enlace carpeta Drive / OneDrive / Otro
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Pega aquí el enlace de carpetas compartidas de Google Drive, OneDrive, etc.
              </p>
              <Input
                value={form.driveLink}
                onChange={(e) => setForm({ ...form, driveLink: e.target.value })}
                placeholder="https://drive.google.com/drive/folders/..."
              />
              {form.driveLink && (
                <a href={form.driveLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                  Abrir enlace <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
