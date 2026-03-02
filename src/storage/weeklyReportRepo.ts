import { WeeklyPatternReport } from "@/lib/types";
import { getFromStore, listFromStore, removeFromStore, upsertToStore } from "@/storage/db";

export async function getAll(): Promise<WeeklyPatternReport[]> {
  return listFromStore("weeklyReports");
}

export async function getById(id: string): Promise<WeeklyPatternReport | undefined> {
  return getFromStore("weeklyReports", id);
}

export async function upsert(report: WeeklyPatternReport): Promise<void> {
  await upsertToStore("weeklyReports", report);
}

export async function remove(id: string): Promise<void> {
  await removeFromStore("weeklyReports", id);
}
