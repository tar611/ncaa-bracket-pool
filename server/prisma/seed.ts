import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getAllSlotKeys,
  ROUND_64_SEED_PAIRINGS,
  type Region,
} from "../src/lib/bracketStructure";
import { prisma } from "../src/lib/prisma";

interface FieldTeam {
  region: Region;
  seed: number;
  name: string;
}

async function main() {
  const fieldPath = join(__dirname, "..", "data", "2027-field.json");
  const { teams }: { teams: FieldTeam[] } = JSON.parse(readFileSync(fieldPath, "utf-8"));

  const placeholders = teams.filter((team) => team.name === "TBD");
  if (placeholders.length > 0) {
    throw new Error(
      `${placeholders.length} team(s) in data/2027-field.json still say "TBD" — fill in the real ` +
        `field from the Selection Sunday bracket before seeding.`,
    );
  }
  if (teams.length !== 64) {
    throw new Error(`Expected exactly 64 teams in data/2027-field.json, found ${teams.length}.`);
  }

  // Upsert on (seed, region) so re-running the seed after fixing a typo in
  // the field file updates the existing team instead of erroring on the
  // unique constraint or creating a duplicate.
  const teamsBySeedRegion = new Map<string, string>();
  for (const team of teams) {
    const row = await prisma.team.upsert({
      where: { seed_region: { seed: team.seed, region: team.region } },
      update: { name: team.name },
      create: { name: team.name, seed: team.seed, region: team.region },
    });
    teamsBySeedRegion.set(`${team.seed}:${team.region}`, row.id);
  }

  const round64Slots = getAllSlotKeys().filter((slot) => slot.round === "ROUND_64");

  for (const slot of round64Slots) {
    const [seedA, seedB] = ROUND_64_SEED_PAIRINGS[slot.slotIndex];
    const team1Id = teamsBySeedRegion.get(`${seedA}:${slot.region}`);
    const team2Id = teamsBySeedRegion.get(`${seedB}:${slot.region}`);

    if (!team1Id || !team2Id) {
      throw new Error(`Missing team for ${slot.region} seed ${seedA} or ${seedB}`);
    }

    await prisma.bracketSlot.upsert({
      where: { round_region_slotIndex: { round: slot.round, region: slot.region, slotIndex: slot.slotIndex } },
      update: { team1Id, team2Id },
      create: { round: slot.round, region: slot.region, slotIndex: slot.slotIndex, team1Id, team2Id },
    });
  }

  // Later rounds start empty — the score-sync job fills in each slot's
  // teams as the games that feed into it are actually decided.
  const laterRounds = getAllSlotKeys().filter((slot) => slot.round !== "ROUND_64");
  for (const slot of laterRounds) {
    await prisma.bracketSlot.upsert({
      where: { round_region_slotIndex: { round: slot.round, region: slot.region, slotIndex: slot.slotIndex } },
      update: {},
      create: { round: slot.round, region: slot.region, slotIndex: slot.slotIndex },
    });
  }

  console.log(`Seeded ${teams.length} teams and ${round64Slots.length + laterRounds.length} bracket slots.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
