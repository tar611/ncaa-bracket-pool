import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SlotCard } from "../components/SlotCard";
import { api, type BracketSlotView, type Region, type Round } from "../lib/api";

const REGIONS: Region[] = ["SOUTH", "EAST", "MIDWEST", "WEST"];
const REGIONAL_ROUNDS: Round[] = ["ROUND_64", "ROUND_32", "SWEET_16", "ELITE_8"];

const ROUND_LABELS: Record<Round, string> = {
  ROUND_64: "Round of 64",
  ROUND_32: "Round of 32",
  SWEET_16: "Sweet 16",
  ELITE_8: "Elite 8",
  FINAL_4: "Final Four",
  CHAMPIONSHIP: "Championship",
};

export function BracketPage() {
  const [slots, setSlots] = useState<BracketSlotView[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [needsBracket, setNeedsBracket] = useState(false);
  const [bracketName, setBracketName] = useState("");
  const [activeRegion, setActiveRegion] = useState<Region>("SOUTH");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await api.getMyBracket();
      setSlots(data.slots);
      setLocked(data.locked);
      setNeedsBracket(false);
    } catch {
      setNeedsBracket(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateBracket = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.createBracket(bracketName);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create bracket");
    }
  };

  const handlePick = async (slotId: string, teamId: string) => {
    // Optimistic update so picking feels instant — reconciled with the
    // server's response right after, since a pick here can change which
    // teams are even valid choices in every later round that follows it.
    setSlots((prev) => prev && prev.map((s) => (s.slotId === slotId ? { ...s, predictedWinnerTeamId: teamId } : s)));
    try {
      await api.submitPick(slotId, teamId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pick");
      await load();
    }
  };

  if (needsBracket) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold text-neutral-100">Name your bracket</h1>
        <form onSubmit={handleCreateBracket} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="e.g. Dad's Sleeper Picks"
            value={bracketName}
            onChange={(e) => setBracketName(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-800 p-2 text-neutral-100"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="rounded bg-emerald-500 px-4 py-2 font-medium text-neutral-950 hover:bg-emerald-400"
          >
            Create bracket
          </button>
        </form>
      </div>
    );
  }

  if (!slots) {
    return <p className="p-8 text-neutral-400">Loading…</p>;
  }

  const finalFourSlots = slots.filter((s) => s.region === "NATIONAL");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-neutral-100">
      <h1 className="text-2xl font-semibold">Your Bracket</h1>
      {locked && <p className="mt-1 text-sm text-amber-400">The tournament has started — picks are locked.</p>}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {REGIONS.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => setActiveRegion(region)}
            className={`rounded px-3 py-1.5 text-sm ${
              activeRegion === region ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {region[0] + region.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-6 overflow-x-auto pb-4">
        {REGIONAL_ROUNDS.map((round) => (
          <div key={round} className="flex min-w-48 flex-col gap-3">
            <h2 className="text-sm font-medium text-neutral-400">{ROUND_LABELS[round]}</h2>
            {slots
              .filter((s) => s.region === activeRegion && s.round === round)
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((slot) => (
                <SlotCard key={slot.slotId} slot={slot} locked={locked} onPick={handlePick} />
              ))}
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Final Four</h2>
      <div className="mt-4 flex gap-6 overflow-x-auto pb-4">
        {(["FINAL_4", "CHAMPIONSHIP"] as Round[]).map((round) => (
          <div key={round} className="flex min-w-48 flex-col gap-3">
            <h2 className="text-sm font-medium text-neutral-400">{ROUND_LABELS[round]}</h2>
            {finalFourSlots
              .filter((s) => s.round === round)
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((slot) => (
                <SlotCard key={slot.slotId} slot={slot} locked={locked} onPick={handlePick} />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
