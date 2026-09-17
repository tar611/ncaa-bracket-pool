import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BracketSlotView } from "../lib/api";
import { SlotCard } from "./SlotCard";

function makeSlot(overrides: Partial<BracketSlotView> = {}): BracketSlotView {
  return {
    slotId: "slot-1",
    round: "ROUND_64",
    region: "SOUTH",
    slotIndex: 0,
    team1: { id: "duke", name: "Duke", seed: 1, region: "SOUTH" },
    team2: { id: "unca", name: "UNC Asheville", seed: 16, region: "SOUTH" },
    predictedWinnerTeamId: null,
    actual: { status: "SCHEDULED", winnerTeamId: null, team1Score: null, team2Score: null },
    ...overrides,
  };
}

describe("SlotCard", () => {
  it("shows TBD when a team isn't resolved yet", () => {
    render(<SlotCard slot={makeSlot({ team2: null })} locked={false} onPick={() => {}} />);
    expect(screen.getByText("TBD")).toBeInTheDocument();
  });

  it("calls onPick with the slot and team id when a team is clicked", () => {
    const onPick = vi.fn();
    render(<SlotCard slot={makeSlot()} locked={false} onPick={onPick} />);

    fireEvent.click(screen.getByText("Duke"));

    expect(onPick).toHaveBeenCalledWith("slot-1", "duke");
  });

  it("disables picking once the tournament is locked", () => {
    render(<SlotCard slot={makeSlot()} locked={true} onPick={() => {}} />);
    const button = screen.getByText("Duke").closest("button");
    expect(button).toBeDisabled();
  });

  it("does not render a border color judgment before the game is decided", () => {
    const { container } = render(
      <SlotCard slot={makeSlot({ predictedWinnerTeamId: "duke" })} locked={false} onPick={() => {}} />,
    );
    expect(container.firstChild).toHaveClass("border-neutral-800");
  });

  it("highlights a correct pick in green once the game is final", () => {
    const slot = makeSlot({
      predictedWinnerTeamId: "duke",
      actual: { status: "FINAL", winnerTeamId: "duke", team1Score: 80, team2Score: 60 },
    });
    const { container } = render(<SlotCard slot={slot} locked={true} onPick={() => {}} />);
    expect(container.firstChild).toHaveClass("border-emerald-500");
  });

  it("highlights a wrong pick in red once the game is final", () => {
    const slot = makeSlot({
      predictedWinnerTeamId: "duke",
      actual: { status: "FINAL", winnerTeamId: "unca", team1Score: 60, team2Score: 80 },
    });
    const { container } = render(<SlotCard slot={slot} locked={true} onPick={() => {}} />);
    expect(container.firstChild).toHaveClass("border-red-500");
  });
});
