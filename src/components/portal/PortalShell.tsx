"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalProjectDetailPage from "./PortalProjectDetailPage";
import PortalEmptyState from "./PortalEmptyState";
import { NewTeamModal } from "./TeamSwitcher";
import ProjectSwitcher from "./ProjectSwitcher";
import PortalNewProjectWizard from "./PortalNewProjectWizard";
import TeamSwitcher from "./TeamSwitcher";
import ProjectSidebar, { NAV_GROUPS, PROJECT_TABS, type DetailTab } from "./ProjectSidebar";
import PortalMyPage from "./PortalMyPage";
import PortalAccountMenu from "./PortalAccountMenu";
import { ToastProvider } from "../Toast";
import { useVcaStore, canEnterApp, canEnterPortal, currentPortalUser, SIGNED_IN_USER, type ProjectType } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BREADCRUMB_TEAM_MAX_WIDTH } from "./PortalShared";

const T = {
  en: { noTeam: "No Team", expand: "Expand sidebar", collapse: "Collapse sidebar", newProject: "New project", myPageCrumb: "My page" },
  ko: { noTeam: "팀 없음", expand: "사이드바 펼치기", collapse: "사이드바 접기", newProject: "새 프로젝트", myPageCrumb: "마이페이지" },
} as const;

function BreadcrumbChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 1L5.5 4L2.5 7" stroke="var(--gray-500)" strokeWidth="1.12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.25" y="2.75" width="13.5" height="12.5" rx="3" stroke="var(--gray-600)" strokeWidth="1.4"/>
      <path d="M6.75 3.25V14.75" stroke="var(--gray-600)" strokeWidth="1.4"/>
    </svg>
  );
}

// Project switching/creation stays header-only (GCP's "Select a resource" pattern). Once inside
// a project, its own tools (Overview/Cameras/VIP Registry/License/Users & Permissions) live in a
// collapsible left sidebar — matching GCP's per-project nav rail — toggled by the header hamburger.
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
  // A fresh installation can arrive with no team at all — one company may run several teams here,
  // so the supplier does not necessarily create one during handover. The landing page then asks
  // for the team instead of the project, and this holds that modal.
  const [showNewTeam, setShowNewTeam] = useState(false);
  const teams = useVcaStore(s => s.teams);
  const projects = useVcaStore(s => s.projects);
  // Read here only to count them for the rail's badges — see the `counts` prop below.
  const cameras = useVcaStore(s => s.cameras);
  const persons = useVcaStore(s => s.persons);
  const portalUsers = useVcaStore(s => s.portalUsers);
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
  // The selection is *derived*, not stored: hold the id the user picked, but fall back to this
  // team's first project whenever that id is not one of them. Keeping it in plain state instead
  // meant a team switch left the previous team's project selected until an effect caught up, and
  // for one render the detail page rendered a project the breadcrumb no longer claimed.
  const [pickedProjectId, setPickedProjectId] = useState("");
  const currentProjectId = teamProjects.some(p => p.id === pickedProjectId)
    ? pickedProjectId
    : (teamProjects[0]?.id ?? "");
  const [tab, setTab] = useState<DetailTab>(
    () => (PROJECT_TABS.some(t => t.id === tabParam) ? (tabParam as DetailTab) : "overview"),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [lang] = usePortalLanguage();
  const t = T[lang];

  useEffect(() => {
    if (newProjectParam) router.replace("/portal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFromSwitcher = (projectId: string) => {
    setPickedProjectId(projectId);
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
  // Creating the first team goes straight on to the project wizard: the team is not the goal, it is
  // the container the project needs. Stopping at an empty team would leave the admin on the same
  // landing page they just acted on.
  const createFirstTeam = (name: string) => {
    const teamId = addTeam({ name, region: "" });
    router.replace(`/portal?teamId=${teamId}`);
    setShowWizard(true);
  };

  // The rail is the project navigation, so it only exists once there is a project and we are not
  // inside the wizard. The header reads this to decide whether it still has to carry the way out.
  const sidebarVisible = !showWizard && teamProjects.length > 0;
  // Portal's account screen. A content mode rather than a route, because /portal is one route
  // whose screen is chosen by state already (the wizard works the same way) — and because it keeps
  // the rail on screen, which is how you get back out of it.
  const [showAccount, setShowAccount] = useState(false);

  const switchTeam = (teamId: string) => {
    setShowWizard(false);
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
      display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "white",
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
      <style>{`
        .portal-hamburger-btn{transition:background-color .15s}
        .portal-hamburger-btn:hover{background-color:var(--gray-100)}
      `}</style>

      {sidebarVisible && (
        <ProjectSidebar
          team={<TeamSwitcher dark currentTeamId={currentOrgId} onSelect={switchTeam} />}
          project={<ProjectSwitcher dark teamId={currentOrgId} currentProjectId={currentProjectId} onSelect={selectFromSwitcher} onNewProject={() => setShowWizard(true)} />}
          /* Counts for the rail's badges. Only the three tabs that hold a list of things: a
             licence is not a count, the server tab lists servers but is read as one setting,
             and Overview counts nothing of its own. */
          counts={{
            cameras: cameras.filter(c => c.projectId === currentProjectId).length,
            vip: persons.filter(p => p.projectId === currentProjectId).length,
            users: portalUsers.filter(u => u.projectIds.includes(currentProjectId)).length,
          }}
          tab={tab}
          onTabChange={next => { setShowAccount(false); setTab(next); }}
          collapsed={sidebarCollapsed}
          myPageOpen={showAccount}
        />
      )}

      {/* Everything to the right of the rail: the bar, then the page under it. */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/*
        Top bar — the product, where you are, and who you are.

        It used to carry the team and project switchers too; those name the thing the rail
        navigates, so they moved into the rail with it. The wordmark stayed: it belongs to the
        whole console rather than to one project, and the rail is scoped to a project. What sits
        beside it is the crumb naming the screen — the rail says which project, this says which
        page of it — and on the right, the account menu.

        The wizard is the exception: it renders without a rail, so the trail it needs (which team,
        and that you are creating rather than browsing) has nowhere else to go and stays here.
      */}
      <div style={{
        height: "62px", backgroundColor: "white", borderBottom: "1px solid var(--gray-300)",
        display: "flex", alignItems: "center", padding: "0 24px", flexShrink: 0, gap: "10px",
      }}>
        {!showWizard && teamProjects.length > 0 && (
          <button
            className="portal-hamburger-btn"
            onClick={() => setSidebarCollapsed(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "8px", border: "none",
              backgroundColor: "transparent", cursor: "pointer", flexShrink: 0, marginRight: "2px",
            }}
            title={sidebarCollapsed ? t.expand : t.collapse}
          >
            <SidebarToggleIcon />
          </button>
        )}
        <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", flexShrink: 0 }}>VCA Portal</span>
        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-300)", margin: "0 2px" }}>/</span>
        {/* The breadcrumb says where you are, and during creation you are not inside any project —
            so the last crumb becomes the act of creating one. It used to keep naming whichever
            project happened to be selected, which was false (nothing has been created yet) and
            worse than false: that crumb is a live switcher, so clicking it navigated away and
            discarded the half-filled form. Every console that has this flow ends the trail at the
            creation step the same way — GitLab "… / Projects / New project", Canva "Projects /
            New course", Copilot "Forms / New form".

            The team crumb stays, because which team the project is filed under is real information
            and the wizard genuinely uses it — but it stops being a switcher for the same reason
            the project crumb did. Switching teams mid-form has no defined answer for what happens
            to what you typed, and silently dropping it is not one. */}
        {showWizard ? (
          <>
            {/* display:block, not flex. text-overflow only applies to a block box, so with
                display:flex the name was hard-clipped mid-word with no ellipsis — it read as a
                rendering fault rather than as a shortened name. */}
            <span
              title={currentOrg?.name}
              style={{
                display: "block",
                border: "1px solid var(--gray-300)", borderRadius: "8px", padding: "6px 10px",
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
            {/* Group name, then page — the same trail the reference header shows. Both are read
                off the rail's own tab table, so a tab moved between groups cannot leave the two
                disagreeing. Plain text: the rail is the way to another page, and a crumb that is
                also a menu was two of them. */}
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", whiteSpace: "nowrap" }}>
              {NAV_GROUPS.find(g => g.id === (PROJECT_TABS.find(pt => pt.id === tab)?.group ?? "workspace"))?.label[lang]}
            </span>
            <BreadcrumbChevron />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-900)", whiteSpace: "nowrap" }}>
              {showAccount ? t.myPageCrumb : PROJECT_TABS.find(pt => pt.id === tab)?.label[lang]}
            </span>
          </>
        ) : (
          <>
            <TeamSwitcher currentTeamId={currentOrgId} onSelect={switchTeam} />
            <BreadcrumbChevron />
            <ProjectSwitcher teamId={currentOrgId} currentProjectId={currentProjectId} onSelect={selectFromSwitcher} onNewProject={() => setShowWizard(true)} />
          </>
        )}

        <div style={{ flex: 1 }} />
        {/*
          The right end of the bar is who you are. Everything that belongs to the account rather
          than to the open project is in its menu — the way back to the app, My page, support —
          and this bar is on every Portal screen, including the ones with no sidebar (an empty
          team, the wizard), so none of it needs a fallback control any more.

          What used to be here: an "Exit to App" pill, a language switcher and a "Contact support"
          pill. Three permanent controls, each for something taken once a session. Language is a
          preference rather than an action, so it went to My page instead of into the menu.
        */}
        <PortalAccountMenu
          admin={me ?? { name: SIGNED_IN_USER.name, email: SIGNED_IN_USER.email }}
          appAccess={!me || canEnterApp(me)}
          onMyPage={() => setShowAccount(true)}
        />
      </div>

      {showWizard ? (
        <PortalNewProjectWizard
          teamId={currentOrgId}
          onDeployed={deployedFromWizard}
          onCancel={teamProjects.length > 0 ? () => setShowWizard(false) : undefined}
          defaultType={defaultWizardType}
        />
      ) : (
        // White canvas, dark rail — the arrangement most consoles have settled on. It used to be
        // the other way round for both, which meant every card had to be white to be a card and
        // the page's own surface was doing the outlining.
        <div style={{ flex: 1, overflow: "auto", padding: "32px 72px", backgroundColor: "white" }}>
            {showAccount
              ? <PortalMyPage />
              : teamProjects.length === 0
              ? <PortalEmptyState
                  onNewProject={() => setShowWizard(true)}
                  noTeam={teams.length === 0}
                  onCreateTeam={createFirstTeam}
                />
              : <PortalProjectDetailPage projectId={currentProjectId} tab={tab} onTabChange={setTab} />}
        </div>
      )}
      </div>

      {/* The switcher's "New team" still opens the modal — there the page behind it is worth
          preserving. The first-team case does not use it: that landing has the field on it. */}
      {showNewTeam && (
        <NewTeamModal
          onClose={() => setShowNewTeam(false)}
          onCreated={teamId => { router.replace(`/portal?teamId=${teamId}`); }}
        />
      )}
    </div>
    </ToastProvider>
  );
}
