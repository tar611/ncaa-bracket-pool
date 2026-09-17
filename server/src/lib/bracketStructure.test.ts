import { describe, expect, it } from "vitest";
import {
  type FinalFourPairing,
  getAllSlotKeys,
  getFeederSlots,
  resolvePredictedTeamsForSlot,
  ROUND_64_SEED_PAIRINGS,
  slotKeyToString,
} from "./bracketStructure";

const PAIRING: FinalFourPairing = {
  semifinal0: ["SOUTH", "WEST"],
  semifinal1: ["EAST", "MIDWEST"],
};

describe("getAllSlotKeys", () => {
  it("produces exactly 63 slots — the standard single-elimination bracket size", () => {
    expect(getAllSlotKeys()).toHaveLength(63);
  });

  it("has 32 Round of 64 slots, one per first-round game", () => {
    const round64 = getAllSlotKeys().filter((slot) => slot.round === "ROUND_64");
    expect(round64).toHaveLength(32);
  });

  it("has exactly one Championship slot", () => {
    const championship = getAllSlotKeys().filter((slot) => slot.round === "CHAMPIONSHIP");
    expect(championship).toEqual([{ round: "CHAMPIONSHIP", region: "NATIONAL", slotIndex: 0 }]);
  });
});

describe("ROUND_64_SEED_PAIRINGS", () => {
  it("covers all 16 seeds exactly once across 8 pairings", () => {
    const seeds = ROUND_64_SEED_PAIRINGS.flat().sort((a, b) => a - b);
    expect(seeds).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe("getFeederSlots", () => {
  it("returns null for Round 64 — teams come from seeding, not a prior game", () => {
    expect(getFeederSlots({ round: "ROUND_64", region: "SOUTH", slotIndex: 0 }, PAIRING)).toBeNull();
  });

  it("feeds a Round 32 slot from the two Round 64 slots beneath it", () => {
    const feeders = getFeederSlots({ round: "ROUND_32", region: "SOUTH", slotIndex: 1 }, PAIRING);
    expect(feeders).toEqual([
      { round: "ROUND_64", region: "SOUTH", slotIndex: 2 },
      { round: "ROUND_64", region: "SOUTH", slotIndex: 3 },
    ]);
  });

  it("feeds Elite 8 (the regional final) from the two Sweet 16 slots in that region", () => {
    const feeders = getFeederSlots({ round: "ELITE_8", region: "WEST", slotIndex: 0 }, PAIRING);
    expect(feeders).toEqual([
      { round: "SWEET_16", region: "WEST", slotIndex: 0 },
      { round: "SWEET_16", region: "WEST", slotIndex: 1 },
    ]);
  });

  it("feeds each Final Four slot from the two regional champions in its pairing", () => {
    const semifinal0 = getFeederSlots({ round: "FINAL_4", region: "NATIONAL", slotIndex: 0 }, PAIRING);
    const semifinal1 = getFeederSlots({ round: "FINAL_4", region: "NATIONAL", slotIndex: 1 }, PAIRING);

    expect(semifinal0).toEqual([
      { round: "ELITE_8", region: "SOUTH", slotIndex: 0 },
      { round: "ELITE_8", region: "WEST", slotIndex: 0 },
    ]);
    expect(semifinal1).toEqual([
      { round: "ELITE_8", region: "EAST", slotIndex: 0 },
      { round: "ELITE_8", region: "MIDWEST", slotIndex: 0 },
    ]);
  });

  it("feeds the Championship from the two Final Four slots", () => {
    const feeders = getFeederSlots({ round: "CHAMPIONSHIP", region: "NATIONAL", slotIndex: 0 }, PAIRING);
    expect(feeders).toEqual([
      { round: "FINAL_4", region: "NATIONAL", slotIndex: 0 },
      { round: "FINAL_4", region: "NATIONAL", slotIndex: 1 },
    ]);
  });
});

describe("resolvePredictedTeamsForSlot", () => {
  const round64Fixed = new Map<string, [string | null, string | null]>([
    [slotKeyToString({ round: "ROUND_64", region: "SOUTH", slotIndex: 0 }), ["duke", "unc-asheville"]],
  ]);

  it("returns the real fixed matchup for a Round 64 slot", () => {
    const result = resolvePredictedTeamsForSlot(
      { round: "ROUND_64", region: "SOUTH", slotIndex: 0 },
      round64Fixed,
      new Map(),
      PAIRING,
    );
    expect(result).toEqual(["duke", "unc-asheville"]);
  });

  it("returns nulls for a later-round slot when the user hasn't picked its feeders yet", () => {
    const result = resolvePredictedTeamsForSlot(
      { round: "ROUND_32", region: "SOUTH", slotIndex: 0 },
      round64Fixed,
      new Map(),
      PAIRING,
    );
    expect(result).toEqual([null, null]);
  });

  it("resolves a later-round slot from the user's own picks in its feeder slots", () => {
    const picks = new Map([
      [slotKeyToString({ round: "ROUND_64", region: "SOUTH", slotIndex: 0 }), "duke"],
      [slotKeyToString({ round: "ROUND_64", region: "SOUTH", slotIndex: 1 }), "arizona"],
    ]);
    const result = resolvePredictedTeamsForSlot(
      { round: "ROUND_32", region: "SOUTH", slotIndex: 0 },
      round64Fixed,
      picks,
      PAIRING,
    );
    expect(result).toEqual(["duke", "arizona"]);
  });
});
