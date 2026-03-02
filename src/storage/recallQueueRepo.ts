import { RecallQueueCard } from "@/lib/types";
import { getFromStore, listFromStore, removeFromStore, upsertToStore } from "@/storage/db";

export async function getAll(): Promise<RecallQueueCard[]> {
  return listFromStore("recallQueue");
}

export async function getById(id: string): Promise<RecallQueueCard | undefined> {
  return getFromStore("recallQueue", id);
}

export async function upsert(card: RecallQueueCard): Promise<void> {
  await upsertToStore("recallQueue", card);
}

export async function remove(id: string): Promise<void> {
  await removeFromStore("recallQueue", id);
}
