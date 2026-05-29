import Link from "next/link";
import { isCmsDisabled } from "@/lib/cloudflare-mode";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (isCmsDisabled()) {
    return (
      <main className="admin-shell">
        <section className="admin-panel" style={{ maxWidth: "42rem", margin: "12vh auto" }}>
          <div className="admin-panel-header">
            <strong>CMS unavailable on Cloudflare Workers</strong>
          </div>
          <div className="admin-panel-body stack">
            <p>
              This deployment serves the public travel journal with bundled demo assets. The CMS uses local SQLite,
              filesystem uploads, and image processing, so it needs a Node server with persistent disk or a D1/R2-backed
              Cloudflare implementation.
            </p>
            <Link className="ghost-button" href="/">
              Back to journal
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [{ AdminLogin }, { AdminShell }, { getLibraryState, requireAdminUser }] = await Promise.all([
    import("@/components/admin/login-form"),
    import("@/components/admin/admin-shell"),
    import("@/lib/db")
  ]);

  const user = await requireAdminUser();

  if (!user) {
    return <AdminLogin />;
  }

  const state = await getLibraryState(true);
  return <AdminShell initialState={state} user={user} />;
}
