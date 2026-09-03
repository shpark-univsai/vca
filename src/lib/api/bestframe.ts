// Best Frame domain — camera feeds and detections.
// Currently returns the static mock data defined in BestFramePage.tsx.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { CAM_DATA, DEFAULT_DATA, NORMAL_CAMS_INIT } from "@/components/BestFramePage";
import { useVcaStore } from "@/lib/vcaStore";
import { mockDelay } from "./client";

/**
 * The File lists come from the store's uploads, not from constants in BestFramePage.
 *
 * They used to be four hardcoded entries (v1-v3, i1) with no way to add to them, which meant the
 * Portal could register an upload and Best Frame would never see it — the same two-id-spaces
 * failure that already bit Live Monitoring and Re-ID once. One array, written by Portal's Input
 * Sources tab and read here, so an upload's id IS the id this page looks its data up by.
 *
 * Only analysed uploads appear. A file still queued has no detections yet, and listing it would put
 * a row in the sidebar that opens onto nothing.
 */
function uploadsAsCams(kind: "video" | "image") {
  return useVcaStore.getState().uploads
    .filter(u => u.kind === kind && u.status === "done")
    .map(u => ({ id: u.id, name: u.fileName, checked: false, monitor: "normal" as const }));
}

export async function getCamData() {
  return mockDelay(CAM_DATA);
}

export async function getDefaultCamData() {
  return mockDelay(DEFAULT_DATA);
}

export async function getNormalCams() {
  return mockDelay(NORMAL_CAMS_INIT);
}

export async function getVideoCams() {
  return mockDelay(uploadsAsCams("video"));
}

export async function getImageCams() {
  return mockDelay(uploadsAsCams("image"));
}
