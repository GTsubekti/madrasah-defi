import SiteShell from "@/components/SiteShell";
import StudentDashboard from "@/components/StudentDashboard";

export default function SiswaPage() {
  return (
    <SiteShell
      title="Siswa Page"
      subtitle="Mint TrustNFT (jika allowlisted), kemudian akses simulasi qard hasan (borrow & repay)."
      rightHint={
        <span className="badge badge-warn">
          <span className="badge-dot" />
          Siswa
        </span>
      }
    >
      <StudentDashboard />
    </SiteShell>
  );
}
