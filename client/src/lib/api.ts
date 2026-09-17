const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Region = "SOUTH" | "EAST" | "MIDWEST" | "WEST" | "NATIONAL";
export type Round = "ROUND_64" | "ROUND_32" | "SWEET_16" | "ELITE_8" | "FINAL_4" | "CHAMPIONSHIP";
export type GameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL";

export interface Team {
  id: string;
  name: string;
  seed: number;
  region: Region;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

export interface Bracket {
  id: string;
  name: string;
  totalScore: number;
}

// One slot as seen through the current user's own bracket: the two teams
// are whatever that user has predicted so far (or the real Round 64
// matchup), not necessarily the real teams currently playing that slot in
// reality — "actual" carries the real result separately for comparison.
export interface BracketSlotView {
  slotId: string;
  round: Round;
  region: Region;
  slotIndex: number;
  team1: Team | null;
  team2: Team | null;
  predictedWinnerTeamId: string | null;
  actual: {
    status: GameStatus;
    winnerTeamId: string | null;
    team1Score: number | null;
    team2Score: number | null;
  };
}

export interface LeaderboardEntry {
  bracketId: string;
  bracketName: string;
  displayName: string;
  totalScore: number;
}

// Thin fetch wrapper: attaches the JWT and normalizes error responses.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  signup: (email: string, password: string, displayName: string) =>
    request<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  createBracket: (name: string) =>
    request<Bracket>("/api/brackets", { method: "POST", body: JSON.stringify({ name }) }),

  getMyBracket: () => request<{ bracket: Bracket; locked: boolean; slots: BracketSlotView[] }>("/api/brackets/me"),

  submitPick: (slotId: string, predictedWinnerTeamId: string) =>
    request(`/api/brackets/me/picks/${slotId}`, {
      method: "PUT",
      body: JSON.stringify({ predictedWinnerTeamId }),
    }),

  getLeaderboard: () => request<LeaderboardEntry[]>("/api/leaderboard"),
};
