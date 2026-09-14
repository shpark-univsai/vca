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
}
