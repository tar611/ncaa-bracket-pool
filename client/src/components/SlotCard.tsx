import type { BracketSlotView } from "../lib/api";

interface SlotCardProps {
  slot: BracketSlotView;
  locked: boolean;
  onPick: (slotId: string, teamId: string) => void;
}

export function SlotCard({ slot, locked, onPick }: SlotCardProps) {
  const isDecided = slot.actual.status === "FINAL";
  const pickCorrect =
    isDecided && slot.predictedWinnerTeamId ? slot.predictedWinnerTeamId === slot.actual.winnerTeamId : null;

  const borderClass =
    pickCorrect === true ? "border-emerald-500" : pickCorrect === false ? "border-red-500" : "border-neutral-800";

  return (
    <div className={`flex flex-col gap-1 rounded border ${borderClass} bg-neutral-900 p-2 text-sm`}>
      {[slot.team1, slot.team2].map((team, i) =>
        team ? (
          <button
            key={team.id}
            type="button"
            disabled={locked}
            onClick={() => onPick(slot.slotId, team.id)}
            className={`flex items-center justify-between rounded px-2 py-1 text-left ${
              slot.predictedWinnerTeamId === team.id
                ? "bg-emerald-600/30 text-emerald-100"
                : "text-neutral-200 hover:bg-neutral-800"
            } ${locked ? "cursor-default" : "cursor-pointer"}`}
          >
            <span>
              <span className="mr-1 text-neutral-500">{team.seed}</span>
              {team.name}
            </span>
            {isDecided && (
              <span className="text-xs text-neutral-500">{i === 0 ? slot.actual.team1Score : slot.actual.team2Score}</span>
            )}
          </button>
        ) : (
          // Not resolvable yet — either the real earlier game hasn't been
          // played, or (for a later round) this user hasn't picked winners
          // for the two games that feed into this one.
          <div key={i} className="rounded px-2 py-1 text-neutral-600">
            TBD
          </div>
        ),
      )}
    </div>
  );
}
