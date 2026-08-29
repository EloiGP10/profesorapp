import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ProfesorApp</h1>
              <p className="text-sm text-muted-foreground">Portal de Gestión Docente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button>
                Registrarse
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center text-center">
        <h2 className="text-4xl md:text-5xl font-bold max-w-3xl leading-tight">
          Tu aula como una{" "}
          <span className="text-primary">hoja de cálculo</span>, sin formulas
          ni complicaciones
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Importa tus alumnos desde Excel, gestiona trimestres, evaluaciones,
          rúbricas interactivas y faltas. Exporta todo listo para Itaca.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/register">
            <Button size="lg">
              Empezar gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">
              Ya tengo cuenta
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3 max-w-4xl text-left">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold text-lg mb-2">📥 Importa alumnos</h3>
            <p className="text-sm text-muted-foreground">
              Sube un XLSX y elige qué columnas importar. La tabla se crea sola.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold text-lg mb-2">⭐ Rúbricas interactivas</h3>
            <p className="text-sm text-muted-foreground">
              Marca apartados alumno a alumno mientras expone. La nota se calcula sola.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold text-lg mb-2">📤 Exporta a Itaca</h3>
            <p className="text-sm text-muted-foreground">
              CSV y XML listos para importar las notas directamente en Itaca.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}