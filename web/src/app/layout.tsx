import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "支出調整",
  description: "LINE Bot & LIFF による支出調整システム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen bg-slate-100 flex justify-center">
        <div className="w-full max-w-md md:max-w-6xl bg-slate-50 min-h-screen flex flex-col shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
