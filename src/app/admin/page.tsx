import { AdminLogin } from "@/components/admin/login-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { getLibraryState, requireAdminUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminUser();

  if (!user) {
    return <AdminLogin />;
  }

  const state = await getLibraryState(true);
  return <AdminShell initialState={state} user={user} />;
}
