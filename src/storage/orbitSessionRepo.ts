import { OrbitStudySession } from "@/lib/types";
import { getFromStore, listFromStore, removeFromStore, upsertToStore } from "@/storage/db";

export async function getAll(): Promise<OrbitStudySession[]> {
  return listFromStore("orbitSessions");
}

export async function getById(id: string): Promise<OrbitStudySession | undefined> {
  return getFromStore("orbitSessions", id);
}

export async function upsert(session: OrbitStudySession): Promise<void> {
  await upsertToStore("orbitSessions", session);
}

export async function remove(id: string): Promise<void> {
  await removeFromStore("orbitSessions", id);
}
