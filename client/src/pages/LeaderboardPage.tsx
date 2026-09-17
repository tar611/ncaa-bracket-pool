import { useEffect, useState } from "react";
import { api, type LeaderboardEntry } from "../lib/api";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLeaderboard()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load leaderboard"));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 text-neutral-100">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {!entries ? (
        <p className="mt-4 text-neutral-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-neutral-400">No brackets yet.</p>
      ) : (
        <ol className="mt-6 flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={entry.bracketId}
              className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-900 p-3"
            >
              <span>
                <span className="mr-2 text-neutral-500">#{i + 1}</span>
                <span className="font-medium">{entry.displayName}</span>
                <span className="ml-2 text-sm text-neutral-500">— {entry.bracketName}</span>
              </span>
              <span className="font-semibold text-emerald-400">{entry.totalScore} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
