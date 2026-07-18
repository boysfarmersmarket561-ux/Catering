import { describe, expect, it } from "vitest";
import { makeReference, REFERENCE_ALPHABET } from "@/lib/quote-reference";

describe("makeReference", () => {
  it("is 8 chars from the unambiguous alphabet", () => {
    const ref = makeReference();
    expect(ref).toHaveLength(8);
    for (const ch of ref) expect(REFERENCE_ALPHABET).toContain(ch);
  });
  it("is deterministic given an injected random source", () => {
    expect(makeReference(() => 0)).toBe("AAAAAAAA");
    expect(makeReference(() => 0.999999)).toBe("99999999");
  });
});
