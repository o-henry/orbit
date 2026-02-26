import { describe, expect, it } from "vitest";
import {
  collectNoticingMatches,
  doesTextMatchNoticingFocus,
  getNoticingPresets,
  normalizeNoticingFocus,
} from "@/domain/noticing";

describe("noticing helpers", () => {
  it("normalizes focus", () => {
    expect(normalizeNoticingFocus("  gonna ")).toBe("gonna");
  });

  it("returns language presets", () => {
    expect(getNoticingPresets("ja").length).toBeGreaterThan(0);
    expect(getNoticingPresets("en").length).toBeGreaterThan(0);
  });

  it("matches focus in text ignoring case", () => {
    expect(doesTextMatchNoticingFocus("I am gonna call you", "GONNA")).toBe(true);
    expect(doesTextMatchNoticingFocus("I am going to call you", "gonna")).toBe(false);
  });

  it("collects matching lines", () => {
    const lines = [
      { id: "1", text: "I am gonna go" },
      { id: "2", text: "How are you" },
      { id: "3", text: "wanna try" },
    ];

    const matched = collectNoticingMatches(lines, "wanna");
    expect(matched.map((line) => line.id)).toEqual(["3"]);
  });
});
