"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen, Calendar, KeyRound, Loader2, Lock, Mail, ShieldCheck, User, Users,
} from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: (user: { name: string | null; email: string }) => void;
}

interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  groupsCount: number;
  studentsCount: number;
}

export function ProfileDialog({ open, onOpenChange, onProfileUpdated }: ProfileDialogProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Form profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Form password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      loadProfile();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setName(data.user.name || "");
        setEmail(data.user.email || "");
      }
    } catch {
      toast.error("Error al cargar datos del perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim().toLowerCase(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Perfil actualizado");
        if (onProfileUpdated) {
          onProfileUpdated(data.user);
        }
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar perfil");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Contraseña actualizada con éxito");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al cambiar la contraseña");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Perfil de Profesor
          </DialogTitle>
          <DialogDescription>
            Gestiona tus datos personales, correo y seguridad de tu cuenta.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="profile" className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Datos personales</TabsTrigger>
              <TabsTrigger value="security">Seguridad</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 pt-3">
              {profile && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{profile.groupsCount} grupos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{profile.studentsCount} alumnos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2 pt-1 border-t">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Miembro desde {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prof-name" className="text-xs">Nombre y Apellidos</Label>
                  <Input
                    id="prof-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ej: Juan Pérez"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-email" className="text-xs">Correo Electrónico</Label>
                  <Input
                    id="prof-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar datos
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 pt-3">
              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="curr-pass" className="text-xs">Contraseña Actual</Label>
                  <Input
                    id="curr-pass"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-pass" className="text-xs">Nueva Contraseña</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="conf-pass" className="text-xs">Confirmar Nueva Contraseña</Label>
                  <Input
                    id="conf-pass"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full mt-2" disabled={savingPassword}>
                  {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Actualizar contraseña
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
