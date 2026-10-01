import { cookies } from "next/headers";
import { readSession } from "@/server/auth";
import { Nav } from "@/components/admin/Nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await readSession((await cookies()).get("offline_admin")?.value);
  return (
    <div className="min-h-screen bg-neutral-50">
      {s && <Nav />}
      <main className="mx-auto max-w-6xl p-4 md:p-8">{children}</main>
    </div>
  );
}
