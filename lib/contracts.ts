// lib/contracts.ts
import type { Abi } from "viem";

export const CONTRACTS = {
  IDRT: "0x8FAa0ddF2AAf59cc4F4B91923901048577fE7014",
  TrustNFT: "0xA775852329ff269542018074897d4e36ce3C1c49",
  QardPool: "0x7d534CaE5443140D9Ad26B6A23d7753FBfE3422b",
} as const;

/**
 * IDRT: ERC20 minimal + approve
 */
export const IDRT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

/**
 * TrustNFT: minimal ERC721 (cek kepemilikan)
 */
export const TRUSTNFT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const satisfies Abi;

// Tambahan: beberapa kemungkinan nama fungsi mint (pilih di UI)
export const TRUSTNFT_MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "mintMe",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const satisfies Abi;

/**
 * QardPool: gabungan deposit + withdraw admin + lock + loan (Step 8)
 * Disusun minimal tapi lengkap buat semua panel kamu.
 */
export const QARDPOOL_ABI = [
  // ====== views (pool) ======
  {
    type: "function",
    name: "totalDeposits",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableLiquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalOutstandingDebt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ====== views (user deposit + lock + admin) ======
  {
    type: "function",
    name: "depositOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "lockedUntil",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },

  // ====== deposit ======
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },

  // ====== withdraw (admin-only) ======
  {
    type: "function",
    name: "adminWithdrawFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },

  // ====== allowlist (admin approval for borrowing) ======
  {
    type: "function",
    name: "allowlisted",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setAllowlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },

  // ====== loan status ======
  {
    type: "function",
    name: "hasActiveLoan",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "loanOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "paidSoFar", type: "uint256" },
      { name: "startTime", type: "uint64" },
      { name: "tenorMonths", type: "uint8" },
      { name: "latePeriods", type: "uint8" },
      { name: "lastEvaluatedPeriod", type: "uint8" },
      { name: "isActive", type: "bool" },
    ],
  },

  // ====== borrow & repay ======
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "tenorMonths", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },

  // ====== optional: update loan evaluation ======
  {
    type: "function",
    name: "evaluateMyLoan",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const satisfies Abi;
