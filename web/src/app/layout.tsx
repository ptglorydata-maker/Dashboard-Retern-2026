import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const kanit = Kanit({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["latin", "thai"],
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "Dashboard สินค้าตีกลับ 2569",
  icons: { icon: "/logo-mark.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${kanit.variable} h-full`}>
      <body className="min-h-full font-sans" style={{ fontFamily: "var(--font-kanit), sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
