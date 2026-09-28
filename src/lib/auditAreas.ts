/**
 * WHERE a change was made — as a key, not as a sentence.
 *
 * The activity log used to carry one English sentence per row ("Granted app liveView for Grace
 * Tan"), and the three questions a reader arrives with — who, what, how — were all inside it. The
 * table could not split them without parsing that sentence, and a parser breaks silently every
 * time somebody adds a new wording.
 *
 * So AuditEvent gained `area`, `target` and `action`, and this file holds the closed half: the
 * screen the change was made on. It is closed because it is the one axis worth filtering by, and
 * because a screen name has to be the SAME string every time or the filter grows two entries for
 * one place.
 *
 * NO NEW WORDS. Every label below is lifted from a menu that already exists:
 *   - the project rail's own labels (ProjectSidebar.PROJECT_TABS)
 *   - the sub-tab strips inside 사용자 and 권한 설정 (PortalUsersPage.USER_TABS)
 *   - the app's own tab names (appGrants), written in the same `A > B` shape the app permission
 *     list uses for 「대시보드 > 이벤트」
 * A reader who can find the screen in the rail can find it here, spelled the same way.
 *
 * Duplicated rather than imported: the rail lives in a React component and this table is read by
 * the store, which nothing in src/components may be imported into. If a rail label is reworded,
 * reword it here in the same commit — the pair is listed in each entry's comment.
 *
 * HANDOFF NOTE: these keys are the server's too. When the API starts writing audit rows, it sends
 * `area` as one of these strings and the screen prints the label; it must not send prose, because
 * prose is what this replaced.
 */
export type AuditArea =
  | "vip"
  | "cameras"
  | "server"
  | "accounts"
  | "roster"
  | "presets"
  | "cameraGroups"
  | "license"
  | "records"
  | "requests"
  | "settings"
  | "signup"
  | "redmap";

/**
 * In rail order, so the filter beside the table lists the screens in the order the rail does
 * rather than alphabetically in one language and differently in the other. The three at the end
 * are the places that are not rail rows: the project/team settings sheet, the sign-up page a
 * registration code is redeemed on, and the one app screen that writes into this log.
 */
export const AUDIT_AREA_LABEL: Record<AuditArea, { en: string; ko: string }> = {
  // PROJECT_TABS "vip"
  vip: { en: "VIP Registry", ko: "VIP 등록" },
  // PROJECT_TABS "cameras" — the label says Input Sources because the tab carries uploads too.
  cameras: { en: "Input Sources", ko: "입력 소스" },
  // PROJECT_TABS "server". Mail settings and API keys live on this tab; see its own note.
  server: { en: "Server & API", ko: "서버 및 API" },
  // PROJECT_TABS "users" + USER_TABS "accounts" / "roster"
  accounts: { en: "Users > Accounts", ko: "사용자 > 계정" },
  roster: { en: "Users > Awaiting sign-up", ko: "사용자 > 가입 대기" },
  // PROJECT_TABS "grants" + USER_TABS "presets" / "groups"
  presets: { en: "Permission settings > App permission presets", ko: "권한 설정 > 앱 권한 프리셋" },
  cameraGroups: { en: "Permission settings > Camera groups", ko: "권한 설정 > 카메라 그룹" },
  // PROJECT_TABS "license" / "records" / "requests"
  license: { en: "License", ko: "라이선스" },
  records: { en: "Records", ko: "기록" },
  requests: { en: "Requests", ko: "외부 요청" },
  // PortalShell's settingsCrumb — the sheet that renames a project, sets its time zone, and holds
  // the institution's VIP categories and search purposes.
  settings: { en: "Settings", ko: "설정" },
  // Not a Portal screen at all: the page where a registration code is redeemed. The tab's own
  // footnote already warns that such a row is in this log.
  signup: { en: "Sign-up", ko: "가입" },
  // appGrants rowName.trail — the app screen the evidence bundle leaves from.
  redmap: { en: "Redmap", ko: "레드맵" },
};

export const AUDIT_AREAS = Object.keys(AUDIT_AREA_LABEL) as AuditArea[];
