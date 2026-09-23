import type { AppAction, AppScreen } from "./vcaStore";

/**
 * What the seven actions are called, where each one applies, and what it reveals.
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
 * THE SEARCH BOX BELONGS TO ONE ROW, AND IT SAYS SO (2026-09-23). It appears on three screens —
 * 모니터링, Re-ID 분석, 레드맵 — and `personSearch` is the single grant that opens all three. Naming
 * 「· 검색창」 on each of those screens' own rows was considered and rejected: those rows do not open
 * it, so a title saying otherwise would be the screen claiming something the gate does not do. The
 * places are listed in this row's description instead.
 *
 * THE SEVENTH ROW IS A PRIVACY SPLIT TOO (2026-09-23, owner: 이걸 같이 보면 안 되는 게, 데이터의
 * 모니터링에서는 모르는 사람도 모두 감지하고 촬영하고 있어서). 「VIP 감지」(대시보드) and
 * 「실시간 관제」(데이터) were one grant, and they are not one thing: the first shows people the
 * customer registered, the second shows every passer-by including faces nobody enrolled. One
 * permission meant that anybody who could watch VIP alerts could also watch and film strangers.
 * The three built-in presets keep both, so nothing changed for an existing account — the split is
 * what makes "VIP alerts only" grantable at all.
 *
 * The rows themselves stay. They are a PRIVACY split, not a screen split — 시스템 현황 is the
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
      systemStatus: "Dashboard > System",
      liveView: "Dashboard > Events",
      liveMonitoring: "Data > Live Monitoring",
      history: "Best Frame",
      personSearch: "Data > RedFace · search boxes",
      reid: "Data > Re-ID Analysis",
      trail: "Redmap",
      export: "Evidence export",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "Whether the cameras and servers are up. No personal data",
      liveView: "The landing screen's events panel: a registered person walking past. Strangers do not appear. The trail rows in the same panel need the Redmap grant",
      liveMonitoring: "EVERYBODY who walks past, including faces nobody registered. The screen opens without a search; the search box needs Person search",
      history: "The same detections, from before now",
      personSearch: "Turns \u201csomebody was here\u201d into \u201cthis person was here\u201d. It also opens the search box on Live Monitoring, on Re-ID Analysis and on Redmap — one grant for all three",
      reid: "What the server joins up live from the people Live Monitoring detects. The screen opens without a search; searching for somebody needs Person search",
      trail: "Draws one person's route on the map. The screen has no unsearched state, so it needs Person search alongside it. It also switches on the trail rows in the dashboard's events panel",
      export: "Takes what Redmap found out of the console as a file",
    } as Record<AppAction, string>,
  },
  ko: {
    groupActions: "할 수 있는 일",
    screenName: { live: "모니터링", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      systemStatus: "대시보드 > 시스템",
      liveView: "대시보드 > 이벤트",
      liveMonitoring: "데이터 > 모니터링",
      history: "베스트 프레임",
      personSearch: "데이터 > RedFace · 검색창",
      reid: "데이터 > Re-ID 분석",
      trail: "레드맵",
      export: "증거 내보내기",
    } as Record<AppAction, string>,
    actionDesc: {
      systemStatus: "카메라와 서버가 살아 있는지 봅니다. 개인정보는 없습니다",
      liveView: "첫 화면의 이벤트 패널입니다. 등록된 사람이 지나갈 때 올라오고, 모르는 사람은 나오지 않습니다. 같은 패널의 동선 줄은 레드맵 권한이 있어야 보입니다",
      liveMonitoring: "등록되지 않은 사람까지 지나가는 모두를 봅니다. 화면은 검색 없이도 열리고, 검색창은 인물 검색이 있어야 켜집니다",
      history: "같은 감지를 지난 시점에서 봅니다",
      personSearch: "\u201c누군가 지나갔다\u201d를 \u201c이 사람이 지나갔다\u201d로 바꿉니다. 모니터링 · Re-ID 분석 · 레드맵의 검색창도 이 권한 하나로 함께 열립니다",
      reid: "모니터링에서 잡힌 사람들을 서버가 실시간으로 이어 붙인 결과를 봅니다. 화면은 검색 없이도 열리고, 직접 찾는 것은 인물 검색이 있어야 합니다",
      trail: "지도 위에 한 사람의 경로를 그립니다. 검색으로만 결과가 나오는 화면이라 인물 검색이 함께 있어야 열립니다. 대시보드 이벤트의 동선 줄도 이 권한이 켭니다",
      export: "레드맵에서 찾은 것을 파일로 콘솔 밖으로 냅니다",
    } as Record<AppAction, string>,
  },
} as const;
