import { describe, expect, it } from "vitest";
import { computeBracketScore, type ScorablePick, type ScorableSlot } from "./scoring";

const round64Slot: ScorableSlot = {
  round: "ROUND_64",
  region: "SOUTH",
  slotIndex: 0,
  winnerTeamId: "duke",
  status: "FINAL",
};

const sweet16Slot: ScorableSlot = {
  round: "SWEET_16",
  region: "SOUTH",
  slotIndex: 0,
  winnerTeamId: "duke",
  status: "IN_PROGRESS",
};

describe("computeBracketScore", () => {
  it("awards round points for a correct, finished pick", () => {
    const pick: ScorablePick = { round: "ROUND_64", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "duke" };
    expect(computeBracketScore([pick], [round64Slot])).toBe(1);
  });

  it("awards nothing for an incorrect pick", () => {
    const pick: ScorablePick = { round: "ROUND_64", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "unc" };
    expect(computeBracketScore([pick], [round64Slot])).toBe(0);
  });

  it("awards nothing for a game that hasn't finished yet, even if the pick matches the current leader", () => {
    const pick: ScorablePick = { round: "SWEET_16", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "duke" };
    expect(computeBracketScore([pick], [sweet16Slot])).toBe(0);
  });

  it("sums points across multiple correct picks in different rounds", () => {
    const picks: ScorablePick[] = [
      { round: "ROUND_64", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "duke" },
      { round: "SWEET_16", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "duke" },
    ];
    const slots: ScorableSlot[] = [round64Slot, { ...sweet16Slot, status: "FINAL" }];

    // 1 point for the Round of 64 pick + 4 points for the Sweet 16 pick.
    expect(computeBracketScore(picks, slots)).toBe(5);
  });

  it("ignores picks for slots with no matching actual result", () => {
    const pick: ScorablePick = { round: "ELITE_8", region: "SOUTH", slotIndex: 0, predictedWinnerTeamId: "duke" };
    expect(computeBracketScore([pick], [])).toBe(0);
  });
});
