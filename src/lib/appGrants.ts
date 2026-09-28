import type { AppAction, AppScreen } from "./vcaStore";

/**
 * What each app action is called, where it applies, and what it reveals.
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
 * THE SEARCH BOX BELONGS TO THE SCREEN IT IS ON (2026-09-23, replacing the note that said it
 * belonged to one row of its own). `personSearch` used to be a single grant that opened RedFace
 * AND switched on the search box of three other screens, so the 모니터링 row had no place to say
 * whether that account may search there. It is split now — `liveMonitoringSearch`, `reidSearch` —
 * and the list draws each one as a SECOND STEP on its screen's own row rather than as a row (see
 * `stage` below and GRANT_TREE in PortalShared). Two screens have only one depth: RedFace and
 * 레드맵 are nothing but their search results, so their rows carry a one-cell 「검색」 that states
 * the fact instead of offering a choice that can never be off.
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
      dashboardTrail: "Dashboard > Events \u00b7 trails",
      liveMonitoring: "Data > Live Monitoring",
      liveMonitoringSearch: "Search on Live Monitoring",
      history: "Best Frame",
      reid: "Data > Re-ID Analysis",
      reidSearch: "Search on Re-ID Analysis",
      redface: "Data > RedFace",
      trail: "Redmap",
      export: "Evidence export",
    } satisfies Record<AppAction, string>,
    /**
     * THE SAME ROW, NAMED SHORTER, BECAUSE THE LIST NOW HAS CAPTIONS OVER IT (2026-09-23).
     *
     * `actionName` has to say the place ON ITS OWN, because three readers print it with no caption
     * anywhere near: /mypage's chips, a preset's one-line summary in AccessPresetsTab, and the
     * custom-vs-preset difference sentence (「감독자 − 증거 내보내기」). Inside the grant tree the
     * caption already says 데이터, so 「데이터 > 모니터링」 under it is the same word twice. Hence two
     * names, and `actionName` is NOT touched — renaming it would change those three readers.
     *
     * Kept here beside `actionName` rather than in PortalShared: the two are one wording table and
     * a reader deciding which to use has to see both at once. /mypage imports this module and does
     * not read `rowName`, the same cost `screenName` already carries in this file.
     *
     * The five rows whose names differ are the five that sit under a caption or repeat their
     * group; the other three are already short. Rows fall back to `actionName` when absent, so a
     * new action cannot render an empty title.
     */
    rowName: {
      /* The two kinds of row INSIDE 이벤트 — the app's own filter chips on that panel. */
      liveView: "VIP detections",
      dashboardTrail: "Movement trails",
      systemStatus: "System",
      /* Under its own tab now, so the row names what you may do there rather than repeating
         the tab. The words are the product's own: the operator preset describes itself as watching
         "live and after the fact", and this grant was called 지난 기록 열람 before it was renamed
         to the screen. */
      history: "Past records",
      liveMonitoring: "Live Monitoring",
      reid: "Re-ID Analysis",
      redface: "RedFace",
      /* Not 「Movement trails」 — that is the dashboard row two groups up, and one name over two
         different grants is the thing this list exists to prevent. This one is the map. */
      trail: "Trail map",
      export: "Evidence export",
    } as Partial<Record<AppAction, string>>,
    /** The two depths of one screen, and the one depth of a screen that is nothing but search. */
    stage: { view: "View", viewSearch: "View \u00b7 Search", searchOnly: "Search" },
    /** Over the rows, in the app's own capitals (Navbar.tsx TABS). Not switches — see AppGrantList. */
    groupCaption: { dashboard: "DASHBOARD", bestframe: "BEST FRAME", data: "DATA", redmap: "REDMAP" },
    /* The same two, as a NAME rather than a caption. The permission panel draws them as an
       uppercase band over the rows they hold; the preset table draws them as a row that sits
       beside 베스트 프레임 and 레드맵, where an uppercase word would read as a different kind of
       thing from its own peers. Korean has one form, which is why only English differs. */
    groupName: { dashboard: "Dashboard", bestframe: "Best Frame", data: "Data", redmap: "Redmap" },
    /** A heading inside a tab — see GrantRowDef.subhead. */
    subName: { events: "Events" },
    actionDesc: {
      systemStatus: "Whether the cameras and servers are up. No personal data",
      liveView: "A registered person, as they walk past. Strangers do not appear",
      dashboardTrail: "One person's movement joined across cameras, in that same panel. Redmap is a different grant \u2014 this is the landing screen only",
      liveMonitoring: "EVERYBODY who walks past, including faces nobody registered",
      liveMonitoringSearch: "Turns \u201csomebody was here\u201d into \u201cthis person was here\u201d, on that screen",
      history: "The same detections, from before now",
      reid: "What the server joins up live out of those detections",
      reidSearch: "Looking a particular person up in that result",
      redface: "Face search",
      trail: "One person's route on the map",
      export: "Takes what Redmap found out of the console as a file",
    } satisfies Record<AppAction, string>,
  },
  ko: {
    groupActions: "할 수 있는 일",
    screenName: { live: "모니터링", bestframe: "베스트 프레임", redmap: "레드맵", reid: "Re-ID 분석", redface: "RedFace" } as Record<AppScreen, string>,
    actionName: {
      systemStatus: "대시보드 > 시스템",
      liveView: "대시보드 > 이벤트",
      dashboardTrail: "대시보드 > 이벤트 \u00b7 동선",
      liveMonitoring: "데이터 > 모니터링",
      liveMonitoringSearch: "모니터링에서 검색",
      history: "베스트 프레임",
      reid: "데이터 > Re-ID 분석",
      reidSearch: "Re-ID 분석에서 검색",
      redface: "데이터 > RedFace",
      trail: "레드맵",
      export: "증거 내보내기",
    } satisfies Record<AppAction, string>,
    /** 영어 쪽 주석 참조 — 캡션 아래에서 쓰는 짧은 이름. `actionName`은 목록 밖에서도 쓰므로 그대로 둔다. */
    rowName: {
      liveView: "VIP 감지",
      dashboardTrail: "동선 추적",
      systemStatus: "시스템",
      history: "지난 기록",
      liveMonitoring: "모니터링",
      reid: "Re-ID 분석",
      redface: "RedFace",
      /* 「동선 추적」 — the app's own word: the dashboard sidebar's filter chip and Redmap's own
         「… 동선 추적 중」 both say it. */
      /* 「동선 추적」은 두 묶음 위 대시보드 줄의 이름입니다. 한 이름이 서로 다른 권한 둘을
         가리키면 목록이 하는 일이 사라집니다. 이쪽은 지도입니다. */
      trail: "동선 지도",
      export: "증거 내보내기",
    } as Partial<Record<AppAction, string>>,
    stage: { view: "보기", viewSearch: "보기 \u00b7 검색", searchOnly: "검색" },
    groupCaption: { dashboard: "대시보드", bestframe: "베스트 프레임", data: "데이터", redmap: "레드맵" },
    groupName: { dashboard: "대시보드", bestframe: "베스트 프레임", data: "데이터", redmap: "레드맵" },
    subName: { events: "이벤트" },
    actionDesc: {
      systemStatus: "카메라와 서버가 살아 있는지 봅니다. 개인정보는 없습니다",
      liveView: "등록된 사람이 지나갈 때만 올라옵니다",
      dashboardTrail: "같은 패널에서 한 사람의 이동을 카메라들 사이로 이어 붙인 줄입니다. 레드맵은 별개 권한이고, 이건 첫 화면에만 해당합니다",
      liveMonitoring: "등록되지 않은 사람까지 지나가는 모두를 봅니다",
      liveMonitoringSearch: "\u201c누군가 지나갔다\u201d를 \u201c이 사람이 지나갔다\u201d로 바꿉니다",
      history: "같은 감지를 지난 시점에서 봅니다",
      reid: "모니터링에서 잡힌 사람들을 서버가 실시간으로 이어 붙인 결과를 봅니다",
      reidSearch: "그 결과에서 특정 인물을 직접 찾습니다",
      redface: "얼굴로 찾습니다",
      trail: "지도 위에 한 사람의 경로를 그립니다",
      export: "레드맵에서 찾은 것을 파일로 콘솔 밖으로 냅니다",
    } satisfies Record<AppAction, string>,
  },
} as const;
