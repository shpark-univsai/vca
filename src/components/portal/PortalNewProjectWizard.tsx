"use client";

import { useState } from "react";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useVcaStore, canManageAccess, currentPortalUser, type ProjectType } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER, CONTROL_HEIGHT } from "./PortalShared";

const TEMPLATES: { type: ProjectType; icon: string }[] = [
  { type: "smart_city", icon: "/icons/portal-smart-city.png" },
  { type: "smart_school", icon: "/icons/portal-smart-school.png" },
];

const T = {
  en: {
    badge: "New Project Setup",
    title: "Set Up Your New Project",
    step1: "1. Choose a Solution Template",
    templates: {
      smart_city: { title: "Smart City", description: "Roads and public areas" },
      smart_school: { title: "Smart School", description: "Attendance and campus blind spots" },
    },
    step2: "2. Project Name",
    namePlaceholder: "Guri City Smart School - Phase 3",
    step3: "3. First Video Channel (RTSP)",
    step3Optional: "Optional — you can add every source later from Input Sources.",
    rtspPlaceholder: "Enter your rtsp:// address",
    rtspTag: "RTSP 1CH",
    firstCameraName: "Channel 1",
    deploy: "Create project",
    cancel: "Cancel",
    refusedTitle: "Not available on this account",
    refusedBody: "Projects are provisioned during installation. This screen is the provisioning reference and is limited to the owner account.",
  },
  ko: {
    badge: "새 프로젝트 설정",
    title: "새 프로젝트를 설정하세요",
    step1: "1. 솔루션 템플릿 선택",
    templates: {
      smart_city: { title: "스마트시티", description: "도로망 및 공공장소" },
      smart_school: { title: "스마트스쿨", description: "출결 관리 및 캠퍼스 사각지대" },
    },
    step2: "2. 프로젝트 이름",
    namePlaceholder: "구리시 스마트스쿨 - 3단계",
    step3: "3. 첫 영상 채널 (RTSP)",
    step3Optional: "선택 사항입니다. 나머지 소스는 입력소스 화면에서 언제든 추가할 수 있습니다.",
    rtspPlaceholder: "rtsp:// 주소를 입력하세요",
    rtspTag: "RTSP 1CH",
    firstCameraName: "채널 1",
    deploy: "프로젝트 만들기",
    cancel: "취소",
    refusedTitle: "이 계정에서는 열 수 없습니다",
    refusedBody: "프로젝트는 설치 과정에서 배정됩니다. 이 화면은 프로비저닝 참조용이고 최고관리자 계정으로 제한됩니다.",
  },
} as const;

/** Host out of an rtsp:// address, without scheme, port, path or credentials. Returns "" for
 *  anything it cannot parse rather than guessing — an empty IP cell is readable, a wrong one is
 *  not. */
function hostOf(url: string): string {
  const m = /^[a-z]+:\/\/(?:[^@/]*@)?([^:/?#]+)/i.exec(url.trim());
  return m ? m[1] : "";
}

interface PortalNewProjectWizardProps {
  teamId: string;
  onDeployed: (projectId: string) => void;
  /**
   * Leaves the wizard without creating anything. Omitted when there is nowhere to go back to —
   * a team with no projects has nothing behind this screen — and then no cancel is offered.
   */
  onCancel?: () => void;
  defaultType?: ProjectType;
}

export default function PortalNewProjectWizard({ teamId, onDeployed, onCancel, defaultType = "smart_city" }: PortalNewProjectWizardProps) {
  useEscapeKey(() => onCancel?.());
  /*
   * Owner only, even though nothing in the UI links here.
   *
   * An unlisted address is a door nobody has been told about, not a locked one — anybody who
   * learns the URL can open it, and this screen creates a project. The gate travels with the
   * component rather than sitting at the one call site, so a future entry point cannot forget
   * it. Fails open with no matching identity, the same convention every other gate in Portal
   * follows: a lock keyed on "we could not identify you" shuts the demo out of its own console.
   */
  const portalUsers = useVcaStore(s => s.portalUsers);
  const me = currentPortalUser(portalUsers);
  const mayProvision = me ? canManageAccess(me.permission) : true;
  const addProject = useVcaStore(s => s.addProject);
  const addCamera = useVcaStore(s => s.addCamera);
  const [selectedType, setSelectedType] = useState<ProjectType>(defaultType);
  const [name, setName] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [lang] = usePortalLanguage();
  const t = T[lang];

  const deploy = () => {
    if (!name.trim() || !teamId) return;
    const existingIds = new Set(useVcaStore.getState().projects.map(p => p.id));
    addProject({ name: name.trim(), teamId, type: selectedType });
    const created = useVcaStore.getState().projects.find(p => !existingIds.has(p.id));
    // Step 3's address becomes the project's first camera. It was read into state and thrown
    // away — three steps of form, one of which did nothing, under a button that said
    // "Deploy & Start Monitoring" and landed you on a project with no sources at all.
    if (created && rtspUrl.trim()) {
      addCamera({
        projectId: created.id,
        name: t.firstCameraName,
        code: "CAM-CH1-001",
        rtspUrl: rtspUrl.trim(),
        // The host out of the address, which is the only field the operator has given us that
        // identifies the device. Everything else the Add Camera form collects — location, zone,
        // coordinates, maker — is asked for there, not in a three-field setup wizard.
        ip: hostOf(rtspUrl.trim()),
        mac: "", location: "", zone: "",
        // No status is claimed. Portal has not reached this address and will not until camera
        // polling lands, so "offline" is the honest starting state — the same one a camera added
        // from Input Sources gets before anything answers.
        status: "offline",
        thumbnail: "", lat: 0, lng: 0,
      });
    }
    onDeployed(created?.id ?? "");
  };

  if (!mayProvision) {
    return (
      <div onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 400, backgroundColor: "rgba(14,22,42,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
        <div style={{ backgroundColor: "white", border: BORDER, borderRadius: "16px", maxWidth: "400px", width: "100%", padding: "22px", boxShadow: "0 20px 60px rgba(14,22,42,0.18)" }}>
          <p style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)" }}>{t.refusedTitle}</p>
          <p style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.55, marginTop: "8px" }}>{t.refusedBody}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
            <button className="portal-btn-outline" onClick={() => onCancel?.()}
              style={{ padding: "10px 16px", borderRadius: "8px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    /*
      A dialog over the console, not a page that replaces it.
     
      It used to swap the whole content area for a full-page wizard — and from an empty team it
      did so with no way back at all. Looking at how consoles actually do this (Mobbin, ~30
      create-flows across dev-tools and admin products): the switcher is only ever the entry
      point — not one app types a name inside the popover — and roughly three in four open a
      modal from it. A full page shows up when creation carries a weighty, comparable choice:
      a region, a git provider, a database password, a plan. Three fields, one of them optional,
      all inside the team you are already in, is not that.
     
      Two things the sample was unanimous about and we were not: every page-based wizard among
      them (Vercel, AWS) keeps a Back or Cancel on every step, and apps ship ONE create surface
      reused for the first project and the nth — what changes for an empty team is the page
      behind it, which is PortalEmptyState's job, not this component's.
    */
    <div onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, backgroundColor: "rgba(14,22,42,0.4)",
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto",
      }}>
      {/* margin auto rather than centring alone: with the scroll on the backdrop, a dialog taller
          than a short window gets its top cut off under align-items centre. */}
      <div style={{
        backgroundColor: "white", border: BORDER, borderRadius: "20px",
        width: "640px", maxWidth: "100%", boxSizing: "border-box", padding: "24px 32px 32px",
        margin: "auto", boxShadow: "0 20px 60px rgba(14,22,42,0.18)",
      }}>
        <div style={{ marginBottom: "22px" }}>
          {/* No dot in front. It was a decorative bullet on a label that already has a border
              and a colour of its own — a mark that says nothing is a mark that reads as a status
              light. */}
          <span style={{
            display: "inline-flex", alignItems: "center",
            border: "1px solid var(--primary-200)", borderRadius: "13px",
            padding: "5px 12px", fontSize: "10px", fontWeight: 600, color: "var(--primary-400)",
          }}>
            {t.badge}
          </span>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)", marginTop: "12px" }}>
            {t.title}
          </p>
        </div>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "12px" }}>{t.step1}</p>
        <div style={{ display: "flex", gap: "16px" }}>
          {TEMPLATES.map(tpl => {
            const selected = selectedType === tpl.type;
            const label = t.templates[tpl.type];
            return (
              <button
                key={tpl.type}
                onClick={() => setSelectedType(tpl.type)}
                style={{
                  position: "relative", flex: 1, textAlign: "left", cursor: "pointer",
                  border: selected ? "1px solid var(--primary-400)" : BORDER,
                  backgroundColor: selected ? "var(--primary-50)" : "white",
                  borderRadius: "14px", padding: "10px 16px 14px", minHeight: "110px",
                }}
              >
                {/* Inside the card's padding box, on the same top line as the icon — not hung off
                    the corner. Hanging outside meant the badge sat on whatever was behind the card
                    (the neighbouring template, the panel edge) and read as a floating element
                    rather than as this card's own selected state; it also clipped against the
                    modal edge for the right-hand template. No shadow either: there is no edge to
                    lift off of in here. */}
                {selected && (
                  <span style={{
                    position: "absolute", top: "10px", right: "15px",
                    width: "24px", height: "24px", borderRadius: "50%",
                    backgroundColor: "var(--primary-400)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
                {/* No box behind the icon. It carried gray-50, which meant the mark sat on a
                    different ground in each state — a grey tile against the unselected card's
                    white, and a near-white tile against the selected card's primary-50. The
                    artwork is transparent, so the card's own surface is the only ground it needs.
                    contain rather than cover: with nothing to bleed to, cropping the drawing to
                    fill a square only cuts its edges off. */}
                <img src={tpl.icon} alt="" style={{ width: "60px", height: "60px", objectFit: "contain", display: "block" }} />
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginTop: "10px" }}>{label.title}</p>
                {/* One line. It wrapped to two on the school card and not on the city one, so the
                    two cards were different heights and the longer one read as a paragraph
                    rather than a label under a name. */}
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginTop: "4px", lineHeight: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label.description}</p>
              </button>
            );
          })}
        </div>

        {/* No rule between the steps. The numbered labels already say where one ends and the
            next begins, and a line under a row of bordered cards is a line sitting on lines. */}
        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginTop: "20px", marginBottom: "8px" }}>{t.step2}</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          /* CONTROL_HEIGHT, like every other field in the console. 44 was a landing-page
             size, carried over from when this was a full-page wizard; inside a dialog that sits
             on top of 36px controls it reads as a different product. */
          style={{
            width: "100%", boxSizing: "border-box", height: CONTROL_HEIGHT, padding: "0 12px",
            borderRadius: "10px", border: BORDER, backgroundColor: "white",
            fontSize: "13px", fontWeight: 600, fontFamily: "inherit", marginBottom: "16px",
          }}
        />

        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "4px" }}>{t.step3}</p>
        {/* Said out loud, because the step numbers imply all three are required and this one is
            not. A project with no sources is a normal way to start — the hardware often arrives
            after the paperwork. */}
        <p style={{ fontSize: "12px", color: "var(--gray-400)", marginBottom: "8px" }}>{t.step3Optional}</p>
        <div style={{ display: "flex", gap: "16px" }}>
          <input
            value={rtspUrl}
            onChange={e => setRtspUrl(e.target.value)}
            placeholder={t.rtspPlaceholder}
            style={{
              flex: 1, boxSizing: "border-box", height: CONTROL_HEIGHT, padding: "0 12px",
              borderRadius: "10px", border: BORDER, backgroundColor: "white",
              fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
            }}
          />
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "84px", height: CONTROL_HEIGHT, borderRadius: "10px", backgroundColor: "var(--gray-900)",
            color: "white", fontSize: "10px", fontWeight: 600, flexShrink: 0,
          }}>
            {t.rtspTag}
          </span>
        </div>

        <button className="portal-btn-primary"
          onClick={deploy}
          disabled={!name.trim()}
          style={{
            width: "100%", height: "40px", marginTop: "20px", borderRadius: "8px", border: "none",
            backgroundColor: name.trim() ? "var(--primary-400)" : "var(--gray-200)", color: name.trim() ? "white" : "var(--gray-400)", fontSize: "13px", fontWeight: 700,
            cursor: name.trim() ? "pointer" : "not-allowed", 
          }}
        >
          {t.deploy}
        </button>

        {/* Directly under the primary, inside the same card.
            Cancel used to be a pill in the global top bar, which is chrome — it held the product
            name and the breadcrumb, and an answer to a question this form is asking does not live
            up there. Both answers to "am I creating this project?" now sit in one place, with the
            recoverable one quieter: no border, no fill, so it never competes with the action it
            undoes. */}
        {/* Always offered now. From an empty team this used to be omitted entirely — a wizard
            with no exit, which nothing in the reference set does. Behind it is either the
            console or the empty-team landing, and both are somewhere to be. */}
        {onCancel && (
          <button
            className="portal-link"
            onClick={onCancel}
            style={{
              width: "100%", marginTop: "10px", border: "none", background: "none",
              padding: "10px 0", cursor: "pointer",
              fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", fontFamily: "inherit",
            }}
          >
            {t.cancel}
          </button>
        )}

      </div>
    </div>
  );
}
