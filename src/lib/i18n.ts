"use client";

import { useSyncExternalStore } from "react";

export type PortalLanguage = "en" | "ko";

const LANGUAGE_STORAGE_KEY = "vca:portalLanguage";
const LANGUAGE_CHANGE_EVENT = "vca:portalLanguageChange";

function subscribe(callback: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function getSnapshot(): PortalLanguage {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "ko" ? "ko" : "en";
}
function getServerSnapshot(): PortalLanguage {
  return "en";
}

// Same useSyncExternalStore + localStorage + same-tab custom-event pattern Sidebar.tsx uses for
// its persisted tab choice (see SIDEBAR_TAB_STORAGE_KEY there) — keeps SSR/client hydration in
// agreement on first paint (server snapshot is always "en"), then a language switch takes effect
// on every mounted Portal screen immediately with no page reload, since they all read off the
// same subscription rather than each holding their own local state.
export function usePortalLanguage(): [PortalLanguage, (lang: PortalLanguage) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setLang = (next: PortalLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  };
  return [lang, setLang];
}

/**
 * Per-file translation pattern used across Portal components (established here, followed
 * everywhere else): each file declares its own dictionary —
 *
 *   const T = {
 *     en: { title: "Cameras", addButton: "Add camera" },
 *     ko: { title: "카메라", addButton: "카메라 추가" },
 *   } as const;
 *
 * — then inside the component: `const [lang] = usePortalLanguage(); const t = T[lang];` and
 * reference `t.title` etc. in JSX. Kept per-file rather than one giant central dictionary because
 * this codebase already colocates screen-specific constants with their screen (e.g. `AI_FEATURES`
 * in ProjectCamerasTab.tsx, `PLAN_FEATURES` in ProjectLicenseTab.tsx) — a shared dictionary would
 * be a new, inconsistent pattern for strings that are almost all screen-specific anyway. Only
 * truly cross-screen strings (nav labels, the language switcher itself) belong in a shared spot
 * (see `PROJECT_TABS` in ProjectSidebar.tsx, `LanguageSwitcher` in PortalShared.tsx).
 */
