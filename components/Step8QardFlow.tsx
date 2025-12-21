"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, zeroAddress, type Address } from "viem";
import { CONTRACTS, IDRT_ABI, QARDPOOL_ABI } from "@/lib/contracts";

function shortAddr(a?: string) {
  if (!a) return "-";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function Step8QardFlow() {
  const { address, isConnected } = useAccount();
  const user = (address ?? zeroAddress) as Address;

  // ======================
  // STATE (inputs)
  // ======================
  const [borrowStr, setBorrowStr] = useState("10000");
  const [tenorMonths, setTenorMonths] = useState<number>(6);

  const [repayStr, setRepayStr] = useState("1000");

  // admin allowlist
  const [targetUser, setTargetUser] = useState<string>("");
  const [allowValue, setAllowValue] = useState<boolean>(true);

  // ======================
  // READS (token)
  // ======================
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

  const { data: myBalance } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected },
  });

  const { data: allowance } = useReadContract({
    address: CONTRACTS.IDRT,
    abi: IDRT_ABI,
    functionName: "allowance",
    args: [user, CONTRACTS.QardPool as Address],
    query: { enabled: isConnected },
  });

  // ======================
  // READS (pool / loan)
  // ======================
  const { data: availableLiquidity } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "availableLiquidity",
    query: { enabled: true },
  });

  const { data: totalOutstandingDebt } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "totalOutstandingDebt",
    query: { enabled: true },
  });

  const { data: allowlisted } = useReadContract({
    address: CONTRACTS.QardPool,
    abi: QARDPOOL_ABI,
    functionName: "allowlisted",
    args: [user],
    query: { enabled: isConnected },
  });

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
      startTime: Number(x[2]),
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

  // ======================
  // AMOUNTS
  // ======================
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

  // ======================
  // WRITES
  // ======================
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // admin
  const doSetAllowlist = () => {
    if (!targetUser) return;
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "setAllowlist",
      args: [targetUser as Address, allowValue],
    });
  };

  // borrower
  const doBorrow = () => {
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "borrow",
      args: [borrowAmount, tenorMonths],
    });
  };

  const doApproveRepay = () => {
    writeContract({
      address: CONTRACTS.IDRT,
      abi: IDRT_ABI,
      functionName: "approve",
      args: [CONTRACTS.QardPool as Address, repayAmount],
    });
  };

  const doRepay = () => {
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "repay",
      args: [repayAmount],
    });
  };

  const doEvaluate = () => {
    writeContract({
      address: CONTRACTS.QardPool,
      abi: QARDPOOL_ABI,
      functionName: "evaluateMyLoan",
      args: [],
    });
  };

  // ======================
  // RENDER
  // ======================
  const fmt = (v?: bigint) => (typeof v === "bigint" ? formatUnits(v, dec) : "-");

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, marginTop: 24 }}>
      <h2 style={{ marginBottom: 8 }}>Step 8 — Qard Hasan (Borrow & Repay)</h2>

      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
        Wallet: <code>{shortAddr(address)}</code>
      </div>

      {/* ===== Pool Info ===== */}
      <Section title="Pool Overview">
        <Row label="Available Liquidity" value={`${fmt(availableLiquidity as any)} ${sym}`} />
        <Row label="Outstanding Debt" value={`${fmt(totalOutstandingDebt as any)} ${sym}`} />
      </Section>

      {/* ===== Admin ===== */}
      <Section title="8A — Admin: Allowlist Borrower">
        <input
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          placeholder="0xBorrowerAddress"
          style={inputStyle}
        />
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={allowValue}
            onChange={(e) => setAllowValue(e.target.checked)}
          />{" "}
          Allow
        </label>
        <button onClick={doSetAllowlist} disabled={!isConnected || isPending} style={btnPrimary}>
          Set Allowlist
        </button>
        <small>Admin only. Required before borrower can call borrow().</small>
      </Section>

      {/* ===== Borrower ===== */}
      <Section title="8B — Borrower: Borrow">
        <Row label="Allowlisted" value={String(Boolean(allowlisted))} />
        <Row label="Has Active Loan" value={String(Boolean(hasActiveLoan))} />

        <input value={borrowStr} onChange={(e) => setBorrowStr(e.target.value)} style={inputStyle} />
        <input
          type="number"
          value={tenorMonths}
          min={1}
          max={12}
          onChange={(e) => setTenorMonths(Number(e.target.value))}
          style={inputStyle}
        />

        <button onClick={doBorrow} disabled={!isConnected || isPending} style={btnPrimary}>
          Borrow
        </button>
      </Section>

      {/* ===== Loan Status ===== */}
      <Section title="8C — Loan Status">
        {!loan ? (
          <div>-</div>
        ) : (
          <>
            <Row label="Principal" value={`${fmt(loan.principal)} ${sym}`} />
            <Row label="Paid So Far" value={`${fmt(loan.paidSoFar)} ${sym}`} />
            <Row label="Remaining" value={`${fmt(remaining)} ${sym}`} />
            <Row label="Tenor (months)" value={String(loan.tenorMonths)} />
            <Row label="Late Periods" value={String(loan.latePeriods)} />
            <Row label="Active" value={String(loan.isActive)} />
          </>
        )}
        <button onClick={doEvaluate} disabled={!isConnected || isPending} style={btnGhost}>
          Evaluate My Loan
        </button>
      </Section>

      {/* ===== Repay ===== */}
      <Section title="8D — Repay">
        <Row label="Your IDRT Balance" value={`${fmt(myBalance as any)} ${sym}`} />
        <Row label="Allowance to Pool" value={`${fmt(allowance as any)} ${sym}`} />

        <input value={repayStr} onChange={(e) => setRepayStr(e.target.value)} style={inputStyle} />

        {needsApprove && (
          <button onClick={doApproveRepay} disabled={!isConnected || isPending} style={btnPrimary}>
            Approve IDRT
          </button>
        )}

        <button onClick={doRepay} disabled={!isConnected || isPending} style={btnGhost}>
          Repay
        </button>
      </Section>

      {/* ===== TX Status ===== */}
      {txHash && (
        <div style={{ fontSize: 12, marginTop: 12 }}>
          Tx: <code>{txHash}</code> {isConfirming ? "⏳" : isSuccess ? "✅" : ""}
        </div>
      )}
      {error && <div style={{ color: "crimson", fontSize: 12 }}>{error.message}</div>}
    </div>
  );
}

/* ================== UI helpers ================== */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 8 }}>
      <b>{label}</b>
      <span>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #111",
  background: "#111",
  color: "white",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};
