// Shared between BestFramePage and BestFrameDetailPage — was duplicated in both files.

export type DetType = "VIP" | "Vehicle" | "Unknown";
export type MonitorState = "normal" | "active" | "alert";

export interface Camera {
  id: string;
  name: string;
  checked: boolean;
  monitor: MonitorState;
}

export interface Detection {
  id: string;
  type: DetType;
  name: string;
  group: string;
  confidence: number;
  /**
   * The day this was captured, "YYYY-MM-DD", in the site's own time zone.
   *
   * Carried rather than assumed. `time` is a wall clock with no date in it, and the screens that
   * show a captured moment used to pair it with TODAY's date — so a detection from 94 minutes ago
   * read on a site clock of 00:30 was stamped with today's date and yesterday's time, i.e. about
   * 23 hours into the future, on an evidence screen.
   */
  date: string;
  time: string;
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface CamData {
  camLabel: string;
  location: string;
  bgUrl?: string;
  detections: Detection[];
  /** A single uploaded snapshot has no surrounding footage — no playback, no other frames to
   *  scrub through. Omitted (or "video") means a live camera or a recording, both of which have
   *  real duration and get the full Analyze Frame timeline; "image" hides it. */
  sourceType?: "video" | "image";
}

export interface HUDState {
  det: Detection;
  camId: string;
  location: string;
  camLabel: string;
  x: number;
  y: number;
}
