import { TranscriptLine } from "@/domain/transcript";

const PRESETS: Record<string, string[]> = {
  en: ["a / the", "gonna", "wanna", "linking", "past tense"],
  ja: ["ている", "は/が", "です/ます", "〜そう", "助詞"],
};

const EN_WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;
const JA_CHAR_RE = /[ぁ-ゟ゠-ヿ㐀-䶿一-鿿]/g;
const EN_CHAR_RE = /[A-Za-z]/g;
const MAX_PRESETS = 6;

const JA_GRAMMAR_CANDIDATES = [
  "は",
  "が",
  "を",
  "に",
  "で",
  "と",
  "も",
  "の",
  "ている",
  "です",
  "ます",
  "ない",
  "たい",
] as const;

const EN_PATTERN_CANDIDATES = [
  "gonna",
  "wanna",
  "gotta",
  "kinda",
  "sorta",
  "i'm",
  "you're",
  "we're",
  "they're",
  "don't",
  "doesn't",
  "didn't",
  "it's",
  "that's",
] as const;

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

const detectLanguageFromText = (text: string, fallbackLanguage?: string): "ja" | "en" => {
  const jaCount = text.match(JA_CHAR_RE)?.length || 0;
  const enCount = text.match(EN_CHAR_RE)?.length || 0;
  if (jaCount > enCount) return "ja";
  if (enCount > jaCount) return "en";

  const code = (fallbackLanguage || "").toLowerCase();
  if (code === "ja" || code === "jp") return "ja";
  return "en";
};

const extractEnglishFocusCandidates = (text: string): string[] => {
  const lower = text.toLowerCase();
  const picked: string[] = [];

  for (const pattern of EN_PATTERN_CANDIDATES) {
    if (lower.includes(pattern)) picked.push(pattern);
  }

  const articleCount = (lower.match(/\b(a|an|the)\b/g) || []).length;
  if (articleCount >= 2) {
    picked.push("a / the");
  }

  const pastCount = (lower.match(/\b\w+ed\b/g) || []).length;
  if (pastCount >= 2) {
    picked.push("past tense");
  }

  const words = lower.match(EN_WORD_RE) || [];
  const freq = new Map<string, number>();
  for (const word of words) {
    if (word.length < 4) continue;
    if (EN_PATTERN_CANDIDATES.includes(word as (typeof EN_PATTERN_CANDIDATES)[number])) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return [...picked, ...topWords];
};

const extractJapaneseFocusCandidates = (text: string): string[] => {
  const picked: string[] = [];
  for (const token of JA_GRAMMAR_CANDIDATES) {
    if (text.includes(token)) {
      picked.push(token);
    }
  }

  const politeCount = (text.match(/です|ます/g) || []).length;
  if (politeCount >= 2 && !picked.includes("です/ます")) {
    picked.push("です/ます");
  }

  const teiruCount = (text.match(/ている|ています/g) || []).length;
  if (teiruCount > 0 && !picked.includes("ている")) {
    picked.push("ている");
  }

  return picked;
};

export const getAdaptiveNoticingPresets = (params: {
  transcriptLines: TranscriptLine[];
  selectedText?: string;
  fallbackLanguage?: string;
}): string[] => {
  const transcriptText = params.transcriptLines.map((line) => line.text).join(" ");
  const combinedText = `${params.selectedText || ""} ${transcriptText}`.trim();
  const language = detectLanguageFromText(combinedText, params.fallbackLanguage);
  const dynamic = language === "ja" ? extractJapaneseFocusCandidates(combinedText) : extractEnglishFocusCandidates(combinedText);
  const fallback = PRESETS[language];

  const merged = [...dynamic, ...fallback]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, idx, arr) => arr.indexOf(item) === idx)
    .slice(0, MAX_PRESETS);

  return merged.length > 0 ? merged : fallback;
};
