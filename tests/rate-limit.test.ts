import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";

describe("rate limit", () => {
  it("allows up to the cap then throws", () => {
    resetRateLimits();
    rateLimit("t", 2, 60_000, 1);
    rateLimit("t", 2, 60_000, 2);
    expect(() => rateLimit("t", 2, 60_000, 3)).toThrow(AppError);
  });

  it("resets after the window", () => {
    resetRateLimits();
    rateLimit("t", 1, 10, 0);
    expect(() => rateLimit("t", 1, 10, 1)).toThrow(AppError);
    rateLimit("t", 1, 10, 11);
  });
});
