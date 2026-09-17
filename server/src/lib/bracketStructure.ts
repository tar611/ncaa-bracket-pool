export type Region = "SOUTH" | "EAST" | "MIDWEST" | "WEST" | "NATIONAL";
export type Round = "ROUND_64" | "ROUND_32" | "SWEET_16" | "ELITE_8" | "FINAL_4" | "CHAMPIONSHIP";

export const ROUND_ORDER: Round[] = ["ROUND_64", "ROUND_32", "SWEET_16", "ELITE_8", "FINAL_4", "CHAMPIONSHIP"];

export const REGIONS: Exclude<Region, "NATIONAL">[] = ["SOUTH", "EAST", "MIDWEST", "WEST"];

// Standard bracket scoring: points double each round, rewarding correct
// picks deeper in the tournament far more than early-round chalk picks.
export const ROUND_POINTS: Record<Round, number> = {
  ROUND_64: 1,
  ROUND_32: 2,
  SWEET_16: 4,
  ELITE_8: 8,
  FINAL_4: 16,
  CHAMPIONSHIP: 32,
};

// The traditional NCAA seed pairing within a region for the Round of 64,
// indexed 0-7. This layout has been effectively unchanged for decades —
// only which teams hold each seed changes year to year.
export const ROUND_64_SEED_PAIRINGS: [number, number][] = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

export interface SlotKey {
  round: Round;
  region: Region;
  slotIndex: number;
}

export interface FinalFourPairing {
  // Which two regions' champions meet in each national semifinal. Not
  // hardcoded because the NCAA doesn't guarantee the same pairing every
  // year — this comes from that year's seed data instead.
  semifinal0: [Region, Region];
  semifinal1: [Region, Region];
}

export function slotKeyToString(slot: SlotKey): string {
  return `${slot.round}:${slot.region}:${slot.slotIndex}`;
}

// How many slots exist per region for a round (Final Four/Championship use
// region "NATIONAL" instead, with 2 and 1 slots respectively).
export function getSlotCountForRegion(round: Round): number {
  switch (round) {
    case "ROUND_64":
      return 8;
    case "ROUND_32":
      return 4;
    case "SWEET_16":
      return 2;
    case "ELITE_8":
      return 1;
    case "FINAL_4":
      return 2;
    case "CHAMPIONSHIP":
      return 1;
  }
}

// The two previous-round slots whose winners advance into this slot.
// Returns null for Round 64, since those teams come directly from the
// seeding rather than from an earlier game's result.
export function getFeederSlots(slot: SlotKey, finalFourPairing: FinalFourPairing): [SlotKey, SlotKey] | null {
  const { round, region, slotIndex } = slot;

  if (round === "ROUND_64") return null;

  if (round === "CHAMPIONSHIP") {
    return [
      { round: "FINAL_4", region: "NATIONAL", slotIndex: 0 },
      { round: "FINAL_4", region: "NATIONAL", slotIndex: 1 },
    ];
  }

  if (round === "FINAL_4") {
    const [regionA, regionB] = slotIndex === 0 ? finalFourPairing.semifinal0 : finalFourPairing.semifinal1;
    return [
      { round: "ELITE_8", region: regionA, slotIndex: 0 },
      { round: "ELITE_8", region: regionB, slotIndex: 0 },
    ];
  }

  const previousRound = ROUND_ORDER[ROUND_ORDER.indexOf(round) - 1];
  return [
    { round: previousRound, region, slotIndex: slotIndex * 2 },
    { round: previousRound, region, slotIndex: slotIndex * 2 + 1 },
  ];
}

// The two team ids a user's own bracket currently has "in" a given slot —
// for Round 64 these are the real, fixed seeding matchup; for every later
// round they're whatever that same user picked to win in the two feeder
// slots (or null if they haven't made those picks yet).
export function resolvePredictedTeamsForSlot(
  slot: SlotKey,
  round64FixedTeams: Map<string, [string | null, string | null]>,
  picksBySlot: Map<string, string>,
  finalFourPairing: FinalFourPairing,
): [string | null, string | null] {
  if (slot.round === "ROUND_64") {
    return round64FixedTeams.get(slotKeyToString(slot)) ?? [null, null];
  }

  const feeders = getFeederSlots(slot, finalFourPairing);
  if (!feeders) return [null, null];

  const [feederA, feederB] = feeders;
  return [picksBySlot.get(slotKeyToString(feederA)) ?? null, picksBySlot.get(slotKeyToString(feederB)) ?? null];
}

// Every slot in the full 63-game bracket, in a stable order (round by
// round, region by region). Used by the seed script to generate the empty
// BracketSlot skeleton and by tests to sanity-check the total count.
export function getAllSlotKeys(): SlotKey[] {
  const slots: SlotKey[] = [];

  for (const round of ROUND_ORDER) {
    if (round === "FINAL_4" || round === "CHAMPIONSHIP") {
      for (let slotIndex = 0; slotIndex < getSlotCountForRegion(round); slotIndex++) {
        slots.push({ round, region: "NATIONAL", slotIndex });
      }
      continue;
    }

    for (const region of REGIONS) {
      for (let slotIndex = 0; slotIndex < getSlotCountForRegion(round); slotIndex++) {
        slots.push({ round, region, slotIndex });
      }
    }
  }

  return slots;
}
