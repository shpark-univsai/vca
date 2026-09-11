function Bone({ w, h, color = "var(--gray-200)", radius = "4px" }: { w: string; h: string; color?: string; radius?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: w, height: h, backgroundColor: color, borderRadius: radius, flexShrink: 0 }} />;
}

function Circle({ size, color = "var(--gray-300)" }: { size: string; color?: string }) {
  return <div className="vca-skeleton-pulse" style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />;
}

function ListItemSkeleton({ nameW, subW }: { nameW: string; subW: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Circle size="40px" color="var(--gray-200)" />
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <Bone w={nameW} h="14px" />
            <Bone w={subW} h="10px" color="var(--gray-100)" />
          </div>
        </div>
        <Bone w="42px" h="18px" color="var(--gray-100)" />
      </div>
      <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)", flexShrink: 0 }} />
    </>
  );
}

function SidebarSkeleton() {
  return (
    <div style={{
      width: "380px", flexShrink: 0, height: "100%", backgroundColor: "white", borderRight: "1px solid var(--gray-200)",
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "24px", padding: "20px 24px", overflow: "hidden",
    }}>
      <div style={{ width: "100%", display: "flex", gap: "4px", padding: "3px", backgroundColor: "var(--gray-100)", borderRadius: "999px" }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          padding: "8px 16px", backgroundColor: "white", borderRadius: "999px", boxShadow: "0px 1px 1px rgba(24, 17, 39,0.03)",
        }}>
          <Circle size="12px" color="var(--gray-200)" />
          <Bone w="50px" h="12px" color="var(--gray-200)" radius="3px" />
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "8px 16px" }}>
          <Circle size="12px" color="var(--gray-300)" />
          <Bone w="50px" h="12px" color="var(--gray-300)" radius="3px" />
        </div>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex" }}>
            <Circle size="22px" color="var(--gray-200)" />
            <Circle size="22px" color="var(--gray-300)" />
            <div style={{ marginLeft: "-8px" }}><Circle size="22px" color="var(--gray-200)" /></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Bone w="16px" h="16px" color="var(--gray-300)" />
            <Bone w="110px" h="14px" />
          </div>
        </div>
        <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)" }} />
      </div>

      <div style={{ width: "100%", display: "flex", gap: "12px" }}>
        {["50px", "55px"].map((w, i) => (
          <div key={i} style={{ flex: 1, backgroundColor: "var(--gray-50)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <Bone w={w} h="10px" color="var(--gray-300)" radius="2px" />
            <Bone w="32px" h="20px" />
            <Bone w="40px" h="8px" color="var(--gray-100)" radius="2px" />
          </div>
        ))}
      </div>
      <div style={{ width: "100%", height: "1px", backgroundColor: "var(--gray-100)" }} />

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Bone w="90px" h="16px" color="var(--gray-300)" />
          <Bone w="32px" h="18px" color="var(--gray-100)" />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <Bone w="42px" h="24px" color="var(--gray-200)" radius="12px" />
          <Bone w="80px" h="24px" color="var(--gray-100)" radius="12px" />
          <Bone w="72px" h="24px" color="var(--gray-100)" radius="12px" />
        </div>
      </div>

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "4px" }}>
        {[["80px", "144px"], ["95px", "134px"], ["110px", "124px"], ["80px", "144px"], ["95px", "134px"]].map(([nameW, subW], i) => (
          <ListItemSkeleton key={i} nameW={nameW} subW={subW} />
        ))}
      </div>
    </div>
  );
}

function MapSkeleton() {
  const dots = [
    { left: "18%", top: "20%" }, { left: "30%", top: "42%" }, { left: "42%", top: "26%" },
    { left: "58%", top: "48%" }, { left: "72%", top: "30%" }, { left: "38%", top: "68%" },
    { left: "64%", top: "78%" }, { left: "50%", top: "88%" }, { left: "85%", top: "52%" },
  ];
  const pins = [{ left: "54%", top: "58%" }, { left: "78%", top: "84%" }];
  return (
    <div style={{ flex: 1, position: "relative", backgroundColor: "var(--gray-100)", minWidth: 0 }}>
      <div style={{
        position: "absolute", top: "24px", right: "24px", width: "40px", backgroundColor: "white",
        borderRadius: "8px", boxShadow: "2px 4px 3px rgba(24, 17, 39,0.05)", display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
        <div style={{ width: "40px", height: "1px", backgroundColor: "var(--gray-200)" }} />
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bone w="14px" h="3px" color="var(--gray-300)" radius="1px" />
        </div>
      </div>
      {dots.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "8px", height: "8px",
          borderRadius: "50%", backgroundColor: "var(--gray-300)",
        }} />
      ))}
      {pins.map((pos, i) => (
        <div key={i} className="vca-skeleton-pulse" style={{
          position: "absolute", left: pos.left, top: pos.top, width: "32px", height: "32px",
          borderRadius: "50%", backgroundColor: "var(--gray-400)", opacity: 0.35,
        }} />
      ))}
    </div>
  );
}

// Fits inside ClientLayout's tab-content area, below the real Navbar (which always renders,
// loading or not) — matches SkeletonBestFrame/SkeletonData/SkeletonRedmap's own convention.
export default function SkeletonDashboard() {
  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
      <SidebarSkeleton />
      <MapSkeleton />
    </div>
  );
}
