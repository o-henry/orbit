import {
  Clip,
  MemoryItem,
  OrbitSessionPacket,
  OrbitStudySession,
  RecallQueueCard,
  SessionReview,
  SessionStoryboard,
  SessionLog,
  SrsCard,
  UserSettings,
  WeeklyPatternReport,
} from "@/lib/types";
import * as clipRepo from "@/storage/clipRepo";
import * as memoryRepo from "@/storage/memoryRepo";
import * as srsRepo from "@/storage/srsRepo";
import * as sessionRepo from "@/storage/sessionRepo";
import * as orbitSessionRepo from "@/storage/orbitSessionRepo";
import * as recallQueueRepo from "@/storage/recallQueueRepo";
import * as weeklyReportRepo from "@/storage/weeklyReportRepo";
import { clearAllAppData, getStorageStatus } from "@/storage/metaRepo";
import { mergeStrandSeconds, normalizeStrandSeconds } from "@/domain/sessionAnalytics";
import { buildOrbitSessionPacketText } from "@/domain/orbitSessionPacket";
import { generateRecallQueueCardsFromSession } from "@/domain/recallQueueGenerator";
import { analyzeWeeklyPatterns } from "@/domain/weeklyPatternAnalyzer";

const SETTINGS_KEY = "dlb:settings";
const LEGACY_SETTINGS_KEY = "lingoplay_settings";

export const DEFAULT_SETTINGS: UserSettings = {
  language: "ko",
  targetLanguage: "en",
  learnerLevel: "초급",
  userAge: 20,
  userGender: "비공개",
  chatgptProjectUrlEn: "",
  chatgptProjectUrlJa: "",
  defaultCorrectionMode: "light",
  goal: "conversation",
  dailyMinutes: 20,
  mode: "beginner",
  darkMode: false,
  setupComplete: false,
};

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getSettingsRaw(): UserSettings {
  if (!canUseLocalStorage()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function setSettingsRaw(value: UserSettings): void {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
}

// Clips
export async function getClips(): Promise<Clip[]> {
  return clipRepo.getAll();
}

export async function saveClip(clip: Clip): Promise<void> {
  await clipRepo.upsert(clip);
}

export async function deleteClip(id: string): Promise<void> {
  await clipRepo.remove(id);
}

export async function getClipById(id: string): Promise<Clip | undefined> {
  return clipRepo.getById(id);
}

// Memory
export async function getMemoryItems(): Promise<MemoryItem[]> {
  return memoryRepo.getAll();
}

export async function getMemoryItemById(id: string): Promise<MemoryItem | undefined> {
  return memoryRepo.getById(id);
}

export async function getMemoryByClipId(clipId: string): Promise<MemoryItem[]> {
  return memoryRepo.getByClipId(clipId);
}

export async function saveMemoryItem(item: MemoryItem): Promise<void> {
  const existing = await memoryRepo.getById(item.id);
  if (existing) {
    await memoryRepo.update(item);
  } else {
    await memoryRepo.create(item);
  }
}

export async function deleteMemoryItem(id: string): Promise<void> {
  await memoryRepo.remove(id);
}

// SRS
export async function getSrsCards(): Promise<SrsCard[]> {
  return srsRepo.getAll();
}

export async function saveSrsCard(card: SrsCard): Promise<void> {
  await srsRepo.upsert(card);
}

export async function deleteSrsCard(id: string): Promise<void> {
  await srsRepo.remove(id);
}

export async function getDueCards(date?: string): Promise<SrsCard[]> {
  return srsRepo.getDue(date);
}

export async function getSrsCardByMemoryId(memoryId: string): Promise<SrsCard | undefined> {
  return srsRepo.getByMemoryId(memoryId);
}

// Sessions
export async function getSessionLogs(): Promise<SessionLog[]> {
  return sessionRepo.getAll();
}

export async function saveSessionLog(log: SessionLog): Promise<void> {
  await sessionRepo.append(log);
}

// Orbit sessions
export async function createOrbitSessionPacket(packet: OrbitSessionPacket): Promise<OrbitStudySession> {
  const now = Date.now();
  const session: OrbitStudySession = {
    id: `os_${now}_${Math.random().toString(36).slice(2, 7)}`,
    targetLanguage: packet.targetLanguage,
    packet,
    packetText: buildOrbitSessionPacketText(packet),
    status: "packet_ready",
    createdAt: now,
    updatedAt: now,
  };

  await orbitSessionRepo.upsert(session);
  return session;
}

export async function getOrbitSessionById(id: string): Promise<OrbitStudySession | undefined> {
  return orbitSessionRepo.getById(id);
}

export async function listOrbitSessions(filter?: {
  language?: string;
  status?: OrbitStudySession["status"];
  limit?: number;
}): Promise<OrbitStudySession[]> {
  const all = await orbitSessionRepo.getAll();
  const filtered = all
    .filter((session) => {
      if (filter?.language && session.targetLanguage !== filter.language) return false;
      if (filter?.status && session.status !== filter.status) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (filter?.limit) {
    return filtered.slice(0, Math.max(1, Math.floor(filter.limit)));
  }
  return filtered;
}

export async function saveSessionReview(sessionId: string, review: SessionReview): Promise<OrbitStudySession | null> {
  const found = await orbitSessionRepo.getById(sessionId);
  if (!found) return null;

  const next: OrbitStudySession = {
    ...found,
    review,
    status: found.storyboard ? "storyboarded" : "reviewed",
    updatedAt: Date.now(),
  };
  await orbitSessionRepo.upsert(next);
  return next;
}

export async function saveSessionStoryboard(sessionId: string, storyboard: SessionStoryboard): Promise<OrbitStudySession | null> {
  const found = await orbitSessionRepo.getById(sessionId);
  if (!found) return null;

  const next: OrbitStudySession = {
    ...found,
    storyboard,
    status: found.review ? "storyboarded" : found.status,
    updatedAt: Date.now(),
  };
  await orbitSessionRepo.upsert(next);
  return next;
}

export async function generateRecallQueue(sessionId: string): Promise<RecallQueueCard[]> {
  const found = await orbitSessionRepo.getById(sessionId);
  if (!found) return [];

  const now = Date.now();
  const cards = generateRecallQueueCardsFromSession(found, now);
  await Promise.all(cards.map((card) => recallQueueRepo.upsert(card)));

  const next: OrbitStudySession = {
    ...found,
    status: "queued",
    recallQueueGeneratedAt: now,
    updatedAt: now,
  };
  await orbitSessionRepo.upsert(next);
  return cards;
}

export async function listRecallQueue(filter?: {
  dueOnly?: boolean;
  language?: string;
}): Promise<RecallQueueCard[]> {
  const all = await recallQueueRepo.getAll();
  const now = Date.now();
  return all
    .filter((card) => {
      if (filter?.language && card.language !== filter.language) return false;
      if (filter?.dueOnly && (card.status !== "pending" || card.dueAt > now)) return false;
      return true;
    })
    .sort((a, b) => a.dueAt - b.dueAt);
}

export async function completeRecallCard(cardId: string, result?: {
  prompt?: string;
  answer?: string;
}): Promise<RecallQueueCard | null> {
  const found = await recallQueueRepo.getById(cardId);
  if (!found) return null;

  const next: RecallQueueCard = {
    ...found,
    ...(result?.prompt ? { prompt: result.prompt.trim() } : {}),
    ...(result?.answer ? { answer: result.answer.trim() } : {}),
    status: "completed",
    completedAt: Date.now(),
  };
  await recallQueueRepo.upsert(next);
  return next;
}

export async function saveWeeklyPatternReport(report: WeeklyPatternReport): Promise<void> {
  await weeklyReportRepo.upsert(report);
}

export async function getWeeklyPatternReport(params: {
  from?: Date;
  to?: Date;
  language: string;
}): Promise<WeeklyPatternReport> {
  const allSessions = await orbitSessionRepo.getAll();
  const generated = analyzeWeeklyPatterns({
    sessions: allSessions,
    language: params.language,
    from: params.from,
    to: params.to,
  });

  const existing = await weeklyReportRepo.getById(generated.id);
  if (existing) {
    const next = {
      ...existing,
      ...generated,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    await weeklyReportRepo.upsert(next);
    return next;
  }

  await weeklyReportRepo.upsert(generated);
  return generated;
}

// Settings (sync access for app bootstrap)
export function getSettings(): UserSettings {
  return getSettingsRaw();
}

export function updateSettings(partial: Partial<UserSettings>): UserSettings {
  const settings = { ...getSettingsRaw(), ...partial };
  setSettingsRaw(settings);
  return settings;
}

export async function clearAllData(): Promise<void> {
  await clearAllAppData();
}

export async function getTotalStudyMinutes(): Promise<number> {
  const logs = await sessionRepo.getAll();
  return logs.reduce((sum, log) => sum + log.minutes, 0);
}

export async function getStreak(): Promise<number> {
  return sessionRepo.getStreak();
}

export async function getRecentSessionSummary(days = 7): Promise<{
  logs: SessionLog[];
  totalMinutes: number;
  totalSavedCount: number;
  strandSeconds: ReturnType<typeof normalizeStrandSeconds>;
  interactionTurns: number;
  noticingEvents: number;
  fluencyLoops: number;
}> {
  const logs = await sessionRepo.getAll();
  const recentLogs = logs.slice(-Math.max(1, Math.floor(days)));

  return recentLogs.reduce(
    (acc, log) => {
      acc.logs.push(log);
      acc.totalMinutes += log.minutes;
      acc.totalSavedCount += log.savedCount;
      acc.strandSeconds = mergeStrandSeconds(acc.strandSeconds, log.strandSeconds);
      acc.interactionTurns += log.interactionTurns || 0;
      acc.noticingEvents += log.noticingEvents || 0;
      acc.fluencyLoops += log.fluencyLoops || 0;
      return acc;
    },
    {
      logs: [] as SessionLog[],
      totalMinutes: 0,
      totalSavedCount: 0,
      strandSeconds: normalizeStrandSeconds(),
      interactionTurns: 0,
      noticingEvents: 0,
      fluencyLoops: 0,
    }
  );
}

export { getStorageStatus };
