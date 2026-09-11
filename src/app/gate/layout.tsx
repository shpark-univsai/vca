import type { Metadata } from "next";

/* Sits between login and a screen, so it must not carry the dashboard's tab title — same reason
   the other auth routes each have one of these. */
export const metadata: Metadata = {
  title: "Access – VCA",
  description: "Choose which half of the install to open.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
