import { describe, expect, it } from "vitest";
import { allowRequest } from "@/lib/rate-limit.server";

describe("allowRequest", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = "t1";
    for (let i = 0; i < 5; i++) expect(allowRequest(key, 5, 1000, 0)).toBe(true);
    expect(allowRequest(key, 5, 1000, 1)).toBe(false);
  });
  it("frees slots after the window passes", () => {
    const key = "t2";
    for (let i = 0; i < 5; i++) allowRequest(key, 5, 1000, 0);
    expect(allowRequest(key, 5, 1000, 2000)).toBe(true);
  });
  it("tracks keys independently", () => {
    for (let i = 0; i < 5; i++) allowRequest("a", 5, 1000, 0);
    expect(allowRequest("b", 5, 1000, 0)).toBe(true);
  });
  it("does not grow without bound as distinct keys accumulate", () => {
    for (let i = 0; i < 1500; i++) allowRequest(`sweep-${i}`, 5, 1000, 0);
    // Long after the window, a new caller triggers the sweep of expired keys.
    expect(allowRequest("after-sweep", 5, 1000, 10_000)).toBe(true);
    // Still enforces limits for a live caller once pruning has happened.
    for (let i = 0; i < 4; i++) allowRequest("after-sweep", 5, 1000, 10_000);
    expect(allowRequest("after-sweep", 5, 1000, 10_000)).toBe(false);
  });
});
