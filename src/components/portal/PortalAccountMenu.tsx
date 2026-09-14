"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGateChoice } from "@/components/AccessGate";
import { Headset, LogOut, MonitorPlay, User } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { BORDER, SupportContactModal } from "./PortalShared";
import { SUPPORT_CONTACT } from "@/lib/vcaStore";

const T = {
  en: { toApp: "Go to app", settings: "Settings", support: "Contact support", logOut: "Log out" },
  ko: { toApp: "앱으로 이동", settings: "설정", support: "고객 지원", logOut: "로그아웃" },
} as const;

const MENU_ITEM: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "10px", width: "100%",
  padding: "9px 10px", borderRadius: "8px", border: "none", background: "none",
  cursor: "pointer", textAlign: "left",
  fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

/**
 * Who you are, at the right end of the top bar — and everything that belongs to you rather than
 * to the project you happen to have open.
 *
 * It collects three things that were each their own permanent control up there: "Exit to App", the
 * language switcher and "Contact support". None of them is a per-screen action, and the app puts
 * the matching door (Navbar's avatar → Portal) in its own account menu, so the two directions were
 * built differently for no reason. Language went further, into Portal's Settings, because it is a
 * preference rather than an action.
 *
 * The top bar is on every Portal screen, including the ones with no sidebar (an empty team, the
 * project wizard) — which is why this can be the only home for the way out.
 */
export default function PortalAccountMenu({ admin, appAccess, onSettings }: {
  admin: { name: string; email: string };
  /**
   * Whether this account has the monitoring app. False hides the way out — a Portal-only account
   * (the customer's security officer reading the audit trail) would land on a screen it cannot
   * use, and the item would be the console advertising a locked door.
   */
  appAccess: boolean;
  onSettings: () => void;
}) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  // An address is the minimum a desk needs to exist; the phone and the hours are optional on it.
  const hasSupportDesk = !!SUPPORT_CONTACT.email;
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(() => setOpen(false), open);
  // mousedown, not click, so a press that lands on another control both closes this and reaches it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <>
      <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
        <button
          className="portal-account-btn"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          title={`${admin.name} · ${admin.email}`}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            border: "none", background: open ? "var(--gray-100)" : "none",
            borderRadius: "8px", padding: "4px 8px 4px 4px", cursor: "pointer",
            fontFamily: "inherit", maxWidth: "220px",
          }}
        >
          <Avatar name={admin.name} />
          {/* Name only up here; the address is in the menu's own header, where there is room for it
              to be read rather than truncated. */}
          <span style={{
            fontSize: "13px", fontWeight: 600, color: "var(--gray-900)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{admin.name}</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
            minWidth: "220px",
            backgroundColor: "white", border: BORDER, borderRadius: "12px",
            boxShadow: "var(--shadow-popover)", padding: "6px",
          }}>
            <div style={{ padding: "8px 10px 10px", minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.name}</p>
              <p style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{admin.email}</p>
            </div>
            <div style={{ height: "1px", backgroundColor: "var(--line)", margin: "0 4px 6px" }} />
            <button className="portal-navmenu-item" onClick={() => { setOpen(false); onSettings(); }} style={MENU_ITEM}>
              <User size={14} strokeWidth={2.4} color="var(--gray-500)" /> {t.settings}
            </button>
            {/* Only when there is a desk to reach. An installation whose supplier handles support
                through the account manager has no help line, and an item that opens a sheet with
                one address and two blanks is the console offering a door it cannot open. The
                licence page names the account manager either way, which is the path that always
                exists. */}
            {hasSupportDesk && (
              <button className="portal-navmenu-item" onClick={() => { setOpen(false); setSupportOpen(true); }} style={MENU_ITEM}>
                <Headset size={14} strokeWidth={2.4} color="var(--gray-500)" /> {t.support}
              </button>
            )}
            {/* The icon was LogOut, which is the one mark in this menu that means "you are
                leaving the product". Crossing to the monitoring app is not that — you stay signed
                in, and the item right below it now is the real way out. Two doors wearing the same
                mark is how somebody ends a shift by accident. */}
            {appAccess && (
              <button className="portal-navmenu-item" onClick={() => { setOpen(false); updateGateChoice("app"); router.push("/"); }} style={MENU_ITEM}>
                <MonitorPlay size={14} strokeWidth={2.4} color="var(--gray-500)" /> {t.toApp}
              </button>
            )}
            {/* Portal had no way out at all — the top bar is the only place that could hold one,
                and this menu is the only thing in it that belongs to the person rather than to the
                project. Same treatment as the app's Navbar menu: below a rule, in the danger
                colour, because it ends what everything above it was doing.

                It navigates and nothing more, which is the honest amount for now: there is no
                session to end (the gate runs on a mock identity — see the note on the /portal
                guard). The gate choice is deliberately left alone; signing out is not a statement
                about which half you want next time.

                HANDOFF: when sessions are real this has to call the server's sign-out and clear
                the token, not only route to /login. */}
            <div style={{ height: "1px", backgroundColor: "var(--line)", margin: "6px 4px" }} />
            <button className="portal-navmenu-item" onClick={() => { setOpen(false); router.push("/login"); }}
              style={{ ...MENU_ITEM, color: "var(--danger-400)" }}>
              <LogOut size={14} strokeWidth={2.4} color="var(--danger-400)" /> {t.logOut}
            </button>
          </div>
        )}
      </div>

      {/* A dialog rather than a popover inside a popover: the contact details are a short list to
          read and copy, and nesting one floating layer in another puts the second one's edges
          wherever the first happens to end. */}
      {supportOpen && <SupportContactModal onClose={() => setSupportOpen(false)} />}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
      backgroundColor: "var(--primary-400)", color: "white", fontSize: "12px", fontWeight: 700,
    }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
