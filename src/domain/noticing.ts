import { TranscriptLine } from "@/domain/transcript";

const PRESETS: Record<string, string[]> = {
  en: ["a / the", "gonna", "wanna", "linking", "past tense"],
  ja: ["ている", "は/が", "です/ます", "〜そう", "助詞"],
};

export const normalizeNoticingFocus = (value: string): string => value.trim();

export const getNoticingPresets = (targetLanguage: string): string[] => {
  const code = targetLanguage.trim().toLowerCase();
  if (code === "ja" || code === "jp") return PRESETS.ja;
  return PRESETS.en;
};

export const doesTextMatchNoticingFocus = (text: string, focus: string): boolean => {
  const normalizedFocus = normalizeNoticingFocus(focus);
  if (!normalizedFocus) return false;
  return text.toLowerCase().includes(normalizedFocus.toLowerCase());
};

export const collectNoticingMatches = (lines: TranscriptLine[], focus: string): TranscriptLine[] => {
  if (!normalizeNoticingFocus(focus)) return [];
  return lines.filter((line) => doesTextMatchNoticingFocus(line.text, focus));
};
