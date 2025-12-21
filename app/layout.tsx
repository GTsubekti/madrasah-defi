// app/layout.tsx
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Ta’awun DeFi",
  description: "Ta’awun DeFi prototype on Base Sepolia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
