"use client";

import { useEffect, useState } from "react";
import { usePortalLanguage } from "@/lib/i18n";
import { useVcaStore } from "@/lib/vcaStore";
import { getComplianceConfig } from "@/lib/complianceConfig";
import { BORDER } from "./PortalShared";
import type { RecordsTab } from "./ProjectSidebar";
import ProjectActivityTab from "./ProjectActivityTab";
import ProjectSearchLogTab from "./ProjectSearchLogTab";

/*
 * THE TABS KEEP THEIR SHORT NAMES (owner, 2026-09-28: 그냥두자).
 *
 * 「포털 변경 기록 / 앱 조회 기록」 was tried and measured — 98px and 80px in a 1,144px strip, so
 * length was never the objection. It was put back because the prefix is only true of one of them:
 * every row in 조회 기록 comes from the app, but 변경 기록 also carries an account created on the
 * sign-up page, which nobody did in Portal. A label that is right about one tab and nearly right
 * about the other is worse than two short names with the answer written underneath.
 *
 * Where each list comes from is said in the sentence under its table, in the reader's own words —
 * 「포털에서 …」, not 「콘솔에서 …」 (owner: 콘솔이라는 단어가 갑자기 쓰이면 뭘 말하는지 모를 것
 * 같아— measured: 콘솔 appears 19 times in this product against 806 for Portal/포털).
 */
const T = {
  en: { activity: "Activity log", searchlog: "Search log" },
  ko: { activity: "변경 기록", searchlog: "조회 기록" },
} as const;

/**
 * 기록 — ONE RAIL ROW HOLDING TWO LISTS (owner, 2026-09-28: 사이드바에 메뉴를 합쳐서 그 화면
 * 안에서는 탭으로 분리하자는 거야).
 *
 * WHY THE MENU MERGED AND THE TABLES DID NOT. Two rail rows both ending in 「기록」 made the reader
 * choose between them before knowing which one held the answer. But the two lists answer different
 * questions — 변경 기록 is "what changed", 조회 기록 is "who looked somebody up" — and their rows
 * do not share a shape: a search carries the target, the screen it ran on and the stated purpose,
 * a change carries one sentence. Nor their volume: searches run to dozens a day against a handful
 * of setting changes a quarter, so a merged table would bury the changes under the look-ups.
 *
 * So this file is a strip and nothing else. Neither tab knows the other exists, and each keeps its
 * own filters, sorting and summary cards.
 *
 * WITH 조회 기록 SWITCHED OFF there is one list, and then there is no choice to offer: the strip
 * is not drawn and the screen is exactly what this release had before the merge. A tab row with
 * one tab is a control that cannot be used.
 */
export default function ProjectRecordsTabs({ projectId }: { projectId: string }) {
  const [lang] = usePortalLanguage();
  const t = T[lang];
  const searchLogEnabled = getComplianceConfig().searchAccessLog;
  const auditLog = useVcaStore(s => s.auditLog);
  const searchAccessLog = useVcaStore(s => s.searchAccessLog);

  /* Which list is open lives in the URL, like the sub-tabs on 사용자 — an older ?tab=searchlog
     bookmark lands on that list rather than on whichever one happens to be first. */
  const [tab, setTab] = useState<RecordsTab>(() => {
    if (typeof window === "undefined") return "activity";
    const q = new URL(window.location.href).searchParams;
    /* `tab` as well as `sub`: an old bookmark says ?tab=searchlog, which PortalShell now resolves
       to the 기록 row — it has to arrive on the list it asked for, not on the first one. */
    const want = q.get("sub") ?? q.get("tab");
    return want === "searchlog" && searchLogEnabled ? "searchlog" : "activity";
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("sub", tab);
    if (url.toString() !== window.location.href) window.history.replaceState(null, "", url.toString());
  }, [tab]);

  const counts: Record<RecordsTab, number> = {
    activity: auditLog.filter(a => !a.projectId || a.projectId === projectId).length,
    searchlog: searchAccessLog.filter(r => r.projectId === projectId).length,
  };

  const body = tab === "searchlog" && searchLogEnabled
    ? <ProjectSearchLogTab projectId={projectId} />
    : <ProjectActivityTab projectId={projectId} />;

  if (!searchLogEnabled) return body;

  return (
    <>
      {/* The same strip 입력 소스 · VIP 등록 · 사용자 use, at the same values. */}
      <div style={{ display: "flex", gap: "20px", borderBottom: BORDER, marginBottom: "16px" }}>
        {(["activity", "searchlog"] as RecordsTab[]).map(id => {
          const active = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: "none", border: "none", cursor: "pointer",
                padding: "0 2px 10px", fontSize: "13px", fontWeight: 700, fontFamily: "inherit",
                color: active ? "var(--gray-900)" : "var(--gray-500)",
                borderBottom: active ? "2px solid var(--gray-900)" : "2px solid transparent",
              }}>
              {t[id]}
              <span style={{ fontSize: "11px", fontWeight: 600, color: active ? "var(--gray-500)" : "var(--gray-400)" }}>{counts[id]}</span>
            </button>
          );
        })}
      </div>
      {body}
    </>
  );
}
