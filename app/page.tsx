import Link from "next/link";

function Pill({ text }: { text: string }) {
  return (
    <span className="badge">
      <span className="badge-dot" />
      {text}
    </span>
  );
}

function Feature({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="glass-soft" style={{ padding: 16 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
      <div className="small" style={{ marginTop: 8, lineHeight: 1.6 }}>
        {desc}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="container">
      {/* Top brand bar (same feel as SiteShell but focused for landing) */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(124,58,237,1), rgba(34,197,94,0.9))",
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
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin" className="btn btn-primary">Masuk Admin</Link>
          <Link href="/siswa" className="btn">Masuk Siswa</Link>
        </div>
      </div>

      {/* Hero */}
      <div
        className="glass"
        style={{
          marginTop: 16,
          padding: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -140,
            background:
              "radial-gradient(760px 420px at 22% 25%, rgba(124,58,237,0.32), transparent 62%), radial-gradient(860px 480px at 85% 20%, rgba(34,197,94,0.22), transparent 62%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill text="TrustNFT-gated" />
            <Pill text="Allowlist Admin" />
            <Pill text="Time-lock Deposit" />
            <Pill text="Base Sepolia" />
          </div>

          <h1 className="h1" style={{ marginTop: 14 }}>
            Laboratorium DeFi Madrasah
            <br />
            untuk simulasi ta’awun & qard hasan
          </h1>

          <p className="p" style={{ maxWidth: 900 }}>
            MadrasahDeFi adalah prototype pembelajaran & riset blockchain di madrasah: verifikasi anggota (siswa) berbasis TrustNFT,
            kontrol akses via allowlist, serta simulasi peminjaman qard hasan yang ditopang smart contract
            (dengan mekanisme lock dana untuk transparansi & akuntabilitas).
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
            <Link href="/siswa" className="btn btn-green">Mulai dari Siswa →</Link>
            <Link href="/admin" className="btn btn-primary">Buka Admin Page →</Link>
          </div>

          <div className="glass-soft" style={{ padding: 14, marginTop: 16 }}>
            <div className="small">
              Catatan demo: bila siswa belum memiliki TrustNFT, transaksi borrow akan revert (“No TrustNFT”), gate verifikasi berjalan via on-chain.
            </div>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid2" style={{ marginTop: 16 }}>
        <Feature
          title="1) Identity & Membership (TrustNFT)"
          desc="Anggota terverifikasi via TrustNFT. Tanpa TrustNFT, akses ke fungsi tertentu (mis. borrow) akan ditolak oleh smart contract."
        />
        <Feature
          title="2) Admin Gate (Allowlist)"
          desc="Admin menetapkan siapa yang boleh mengakses fitur (mint TrustNFT / borrow). Untuk skenario madrasah: seleksi peserta & validasi."
        />
        <Feature
          title="3) Dana Sosial Terkunci (Time-lock)"
          desc="Dana deposit dikunci hingga waktu tertentu (360 hari) pasca siswa menabung pertama kali. Admin tidak bisa menarik sebelum unlock. Unlock dana hanya bisa dilakukan oleh admin pasca 360 hari dengan persetujuan orang tua siswa"
        />
        <Feature
          title="4) Qard Hasan Simulation"
          desc="Siswa dapat meminjam (borrow) dan mengembalikan (repay) secara bertahap. Status pinjaman dibaca langsung dari on-chain."
        />
      </div>
<div className="glass-soft" style={{ padding: 16, marginTop: 16 }}>
  <div style={{ fontWeight: 950, marginBottom: 10 }}>On-chain Info: Base Sepolia</div>

  <div className="small" style={{ lineHeight: 1.8 }}>
    Chain ID: <code>84532</code>
    <br />
    Contract address IDRT: <code>0x8FAa0ddF2AAf59cc4F4B91923901048577fE7014</code>
    <br />
    Contract address TrustNFT: <code>0xA775852329ff269542018074897d4e36ce3C1c49</code>
    <br />
    Contract address QardPool: <code>0x7d534CaE5443140D9Ad26B6A23d7753FBfE3422b</code>
  </div>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
    <a className="btn" href="https://sepolia.basescan.org/address/0x8FAa0ddF2AAf59cc4F4B91923901048577fE7014" target="_blank" rel="noreferrer">
      Open IDRT
    </a>
    <a className="btn" href="https://sepolia.basescan.org/address/0xA775852329ff269542018074897d4e36ce3C1c49" target="_blank" rel="noreferrer">
      Open TrustNFT
    </a>
    <a className="btn" href="https://sepolia.basescan.org/address/0x7d534CaE5443140D9Ad26B6A23d7753FBfE3422b" target="_blank" rel="noreferrer">
      Open QardPool
    </a>
  </div>
</div>

      <div className="small" style={{ marginTop: 18, opacity: 0.85 }}>
        © MadrasahDeFi • Prototype lomba • Base Sepolia
      </div>
    </div>
  );
}
