"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWallet from "@/components/ConnectWallet";

function NavLink({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href;
  return (
    <Link
      href={href}
      className="btn"
      style={{
        background: active ? "rgba(255,255,255,0.12)" : undefined,
        borderColor: active ? "rgba(124,58,237,0.55)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}

export default function SiteShell({
  title,
  subtitle,
  children,
  rightHint,
}: {
  title: string;
  subtitle: string;
  rightHint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="container">
      {/* Navbar */}
      <div
        className="glass"
        style={{
          padding: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(124,58,237,1), rgba(34,197,94,0.9))",
              boxShadow: "0 10px 30px rgba(124,58,237,0.25)",
            }}
          />
          <div>
            <div style={{ fontWeight: 950, letterSpacing: "-0.02em", fontSize: 18 }}>
              MadrasahDeFi
            </div>
            <div className="small">
              Laboratorium DeFi Madrasah untuk simulasi ta’awun dan qard hasan, berbasis TrustNFT, dibangun di Base Sepolia
            </div>
          </div>
        </Link>

       <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
  <NavLink href="/admin" label="Admin" />
  <NavLink href="/siswa" label="Siswa" />
  <ConnectWallet />
</div>
      </div>

      {/* Hero */}
      <div
        className="glass"
        style={{
          marginTop: 16,
          padding: 18,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -120,
            background:
              "radial-gradient(600px 350px at 25% 30%, rgba(124,58,237,0.25), transparent 60%), radial-gradient(700px 400px at 80% 20%, rgba(34,197,94,0.18), transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 className="h1">{title}</h1>
              <p className="p">{subtitle}</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {rightHint}
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12 }}>
            <div className="small">
              Demo note: seluruh gate (allowlist, TrustNFT, lock) ditegakkan oleh smart contract.
              UI hanya memudahkan presentasi & alur penggunaan.
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: 16 }}>{children}</div>

      <div className="small" style={{ marginTop: 18, opacity: 0.85 }}>
        © MadrasahDeFi • Prototype lomba • Base Sepolia
      </div>
    </div>
  );
}
