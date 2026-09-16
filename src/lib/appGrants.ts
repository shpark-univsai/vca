import type { AppScreen } from "./vcaStore";

/**
 * What the five app screens and two actions are called, in one place.
 *
 * THE NAME IS THE NAV LABEL, not a description of the screen. An administrator grants
 * "대시보드" and the person then goes looking for a tab with that word on it; a grant list that
 * says "실시간 관제" sends them hunting for a tab the app does not have. That is the same failure
 * as a screen naming an action it does not carry — the person concludes the product is broken
 * rather than that the label was loose. What the screen DOES belongs in `screenDesc`, which is
 * why every row has one.
 *
 * A plain map rather than a hook, because the two callers read two different language settings
 * on purpose (usePortalLanguage vs useLanguage — see lib/i18n.ts, which explicitly forbids
 * unifying them). Each side passes its own `lang`.
 *
 * Kept out of PortalShared so /mypage, an app route, does not pull the whole portal module in.
 */
export const APP_GRANT_LABELS = {
  en: {
    groupScreens: "Screens",
    groupVerbs: "Actions",
    // Navbar.tsx TABS and DataPage's tabReid — the words on the tabs themselves.
    screenName: { live: "Dashboard", bestframe: "Best Frame", redmap: "Redmap", reid: "Re-ID Analysis", redface: "RedFace" } as Record<AppScreen, string>,
    screenDesc: {
      live: "Cameras as they are right now",
      bestframe: "Open the frames a detection produced",
      redmap: "Follow a route on the map",
      reid: "Find the same person on another camera",
      redface: "Search past detections by face",
    } as Record<AppScreen, string>,
    verbSearch: "Person search",
    verbSearchDesc: "Reconstruct where a person went",
    verbExport: "Evidence export",
    verbExportDesc: "Take a sighting out of the console as a file",
  },
  ko: {
    groupScreens: "화면",
    groupVerbs: "동작",
    screenName: { live: "대시보드", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    screenDesc: {
      live: "지금 들어오는 카메라 화면",
      bestframe: "검출이 남긴 프레임을 열어 본다",
      redmap: "지도에서 동선을 따라간다",
      reid: "다른 카메라에서 같은 사람을 찾는다",
      redface: "얼굴로 지난 검출을 찾는다",
    } as Record<AppScreen, string>,
    verbSearch: "인물 검색",
    verbSearchDesc: "그 사람이 어디를 지나갔는지 되짚는다",
    verbExport: "증거 내보내기",
    verbExportDesc: "검출을 파일로 꺼낸다",
  },
} as const;
