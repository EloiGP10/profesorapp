"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, Pipette, RotateCcw } from "lucide-react";

export interface ColumnColor {
  r: number;
  g: number;
  b: number;
  intensity: number;
}

export const DEFAULT_COLOR: ColumnColor = { r: 99, g: 102, b: 241, intensity: 0 };

export function colorToCss(c: ColumnColor | null | undefined, alpha = 1): string {
  if (!c) return "transparent";
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

export function colorToHex(c: ColumnColor | null | undefined): string {
  if (!c) return "#6366f1";
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

export function hexToColor(hex: string): ColumnColor {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return DEFAULT_COLOR;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, intensity: 0 };
}

export function parseColorString(s: string | null | undefined): ColumnColor | null {
  if (!s) return null;
  // Formato esperado: "r,g,b" o "r,g,b,intensity"
  const parts = s.split(",").map((x) => Number(x.trim()));
  if (parts.length < 3 || parts.some((n) => isNaN(n))) return null;
  return {
    r: Math.max(0, Math.min(255, parts[0])),
    g: Math.max(0, Math.min(255, parts[1])),
    b: Math.max(0, Math.min(255, parts[2])),
    intensity: parts[3] !== undefined ? Math.max(0, Math.min(100, parts[3])) : 0,
  };
}

export function colorToString(c: ColumnColor | null | undefined): string | null {
  if (!c) return null;
  return `${c.r},${c.g},${c.b},${c.intensity}`;
}

interface ColorPickerProps {
  value: ColumnColor | null;
  onChange: (c: ColumnColor | null) => void;
}

const PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
  "#f43f5e", "#78716c", "#64748b", "#0f172a",
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnColor>(value ?? DEFAULT_COLOR);
  const wheelRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setDraft(value ?? DEFAULT_COLOR);
  }, [value]);

  const handleWheelPick = useCallback(
    (e: React.MouseEvent<SVGSVGElement> | MouseEvent) => {
      const svg = wheelRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const x = e.clientX - rect.left - cx;
      const y = e.clientY - rect.top - cy;
      const dist = Math.sqrt(x * x + y * y);
      const maxR = rect.width / 2;
      const r = Math.min(dist, maxR) / maxR;
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      // 0° = rojo
      const { h2rgb } = hsvToRgb(r, angle, 1);
      setDraft((d) => ({ ...d, r: h2rgb.r, g: h2rgb.g, b: h2rgb.b }));
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleWheelPick(e);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, handleWheelPick]);

  const setChannel = (k: "r" | "g" | "b", v: number) => {
    setDraft((d) => ({ ...d, [k]: Math.max(0, Math.min(255, Math.round(v))) }));
  };

  const apply = (next: ColumnColor | null) => {
    onChange(next);
  };

  const css = `rgba(${draft.r}, ${draft.g}, ${draft.b}, ${0.15 + (draft.intensity / 100) * 0.65})`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-12 h-12 rounded-lg border-2 border-border shrink-0 transition-colors"
          style={{ backgroundColor: value ? css : "transparent" }}
          title={value ? "Color actual" : "Sin color"}
        />
        <div className="flex-1 min-w-0">
          <Input
            value={value ? `${draft.r}, ${draft.g}, ${draft.b}` : "Sin color"}
            readOnly
            className="text-xs font-mono"
          />
        </div>
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full">
            <Palette className="h-4 w-4 mr-2" />
            Personalizar color
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold mb-2 block">Rueda de color</Label>
              <div className="relative aspect-square w-full max-w-[260px] mx-auto select-none">
                <svg
                  ref={wheelRef}
                  viewBox="-100 -100 200 200"
                  className="w-full h-full cursor-crosshair rounded-full"
                  onMouseDown={(e) => {
                    setDragging(true);
                    handleWheelPick(e);
                  }}
                >
                  <defs>
                    <radialGradient id="wheel-bg" cx="0" cy="0" r="100" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="white" />
                      <stop offset="100%" stopColor="#ccc" />
                    </radialGradient>
                    {Array.from({ length: 360 }).map((_, i) => {
                      const { r, g, b } = hsvToRgb(1, i, 1);
                      return (
                        <linearGradient
                          key={i}
                          id={`cone-${i}`}
                          gradientUnits="userSpaceOnUse"
                          x1="0"
                          y1="0"
                          x2={Math.cos((i * Math.PI) / 180) * 100}
                          y2={Math.sin((i * Math.PI) / 180) * 100}
                        >
                          <stop offset="0%" stopColor="white" />
                          <stop offset="100%" stopColor={`rgb(${r}, ${g}, ${b})`} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <circle cx="0" cy="0" r="100" fill="url(#wheel-bg)" />
                  {Array.from({ length: 360 }).map((_, i) => {
                    const a1 = ((i - 0.5) * Math.PI) / 180;
                    const a2 = ((i + 0.5) * Math.PI) / 180;
                    const x1 = Math.cos(a1) * 100;
                    const y1 = Math.sin(a1) * 100;
                    const x2 = Math.cos(a2) * 100;
                    const y2 = Math.sin(a2) * 100;
                    return (
                      <path
                        key={i}
                        d={`M0,0 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`}
                        fill={`url(#cone-${i})`}
                      />
                    );
                  })}
                  <circle cx="0" cy="0" r="100" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
                  {/* marcador */}
                  {(() => {
                    const [hh, ss] = rgbToHsv(draft.r, draft.g, draft.b);
                    const ang = (hh * Math.PI) / 180;
                    const rad = ss * 100;
                    return (
                      <circle
                        cx={Math.cos(ang) * rad}
                        cy={Math.sin(ang) * rad}
                        r="5"
                        fill="white"
                        stroke="black"
                        strokeWidth="1.5"
                      />
                    );
                  })()}
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px]">R</Label>
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={draft.r}
                  onChange={(e) => setChannel("r", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">G</Label>
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={draft.g}
                  onChange={(e) => setChannel("g", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">B</Label>
                <Input
                  type="number"
                  min={0}
                  max={255}
                  value={draft.b}
                  onChange={(e) => setChannel("b", Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Intensidad / Opacidad</Label>
                <span className="text-xs text-muted-foreground font-mono">{draft.intensity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={draft.intensity}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, intensity: Number(e.target.value) }))
                }
                className="w-full accent-primary h-2"
                style={{
                  background: `linear-gradient(to right, rgba(${draft.r}, ${draft.g}, ${draft.b}, 0.15), rgba(${draft.r}, ${draft.g}, ${draft.b}, 0.8))`,
                }}
              />
            </div>

            <div>
              <Label className="text-[10px] text-muted-foreground mb-1.5 block">Preajustes</Label>
              <div className="grid grid-cols-10 gap-1">
                {PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      const c = hexToColor(hex);
                      setDraft((d) => ({ ...c, intensity: d.intensity }));
                    }}
                    className="aspect-square rounded border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDraft(DEFAULT_COLOR);
                  apply(null);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Quitar
              </Button>
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={() => {
                  apply(draft);
                  setOpen(false);
                }}
              >
                <Pipette className="h-3.5 w-3.5 mr-1.5" />
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface HSV { r: number; g: number; b: number }
function hsvToRgb(s: number, h: number, v: number): HSV & { h2rgb: HSV } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const out = { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  return { ...out, h2rgb: out };
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}
