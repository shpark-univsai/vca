"use client";

import { useMemo } from "react";
import {
  camerasInProject, getActiveProjectId, useProjectCameras, useVcaStore,
  type Camera, type CameraStatus,
} from "@/lib/vcaStore";

/**
 * The one place this app reads whether a camera is running.
 *
 * HANDOFF NOTE — do not add an MQTT client here.
 *
 * The realtime layer is the backend's, and it already exists on their side as
 * `frontend/src/lib/realtime/mqttClient` (this file sits at the mirrored path on purpose). At
 * intake they replace the body of the two accessors below with a bridge over that client; the
 * screens keep calling the same functions and nothing else moves. That is the whole reason this
 * module exists — before it, six places reached into the store for `camera.status`, so there was
 * no single point to swap.
 *
 * What the screens must NOT do: read `camera.status` off the store themselves. Reading it off a
 * camera they were *handed* is fine — that camera came from here.
 *
 * Portal is deliberately out of scope. Portal is the register: it edits status, shows the three
 * real values, and is the reason `error` exists at all. This seam is the monitoring app's reader.
 */

/**
 * What the app shows. Three camera states collapse to two because the app answers one question —
 * "can I watch this right now" — and a camera in `error` cannot be watched. Confirmed with the
 * backend: the module publishes RUNNING/STOPPED, `unknown` is a camera that has never reported,
 * and no failure reason is available, so a third state on this side would have nothing behind it.
 */
export type CameraRunState = "running" | "stopped";

/** Pure mapper, for a caller that was handed a camera rather than looking one up. */
export function runStateOf(status: CameraStatus): CameraRunState {
  return status === "online" ? "running" : "stopped";
}

export interface CameraStatusView {
  /** Run state by camera id, or undefined when this site has no such camera. */
  byId: (cameraId: string) => CameraRunState | undefined;
  /** Same, by the code printed on screen (`CAM-NOV-001`) — what the pickers hold. */
  byCode: (code: string) => CameraRunState | undefined;
  running: Camera[];
  stopped: Camera[];
}

function view(cameras: Camera[]): CameraStatusView {
  const byIdMap = new Map(cameras.map(c => [c.id, runStateOf(c.status)]));
  const byCodeMap = new Map(cameras.map(c => [c.code, runStateOf(c.status)]));
  return {
    byId: id => byIdMap.get(id),
    byCode: code => byCodeMap.get(code),
    running: cameras.filter(c => runStateOf(c.status) === "running"),
    stopped: cameras.filter(c => runStateOf(c.status) !== "running"),
  };
}

/**
 * For screens. Scoped to the site the header is pointed at, like every other app-side read —
 * a camera at another site is not one this screen can watch.
 *
 * Memoised: the arrays and lookups are rebuilt only when the camera list changes. Several screens
 * pass these straight into a fetch dependency, and a fresh object every render loops there.
 */
export function useCameraStatus(): CameraStatusView {
  const cameras = useProjectCameras();
  return useMemo(() => view(cameras), [cameras]);
}

/** For imperative code — a timer, a seeder, the api layer — that cannot call a hook. */
export function getCameraStatus(projectId?: string): CameraStatusView {
  const all = useVcaStore.getState().cameras;
  return view(projectId ? camerasInProject(all, projectId) : camerasInProject(all, getActiveProjectId()));
}
