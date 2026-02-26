import { SessionLog } from "@/lib/types";
import { listFromStore, upsertToStore } from "@/storage/db";
import { mergeSessionLogAnalytics } from "@/domain/sessionAnalytics";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function append(log: SessionLog): Promise<void> {
  const existing = await listFromStore("sessionLogs");
  const prev = existing.find((item) => item.date === log.date);

  if (!prev) {
    await upsertToStore("sessionLogs", log);
    return;
  }

  const analytics = mergeSessionLogAnalytics(prev, log);
  await upsertToStore("sessionLogs", {
    ...prev,
    minutes: prev.minutes + log.minutes,
    savedCount: prev.savedCount + log.savedCount,
    stepsCompleted: {
      ...prev.stepsCompleted,
      ...log.stepsCompleted,
    },
    ...analytics,
  });
}

export async function getRange(from: string, to: string): Promise<SessionLog[]> {
  const all = await listFromStore("sessionLogs");
  return all
    .filter((log) => log.date >= from && log.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAll(): Promise<SessionLog[]> {
  const all = await listFromStore("sessionLogs");
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getStreak(): Promise<number> {
  const logs = await getAll();
  const set = new Set(logs.map((log) => log.date));

  let streak = 0;
  const day = new Date();
  while (set.has(toDateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }

  return streak;
}
