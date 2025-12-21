"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, zeroAddress, type Address } from "viem";
import { CONTRACTS, QARDPOOL_ABI, IDRT_ABI } from "@/lib/contracts";

/* ================== helpers ================== */
function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/* ===== Withdraw Request (shared with StudentDashboard) ===== */
type WithdrawRequest = {
  id: string;
  student: string;
  amount: string;
  symbol: string;
  createdAt: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note?: string;
};

const REQ_KEY = "madrasahdefi_withdraw_requests_v1";
const LOCK_UNTIL_WIB_TEXT = "15 Des 2026 (WIB)";

function loadRequests(): WithdrawRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WithdrawRequest[];
  } catch {
    return [];
  }
}

function saveRequests(reqs: WithdrawRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQ_KEY, JSON.stringify(reqs));
}

function fmtDateWIB(ms: number) {
  try {
    return new Date(ms).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

/* ================== component ================== */
export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [target, setTarget] = useState("");
  const [allowed, setAllowed] = useState(true);

  /* ---------- owner check ---------- */
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

  /* ---------- pool stats ---------- */
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
  const fmt = (v?: bigint) =>
    typeof v === "bigint" ? formatUnits(v, dec) : "-";

  /* ---------- allowlist ---------- */
  const targetAddr = useMemo(() => {
    const t = target.trim();
    if (!t || !t.startsWith("0x") || t.length < 42)
      return zeroAddress as Address;
    return t as Address;
  }, [target]);

  const { data: targetAllowlisted } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "allowlisted",
    args: [targetAddr],
    query: { enabled: targetAddr !== (zeroAddress as Address) },
  });

  const { writeContract, data: txHash, isPending, error } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const doSetAllowlist = () => {
    if (targetAddr === (zeroAddress as Address)) return;
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "setAllowlist",
      args: [targetAddr, allowed],
    });
  };

  /* ---------- withdraw requests (UI-only) ---------- */
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    setRequests(loadRequests().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const updateReqStatus = (
    id: string,
    status: "APPROVED" | "REJECTED"
  ) => {
    const next = requests.map((r) =>
      r.id === id ? { ...r, status } : r
    );
    setRequests(next);
    saveRequests(next);

    alert(
      status === "APPROVED"
        ? `Withdraw disetujui secara administratif.\n\nCatatan: eksekusi tetap ditolak oleh smart contract sampai ${LOCK_UNTIL_WIB_TEXT}.`
        : "Withdraw ditolak secara administratif."
    );
  };

  /* ================== UI ================== */
  return (
    <div className="grid2">
      {/* ================= Pool Overview ================= */}
      <section className="glass" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              Pool Overview
            </div>
            <div className="small">
              Kondisi dana ta’awun dan pinjaman berjalan.
            </div>
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
            Wallet: <code>{shortAddr(address)}</code> • Owner:{" "}
            <code>{shortAddr(ownerAddr as any)}</code>
            <br />
            QardPool: <code>{CONTRACTS.QardPool}</code>
          </div>
        </div>
      </section>

      {/* ================= Allowlist Gate ================= */}
      <section className="glass" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>
              Allowlist Gate
            </div>
            <div className="small">
              Persetujuan akses siswa sebelum berpartisipasi.
            </div>
          </div>

          <span className="badge badge-warn">
            <span className="badge-dot" />
            ACCESS CONTROL
          </span>
        </div>

        <hr />

        <div className="small" style={{ marginBottom: 6 }}>
          Borrower address
        </div>
        <input
          className="input"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0x..."
        />

        <div className="small" style={{ marginTop: 8 }}>
          Current allowlisted:{" "}
          <b>
            {targetAddr === (zeroAddress as Address)
              ? "-"
              : String(Boolean(targetAllowlisted))}
          </b>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          <label
            className="small"
            style={{ display: "flex", gap: 10, alignItems: "center" }}
          >
            <input
              type="checkbox"
              checked={allowed}
              onChange={(e) => setAllowed(e.target.checked)}
            />
            Set Allowed = {allowed ? "true" : "false"}
          </label>

          <button
            className="btn btn-primary"
            onClick={doSetAllowlist}
            disabled={!isConnected || isPending || isConfirming || !isOwner}
            title={!isOwner ? "Hanya owner/admin" : ""}
          >
            {isPending || isConfirming
              ? "Processing..."
              : "Set Allowlist"}
          </button>
        </div>

        {!isOwner && (
          <div
            className="small"
            style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}
          >
            Switch wallet ke admin/deployer untuk allowlist.
          </div>
        )}

        {txHash && (
          <div className="small" style={{ marginTop: 10 }}>
            Tx: <code>{txHash}</code>{" "}
            {isSuccess ? "✅ Confirmed" : ""}
          </div>
        )}

        {error && (
          <div
            className="small"
            style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}
          >
            {error.message}
          </div>
        )}

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Catatan demo: allowlist mengontrol akses siswa sebelum
            berinteraksi dengan sistem.
          </div>
        </div>
      </section>

      {/* ================= Withdraw Requests ================= */}
      <section className="glass" style={{ padding: 16 }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>
            Pengajuan Withdraw Siswa
          </div>
          <div className="small">
            Persetujuan administratif (eksekusi tunduk time-lock).
          </div>
        </div>

        <hr />

        {requests.length === 0 ? (
          <div className="small">
            Belum ada pengajuan withdraw dari siswa.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {requests.map((r) => (
              <div key={r.id} className="glass-soft" style={{ padding: 12 }}>
                <div className="row">
                  <div className="k">Siswa</div>
                  <div className="v">
                    <code>{shortAddr(r.student)}</code>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 6 }}>
                  <div className="k">Jumlah</div>
                  <div className="v">
                    {r.amount} {r.symbol}
                  </div>
                </div>

                <div className="row" style={{ marginTop: 6 }}>
                  <div className="k">Status</div>
                  <div className="v">
                    <span
                      className={`badge ${
                        r.status === "APPROVED"
                          ? "badge-ok"
                          : r.status === "REJECTED"
                          ? "badge-warn"
                          : "badge"
                      }`}
                    >
                      <span className="badge-dot" />
                      {r.status}
                    </span>
                  </div>
                </div>

                <div
                  className="small"
                  style={{ marginTop: 6, opacity: 0.85 }}
                >
                  Diajukan: {fmtDateWIB(r.createdAt)} • Locked
                  until {LOCK_UNTIL_WIB_TEXT}
                </div>

                {r.status === "PENDING" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    <button
                      className="btn btn-green"
                      onClick={() =>
                        updateReqStatus(r.id, "APPROVED")
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        updateReqStatus(r.id, "REJECTED")
                      }
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Catatan: persetujuan admin tidak dapat mengesampingkan
            time-lock. Smart contract akan menolak withdraw sebelum{" "}
            <b>{LOCK_UNTIL_WIB_TEXT}</b>.
          </div>
        </div>
      </section>
    </div>
  );
}
