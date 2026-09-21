import type { AppAction, AppScreen } from "./vcaStore";

/**
 * What the five actions are called, and which screens each one opens.
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
      liveView: "Live view",
      history: "Open past records",
      personSearch: "Person search",
      trail: "Trail across cameras",
      export: "Evidence export",
    } as Record<AppAction, string>,
    actionDesc: {
      liveView: "Cameras as they are right now",
      history: "Frames and records from before now",
      personSearch: "Find a person in what was recorded",
      trail: "Reconstruct one person's route across every camera in their scope",
      export: "Take a sighting out of the console as a file",
    } as Record<AppAction, string>,
    opens: (screens: string) => `Opens: ${screens}`,
    opensNothing: "Opens no screen of its own",
  },
  ko: {
    groupActions: "할 수 있는 일",
    screenName: { live: "실시간 관제", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      liveView: "실시간 보기",
      history: "지난 기록 열람",
      personSearch: "인물 검색",
      trail: "동선 추적",
      export: "증거 내보내기",
    } as Record<AppAction, string>,
    actionDesc: {
      liveView: "지금 들어오는 카메라 화면",
      history: "지금보다 앞선 프레임과 기록",
      personSearch: "기록된 것에서 사람을 찾는다",
      trail: "범위 안 모든 카메라를 훑어 한 사람의 경로를 재구성한다",
      export: "감지 기록을 파일로 꺼낸다",
    } as Record<AppAction, string>,
    opens: (screens: string) => `열리는 화면: ${screens}`,
    opensNothing: "따로 열리는 화면은 없습니다",
  },
} as const;
