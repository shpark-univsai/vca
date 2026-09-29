"use client";

/**
 * A SITE'S MAIL AND WHETHER IT CAN REACH THE INTERNET.
 *
 * This lived as a tab of the Server & API screen, beside a list of recording and analytics nodes,
 * and it was the wrong room (owner, 2026-09-21: 서버엔 api화면에서는 다른 서비스들과 다르게
 * 어색하게 들어가있는거 있음). Two reasons, one from the products and one from our own console:
 *
 *   - MILESTONE keeps the mail server and the network settings in Tools → Options, a system
 *     settings dialog, while the recording servers are their own node in the tree. Two places.
 *     Genetec does the same split (email under the System task, servers and roles elsewhere).
 *   - OUR OWN settings screen already held Team mail — SMTP host, port, from address, TLS — and
 *     its own hint pointed at the server tab for the per-project override. One subject, two
 *     screens, one of them named after machines.
 *
 * So the panel moved to Settings, directly under the team default it overrides. Nothing about the
 * behaviour changed: the network override still decides the invite transport (InviteUserModal
 * reads it through isNetworkIsolated), and a project with no mail anywhere still says so.
 *
 * SECOND PASS, THE DAY IT MOVED: the panel arrived here as four boxes of its own — a network
 * card, an amber banner, a checkbox card and a table of what VCA sends — sitting under a section
 * built out of the settings page's CardSection, with its own heading sizes and its own padding
 * (owner: 다른 탭들이랑 디자인이 통일감이 없어). It is one CardSection now, with the same
 * heading block, the same label/value pairs and the same field styling as Team mail above it and
 * as every other section on this page.
 *
 * The rebuild also settled the duplicate control the comparison turned up: the amber banner's
 * "Set up SMTP" button and the checkbox below it were two controls for one decision, in two
 * boxes. One switch decides where this project's mail goes; the warning that used to be permanent
 * now appears only in the case that is actually dangerous, which is an internet-isolated site
 * still relying on the team's server.
 *
 * WHAT THE MAIL ITSELF IS (carried over with the move, written 2026-08-28). VCA does not host
 * mailboxes: it hands messages to the customer's own mail server (Exchange / Zimbra / Postfix),
 * which is what users read in their internal webmail. On an internet-separated network that is
 * what makes an invite link workable at all, because the webmail and VCA both sit inside it, so
 * the link resolves.
 *
 * Only two things send mail today, account invitations and password resets, and both go to the
 * person they concern, so there is no recipient list to configure here. VIP-detection and daily
 * report mail were discussed and deliberately left out of this version; when they arrive they need
 * recipients and conditions, which is a separate screen rather than another field here.
 *
 * PROVISIONAL: the backend developer is still looking into how SMTP is actually configured on
 * their side, so the field set below (host / port / from-address / TLS) is this screen's guess at
 * the shape, not a settled contract. `mailDomain` is NOT provisional: accounts live on one domain
 * and /request-access already refuses addresses outside it. Expect the SMTP fields to change (auth
 * credentials, a connection test, a per-event sender) and keep them in one block so that change
 * stays local.
 *
 * Settings inherit from the team and can be overridden per project. The inherited case is the
 * normal one (one company, one mail server), and the override exists because network isolation
 * (see isNetworkIsolated, set in NetworkStatus below) is resolved per PROJECT, not per team: one
 * team really can hold an internet-isolated project routing through an internal server alongside
 * an internet-reachable project that does not. Every deployment is on-premise (see
 * getAuthConfig's doc comment), which is a separate axis from whether a given site can reach the
 * internet, and this override is keyed on the second one.
 */

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { isNetworkIsolated, resolveMailConfig, useVcaStore } from "@/lib/vcaStore";
import { useToast } from "../Toast";
import { usePortalLanguage } from "@/lib/i18n";
import { portProblem } from "@/lib/fieldChecks";
import {
  BORDER, CONTROL_HEIGHT, FieldError, PairGrid, PairItem, Switch, TextField, usePortalEditAccess,
} from "./PortalShared";
const NETWORK_T = {
  en: {
    heading: "Network reachability",
    desc: "Decides whether invites go out by external email or this project's internal mailbox.",
    isolated: "Isolated", connected: "Connected",
    autoDetected: "Auto-detected via outbound ping:",
    noResponse: "No response (isolated)", reachable: "Reachable",
    measured: "Measured",
    recheck: "Recheck",
    recheckAsked: (when: string) => `Asked ${when}. The figure above is still the server's last reading.`,
    inForce: "In force",
    overrideBy: (who: string, when: string) => `Overridden by ${who} on ${when}`,
    /* Short forms, used only in the override button: the status words above are the value's own
       ("Isolated", "Connected") and read as a proper noun mid-sentence. */
    overrideTo: (state: string) => `Override the measurement — treat as ${state}`,
    isolatedShort: "isolated", connectedShort: "connected",
    revertToDetection: "Use the measurement",
    setByHand: "Set by hand",
    handCancel: "Cancel",
    overrideWhy: "A firewall can make the ping wrong. Setting it by hand records who did.",
  },
  ko: {
    heading: "네트워크 연결 상태",
    desc: "초대장이 외부 이메일로 발송될지, 이 프로젝트의 내부 메일함으로 발송될지를 결정합니다.",
    isolated: "격리됨", connected: "연결됨",
    autoDetected: "외부 핑(ping)을 통한 자동 감지:",
    noResponse: "응답 없음(격리됨)", reachable: "연결 가능",
    measured: "측정값",
    recheck: "다시 확인",
    recheckAsked: (when: string) => `${when}에 요청했습니다. 위 값은 서버가 마지막으로 보고한 측정값입니다.`,
    inForce: "적용 중",
    overrideBy: (who: string, when: string) => `${who}이(가) ${when}에 측정값을 무시하고 지정`,
    overrideTo: (state: string) => `측정값을 무시하고 ${state}로 지정`,
    isolatedShort: "격리", connectedShort: "연결",
    revertToDetection: "측정값 사용",
    setByHand: "직접 지정",
    handCancel: "취소",
    overrideWhy: "방화벽 뒤에서는 핑이 틀릴 수 있습니다. 직접 지정하면 누가 했는지 남습니다.",
  },
} as const;
const MAIL_T = {
  en: {
    usingDefault: (name: string) => `Using ${name}'s default mail server`,
    theTeam: "the team",
    bannerDesc: "Set up a dedicated SMTP server if this project needs its own, like an on-prem site with no internet access.",
    setUpSmtp: "Set up SMTP",
    inEffect: "In effect for this project",
    domain: "Domain", smtpHost: "SMTP host", sentFrom: "Sent from", source: "Source",
    thisProject: "This project", inheritedFrom: (name: string) => `Inherited from ${name}`,
    notConfigured: "No mail server configured. Invitations and password resets cannot be sent until one is set here or on the team.",
    useDifferentServer: "Use a different mail server for this project",
    useDifferentServerDesc: "For a site with no internet, routing through its own internal server.",
    provisionalNotice: "These SMTP fields are provisional — the exact settings the server needs are still being confirmed. The mail domain below is final.",
    mailDomain: "Mail domain", mailDomainPlaceholder: "company.local",
    mailDomainHint: "Accounts must have an address on this domain — requests and invites to anything else are refused.",
    smtpHostPlaceholder: "mail.company.local",
    port: "Port", portPlaceholder: "587", portError: "1–65535",
    fromAddressPlaceholder: "vca-noreply@company.local",
    fromAddressError: (domain: string) => `Must be an address on ${domain}.`,
    fromAddressHint: "The From: address recipients will see.",
    useTls: "Use TLS", save: "Save", saveProject: "Save for this project",
    saveFixFields: "Fix the fields marked above",
    toastUsingTeam: "Using team mail settings",
    toastSaved: "Mail settings saved",
    toastSavedDesc: (addr: string) => `Invites will be sent from ${addr}. Nothing has been sent through this relay yet — send one invite and confirm it arrives before you rely on it.`,
    /* Parallel to the team block's 「Team mail · <team>」 above the rule (owner, 2026-09-29: 이게
       그아래 내용의 타이틀 의미를 담고있는건 아닌것같은뎅). 「This project」 alone named a SCOPE
       and not a subject, so the line read as a divider label while everything under it — is there
       internet, which server, what goes out — went unannounced. Same shape as the line above: what
       it is, then whose. */
    panelHeading: "Project mail",
    panelHint: "Where this project's invitations and password resets go out from.",
    networkLabel: "Internet",
    mailServerLabel: "Mail server",
    isolatedRisk: "This site is internet-isolated and still using the team's mail server. Invitations will not arrive unless that server is reachable from inside the site.",
    inheritedSummary: (domain: string, host: string) => `${domain} · ${host}`,
    whatVcaSends: "What VCA sends",
    accountInvitation: "Account invitation", accountInvitationValue: "To the invited address, on approval",
    passwordReset: "Password reset", passwordResetValue: "To the account's own address, on request",
  },
  ko: {
    usingDefault: (name: string) => `${name}의 기본 메일 서버 사용 중`,
    theTeam: "팀",
    bannerDesc: "이 프로젝트에 전용 메일 서버가 필요하다면 별도로 설정하세요. 인터넷이 연결되지 않은 온프레미스 사이트가 그런 경우입니다.",
    setUpSmtp: "SMTP 설정",
    inEffect: "이 프로젝트에 적용 중인 설정",
    domain: "도메인", smtpHost: "SMTP 호스트", sentFrom: "발신 주소", source: "출처",
    thisProject: "이 프로젝트", inheritedFrom: (name: string) => `${name}에서 상속됨`,
    notConfigured: "메일 서버가 설정되어 있지 않습니다. 여기 또는 팀에 메일 서버를 설정하기 전까지 초대장과 비밀번호 재설정 메일을 보낼 수 없습니다.",
    useDifferentServer: "이 프로젝트에 다른 메일 서버 사용",
    useDifferentServerDesc: "인터넷이 없는 사이트에서 자체 내부 서버로 보낼 때 켭니다.",
    provisionalNotice: "아래 SMTP 항목은 잠정적인 값입니다 — 서버에 필요한 정확한 설정은 아직 확인 중입니다. 메일 도메인 항목은 확정된 값입니다.",
    mailDomain: "메일 도메인", mailDomainPlaceholder: "company.local",
    mailDomainHint: "계정은 반드시 이 도메인의 주소를 사용해야 합니다 — 그 외 주소로의 요청과 초대는 거부됩니다.",
    smtpHostPlaceholder: "mail.company.local",
    port: "포트", portPlaceholder: "587", portError: "1–65535",
    fromAddressPlaceholder: "vca-noreply@company.local",
    fromAddressError: (domain: string) => `${domain} 주소여야 합니다.`,
    fromAddressHint: "수신자에게 표시될 발신(From) 주소입니다.",
    useTls: "TLS 사용", save: "저장", saveProject: "이 프로젝트만 저장",
    saveFixFields: "위에 표시된 항목을 고쳐주세요",
    toastUsingTeam: "팀 메일 설정 사용 중",
    toastSaved: "메일 설정 저장됨",
    toastSavedDesc: (addr: string) => `초대장은 ${addr}에서 발송됩니다. 아직 이 릴레이로 보낸 적은 없습니다. 초대를 한 통 보내 도착하는지 확인한 뒤에 쓰세요.`,
    panelHeading: "프로젝트 메일",
    panelHint: "이 프로젝트의 초대장과 비밀번호 재설정 메일이 어디에서 나가는지 정합니다.",
    networkLabel: "인터넷 연결",
    mailServerLabel: "메일 서버",
    isolatedRisk: "이 사이트는 인터넷과 격리돼 있는데 팀의 메일 서버를 쓰고 있습니다. 사이트 안에서 그 서버에 닿지 않으면 초대장이 도착하지 않습니다.",
    inheritedSummary: (domain: string, host: string) => `${domain} · ${host}`,
    whatVcaSends: "VCA가 발송하는 메일",
    accountInvitation: "계정 초대", accountInvitationValue: "승인 시 초대받은 주소로 발송",
    passwordReset: "비밀번호 재설정", passwordResetValue: "요청 시 계정 본인 주소로 발송",
  },
} as const;

/**
 * ONE SECTION: how this site reaches the world, and where its mail goes out from.
 *
 * Network and mail were two cards because they were two components; they are one question in
 * practice — an isolated site is exactly the site that needs its own relay — so they are one
 * section with two pairs, in the order somebody reads them.
 */
export default function ProjectMailPanel({ projectId }: { projectId: string }) {
  const { mayEdit, reason: readOnlyReason } = usePortalEditAccess();
  const projects = useVcaStore(s => s.projects);
  const teams = useVcaStore(s => s.teams);
  const updateProjectMail = useVcaStore(s => s.updateProjectMail);
  const setNetworkIsolationOverride = useVcaStore(s => s.setNetworkIsolationOverride);
  const requestNetworkRecheck = useVcaStore(s => s.requestNetworkRecheck);
  const { showToast } = useToast();
  const [lang] = usePortalLanguage();
  const t = MAIL_T[lang];
  const n = NETWORK_T[lang];

  const project = projects.find(p => p.id === projectId);
  const team = project ? teams.find(o => o.id === project.teamId) : undefined;
  const inherited = resolveMailConfig(projectId, projects, teams);
  const overridden = !!project?.mailDomain || !!project?.smtp;

  const [override, setOverride] = useState(overridden);
  /* The override is a rare correction, so it is REACHABLE rather than OFFERED (owner, 2026-09-29:
     격리로 지정 버튼이 항상 있는게 맞아?). A standing button to contradict a correct reading is an
     invitation to contradict it, and on almost every site the reading is right. At rest the row is
     the measurement and 「다시 확인」; 「직접 지정」 opens the rest. An override already in force is
     never hidden — see hasOverride below. */
  const [handOpen, setHandOpen] = useState(false);
  const [domain, setDomain] = useState(project?.mailDomain ?? "");
  const [host, setHost] = useState(project?.smtp?.host ?? "");
  const [port, setPort] = useState(String(project?.smtp?.port ?? 587));
  const [fromAddress, setFromAddress] = useState(project?.smtp?.fromAddress ?? "");
  const [useTls, setUseTls] = useState(project?.smtp?.useTls ?? true);

  if (!project) return null;

  const detected = project.networkIsolatedDetected ?? false;
  const hasOverride = (project.networkIsolatedOverride ?? null) !== null;
  const isolated = isNetworkIsolated(project);

  const portNumber = Number(port);
  const portValid = portProblem(port) === null && port.trim() !== "";
  // The From: address has to live on the domain being configured, or the receiving server will
  // reject or spam-file it — worth catching here rather than discovering it when invites stop
  // arriving.
  const fromMatchesDomain = !domain || !fromAddress || fromAddress.trim().toLowerCase().endsWith(`@${domain.trim().toLowerCase()}`);
  const formValid = !override || (domain.trim() !== "" && host.trim() !== "" && portValid && fromAddress.trim() !== "" && fromMatchesDomain);
  /*
   * A SAVE BUTTON THAT IS LIT BEFORE ANYTHING IS TYPED IS LYING ABOUT ITS OWN STATE.
   *
   * MEASURED before the change: open Settings → 메일 and 「이 프로젝트만 저장」 was enabled the
   * instant the tab drew, on a project inheriting everything, with every field untouched —
   * pressing it wrote an audit row saying the project's mail settings had been updated when
   * nothing had. The team block beside it had the opposite problem: its button was correctly dead
   * until an edit, and said nowhere why.
   *
   * ONE RULE ACROSS THIS SCREEN, and this is the half that needs a button: a form of several
   * fields is saved, a single value applies as you set it (the timezone, the watermark, the
   * network override below). So the button arms on a real difference from what is stored, and
   * when it is dark a line beside it says which of the three reasons it is.
   */
  const storedPort = String(project.smtp?.port ?? 587);
  const fieldsChanged = domain.trim() !== (project.mailDomain ?? "")
    || host.trim() !== (project.smtp?.host ?? "")
    || port.trim() !== storedPort
    || fromAddress.trim() !== (project.smtp?.fromAddress ?? "")
    || useTls !== (project.smtp?.useTls ?? true);
  /* Turning the override off is a change on its own — it clears this project's settings back to
     the team's — so it counts even though no field was touched. */
  const changed = override !== overridden || (override && fieldsChanged);
  const canSave = mayEdit && changed && formValid;
  /* See PortalSettingsPage's twin: a reason only where looking at the screen does not give it. */
  const saveBlockedReason = !mayEdit ? readOnlyReason
    : !formValid ? t.saveFixFields
    : null;

  const save = () => {
    if (!canSave) return;
    if (!override) {
      updateProjectMail(projectId, { mailDomain: undefined, smtp: undefined });
      showToast({ variant: "success", title: t.toastUsingTeam });
      return;
    }
    updateProjectMail(projectId, {
      mailDomain: domain.trim(),
      smtp: { host: host.trim(), port: portNumber, fromAddress: fromAddress.trim(), useTls },
    });
    // Saved, not verified — nothing here connects to the relay. On an on-prem site the invite
    // mail is how staff get accounts, so a typo'd host means invitations vanish with no sign on
    // this screen; the toast says so rather than letting "saved" read as "working".
    //
    // HANDOFF NOTE: a test send is the fix — POST /api/portal/projects/{id}/mail/test, and this
    // toast becomes a real result instead of a caveat.
    showToast({ variant: "success", title: t.toastSaved, desc: t.toastSavedDesc(fromAddress.trim()) });
  };

  /*
   * A SCOPE, NOT A SECTION (owner: 메일 탭에 두개 항목이 있는데 이거 맞아?).
   *
   * It arrived here as its own CardSection, which gave the Mail rail entry two headings, two icon
   * chips and two save buttons over the same four field names — two records, read as one thing
   * duplicated. They ARE two records: the team's default mail server, and the exception a single
   * internet-isolated site needs. So the fix is not to merge them but to make the relationship
   * visible: one card headed Mail, the team default first, then a ruled line and this block,
   * each with the scope named and each with its own save, because saving one must not write the
   * other.
   */
  return (
    /* The rule needs air on BOTH sides (owner: 라인이 위에 버튼에 너무 붙어있어). The card's own
       22px gap put it that far under the team block's save button, which is the right gap between
       two fields and too tight for a line that separates two scopes — the button read as sitting
       on it.

       MEASURED, not guessed: the card's flex gap does not reach this element (CardSection puts its
       children in a wrapper of its own), so the space above the rule was 0 before this margin and
       14px with a 14px one. 26 above and 24 below reads as a break between two scopes rather than
       as an underline on the button. */
    <div style={{ borderTop: BORDER, marginTop: "26px", paddingTop: "24px", display: "flex", flexDirection: "column", gap: "22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--gray-900)" }}>{t.panelHeading}</p>
        <p style={{ fontSize: "12px", color: "var(--gray-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</p>
      </div>
      {/* `spaced`: these rows are three subjects — is there internet, which mail server, what
          goes out — not three fields of one form. */}
      <PairGrid spaced>
        {/*
          A MEASUREMENT IS NOT A SETTING (2026-09-29).

          This was a switch reading 「인터넷 연결 · 연결됨」 with the sentence 「외부 핑을 통한 자동
          감지: 연결 가능」 directly under it — the screen measuring the network and then handing
          the reader a control to contradict the measurement, at the same rank, with the switch
          winning. Two goes had already been spent getting the switch's polarity to agree with its
          own label; the polarity was never the problem. A switch says "this is yours to set", and
          whether a gateway answers a ping is not.

          So the measurement is the value now: read-only, stated as what it is, with 「다시 확인」
          beside it — the only honest verb this console has. It cannot measure a network from a
          browser, so pressing it records the ASK and says so; the figure above it does not move
          until the server reports a new one. Same reasoning as the camera status override, where
          an operator may attempt a reconnect and may not certify a recovery.

          THE OVERRIDE SURVIVES, DEMOTED. It is not decoration: a firewall makes the ping wrong
          both ways, this product ships on-premises only and some sites are isolated on purpose,
          and isNetworkIsolated() is what routes an invitation. Taking it away would leave such a
          site with no way to say so. But it now reads as what it is — somebody overruling a
          measurement — and it carries their name and the moment, because the question an
          undelivered invitation raises is "did the ping say this, or did a person?".
        */}
        <PairItem label={t.networkLabel} hint={n.overrideWhy}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* The measurement, and the only thing on this row drawn as a value. */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                {n.measured} · {detected ? n.noResponse : n.reachable}
              </span>
              {mayEdit && (
                <button className="portal-btn-outline" onClick={() => requestNetworkRecheck(projectId)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0, height: "24px", padding: "0 9px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <RefreshCw size={11} strokeWidth={2.2} />
                  {n.recheck}
                </button>
              )}
              {/* Quiet text, not a bordered button: this is the way to a rare correction, not one
                  of two things to do here. Hidden once the override is in force, because the block
                  below is then already open and carries its own way back. */}
              {mayEdit && !hasOverride && !handOpen && (
                <button onClick={() => setHandOpen(true)}
                  style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", borderBottom: "1px dotted var(--gray-300)" }}>
                  {n.setByHand}
                </button>
              )}
            </div>
            {/* Only after somebody asks, and it reports the asking rather than an outcome. */}
            {project.networkCheckRequestedAt && (
              <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>
                {n.recheckAsked(new Date(project.networkCheckRequestedAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US"))}
              </p>
            )}
            {/* SUBORDINATE, AND INDENTED TO SAY SO. Below the measurement, in the lighter tone,
                behind a rule: the reader meets the measured fact first and the disagreement
                second. */}
            {mayEdit && (hasOverride || handOpen) && (
              <div style={{ borderTop: BORDER, paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {hasOverride ? (
                  <>
                    <p style={{ fontSize: "11px", lineHeight: 1.5, color: "var(--warning-500)", fontWeight: 700 }}>
                      {n.inForce}: {isolated ? n.isolated : n.connected}
                    </p>
                    {/* WHO SAID SO. A row written before this field existed has no author, and
                        the line prints only what it holds rather than guessing at one. */}
                    {project.networkIsolatedOverrideBy && project.networkIsolatedOverrideAt && (
                      <p style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>
                        {n.overrideBy(project.networkIsolatedOverrideBy, new Date(project.networkIsolatedOverrideAt).toLocaleString(lang === "ko" ? "ko-KR" : "en-US"))}
                      </p>
                    )}
                    <button className="portal-btn-outline" onClick={() => setNetworkIsolationOverride(projectId, null)}
                      style={{ alignSelf: "flex-start", height: "24px", padding: "0 9px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-600)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {n.revertToDetection}
                    </button>
                  </>
                ) : (
                  /* Pinning the value the ping already reports would be a no-op dressed as a
                     decision, so the one button offered is the disagreement: treat this site as
                     the opposite of what was measured. */
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="portal-btn-outline" onClick={() => setNetworkIsolationOverride(projectId, !detected)}
                      style={{ height: "24px", padding: "0 9px", borderRadius: "7px", border: BORDER, backgroundColor: "white", color: "var(--gray-500)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {n.overrideTo(detected ? n.connectedShort : n.isolatedShort)}
                    </button>
                    {/* Opened and not wanted after all — the way back out, so the row can return
                        to being one measured value. */}
                    <button onClick={() => setHandOpen(false)}
                      style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 600, color: "var(--gray-500)" }}>
                      {n.handCancel}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </PairItem>

        {/* WHERE MAIL GOES OUT FROM. One switch, not a banner button and a checkbox in two boxes.
            The inherited values are stated beside it rather than repeated in a card of their own,
            because "what is in force" is one line when nothing is being edited. */}
        <PairItem label={t.mailServerLabel} hint={t.useDifferentServerDesc}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Switch checked={override} onChange={setOverride} label={t.useDifferentServer} disabled={!mayEdit} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)" }}>
                {override ? t.thisProject : t.inheritedFrom(team?.name ?? t.theTeam)}
              </span>
            </div>
            {!override && inherited.mailDomain && (
              <p style={{ fontSize: "11px", color: "var(--gray-400)", fontFamily: "monospace" }}>
                {t.inheritedSummary(inherited.mailDomain, inherited.smtp ? `${inherited.smtp.host}:${inherited.smtp.port}` : "—")}
              </p>
            )}
            {/* A project with nothing configured anywhere cannot invite anyone, which is worth
                saying whatever the switch is set to. */}
            {!inherited.mailDomain && !override && (
              <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.notConfigured}</p>
            )}
            {/* THE WARNING, ONLY WHERE IT IS TRUE. This was a permanent amber banner on every
                inheriting project; the case that actually loses invitations is an isolated site
                relying on a server it may not be able to reach. */}
            {!override && isolated && inherited.mailDomain && (
              <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.isolatedRisk}</p>
            )}
          </div>
        </PairItem>

        {override && (
          <>
            <PairItem label={t.mailDomain} hint={t.mailDomainHint}>
              <TextField value={domain} onChange={setDomain} placeholder={t.mailDomainPlaceholder} />
            </PairItem>
            <PairItem label={t.smtpHost}>
              <TextField value={host} onChange={setHost} placeholder={t.smtpHostPlaceholder} />
            </PairItem>
            <PairItem label={t.port}>
              <div>
                <TextField value={port} onChange={v => setPort(v.replace(/[^0-9]/g, ""))} placeholder={t.portPlaceholder} inputMode="numeric" />
                {!portValid && port.trim() !== "" && <FieldError>{t.portError}</FieldError>}
              </div>
            </PairItem>
            <PairItem label={t.sentFrom} hint={t.fromAddressHint}>
              <div>
                <TextField value={fromAddress} onChange={setFromAddress} placeholder={t.fromAddressPlaceholder} />
                {!fromMatchesDomain && <FieldError>{t.fromAddressError(domain.trim())}</FieldError>}
              </div>
            </PairItem>
            <PairItem label={t.useTls}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "var(--gray-600)" }}>
                <input type="checkbox" checked={useTls} onChange={e => setUseTls(e.target.checked)} disabled={!mayEdit} />
                {t.useTls}
              </label>
            </PairItem>
          </>
        )}

        {/* The two messages this product sends, and who each one goes to. Read once, which is why
            it is the last pair rather than a card of its own. */}
        <PairItem label={t.whatVcaSends}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <SettingRow label={t.accountInvitation} value={t.accountInvitationValue} />
            <SettingRow label={t.passwordReset} value={t.passwordResetValue} />
          </div>
        </PairItem>
      </PairGrid>

      {/* Says out loud that these fields are not settled, so nobody hands them to a customer as
          the configuration contract before the backend confirms it. */}
      {override && (
        <p style={{ fontSize: "11px", color: "var(--warning-500)", lineHeight: 1.5 }}>{t.provisionalNotice}</p>
      )}

      {/* Named for what it writes. Two buttons reading "저장" in one card, one of them writing
          every project on the team, is the kind of button people press once and regret. */}
      {/* THE REASON IS BESIDE THE BUTTON, NOT IN ITS TOOLTIP. A disabled button fires no hover
          events in some browsers and none at all on touch — the same finding that moved the
          refused-row reasons in the Users panel onto a visible mark. A dark button with nothing
          saying why is a screen that has stopped answering. */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button className="portal-btn-primary" onClick={save} disabled={!canSave}
          style={{ height: CONTROL_HEIGHT, padding: "0 16px", borderRadius: "8px", border: "none", backgroundColor: canSave ? "var(--primary-400)" : "var(--gray-200)", color: canSave ? "white" : "var(--gray-400)", fontSize: "12px", fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {t.saveProject}
        </button>
        {saveBlockedReason && (
          <span style={{ fontSize: "11px", color: "var(--gray-400)", lineHeight: 1.5 }}>{saveBlockedReason}</span>
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", width: "108px", flexShrink: 0, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: "12px", color: "var(--gray-900)", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
