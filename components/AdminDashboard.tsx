"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { CONTRACTS, QARDPOOL_ABI, IDRT_ABI } from "@/lib/contracts";

/* ================== helpers ================== */
function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function pickErr(err: any) {
  if (!err) return "";
  return err.shortMessage || err.details || err.message || String(err);
}

/* ===== Withdraw Request (shared with StudentDashboard) ===== */
type WithdrawRequest = {
  id: string;
  student: string;
  amount: string; // human amount string (e.g. "10000")
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

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();

  /* ================= Owner check ================= */
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

  /* ================= Pool stats ================= */
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

  /* ================= Allowlist Gate ================= */
  const [target, setTarget] = useState("");
  const [allowed, setAllowed] = useState(true);

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

  /* ================= Withdraw Requests (UI-only) ================= */
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  useEffect(() => {
    setRequests(loadRequests().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  const selectedReq = useMemo(() => {
    if (!selectedReqId) return null;
    return requests.find((r) => r.id === selectedReqId) ?? null;
  }, [requests, selectedReqId]);

  const updateReqStatus = (id: string, status: "APPROVED" | "REJECTED") => {
    const next = requests.map((r) => (r.id === id ? { ...r, status } : r));
    setRequests(next);
    saveRequests(next);

    alert(
      status === "APPROVED"
        ? `Withdraw disetujui secara administratif.\n\nCatatan: eksekusi on-chain akan ditolak oleh smart contract sampai ${LOCK_UNTIL_WIB_TEXT} jika masih locked.`
        : "Withdraw ditolak secara administratif."
    );
  };

  const refreshRequests = () => {
    const next = loadRequests().sort((a, b) => b.createdAt - a.createdAt);
    setRequests(next);
    if (selectedReqId && !next.find((x) => x.id === selectedReqId)) {
      setSelectedReqId(null);
    }
  };

  /* ================= Writes ================= */
  const [lastAction, setLastAction] = useState<
    "allowlist" | "execWithdraw" | null
  >(null);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const busy = isPending || isConfirming;
  const errMsg = pickErr(error);

  const doSetAllowlist = () => {
    if (targetAddr === (zeroAddress as Address)) return;
    setLastAction("allowlist");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "setAllowlist",
      args: [targetAddr, allowed],
    });
  };

  // Execute withdraw on-chain using adminWithdrawFor(student, amountWei)
  const doExecuteWithdraw = (req: WithdrawRequest) => {
    if (!isConnected) return alert("Connect wallet admin dulu.");
    if (!isOwner) return alert("Hanya owner/admin yang bisa execute.");
    if (req.status !== "APPROVED") {
      return alert("Approve dulu secara administratif sebelum execute on-chain.");
    }
    if (!req.student || !req.student.startsWith("0x")) {
      return alert("Alamat siswa tidak valid.");
    }

    let amountWei = 0n;
    try {
      amountWei = parseUnits(req.amount || "0", dec);
    } catch {
      return alert("Jumlah withdraw tidak valid.");
    }

    setLastAction("execWithdraw");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "adminWithdrawFor",
      // signature paling umum:
      args: [req.student as Address, amountWei],
    });
  };

  /* ================== UI ================== */
  return (
    <div className="grid2">
      {/* ================= Pool Overview ================= */}
      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Pool Overview</div>
            <div className="small">Kondisi dana ta’awun dan pinjaman berjalan.</div>
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

      {/* ================= Allowlist Gate ================= */}
      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Allowlist Gate</div>
            <div className="small">Persetujuan akses siswa sebelum berpartisipasi.</div>
          </div>

          <span className="badge badge-warn">
            <span className="badge-dot" />
            ACCESS CONTROL
          </span>
        </div>

        <hr />

        <div className="small" style={{ marginBottom: 6 }}>Alamat wallet siswa</div>
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

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
          <label className="small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
            Set Allowed = {allowed ? "true" : "false"}
          </label>

          <button
            className="btn btn-primary"
            onClick={doSetAllowlist}
            disabled={!isConnected || busy || !isOwner}
            title={!isOwner ? "Hanya owner/admin" : ""}
          >
            {busy && lastAction === "allowlist" ? "Processing..." : "Set Allowlist"}
          </button>
        </div>

        {!isOwner && (
          <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
            Switch wallet ke admin/deployer untuk allowlist.
          </div>
        )}

        {txHash && lastAction === "allowlist" && (
          <div className="small" style={{ marginTop: 10 }}>
            Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
          </div>
        )}

        {errMsg && lastAction === "allowlist" && (
          <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
            {errMsg}
          </div>
        )}

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Catatan demo: allowlist mengontrol akses siswa sebelum mint TrustNFT / borrow.
          </div>
        </div>
      </section>

      {/* ================= Withdraw Requests (FULL WIDTH style via grid) ================= */}
      <section className="glass" style={{ padding: 16, gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Pengajuan Withdraw Siswa</div>
            <div className="small">
              Admin melakukan persetujuan administratif. Eksekusi on-chain menggunakan <code>adminWithdrawFor</code>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" onClick={refreshRequests}>
              Refresh
            </button>
            <span className="badge badge-warn">
              <span className="badge-dot" />
              TIME-LOCK ACTIVE
            </span>
          </div>
        </div>

        <hr />

        {requests.length === 0 ? (
          <div className="small">Belum ada pengajuan withdraw dari siswa.</div>
        ) : (
          <div className="grid2" style={{ alignItems: "start" }}>
            {/* List */}
            <div style={{ display: "grid", gap: 10 }}>
              {requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReqId(r.id)}
                  className="glass-soft"
                  style={{
                    padding: 12,
                    textAlign: "left",
                    cursor: "pointer",
                    border:
                      selectedReqId === r.id
                        ? "1px solid rgba(255,255,255,0.22)"
                        : "1px solid rgba(255,255,255,0.08)",
                    background:
                      selectedReqId === r.id
                        ? "rgba(255,255,255,0.08)"
                        : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>
                      {r.amount} {r.symbol}
                    </div>
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
                  <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                    <code>{shortAddr(r.student)}</code> • {fmtDateWIB(r.createdAt)}
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="glass-soft" style={{ padding: 14 }}>
              {!selectedReq ? (
                <div className="small">Pilih satu pengajuan untuk melihat detail.</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>Detail Pengajuan</div>
                      <div className="small" style={{ opacity: 0.9 }}>
                        Eksekusi akan revert jika masih locked sampai <b>{LOCK_UNTIL_WIB_TEXT}</b>.
                      </div>
                    </div>

                    <span
                      className={`badge ${
                        selectedReq.status === "APPROVED"
                          ? "badge-ok"
                          : selectedReq.status === "REJECTED"
                          ? "badge-warn"
                          : "badge"
                      }`}
                    >
                      <span className="badge-dot" />
                      {selectedReq.status}
                    </span>
                  </div>

                  <hr />

                  <div className="row">
                    <div className="k">Siswa</div>
                    <div className="v">
                      <code>{selectedReq.student}</code>
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="k">Jumlah</div>
                    <div className="v">
                      <b>
                        {selectedReq.amount} {selectedReq.symbol}
                      </b>
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="k">Diajukan</div>
                    <div className="v">{fmtDateWIB(selectedReq.createdAt)}</div>
                  </div>

                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="k">Catatan</div>
                    <div className="v">{selectedReq.note ?? "-"}</div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    {selectedReq.status === "PENDING" && (
                      <>
                        <button className="btn btn-green" onClick={() => updateReqStatus(selectedReq.id, "APPROVED")}>
                          Approve
                        </button>
                        <button className="btn" onClick={() => updateReqStatus(selectedReq.id, "REJECTED")}>
                          Reject
                        </button>
                      </>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={() => doExecuteWithdraw(selectedReq)}
                      disabled={!isConnected || busy || !isOwner}
                      title={!isOwner ? "Hanya owner/admin" : "Eksekusi on-chain (akan revert jika locked)"}
                    >
                      {busy && lastAction === "execWithdraw" ? "Processing..." : "Execute On-chain"}
                    </button>
                  </div>

                  {txHash && lastAction === "execWithdraw" && (
                    <div className="small" style={{ marginTop: 10 }}>
                      Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
                    </div>
                  )}

                  {errMsg && lastAction === "execWithdraw" && (
                    <div className="small" style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>
                      {errMsg}
                    </div>
                  )}

                  {!isOwner && (
                    <div className="small" style={{ marginTop: 12, color: "rgba(239,68,68,0.95)" }}>
                      Switch wallet ke admin/deployer untuk execute.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div className="small">
            Catatan: persetujuan admin tidak dapat mengesampingkan time-lock. Smart contract akan menolak withdraw sebelum{" "}
            <b>{LOCK_UNTIL_WIB_TEXT}</b>.
          </div>
        </div>
      </section>
    </div>
  );
}
