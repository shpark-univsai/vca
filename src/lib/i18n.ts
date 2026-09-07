"use client";

import { useSyncExternalStore } from "react";

export type AppLanguage = "en" | "ko";

const LANGUAGE_STORAGE_KEY = "vca:language";
/** Pre-rename key, written back when the Portal was the only translated half of the product.
 *  Read once as a fallback so anyone who already picked Korean there keeps it. */
const LEGACY_PORTAL_KEY = "vca:portalLanguage";
const LANGUAGE_CHANGE_EVENT = "vca:languageChange";

function subscribe(callback: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getSnapshot(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PORTAL_KEY);
  return saved === "ko" ? "ko" : "en";
}
function getServerSnapshot(): AppLanguage {
  return "en";
}

// Same useSyncExternalStore + localStorage + same-tab custom-event pattern Sidebar.tsx uses for
// its persisted tab choice (see SIDEBAR_TAB_STORAGE_KEY there) — keeps SSR/client hydration in
// agreement on first paint (server snapshot is always "en"), then a language switch takes effect
// on every mounted screen immediately with no page reload, since they all read off the same
// subscription rather than each holding their own local state.
//
// One language for the whole product, Portal and monitoring app alike: the two halves are the
// same install seen through different permissions, and someone who reads Korean in one does not
// switch to English by walking through the other. The Portal switches it from its shell header,
// the app from My Page → Interface language; both write this one key.
export function useLanguage(): [AppLanguage, (lang: AppLanguage) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLang = (next: AppLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  };
  return [lang, setLang];
}

/** Name the Portal half was written against, before the monitoring app started sharing the
 *  setting. Same hook — kept so the ~16 Portal files do not all have to change in one go. */
export const usePortalLanguage = useLanguage;
export type PortalLanguage = AppLanguage;

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
 * this codebase already colocates screen-specific constants with their screen (e.g. `AI_FEATURES`
 * in ProjectCamerasTab.tsx, `PLAN_FEATURES` in ProjectLicenseTab.tsx) — a shared dictionary would
 * be a new, inconsistent pattern for strings that are almost all screen-specific anyway. Only
 * truly cross-screen strings (nav labels, the language switcher itself) belong in a shared spot
 * (see `PROJECT_TABS` in ProjectSidebar.tsx, `LanguageSwitcher` in PortalShared.tsx).
 *
 * Data is not translated. Camera codes, zone names, VIP names, department names and anything else
 * that came from the customer's own install stay exactly as entered — translating them would make
 * the UI disagree with the device list and the roster the operator is holding.
 */
