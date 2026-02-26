import { describe, expect, it } from "vitest";
import {
  collectNoticingMatches,
  doesTextMatchNoticingFocus,
  getAdaptiveNoticingPresets,
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

  it("builds japanese-focused presets from japanese transcript", () => {
    const presets = getAdaptiveNoticingPresets({
      transcriptLines: [{ id: "1", text: "今日は映画を見ています。私は家にいます。" }],
      selectedText: "見ています",
      fallbackLanguage: "en",
    });

    expect(presets.some((item) => item.includes("ている"))).toBe(true);
    expect(presets.some((item) => item === "gonna")).toBe(false);
  });

  it("builds english-focused presets from english transcript", () => {
    const presets = getAdaptiveNoticingPresets({
      transcriptLines: [{ id: "1", text: "I'm gonna call you and we're gonna plan it." }],
      selectedText: "I'm gonna",
      fallbackLanguage: "ja",
    });

    expect(presets[0]).toBe("gonna");
  });
});
