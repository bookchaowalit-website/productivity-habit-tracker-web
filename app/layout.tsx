import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// The font variable sits on <html>: the App shell tokens live on :root and read it from there.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Habits | Bookchaowalit",
  description: "Tick off small daily habits and see the last 14 days. Saved in this browser only.",
  metadataBase: new URL("https://habit-tracker.bookchaowalit.com"),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
