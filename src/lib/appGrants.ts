import type { AppAction, AppScreen } from "./vcaStore";

/**
 * What the six actions are called, where each one applies, and what it reveals.
 *
 * THE NAME IS WHAT SOMEBODY MAY DO, not where they do it. The grant used to be five screens plus
 * two verbs, which asked the same question twice: person search sits on three of those screens, so
 * granting the screens and granting the search were half the same decision, and a custom grant
 * ended up looking exactly like a preset (owner: 커스텀이 프리셋이랑 똑같다). Now the five rows
 * are the actions and each one names the screens it opens, so an administrator can still answer
 * "which tab will they see" without the grant pretending that is the question.
 *
 * FIND THE TAB BEFORE RENAMING A SCREEN NAME. Three of the five screens are sub-tabs under 데이터
 * and two are top-level, and reading the top nav alone makes that invisible: `live` was briefly
 * renamed "대시보드" here on the strength of the nav bar, and 대시보드 is a different screen — one
 * that `tabAllowed` never gates at all (ClientLayout.tsx:291). `DATA_TAB_SCREEN` in DataPage.tsx
 * is the mapping that settles it.
 *
 * A plain map rather than a hook, because the two callers read two different language settings on
 * purpose (usePortalLanguage vs useLanguage — see lib/i18n.ts, which explicitly forbids unifying
 * them). Each side passes its own `lang`.
 *
 * Kept out of PortalShared so /mypage, an app route, does not pull the whole portal module in.
 */
export const APP_GRANT_LABELS = {
  en: {
    groupActions: "What they may do",
    // The words on the tabs these actions open — Navbar.tsx TABS for the two top-level ones,
    // DataPage's own T for the three that live under 데이터. See DATA_TAB_SCREEN.
    screenName: { live: "Live Monitoring", bestframe: "Best Frame", redmap: "Redmap", reid: "Re-ID Analysis", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      systemStatus: "System status",
      liveView: "Live detections",
      history: "Open past records",
      personSearch: "Person search",
      trail: "Trail across cameras",
      export: "Evidence export",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "Cameras and servers, up or down. No personal data",
      liveView: "Detections as they happen — a person, a place, a time",
      history: "The same, from before now",
      personSearch: "Turns \u201csomebody was here\u201d into \u201cthis person was here\u201d",
      trail: "Joins those into one person's route across every camera in scope",
      export: "Takes any of it out of the console as a file",
    } as Record<AppAction, string>,
    // The exact places, named as the app names them, so nobody has to guess which tab a grant is
    // about — including the two panels the dashboard is made of.
    actionOpens: {
      systemStatus: "Dashboard → SYSTEM",
      liveView: "Dashboard → EVENTS, the map, Data → Live Monitoring",
      history: "Best Frame",
      personSearch: "Data → RedFace, and the search boxes on Data and Redmap",
      trail: "Redmap, Data → Re-ID Analysis",
      export: "The export buttons on Redmap and Best Frame",
    } as Record<AppAction, string>,
    opens: (where: string) => `Where: ${where}`,
  },
  ko: {
    groupActions: "할 수 있는 일",
    screenName: { live: "실시간 관제", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      systemStatus: "시스템 현황",
      liveView: "실시간 감지",
      history: "지난 기록 열람",
      personSearch: "인물 검색",
      trail: "동선 추적",
      export: "증거 내보내기",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "카메라와 서버가 살아 있는지. 개인정보는 없습니다",
      liveView: "지금 일어나는 감지 — 사람 · 장소 · 시각",
      history: "같은 것을 지난 시점에서",
      personSearch: "\u201c누군가 지나갔다\u201d를 \u201c이 사람이 지나갔다\u201d로 바꿉니다",
      trail: "그것들을 이어 범위 안 모든 카메라에서 한 사람의 경로를 만듭니다",
      export: "그중 무엇이든 파일로 콘솔 밖으로 내보냅니다",
    } as Record<AppAction, string>,
    actionOpens: {
      systemStatus: "대시보드 → SYSTEM",
      liveView: "대시보드 → EVENTS, 지도, 데이터 → 실시간 관제",
      history: "베스트 프레임",
      personSearch: "데이터 → RedFace, 그리고 데이터·레드맵의 검색창",
      trail: "레드맵, 데이터 → Re-ID 분석",
      export: "레드맵과 베스트 프레임의 내보내기 버튼",
    } as Record<AppAction, string>,
    opens: (where: string) => `위치: ${where}`,
  },
} as const;
