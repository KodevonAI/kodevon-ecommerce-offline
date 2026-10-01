"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategory } from "./actions";

type Result = { error?: string; ok?: string } | undefined;

export function CategoryForm() {
  const [state, action, pending] = useActionState<Result, FormData>(createCategory, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="name">Nueva categoría</Label>
        <Input id="name" name="name" minLength={2} maxLength={50} required />
      </div>
      <p role={state?.error ? "alert" : "status"} className={`min-h-5 text-sm ${state?.error ? "text-red-600" : "text-green-700"}`}>
        {state?.error ?? state?.ok}
      </p>
      <Button type="submit" disabled={pending}>{pending ? "Creando..." : "Crear"}</Button>
    </form>
  );
}
