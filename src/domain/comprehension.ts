import { Clip } from "@/lib/types";

export type ClipFitBand = "too_easy" | "fit" | "too_hard";

export const clampComprehensionRating = (value: number): number => {
  const safe = Math.floor(Number(value));
  if (!Number.isFinite(safe)) return 3;
  return Math.max(1, Math.min(5, safe));
};

export const updateComprehensionAverage = (prevAverage: number | undefined, nextRating: number): number => {
  const safeRating = clampComprehensionRating(nextRating);
  if (!Number.isFinite(prevAverage as number)) {
    return safeRating;
  }

  const smoothed = (prevAverage as number) * 0.7 + safeRating * 0.3;
  return Number(smoothed.toFixed(2));
};

export const resolveFitBand = (average: number | undefined): ClipFitBand => {
  const safe = Number(average);
  if (!Number.isFinite(safe)) return "fit";
  if (safe >= 4.4) return "too_easy";
  if (safe <= 2.6) return "too_hard";
  return "fit";
};

const FIT_PRIORITY: Record<ClipFitBand, number> = {
  fit: 0,
  too_hard: 1,
  too_easy: 2,
};

export const sortClipsByFitPriority = (clips: Clip[]): Clip[] =>
  clips.slice().sort((a, b) => {
    const aBand = a.fitBand || resolveFitBand(a.comprehensionAvg);
    const bBand = b.fitBand || resolveFitBand(b.comprehensionAvg);
    return FIT_PRIORITY[aBand] - FIT_PRIORITY[bBand];
  });
