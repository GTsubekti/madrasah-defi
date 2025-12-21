import SiteShell from "@/components/SiteShell";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <SiteShell
      title="Admin Page"
      subtitle="Kelola allowlist borrower dan pantau kondisi pool."
      rightHint={
        <span className="badge badge-ok">
          <span className="badge-dot" />
          Admin
        </span>
      }
    >
      <AdminDashboard />
    </SiteShell>
  );
}
