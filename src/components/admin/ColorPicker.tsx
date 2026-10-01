"use client";
import { useEffect, useState } from "react";
import { isHexColor, nearestColorName } from "@/lib/colors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };

export function ColorPicker({ colorName, colorHex, onChange, formId }: {
  colorName: string;
  colorHex: string;
  onChange: (v: { colorName: string; colorHex: string }) => void;
  /** id del formulario del editor, para que la validación nativa (required) cubra el nombre. */
  formId?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [nameTouched, setNameTouched] = useState(colorName !== "");
  useEffect(() => { setSupported("EyeDropper" in window); }, []);

  function setHex(hex: string) {
    const h = hex.toLowerCase();
    onChange({ colorHex: h, colorName: nameTouched ? colorName : nearestColorName(h) });
  }
  async function pick() {
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const r = await new Ctor().open();
      setHex(r.sRGBHex);
    } catch { /* el usuario canceló */ }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="colorHex">Color</Label>
          <input id="colorHex" type="color" value={colorHex} onChange={(e) => setHex(e.target.value)}
            className="h-12 w-16 cursor-pointer rounded border border-neutral-300 bg-transparent p-1" />
        </div>
        {supported && <Button type="button" variant="outline" className="h-12" onClick={pick}>Gotero</Button>}
        <div className="min-w-40 flex-1 space-y-2">
          <Label htmlFor="colorName">Nombre del color</Label>
          <Input id="colorName" value={colorName} maxLength={40} required form={formId} className="h-12"
            placeholder={isHexColor(colorHex) ? nearestColorName(colorHex) : ""}
            onChange={(e) => {
              // Si se borra el nombre, vuelve a proponerse solo al elegir otro color.
              setNameTouched(e.target.value !== "");
              onChange({ colorHex, colorName: e.target.value });
            }} />
        </div>
        <div className="size-12 shrink-0 rounded-full border border-neutral-300" style={{ backgroundColor: colorHex }} aria-hidden />
      </div>
      <p className="text-xs text-neutral-500">
        Elige el color{supported ? " o usa el gotero para tomarlo de cualquier parte de la pantalla" : ""}. El nombre se propone solo; puedes editarlo.
      </p>
    </div>
  );
}
