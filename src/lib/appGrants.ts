import type { AppAction, AppScreen } from "./vcaStore";

/**
 * What the six actions are called, where each one applies, and what it reveals.
 *
 * THE NAME IS THE PLACE IN THE APP; THE LINE UNDER IT IS WHAT THEY MAY DO THERE (owner,
 * 2026-09-22: 이 프리셋 권한 기능들 전에는 앱 화면 메뉴명으로 선택하고 구분했었거든, 그것보다
 * 불명확한 거 아닌가 싶고… 권한을 준 사람도 받은 사람도 헷갈릴 것 같아).
 *
 * They were right, and the audit that followed said why. The six action names shared ZERO words
 * with the app's own menu — 대시보드 · 베스트 프레임 · 데이터(실시간 관제 · Re-ID 분석 · RedFace)
 * · 레드맵 — so an administrator ticked 「지난 기록 열람」 and the person they granted it to opened
 * 「베스트 프레임」. Worse, the receiving side had never been migrated at all: /mypage still listed
 * five SCREEN names plus two verbs, so the two halves of one grant printed different words in
 * different counts. Now both sides render these six rows, and the row's title is the words the
 * app puts on the tab.
 *
 * The six rows themselves stay. They are a PRIVACY split, not a screen split — 시스템 현황 is the
 * one grant with no personal data in it, which is what lets a technician watch the cameras stay up
 * without seeing a face, and no menu name can say that because it is one panel inside 대시보드.
 * Rolling back to five screens plus two verbs would delete that distinction, which is the reason
 * the split was made (see the commit that split it on privacy grounds).
 *
 * WHAT THE ROWS MAY NOT DO IS LIE. Three of them did, and the audit caught all three: 증거
 * 내보내기 promised a button on 베스트 프레임 that does not exist anywhere in the app; 시스템
 * 현황 and 실시간 감지 named the dashboard's panels in English (SYSTEM, EVENTS) although the
 * Korean app draws them as 시스템 and 이벤트; and 동선 추적 said nothing about needing 인물 검색,
 * although alone it puts two tabs on screen that both refuse their own contents.
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
    // The words the app puts on the tab, so the grant and the menu read the same. `export` is the
    // exception and has to be: it opens no tab at all, it is one button on Redmap.
    actionName: {
      systemStatus: "Dashboard · System",
      liveView: "Dashboard · Live Monitoring",
      history: "Best Frame",
      personSearch: "RedFace · search boxes",
      trail: "Re-ID Analysis · Redmap",
      export: "Evidence export",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "Whether the cameras and servers are up. No personal data",
      liveView: "Detections as they happen — a person, a place, a time",
      history: "The same detections, from before now",
      personSearch: "Turns \u201csomebody was here\u201d into \u201cthis person was here\u201d. Also the search boxes on Data and Redmap",
      trail: "Joins those into one person's route across every camera in scope. Needs Person search alongside it, or both tabs open onto a refusal",
      export: "Takes what Redmap found out of the console as a file",
    } as Record<AppAction, string>,
  },
  ko: {
    groupActions: "할 수 있는 일",
    screenName: { live: "실시간 관제", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      systemStatus: "대시보드 · 시스템",
      liveView: "대시보드 · 실시간 관제",
      history: "베스트 프레임",
      personSearch: "RedFace · 검색창",
      trail: "Re-ID 분석 · 레드맵",
      export: "증거 내보내기",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "카메라와 서버가 살아 있는지 봅니다. 개인정보는 없습니다",
      liveView: "지금 일어나는 감지를 봅니다 — 사람 · 장소 · 시각",
      history: "같은 감지를 지난 시점에서 봅니다",
      personSearch: "\u201c누군가 지나갔다\u201d를 \u201c이 사람이 지나갔다\u201d로 바꿉니다. 데이터·레드맵의 검색창도 함께 열립니다",
      trail: "카메라들을 이어 한 사람의 경로를 만듭니다. 인물 검색이 함께 있어야 두 화면이 내용을 보여줍니다",
      export: "레드맵에서 찾은 것을 파일로 콘솔 밖으로 냅니다",
    } as Record<AppAction, string>,
  },
} as const;
