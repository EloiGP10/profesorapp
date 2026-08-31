"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, Building2, Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SchoolData {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  director: string | null;
  directorDni: string | null;
  communityCode: string | null;
  educationType: string | null;
}

interface ItacaConfig {
  id: string;
  itacaUrl: string;
  apiKey: string | null;
  schoolCode: string | null;
  schoolName: string | null;
  syncEnabled: boolean;
  autoSync: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  academicYear: { id: string; name: string };
}

export default function SettingsPage() {
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null);
  const [itacaConfigs, setItacaConfigs] = useState<ItacaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    director: "",
    directorDni: "",
    communityCode: "",
    educationType: "MIXED",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schoolRes, itacaRes] = await Promise.all([
        fetch("/api/school-data"),
        fetch("/api/itaca-config"),
      ]);

      if (schoolRes.ok) {
        const data = await schoolRes.json();
        if (data) {
          setSchoolData(data);
          setSchoolForm({
            name: data.name || "",
            code: data.code || "",
            address: data.address || "",
            city: data.city || "",
            province: data.province || "",
            postalCode: data.postalCode || "",
            phone: data.phone || "",
            email: data.email || "",
            website: data.website || "",
            director: data.director || "",
            directorDni: data.directorDni || "",
            communityCode: data.communityCode || "",
            educationType: data.educationType || "MIXED",
          });
        }
      }

      if (itacaRes.ok) {
        const data = await itacaRes.json();
        setItacaConfigs(Array.isArray(data) ? data : data ? [data] : []);
      }
    } catch {
      toast.error("Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchool = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/school-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schoolForm),
      });

      if (res.ok) {
        toast.success("Datos del centro guardados");
        loadData();
      } else {
        toast.error("Error al guardar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Configuración</h2>
          <p className="text-sm text-muted-foreground">Datos del centro y configuración ITACA</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Datos del Centro
          </CardTitle>
          <CardDescription>Información general del centro educativo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre del centro *</Label>
              <Input
                id="name"
                value={schoolForm.name}
                onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                placeholder="IES Ejemplo"
              />
            </div>
            <div>
              <Label htmlFor="code">Código del centro</Label>
              <Input
                id="code"
                value={schoolForm.code}
                onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })}
                placeholder="CENTRO001"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={schoolForm.address}
                onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                placeholder="Calle Principal, 1"
              />
            </div>
            <div>
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                value={schoolForm.city}
                onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                placeholder="Madrid"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                value={schoolForm.province}
                onChange={(e) => setSchoolForm({ ...schoolForm, province: e.target.value })}
                placeholder="Madrid"
              />
            </div>
            <div>
              <Label htmlFor="postalCode">Código Postal</Label>
              <Input
                id="postalCode"
                value={schoolForm.postalCode}
                onChange={(e) => setSchoolForm({ ...schoolForm, postalCode: e.target.value })}
                placeholder="28001"
              />
            </div>
            <div>
              <Label htmlFor="communityCode">Cód. Comunidad</Label>
              <Input
                id="communityCode"
                value={schoolForm.communityCode}
                onChange={(e) => setSchoolForm({ ...schoolForm, communityCode: e.target.value })}
                placeholder="13"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={schoolForm.phone}
                onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                placeholder="912 345 678"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={schoolForm.email}
                onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                placeholder="info@iesejemplo.edu"
              />
            </div>
            <div>
              <Label htmlFor="website">Web</Label>
              <Input
                id="website"
                value={schoolForm.website}
                onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                placeholder="https://iesejemplo.edu"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="director">Director/a</Label>
              <Input
                id="director"
                value={schoolForm.director}
                onChange={(e) => setSchoolForm({ ...schoolForm, director: e.target.value })}
                placeholder="Nombre del director"
              />
            </div>
            <div>
              <Label htmlFor="directorDni">DNI Director/a</Label>
              <Input
                id="directorDni"
                value={schoolForm.directorDni}
                onChange={(e) => setSchoolForm({ ...schoolForm, directorDni: e.target.value })}
                placeholder="12345678A"
              />
            </div>
            <div>
              <Label htmlFor="educationType">Tipo de enseñanza</Label>
              <Select value={schoolForm.educationType} onValueChange={(v) => setSchoolForm({ ...schoolForm, educationType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESO">ESO</SelectItem>
                  <SelectItem value="BACHILLERATO">Bachillerato</SelectItem>
                  <SelectItem value="FP">Formación Profesional</SelectItem>
                  <SelectItem value="MIXED">Mixto</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSchool} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Guardar Datos del Centro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración ITACA
          </CardTitle>
          <CardDescription>Conexión con el sistema ITACA de la Generalitat</CardDescription>
        </CardHeader>
        <CardContent>
          {itacaConfigs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No hay configuración ITACA. Se creará automáticamente al vincular un año académico.
            </p>
          ) : (
            <div className="space-y-4">
              {itacaConfigs.map((config) => (
                <div key={config.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{config.academicYear.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${config.syncEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                        {config.syncEnabled ? "Activo" : "Inactivo"}
                      </span>
                      {config.lastSyncAt && (
                        <span className="text-xs text-muted-foreground">
                          Última sync: {new Date(config.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">URL:</span> {config.itacaUrl}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Código centro:</span> {config.schoolCode || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
