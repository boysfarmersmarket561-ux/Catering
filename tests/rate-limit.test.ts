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
});
