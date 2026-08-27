"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVcaStore } from "@/lib/vcaStore";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { DATA_TABS, VIP_QUICK, TAB_ICONS } from "./DataPage";
import type { NavTab } from "./Navbar";

interface PaletteItem {
  group: string;
  label: string;
  sublabel?: string;
  avatar?: string;
  icon?: React.ReactNode;
  keywords: string;
  action: () => void;
}

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.9998 13.9998L11.1064 11.1064" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Same glyph as the "N Running" counter in the header, minus its run-cycle animation — a still
// icon reads as a plain list marker; animating every row in a scrolling list would not.
function CameraGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M13.9583 10H16.985C17.127 10.0001 17.2666 10.0364 17.3906 10.1056C17.5146 10.1748 17.6189 10.2745 17.6935 10.3953C17.7681 10.5161 17.8107 10.654 17.8171 10.7958C17.8234 10.9377 17.7935 11.0788 17.73 11.2058L16.035 14.5967C15.9707 14.7252 15.8743 14.8348 15.7552 14.9151C15.636 14.9953 15.4981 15.0434 15.3549 15.0546C15.2117 15.0659 15.068 15.0399 14.9377 14.9792C14.8075 14.9185 14.6952 14.8252 14.6117 14.7083L12.8417 12.2333" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.255 7.54373C14.4525 7.6426 14.6027 7.81584 14.6726 8.02539C14.7424 8.23493 14.7262 8.46363 14.6275 8.66123L12.0392 13.8371C11.9902 13.935 11.9225 14.0223 11.8398 14.094C11.7571 14.1657 11.661 14.2204 11.5572 14.255C11.4533 14.2896 11.3437 14.3034 11.2345 14.2956C11.1253 14.2878 11.0187 14.2586 10.9209 14.2096L3.00836 10.2496C2.43364 9.96007 1.99699 9.45471 1.79396 8.84407C1.59093 8.23342 1.63806 7.56722 1.92503 6.99123L3.07503 4.66623C3.21836 4.38058 3.41656 4.12597 3.65831 3.91693C3.90006 3.70788 4.18061 3.54851 4.48396 3.44791C4.78731 3.34731 5.1075 3.30746 5.42625 3.33062C5.74501 3.35378 6.05608 3.4395 6.34169 3.5829L14.255 7.54373Z" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66663 15.8333H4.79996C5.11057 15.8355 5.4156 15.7508 5.68064 15.5888C5.94568 15.4269 6.16019 15.1941 6.29996 14.9167L7.49996 12.5" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.66675 17.4993V14.166" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.83337 7.5H5.84067" stroke="var(--gray-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Global "jump to anything" search — pages, Data sub-tabs, cameras, and named targets, all in one
// place. Deliberately NOT a replacement for Smart Search's own multi-criteria filter form (see the
// product discussion this came out of): an investigator still needs those filters visible and
// adjustable, not collapsed behind a single box. This is the other kind of "unified search" —
// pure navigation, closer to a command palette than a query — for "take me to X" instead of
// "search for anyone matching X."
export default function CommandPalette({ open, onClose, onGoToPage }: {
  open: boolean; onClose: () => void; onGoToPage: (tab: NavTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameras = useVcaStore(s => s.cameras);

  useEscapeKey(onClose, open);

  // Reset during render (not in an effect) when `open` flips on — same compare-during-render
  // idiom used throughout DataPage.tsx for its own seed/nav-triggered resets.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setQuery(""); setActiveIndex(0); }
  }

  useEffect(() => {
    // Focus is a real external-system side effect (imperative DOM focus), unlike the state
    // reset above — it belongs in an effect, timed after the modal has actually mounted rather
    // than during the click/keydown that opened it.
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const goToData = (req: Parameters<ReturnType<typeof useVcaStore.getState>["requestDataNav"]>[0]) => {
    onGoToPage("DATA");
    useVcaStore.getState().requestDataNav(req);
  };

  const items = useMemo<PaletteItem[]>(() => [
    ...DATA_TABS.map(tab => ({
      group: "Data", label: tab, icon: <span style={{ color: "var(--gray-400)", display: "flex" }}>{TAB_ICONS[tab]}</span>, keywords: `data ${tab}`,
      action: () => goToData({ tab }),
    })),
    ...cameras.map(c => ({
      group: "Cameras", label: c.name, sublabel: c.code, icon: <CameraGlyph />, keywords: `${c.code} ${c.name} ${c.location}`,
      action: () => goToData({ tab: "Live Monitoring", cameraCode: c.code }),
    })),
    ...VIP_QUICK.map((v, i) => ({
      group: "VIP Targets", label: v.name, avatar: v.face, keywords: `vip ${v.name}`,
      // Live Monitoring, not "Smart Search": that stopped being a tab of its own and the search
      // form now lives inside Live Monitoring's sidebar, which is what vipIndex opens.
      action: () => goToData({ tab: "Live Monitoring", vipIndex: i }),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [cameras]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => it.keywords.toLowerCase().includes(q));
  }, [items, query]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, PaletteItem[]>();
    filtered.forEach(it => {
      if (!byGroup.has(it.group)) { byGroup.set(it.group, []); order.push(it.group); }
      byGroup.get(it.group)!.push(it);
    });
    return order.map(g => ({ group: g, items: byGroup.get(g)! }));
  }, [filtered]);
  // Only 4 of these, and they're the closest thing left to "top-level navigation" now that Pages
  // is gone — a horizontal quick-access row reads as more immediate than one more vertical list
  // to scroll past before reaching Cameras/targets.
  const dataGroup = groups.find(g => g.group === "Data") ?? null;
  // VIP Targets first — jumping straight to a watched person is the more common reason to open
  // this palette than browsing cameras, so it shouldn't sit below a whole camera list.
  //
  // Recent Targets used to be a third group here. It was four hardcoded entries, identical for
  // every operator, so "recent" was a claim the data couldn't make — and making it true needs
  // per-user search history on the server. A global palette is the wrong place to promise that.
  const LIST_GROUP_ORDER = ["VIP Targets", "Cameras"];
  const listGroups = groups
    .filter(g => g.group !== "Data")
    .sort((a, b) => LIST_GROUP_ORDER.indexOf(a.group) - LIST_GROUP_ORDER.indexOf(b.group));

  const activate = (item: PaletteItem) => {
    item.action();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "flex-start",
        justifyContent: "center", paddingTop: "14vh",
        backgroundColor: "rgba(14,22,42,0.35)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
      }}
    >
      <div style={{
        width: "560px", maxWidth: "90vw", maxHeight: "60vh", backgroundColor: "white", borderRadius: "14px",
        boxShadow: "0 24px 64px rgba(14,22,42,0.28)", border: "1px solid var(--gray-200)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 18px", borderBottom: "1px solid var(--gray-200)", flexShrink: 0 }}>
          <span style={{ color: "var(--gray-400)", display: "flex" }}><SearchGlyph /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); if (filtered[activeIndex]) activate(filtered[activeIndex]); }
            }}
            placeholder="Jump to a tab, camera, or target…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "var(--gray-900)", fontWeight: 600 }}
          />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-400)", backgroundColor: "var(--gray-100)", padding: "2px 6px", borderRadius: "5px" }}>ESC</span>
        </div>

        {dataGroup && (
          <div style={{ display: "flex", gap: "8px", padding: "10px 10px 4px", flexWrap: "wrap", borderBottom: "1px solid var(--gray-200)" }}>
            {dataGroup.items.map(item => {
              const flatIndex = filtered.indexOf(item);
              const active = flatIndex === activeIndex;
              return (
                <button
                  key={item.label}
                  onClick={() => activate(item)}
                  onMouseEnter={() => setActiveIndex(flatIndex)}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px",
                    border: active ? "1px solid var(--primary-400)" : "1px solid var(--gray-200)", cursor: "pointer",
                    backgroundColor: active ? "var(--primary-100)" : "white",
                  }}
                >
                  <span style={{ display: "flex", color: active ? "var(--primary-400)" : "var(--gray-400)" }}>{item.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: active ? "var(--primary-400)" : "var(--gray-900)", whiteSpace: "nowrap" }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="vca-hide-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "32px 0", textAlign: "center", fontSize: "13px", fontWeight: 600, color: "var(--gray-400)" }}>
              No matches for &quot;{query}&quot;.
            </div>
          )}
          {listGroups.map(({ group, items: groupItems }) => (
            <div key={group} style={{ marginBottom: "6px" }}>
              <div style={{ padding: "8px 10px 4px", fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                {group}
              </div>
              {groupItems.map(item => {
                const flatIndex = filtered.indexOf(item);
                const active = flatIndex === activeIndex;
                return (
                  <button
                    key={`${group}-${item.label}-${item.sublabel ?? ""}`}
                    onClick={() => activate(item)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left",
                      padding: "8px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                      backgroundColor: active ? "var(--primary-100)" : "transparent",
                    }}
                  >
                    {item.avatar ? (
                      <img src={item.avatar} alt="" style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: "var(--gray-100)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {item.icon}
                      </span>
                    )}
                    <span style={{ fontSize: "13px", fontWeight: 600, color: active ? "var(--primary-400)" : "var(--gray-900)" }}>{item.label}</span>
                    {item.sublabel && (
                      <span style={{ fontSize: "12px", color: "var(--gray-400)", marginLeft: "auto" }}>{item.sublabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "8px 16px", borderTop: "1px solid var(--gray-200)", flexShrink: 0 }}>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>↑↓ Navigate</span>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)" }}>↵ Select</span>
          <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--gray-400)", marginLeft: "auto" }}>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
