import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

describe("api request wrapper", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the stored JWT as a Bearer token when present", async () => {
    localStorage.setItem("token", "abc123");
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    await api.getLeaderboard();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBe("Bearer abc123");
  });

  it("omits the Authorization header when there's no stored token", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });

    await api.getLeaderboard();

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((options.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws the server's error message on a non-OK response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid email or password" }),
    });

    await expect(api.login("a@b.com", "wrong")).rejects.toThrow("Invalid email or password");
  });

  it("falls back to a generic message when the error response has no body", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.login("a@b.com", "x")).rejects.toThrow("Request failed (500)");
  });
});
