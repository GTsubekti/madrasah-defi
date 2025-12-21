"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, zeroAddress, type Address } from "viem";
import { CONTRACTS, QARDPOOL_ABI, IDRT_ABI } from "@/lib/contracts";

function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [target, setTarget] = useState("");
  const [allowed, setAllowed] = useState(true);

  const { data: ownerAddr } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "owner",
    query: { enabled: true },
  });

  const isOwner =
    typeof ownerAddr === "string" &&
    typeof address === "string" &&
    ownerAddr.toLowerCase() === address.toLowerCase();

  const { data: liquidity } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "availableLiquidity",
    query: { enabled: true },
  });

  const { data: outstanding } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "totalOutstandingDebt",
    query: { enabled: true },
  });

  const { data: decimals } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });

  const { data: symbol } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "symbol",
    query: { enabled: true },
  });

  const dec = typeof decimals === "number" ? decimals : 0;
  const sym = (symbol as string) ?? "IDRT";
  const fmt = (v?: bigint) => (typeof v === "bigint" ? formatUnits(v, dec) : "-");

  const targetAddr = useMemo(() => {
    const t = target.trim();
    if (!t || !t.startsWith("0x") || t.length < 42) return zeroAddress as Address;
    return t as Address;
  }, [target]);

  const { data: targetAllowlisted } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "allowlisted",
    args: [targetAddr],
    query: { enabled: targetAddr !== (zeroAddress as Address) },
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const doSetAllowlist = () => {
    if (targetAddr === (zeroAddress as Address)) return;
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "setAllowlist",
      args: [targetAddr, allowed],
    });
  };

  return (
    <div className="grid2">
      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Pool Overview</div>
            <div className="small">Kondisi dana yang siap dipinjamkan & hutang berjalan.</div>
          </div>
          <span className={`badge ${isOwner ? "badge-ok" : "badge-bad"}`}>
            <span className="badge-dot" />
            {isOwner ? "OWNER VERIFIED" : "NOT OWNER"}
          </span>
        </div>

        <hr />

        <div className="row">
          <div className="k">Available Liquidity</div>
          <div className="v">
            {fmt(liquidity as any)} {sym}
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="k">Outstanding Debt</div>
          <div className="v">
            {fmt(outstanding as any)} {sym}
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Wallet: <code>{shortAddr(address)}</code> • Owner: <code>{shortAddr(ownerAddr as any)}</code>
            <br />
            QardPool: <code>{CONTRACTS.QardPool}</code>
          </div>
        </div>
      </section>

      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Allowlist Gate</div>
            <div className="small">Approve borrower sebelum boleh mint/borrow.</div>
          </div>
          <span className="badge badge-warn">
            <span className="badge-dot" />
            ACCESS CONTROL
          </span>
        </div>

        <hr />

        <div className="small" style={{ marginBottom: 6 }}>Borrower address</div>
        <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x..." />

        <div className="small" style={{ marginTop: 8 }}>
          Current allowlisted:{" "}
          <b>{targetAddr === (zeroAddress as Address) ? "-" : String(Boolean(targetAllowlisted))}</b>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <label className="small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
            Set Allowed = {allowed ? "true" : "false"}
          </label>

          <button
            className="btn btn-primary"
            onClick={doSetAllowlist}
            disabled={!isConnected || isPending || isConfirming || !isOwner}
            title={!isOwner ? "Hanya owner/admin yang bisa set allowlist" : ""}
          >
            {isPending || isConfirming ? "Processing..." : "Set Allowlist"}
          </button>
        </div>

        {!isOwner && (
          <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
            Switch wallet ke admin/deployer untuk allowlist.
          </div>
        )}

        {txHash && (
          <div className="small" style={{ marginTop: 10 }}>
            Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
          </div>
        )}
        {error && (
          <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
            {error.message}
          </div>
        )}

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Catatan demo: siswa yang belum allowlisted akan ditolak saat mencoba mint TrustNFT (di UI) dan/atau saat borrow (oleh kontrak).
          </div>
        </div>
      </section>
    </div>
  );
}
