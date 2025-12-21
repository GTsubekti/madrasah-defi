"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, type Address, zeroAddress } from "viem";
import {
  CONTRACTS,
  IDRT_ABI,
  TRUSTNFT_ABI,
  TRUSTNFT_MINT_ABI,
  QARDPOOL_ABI,
} from "@/lib/contracts";

function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function pickErr(err: any) {
  if (!err) return "";
  return err.shortMessage || err.details || err.message || String(err);
}

function toWIBFromUnix(unixSec?: bigint) {
  if (typeof unixSec !== "bigint") return "-";
  const ms = Number(unixSec) * 1000;
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

/** =====================
 * Withdraw Request (UI-only) for demo workflow:
 * Siswa -> ajukan withdraw (localStorage)
 * Admin -> approve/reject + optional execute on-chain (adminWithdrawFor)
 * ===================== */
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

function loadRequests(): WithdrawRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WithdrawRequest[]) : [];
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

export default function StudentDashboard() {
  const { address, isConnected, chainId } = useAccount();
  const user = (address ?? zeroAddress) as Address;

  // ===== Token meta
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

  // ===== Identity gate
  const { data: allowlisted } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "allowlisted",
    args: [user],
    query: { enabled: isConnected },
  });

  const { data: trustBal } = useReadContract({
    address: CONTRACTS.TrustNFT,
    abi: TRUSTNFT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected },
  });

  const isAllowlisted = Boolean(allowlisted);
  const hasTrust = typeof trustBal === "bigint" ? trustBal > 0n : false;

  // ===== Balances / allowance
  const { data: idrtBal } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected },
  });

  const { data: allowanceToPool } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "allowance",
    args: [user, CONTRACTS.QardPool as Address],
    query: { enabled: isConnected },
  });

  // ===== Savings / lock reads (QardPool)
  const { data: myDeposit } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "depositOf",
    args: [user],
    query: { enabled: isConnected },
  });

  const { data: totalDeposits } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "totalDeposits",
    query: { enabled: true },
  });

  const { data: availableLiquidity } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "availableLiquidity",
    query: { enabled: true },
  });

  const { data: lockedUntil } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "lockedUntil",
    args: [user],
    query: { enabled: isConnected },
  });

  const isLocked = useMemo(() => {
    if (typeof lockedUntil !== "bigint") return true;
    const now = BigInt(Math.floor(Date.now() / 1000));
    return now < lockedUntil;
  }, [lockedUntil]);

  // ===== Loan reads
  const { data: hasActiveLoan } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "hasActiveLoan",
    args: [user],
    query: { enabled: isConnected },
  });

  const { data: loanRaw } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "loanOf",
    args: [user],
    query: { enabled: isConnected },
  });

  const loan = useMemo(() => {
    if (!loanRaw) return null;
    const x: any = loanRaw;
    return {
      principal: x[0] as bigint,
      paidSoFar: x[1] as bigint,
      tenorMonths: Number(x[3]),
      latePeriods: Number(x[4]),
      isActive: Boolean(x[6]),
    };
  }, [loanRaw]);

  const remaining = loan
    ? loan.principal > loan.paidSoFar
      ? loan.principal - loan.paidSoFar
      : 0n
    : 0n;

  // ===== UI states
  const [mintMethod, setMintMethod] = useState<"mint" | "mintMe" | "claim">("mint");
  const [depositStr, setDepositStr] = useState("200000");
  const [withdrawStr, setWithdrawStr] = useState("10000");
  const [borrowStr, setBorrowStr] = useState("10000");
  const [tenorMonths, setTenorMonths] = useState<number>(6);
  const [repayStr, setRepayStr] = useState("1000");

  // UI-only withdraw request list
  const [myRequests, setMyRequests] = useState<WithdrawRequest[]>([]);

  useEffect(() => {
    if (!address) {
      setMyRequests([]);
      return;
    }
    const all = loadRequests();
    const mine = all.filter(
      (r) => (r.student || "").toLowerCase() === address.toLowerCase()
    );
    setMyRequests(mine.sort((a, b) => b.createdAt - a.createdAt));
  }, [address]);

  const depositAmount = useMemo(() => {
    try {
      return parseUnits(depositStr || "0", dec);
    } catch {
      return 0n;
    }
  }, [depositStr, dec]);

  const borrowAmount = useMemo(() => {
    try {
      return parseUnits(borrowStr || "0", dec);
    } catch {
      return 0n;
    }
  }, [borrowStr, dec]);

  const repayAmount = useMemo(() => {
    try {
      return parseUnits(repayStr || "0", dec);
    } catch {
      return 0n;
    }
  }, [repayStr, dec]);

  // ===== Writes
  const [lastAction, setLastAction] = useState<
    | "mint"
    | "approveDeposit"
    | "deposit"
    | "approveRepay"
    | "repay"
    | "borrow"
    | "evaluate"
    | null
  >(null);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const busy = isPending || isConfirming;
  const errMsg = pickErr(error);

  // For deposit/repay allowances: we reuse allowanceToPool.
  const needsApproveForDeposit =
    typeof allowanceToPool === "bigint" ? allowanceToPool < depositAmount : true;

  const needsApproveForRepay =
    typeof allowanceToPool === "bigint" ? allowanceToPool < repayAmount : true;

  const doMint = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    if (!isAllowlisted) return alert("Belum allowlisted oleh admin (UX guard).");
    setLastAction("mint");
    writeContract({
      address: CONTRACTS.TrustNFT,
      abi: TRUSTNFT_MINT_ABI,
      functionName: mintMethod,
      args: [],
    });
  };

  const doApproveDeposit = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("approveDeposit");
    writeContract({
      address: CONTRACTS.IDRT,
      abi: IDRT_ABI,
      functionName: "approve",
      args: [CONTRACTS.QardPool as Address, depositAmount],
    });
  };

  const doDeposit = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("deposit");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "deposit",
      args: [depositAmount],
    });
  };

  // ===== Withdraw request (UI-only)
  const doWithdrawRequest = () => {
    if (!isConnected || !address) return alert("Connect wallet dulu.");

    const amt = (withdrawStr || "").trim();
    if (!amt || Number(amt) <= 0) return alert("Jumlah withdraw tidak valid.");

    const lockText =
      typeof lockedUntil === "bigint"
        ? toWIBFromUnix(lockedUntil)
        : "belum terbaca";

    const req: WithdrawRequest = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      student: address,
      amount: amt,
      symbol: sym,
      createdAt: Date.now(),
      status: "PENDING",
      note: `Locked until: ${lockText} (WIB)`,
    };

    const all = loadRequests();
    all.unshift(req);
    saveRequests(all);

    const mine = all.filter(
      (r) => (r.student || "").toLowerCase() === address.toLowerCase()
    );
    setMyRequests(mine.sort((a, b) => b.createdAt - a.createdAt));

    alert(
      `Pengajuan withdraw berhasil dikirim.\nAdmin akan approve/reject.\n\nCatatan: eksekusi on-chain dilakukan admin (adminWithdrawFor) dan akan ditolak jika masih locked.`
    );
  };

  const doBorrow = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("borrow");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "borrow",
      args: [borrowAmount, tenorMonths],
    });
  };

  const doApproveRepay = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("approveRepay");
    writeContract({
      address: CONTRACTS.IDRT,
      abi: IDRT_ABI,
      functionName: "approve",
      args: [CONTRACTS.QardPool as Address, repayAmount],
    });
  };

  const doRepay = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("repay");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "repay",
      args: [repayAmount],
    });
  };

  const doEvaluate = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("evaluate");
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "evaluateMyLoan",
      args: [],
    });
  };

  const showTx = txHash && lastAction;
  const showError = errMsg && lastAction;

  return (
    <div className="grid1">
      {/* ===== Header ===== */}
      <section className="glass" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Siswa</div>
            <div className="small" style={{ opacity: 0.9 }}>
              Simulasi tabungan ta’awun & qard hasan berbasis TrustNFT (Base Sepolia).
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span className={`badge ${isAllowlisted ? "badge-ok" : "badge-warn"}`}>
              <span className="badge-dot" />
              {isAllowlisted ? "ALLOWLISTED" : "WAITING APPROVAL"}
            </span>
            <span className={`badge ${hasTrust ? "badge-ok" : "badge-warn"}`}>
              <span className="badge-dot" />
              {hasTrust ? "HAS TRUSTNFT" : "NO TRUSTNFT"}
            </span>
          </div>
        </div>

        <hr />

        <div className="row">
          <div className="k">Wallet</div>
          <div className="v">{isConnected ? <code>{shortAddr(address)}</code> : "-"}</div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="k">IDRT Balance</div>
          <div className="v">
            {fmt(idrtBal as any)} {sym}
          </div>
        </div>
      </section>

      {/* ===== Savings (FULL WIDTH) ===== */}
      <section className="glass" style={{ padding: 16, marginTop: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Tabungan Ta’awun</div>
            <div className="small">
              Deposit untuk “dana bersama”. Penarikan dilakukan melalui pengajuan ke admin; eksekusi on-chain hanya admin dan tetap tunduk pada time-lock.
            </div>
          </div>

          <span className={`badge ${isLocked ? "badge-warn" : "badge-ok"}`}>
            <span className="badge-dot" />
            {isLocked ? "LOCKED" : "UNLOCKED"}
          </span>
        </div>

        <hr />

        <div className="grid2">
          <div className="glass-soft" style={{ padding: 12 }}>
            <div className="row">
              <div className="k">Saldo Tabungan Saya</div>
              <div className="v">
                {fmt(myDeposit as any)} {sym}
              </div>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <div className="k">Terkunci sampai</div>
              <div className="v">
                <b>{toWIBFromUnix(lockedUntil as any)}</b>
              </div>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <div className="k">Pool Total Deposits</div>
              <div className="v">
                {fmt(totalDeposits as any)} {sym}
              </div>
            </div>

            <div className="row" style={{ marginTop: 10 }}>
              <div className="k">Pool Available Liquidity</div>
              <div className="v">
                {fmt(availableLiquidity as any)} {sym}
              </div>
            </div>

            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Demo: siswa mengajukan withdraw → admin approve → admin coba eksekusi → kontrak menolak jika masih locked.
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Deposit</div>
            <div className="small" style={{ marginBottom: 6 }}>
              Jumlah ({sym})
            </div>
            <input
              className="input"
              value={depositStr}
              onChange={(e) => setDepositStr(e.target.value)}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {needsApproveForDeposit && (
                <button
                  className="btn btn-primary"
                  onClick={doApproveDeposit}
                  disabled={busy}
                >
                  {busy && lastAction === "approveDeposit"
                    ? "Processing..."
                    : `Approve ${sym}`}
                </button>
              )}
              <button className="btn btn-green" onClick={doDeposit} disabled={busy}>
                {busy && lastAction === "deposit" ? "Processing..." : "Deposit"}
              </button>
            </div>

            {showTx && (lastAction === "approveDeposit" || lastAction === "deposit") && (
              <div className="small" style={{ marginTop: 10 }}>
                Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
              </div>
            )}

            {showError && (lastAction === "approveDeposit" || lastAction === "deposit") && (
              <div className="small" style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>
                {errMsg}
              </div>
            )}

            <hr style={{ margin: "14px 0" }} />

            <div style={{ fontWeight: 900, marginBottom: 8 }}>Withdraw</div>
            <div className="small" style={{ marginBottom: 6 }}>
              Jumlah ({sym})
            </div>
            <input
              className="input"
              value={withdrawStr}
              onChange={(e) => setWithdrawStr(e.target.value)}
            />

            <button className="btn" style={{ marginTop: 10 }} onClick={doWithdrawRequest}>
              Ajukan Withdraw
            </button>

            <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
              Pengajuan ini tersimpan untuk admin. Eksekusi on-chain dilakukan admin via <code>adminWithdrawFor</code>.
            </div>

            {myRequests.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Riwayat Pengajuan</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {myRequests.slice(0, 4).map((r) => (
                    <div key={r.id} className="glass-soft" style={{ padding: 10 }}>
                      <div className="row">
                        <div className="k">Amount</div>
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
                      <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                        {fmtDateWIB(r.createdAt)} • {r.note ?? ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== Lower grid ===== */}
      <div className="grid2" style={{ marginTop: 16 }}>
        {/* ===== Identity / Mint ===== */}
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
              <div style={{ fontWeight: 950, fontSize: 18 }}>Identity Gate</div>
              <div className="small">
                Allowlist + TrustNFT wajib sebelum akses penuh.
              </div>
            </div>
            <span className={`badge ${isAllowlisted ? "badge-ok" : "badge-warn"}`}>
              <span className="badge-dot" />
              {isAllowlisted ? "ALLOWLISTED" : "WAITING APPROVAL"}
            </span>
          </div>

          <hr />

          <div className="row">
            <div className="k">Wallet</div>
            <div className="v">{isConnected ? <code>{shortAddr(address)}</code> : "-"}</div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div className="k">TrustNFT</div>
            <div className="v">
              {hasTrust ? "✅ Verified" : "❌ No TrustNFT"}{" "}
              <span className="small" style={{ opacity: 0.85 }}>
                (balance: {typeof trustBal === "bigint" ? trustBal.toString() : "-"})
              </span>
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Mint TrustNFT</div>
            <div className="small" style={{ marginBottom: 8 }}>
              Tombol hanya “jalan” jika allowlisted. Borrow akan ditolak kontrak jika belum punya TrustNFT.
            </div>

            <select
              className="input"
              value={mintMethod}
              onChange={(e) => setMintMethod(e.target.value as any)}
            >
              <option value="mint">mint()</option>
              <option value="mintMe">mintMe()</option>
              <option value="claim">claim()</option>
            </select>

            <button
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              onClick={doMint}
              disabled={busy}
            >
              {busy && lastAction === "mint" ? "Processing..." : "Mint TrustNFT"}
            </button>

            {showTx && lastAction === "mint" && (
              <div className="small" style={{ marginTop: 10 }}>
                Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
              </div>
            )}

            {showError && lastAction === "mint" && (
              <div className="small" style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>
                {errMsg}
              </div>
            )}
          </div>
        </section>

        {/* ===== Borrow / Repay ===== */}
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
              <div style={{ fontWeight: 950, fontSize: 18 }}>Wallet & Loan</div>
              <div className="small">Borrow qard, lalu repay bertahap.</div>
            </div>
            <span className={`badge ${Boolean(hasActiveLoan) ? "badge-warn" : "badge-ok"}`}>
              <span className="badge-dot" />
              {Boolean(hasActiveLoan) ? "ACTIVE LOAN" : "NO ACTIVE LOAN"}
            </span>
          </div>

          <hr />

          <div className="row">
            <div className="k">IDRT Balance</div>
            <div className="v">
              {fmt(idrtBal as any)} {sym}
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div className="k">Allowance → Pool</div>
            <div className="v">
              {fmt(allowanceToPool as any)} {sym}
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Borrow</div>
            <div className="small" style={{ marginBottom: 6 }}>
              Amount ({sym})
            </div>
            <input className="input" value={borrowStr} onChange={(e) => setBorrowStr(e.target.value)} />

            <div className="small" style={{ marginTop: 10, marginBottom: 6 }}>
              Tenor (months)
            </div>
            <input
              className="input"
              type="number"
              min={1}
              max={12}
              value={tenorMonths}
              onChange={(e) => setTenorMonths(Number(e.target.value))}
            />

            <button className="btn btn-green" style={{ marginTop: 10 }} onClick={doBorrow} disabled={busy}>
              {busy && lastAction === "borrow" ? "Processing..." : "Borrow"}
            </button>

            {showTx && lastAction === "borrow" && (
              <div className="small" style={{ marginTop: 10 }}>
                Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
              </div>
            )}
            {showError && lastAction === "borrow" && (
              <div className="small" style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>
                {errMsg}
              </div>
            )}
          </div>

          <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Repay</div>
            <div className="small" style={{ marginBottom: 6 }}>
              Amount ({sym})
            </div>
            <input className="input" value={repayStr} onChange={(e) => setRepayStr(e.target.value)} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              {needsApproveForRepay && (
                <button className="btn btn-primary" onClick={doApproveRepay} disabled={busy}>
                  {busy && lastAction === "approveRepay" ? "Processing..." : `Approve ${sym}`}
                </button>
              )}
              <button className="btn" onClick={doRepay} disabled={busy}>
                {busy && lastAction === "repay" ? "Processing..." : "Repay"}
              </button>
              <button className="btn" onClick={doEvaluate} disabled={busy}>
                {busy && lastAction === "evaluate" ? "Processing..." : "Evaluate My Loan"}
              </button>
            </div>

            {showTx && (lastAction === "approveRepay" || lastAction === "repay" || lastAction === "evaluate") && (
              <div className="small" style={{ marginTop: 10 }}>
                Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
              </div>
            )}
            {showError && (lastAction === "approveRepay" || lastAction === "repay" || lastAction === "evaluate") && (
              <div className="small" style={{ marginTop: 10, color: "rgba(239,68,68,0.95)" }}>
                {errMsg}
              </div>
            )}
          </div>

          <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Loan Status</div>
            {!loan ? (
              <div className="small">Connect wallet untuk lihat status pinjaman.</div>
            ) : (
              <>
                <div className="row">
                  <div className="k">Principal</div>
                  <div className="v">
                    {formatUnits(loan.principal, dec)} {sym}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div className="k">Paid</div>
                  <div className="v">
                    {formatUnits(loan.paidSoFar, dec)} {sym}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div className="k">Remaining</div>
                  <div className="v">
                    {formatUnits(remaining, dec)} {sym}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div className="k">Tenor / Late / Active</div>
                  <div className="v">
                    {loan.tenorMonths} mo • late {loan.latePeriods} • active {String(loan.isActive)}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="small" style={{ marginTop: 12, opacity: 0.75 }}>
            Network: {chainId ?? "-"} • QardPool: <code>{shortAddr(CONTRACTS.QardPool)}</code>
          </div>
        </section>
      </div>
    </div>
  );
}
