// RedmapPage domain — person/vehicle search hits.

export type RedmapMode = "person" | "car";
// A quick-select preset (60/70/80/90) or any value in between via the slider — no longer a
// fixed set of buttons only, so this is just `number`, not a literal union.
export type SimilarityLimit = number;

export interface HitResult {
  id: string;
  camera: string;
  location: string;
  date: string;
  time: string;
  score: string;
  bodyScore: string;
  isUnregistered: boolean;
  faceUrl: string;
  bodyUrl: string;
  mapLabel: string;
  lat: number;
  lng: number;
  /** Duration only, e.g. "30m 32s" — the "Elapsed" label is the UI's, not the data's. */
  elapsed?: string;
  // Which real-world person this sighting belongs to. A low-similarity or lookalike-heavy search
  // can legitimately return sightings of more than one distinct person, not just multiple sightings
  // of the same one — this is what the person-filter chips group/color by.
  personId: string;
  // No personLabel. It used to live here as "Match 1" / "Match 2" and read on screen as a ranking
  // of one person's results rather than as different people — see the note by distinctPersons in
  // RedmapPage. The label is a display concern now: made from position, translated, and never
  // frozen into data.
}

export interface DateRange {
  start: string | null;
  end: string | null;
}
