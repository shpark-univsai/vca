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
   * an operator uses to narrow a search BY clothes. The values existed the whole time on the
   * Re-ID rows and reidToMatchItem was dropping them.
   */
  topColor?: string;
  bottomColor?: string;
  shoesColor?: string;
}
