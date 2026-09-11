"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalProjectDetailPage from "./PortalProjectDetailPage";
import PortalEmptyState from "./PortalEmptyState";
import { NewTeamModal } from "./TeamSwitcher";
import ProjectSwitcher from "./ProjectSwitcher";
import PortalNewProjectWizard from "./PortalNewProjectWizard";
import TeamSwitcher from "./TeamSwitcher";
import ProjectSidebar, { PROJECT_TABS, type DetailTab } from "./ProjectSidebar";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import PortalSettingsPage from "./PortalSettingsPage";
import PortalAccountMenu from "./PortalAccountMenu";
import { ToastProvider } from "../Toast";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { useVcaStore, canEnterApp, canEnterPortal, currentPortalUser, SIGNED_IN_USER, type ProjectType, type Team } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, BREADCRUMB_TEAM_MAX_WIDTH } from "./PortalShared";

const T = {
  en: {
    noTeam: "No Team", expand: "Expand sidebar", collapse: "Collapse sidebar",
    newProject: "New project", settingsCrumb: "Settings", close: "Close",
    requestTitle: "Adding another project",
    requestBody: "A project is a licensed site. Its channels and term come from the contract, so it is set up during installation rather than from this console.",
    requestManager: "Account manager",
    requestNoManager: "No account manager is recorded for this team. Contact whoever handled your installation.",
    fleetTitle: (online: number, offline: number) => `${online} cameras online, ${offline} offline — open Input Sources`,
  },
  ko: {
    noTeam: "팀 없음", expand: "사이드바 펼치기", collapse: "사이드바 접기",
    newProject: "새 프로젝트", settingsCrumb: "설정", close: "닫기",
    requestTitle: "프로젝트를 더 추가하려면",
    requestBody: "프로젝트는 라이선스가 걸린 현장입니다. 채널과 기간이 계약에서 나오기 때문에, 이 콘솔이 아니라 설치 과정에서 세팅됩니다.",
    requestManager: "담당자",
    requestNoManager: "이 팀에 등록된 담당자가 없습니다. 설치를 담당한 곳으로 문의하세요.",
    fleetTitle: (online: number, offline: number) => `카메라 ${online}대 온라인, ${offline}대 오프라인 — 입력 소스 열기`,
  },
} as const;

function BreadcrumbChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 1L5.5 4L2.5 7" stroke="var(--gray-500)" strokeWidth="1.12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}


// Project switching/creation stays header-only (GCP's "Select a resource" pattern). Once inside
// a project, its own tools (Overview/Cameras/VIP Registry/License/Users & Permissions) live in a
// collapsible left sidebar — matching GCP's per-project nav rail — toggled by the header hamburger.
/**
 * Where another project comes from, said to the person asking for one.
 *
 * A named person rather than a form: Portal cannot create the thing being asked for, so a
 * "request" that goes nowhere would be worse than the create button it replaced. The team's
 * account manager is who signs the contract that carries the channels.
 */
function RequestProjectModal({ team, onClose }: { team: Team; onClose: () => void }) {
  useEscapeKey(onClose);
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const m = team.accountManager;
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 400, backgroundColor: "rgba(14,22,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
        <div style={{ padding: "20px 20px 0" }}>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)" }}>{t.requestTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.55, marginTop: "8px" }}>{t.requestBody}</p>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ padding: "14px 16px", backgroundColor: "var(--gray-50)", border: BORDER, borderRadius: "10px" }}>
            {m ? (<>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--gray-400)", letterSpacing: "0.4px" }}>{t.requestManager.toUpperCase()}</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", marginTop: "4px" }}>{m.name}</p>
              <p style={{ fontSize: "12px", color: "var(--gray-500)" }}>{m.email}</p>
            </>) : (
              <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.7 }}>{t.requestNoManager}</p>
            )}
          </div>
        </div>
        <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "flex-end" }}>
          <button className="portal-btn-outline" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Landed here from the signup wizard's "Start Creating Your Project" — open straight into the
  // New Project Wizard for the team it just created. `type` may still arrive from an older link;
  // the wizard treats it as a pre-selection, and nothing sets it any more.
  const newProjectParam = searchParams.get("newProject") === "1";
  const typeParam = searchParams.get("type");
  const defaultWizardType: ProjectType | undefined = typeParam === "smart_city" || typeParam === "smart_school" ? typeParam : undefined;
  const teamIdParam = searchParams.get("teamId");
  // Which project tab to open on. The tab used to be state only, so /portal always landed on
  // Overview and there was no way to send someone "the Cameras tab of this project" — every link
  // to Portal was a link to the same screen. Read once, as the initial value: after that the tab is
  // component state, so clicking around does not push a history entry per tab.
  const tabParam = searchParams.get("tab");

  const [showWizard, setShowWizard] = useState(newProjectParam);
  /**
   * Raised when the create dialog is cancelled, to put the project picker back on screen.
   *
   * "New project" is reached from inside that picker, so cancelling should leave the reader
   * where the click started — not on a bare console with the list they were choosing from
   * closed. See ProjectSwitcher.reopenSignal.
   *
   * Not raised when the dialog is cancelled from the empty-team landing: there is no picker
   * behind it to go back to, and the landing page is itself the place to be.
   */
  const [switcherReopen, setSwitcherReopen] = useState(0);
  /** The "how do I get another project" notice, opened from the switcher. */
  const [showRequest, setShowRequest] = useState(false);
  // A fresh installation can arrive with no team at all — one company may run several teams here,
  // so the supplier does not necessarily create one during handover. The landing page then asks
  // for the team instead of the project, and this holds that modal.
  const [showNewTeam, setShowNewTeam] = useState(false);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  // Read here only to count them for the rail's badges — see the `counts` prop below.
  const cameras = useVcaStore(s => s.cameras);
  const persons = useVcaStore(s => s.persons);
  const addTeam = useVcaStore(s => s.addTeam);
  /**
   * The account viewing Portal, where there is one. Two things hang off it: whether "Exit to App"
   * is a door this person actually has, and whether they belong on this route at all.
   *
   * HANDOFF NOTE: this is a client-side check against the stand-in identity, so it is a UI
   * correction, not a security boundary — someone who types /portal with the bundle in hand can
   * still render it. The real gate is the server refusing Portal's endpoints to a role of "none";
   * this exists so the front end stops offering doors that are not there, and so the check has a
   * home the moment a session does.
   */
  // Also what the sidebar footer names. It used to name "the first account with permission admin",
  // which was nobody at all while every seeded account was an owner or app-only, and the wrong
  // person the moment one of them became an admin — the footer is meant to say who you are.
  // Falls back to the stand-in identity, because currentPortalUser answers undefined for the demo
  // default (its address is in no account list) — and a footer meant to say who you are showed
  // nothing at all. Name and address only; the account's role and doors still come from `me`.
  const me = useVcaStore(s => currentPortalUser(s.portalUsers));
  const locked = !!me && !canEnterPortal(me.permission);
  useEffect(() => {
    if (locked) router.replace("/");
  }, [locked, router]);
  // Resolve ?teamId= against the real list rather than trusting it: an id that matches nothing used
  // to flow straight into the New Project wizard, which would have filed the project under an
  // team that does not exist. Falling back to the first team keeps the header and
  // the wizard describing the same place.
  const currentOrg = teams.find(o => o.id === teamIdParam) ?? teams[0];
  const currentOrgId = currentOrg?.id ?? "";
  // Everything below this line is the current team's, not the whole installation's. Before the
  // header could switch teams this distinction cost nothing, because there was only ever one team
  // on screen; now a shell that kept reading the global list would show one team's name over
  // another team's projects.
  const teamProjects = projects.filter(p => p.teamId === currentOrgId);
  const cancelWizard = () => {
    setShowWizard(false);
    if (teamProjects.length > 0) setSwitcherReopen(n => n + 1);
  };
  // The selection is *derived*, not stored: hold the id the user picked, but fall back to this
  // team's first project whenever that id is not one of them. Keeping it in plain state instead
  // meant a team switch left the previous team's project selected until an effect caught up, and
  // for one render the detail page rendered a project the breadcrumb no longer claimed.
  const [pickedProjectId, setPickedProjectId] = useState("");
  const currentProjectId = teamProjects.some(p => p.id === pickedProjectId)
    ? pickedProjectId
    : (teamProjects[0]?.id ?? "");
  // This project's cameras, counted once for the rail's badge and the bar's fleet figure.
  const projectCameras = cameras.filter(c => c.projectId === currentProjectId);
  const fleetOnline = projectCameras.filter(c => c.status === "online").length;
  const fleetOffline = projectCameras.length - fleetOnline;
  const [tab, setTabState] = useState<DetailTab>(
    // A tab the rail does not offer is not a tab you can land on. searchlog is filtered out of
    // the rail and gated in the body while requireSearchPurpose is off, so ?tab=searchlog used
    // to draw a "Search log" breadcrumb over an empty column — a link somebody bookmarked
    // before the feature was scoped out of v1, answered with a blank page.
    () => {
      const named = PROJECT_TABS.find(t => t.id === tabParam)?.id;
      if (!named) return "overview";
      if (named === "searchlog" && !getComplianceConfig().requireSearchPurpose) return "overview";
      return named as DetailTab;
    },
  );
  /**
   * Which screen you are on lives in the address bar as well as in state, so a refresh comes back
   * to the screen you refreshed.
   *
   * It was state only: the tab was read from ?tab= once at mount and never written back, so F5 on
   * Users & Permissions returned to the Overview — and a link to a screen could not be sent to
   * anybody. history.replaceState rather than router.replace: this is the same page with a
   * different view of it, so it should not add an entry to the back stack or ask Next to
   * re-render the route. The reader still gets the back button for team switches, which are real
   * navigations.
   */
  const syncUrl = (nextTab: DetailTab, nextAccount: boolean) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    // Overview is the default, so it stays out of the URL — a bare /portal should not become
    // /portal?tab=overview just by being looked at.
    if (nextTab === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", nextTab);
    if (nextAccount) url.searchParams.set("view", "account");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  const setTab = (next: DetailTab) => { setTabState(next); syncUrl(next, false); };
  const setShowAccount = (next: boolean) => { setShowAccountState(next); syncUrl(tab, next); };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lang] = usePortalLanguage();
  const t = T[lang];

  useEffect(() => {
    if (newProjectParam) router.replace("/portal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFromSwitcher = (projectId: string) => {
    setPickedProjectId(projectId);
    // Leave Settings too. setTab writes the address bar without `view=account`, so staying on
    // Settings left the URL claiming Overview — and a refresh then silently moved you there.
    setShowAccount(false);
    setTab("overview");
    setShowWizard(false);
  };

  const deployedFromWizard = (projectId: string) => {
    setShowWizard(false);
    if (projectId) {
      setPickedProjectId(projectId);
      setTab("overview");
    }
  };

  // The current team lives in the URL, so switching is a navigation. That also means the back
  // button returns to the team you came from, and a link to a particular team is shareable —
  // both of which a piece of component state would have thrown away.
  // Creating the first team lands on that team's empty state, which now names the person who
  // provisions its first project rather than offering a wizard. The team is still the thing the
  // customer creates; the project is not. See PortalEmptyState.
  const createFirstTeam = (name: string) => {
    const teamId = addTeam({ name, region: "" });
    router.replace(`/portal?teamId=${teamId}`);
  };

  // The rail is the project navigation, so it exists once there is a project. Creating one no
  // longer takes it away — the wizard is a dialog over the console rather than a page that
  // replaces it, so the console it is being added to stays visible behind it.
  const sidebarVisible = teamProjects.length > 0;
  // Portal's account screen. A content mode rather than a route, because /portal is one route
  // whose screen is chosen by state already (the wizard works the same way) — and because it keeps
  // the rail on screen, which is how you get back out of it.
  const [showAccount, setShowAccountState] = useState(() => searchParams.get("view") === "account");

  const switchTeam = (teamId: string) => {
    setShowWizard(false);
    // Same reason as selectFromSwitcher: the pushed URL carries no `view`, so Settings staying
    // open would disagree with the address it was pushed under.
    setShowAccount(false);
    setTab("overview");
    router.push(`/portal?teamId=${teamId}`);
  };

  return (
    <ToastProvider>
    {/*
        Rail first, full height — the top bar starts where the rail ends.

        The bar used to run the whole width with the rail hanging below it, which put a horizontal
        line across the top of the navigation and made the rail read as content of the page rather
        than as the frame around it. Now the rail is the frame: it owns the left edge from the top
        of the window down, and the bar sits inside the remaining column above the page it labels.
        That is the arrangement the reference dashboard uses, and the reason its crumb can say
        where in this project you are — the rail beside it already said which project.
    */}
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      /*
       * Tabular figures for the whole console.
       *
       * Portal is columns of numbers — channel counts, camera lists, account totals — and with
       * proportional digits a "1" is narrower than a "0", so a column of figures wobbles and a
       * number that ticks up shifts the text beside it. SUIT ships the `tnum` feature (checked in
       * the woff2 we serve); nothing was asking for it.
       *
       * Set here rather than per table so a figure looks the same wherever it appears, and it
       * inherits — modals and popovers render inside this tree, so they get it too.
       */
      fontVariantNumeric: "tabular-nums",
    }}>
      {sidebarVisible && (
        <ProjectSidebar
          brand="VCA Portal"
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          toggleLabel={sidebarCollapsed ? t.expand : t.collapse}
          team={<TeamSwitcher dark compact={sidebarCollapsed} currentTeamId={currentOrgId} onSelect={switchTeam} />}
          project={<ProjectSwitcher dark compact={sidebarCollapsed} teamId={currentOrgId} currentProjectId={currentProjectId} onSelect={selectFromSwitcher} onRequestProject={() => setShowRequest(true)} onSwitchTeam={switchTeam} reopenSignal={switcherReopen} />}
          /* Counts for the rail's badges — the two tabs that hold a list of things you count.
             Not accounts: the number of people who may sign in is not a size you check in passing,
             and the tab it labels is where the figure is broken down by role anyway. Not the
             licence (not a count), not the server tab (read as one setting), not Overview. */
          counts={{
            cameras: projectCameras.length,
            // Released people are off the list, so the badge does not count them — "123" has to
            // mean 123 people this site is watching for, not 123 rows. The registry still shows
            // them under its own tab; see ProjectVipTab.
            vip: persons.filter(p => p.projectId === currentProjectId && !p.releasedAt).length,
          }}
          tab={tab}
          onTabChange={next => { setShowAccount(false); setTab(next); }}
          collapsed={sidebarCollapsed}
          settingsOpen={showAccount}
        />
      )}

      {/* Everything to the right of the rail: the bar, then the page under it.

          primary-50 across both, not white. The canvas was white and so are the cards, which left
          the cards to be told apart by their own hairline alone; the faintest step of the primary
          ramp gives them a ground to sit on again without turning the page grey. Set here rather
          than on the two children so the bar and the page cannot drift apart. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "var(--primary-50)" }}>

      {/*
        Top bar — where you are, and who you are. Nothing else.

        The wordmark and the two switchers moved into the rail once the rail ran the full height of
        the window; they name the console and the project, and the rail is where both belong. What
        is left is the crumb naming the screen — the rail says which project, this says which page
        of it — and on the right, the account menu.

        The wizard is the exception: it renders without a rail, so the trail it needs (which team,
        and that you are creating rather than browsing) has nowhere else to go and stays here.
      */}
      {/* No rule under it, and 10px shorter than it was. The bar and the page are the same
          primary-50 ground, so a hairline between them was drawing a box around chrome that has
          nothing to separate — the crumb and the account button read as the top of the page, which
          is what they are. With the line gone the leftover height read as a gap, so it went too. */}
      <div style={{
        height: "52px",
        display: "flex", alignItems: "center", padding: "0 32px", flexShrink: 0, gap: "10px",
        // The same column as the page below it, and for the reason written just above: with no
        // rule between them the crumb reads as the page's first line. It was not sitting on the
        // page's left edge — 24px against the content's 32px — so the line that claims to be the
        // top of the page started 8px outside it. And with no width cap while the content is
        // capped at 1600px, the two drifted further apart the wider the window got.
        width: "100%", maxWidth: "1600px", marginInline: "auto",
      }}>
        {/* The trail ends at "New project" only when there is no project to name — an empty
            team. With the wizard now a dialog over the console, the page behind it is still the
            project you were on, and a crumb that renamed itself while that page sat visible
            underneath described neither.

            The team crumb stays either way, because which team the project is filed under is
            real information the wizard genuinely uses — but while the dialog is open it stops
            being a switcher: switching teams mid-form has no defined answer for what happens to
            what you typed, and silently dropping it is not one. */}
        {showWizard && teamProjects.length === 0 ? (
          <>
            {/* display:block, not flex. text-overflow only applies to a block box, so with
                display:flex the name was hard-clipped mid-word with no ellipsis — it read as a
                rendering fault rather than as a shortened name. */}
            <span
              title={currentOrg?.name}
              style={{
                display: "block",
                border: "1px solid var(--line)", borderRadius: "8px", padding: "6px 10px",
                fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", whiteSpace: "nowrap",
                maxWidth: BREADCRUMB_TEAM_MAX_WIDTH, overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {currentOrg?.name ?? t.noTeam}
            </span>
            <BreadcrumbChevron />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", whiteSpace: "nowrap", padding: "6px 2px" }}>
              {t.newProject}
            </span>
          </>
        ) : sidebarVisible ? (
          <>
            {/* Project, then page. It named the nav group first — WORKSPACE, MANAGE — which is a
                heading in the rail, not a place: the first crumb of a trail should be somewhere you
                could be, and you are in a project. The page half is read off the rail's own tab
                table so the two cannot disagree.
                Plain text, not a switcher: the rail already has one, and a crumb that is also a
                menu makes two ways to do the same thing a few hundred pixels apart. */}
            <span
              title={projects.find(p => p.id === currentProjectId)?.name}
              style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: BREADCRUMB_TEAM_MAX_WIDTH }}
            >
              {projects.find(p => p.id === currentProjectId)?.name}
            </span>
            {/*
              How the fleet is doing, for the pages that do not say it themselves.

              Not on Overview: that page carries the same figure twice already — a card reading
              "51 / 59 connected" with a bar under it, and a line in the attention strip when
              anything is offline — and a third copy in the bar above them would be the same number
              three times on one screen. On Licence, Users and Server there is nothing else on
              screen about the cameras, and this is the only answer to "is the site up".

              Not on Settings either: that screen belongs to the account, not to a project, and a
              project's camera count there would be a fact from somewhere else.

              Beside the project, not after the page name: these two numbers are a fact about the
              project — the same project the crumb to their left names — and reading "Users &
              Permissions · 51 · 8" made them look like a count of what is on the page you opened.

              Two dots and two figures, no animation. The app's header animates its own pair
              because it sits over live video; Portal is a set of forms and tables, and a pulsing
              icon on a settings page is movement with nothing behind it.
            */}
            {!showAccount && tab !== "overview" && projectCameras.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", marginLeft: "2px", flexShrink: 0 }}>
                <button
                  onClick={() => setTab("cameras")}
                  title={t.fleetTitle(fleetOnline, fleetOffline)}
                  className="portal-link"
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
                    border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, color: "var(--gray-700)" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "var(--gray-900)" }} />
                    {fleetOnline}
                  </span>
                  {/* The offline figure is the only red left in the bar, and it earns it here: on
                      these pages nothing else would tell you a camera is down. A zero is grey,
                      because "none offline" is not news. */}
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 700, color: fleetOffline > 0 ? "var(--danger-400)" : "var(--gray-400)" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: fleetOffline > 0 ? "var(--danger-400)" : "var(--gray-300)" }} />
                    {fleetOffline}
                  </span>
                </button>
              </span>
            )}
            <BreadcrumbChevron />
            {/* A step larger than the crumb before it: with the page's own title gone from the
                content, this is the only place the screen is named, so it has to carry that
                weight — a trail whose last segment is the heading, which is how a console with a
                named rail and a bar above it usually ends up. */}
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", whiteSpace: "nowrap" }}>
              {showAccount ? t.settingsCrumb : PROJECT_TABS.find(pt => pt.id === tab)?.label[lang]}
            </span>
          </>
        ) : (
          <>
            <TeamSwitcher currentTeamId={currentOrgId} onSelect={switchTeam} />
            <BreadcrumbChevron />
            <ProjectSwitcher teamId={currentOrgId} currentProjectId={currentProjectId} onSelect={selectFromSwitcher} onRequestProject={() => setShowRequest(true)} onSwitchTeam={switchTeam} reopenSignal={switcherReopen} />
          </>
        )}

        <div style={{ flex: 1 }} />
        {/*
          The right end of the bar is who you are. Everything that belongs to the account rather
          than to the open project is in its menu — the way back to the app, Settings, support —
          and this bar is on every Portal screen, including the ones with no sidebar (an empty
          team, the wizard), so none of it needs a fallback control any more.

          What used to be here: an "Exit to App" pill, a language switcher and a "Contact support"
          pill. Three permanent controls, each for something taken once a session. Language is a
          preference rather than an action, so it went to Settings instead of into the menu.
        */}
        <PortalAccountMenu
          admin={me ?? { name: SIGNED_IN_USER.name, email: SIGNED_IN_USER.email }}
          appAccess={!me || canEnterApp(me)}
          onSettings={() => setShowAccount(true)}
        />
      </div>

      {
        // White canvas, dark rail — the arrangement most consoles have settled on. It used to be
        // the other way round for both, which meant every card had to be white to be a card and
        // the page's own surface was doing the outlining.
        /*
         * Capped at 1456px of content (1600 with the gutters) and centred.
         *
         * Uncapped, a 1920px monitor gave the page ~1560px: the four metric cards stretched until
         * each was mostly empty, and the camera table's five columns drifted so far apart that a
         * row stopped reading as one row. A cap is what makes the whole screen a glance rather
         * than a scan.
         *
         * Found by walking it in: uncapped (~1560 of content on a 1920 monitor) the four cards
         * stretched until each was mostly empty; 1344 left 182px of margin each side and read as a
         * page floating in the window; 1504 was tight. 1600 leaves ~54px each side — enough that
         * the page has an edge, not so much that it looks parked in the middle.
         *
         * The cap is on the scrolling element itself rather than on an inner wrapper, because
         * Input Sources' sticky header measures this container to position its fixed copy — an
         * inner box would leave the header wider than the content it covers.
         */
        <div style={{ flex: 1, overflow: "auto", padding: "12px 32px 32px", width: "100%", maxWidth: "1600px", marginInline: "auto" }}>
            {showAccount
              ? <PortalSettingsPage projectId={currentProjectId} />
              : teamProjects.length === 0
              ? <PortalEmptyState
                  accountManager={currentOrg?.accountManager}
                  onOpenSettings={() => setShowAccount(true)}
                  noTeam={teams.length === 0}
                  onCreateTeam={createFirstTeam}
                />
              : <PortalProjectDetailPage projectId={currentProjectId} tab={tab} onTabChange={setTab} />}
        </div>
      }
      </div>

      {showRequest && currentOrg && (
        <RequestProjectModal team={currentOrg} onClose={() => { setShowRequest(false); setSwitcherReopen(n => n + 1); }} />
      )}

      {/*
        The provisioning reference, and no longer a route anybody takes by accident.

        Nothing in the UI links here; it opens on ?newProject=1 and from the API documentation
        under Server & API. A project is a licensed site and Portal does not sell licences, so
        the customer-facing paths ask for one instead (RequestProjectModal above). The wizard
        stays because the shape it produces — team, type, name, first channel — is exactly what
        provisioning has to produce, and a screen is a clearer specification than a paragraph.
      */}
      {showWizard && (
        <PortalNewProjectWizard
          teamId={currentOrgId}
          onDeployed={deployedFromWizard}
          onCancel={cancelWizard}
          defaultType={defaultWizardType}
        />
      )}

      {/* The switcher's "New team" still opens the modal — there the page behind it is worth
          preserving. The first-team case does not use it: that landing has the field on it. */}
      {showNewTeam && (
        <NewTeamModal
          onClose={() => setShowNewTeam(false)}
          onCreated={teamId => { setShowNewTeam(false); router.replace(`/portal?teamId=${teamId}`); }}
        />
      )}
    </div>
    </ToastProvider>
  );
}
