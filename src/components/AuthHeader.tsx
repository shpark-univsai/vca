"use client";

import { useLanguage, type AppLanguage } from "@/lib/i18n";

// The console's one hairline value — see --line in globals.css, which was defined for exactly
// this and then never reached the app: eight files each declared their own gray-200 rule instead,
// so Portal and the app drew different lines.
const BORDER = "1px solid var(--line)";

const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "ko", label: "한국어" },
];

/**
 * Pre-auth screens carry the switcher themselves. My Page owns the setting once someone is signed
 * in, but nobody reading this screen is signed in yet — and the one person who most needs Korean
 * is the one who cannot get past it. Two labels rather than a dropdown: there are only two, and
 * each is written in its own script so it is recognisable without reading the rest of the screen.
 */
function LanguageToggle() {
  const [lang, setLang] = useLanguage();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "2px", backgroundColor: "var(--gray-50)", borderRadius: "7px" }}>
      {LANGUAGES.map(l => {
        const active = l.value === lang;
        return (
          <button
            key={l.value}
            onClick={() => setLang(l.value)}
            aria-pressed={active}
            style={{
              border: "none", borderRadius: "5px", padding: "4px 9px", cursor: "pointer",
              backgroundColor: active ? "white" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(14,22,42,0.08)" : "none",
              fontSize: "11px", fontWeight: active ? 800 : 600,
              color: active ? "var(--gray-800)" : "var(--gray-500)",
              letterSpacing: "-0.22px",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/* Minimal header for pre-auth screens like login / password setup (logo only, no full nav) */
export default function AuthHeader() {
  return (
    <div style={{
      height: "56px", backgroundColor: "white", borderBottom: BORDER,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "4px 12px", borderRadius: "8px", backgroundColor: "var(--gray-900)",
        }}>
          <span style={{ fontFamily: "'Jockey One', sans-serif", fontSize: "16px", lineHeight: "18px", color: "white" }}>VCA</span>
        </div>
        <span style={{ fontFamily: "'Jockey One', sans-serif", fontSize: "18px", lineHeight: "26px", letterSpacing: "0.36px", color: "var(--gray-900)" }}>
          UNIVERSE AI
        </span>
      </div>
      <LanguageToggle />
    </div>
  );
}
