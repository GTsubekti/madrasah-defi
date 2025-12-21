"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

function shortAddr(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <button
        className="btn btn-primary"
        onClick={() => connect({ connector: injected() })}
        disabled={isPending}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <button
      className="btn"
      title="Disconnect wallet"
      onClick={() => disconnect()}
      style={{ fontFamily: "var(--mono)" }}
    >
      {shortAddr(address)}
    </button>
  );
}
