import { describe, expect, it } from "vitest";
import {
  clampComprehensionRating,
  resolveFitBand,
  sortClipsByFitPriority,
  updateComprehensionAverage,
} from "@/domain/comprehension";

describe("comprehension helpers", () => {
  it("clamps rating to 1..5", () => {
    expect(clampComprehensionRating(0)).toBe(1);
    expect(clampComprehensionRating(3)).toBe(3);
    expect(clampComprehensionRating(7)).toBe(5);
  });

  it("updates rolling average", () => {
    expect(updateComprehensionAverage(undefined, 4)).toBe(4);
    expect(updateComprehensionAverage(4, 2)).toBe(3.4);
  });

  it("resolves fit band by average", () => {
    expect(resolveFitBand(4.6)).toBe("too_easy");
    expect(resolveFitBand(2.2)).toBe("too_hard");
    expect(resolveFitBand(3.5)).toBe("fit");
  });

  it("sorts clips by fit priority", () => {
    const sorted = sortClipsByFitPriority([
      { id: "1", youtubeUrl: "", videoId: "aaaaaaaaaaa", fitBand: "too_easy" },
      { id: "2", youtubeUrl: "", videoId: "bbbbbbbbbbb", fitBand: "fit" },
      { id: "3", youtubeUrl: "", videoId: "ccccccccccc", fitBand: "too_hard" },
    ]);

    expect(sorted.map((clip) => clip.id)).toEqual(["2", "3", "1"]);
  });
});
