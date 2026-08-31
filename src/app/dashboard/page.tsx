"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "@/components/profile-dialog";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Users, BookOpen, LogOut, Loader2, MoreVertical, Trash2,
  Copy, User, Sparkles,
} from "lucide-react";

interface Group {
  id: string;
  name: string;
  code: string | null;
  year: number;
  _count: { students: number };
  trimesters: { name: string; percentage: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogProfile, setDialogProfile] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCode, setNewGroupCode] = useState("");
  const [userName, setUserName] = useState<string | null>(null);

  // Clone dialog
  const [cloneDialog, setCloneDialog] = useState<null | { id: string; name: string }>(null);
  const [clonedName, setClonedName] = useState("");
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const me = await meRes.json();
      setUserName(me.user.name || me.user.email?.split("@")[0] || null);

      const res = await fetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          code: newGroupCode || null,
        }),
      });
      if (res.ok) {
        toast.success("Grupo creado");
        setDialogOpen(false);
        setNewGroupName("");
        setNewGroupCode("");
        loadGroups();
      } else {
        toast.error("Error al crear el grupo");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  const handleCloneGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneDialog) return;
    setCloning(true);
    try {
      const res = await fetch("/api/groups/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: cloneDialog.id,
          newName: clonedName.trim(),
        }),
      });
      if (res.ok) {
        toast.success("Estructura de grupo clonada con éxito");
        setCloneDialog(null);
        setClonedName("");
        loadGroups();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al clonar el grupo");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCloning(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`¿Eliminar el grupo "${groupName}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch("/api/groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupId }),
      });
      if (res.ok) {
        toast.success("Grupo eliminado");
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
      } else {
        toast.error("Error al eliminar el grupo");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ProfesorApp</h1>
              <p className="text-xs text-muted-foreground">
                Portal de Gestión Docente
                {userName && (
                  <span className="ml-1.5 font-medium text-foreground">· {userName}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogProfile(true)}
              className="flex items-center gap-1.5"
            >
              <User className="h-4 w-4 text-primary" />
              <span>Mi Perfil</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-4 w-4" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Mis Grupos</h2>
            <p className="text-sm text-muted-foreground">Gestiona tus clases, alumnos y evaluaciones</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Grupo</DialogTitle>
                <DialogDescription>
                  Añade una nueva clase para gestionar sus alumnos y evaluaciones.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">
                    Nombre del grupo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="groupName"
                    placeholder="ej: 1A, 3B, 4°C"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupCode">Código (opcional)</Label>
                  <Input
                    id="groupCode"
                    placeholder="Código del centro"
                    value={newGroupCode}
                    onChange={(e) => setNewGroupCode(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Grupo
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No tienes grupos aún</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Crea tu primer grupo para empezar a gestionar tus alumnos y evaluaciones.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Grupo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="hover:shadow-md transition-shadow h-full relative group border bg-card"
              >
                <Link href={`/group/${group.id}`} className="block h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between pr-8">
                      <CardTitle className="text-xl font-bold">{group.name}</CardTitle>
                      {group.code && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                          {group.code}
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs">Curso {group.year}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {group._count.students} alumnos
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {group.trimesters.map((t) => (
                        <span key={t.name} className="text-[11px] bg-secondary/80 px-2 py-0.5 rounded font-medium">
                          {t.name} ({t.percentage}%)
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Link>
                <div className="absolute top-3 right-3 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          setCloneDialog({ id: group.id, name: group.name });
                          setClonedName(`${group.name} (Copia)`);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4 text-primary" />
                        Clonar estructura del grupo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteGroup(group.id, group.name);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar grupo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Diálogo de perfil */}
      <ProfileDialog
        open={dialogProfile}
        onOpenChange={setDialogProfile}
        onProfileUpdated={(u) => setUserName(u.name || u.email.split("@")[0])}
      />

      {/* Diálogo para clonar grupo */}
      <Dialog open={Boolean(cloneDialog)} onOpenChange={(o) => !o && setCloneDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-primary" />
              Clonar Grupo
            </DialogTitle>
            <DialogDescription>
              Se creará un nuevo grupo con todos los trimestres, evaluaciones y rúbricas de{" "}
              <strong>{cloneDialog?.name}</strong> (sin alumnos).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCloneGroup} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="cloneName">Nombre para el nuevo grupo</Label>
              <Input
                id="cloneName"
                value={clonedName}
                onChange={(e) => setClonedName(e.target.value)}
                placeholder="ej: 1B, 2A..."
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={cloning}>
              {cloning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clonar Grupo
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}