import type { Metadata } from "next";

/* Pre-auth screens are not the Smart City dashboard, so they must not carry its browser-tab title.
   The page itself is a client component and cannot export metadata, which is what this thin route
   layout is for. */
export const metadata: Metadata = {
  title: "Reset password – VCA",
  description: "Reset your VCA password.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
