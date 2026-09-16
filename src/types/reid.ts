// DataPage domain — Re-ID matching and RedFace VIP registry.

export type ReIDStatus = "VIP" | "Unknown" | "RedFace";
export type GenderFilter = "All" | "F" | "M";

export interface MatchItem {
  id: number;
  face: string;
  body: string;
  cam: string;
  date: string;
  time: string;
  similarity: number;
  gender: "M" | "F";
  age: string;
  plate?: string | null;
  status: ReIDStatus;
  /**
   * What the module reported this person was wearing. OPTIONAL, and the screen draws a cell only
   * where a value arrived — a detection that carries no apparel shows none rather than a default.
   *
   * These were three string literals in DetailModal ("White Jacket", "Dark Accent", "Black
   * Handbag"), so every person the system had ever detected wore the same clothes on the screen
   * an operator uses to narrow a search BY clothes.
   *
   * WHAT THE ROWS ACTUALLY CARRY, measured 2026-09-16. `apparel` and `prop` — garment type and
   * one carried item, both cycled per person in REID_DATA and both ALREADY used by the grid's
   * own filters. Those are the two that bind, and they are the two the modal draws.
   *
   * The three colour fields below are NOT populated today. REID_DATA never sets them, so reading
   * `p.topColor` typechecks (they are optional) and yields undefined every time — which is why a
   * first pass at this bug wired them, removed the three lies, and left three cells that can
   * never render. They stay declared because a real detector does emit colour and this is the
   * shape it lands in; they must not be read as "the values exist and something is dropping
   * them".
   */
  apparel?: string;
  prop?: string | null;
  topColor?: string;
  bottomColor?: string;
  shoesColor?: string;
}
