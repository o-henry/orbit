import { MemoryItem, SrsCard, SessionLog, UserSettings, Clip } from "@/lib/types";
import * as clipRepo from "@/storage/clipRepo";
import * as memoryRepo from "@/storage/memoryRepo";
import * as srsRepo from "@/storage/srsRepo";
import * as sessionRepo from "@/storage/sessionRepo";
import { clearAllAppData, getStorageStatus } from "@/storage/metaRepo";
import { mergeStrandSeconds, normalizeStrandSeconds } from "@/domain/sessionAnalytics";

const SETTINGS_KEY = "dlb:settings";
const LEGACY_SETTINGS_KEY = "lingoplay_settings";

export const DEFAULT_SETTINGS: UserSettings = {
  language: "ko",
  targetLanguage: "en",
  learnerLevel: "초급",
  userAge: 20,
  userGender: "비공개",
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
