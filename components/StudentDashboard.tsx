"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
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

function pickErrorMessage(err: any) {
  if (!err) return "";
  return err.shortMessage || err.details || err.message || String(err);
}

export default function StudentDashboard() {
  const { address, isConnected } = useAccount();
  const user = (address ?? zeroAddress) as Address;

  const [mintMethod, setMintMethod] = useState<"mint" | "mintMe" | "claim">("mintMe");
  const [borrowStr, setBorrowStr] = useState("10000");
  const [tenorMonths, setTenorMonths] = useState<number>(6);
  const [repayStr, setRepayStr] = useState("1000");

  // Token meta
  const { data: decimals } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "decimals",
  });

  const { data: symbol } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "symbol",
  });

  const dec = typeof decimals === "number" ? decimals : 0;
  const sym = (symbol as string) ?? "IDRT";
  const fmt = (v?: bigint) => (typeof v === "bigint" ? formatUnits(v, dec) : "-");

  // Wallet reads
  const { data: myBal } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected },
  });

  // Gates
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

  // Loan reads
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
      lastEvaluatedPeriod: Number(x[5]),
      isActive: Boolean(x[6]),
    };
  }, [loanRaw]);

  const remaining = loan
    ? loan.principal > loan.paidSoFar
      ? loan.principal - loan.paidSoFar
      : 0n
    : 0n;

  // Repay allowance
  const { data: allowance } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "allowance",
    args: [user, CONTRACTS.QardPool as Address],
    query: { enabled: isConnected },
  });

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

  const needsApprove = typeof allowance === "bigint" ? allowance < repayAmount : true;

  // Single write hook
  const [lastAction, setLastAction] = useState<
    "mint" | "borrow" | "approve" | "repay" | "evaluate" | null
  >(null);

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const actionError = pickErrorMessage(error);

  const mintError = lastAction === "mint" ? actionError : "";
  const borrowError = lastAction === "borrow" ? actionError : "";
  const repayError = lastAction === "repay" ? actionError : "";
  const approveError = lastAction === "approve" ? actionError : "";

  const busy = isPending || isConfirming;

  const doMintTrust = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    if (!isAllowlisted)
      return alert("Belum allowlisted oleh admin. Mint TrustNFT ditolak (UX guard).");

    setLastAction("mint");
    writeContract({
      address: CONTRACTS.TrustNFT,
      abi: TRUSTNFT_MINT_ABI,
      functionName: mintMethod,
      args: [],
    });
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

  const doApprove = () => {
    if (!isConnected) return alert("Connect wallet dulu.");
    setLastAction("approve");
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

  return (
    <div className="grid2">
      {/* LEFT: Identity Gate */}
      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Identity Gate</div>
            <div className="small">Allowlist + TrustNFT wajib sebelum akses penuh.</div>
          </div>

          <span className={`badge ${isAllowlisted ? "badge-ok" : "badge-warn"}`}>
            <span className="badge-dot" />
            {isAllowlisted ? "ALLOWLISTED" : "WAITING APPROVAL"}
          </span>
        </div>

        <hr />

        <div className="row">
          <div className="k">Wallet</div>
          <div className="v">{isConnected ? shortAddr(address) : "-"}</div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="k">TrustNFT</div>
          <div className="v">
            {hasTrust ? "✅ Has TrustNFT" : "❌ No TrustNFT"}{" "}
            <span className="small" style={{ marginLeft: 8 }}>
              (balance: {typeof trustBal === "bigint" ? trustBal.toString() : "-"})
            </span>
          </div>
        </div>

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Mint TrustNFT</div>

          <div style={{ display: "grid", gap: 10 }}>
            <div className="small">
              Pilih method (sementara) karena ABI mint final belum kita kunci.
            </div>

            <select className="input" value={mintMethod} onChange={(e) => setMintMethod(e.target.value as any)}>
              <option value="mint">mint()</option>
              <option value="mintMe">mintMe()</option>
              <option value="claim">claim()</option>
            </select>

            <button className="btn btn-primary" onClick={doMintTrust} disabled={busy}>
              {busy && lastAction === "mint" ? "Processing..." : "Mint TrustNFT"}
            </button>

            {lastAction === "mint" && txHash && (
              <div className="small">
                Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
              </div>
            )}

            {mintError && (
              <div className="small" style={{ color: "rgba(239,68,68,0.95)" }}>
                Mint failed: {mintError}
              </div>
            )}

            <div className="small">
              UX guard: tombol hanya “jalan” jika allowlisted. Borrow akan ditolak on-chain jika “No TrustNFT”.
            </div>
          </div>
        </div>
      </section>

      {/* RIGHT: Wallet & Loan */}
      <section className="glass" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Wallet & Loan</div>
            <div className="small">Borrow Qard, lalu repay secara bertahap.</div>
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
            {fmt(myBal as any)} {sym}
          </div>
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div className="k">Allowance → Pool</div>
          <div className="v">
            {fmt(allowance as any)} {sym}
          </div>
        </div>

        <hr />

        <div className="glass-soft" style={{ padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Borrow</div>

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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn btn-green" onClick={doBorrow} disabled={busy}>
              {busy && lastAction === "borrow" ? "Processing..." : "Borrow"}
            </button>
          </div>

          {borrowError && (
            <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
              Borrow failed: {borrowError}
            </div>
          )}
        </div>

        <div className="glass-soft" style={{ padding: 12, marginTop: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 8 }}>Repay</div>

          <div className="small" style={{ marginBottom: 6 }}>
            Amount ({sym})
          </div>
          <input className="input" value={repayStr} onChange={(e) => setRepayStr(e.target.value)} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            {needsApprove && (
              <button className="btn btn-primary" onClick={doApprove} disabled={busy}>
                {busy && lastAction === "approve" ? "Processing..." : `Approve ${sym}`}
              </button>
            )}

            <button className="btn" onClick={doRepay} disabled={busy}>
              {busy && lastAction === "repay" ? "Processing..." : "Repay"}
            </button>

            <button className="btn" onClick={doEvaluate} disabled={busy}>
              {busy && lastAction === "evaluate" ? "Processing..." : "Evaluate My Loan"}
            </button>
          </div>

          {approveError && (
            <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
              Approve failed: {approveError}
            </div>
          )}

          {repayError && (
            <div className="small" style={{ color: "rgba(239,68,68,0.95)", marginTop: 10 }}>
              Repay failed: {repayError}
            </div>
          )}
        </div>

        <hr />

        <div style={{ fontWeight: 950, marginBottom: 8 }}>Loan Status</div>

        {!loan ? (
          <div className="small">Connect wallet untuk lihat loanOf().</div>
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
      </section>
    </div>
  );
}
