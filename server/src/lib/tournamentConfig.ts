import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FinalFourPairing } from "./bracketStructure";

interface TournamentConfigFile {
  lockAt: string;
  finalFourPairing: FinalFourPairing;
}

// Loaded once per process, not per-request — this file only changes when
// an admin re-runs the seed step for a new tournament, never during
// normal request handling.
const configPath = join(__dirname, "..", "..", "data", "tournament-config.json");
const rawConfig: TournamentConfigFile = JSON.parse(readFileSync(configPath, "utf-8"));

export function getTournamentLockAt(): Date {
  return new Date(rawConfig.lockAt);
}

export function getFinalFourPairing(): FinalFourPairing {
  return rawConfig.finalFourPairing;
}

export function isTournamentLocked(now: Date = new Date()): boolean {
  return now >= getTournamentLockAt();
}
