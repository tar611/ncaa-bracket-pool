import { Router } from "express";
import {
  getAllSlotKeys,
  resolvePredictedTeamsForSlot,
  slotKeyToString,
  type SlotKey,
} from "../lib/bracketStructure";
import { prisma } from "../lib/prisma";
import { getFinalFourPairing, isTournamentLocked } from "../lib/tournamentConfig";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
router.use(requireAuth);

router.post("/", async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const existing = await prisma.bracket.findUnique({ where: { userId: req.userId! } });
  if (existing) {
    res.status(409).json({ error: "You already have a bracket for this tournament" });
    return;
  }

  const bracket = await prisma.bracket.create({ data: { userId: req.userId!, name: name.trim() } });
  res.status(201).json(bracket);
});

// Builds every slot the way THIS user's bracket sees it: Round 64
// matchups are the real fixed field, everything after that is resolved
// from the user's own earlier picks (not the real tournament results) —
// see resolvePredictedTeamsForSlot for why.
async function buildBracketView(bracketId: string) {
  const [allSlots, picks, teams] = await Promise.all([
    prisma.bracketSlot.findMany(),
    prisma.pick.findMany({ where: { bracketId } }),
    prisma.team.findMany(),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const slotIdToKey = new Map<string, SlotKey>(
    allSlots.map((slot) => [slot.id, { round: slot.round, region: slot.region, slotIndex: slot.slotIndex }]),
  );

  const round64FixedTeams = new Map<string, [string | null, string | null]>();
  for (const slot of allSlots) {
    if (slot.round === "ROUND_64") {
      round64FixedTeams.set(slotKeyToString(slot), [slot.team1Id, slot.team2Id]);
    }
  }

  const picksBySlotKey = new Map<string, string>();
  const pickBySlotId = new Map<string, string>();
  for (const pick of picks) {
    const key = slotIdToKey.get(pick.slotId);
    if (!key) continue;
    picksBySlotKey.set(slotKeyToString(key), pick.predictedWinnerTeamId);
    pickBySlotId.set(pick.slotId, pick.predictedWinnerTeamId);
  }

  const actualSlotByKey = new Map(allSlots.map((slot) => [slotKeyToString(slot), slot]));
  const finalFourPairing = getFinalFourPairing();

  return getAllSlotKeys().map((slotKey) => {
    const actualSlot = actualSlotByKey.get(slotKeyToString(slotKey))!;
    const [team1Id, team2Id] = resolvePredictedTeamsForSlot(
      slotKey,
      round64FixedTeams,
      picksBySlotKey,
      finalFourPairing,
    );

    return {
      slotId: actualSlot.id,
      round: slotKey.round,
      region: slotKey.region,
      slotIndex: slotKey.slotIndex,
      team1: team1Id ? teamsById.get(team1Id) ?? null : null,
      team2: team2Id ? teamsById.get(team2Id) ?? null : null,
      predictedWinnerTeamId: pickBySlotId.get(actualSlot.id) ?? null,
      actual: {
        status: actualSlot.status,
        winnerTeamId: actualSlot.winnerTeamId,
        team1Score: actualSlot.team1Score,
        team2Score: actualSlot.team2Score,
      },
    };
  });
}

router.get("/me", async (req, res) => {
  const bracket = await prisma.bracket.findUnique({ where: { userId: req.userId! } });
  if (!bracket) {
    res.status(404).json({ error: "No bracket yet — create one first" });
    return;
  }

  const slots = await buildBracketView(bracket.id);
  res.json({ bracket, locked: isTournamentLocked(), slots });
});

router.put("/me/picks/:slotId", async (req, res) => {
  if (isTournamentLocked()) {
    res.status(403).json({ error: "The tournament has started — picks are locked" });
    return;
  }

  const { predictedWinnerTeamId } = req.body ?? {};
  if (typeof predictedWinnerTeamId !== "string") {
    res.status(400).json({ error: "predictedWinnerTeamId is required" });
    return;
  }

  const bracket = await prisma.bracket.findUnique({ where: { userId: req.userId! } });
  if (!bracket) {
    res.status(404).json({ error: "No bracket yet — create one first" });
    return;
  }

  const slot = await prisma.bracketSlot.findUnique({ where: { id: req.params.slotId } });
  if (!slot) {
    res.status(404).json({ error: "No such bracket slot" });
    return;
  }

  const view = await buildBracketView(bracket.id);
  const target = view.find((entry) => entry.slotId === slot.id)!;
  const validTeamIds = [target.team1?.id, target.team2?.id].filter(Boolean);

  if (!validTeamIds.includes(predictedWinnerTeamId)) {
    res.status(400).json({
      error: "That team isn't one of the two options for this game yet — make picks for earlier rounds first",
    });
    return;
  }

  const pick = await prisma.pick.upsert({
    where: { bracketId_slotId: { bracketId: bracket.id, slotId: slot.id } },
    update: { predictedWinnerTeamId },
    create: { bracketId: bracket.id, slotId: slot.id, predictedWinnerTeamId },
  });

  // Known limitation: changing an earlier-round pick doesn't cascade-clear
  // any later-round picks that depended on it, so a later pick can end up
  // referencing a team that's no longer one of that slot's two options.
  // Not a scoring risk (everything locks at tip-off either way) — just
  // something the UI should flag if it ever shows a stale pick.
  res.json(pick);
});

export default router;
