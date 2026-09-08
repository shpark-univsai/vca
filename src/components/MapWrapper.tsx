"use client";

import dynamic from "next/dynamic";
import { LiveEvent, Device } from "@/lib/mockData";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

interface MapWrapperProps {
  selectedEvent?: LiveEvent | null;
  onCameraSelect?: (label: string | null) => void;
  onDistrictSelect?: (districtId: string) => void;
  districtFilter?: string | null;
  pinnedDevice?: Device | null;
  onGoLiveCam?: (location: string) => void;
  onGoRedmapTrace?: (personName: string) => void;
  onAnalyzeFrame?: (location: string) => void;
}

export default function MapWrapper({ selectedEvent, onCameraSelect, onDistrictSelect, districtFilter, pinnedDevice, onGoLiveCam, onGoRedmapTrace, onAnalyzeFrame }: MapWrapperProps) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <MapView
        selectedEvent={selectedEvent}
        onCameraSelect={onCameraSelect}
        onDistrictSelect={onDistrictSelect}
        districtFilter={districtFilter}
        pinnedDevice={pinnedDevice}
        onGoLiveCam={onGoLiveCam}
        onGoRedmapTrace={onGoRedmapTrace}
        onAnalyzeFrame={onAnalyzeFrame}
      />
    </div>
  );
}
