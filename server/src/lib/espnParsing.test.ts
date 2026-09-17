import { describe, expect, it } from "vitest";
import { mapEspnState, parseGameNoteHeadline, resolveGameOutcome, seedsMatch } from "./espnParsing";

describe("parseGameNoteHeadline", () => {
  it("parses a regional round headline", () => {
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - West Region - 1st Round")).toEqual({
      round: "ROUND_64",
      region: "WEST",
    });
  });

  it("parses every regional round name correctly", () => {
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - East Region - 2nd Round")?.round).toBe(
      "ROUND_32",
    );
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - East Region - Sweet 16")?.round).toBe(
      "SWEET_16",
    );
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - East Region - Elite 8")?.round).toBe(
      "ELITE_8",
    );
  });

  it("parses Final Four and Championship headlines with no region", () => {
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - Final Four")).toEqual({
      round: "FINAL_4",
      region: "NATIONAL",
    });
    expect(parseGameNoteHeadline("NCAA Men's Basketball Championship - National Championship")).toEqual({
      round: "CHAMPIONSHIP",
      region: "NATIONAL",
    });
  });

  it("returns null for a headline from an unrelated event", () => {
    expect(parseGameNoteHeadline("Big Ten Conference Tournament - Championship")).toBeNull();
  });
});

describe("mapEspnState", () => {
  it("maps pre/in/post to our three statuses", () => {
    expect(mapEspnState("pre")).toBe("SCHEDULED");
    expect(mapEspnState("in")).toBe("IN_PROGRESS");
    expect(mapEspnState("post")).toBe("FINAL");
  });
});

describe("resolveGameOutcome", () => {
  it("resolves scores and winner in the normal case", () => {
    const competitors: [any, any] = [
      { team: { displayName: "Duke" }, score: "80", winner: true },
      { team: { displayName: "UNC" }, score: "75", winner: false },
    ];
    const outcome = resolveGameOutcome(competitors, "Duke", "UNC", true);
    expect(outcome).toEqual({ scoreA: 80, scoreB: 75, winnerIsA: true });
  });

  it("still resolves correctly when ESPN lists the competitors in the opposite order", () => {
    const competitors: [any, any] = [
      { team: { displayName: "UNC" }, score: "75", winner: false },
      { team: { displayName: "Duke" }, score: "80", winner: true },
    ];
    const outcome = resolveGameOutcome(competitors, "Duke", "UNC", true);
    expect(outcome).toEqual({ scoreA: 80, scoreB: 75, winnerIsA: true });
  });

  it("returns no winner for a game that isn't final yet", () => {
    const competitors: [any, any] = [
      { team: { displayName: "Duke" }, score: "40" },
      { team: { displayName: "UNC" }, score: "38" },
    ];
    const outcome = resolveGameOutcome(competitors, "Duke", "UNC", false);
    expect(outcome.winnerIsA).toBeNull();
  });

  it("regression: identifies the correct winner even when both teams share a seed-adjacent identity, since matching is by name not seed", () => {
    // Reproduces the real 2026 Final Four: Michigan (Midwest #1) and Arizona
    // (West #1) are both 1-seeds meeting in the same game. A seed-based
    // lookup can't tell them apart; name-based matching still can.
    const competitors: [any, any] = [
      { team: { displayName: "Arizona Wildcats" }, score: "63", winner: false },
      { team: { displayName: "Michigan Wolverines" }, score: "72", winner: true },
    ];
    const outcome = resolveGameOutcome(competitors, "Michigan Wolverines", "Arizona Wildcats", true);
    expect(outcome).toEqual({ scoreA: 72, scoreB: 63, winnerIsA: true });
  });
});

describe("seedsMatch", () => {
  it("matches identical pairs", () => {
    expect(seedsMatch([1, 16], [1, 16])).toBe(true);
  });

  it("matches reversed pairs", () => {
    expect(seedsMatch([1, 16], [16, 1])).toBe(true);
  });

  it("rejects non-matching pairs", () => {
    expect(seedsMatch([1, 16], [8, 9])).toBe(false);
  });
});
