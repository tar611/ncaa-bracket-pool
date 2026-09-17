import "dotenv/config";
import {
  getAllSlotKeys,
  resolvePredictedTeamsForSlot,
  slotKeyToString,
  type SlotKey,
} from "./bracketStructure";
import { mapEspnState, parseGameNoteHeadline, resolveGameOutcome, seedsMatch } from "./espnParsing";
import { prisma } from "./prisma";
import { computeBracketScore } from "./scoring";
import { getFinalFourPairing } from "./tournamentConfig";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

interface EspnCompetitor {
  team: { displayName: string };
  score: string;
  winner?: boolean;
  curatedRank?: { current: number };
}

interface EspnEvent {
  id: string;
  competitions: Array<{
    status: { type: { state: "pre" | "in" | "post" } };
    competitors: EspnCompetitor[];
    notes?: Array<{ headline: string }>;
  }>;
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

function formatDateForEspn(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export interface SyncSummary {
  eventsSeen: number;
  slotsUpdated: number;
  unmatched: string[];
  bracketsRescored: number;
}

export async function syncScoresForDate(date: Date = new Date()): Promise<SyncSummary> {
  const dateParam = formatDateForEspn(date);
  const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateParam}`);
  if (!response.ok) {
    throw new Error(`ESPN scoreboard request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as EspnScoreboardResponse;

  const [allSlots, allTeams] = await Promise.all([prisma.bracketSlot.findMany(), prisma.team.findMany()]);

  const teamsById = new Map(allTeams.map((team) => [team.id, team]));
  const round64FixedTeams = new Map<string, [string | null, string | null]>();
  // Only FINAL slots count as "actual results" for resolving later rounds —
  // an in-progress leader isn't a settled winner yet.
  const actualResultsBySlot = new Map<string, string>();
  const slotByKey = new Map<string, (typeof allSlots)[number]>();

  for (const slot of allSlots) {
    const key = slotKeyToString(slot);
    slotByKey.set(key, slot);
    if (slot.round === "ROUND_64") {
      round64FixedTeams.set(key, [slot.team1Id, slot.team2Id]);
    }
    if (slot.status === "FINAL" && slot.winnerTeamId) {
      actualResultsBySlot.set(key, slot.winnerTeamId);
    }
  }

  const finalFourPairing = getFinalFourPairing();
  let slotsUpdated = 0;
  const unmatched: string[] = [];

  for (const event of data.events) {
    const competition = event.competitions[0];
    const headline = competition.notes?.[0]?.headline;
    const parsed = headline ? parseGameNoteHeadline(headline) : null;
    // Not an NCAA tournament game we recognize — e.g. an NIT game the same week.
    if (!parsed) continue;

    const [competitorA, competitorB] = competition.competitors;
    const seedA = competitorA.curatedRank?.current;
    const seedB = competitorB.curatedRank?.current;
    if (seedA === undefined || seedB === undefined) {
      unmatched.push(`${event.id}: ${headline} — ESPN didn't report a seed for one of the teams`);
      continue;
    }

    // Find which of this round's few slots this event belongs to, by
    // comparing ESPN's two seeds against what our own bracket structure
    // expects to be playing in each candidate slot. This works even for
    // later rounds, where the matchup wasn't knowable ahead of time —
    // "expected" here is a live derivation from already-synced results,
    // not a fixed schedule.
    const candidates = getAllSlotKeys().filter(
      (slot) => slot.round === parsed.round && slot.region === parsed.region,
    );

    let matchedSlotKey: SlotKey | null = null;
    let matchedTeamIds: [string, string] | null = null;

    for (const candidate of candidates) {
      const [expectedAId, expectedBId] = resolvePredictedTeamsForSlot(
        candidate,
        round64FixedTeams,
        actualResultsBySlot,
        finalFourPairing,
      );
      if (!expectedAId || !expectedBId) continue;

      const expectedSeeds: [number, number] = [teamsById.get(expectedAId)!.seed, teamsById.get(expectedBId)!.seed];
      if (seedsMatch(expectedSeeds, [seedA, seedB])) {
        matchedSlotKey = candidate;
        matchedTeamIds = [expectedAId, expectedBId];
        break;
      }
    }

    if (!matchedSlotKey || !matchedTeamIds) {
      unmatched.push(`${event.id}: ${headline} (seeds ${seedA} vs ${seedB}) — no matching slot yet, try again later`);
      continue;
    }

    const [teamAId, teamBId] = matchedTeamIds;
    const status = mapEspnState(competition.status.type.state);
    const outcome = resolveGameOutcome(
      [competitorA, competitorB],
      teamsById.get(teamAId)!.name,
      teamsById.get(teamBId)!.name,
      status === "FINAL",
    );
    const winnerTeamId = outcome.winnerIsA === null ? null : outcome.winnerIsA ? teamAId : teamBId;

    const dbSlot = slotByKey.get(slotKeyToString(matchedSlotKey))!;
    await prisma.bracketSlot.update({
      where: { id: dbSlot.id },
      data: {
        team1Id: teamAId,
        team2Id: teamBId,
        team1Score: outcome.scoreA,
        team2Score: outcome.scoreB,
        status,
        winnerTeamId,
        espnEventId: event.id,
      },
    });
    slotsUpdated++;

    if (winnerTeamId) {
      actualResultsBySlot.set(slotKeyToString(matchedSlotKey), winnerTeamId);
    }
  }

  const bracketsRescored = slotsUpdated > 0 ? await rescoreAllBrackets() : 0;

  return { eventsSeen: data.events.length, slotsUpdated, unmatched, bracketsRescored };
}

async function rescoreAllBrackets(): Promise<number> {
  const [brackets, allSlots] = await Promise.all([
    prisma.bracket.findMany({ include: { picks: { include: { slot: true } } } }),
    prisma.bracketSlot.findMany(),
  ]);

  const actualSlots = allSlots.map((slot) => ({
    round: slot.round,
    region: slot.region,
    slotIndex: slot.slotIndex,
    winnerTeamId: slot.winnerTeamId,
    status: slot.status,
  }));

  for (const bracket of brackets) {
    const picks = bracket.picks.map((pick) => ({
      round: pick.slot.round,
      region: pick.slot.region,
      slotIndex: pick.slot.slotIndex,
      predictedWinnerTeamId: pick.predictedWinnerTeamId,
    }));
    const totalScore = computeBracketScore(picks, actualSlots);
    if (totalScore !== bracket.totalScore) {
      await prisma.bracket.update({ where: { id: bracket.id }, data: { totalScore } });
    }
  }

  return brackets.length;
}
