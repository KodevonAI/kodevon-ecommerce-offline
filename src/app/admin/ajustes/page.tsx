import { getDb } from "@/db/client";
import { requireAdmin } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { PasswordForm, SettingsForm } from "./forms";

export default async function AjustesPage() {
  await requireAdmin();
  const s = await getSettings(getDb());
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Ajustes</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <SettingsForm {...s} />
        <PasswordForm />
      </div>
    </div>
  );
}
