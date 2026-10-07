"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

interface Access {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

const ROLES = [
  { id: "TEACHER", label: "Profesor — puede poner notas y gestionar alumnos" },
  { id: "COORDINATOR", label: "Coordinador — puede compartir y borrar el grupo" },
  { id: "VIEWER", label: "Solo lectura — no puede modificar nada" },
];

export function ShareGroupDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string | null;
  groupName: string;
}) {
  const [access, setAccess] = useState<Access[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/share?groupId=${groupId}`, {
        cache: "no-store",
      });
      if (res.ok) setAccess(await res.json());
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !email.trim()) return;

    setInviting(true);
    try {
      const res = await fetch("/api/groups/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "No se pudo compartir");
        return;
      }
      toast.success(
        data.pending
          ? "Guardado. Tendrá acceso al registrarse con ese correo."
          : "Acceso concedido"
      );
      setEmail("");
      load();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setInviting(false);
    }
  };

  const remove = async (accessId: string) => {
    try {
      const res = await fetch(`/api/groups/share?accessId=${accessId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("No se pudo quitar el acceso");
        return;
      }
      setAccess((prev) => prev.filter((a) => a.id !== accessId));
      toast.success("Acceso retirado");
    } catch {
      toast.error("Error de conexión");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Compartir {groupName}
          </DialogTitle>
          <DialogDescription>
            Invita a otros profesores a trabajar en este mismo grupo. Verán los
            mismos alumnos y podrán poner sus notas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={invite} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="share-email">Email del profesor</Label>
            <Input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@centro.es"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Permisos</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={inviting} className="w-full">
            <UserPlus className="mr-2 h-4 w-4" />
            {inviting ? "Compartiendo..." : "Dar acceso"}
          </Button>
        </form>

        <div className="border-t pt-3">
          <p className="mb-2 text-sm font-medium">
            Con acceso ({access.length})
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : access.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nadie más tiene acceso a este grupo.
            </p>
          ) : (
            <ul className="space-y-2">
              {access.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.user.name || a.user.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.user.email} ·{" "}
                      {ROLES.find((r) => r.id === a.role)?.label.split(" —")[0] || a.role}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(a.id)}
                    aria-label="Quitar acceso"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}