import { type Region, type Round, ROUND_POINTS, slotKeyToString } from "./bracketStructure";

export interface ScorableSlot {
  round: Round;
  region: Region;
  slotIndex: number;
  winnerTeamId: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINAL";
}

export interface ScorablePick {
  round: Round;
  region: Region;
  slotIndex: number;
  predictedWinnerTeamId: string;
}

// A pick only scores once the real game at that slot has actually finished
// — an in-progress leader isn't a result yet, and awarding points early
// would have to be walked back if the game flips.
export function computeBracketScore(picks: ScorablePick[], actualSlots: ScorableSlot[]): number {
  const actualBySlot = new Map(actualSlots.map((slot) => [slotKeyToString(slot), slot]));

  let total = 0;
  for (const pick of picks) {
    const actual = actualBySlot.get(slotKeyToString(pick));
    if (actual?.status === "FINAL" && actual.winnerTeamId === pick.predictedWinnerTeamId) {
      total += ROUND_POINTS[pick.round];
    }
  }
  return total;
}
