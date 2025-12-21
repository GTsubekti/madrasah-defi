"use client";

import { useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import {
  CONTRACTS,
  IDRT_ABI,
  TRUSTNFT_ABI,
  QARDPOOL_ABI,
} from "@/lib/contracts";

function safeAddr(a?: string): Address {
  if (!a) return zeroAddress;
  return a as Address;
}

function formatWIB(ts?: bigint | number) {
  if (ts === undefined || ts === null) return "-";
  const sec = typeof ts === "bigint" ? Number(ts) : ts;
  if (!Number.isFinite(sec) || sec <= 0) return "Unlocked";

  const d = new Date(sec * 1000);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Step6ReadPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const user = safeAddr(address);

  const qardPool = CONTRACTS.QardPool as Address;
  const idrt = CONTRACTS.IDRT as Address;
  const trust = CONTRACTS.TrustNFT as Address;

  const [depositStr, setDepositStr] = useState("200000");
  const [withdrawStr, setWithdrawStr] = useState("10000");

  // ---------- READS ----------
  const { data: decimals } = useReadContract({
    address: idrt,
    abi: IDRT_ABI,
    functionName: "decimals",
    query: { enabled: true },
  });

  const { data: symbol } = useReadContract({
    address: idrt,
    abi: IDRT_ABI,
    functionName: "symbol",
    query: { enabled: true },
  });

  const { data: idrtBal } = useReadContract({
    address: idrt,
    abi: IDRT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected && user !== zeroAddress },
  });

  const { data: allowance } = useReadContract({
    address: idrt,
    abi: IDRT_ABI,
    functionName: "allowance",
    args: [user, qardPool],
    query: { enabled: isConnected && user !== zeroAddress },
  });

  const { data: trustBal } = useReadContract({
    address: trust,
    abi: TRUSTNFT_ABI,
    functionName: "balanceOf",
    args: [user],
    query: { enabled: isConnected && user !== zeroAddress },
  });

  const { data: totalDeposits } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "totalDeposits",
    query: { enabled: true },
  });

  const { data: availableLiquidity } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "availableLiquidity",
    query: { enabled: true },
  });

  const { data: totalOutstandingDebt } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "totalOutstandingDebt",
    query: { enabled: true },
  });

  const { data: myDeposit } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "depositOf",
    args: [user],
    query: { enabled: isConnected && user !== zeroAddress },
  });

  const { data: ownerAddr } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "owner",
    query: { enabled: true },
  });

  const { data: lockedUntil } = useReadContract({
    address: qardPool,
    abi: QARDPOOL_ABI,
    functionName: "lockedUntil",
    args: [user],
    query: { enabled: isConnected && user !== zeroAddress },
  });

  // ---------- Derived ----------
  const dec = typeof decimals === "number" ? decimals : 0;

  const fmt = (v?: bigint) => {
    if (typeof v !== "bigint") return "-";
    return formatUnits(v, dec);
  };

  const depositAmount = useMemo(() => {
    try {
      return parseUnits(depositStr || "0", dec);
    } catch {
      return 0n;
    }
  }, [depositStr, dec]);

  const withdrawAmount = useMemo(() => {
    try {
      return parseUnits(withdrawStr || "0", dec);
    } catch {
      return 0n;
    }
  }, [withdrawStr, dec]);

  const hasTrust = typeof trustBal === "bigint" ? trustBal > 0n : false;

  const isOwner =
    typeof ownerAddr === "string" &&
    typeof address === "string" &&
    ownerAddr.toLowerCase() === address.toLowerCase();

  const allowanceOk =
    typeof allowance === "bigint"
      ? allowance >= depositAmount && depositAmount > 0n
      : false;

  const balanceOk =
    typeof idrtBal === "bigint"
      ? idrtBal >= depositAmount && depositAmount > 0n
      : false;

  const depositEnough =
    typeof myDeposit === "bigint"
      ? myDeposit >= withdrawAmount && withdrawAmount > 0n
      : false;

  const nowSec = Math.floor(Date.now() / 1000);
  const lockSec =
    typeof lockedUntil === "bigint" ? Number(lockedUntil) : undefined;
  const isLocked = typeof lockSec === "number" ? lockSec > nowSec : false;

  const lockLine = isLocked
    ? `🔒 Locked until ${formatWIB(lockedUntil)} (WIB)`
    : `🟢 Unlocked`;

  // ---------- WRITES ----------
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Guards
  const canApprove =
    isConnected &&
    user !== zeroAddress &&
    hasTrust &&
    depositAmount > 0n &&
    balanceOk &&
    !allowanceOk;

  const canDeposit =
    isConnected &&
    user !== zeroAddress &&
    hasTrust &&
    depositAmount > 0n &&
    balanceOk &&
    allowanceOk;

  // IMPORTANT: withdraw tetap boleh diklik walau masih LOCKED (buat demo revert).
  // Jadi di guard kita TIDAK pakai isLocked.
  const canAdminWithdrawForDemo =
    isConnected &&
    user !== zeroAddress &&
    hasTrust &&
    isOwner &&
    withdrawAmount > 0n &&
    depositEnough;

  // Actions
  const doApprove = () => {
    writeContract({
      address: idrt,
      abi: IDRT_ABI,
      functionName: "approve",
      args: [qardPool, depositAmount],
    });
  };

  const doDeposit = () => {
    writeContract({
      address: qardPool,
      abi: QARDPOOL_ABI,
      functionName: "deposit",
      args: [depositAmount],
    });
  };

  const doAdminWithdraw = () => {
    // Kontrak kamu: withdraw hanya admin
    writeContract({
      address: qardPool,
      abi: QARDPOOL_ABI,
      functionName: "adminWithdrawFor",
      args: [user, withdrawAmount],
    });
  };

  const setWithdrawMax = () => {
    if (typeof myDeposit === "bigint") setWithdrawStr(fmt(myDeposit));
  };

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ margin: 0, marginBottom: 8 }}>
        Step 7B — Withdraw Flow (Admin) + Lock Proof
      </h2>

      <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 12 }}>
        ChainId: <b>{chainId}</b> | Connected:{" "}
        <b>{isConnected ? "YES" : "NO"}</b>
        <br />
        Address: <code>{address ?? "-"}</code>
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <Row label="Token" value={`${symbol ?? "TOKEN"} (decimals: ${dec})`} />
        <Row label="IDRT Balance" value={fmt(idrtBal as any)} />
        <Row label="Allowance → QardPool" value={fmt(allowance as any)} />
        <Row
          label="TrustNFT Status"
          value={hasTrust ? "✅ Has TrustNFT" : "❌ No TrustNFT"}
        />

        <Row label="QardPool Total Deposits" value={fmt(totalDeposits as any)} />
        <Row
          label="QardPool Available Liquidity"
          value={fmt(availableLiquidity as any)}
        />
        <Row
          label="QardPool Outstanding Debt"
          value={fmt(totalOutstandingDebt as any)}
        />
        <Row label="Your Deposit" value={fmt(myDeposit as any)} />

        <Row label="QardPool Owner (admin)" value={(ownerAddr as any) ?? "-"} />

        <Row
          label="Lock Status"
          value={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontWeight: 800,
                  color: isLocked ? "#7a1c1c" : "#0f5132",
                  background: isLocked ? "#fdecea" : "#d1e7dd",
                }}
              >
                {isLocked ? "LOCKED" : "UNLOCKED"}
              </span>
              <span style={{ opacity: 0.9 }}>{lockLine}</span>
            </span>
          }
        />
      </div>

      {/* Deposit */}
      <Section title="Deposit">
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            Amount ({symbol ?? "IDRT"})
          </span>
          <input
            value={depositStr}
            onChange={(e) => setDepositStr(e.target.value)}
            placeholder="e.g. 200000"
            style={inputStyle}
          />
        </label>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Guard:
          <ul style={{ marginTop: 6 }}>
            <li>
              TrustNFT wajib: <b>{hasTrust ? "OK" : "NO"}</b>
            </li>
            <li>
              Balance cukup: <b>{balanceOk ? "OK" : "NO"}</b>
            </li>
            <li>
              Allowance cukup: <b>{allowanceOk ? "OK" : "NO"}</b>
            </li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={doApprove}
            disabled={!canApprove || isPending || isConfirming}
            style={btnStyle}
          >
            {isPending || isConfirming ? "Processing..." : "Approve"}
          </button>

          <button
            onClick={doDeposit}
            disabled={!canDeposit || isPending || isConfirming}
            style={btnStyle}
          >
            {isPending || isConfirming ? "Processing..." : "Deposit"}
          </button>
        </div>
      </Section>

      {/* Withdraw (Admin) */}
      <Section title="Withdraw (Admin-only) — Demo Lock">
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          <div>
            Withdraw di kontrak ini dilakukan via{" "}
            <code>adminWithdrawFor(user, amount)</code>.
          </div>
          <div style={{ marginTop: 4 }}>
            Untuk demo presentasi, tombol withdraw <b>tetap bisa diklik</b> walau
            status <b>LOCKED</b>, agar terlihat blockchain yang menolak (error{" "}
            <b>“Still locked”</b>).
          </div>
        </div>

        {!isOwner ? (
          <div style={{ fontSize: 12, color: "#b00020", marginTop: 8 }}>
            Kamu <b>bukan owner/admin</b>, jadi withdraw pasti gagal (ownable).
          </div>
        ) : null}

        <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>
            Amount ({symbol ?? "IDRT"})
          </span>
          <input
            value={withdrawStr}
            onChange={(e) => setWithdrawStr(e.target.value)}
            placeholder="e.g. 10000"
            style={inputStyle}
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={setWithdrawMax} style={btnStyle} disabled={!isConnected}>
            Max = My Deposit
          </button>

          <button
            onClick={doAdminWithdraw}
            disabled={!canAdminWithdrawForDemo || isPending || isConfirming}
            style={btnStyle}
          >
            {isPending || isConfirming ? "Processing..." : "Admin Withdraw"}
          </button>
        </div>

        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
          Guard (bukan lock):
          <ul style={{ marginTop: 6 }}>
            <li>
              Admin: <b>{isOwner ? "OK" : "NO"}</b>
            </li>
            <li>
              TrustNFT: <b>{hasTrust ? "OK" : "NO"}</b>
            </li>
            <li>
              Deposit cukup: <b>{depositEnough ? "OK" : "NO"}</b>
            </li>
          </ul>
        </div>
      </Section>

      {/* TX status */}
      <div style={{ marginTop: 12 }}>
        {txHash ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Tx: <code>{txHash}</code> {isSuccess ? "✅ Confirmed" : ""}
          </div>
        ) : null}
        {error ? (
          <div style={{ fontSize: 12, color: "#b00020" }}>{error.message}</div>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #eee",
        borderRadius: 12,
        marginTop: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
  outline: "none",
};

function Row({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        gap: 12,
        padding: 10,
        borderRadius: 10,
        background: "#fafafa",
        border: "1px solid #eee",
      }}
    >
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
