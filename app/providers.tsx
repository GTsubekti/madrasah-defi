"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected({
      // biar gak “maksa” kalau tidak ada wallet
      shimDisconnect: true,
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
