// Best Frame domain — camera feeds and detections.
// Currently returns the mock feeds defined in BestFramePage.tsx, bound to one site's cameras.
// Swap the body of each function for a real fetch(`${API_BASE_URL}/...`) call later.

import { camDataForCameras, DEFAULT_DATA } from "@/components/BestFramePage";
import type { MonitorState } from "@/types/detection";
import { camerasInProject, getActiveProjectId, useVcaStore } from "@/lib/vcaStore";
import { runStateOf } from "@/lib/realtime/cameraStatus";
import { mockDelay } from "./client";

/** The site's registered cameras. A camera belongs to one site, so the site is part of the ask. */
function siteCameras(projectId: string) {
  return camerasInProject(useVcaStore.getState().cameras, projectId);
}

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
function uploadsAsCams(kind: "video" | "image", projectId: string) {
  return useVcaStore.getState().uploads
    .filter(u => u.projectId === projectId && u.kind === kind && u.status === "done")
    .map(u => ({ id: u.id, name: u.fileName, checked: false, monitor: "normal" as const }));
}

export async function getCamData(projectId: string = getActiveProjectId()) {
  return mockDelay(camDataForCameras(siteCameras(projectId)));
}

export async function getDefaultCamData() {
  return mockDelay(DEFAULT_DATA);
}

export async function getNormalCams(projectId: string = getActiveProjectId()) {
  return mockDelay(siteCameras(projectId).map(cam => ({
    id: cam.id,
    name: cam.name,
    checked: false,
    monitor: (runStateOf(cam.status) === "running" ? "normal" : "alert") as MonitorState,
  })));
}

export async function getVideoCams(projectId: string = getActiveProjectId()) {
  return mockDelay(uploadsAsCams("video", projectId));
}

export async function getImageCams(projectId: string = getActiveProjectId()) {
  return mockDelay(uploadsAsCams("image", projectId));
}
