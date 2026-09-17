import type { Region, Round } from "./bracketStructure";

// ESPN's scoreboard event notes always carry a headline of the form
// "NCAA Men's Basketball Championship - <Region> Region - <Round>" for
// regional rounds, or without a region for Final Four/Championship games.
// Parsing this (rather than trying to infer round/region from dates or
// team names) is the one reliable signal ESPN gives us for free.
const ROUND_NAME_MAP: Record<string, Round> = {
  "1st Round": "ROUND_64",
  "2nd Round": "ROUND_32",
  "Sweet 16": "SWEET_16",
  "Elite 8": "ELITE_8",
  "Final Four": "FINAL_4",
  "National Championship": "CHAMPIONSHIP",
};

const VALID_REGIONS: Region[] = ["SOUTH", "EAST", "MIDWEST", "WEST"];

export interface ParsedGameNote {
  round: Round;
  region: Region;
}

export function parseGameNoteHeadline(headline: string): ParsedGameNote | null {
  if (!headline.startsWith("NCAA Men's Basketball Championship")) return null;

  const regionMatch = headline.match(/- (\w+) Region -/);
  const region = regionMatch ? (regionMatch[1].toUpperCase() as Region) : "NATIONAL";
  if (region !== "NATIONAL" && !VALID_REGIONS.includes(region)) return null;

  for (const [espnName, round] of Object.entries(ROUND_NAME_MAP)) {
    if (headline.endsWith(espnName)) {
      return { round, region };
    }
  }

  return null;
}

export type EspnCompetitionState = "pre" | "in" | "post";

// ESPN's granular status names (STATUS_HALFTIME, STATUS_END_PERIOD, etc.)
// change more often than our app cares about — every one of them collapses
// to IN_PROGRESS except the pre-game and final states.
export function mapEspnState(state: EspnCompetitionState): "SCHEDULED" | "IN_PROGRESS" | "FINAL" {
  switch (state) {
    case "pre":
      return "SCHEDULED";
    case "in":
      return "IN_PROGRESS";
    case "post":
      return "FINAL";
  }
}

export interface EspnCompetitorLike {
  team: { displayName: string };
  score: string;
  winner?: boolean;
}

export interface GameOutcome {
  scoreA: number;
  scoreB: number;
  // null when the game isn't final yet.
  winnerIsA: boolean | null;
}

// Resolves ESPN's two competitors against two already-known team names.
// Matches by NAME rather than seed — seed is only useful for finding which
// slot a game belongs to (comparing the pair as a set). Identifying which
// specific competitor is "team A" has to use something always-unique, since
// two teams in the very same game can share a seed number (this actually
// happened in the real 2026 tournament: Michigan and Arizona, both 1-seeds
// from different regions, met in the Final Four — a seed-based lookup
// there silently picked the wrong team as the winner).
export function resolveGameOutcome(
  competitors: [EspnCompetitorLike, EspnCompetitorLike],
  nameA: string,
  nameB: string,
  isFinal: boolean,
): GameOutcome {
  const competitorA = competitors.find((c) => c.team.displayName === nameA) ?? competitors[0];
  const competitorB = competitors.find((c) => c.team.displayName === nameB) ?? competitors[1];

  return {
    scoreA: Number(competitorA.score),
    scoreB: Number(competitorB.score),
    winnerIsA: isFinal ? (competitorA.winner ? true : competitorB.winner ? false : null) : null,
  };
}

// Order-independent match: does this candidate slot's two expected seeds
// equal the two seeds ESPN reported for this event? Used to find which of
// a round's few BracketSlot rows a given ESPN event actually corresponds
// to, once round/region have narrowed it down to a handful of candidates.
export function seedsMatch(a: [number, number], b: [number, number]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}
