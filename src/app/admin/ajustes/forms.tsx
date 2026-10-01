"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword, saveSettings } from "./actions";

type Result = { error?: string; ok?: string } | undefined;
type Props = { whatsappNumber: string; storeName: string; lowStockThreshold: number };

function Msg({ state }: { state: Result }) {
  return (
    <p role={state?.error ? "alert" : "status"} className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-green-700"}`}>
      {state?.error ?? state?.ok}
    </p>
  );
}

export function SettingsForm(props: Props) {
  const [state, action, pending] = useActionState<Result, FormData>(saveSettings, undefined);
  return (
    <Card>
      <CardHeader><CardTitle>Tienda</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsappNumber">Número de WhatsApp</Label>
            <Input id="whatsappNumber" name="whatsappNumber" defaultValue={props.whatsappNumber} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeName">Nombre de la tienda</Label>
            <Input id="storeName" name="storeName" defaultValue={props.storeName} maxLength={40} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lowStockThreshold">Umbral de stock bajo</Label>
            <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} max={100} defaultValue={props.lowStockThreshold} required />
          </div>
          <Msg state={state} />
          <Button type="submit" disabled={pending}>{pending ? "Guardando..." : "Guardar"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<Result, FormData>(changePassword, undefined);
  return (
    <Card>
      <CardHeader><CardTitle>Cambiar contraseña</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input id="current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="next">Nueva contraseña (mínimo 10 caracteres)</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <Msg state={state} />
          <Button type="submit" disabled={pending}>{pending ? "Actualizando..." : "Actualizar contraseña"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
