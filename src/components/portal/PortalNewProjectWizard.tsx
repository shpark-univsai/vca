"use client";

import { useState } from "react";
import { useVcaStore, type ProjectType } from "@/lib/vcaStore";
import { usePortalLanguage } from "@/lib/i18n";
import { BORDER } from "./PortalShared";

const TEMPLATES: { type: ProjectType; icon: string }[] = [
  { type: "smart_city", icon: "/icons/portal-smart-city.png" },
  { type: "smart_school", icon: "/icons/portal-smart-school.png" },
];

const T = {
  en: {
    badge: "New Project Setup",
    title: "Set Up Your New AI Monitoring Project",
    subtitle: "Welcome to the VCA Portal console. To get started, choose a solution template and fill in your project details.",
    step1: "1. Choose a Solution Template",
    templates: {
      smart_city: { title: "Smart City", description: "Urban road network & public area monitoring" },
      smart_school: { title: "Smart School", description: "Face recognition attendance & campus blind spots" },
    },
    step2: "2. Project Name",
    namePlaceholder: "Guri City Smart School - Phase 3",
    step3: "3. Video Channel Stream (RTSP)",
    rtspPlaceholder: "Enter your rtsp:// address",
    rtspTag: "RTSP 1CH",
    deploy: "Deploy & Start Monitoring",
    cancel: "Cancel",
    footer: "You'll be redirected to the monitoring dashboard automatically after deployment",
  },
  ko: {
    badge: "새 프로젝트 설정",
    title: "새 AI 모니터링 프로젝트를 설정하세요",
    subtitle: "VCA Portal 콘솔에 오신 것을 환영합니다. 시작하려면 솔루션 템플릿을 선택하고 프로젝트 정보를 입력하세요.",
    step1: "1. 솔루션 템플릿 선택",
    templates: {
      smart_city: { title: "스마트시티", description: "도로망 및 공공장소 모니터링" },
      smart_school: { title: "스마트스쿨", description: "얼굴 인식 출결 관리 및 캠퍼스 사각지대 감시" },
    },
    step2: "2. 프로젝트 이름",
    namePlaceholder: "구리시 스마트스쿨 - 3단계",
    step3: "3. 영상 채널 스트림 (RTSP)",
    rtspPlaceholder: "rtsp:// 주소를 입력하세요",
    rtspTag: "RTSP 1CH",
    deploy: "배포 및 모니터링 시작",
    cancel: "취소",
    footer: "배포가 완료되면 자동으로 모니터링 대시보드로 이동합니다",
  },
} as const;

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
  const addProject = useVcaStore(s => s.addProject);
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
    onDeployed(created?.id ?? "");
  };

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px" }}>
      <span style={{
        display: "flex", alignItems: "center", gap: "6px",
        border: "1px solid var(--primary-200)", backgroundColor: "white", borderRadius: "13px",
        padding: "6px 14px", fontSize: "10px", fontWeight: 600, color: "var(--primary-400)",
      }}>
        ● {t.badge}
      </span>

      <p style={{ fontSize: "26px", fontWeight: 800, color: "var(--gray-900)", marginTop: "18px", textAlign: "center" }}>
        {t.title}
      </p>
      <p style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "6px", textAlign: "center", maxWidth: "560px" }}>
        {t.subtitle}
      </p>

      <div style={{
        backgroundColor: "white", border: BORDER, borderRadius: "20px",
        width: "640px", maxWidth: "100%", boxSizing: "border-box", padding: "24px 32px 32px",
        marginTop: "28px",
      }}>
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
                <div style={{ width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", backgroundColor: "var(--gray-50)" }}>
                  <img src={tpl.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginTop: "10px" }}>{label.title}</p>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginTop: "4px", lineHeight: "16px" }}>{label.description}</p>
              </button>
            );
          })}
        </div>

        <div style={{ height: "1px", backgroundColor: "var(--line)", margin: "16px 0" }} />

        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>{t.step2}</p>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          style={{
            width: "100%", boxSizing: "border-box", height: "44px", padding: "0 12px",
            borderRadius: "10px", border: BORDER, backgroundColor: "white",
            fontSize: "13px", fontWeight: 600, fontFamily: "inherit", marginBottom: "16px",
          }}
        />

        <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-600)", marginBottom: "8px" }}>{t.step3}</p>
        <div style={{ display: "flex", gap: "16px" }}>
          <input
            value={rtspUrl}
            onChange={e => setRtspUrl(e.target.value)}
            placeholder={t.rtspPlaceholder}
            style={{
              flex: 1, boxSizing: "border-box", height: "44px", padding: "0 12px",
              borderRadius: "10px", border: BORDER, backgroundColor: "white",
              fontSize: "13px", fontWeight: 600, fontFamily: "inherit",
            }}
          />
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "84px", height: "44px", borderRadius: "10px", backgroundColor: "var(--gray-900)",
            color: "white", fontSize: "10px", fontWeight: 600, flexShrink: 0,
          }}>
            {t.rtspTag}
          </span>
        </div>

        <button className="portal-btn-primary"
          onClick={deploy}
          disabled={!name.trim()}
          style={{
            width: "100%", height: "52px", marginTop: "16px", borderRadius: "8px", border: "none",
            backgroundColor: name.trim() ? "var(--primary-400)" : "var(--gray-200)", color: name.trim() ? "white" : "var(--gray-400)", fontSize: "14px", fontWeight: 700,
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

      <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "24px", textAlign: "center" }}>
        {t.footer}
      </p>
    </div>
  );
}
