"use client";

import type { ComponentType } from "react";
import { Crown } from "lucide-react";
import { usePortalLanguage } from "@/lib/i18n";
import { getComplianceConfig } from "@/lib/complianceConfig";

export type DetailTab = "overview" | "cameras" | "vip" | "license" | "server" | "users" | "activity" | "searchlog" | "requests";

interface IconProps {
  color: string;
}

/*
 * Rail icons are stroked 1.2px, not the 1.4px every other icon in Portal uses.
 *
 * Not an inconsistency: a pale stroke on a near-black ground spreads visually — the eye reads it
 * a fraction heavier than the identical stroke on white — so keeping the number would have meant
 * not keeping the weight. Same reason the labels here sit a step lighter than elsewhere.
 */
/** The panel-with-a-rail mark every console uses for "collapse the sidebar". */
function RailToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.25" y="2.75" width="13.5" height="12.5" rx="3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6.75 3.25V14.75" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function OverviewIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="9" y="2" width="5" height="5" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="2" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.2"/>
      <rect x="9" y="9" width="5" height="5" rx="1" stroke={color} strokeWidth="1.2"/>
    </svg>
  );
}

function CamerasIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H5L5.8 2.8C5.98 2.53 6.28 2.37 6.6 2.37H9.4C9.72 2.37 10.02 2.53 10.2 2.8L11 4H12.5C13.33 4 14 4.67 14 5.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V5.5Z" stroke={color} strokeWidth="1.2"/>
      <circle cx="8" cy="8.3" r="2.3" stroke={color} strokeWidth="1.2"/>
    </svg>
  );
}

/**
 * The crown the app already uses for VIP — Sidebar, the map pins and the detection chips all draw
 * lucide's Crown at this size. This was a hand-drawn five-pointed star, which matched neither the
 * app's icon nor the idea: a star is a favourite or a rating, and the registry is a watchlist of
 * specific people.
 *
 * 1.8, which renders 1.2px at this size — the rail's exception to the console-wide 1.4.
 * A light stroke on a dark ground reads heavier than the same stroke on white (irradiation), so
 * matching the number would not match the weight. See the note on the icons above.
 */
function VipIcon({ color }: IconProps) {
  return <Crown size={16} strokeWidth={1.8} color={color} />;
}

function LicenseIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 2.5C4 2.22 4.22 2 4.5 2H9.5L12 4.5V13.5C12 13.78 11.78 14 11.5 14H4.5C4.22 14 4 13.78 4 13.5V2.5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M9.5 2V4.5H12" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M6 8.7H10M6 10.7H10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

function ServerIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.5" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1.2"/>
      <rect x="2" y="9" width="12" height="4.5" rx="1.2" stroke={color} strokeWidth="1.2"/>
      <circle cx="4.3" cy="4.75" r="0.7" fill={color}/>
      <circle cx="4.3" cy="11.25" r="0.7" fill={color}/>
    </svg>
  );
}

/** A magnifier over a ruled page — a look-up that left a line behind. */
function SearchLogIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2.6C3 2.32 3.22 2.1 3.5 2.1H10L13 5.1V13.4C13 13.68 12.78 13.9 12.5 13.9H3.5C3.22 13.9 3 13.68 3 13.4V2.6Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="7.4" cy="8.4" r="2.1" stroke={color} strokeWidth="1.2"/>
      <path d="M8.95 9.95 10.6 11.6" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

/** A tray with something leaving it — the register of what was asked of this project. */
function RequestsIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.6 9.4h3l.9 1.6h3l.9-1.6h3" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.6 9.4 4.2 3.6c.07-.27.32-.46.6-.46h6.4c.28 0 .53.19.6.46l1.6 5.8v3.1c0 .28-.22.5-.5.5H3.1a.5.5 0 0 1-.5-.5V9.4Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}


function ActivityIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3.6V8l2.8 1.7" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.4 8a5.6 5.6 0 1 0 1.7-4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M2.2 2.6v2.6h2.6" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UsersIcon({ color }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.3" r="2.2" stroke={color} strokeWidth="1.2"/>
      <path d="M1.8 13c0-2.21 1.88-4 4.2-4s4.2 1.79 4.2 4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="11.6" cy="6" r="1.7" stroke={color} strokeWidth="1.2"/>
      <path d="M9.9 13c0.1-1.76 1.6-3.1 3.3-3.1 1.02 0 1.94 0.46 2.55 1.18" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

/**
 * The three parts of the rail.
 *
 * It was two, on the reasoning that six flat tabs gave no clue they answered two different
 * questions — the project's day-to-day against the paperwork around it. That held until MANAGE
 * reached seven entries, at which point the heading had stopped sorting anything: a contract, a
 * server, a list of people and four registers do not belong under one word.
 *
 * The four that moved are one kind of thing. "What changed", "who looked", "what was handed out"
 * and "what was asked to be erased" are all answers to the same question — what happened here,
 * and what left — and they are read by the same person on the same errand, usually when somebody
 * outside has asked. Splitting them out leaves 3 · 3 · 4, and every heading true again.
 *
 * Ordered most-touched to least, the way the tabs inside each group already are: the day-to-day,
 * then the things changed when the site changes, then the records read on a review cycle.
 *
 * English in caps, Korean not: caps do nothing to Hangul, and CSS text-transform would leave the
 * two languages drawing different headings — the same reason MetricCard's label dropped it.
 */
export type NavGroup = "workspace" | "manage" | "records";
export const NAV_GROUPS: { id: NavGroup; label: { en: string; ko: string } }[] = [
  { id: "workspace", label: { en: "WORKSPACE", ko: "작업 공간" } },
  { id: "manage", label: { en: "MANAGE", ko: "관리" } },
  { id: "records", label: { en: "RECORDS", ko: "기록" } },
];

export const PROJECT_TABS: { id: DetailTab; group: NavGroup; label: { en: string; ko: string }; icon: ComponentType<IconProps> }[] = [
  { id: "overview", group: "workspace", label: { en: "Overview", ko: "개요" }, icon: OverviewIcon },
  // VIP above the sources (asked for 2026-09-03): what the project watches FOR is the list an
  // operator maintains day to day; the camera and upload list is the plumbing under it.
  { id: "vip", group: "workspace", label: { en: "VIP Registry", ko: "VIP 등록" }, icon: VipIcon },
  // The id stays "cameras" — it is a route key, and renaming it would only churn every call site.
  // The label changed because the tab now lists uploaded footage alongside cameras.
  { id: "cameras", group: "workspace", label: { en: "Input Sources", ko: "입력 소스" }, icon: CamerasIcon },

  // MANAGE, most-touched to least: servers change when the site changes, people are added and
  // removed all year, and a licence is signed once and opened when somebody asks about the bill
  // or runs out of channels.
  { id: "server", group: "manage", label: { en: "Server & API", ko: "서버 및 API" }, icon: ServerIcon },
  { id: "users", group: "manage", label: { en: "Users & Permissions", ko: "사용자 및 권한" }, icon: UsersIcon },
  { id: "license", group: "manage", label: { en: "License", ko: "라이선스" }, icon: LicenseIcon },

  // RECORDS, in the order the four questions get asked. "What changed" and "who looked" are the
  // two an access review runs on, and they are read together — it starts on one and finishes on
  // the other. Then the one register of what the outside world asked for. It holds both kinds —
  // somebody wanting footage of a person, and that person wanting it all gone — because they are
  // the same errand from opposite directions, and the person handling them arrives asking "what
  // is open", not "is anything open under each of two tabs".
  { id: "activity", group: "records", label: { en: "Activity log", ko: "변경 기록" }, icon: ActivityIcon },
  { id: "searchlog", group: "records", label: { en: "Search log", ko: "조회 기록" }, icon: SearchLogIcon },
  { id: "requests", group: "records", label: { en: "Requests", ko: "외부 요청" }, icon: RequestsIcon },
];

interface ProjectSidebarProps {
  /** Product wordmark, at the very top of the rail. */
  brand?: string;
  /** Collapses and expands the rail. Lives here rather than in the top bar: it is the rail's own
   *  control, and with the rail running the full height the bar has no claim on it. */
  onToggleCollapse?: () => void;
  toggleLabel?: string;
  /** The team switcher, passed in rather than built here — the shell owns what switching means. */
  team?: React.ReactNode;
  /** The project switcher, same. */
  project?: React.ReactNode;
  tab: DetailTab;
  /**
   * How many things each tab holds, by tab id. Rendered as a badge on the right of the row —
   * the reference rail does this and it is worth copying: "VIP registry 104" answers, from the
   * nav, the question the tab is usually opened to ask. Omit a tab to leave its row bare, which
   * is right for Overview (it counts nothing) and for tabs whose figure is not a count.
   */
  counts?: Partial<Record<DetailTab, number>>;
  onTabChange: (tab: DetailTab) => void;
  collapsed: boolean;
  /**
   * True while Portal's Settings screen is showing, so no nav tab looks current —
   * that screen belongs to the account, not to any tab of this project.
   */
  settingsOpen: boolean;
}

export default function ProjectSidebar({ brand, team, project, onToggleCollapse, toggleLabel, tab, onTabChange, collapsed, settingsOpen, counts }: ProjectSidebarProps) {
  const [lang] = usePortalLanguage();
  /* The search log only exists where the purpose requirement does — it is the read half of the
     same feature, and a log that can never fill is a rail entry leading to an empty room. */
  const searchLogEnabled = getComplianceConfig().requireSearchPurpose;
  return (
    <div
      style={{
        /* 248, not 212. At the old width a nav row had ~100px left for its label once the icon,
           the gaps and a count badge were paid for — "Users & Permissions" and the team's full
           name both ellipsised, and a rail whose labels you cannot read is a rail you have to
           learn by position.

           It went to 272 for a while, to fit two proper nouns nobody can shorten — "City of
           Singapore — Smart Infrastructure Office" over "Marina Bay & CBD Surveillance Network".
           232 now that both wrap to a second line instead. Measured off Mobbin, consoles of this
           kind sit at 195-225px (PlanetScale, Replit, Grok, Fibery, Cloudflare), and the floor
           here is about 200: "Users & Permissions" at 13px needs 122px of label, plus 24 of rail
           padding, 24 of row padding, a 16px icon and its 12px gap. 232 leaves the longest label
           whole with room to spare and keeps the two names inside two lines. The content column pays for what is left; its own cap decides how wide the page
           gets anyway. */
        width: collapsed ? "60px" : "232px",
        flexShrink: 0,
        display: "flex", flexDirection: "column",
        /*
         * gray-900, and no rule down the right edge — against a white canvas the tone IS the edge.
         *
         * It was gray-50, a couple of percent of tint, which left the rail and the page reading as
         * one surface with a list floating on the left of it. Dark says "this is the furniture, that
         * is the work" without a line, which is what the reference dashboard does with its own
         * near-black rail. Same value the metric figures and the licence hero already use, so this
         * is the palette's existing dark, not a new one.
         */
        /*
          gray-900, with the product's colour bled into the top of it.
          A flat near-black rail beside a primary-50 page read as two unrelated applications
          bolted together — nothing in the furniture said whose furniture it was. The gradient is
          primary-300 at 12% fading out over the first 260px, so it sits behind the wordmark and
          the project card and is gone by the time the menu starts: a tint you notice only if you
          look for it, and no new colour in the palette — the same trick the detections chart uses
          for the area under its line. The lavender step rather than the saturated one, because
          this ground is a navy and primary-400 over navy reads blue (see the note on the current
          nav row).
        */
        backgroundColor: "var(--gray-900)",
        backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--primary-300) 12%, transparent) 0%, color-mix(in srgb, var(--primary-300) 0%, transparent) 260px)",
        /* 6px of top padding, not 16: the wordmark's row is 40px tall, so its centre lands at
           6 + 20 = 26px — exactly the middle of the 52px top bar beside it. The two are the same
           kind of thing (the console's name, the trail into it) and were sitting on different
           lines. The bottom keeps 16. */
        padding: collapsed ? "6px 8px 16px" : "6px 12px 16px",
        transition: "width .15s ease",
      }}
    >
      <style>{`
        .portal-rail-toggle{transition:background-color .12s,color .12s}
        .portal-rail-toggle:hover{background-color:var(--gray-800);color:white}
        .portal-navitem{transition:background-color .12s}
        .portal-navitem:hover:not([data-active="true"]){background-color:var(--gray-800)}
        .portal-navmenu-item{transition:background-color .12s}
        .portal-navmenu-item:hover{background-color:var(--gray-100)}
      `}</style>
      {/*
        Which workspace, above which page of it.

        The wordmark and both switchers were in the top bar. With the rail running the full height
        of the window they belong here: the console's name at the top of the column that is the
        console's frame, and under it the team and project the navigation below is scoped to. The
        bar is left to say only which page of that project you are on.

        Hidden when collapsed: a 60px column cannot hold a team name, and a switcher you cannot read
        is a button that opens a surprise.
      */}
      {/*
        The identity block keeps its shape when the rail collapses: a 40px brand row, a 34px team
        row, a 60px project card, and the same 6px gaps and 22px foot. Each row is pinned to that
        height rather than left to its padding, and the collapsed rail fills them with the same two
        controls drawn as squares.

        This is what the request was about: with the switchers simply dropped when collapsed, the
        nav list jumped up by the height of both of them, so the row you were pointing at moved out
        from under the cursor the moment you clicked collapse. Reserving the space also keeps the
        team and the project reachable from a 60px rail, which is what every console with a
        collapsible rail does with them.
      */}
      {(brand || team || project) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "22px" }}>
          {(brand || onToggleCollapse) && (
            <div style={{
              height: "40px", display: "flex", alignItems: "center", gap: "8px",
              padding: collapsed ? 0 : "0 4px 0 10px",
              justifyContent: collapsed ? "center" : undefined,
            }}>
              {!collapsed && brand && <p style={{ fontSize: "15px", fontWeight: 800, color: "white", letterSpacing: "-0.2px", flex: 1, minWidth: 0 }}>{brand}</p>}
              {onToggleCollapse && (
                <button className="portal-rail-toggle" onClick={onToggleCollapse} title={toggleLabel}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "8px", border: "none", background: "none", cursor: "pointer", color: "var(--gray-400)", flexShrink: 0 }}>
                  <RailToggleIcon />
                </button>
              )}
            </div>
          )}
          {/* minHeight, not height: the project's name is allowed a second line (see the clamp in
              ProjectSwitcher), and a fixed 60 would have cut it. Collapsed still reserves exactly
              60, so the nav below lines up in both states for any name that fits one line — a
              two-line name pushes the expanded nav down by that line, which is the honest
              trade for being able to read the name at all. */}
          {project && (
            /* Collapsed reserves 74px, expanded starts at 60 and grows.
               The expanded card holds a two-line project name plus its "Singapore · Smart City"
               line, which comes out around 74px for the names this product actually has — and the
               collapsed rail, holding one 44px square, was reserving 60. That 14px was the whole
               difference: the icons below sat higher when the rail was shut than when it was open.
               Reserving the taller of the two states keeps the menu on the same line either way.
               A project with a name short enough to fit one line drifts the other way by that
               much, which is the harmless direction — nothing above the menu moves, the menu just
               starts 14px lower than it strictly needs to. */
            <div style={{ minHeight: collapsed ? "74px" : "60px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "center", justifyItems: collapsed ? "center" : "stretch" }}>
              {project}
            </div>
          )}
        </div>
      )}

      {/* The nav list is the scroller, not the rail: it is the only part that could ever be long
          enough to need one, and an `overflow: auto` on the rail itself would clip anything a
          child wanted to float outside it. */}
      {/* Top-aligned, not centred.
          The list used to sit in the middle of the rail, which worked while it was six unlabelled
          rows and stopped working the moment it became two named groups: a heading belongs above
          the thing it names, and a pair of them floating at the waist of a full-height dark column
          reads as a fragment of a longer list scrolled into view. Nav starts where the page does. */}
      {/* overflowX hidden as well as overflowY auto: `overflow-y: auto` on its own makes the x
          axis `auto` too, so one row wider than 212px — a long team name, an English tab label —
          put a horizontal scrollbar under the whole rail. Nothing here should ever scroll
          sideways; what does not fit ellipsises. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "4px" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: gi === 0 ? 0 : "18px" }}>
            {/* Collapsed, a heading has nowhere to go — 60px holds an icon and nothing else — so the
                groups are told apart by a rule instead. */}
            {collapsed
              ? gi > 0 && <div style={{ height: "1px", backgroundColor: "var(--gray-800)", margin: "0 8px 6px" }} />
              : (
                <p style={{
                  fontSize: "10px", fontWeight: 600, letterSpacing: "0.4px",
                  color: "var(--gray-500)", padding: "0 14px", marginBottom: "2px",
                }}>{group.label[lang]}</p>
              )}
            {PROJECT_TABS.filter(t => t.group === group.id).filter(t => t.id !== "searchlog" || searchLogEnabled).map(t => {
              const Icon = t.icon;
              const active = tab === t.id && !settingsOpen;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  title={collapsed ? t.label[lang] : undefined}
                  data-active={active}
                  className="portal-navitem"
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    border: "none", cursor: "pointer", borderRadius: "10px",
                    padding: collapsed ? "12px 0" : "11px 12px",
                    position: "relative",
                    /*
                     * The current row: a primary wash, and the label and icon in white.
                     *
                     * A lighter step of the rail's own colour with white text, which is what
                     * every dark rail worth copying does —
                     * Revolut Business, Railway, TIDAL and Visual Electric all mark the current
                     * row with a lighter step of the rail's own colour and white text. None of
                     * them uses a light pill: on a near-black column that reads as a light-mode
                     * element pasted in, and it pulls harder than the page beside it.
                     *
                     * The weak contrast was never the text colour, it was the fill. gray-800 is
                     * one small step off gray-900, gray-700 is visible, and gray-600 — where this
                     * ended up — is the first step that still reads as current from across a
                     * desk rather than only when you look for it. Earlier
                     * attempts put the accent here instead — a solid primary pill (it shouted), a
                     * bar down the left edge (a mark beside the row, not the row), primary-300
                     * text (better, but a coloured label on a nearly invisible fill).
                     */
                    /*
                     * The current row is a primary wash, not a grey one.
                     *
                     * gray-600 was legible but it was the rail telling you where you are in a
                     * colour that means nothing — every console worth copying marks the current
                     * row in its own colour once the fill is dark enough to carry it.
                     *
                     * primary-300 at 22%, not primary-400 at 26%. gray-900 is a navy, and a
                     * saturated indigo laid over navy comes out as a hard electric blue — the row
                     * stopped reading as a tint of the rail and started reading as a blue chip
                     * dropped onto it. The lighter step is a lavender: mixed at the same strength
                     * it lands around #2a2e59, still clearly lighter than the gray-800 hover, but
                     * quiet. White text and a white icon still, for the same reason as before: a
                     * coloured label on a coloured fill is two things competing.
                     */
                    backgroundColor: active ? "color-mix(in srgb, var(--primary-300) 22%, transparent)" : undefined,
                    color: active ? "white" : "var(--gray-300)",
                    fontSize: "13px", fontWeight: active ? 600 : 500,
                    whiteSpace: "nowrap", width: "100%",
                  }}
                >
                  <span style={{ display: "flex", flexShrink: 0 }}><Icon color={active ? "white" : "var(--gray-300)"} /></span>
                  {!collapsed && (
                    <>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{t.label[lang]}</span>
                      {/* The count, right-aligned. gray-800 on the resting row and gray-700 on the
                          current one, so the badge stays a step lighter than whatever is under it
                          instead of disappearing into the active fill. */}
                      <span style={{ flex: 1 }} />
                      {counts?.[t.id] !== undefined && (
                        <>
                          <span style={{
                            fontSize: "10px", fontWeight: 600, color: "var(--gray-400)",
                            backgroundColor: active ? "rgba(255, 255, 255, 0.14)" : "var(--gray-800)",
                            padding: "2px 6px", borderRadius: "6px", flexShrink: 0,
                          }}>{counts[t.id]}</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/*
        The team, at the foot of the rail.

        It used to sit between the wordmark and the project card, which put a bare line of text
        on top of a bordered box — the box read as the start of something and there was something
        above it. It also pushed the nav down by however many lines the organisation's name took.

        Down here it is where an account block usually is, and the reading order at the top is the
        one that matters: the console, the project, its pages. Which organisation you are in is
        answered once a session, not once a click, and switching it is still one click from here.
      */}
      {team && (
        <div style={{
          marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--gray-800)",
          minHeight: "34px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)",
          alignItems: "center", justifyItems: collapsed ? "center" : "stretch", flexShrink: 0,
        }}>
          {team}
        </div>
      )}
    </div>
  );
}
