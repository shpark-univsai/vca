import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNIVS SMART CITY – VCA Dashboard",
  description: "VCA Monitoring Dashboard by UNIVS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      {/* No <head> font links: the faces are declared in globals.css and served from
          public/fonts. See the comment there — a CDN stylesheet fails silently on an
          internet-isolated network, which is the only kind this product is deployed to. */}
      <body style={{ height: "100%", margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
