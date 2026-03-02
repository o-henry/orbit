import { formatTime } from "@/domain/time";
import { OrbitSessionPacket, UserSettings } from "@/lib/types";

const MAX_KEY_EXPRESSIONS = 3;

const normalizeTargetLanguageLabel = (value: string): string => {
  const code = value.trim().toLowerCase();
  if (code === "ja" || code === "jp" || code.includes("japan")) return "Japanese";
  return "English";
};

export const defaultConversationGoal = (targetLanguage: string): string => {
  const normalized = normalizeTargetLanguageLabel(targetLanguage);
  if (normalized === "Japanese") {
    return "이 장면을 바탕으로 3분 대화하고 마지막에 내가 일본어로 요약하게 하기";
  }
  return "이 장면을 바탕으로 3분 대화하고 마지막에 내가 내 말로 요약하게 하기";
};

export function createOrbitSessionPacket(input: {
  settings: UserSettings;
  videoTitle: string;
  videoUrl: string;
  startSec: number;
  endSec: number;
  oneLineSummaryKr: string;
  keyExpressions: string[];
  conversationGoal?: string;
  storyboardNeeded?: boolean;
  notes?: string;
  clipId?: string;
  videoId?: string;
}): OrbitSessionPacket {
  const targetLanguage = normalizeTargetLanguageLabel(input.settings.targetLanguage);
  const keyExpressions = input.keyExpressions.map((item) => item.trim()).filter(Boolean).slice(0, MAX_KEY_EXPRESSIONS);

  return {
    targetLanguage,
    level: input.settings.learnerLevel,
    videoTitle: input.videoTitle.trim() || "(제목 없음)",
    videoUrl: input.videoUrl,
    clipStart: formatTime(input.startSec),
    clipEnd: formatTime(input.endSec),
    oneLineSummaryKr: input.oneLineSummaryKr.trim(),
    keyExpressions,
    conversationGoal: (input.conversationGoal || defaultConversationGoal(targetLanguage)).trim(),
    correctionMode: input.settings.defaultCorrectionMode || "light",
    storyboardNeeded: Boolean(input.storyboardNeeded),
    notes: (input.notes || "").trim() || undefined,
    clipId: input.clipId,
    videoId: input.videoId,
    startSec: Math.max(0, Math.floor(input.startSec)),
    endSec: Math.max(0, Math.floor(input.endSec)),
  };
}

export function buildOrbitSessionPacketText(packet: OrbitSessionPacket): string {
  const expressions = packet.keyExpressions.slice(0, MAX_KEY_EXPRESSIONS);
  const expressionLines = expressions.length > 0
    ? expressions.map((item) => `- ${item}`).join("\n")
    : "- (없음)";

  return [
    "[ORBIT_SESSION]",
    `target_language: ${packet.targetLanguage}`,
    `level: ${packet.level}`,
    `video_title: ${packet.videoTitle}`,
    `video_url: ${packet.videoUrl}`,
    `clip_start: ${packet.clipStart}`,
    `clip_end: ${packet.clipEnd}`,
    `one_line_summary_kr: ${packet.oneLineSummaryKr || "(없음)"}`,
    "key_expressions:",
    expressionLines,
    `conversation_goal: ${packet.conversationGoal || defaultConversationGoal(packet.targetLanguage)}`,
    `correction_mode: ${packet.correctionMode || "light"}`,
    `storyboard_needed: ${packet.storyboardNeeded ? "yes" : "no"}`,
    `notes: ${packet.notes || "(없음)"}`,
  ].join("\n");
}
