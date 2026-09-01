"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalProjectDetailPage from "./PortalProjectDetailPage";
import PortalEmptyState from "./PortalEmptyState";
import ProjectSwitcher from "./ProjectSwitcher";
import PortalNewProjectWizard from "./PortalNewProjectWizard";
import ProjectSidebar, { type DetailTab } from "./ProjectSidebar";
import { ToastProvider } from "../Toast";
import { useVcaStore, type ProjectType } from "@/lib/vcaStore";

function BreadcrumbChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2.5 1L5.5 4L2.5 7" stroke="var(--gray-500)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2.25" y="2.75" width="13.5" height="12.5" rx="3" stroke="var(--gray-600)" strokeWidth="1.3"/>
      <path d="M6.75 3.25V14.75" stroke="var(--gray-600)" strokeWidth="1.3"/>
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
  // New Project Wizard, pre-selecting the industry chosen at signup and the org it just created.
  const newProjectParam = searchParams.get("newProject") === "1";
  const typeParam = searchParams.get("type");
  const defaultWizardType: ProjectType | undefined = typeParam === "smart_city" || typeParam === "smart_school" ? typeParam : undefined;
  const orgIdParam = searchParams.get("orgId");

  const [showWizard, setShowWizard] = useState(newProjectParam);
  const organizations = useVcaStore(s => s.organizations);
  const projects = useVcaStore(s => s.projects);
  const currentAdmin = useVcaStore(s => s.portalUsers.find(u => u.permission === "admin")) ?? null;
  const [currentProjectId, setCurrentProjectId] = useState(projects[0]?.id ?? "");
  const currentOrgId = orgIdParam || organizations[0]?.id || "";
  const [tab, setTab] = useState<DetailTab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (newProjectParam) router.replace("/portal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectFromSwitcher = (projectId: string) => {
    setCurrentProjectId(projectId);
    setTab("overview");
    setShowWizard(false);
  };

  const deployedFromWizard = (projectId: string) => {
    setShowWizard(false);
    if (projectId) {
      setCurrentProjectId(projectId);
      setTab("overview");
    }
  };

  return (
    <ToastProvider>
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", backgroundColor: "var(--gray-100)" }}>
      <style>{`
        .portal-exit-btn{transition:background-color .15s}
        .portal-exit-btn:hover{background-color:var(--gray-100)}
        .portal-hamburger-btn{transition:background-color .15s}
        .portal-hamburger-btn:hover{background-color:var(--gray-100)}
      `}</style>

      {/* Top bar — logo · product name · org · project switcher (Clerk-style breadcrumb) */}
      <div style={{
        height: "62px", backgroundColor: "white", borderBottom: "1px solid var(--gray-200)",
        display: "flex", alignItems: "center", padding: "0 24px", flexShrink: 0, gap: "10px",
      }}>
        {!showWizard && projects.length > 0 && (
          <button
            className="portal-hamburger-btn"
            onClick={() => setSidebarCollapsed(v => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "999px", border: "none",
              backgroundColor: "transparent", cursor: "pointer", flexShrink: 0, marginRight: "2px",
            }}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarToggleIcon />
          </button>
        )}
        <span style={{ fontSize: "16px", fontWeight: 800, color: "var(--gray-900)", flexShrink: 0 }}>VCA</span>
        <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-500)", backgroundColor: "var(--gray-100)", padding: "3px 8px", borderRadius: "999px", flexShrink: 0 }}>Portal</span>

        <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-300)", margin: "0 2px" }}>/</span>

        {/* Org — static today (single-tenant); the interactive switcher lives one level down, on project */}
        <span style={{
          display: "flex", alignItems: "center", gap: "6px",
          border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "6px 10px",
          fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", whiteSpace: "nowrap",
        }}>
          {organizations[0]?.name ?? "No Organization"}
        </span>
        <BreadcrumbChevron />
        <ProjectSwitcher currentProjectId={currentProjectId} onSelect={selectFromSwitcher} onNewProject={() => setShowWizard(true)} />

        <div style={{ flex: 1 }} />
        <button
          className="portal-exit-btn"
          onClick={() => router.push("/")}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            border: "1px solid var(--gray-200)", borderRadius: "999px", backgroundColor: "white",
            padding: "8px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--gray-600)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 12.25H2.9167C2.6072 12.25 2.31005 12.1271 2.09032 11.9074C1.87059 11.6877 1.75 11.3905 1.75 11.0833V2.91667C1.75 2.60942 1.87059 2.31227 2.09032 2.09254C2.31005 1.87281 2.6072 1.75 2.9167 1.75H5.25" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.75 9.91667L12.25 6.41667L8.75 2.91667" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.25 6.41667H5.25" stroke="var(--gray-600)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Exit to App
        </button>
      </div>

      {showWizard ? (
        <PortalNewProjectWizard orgId={currentOrgId} onDeployed={deployedFromWizard} defaultType={defaultWizardType} />
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {projects.length > 0 && (
            <ProjectSidebar tab={tab} onTabChange={setTab} collapsed={sidebarCollapsed} admin={currentAdmin} />
          )}
          <div style={{ flex: 1, overflow: "auto", padding: "32px 72px", backgroundColor: "var(--gray-100)" }}>
            {projects.length === 0
              ? <PortalEmptyState onNewProject={() => setShowWizard(true)} />
              : <PortalProjectDetailPage projectId={currentProjectId} tab={tab} onTabChange={setTab} />}
          </div>
        </div>
      )}
    </div>
    </ToastProvider>
  );
}
