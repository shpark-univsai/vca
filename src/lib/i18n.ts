"use client";

import { useSyncExternalStore } from "react";

export type AppLanguage = "en" | "ko";

/**
 * Two settings, not one: the monitoring app and Portal each remember their own.
 *
 * They shared a key until 2026-09-10, on the reasoning that the two halves are one install seen
 * through different permissions and nobody who reads Korean in one wants English in the other.
 * That is true of a person who only uses one half, and wrong for the person who uses both — an
 * operator reading the app in Korean often works the console against English documentation and
 * screenshots, and a single switch made them re-pick a language every time they crossed over.
 *
 * Portal keeps the key it was originally written against, which is also what makes the split
 * cheap: anyone who had already chosen Korean in the console still has it.
 */
const APP_LANGUAGE_KEY = "vca:language";
const PORTAL_LANGUAGE_KEY = "vca:portalLanguage";
const LANGUAGE_CHANGE_EVENT = "vca:languageChange";

function subscribe(callback: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getServerSnapshot(): AppLanguage {
  return "en";
}

/**
 * One hook shape, two keys.
 *
 * Built by a factory rather than written twice so the two halves cannot drift — the subscription,
 * the SSR snapshot and the same-tab event are one implementation. Both hooks are created at module
 * scope, so each is a stable function and the rules of hooks hold.
 *
 * `fallbackKey` lets Portal read the app's choice when it has none of its own, so the first visit
 * after the split does not silently flip a Korean console back to English. It is read, never
 * written: the moment either side is set explicitly the two are independent for good.
 *
 * useSyncExternalStore + localStorage + a same-tab custom event, the pattern Sidebar.tsx uses for
 * its persisted tab. Server snapshot is always "en" so SSR and the first client paint agree, and
 * every mounted screen re-reads on change with no reload.
 */
function makeLanguageHook(storageKey: string, fallbackKey?: string) {
  const getSnapshot = (): AppLanguage => {
    const saved = localStorage.getItem(storageKey)
      ?? (fallbackKey ? localStorage.getItem(fallbackKey) : null);
    return saved === "ko" ? "ko" : "en";
  };
  return function useLanguageSetting(): [AppLanguage, (lang: AppLanguage) => void] {
    const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const setLang = (next: AppLanguage) => {
      localStorage.setItem(storageKey, next);
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    };
    return [lang, setLang];
  };
}

/** The monitoring app's language. Set from My Page -> Interface language. */
export const useLanguage = makeLanguageHook(APP_LANGUAGE_KEY);

/** Portal's own language, independent of the app's. Set from Settings -> Interface language. */
export const usePortalLanguage = makeLanguageHook(PORTAL_LANGUAGE_KEY, APP_LANGUAGE_KEY);

/**
 * Per-file translation pattern used across the codebase (established here, followed everywhere
 * else): each file declares its own dictionary —
 *
 *   const T = {
 *     en: { title: "Cameras", addButton: "Add camera" },
 *     ko: { title: "카메라", addButton: "카메라 추가" },
 *   } as const;
 *
 * — then inside the component: `const [lang] = useLanguage(); const t = T[lang];` and
 * reference `t.title` etc. in JSX. Kept per-file rather than one giant central dictionary because
 * this codebase already colocates screen-specific constants with their screen (e.g.
 * `PLAN_FEATURES` in ProjectLicenseTab.tsx, `WATCHLIST_CATEGORY_COLORS`' labels in
 * ProjectVipTab.tsx) — a shared dictionary would be a new, inconsistent pattern for strings that
 * are almost all screen-specific anyway. Only truly cross-screen strings, nav labels above all,
 * belong in a shared spot (see `PROJECT_TABS` in ProjectSidebar.tsx).
 *
 * Data is not translated. Camera codes, zone names, VIP names, department names and anything else
 * that came from the customer's own install stay exactly as entered — translating them would make
 * the UI disagree with the device list and the roster the operator is holding.
 */


/**
 * Picks the Korean particle that agrees with the preceding word.
 *
 * Korean object and instrumental particles change with the final letter: "노베나를" but
 * "클라크퀘이를"… and, crucially, "…ai로" not "…ai으로". Several strings had one form hardcoded,
 * so any value ending the other way read as a typo to a Korean speaker — and one of them is an
 * email address, which the user typed themselves moments earlier.
 *
 * Only the final syllable matters. A Hangul syllable has a trailing consonant when
 * (code - 0xAC00) % 28 !== 0; a Latin letter or digit is judged by whether it is usually read as
 * ending in a consonant sound. Unknown scripts fall back to the no-final form, which is the safer
 * of the two to be wrong about.
 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.trim().slice(-1);
  if (!last) return withoutFinal;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0 ? withFinal : withoutFinal;
  }
  // Latin letters and digits read aloud in Korean: vowels and the "n/l/m/r"-sounding letters end
  // without a consonant the particle has to bridge; everything else takes the consonant form.
  const lower = last.toLowerCase();
  if (/[aeiouwy]/.test(lower)) return withoutFinal;
  if (/[lmnr]/.test(lower)) return withFinal;
  if (/[0-9]/.test(lower)) return "2459".includes(lower) ? withoutFinal : withFinal;
  return withFinal;
}
